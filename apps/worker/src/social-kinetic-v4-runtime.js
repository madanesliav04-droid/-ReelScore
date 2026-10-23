import path from 'node:path';
import {mkdir,writeFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {socialKineticReferenceV4Html} from './social-kinetic-reference-v4.js';
import {renderWithHyperframes} from './hyperframes-renderer.js';
import {renderNativeEdit} from './render.js';

/**
 * Stage-gated Social Kinetic (model 2) render.
 * No Instagram UI, no generated voice, no decorative B-roll.
 */
function ffmpeg(args){
 return new Promise((resolve,reject)=>{
  const child=spawn('ffmpeg',args,{stdio:['ignore','ignore','pipe'],shell:false});
  let stderr='';
  child.stderr.on('data',x=>{stderr=(stderr+x.toString()).slice(-2200);});
  child.on('error',reject);
  child.on('close',code=>code===0?resolve():reject(new Error('SOCIAL_KINETIC_V4_FFMPEG_'+code+' '+stderr)));
 });
}
export async function renderSocialKineticV4Staging({
 sourcePath,outputPath,timeline,plan,workDir,onProgress=async()=>{}
}={}){
 if(process.env.ENABLE_SOCIAL_KINETIC_REFERENCE!=='staging')
  throw new Error('SOCIAL_KINETIC_V4_DISABLED');
 if(process.env.ENABLE_HYPERFRAMES_RENDER!=='true')
  throw new Error('SOCIAL_KINETIC_V4_HYPERFRAMES_DISABLED');
 if(plan?.status!=='staging_renderable'||!plan?.events?.length)
  throw new Error('SOCIAL_KINETIC_V4_NO_SAFE_EVENTS');
 if(timeline?.audio?.hasAudio!==true)
  throw new Error('SOCIAL_KINETIC_V4_ORIGINAL_AUDIO_REQUIRED');
 const w=Number(timeline.export?.width),h=Number(timeline.export?.height);
 if(!(w>=320&&h>=240))throw new Error('SOCIAL_KINETIC_V4_INVALID_FORMAT');
 await mkdir(workDir,{recursive:true});
 const project=path.join(workDir,'social-kinetic-v4-hyperframes');
 await mkdir(project,{recursive:true});
 await writeFile(path.join(project,'index.html'),
  socialKineticReferenceV4Html(plan,{width:w,height:h}),'utf8');
 const native=path.join(workDir,'source-clean.mp4');
 const overlay=path.join(workDir,'semantic-kinetic.webm');
 await onProgress(60,'Social Kinetic : plan naturel et cuts');
 await renderNativeEdit({
  sourcePath,outputPath:native,durationMs:timeline.outputDurationMs,
  timeline:{...timeline,captions:[],graphicCues:[],brollCues:[],punchIns:[]},onProgress
 });
 await onProgress(78,'Social Kinetic : motion fidèle au sens');
 await renderWithHyperframes({compositionDir:project,outputPath:overlay,
  fps:timeline.fps||30,timeoutMs:300000});
 await onProgress(88,'Social Kinetic : composition + audio original');
 await ffmpeg([
  '-hide_banner','-loglevel','error','-y',
  '-i',native,'-c:v','libvpx-vp9','-i',overlay,
  '-filter_complex','[0:v][1:v]overlay=x=0:y=0:format=auto:shortest=1,format=yuv420p[v]',
  '-map','[v]','-map','0:a:0',
  '-c:v','libx264','-preset','medium','-crf','17','-pix_fmt','yuv420p',
  '-c:a','copy','-movflags','+faststart',outputPath
 ]);
 return {outputPath,model:plan.model,graphicEvents:plan.events.length,
  releaseStatus:'REQUIRES_REAL_RUSH_VISUAL_AND_AUDIO_QA'};
}
