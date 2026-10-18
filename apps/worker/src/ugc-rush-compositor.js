import {spawn} from 'node:child_process';
import path from 'node:path';

/** First-pass, evidence-led UGC assembly.
 * B-roll audio is always discarded. Narration is taken only from A-roll.
 * The order of supplied shots is a priority order, not a claim of semantic matching.
 */
export async function mediaDuration(file,probe=runCommand){
  const output=await probe('ffprobe',[
    '-v','error','-show_entries','format=duration',
    '-of','default=noprint_wrappers=1:nokey=1',file
  ]);
  const sec=Number(String(output).trim());
  if(!Number.isFinite(sec)||sec<=0)throw new Error('UGC_INVALID_DURATION');
  return sec;
}

export function planUgcCutaways(baseDuration,rushDurations,options={}){
  if(!Number.isFinite(baseDuration)||baseDuration<=0)throw new Error('UGC_INVALID_DURATION');
  if(!Array.isArray(rushDurations))throw new Error('UGC_INVALID_RUSH_LIST');
  const eligible=rushDurations
    .map((duration,index)=>({duration:Number(duration),index}))
    .filter(x=>Number.isFinite(x.duration)&&x.duration>=0.65);
  const maxShots=Math.max(0,Math.min(10,Number(options.maxShots??10)));
  const availableWindow=Math.max(0,baseDuration-4);
  const count=Math.min(eligible.length,maxShots,Math.floor(availableWindow/2.75));
  if(count===0)return [];
  const spacing=availableWindow/(count+1);
  return eligible.slice(0,count).map((item,i)=>{
    const seconds=Math.max(0.8,Math.min(2.1,item.duration,spacing*0.7));
    const start=Math.max(0.6,Math.min(baseDuration-seconds-.35,2+(i+1)*spacing-seconds/2));
    return {index:item.index,startSeconds:Number(start.toFixed(3)),durationSeconds:Number(seconds.toFixed(3)),reason:'plan secondaire dans une respiration visuelle (ordre utilisateur)'};
  });
}

export async function composeUgcRushes({sourcePath,rushPaths,outputPath,workDir,onProgress=async()=>{},exec=runCommand}){
  if(!Array.isArray(rushPaths)||rushPaths.length>40)throw new Error('UGC_INVALID_RUSH_LIST');
  const baseDuration=await mediaDuration(sourcePath,exec);
  const valid=[];
  for(const filename of rushPaths){
    try{
      valid.push({file:filename,duration:await mediaDuration(filename,exec)});
    }catch{
      // A failed secondary video cannot corrupt the primary narrator source.
    }
  }
  const plan=planUgcCutaways(baseDuration,valid.map(x=>x.duration));
  if(!plan.length)return {outputPath:sourcePath,placements:[],unusedCount:rushPaths.length,skipped:true};
  const clips=[];
  for(const [index,shot] of plan.entries()){
    const clip=path.join(workDir,'ugc-cutaway-'+index+'.mp4');
    // Cut short normalized visual-only clips to bound decoding and RAM.
    await exec('ffmpeg',[
      '-hide_banner','-loglevel','error','-y',
      '-stream_loop','-1','-i',valid[shot.index].file,
      '-t',String(shot.durationSeconds),
      '-vf','fps=30,scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1',
      '-an','-c:v','libx264','-preset','veryfast','-crf','20','-pix_fmt','yuv420p',
      clip
    ]);
    clips.push({clip,shot});
    await onProgress(index,plan.length,'Normalisation des rushes UGC');
  }
  const filter=[
    '[0:v]fps=30,scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1,format=yuv420p[base]'
  ];
  let previous='base';
  for(const [index,item] of clips.entries()){
    const next='stage'+index;
    filter.push('['+(index+1)+':v]setpts=PTS-STARTPTS+'+item.shot.startSeconds+'/TB[insert'+index+']');
    filter.push('['+previous+'][insert'+index+']overlay=x=0:y=0:eof_action=pass:repeatlast=0:shortest=0['+next+']');
    previous=next;
  }
  filter.push('['+previous+']format=yuv420p[outv]');
  const args=['-hide_banner','-loglevel','error','-y','-i',sourcePath];
  for(const item of clips)args.push('-i',item.clip);
  args.push('-filter_complex',filter.join(';'),'-map','[outv]','-map','0:a?',
    '-t',baseDuration.toFixed(3),'-c:v','libx264','-preset','veryfast',
    '-crf','20','-pix_fmt','yuv420p','-c:a','aac','-b:a','160k',
    '-movflags','+faststart',outputPath);
  await exec('ffmpeg',args);
  return {
    outputPath,
    placements:clips.map(x=>({...x.shot,sourceIndex:x.shot.index,sourceName:path.basename(valid[x.shot.index].file)})),
    unusedCount:rushPaths.length-clips.length,
    skipped:false
  };
}

function runCommand(binary,args){
  return new Promise((resolve,reject)=>{
    const process=spawn(binary,args,{stdio:['ignore','pipe','pipe']});
    let stdout='',stderr='';
    process.stdout.on('data',chunk=>{stdout+=String(chunk).slice(0,500000)});
    process.stderr.on('data',chunk=>{stderr+=String(chunk).slice(0,5000)});
    process.on('error',reject);
    process.on('close',code=>code===0?resolve(stdout):reject(new Error(binary+' failed: '+stderr.slice(-800))));
  });
}
