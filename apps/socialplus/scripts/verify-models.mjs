// Local QA only: no upload, transcription API, provider credits or account quota.
import {createReadStream} from 'node:fs';
import {readFile,writeFile,mkdir,readdir,rename,rm} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {performance} from 'node:perf_hooks';
import {probeVideo,renderVideo} from '../server/render.mjs';
import {RESTORED_PREVIEWS,restoredPlan} from '../server/restored-models.mjs';

const appRoot=fileURLToPath(new URL('../',import.meta.url));
const canonical=value=>JSON.stringify(value,(_key,item)=>item&&typeof item==='object'&&!Array.isArray(item)?Object.fromEntries(Object.keys(item).sort().map(key=>[key,item[key]])):item);
const digest=value=>createHash('sha256').update(value).digest('hex');
export async function fileHash(file){const hash=createHash('sha256');for await(const chunk of createReadStream(file))hash.update(chunk);return hash.digest('hex');}

export async function engineHash(){
 const files=[];
 async function walk(root){for(const entry of await readdir(root,{withFileTypes:true})){const file=path.join(root,entry.name);if(entry.isDirectory()&&!['node_modules','__pycache__'].includes(entry.name))await walk(file);else if(entry.isFile()&&/\.(mjs|js|py|json)$/.test(entry.name))files.push(file);}}
 // Changes to account/strategy/UI code must not invalidate video work.
 for(const name of ['render.mjs','restored-models.mjs','kinetic-capture.mjs','local-edit.mjs'])files.push(path.join(appRoot,'server',name));
 for(const dir of ['engines','../worker/src'])await walk(path.resolve(appRoot,dir));
 files.push(path.join(appRoot,'package-lock.json'),fileURLToPath(import.meta.url));
 const hash=createHash('sha256');
 for(const file of files.sort()){hash.update(path.relative(appRoot,file));hash.update('\0');hash.update(await fileHash(file));}
 return hash.digest('hex');
}

async function save(file,value){const temporary=file+'.tmp';await writeFile(temporary,JSON.stringify(value,null,2)+'\n',{mode:0o600});await rename(temporary,file);}

export async function prepareModelQa({sourcePath,outputDir}){
 const sourceSha256=await fileHash(sourcePath),metadata=await probeVideo(sourcePath);
 await mkdir(outputDir,{recursive:true,mode:0o700});
 const planPath=path.join(outputDir,'plan-to-review.json');
 // Never replace a transcription or placements that have already been reviewed.
 const template={sourceSha256,speechReviewed:false,captionsReviewed:false,transcript:[],models:Object.fromEntries(RESTORED_PREVIEWS.map(model=>[model,{placementReviewed:false,events:[]}]))};
 try{await writeFile(planPath,JSON.stringify(template,null,2)+'\n',{flag:'wx',mode:0o600});}catch(error){if(error.code!=='EEXIST')throw error;}
 return {source:{name:path.basename(sourcePath),sha256:sourceSha256,metadata},planPath,providerCalls:0,renders:0,releaseApproved:false};
}

export async function verifyModels({sourcePath,plan,outputDir,signal,reuseCache=true,dependencies={}}){
 const hashFile=dependencies.fileHash||fileHash;
 const sourceSha256=await hashFile(sourcePath);
 const metadata=await (dependencies.probeVideo||probeVideo)(sourcePath,{signal});
 const rendererSha256=await (dependencies.engineHash||engineHash)();
 const runtime={node:process.version,platform:process.platform,arch:process.arch,python:process.env.SOCIALPLUS_PYTHON||'python3',chromium:process.env.SOCIALPLUS_CHROMIUM||null};
 await mkdir(outputDir,{recursive:true,mode:0o700});
 const report={generatedAt:new Date().toISOString(),source:{name:path.basename(sourcePath),sha256:sourceSha256,metadata},rendererSha256,runtime,
  scope:'Essais locaux des six adaptations bêta sur une source relue. Aucune certification artistique, écoute humaine ou recette sur trois rushs déduite des contrôles techniques.',
  providerCalls:0,releaseApproved:false,results:[]};
 const sourceIssue=plan?.sourceSha256!==sourceSha256?'Le plan relu ne correspond pas à l’empreinte du rush.':plan?.speechReviewed!==true?'La présence de parole réelle doit être vérifiée avant la recette.':null;
 for(const modelId of RESTORED_PREVIEWS){
  if(signal?.aborted)throw signal.reason||new Error('Recette annulée.');
  const input={transcript:plan?.transcript,captionsReviewed:plan?.captionsReviewed,...plan?.models?.[modelId]};
  try{
   if(sourceIssue)throw Object.assign(new Error(sourceIssue),{code:'SOURCE_REVIEW_REQUIRED'});
   // Validate every style independently before using a cache or starting work.
   restoredPlan(modelId,metadata,input);
  }catch(error){report.results.push({modelId,status:'blocked',code:error.code||'REFERENCE_INPUT_REQUIRED',message:error.message});continue;}
  const key=digest(canonical({sourceSha256,rendererSha256,runtime,modelId,input}));
  const outputPath=path.join(outputDir,key+'.mp4'),cachePath=path.join(outputDir,key+'.json');
  let cached;
  if(reuseCache)try{cached=JSON.parse(await readFile(cachePath,'utf8'));if(cached.key!==key||cached.outputSha256!==await hashFile(outputPath))cached=null;}catch{cached=null;}
  if(cached){report.results.push({...cached.result,cached:true});continue;}
  const started=performance.now();
  try{
   const result=await (dependencies.renderVideo||renderVideo)({sourcePath,outputPath,modelId,restoredInput:input,signal});
   const outputSha256=await hashFile(outputPath);
   const entry={modelId,status:'passed_technical_checks',cached:false,elapsedMs:Math.round(performance.now()-started),outputFile:path.basename(outputPath),outputSha256,metadata:result.metadata,audit:result.audit};
   await save(cachePath,{key,outputSha256,result:entry});
   report.results.push(entry);
  }catch(error){
   await rm(outputPath,{force:true});await rm(cachePath,{force:true});
   report.results.push({modelId,status:'failed',code:error.code||'RENDER_FAILED',message:error.message,elapsedMs:Math.round(performance.now()-started)});
  }
  // Persist after each model so an interruption does not lose previous work.
  await save(path.join(outputDir,'report.json'),report);
 }
 await save(path.join(outputDir,'report.json'),report);
 return report;
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const args=process.argv.slice(2),fresh=args[0]==='--fresh';if(fresh)args.shift();
 const [source,planFile,output]=args;
 if(!source||!planFile){console.error('Préparer sans rendu : npm run verify:models -- --prepare <rush existant> [dossier privé]\nRecetter : npm run verify:models -- <rush existant> <plan relu.json> [dossier privé de sortie]');process.exitCode=2;}
 else if(source==='--prepare'){
  try{console.log(JSON.stringify(await prepareModelQa({sourcePath:path.resolve(planFile),outputDir:path.resolve(output||path.join(appRoot,'.data/model-qa'))}),null,2));}
  catch(error){console.error(error.message);process.exitCode=1;}
 }
 else{
  try{
   const report=await verifyModels({sourcePath:path.resolve(source),plan:JSON.parse(await readFile(path.resolve(planFile),'utf8')),outputDir:path.resolve(output||path.join(appRoot,'.data/model-qa')),reuseCache:!fresh,signal:AbortSignal.timeout(30*60_000)});
   console.log(JSON.stringify({source:report.source.name,results:report.results.map(({modelId,status,cached,code,message})=>({modelId,status,cached,code,message})),releaseApproved:false},null,2));
   if(report.results.some(result=>result.status!=='passed_technical_checks'))process.exitCode=2;
  }catch(error){console.error(error.message);process.exitCode=1;}
 }
}
