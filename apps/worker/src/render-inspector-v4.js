import {spawn} from 'node:child_process';

// Observable audio/video defects only. Never treat "clean" as a premium quality score.
export function parseRenderSignals(log,durationSec,hasAudio=true){
 const black=[...String(log).matchAll(/black_start:([\d.]+)\s+black_end:([\d.]+)\s+black_duration:([\d.]+)/g)]
   .map(m=>({start:Number(m[1]),end:Number(m[2]),duration:Number(m[3])}));
 const paired=(startPattern,endPattern)=>{
   const begins=[...String(log).matchAll(startPattern)].map(m=>Number(m[1]));
   const ends=[...String(log).matchAll(endPattern)].map(m=>Number(m[1]));
   return begins.map((start,i)=>{
     const end=Number.isFinite(ends[i])&&ends[i]>=start?ends[i]:Number(durationSec);
     return {start,end,duration:Math.max(0,end-start),trailing:!Number.isFinite(ends[i])};
   });
 };
 const freezes=paired(/freeze_start:\s*([\d.]+)/g,/freeze_end:\s*([\d.]+)/g);
 const silence=paired(/silence_start:\s*([\d.]+)/g,/silence_end:\s*([\d.]+)/g);
 const peaks=[...String(log).matchAll(/max_volume:\s*(-?[\d.]+)\s*dB/g)].map(m=>Number(m[1]));
 const maxVolumeDb=peaks.length?peaks.at(-1):null,review=[];
 for(const b of black.filter(x=>x.duration>=1.1))
   review.push({type:'EXTENDED_BLACK_FRAME',atSec:b.start,durationSec:b.duration});
 for(const f of freezes.filter(x=>x.duration>=3.1))
   review.push({type:'POSSIBLE_FREEZE',atSec:f.start,durationSec:f.duration});
 for(const s of silence.filter(x=>x.duration>=4))
   review.push({type:'LONG_AUDIO_SILENCE',atSec:s.start,durationSec:s.duration});
 if(hasAudio&&maxVolumeDb!==null&&maxVolumeDb>=-.05)
   review.push({type:'AUDIO_PEAK_NEAR_FULL_SCALE',peakDb:maxVolumeDb});
 return {policy:'editplus-render-observable-signals-v4',inspectedDurationSec:Number(durationSec),
   blackEvents:black.length,freezeEvents:freezes.length,
   audioSilenceEvents:hasAudio?silence.length:null,maxVolumeDb,review,
   verdict:review.length?'NEEDS_HUMAN_REVIEW':'NO_MEASURABLE_ALERT',
   limitations:'Does not validate edit semantics, hand gestures, subtitles or premium aesthetics.'};
}
export async function inspectRenderedVideo(file,{durationSec,hasAudio=true,timeoutMs=150000}={}){
 if(!file||!Number.isFinite(Number(durationSec))||Number(durationSec)<=0)
   throw new Error('Invalid video input/duration');
 const args=['-hide_banner','-nostdin','-loglevel','info','-i',file,
   '-t',String(Number(durationSec).toFixed(3)),
   '-vf','blackdetect=d=0.24:pix_th=0.10:pic_th=0.98,freezedetect=n=-47dB:d=2',
   ...(hasAudio?['-af','volumedetect,silencedetect=noise=-38dB:d=1.5']:['-an']),
   '-f','null','-'];
 let stderr='';
 await new Promise((resolve,reject)=>{
   const child=spawn('ffmpeg',args,{stdio:['ignore','ignore','pipe']});
   const timer=setTimeout(()=>child.kill('SIGKILL'),timeoutMs);
   child.stderr.on('data',chunk=>{stderr+=String(chunk);if(stderr.length>5_000_000)stderr=stderr.slice(-2_000_000)});
   child.on('error',e=>{clearTimeout(timer);reject(e)});
   child.on('close',(code,signal)=>{clearTimeout(timer);if(code===0)resolve();else reject(new Error('QA FFmpeg exited '+code+'/'+signal+': '+stderr.slice(-500)))});
 });
 return parseRenderSignals(stderr,durationSec,hasAudio);
}
