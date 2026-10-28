import path from 'node:path';
import {mkdir,writeFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {renderWithHyperframes} from './hyperframes-renderer.js';
import {socialKineticV28Html} from './social-kinetic-v28-engine.js';
function ffmpeg(args){
 return new Promise((resolve,reject)=>{
  const p=spawn('ffmpeg',args,{shell:false,stdio:['ignore','ignore','pipe']});let err='';
  p.stderr.on('data',b=>{err=(err+b.toString()).slice(-3500)});
  p.on('error',reject);p.on('close',code=>code===0?resolve():reject(new Error('SOCIAL_KINETIC_V28_FFMPEG:'+code+': '+err)));
 });
}
export async function renderSocialKineticV28Staging({
 inputPath,outputPath,timeline,plan,workDir,onProgress=async()=>{}
}={}){
 if(process.env.ENABLE_SOCIAL_KINETIC_V28!=='staging')
   throw new Error('SOCIAL_KINETIC_V28_NOT_ENABLED');
 if(process.env.ENABLE_HYPERFRAMES_RENDER!=='true')
   throw new Error('SOCIAL_KINETIC_V28_HYPERFRAMES_REQUIRED');
 if(plan?.model!=='social_kinetic_v28'||plan?.status!=='staging_renderable'||!plan.events?.length)
   throw new Error('SOCIAL_KINETIC_V28_VERIFIED_TIMING_AND_FACE_PROOF_REQUIRED');
 if(timeline?.audio?.hasAudio!==true)throw new Error('SOCIAL_KINETIC_V28_ORIGINAL_VOICE_REQUIRED');
 if(Math.abs(Number(plan.durationMs)-Number(timeline.outputDurationMs))>65)
   throw new Error('SOCIAL_KINETIC_V28_DURATION_DRIFT');
 const width=Number(timeline?.export?.width),height=Number(timeline?.export?.height);
 if(!Number.isInteger(width)||!Number.isInteger(height)||width<320||height<240)
   throw new Error('SOCIAL_KINETIC_V28_INVALID_NATIVE_FRAME');
 const d=path.join(workDir,'social-kinetic-v28-verified');
 await mkdir(d,{recursive:true});
 await writeFile(path.join(d,'index.html'),socialKineticV28Html(plan,{width,height,fps:30}),'utf8');
 await onProgress(72,'Social Kinetic V28 · mots et animations vérifiés');
 const overlay=path.join(workDir,'social-kinetic-v28-overlay.webm');
 await renderWithHyperframes({compositionDir:d,outputPath:overlay,timeoutMs:300000,fps:30});
 await onProgress(86,'Social Kinetic V28 · fusion vidéo native et voix originale');
 // No new background music, speech synthesis, or duplicate voice. Preserve
 // the edited source's original AAC track; SFX are not guessed for clients.
 await ffmpeg(['-hide_banner','-loglevel','error','-y','-i',inputPath,
  '-c:v','libvpx-vp9','-i',overlay,'-filter_complex',
  '[0:v][1:v]overlay=0:0:format=auto:shortest=1,format=yuv420p[v]',
  '-map','[v]','-map','0:a:0',
  '-c:v','libx264','-preset','medium','-crf','17','-pix_fmt','yuv420p',
  '-c:a','copy','-movflags','+faststart',outputPath]);
 return {status:'STAGING_QA_REQUIRED',outputPath,
  captionCount:plan.events.filter(e=>e.kind==='caption').length,
  bubbleCount:plan.events.filter(e=>e.kind==='bubble').length,
  heldCount:plan.held?.length||0,originalVoice:'one source audio stream'};
}

