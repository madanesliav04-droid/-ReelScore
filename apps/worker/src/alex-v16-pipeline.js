// Real shared worker/CLI path. No master, demo export, external ASR or paid API.
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
import {readFile,writeFile,stat} from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import {createHash} from 'node:crypto';
import {extractMeasurableSignals} from './viral.js';
import {preprocessVideo,normalizeNativeVideo} from './render.js';
import {verifyMp4} from './export-integrity.js';
import {verifySource} from './media-integrity.js';
import {buildAlexV16Plan} from './alex-v16-plan.js';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../reconstruction/alex-v16');
const sha=async p=>{const h=createHash('sha256');for await(const b of createReadStream(p))h.update(b);return h.digest('hex');};
const fail=(code,message)=>{throw Object.assign(new Error(message),{code});};

async function python(args,{onFrame=()=>{}}={}){
 return new Promise((resolve,reject)=>{
  const p=spawn(process.env.SOCIALPLUS_PYTHON||'python3',args,{env:{...process.env,HF_HUB_OFFLINE:'1',HF_HUB_DISABLE_TELEMETRY:'1'},stdio:['ignore','pipe','pipe']});
  let out='',err='',tail='';const timer=setTimeout(()=>{p.kill('SIGKILL');},20*60*1000);
  p.stdout.on('data',b=>{out+=b;if(out.length>8_000_000)p.kill('SIGKILL');});
  p.stderr.on('data',b=>{err=(err+b).slice(-16000);tail+=b;const lines=tail.split('\n');tail=lines.pop();for(const line of lines){const m=line.match(/^ALEX_PROGRESS (\d+)\/(\d+)/);if(m)onFrame(Number(m[1]),Number(m[2]));}});
  p.on('error',e=>{clearTimeout(timer);reject(Object.assign(e,{code:'ALEX_RUNTIME_REQUIRED'}));});
  p.on('close',code=>{clearTimeout(timer);if(code!==0)return reject(Object.assign(new Error('Python Alex : '+err.slice(-4000)),{code:'ALEX_RENDER_FAILED'}));try{resolve(JSON.parse(out));}catch{reject(Object.assign(new Error('Réponse Alex invalide'),{code:'ALEX_RENDER_FAILED'}));}});
 });
}

export async function renderAlexV16({sourcePath,workDir,outputPath,transcriptPath=null,reviewDraft=false,onProgress=async()=>{}}){
 await verifySource(sourcePath,{});
 const sourceSha256=await sha(sourcePath);
 await onProgress('transcribing',18,'Mesures réelles et transcription locale Alex');
 const measurable=await extractMeasurableSignals(sourcePath);
 if(!measurable.audioCodec)fail('ALEX_AUDIO_REQUIRED','Une voix originale est requise.');
 if(measurable.durationSec>600||measurable.durationSec<=0)fail('ALEX_SOURCE_LIMIT','Rush limité à dix minutes.');
 let transcript;
 if(transcriptPath){
  transcript=JSON.parse(await readFile(transcriptPath,'utf8'));
  if(transcript.sourceSha256!==sourceSha256)fail('ALEX_TRANSCRIPT_SOURCE_MISMATCH','La transcription ne correspond pas au rush importé.');
 }else{
  if(!process.env.SOCIALPLUS_ASR_MODEL_DIR)fail('ALEX_ASR_MODEL_REQUIRED','Configurer les poids Whisper locaux existants ; aucun téléchargement automatique.');
  transcript=await python([path.join(root,'transcribe_local.py'),sourcePath]);
  transcript.sourceSha256=sourceSha256;
 }
 await writeFile(path.join(workDir,'alex-transcript.json'),JSON.stringify(transcript,null,2),{mode:0o600});
 await onProgress('planning',42,'Scènes Alex reliées aux mots du rush');
 const plan=buildAlexV16Plan({transcript,measurable});
 if(plan.reviewRequired&&!reviewDraft)fail('ALEX_TRANSCRIPT_REVIEW_REQUIRED','Transcription non confirmée : export de contrôle explicite uniquement.');
 let input=sourcePath;
 if(plan.removedRanges.length){
  input=path.join(workDir,'alex-prepared.mp4');
  await preprocessVideo({inputPath:sourcePath,outputPath:input,keepRanges:plan.keepRanges,hasAudio:true,onProgress:async(pct,stage)=>onProgress('processing',pct,stage)});
 }
 const normalized=path.join(workDir,'alex-native-cfr.mp4');
 const targetFPS=[24,25,30,50,60].reduce((a,b)=>Math.abs(b-measurable.fps)<Math.abs(a-measurable.fps)?b:a);
 await onProgress('processing',50,'Cadence native stabilisée sans recadrage ni filtre audio');
 await normalizeNativeVideo({inputPath:input,outputPath:normalized,fps:targetFPS,audioCodec:measurable.audioCodec});
 input=normalized;
 const planPath=path.join(workDir,'alex-plan.json');
 await writeFile(planPath,JSON.stringify(plan,null,2),{mode:0o600});
 await onProgress('rendering',56,'Rendu réel des trois infographies Alex et des sous-titres');
 let pending=Promise.resolve(),progressError=null;
 const qa=await python([path.join(root,'render.py'),'--input',input,'--plan',planPath,'--output',outputPath,...(plan.reviewRequired?['--review-draft']:[])],{onFrame:(frame,total)=>{pending=pending.then(()=>onProgress('rendering',56+Math.min(37,Math.floor(37*frame/Math.max(1,total))),'Images calculées '+frame+'/'+total)).catch(e=>{progressError=e;});}});
 await pending;
 if(progressError)throw progressError;
 await onProgress('encoding',95,'Vérification du MP4 et des pistes originales');
 await verifyMp4(outputPath,{width:measurable.width,height:measurable.height,durationMs:plan.outputDurationMs,hasAudio:true});
 const review={required:plan.reviewRequired,issues:plan.issues,warnings:plan.warnings,transcriptionReviewed:transcript.reviewed===true,phoneticAlignmentCertified:false};
 const timeline={version:1,engine:plan.engine,style:'hormozi_omni',captionPreset:'alex_v16',width:measurable.width,height:measurable.height,fps:measurable.fps,sourceDurationMs:plan.sourceDurationMs,outputDurationMs:plan.outputDurationMs,keepRanges:plan.keepRanges,removedRanges:plan.removedRanges,captions:[],alexPlan:plan,review,export:{width:measurable.width,height:measurable.height,codec:'h264',pixelFormat:'yuv420p'}};
 const result={outputPath,hasAudio:true,reviewRequired:review.required,review,sourceSha256,outputSha256:await sha(outputPath),bytes:(await stat(outputPath)).size,referenceUsed:false,transcriptEngine:transcript.engineVersion,timeline,qa};
 await writeFile(path.join(workDir,'alex-result.json'),JSON.stringify(result,null,2),{mode:0o600});
 return result;
}
