import path from 'node:path';
import {mkdir,writeFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {alexV7CaptionHtml} from './alex-v7-audio-captions.js';
import {assertAlexV8Deployment} from './alex-v8-release.js';
import {renderWithHyperframes} from './hyperframes-renderer.js';
import {renderNativeEdit} from './render.js';

/**
 * STAGING ONLY: do not enable before reviewing source ASR and export on 3 rushes.
 * Renders standard visual cuts (without any generic ASS subtitles), then
 * overlays the Apple-style per-word transparent HyperFrames composition.
 * Original sound is carried from the native render, never AI-voiced.
 */
function runFfmpeg(args){
 return new Promise((resolve,reject)=>{
  let stderr='';
  const child=spawn('ffmpeg',args,{stdio:['ignore','ignore','pipe'],shell:false});
  child.stderr.on('data',x=>{stderr=(stderr+x.toString()).slice(-2800)});
  child.on('error',reject);
  child.on('close',code=>code===0?resolve():reject(new Error('ALEX_V7_COMPOSITE_FAILED '+code+' '+stderr)));
 });
}
export async function renderAlexV7Staging({
 sourcePath,outputPath,plan,timeline,workDir,onProgress=async()=>{}
}={}){
 const v8=plan?.model==='alex_hormozi_v8';
 if(v8)assertAlexV8Deployment();
 else if(process.env.ENABLE_ALEX_V7_WORD_SYNC!=='staging')
   throw new Error('ALEX_V7_WORD_SYNC_DISABLED');
 if(process.env.ENABLE_HYPERFRAMES_RENDER!=='true')
   throw new Error('HYPERFRAMES_DISABLED');
 if(!plan?.groups?.length)throw new Error('ALEX_V7_TIMED_WORDS_MISSING');
 if(!['preview_transcript_timed','audio_reviewed','ready_for_render'].includes(plan.status))
   throw new Error('ALEX_V7_WORDS_NOT_EVIDENCED');
 await mkdir(workDir,{recursive:true});
 const compositionDir=path.join(workDir,'alex-v7-kinetic-html');
 await mkdir(compositionDir,{recursive:true});
 const nativeVideo=path.join(workDir,'clean-native.mp4');
 const overlay=path.join(workDir,'alex-v7-transparent.webm');
 const w=Number(timeline?.export?.width||timeline?.width);
 const h=Number(timeline?.export?.height||timeline?.height);
 const doc=alexV7CaptionHtml(plan,{width:w,height:h});
 await writeFile(path.join(compositionDir,'index.html'),doc,'utf8');
 await onProgress(57,'V7 · cadrage naturel sans sous-titres génériques');
 await renderNativeEdit({
  sourcePath,outputPath:nativeVideo,durationMs:timeline.outputDurationMs,
  timeline:{...timeline,captions:[],graphicCues:[]},
  onProgress
 });
 await onProgress(77,'V7 · sous-titres animés sur les mots entendus');
 await renderWithHyperframes({compositionDir,outputPath:overlay,
   fps:timeline.fps||30,timeoutMs:300000});
 await onProgress(87,'V7 · composition et audio d’origine');
 await runFfmpeg([
  '-hide_banner','-loglevel','error','-y',
  '-i',nativeVideo,
  '-c:v','libvpx-vp9','-i',overlay,
  '-filter_complex','[0:v][1:v]overlay=x=0:y=0:format=auto:shortest=1,format=yuv420p[v]',
  '-map','[v]','-map','0:a:0?',
  '-c:v','libx264','-preset','medium','-crf','17','-pix_fmt','yuv420p',
  '-c:a','copy','-movflags','+faststart',outputPath
 ]);
 return {model:v8?'alex_hormozi_v8':'alex_v7_staging',outputPath,captionCount:plan.groups.length,
  wordCount:plan.wordCount,releaseStatus:plan.releaseStatus,
  humanAudioReviewRequired:plan.releaseStatus!=='READY_FOR_VISUAL_QA'};
}
