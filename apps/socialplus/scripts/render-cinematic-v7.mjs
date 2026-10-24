// Local-only autonomous Cinematic entry point. No UI, hosted API or old media.
import {parseArgs} from 'node:util';
import {resolve,dirname} from 'node:path';
import {readFile,writeFile,mkdir,stat} from 'node:fs/promises';
import {analyzeSource,transcribeSource,renderVideo} from '../server/render.mjs';
import {planCinematic,cinematicReviewItems} from '../server/cinematic-plan.mjs';
const {values}=parseArgs({options:{input:{type:'string'},transcript:{type:'string'},output:{type:'string'},preview:{type:'boolean',default:false},help:{type:'boolean'}}});
if(values.help||!values.input||!values.output){console.log('node apps/socialplus/scripts/render-cinematic-v7.mjs --input rush.mov [--transcript mots.json] --output montage.mp4 [--preview]\nSans --transcript : modèle Whisper local configuré requis. --preview ne confirme aucun mot incertain.');process.exit(values.help?0:1);}
try{
 const sourcePath=resolve(values.input),outputPath=resolve(values.output);
 if(sourcePath===outputPath)throw Error('La sortie doit être distincte du rush.');
 for(const file of [outputPath,outputPath+'.plan.json',outputPath+'.result.json',outputPath+'.review.json']){
  try{await stat(file);throw Error('La sortie existe déjà : '+file);}catch(e){if(e.code!=='ENOENT')throw e;}
 }
 const report=await analyzeSource(sourcePath);
 if(!report.metadata.hasAudio||report.metadata.durationMs>60_000||report.metadata.width*report.metadata.height>1920*1080)throw Error('V7 exige une voix originale, 60 secondes maximum et 1080p natif maximum.');
 const transcript=values.transcript?JSON.parse(await readFile(resolve(values.transcript),'utf8')):await transcribeSource(sourcePath);
 const plan=planCinematic(report,transcript,{preview:values.preview});
 await mkdir(dirname(outputPath),{recursive:true,mode:0o700});
 await writeFile(outputPath+'.plan.json',JSON.stringify(plan,null,2),{mode:0o600,flag:'wx'});
 const review=cinematicReviewItems(plan);
 await writeFile(outputPath+'.review.json',JSON.stringify({sourceSha256:plan.sourceSha256,captionStatus:plan.captionStatus,items:review},null,2),{mode:0o600,flag:'wx'});
 const localEdit={report,approvedPauseIds:plan.approvedPauseIds,transcript:plan.transcript,captionsReviewed:plan.captionsReviewed,previewOnly:plan.allowUnreviewedPreview};
 const result=await renderVideo({sourcePath,outputPath,modelId:'cinematic-storytelling-v7',localEdit,restoredInput:plan,onProgress:async(p,m)=>console.log(p,m)});
 result.audit={...result.audit,engine:plan.engineVersion,editorialMode:'automatic_local_quote_only',placement:plan.placementPolicy,captionStatus:plan.captionStatus,uncertainWordCount:plan.warnings.filter(w=>w.code==='WORD_REVIEW_REQUIRED').length,releaseApproved:false,historicalMediaRead:false};
 await writeFile(outputPath+'.result.json',JSON.stringify(result,null,2),{mode:0o600,flag:'wx'});
 console.log(JSON.stringify({output:outputPath,sourceSha256:plan.sourceSha256,scenes:plan.events.length,cuts:plan.cuts.length,captionStatus:plan.captionStatus,unresolvedReviewEntries:review.length,reviewFile:outputPath+'.review.json',metadata:result.metadata},null,2));
}catch(e){console.error(e.code??'CINEMATIC_FAILED',e.message,e.details??'');process.exitCode=1;}
