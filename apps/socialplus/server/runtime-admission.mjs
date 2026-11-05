// Connection/admission only. Never modify a locked artistic engine to wire it.
import path from 'node:path';
import {tmpdir} from 'node:os';
import {mkdtemp,rm,writeFile} from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import {createHash} from 'node:crypto';
import {renderCodieV60} from '../scripts/render-codie-v60.mjs';
import {CINEMATIC_VERSION} from './cinematic-plan.mjs';
import {renderAlexV16} from '../../worker/src/alex-v16-pipeline.js';
export function connectedRuntime(engines,env=process.env,{alex=renderAlexV16,codie=renderCodieV60}={}){
 const alexEnabled=env.SOCIALPLUS_ALEX_V16_PIPELINE==='true'&&env.ALEX_V16_RECONSTRUCTION_ENABLED==='true'&&env.ALEX_V16_REVIEW_DRAFTS==='true';
 const cinematicEnabled=env.SOCIALPLUS_CINEMATIC_V7_PIPELINE==='true';
 const codieEnabled=env.SOCIALPLUS_CODIE_V60_PARTIAL_BETA==='true';
 const allowed=new Set(['social-kinetic-v28',...(alexEnabled?['alex-hormozi-v16']:[]),...(cinematicEnabled?['cinematic-storytelling-v7']:[]),...(codieEnabled?['codie-omni-v60']:[])]);
 function assertModelAllowed(model){
  const id=String(model).replace(/^restored-preview:/,'');
  if(!['technical-export','guided-edit'].includes(id)&&!allowed.has(id))throw Object.assign(new Error('Les sources de ce modèle sont conservées, mais son pipeline n’est pas activé dans ce serveur. Aucun preset de remplacement ne sera lancé.'),{status:422,code:'MODEL_PIPELINE_NOT_CONNECTED'});
  return id;
 }
 return {...engines,MODEL_CATALOG:engines.MODEL_CATALOG.map(model=>({...model,available:allowed.has(model.id),previewAvailable:allowed.has(model.id),...(model.id==='codie-omni-v60'&&codieEnabled?{label:'Codie × OMNI — bêta partielle',version:'V60 partielle',status:'beta',reason:'Animations originales raccordées. Inserts vidéo et SFX historiques non restaurés. Transcription à vérifier.',fullModelRestored:false,releaseApproved:false}:{}),...(model.id==='cinematic-storytelling-v7'&&cinematicEnabled?{status:'beta',version:'V7 bêta',reason:'Moteur autonome existant : transcription et fidélité visuelle à vérifier.',releaseApproved:false}:{}),...(allowed.has(model.id)?{}:{status:'not_connected',reason:'Sources conservées ; pipeline non activé dans ce runtime. Aucun rendu générique.'})})),assertModelAllowed,
  async renderVideo(options){
   const id=assertModelAllowed(options.modelId);
   if(id==='cinematic-storytelling-v7'&&options.restoredInput?.engineVersion!==CINEMATIC_VERSION)throw Object.assign(new Error('Le plan autonome V7 lié à cette source est requis. Aucun aperçu générique.'),{status:422,code:'CINEMATIC_AUTONOMOUS_PLAN_REQUIRED'});
   if(id==='codie-omni-v60'){
    const supplied=options.restoredInput;
    if(!supplied?.placementReviewed||!Array.isArray(supplied.transcript)||!supplied.transcript.length||!Array.isArray(supplied.events))throw Object.assign(new Error('Préparez les mots et relisez les directions Codie avant ce rendu partiel.'),{status:422,code:'CODIE_DIRECTION_REQUIRED'});
    if(options.localEdit?.approvedPauseIds?.length||supplied.captionZones?.length)throw Object.assign(new Error('Les coupes manuelles et les zones de sous-titres personnalisées ne sont pas raccordées à cette bêta Codie. Aucune sélection ne sera ignorée.'),{status:422,code:'CODIE_CUSTOM_EDIT_NOT_CONNECTED'});
    const result=await codie({sourcePath:options.sourcePath,outputPath:options.outputPath,transcript:supplied.transcript,direction:supplied,signal:options.signal,writePlan:false,onProgress:n=>options.onProgress?.(n)});
    return {modelId:id,engine:result.plan.engine,bytes:result.bytes,eventCount:result.plan.cues.length,cuts:result.plan.cuts,captionStatus:'unreviewed_preview',reviewRequired:true,uncertainEntries:result.plan.warnings.filter(w=>w.code==='WORD_REVIEW_REQUIRED').length,fullModelRestored:false,releaseApproved:false,missingHistoricalInserts:result.plan.missingHistoricalInserts};
   }
   if(id!=='alex-hormozi-v16')return engines.renderVideo(options);
   if(options.signal?.aborted)throw Object.assign(new Error('Traitement annulé.'),{code:'RENDER_CANCELLED'});
   if(options.localEdit?.approvedPauseIds?.length)throw Object.assign(new Error('Les pauses manuelles ne sont pas raccordées à Alex V16. Utilisez ses cuts automatiques ; aucune sélection ne sera ignorée silencieusement.'),{status:422,code:'ALEX_MANUAL_CUTS_NOT_CONNECTED'});
   const workDir=await mkdtemp(path.join(tmpdir(),'socialplus-alex-runtime-'));
   try{
    let transcriptPath=null;
    const supplied=options.restoredInput;
    if(Array.isArray(supplied?.transcript)&&supplied.transcript.length){
     const hash=createHash('sha256');for await(const chunk of createReadStream(options.sourcePath))hash.update(chunk);
     transcriptPath=path.join(workDir,'supplied-transcript.json');
     // Preserve user corrections and uncertainty. Source binding is calculated
     // here, never accepted from the browser. The shared engine validates times.
     await writeFile(transcriptPath,JSON.stringify({words:supplied.transcript,sourceSha256:hash.digest('hex'),reviewed:supplied.captionsReviewed===true,engineVersion:'standalone-supplied-local-transcript-v1'}),{mode:0o600});
    }
    const result=await alex({sourcePath:options.sourcePath,outputPath:options.outputPath,workDir,transcriptPath,reviewDraft:true,onProgress:async(_status,pct)=>options.onProgress?.(pct)});
    return {modelId:id,engine:'alex-v16-shared-worker',reviewRequired:result.reviewRequired,review:result.review,captionStatus:result.reviewRequired?'unverified':'reviewed',releaseApproved:false,sourceSha256:result.sourceSha256,outputSha256:result.outputSha256,referenceUsed:false,bytes:result.bytes};
   }finally{await rm(workDir,{recursive:true,force:true})}
  }
 };
}
