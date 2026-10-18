import {spawn} from 'node:child_process';
import path from 'node:path';
import {writeFile,stat} from 'node:fs/promises';

async function command(bin,args){
  return new Promise((resolve,reject)=>{
    const child=spawn(bin,args,{stdio:['ignore','pipe','pipe']});
    let output='',error='';
    child.stdout.on('data',v=>{output+=String(v).slice(0,100000)});
    child.stderr.on('data',v=>{error=(error+String(v)).slice(-3000)});
    child.on('error',reject);
    child.on('close',code=>code===0?resolve(output):reject(new Error(bin+' exited '+code+': '+error.slice(-1000))));
  });
}

export async function probeUgcMedia(file,exec=command){
  const raw=await exec('ffprobe',['-v','error','-show_entries','format=duration:stream=codec_type,width,height',
    '-of','json',file]);
  const info=JSON.parse(raw);
  const duration=Number(info?.format?.duration);
  const video=info?.streams?.find(s=>s.codec_type==='video');
  if(!Number.isFinite(duration)||duration<0.65||!video)throw new Error('UGC_MEDIA_TOO_SHORT_OR_INVALID');
  return {duration,width:Number(video.width),height:Number(video.height),
    hasAudio:Boolean(info.streams?.some(s=>s.codec_type==='audio'))};
}

/** Captions-free visual fallback: never invent transcript, audio or B-roll.
 * We only use videos belonging to this authenticated job, normalized and joined in stated order.
 */
export async function renderUgcVisualSequence({sourcePath,rushPaths,workDir,outputPath,onProgress=async()=>{},exec=command}){
  if(!Array.isArray(rushPaths)||rushPaths.length<1||rushPaths.length>40)
    throw new Error('UGC_NEEDS_MULTIPLE_RUSHES');
  const paths=[sourcePath,...rushPaths];
  const eligible=[];
  for(const [i,file] of paths.entries()){
    try{
      const info=await probeUgcMedia(file,exec);
      eligible.push({file,originalIndex:i,info});
    }catch(error){
      if(i===0)throw error;
    }
  }
  if(eligible.length<2)throw new Error('UGC_NOT_ENOUGH_VALID_RUSHES');
  // Respect the narrator clip first, then meaningful user-ordered shots.
  // Avoid excessive 4K renders by limiting the initial preview to twelve source clips.
  const selected=eligible.slice(0,12);
  const segments=[];
  let total=0;
  for(const [i,item] of selected.entries()){
    const length=Math.min(item.info.duration,i===0?5.0:2.6);
    const local=path.join(workDir,'ugc-visual-segment-'+i+'.mp4');
    await exec('ffmpeg',['-hide_banner','-loglevel','error','-y',
      '-ss','0','-t',length.toFixed(3),'-i',item.file,
      '-vf','fps=30,scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1',
      '-an','-c:v','libx264','-preset','veryfast','-crf','24','-pix_fmt','yuv420p',
      '-r','30','-video_track_timescale','30000',local]);
    segments.push({local,index:item.originalIndex,duration:length});
    total+=length;
    await onProgress(50+Math.round((i+1)*35/selected.length),'Assemblage des plans UGC');
  }
  const listPath=path.join(workDir,'ugc-visual-concat.txt');
  await writeFile(listPath,segments.map(x=>"file '"+x.local.replace(/'/g,"'\\''")+"'").join('\n')+'\n');
  const joined=path.join(workDir,'ugc-visual-joined.mp4');
  await exec('ffmpeg',['-hide_banner','-loglevel','error','-y','-f','concat','-safe','0',
    '-i',listPath,'-map','0:v:0','-c:v','copy','-an',joined]);
  // Preserve a single original voice/ambient source if available. Other clips
  // contribute no audio; pad the primary source with silence, never dub or synthesize words.
  const finalArgs=['-hide_banner','-loglevel','error','-y','-i',joined];
  if(selected[0].info.hasAudio){
    finalArgs.push('-i',sourcePath,'-map','0:v:0','-map','1:a:0','-c:v','copy',
      '-c:a','aac','-b:a','160k','-af','apad','-t',total.toFixed(3));
  }else{
    finalArgs.push('-map','0:v:0','-c:v','copy','-an');
  }
  finalArgs.push('-movflags','+faststart',outputPath);
  await exec('ffmpeg',finalArgs);
  const check=await probeUgcMedia(outputPath,exec);
  const size=(await stat(outputPath)).size;
  if(size<8192||check.duration<1.5||check.width!==1080||check.height!==1920)
    throw new Error('UGC_OUTPUT_VALIDATION_FAILED');
  return {outputPath,durationMs:Math.round(check.duration*1000),width:check.width,height:check.height,
    sourceCount:selected.length,originalAudioPreserved:selected[0].info.hasAudio,
    skippedSources:paths.length-selected.length,mode:'UGC_VISUAL_SEQUENCE_NO_INVENTED_CAPTIONS'};
}
