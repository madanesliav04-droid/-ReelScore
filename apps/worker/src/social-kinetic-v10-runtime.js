import path from 'node:path';
import {mkdir,writeFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {socialKineticV10Html} from './social-kinetic-v10-word-plan.js';
import {renderWithHyperframes} from './hyperframes-renderer.js';

function ff(args){
 return new Promise((resolve,reject)=>{
  const p=spawn('ffmpeg',args,{shell:false,stdio:['ignore','ignore','pipe']});
  let stderr='';p.stderr.on('data',b=>{stderr=(stderr+b.toString()).slice(-3000)});
  p.on('error',reject);p.on('close',c=>c===0?resolve():reject(new Error('V10_COMPOSITING_FAILED '+c+' '+stderr)));
 });
}
/**
 * inputPath is ALREADY cut by preprocessVideo. Never cut it again.
 * Enforces original mono/stereo audio unchanged before final encode.
 * Consumer availability is protected by separate staging flag AND a release gate.
 */
export async function renderSocialKineticV10Staging({
 inputPath,outputPath,timeline,plan,workDir,onProgress=async()=>{}
}={}){
 if(process.env.ENABLE_SOCIAL_KINETIC_V10!=='staging')
  throw new Error('SOCIAL_KINETIC_V10_STAGE_ONLY');
 if(process.env.ENABLE_HYPERFRAMES_RENDER!=='true')
  throw new Error('SOCIAL_KINETIC_V10_RENDERER_OFF');
 if(plan?.status!=='staging_renderable'||!plan.events?.length)
  throw new Error('SOCIAL_KINETIC_V10_UNVERIFIED_WORDS_OR_FACE_SAFE_ZONES');
 if(timeline?.audio?.hasAudio!==true)throw new Error('SOCIAL_KINETIC_V10_REAL_VOICE_MISSING');
 if(plan.durationMs!==timeline.outputDurationMs)
  throw new Error('SOCIAL_KINETIC_V10_VIDEO_AUDIO_DURATION_DRIFT');
 const w=Number(timeline?.export?.width),h=Number(timeline?.export?.height);
 if(!Number.isInteger(w)||!Number.isInteger(h)||w<320||h<240)throw new Error('SOCIAL_KINETIC_V10_BAD_NATIVE_FORMAT');
 await mkdir(workDir,{recursive:true});
 const d=path.join(workDir,'hyperframes-v10');
 await mkdir(d,{recursive:true});
 await writeFile(path.join(d,'index.html'),socialKineticV10Html(plan,{width:w,height:h}),'utf8');
 await onProgress(72,'Animations Social Kinetic horodatées');
 const overlay=path.join(workDir,'kinetic-transparent.webm');
 await renderWithHyperframes({compositionDir:d,outputPath:overlay,timeoutMs:300000,fps:30});
 await onProgress(86,'Incrustation HyperFrames et conservation de la voix');
 await ff(['-hide_banner','-loglevel','error','-y','-i',inputPath,
   '-c:v','libvpx-vp9','-i',overlay,
   '-filter_complex','[0:v][1:v]overlay=0:0:format=auto:shortest=1,format=yuv420p[v]',
   '-map','[v]','-map','0:a:0',
   '-c:v','libx264','-preset','medium','-crf','17','-pix_fmt','yuv420p',
   '-c:a','copy','-movflags','+faststart',outputPath]);
 return {status:'STAGING_QA_REQUIRED',wordCount:plan.keptWordCount,
   cueCount:plan.events.length,outputPath,sourceAudio:'preserved-first-track'};
}
