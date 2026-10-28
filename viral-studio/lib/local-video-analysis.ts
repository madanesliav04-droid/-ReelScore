export const LOCAL_ANALYSIS_VERSION='socialplus-local-audio-1';
export type AudioMeasurements={duration:number;peakDb:number|null;rmsDb:number|null;silenceRatio:number;clippedSamples:number;windows:{start:number;end:number}[]};
// Same decoded PCM and parameters yield the same measurements. No inferred words.
export function measureAudio(channels:Float32Array[],sampleRate:number):AudioMeasurements{
 if(!channels.length||!Number.isFinite(sampleRate)||sampleRate<=0||!channels[0].length)throw Error('AUDIO_INVALID');
 const count=channels[0].length;
 if(channels.some(c=>c.length!==count))throw Error('AUDIO_CHANNEL_LENGTH');
 const block=Math.max(1,Math.round(sampleRate*.1));let square=0,peak=0,clipped=0,quietStart:number|null=null;
 const windows:{start:number;end:number}[]=[];
 for(let offset=0;offset<count;offset+=block){
  const end=Math.min(count,offset+block);let energy=0;
  for(let i=offset;i<end;i++)for(const channel of channels){const value=channel[i];if(!Number.isFinite(value))throw Error('AUDIO_INVALID');const magnitude=Math.abs(value);peak=Math.max(peak,magnitude);energy+=value*value;if(magnitude>=.999)clipped++;}
  square+=energy;
  const quiet=Math.sqrt(energy/((end-offset)*channels.length))<10**(-35/20);
  if(quiet&&quietStart===null)quietStart=offset/sampleRate;
  if(!quiet&&quietStart!==null){if(offset/sampleRate-quietStart>=.3)windows.push({start:quietStart,end:offset/sampleRate});quietStart=null;}
 }
 const duration=count/sampleRate;
 if(quietStart!==null&&duration-quietStart>=.3)windows.push({start:quietStart,end:duration});
 const round=(n:number)=>Math.round(n*1000)/1000;
 const silence=windows.reduce((n,w)=>n+w.end-w.start,0);
 const rms=Math.sqrt(square/(count*channels.length));
 return {duration:round(duration),peakDb:peak?round(20*Math.log10(peak)):null,rmsDb:rms?round(20*Math.log10(rms)):null,silenceRatio:round(silence/duration),clippedSamples:clipped,windows:windows.map(w=>({start:round(w.start),end:round(w.end)}))};
}
