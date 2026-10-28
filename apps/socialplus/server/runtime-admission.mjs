// Connection/admission only. Never modify a locked artistic engine to wire it.
import path from 'node:path';
import {tmpdir} from 'node:os';
import {mkdtemp,rm,writeFile} from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import {createHash} from 'node:crypto';
import {renderAlexV16} from '../../worker/src/alex-v16-pipeline.js';
export function connectedRuntime(engines,env=process.env,{alex=renderAlexV16}={}){
 const alexEnabled=env.SOCIALPLUS_ALEX_V16_PIPELINE==='true'&&env.ALEX_V16_RECONSTRUCTION_ENABLED==='true'&&env.ALEX_V16_REVIEW_DRAFTS==='true';
 const allowed=new Set(['social-kinetic-v28',...(alexEnabled?['alex-hormozi-v16']:[])]);
 function assertModelAllowed(model){
  const id=String(model).replace(/^restored-preview:/,'');
  if(!['technical-export','guided-edit'].includes(id)&&!allowed.has(id))throw Object.assign(new Error('Les sources de ce modèle sont conservées, mais son pipeline n’est pas activé dans ce serveur. Aucun preset de remplacement ne sera lancé.'),{status:422,code:'MODEL_PIPELINE_NOT_CONNECTED'});
  return id;
 }
 return {...engines,MODEL_CATALOG:engines.MODEL_CATALOG.map(model=>({...model,available:allowed.has(model.id),previewAvailable:allowed.has(model.id),...(allowed.has(model.id)?{}:{status:'not_connected',reason:'Sources conservées ; pipeline non activé dans ce runtime. Aucun rendu générique.'})})),assertModelAllowed,
  async renderVideo(options){
   const id=assertModelAllowed(options.modelId);
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
