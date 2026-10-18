/**
 * Edit+ V15: original, iMessage-inspired outgoing bloup cue.
 *
 * Does NOT distribute or claim to contain Apple's proprietary sound file.
 * Only play when there is a verified, useful on-screen iMessage bubble,
 * with semanticReason, sourcePhrase and resolved output startMs.
 *
 * Keep a SINGLE original voice track: the engine mixes effects over the
 * pristine post-cuts source, never over an older export with duplicated FX.
 */
import fs from 'node:fs/promises';
import {spawn} from 'node:child_process';
import path from 'node:path';
const RATE=48000;
const MAX_BLOUP_DURATION_MS=240;
const VALID_REASONS=new Set([
  'point_1_explicit','point_2_explicit',
  'benefit_1_enumeration','benefit_2_enumeration','benefit_3_enumeration'
]);
const isFiniteNumber=x=>typeof x==='number'&&Number.isFinite(x);
export function planUsefulIOSBloopSounds({events=[],durationMs=0}={}){
 if(!isFiniteNumber(durationMs)||durationMs<500)throw new Error('IOS_SFX_INVALID_DURATION');
 if(!Array.isArray(events))throw new Error('IOS_SFX_INVALID_EVENTS');
 const allowed=[],held=[],seen=new Set();
 for(const e of events){
  const cueId=String(e?.id||'').trim(),reason=String(e?.semanticReason||'');
  if(!cueId||seen.has(cueId)||!VALID_REASONS.has(reason)||
     !String(e?.sourcePhrase||'').trim()||e?.speechVerified!==true||
     e?.onScreenBubbleVerified!==true||
     !isFiniteNumber(e?.outputStartMs)||e.outputStartMs<0||
     e.outputStartMs>durationMs-MAX_BLOUP_DURATION_MS){
   held.push({id:cueId||'(missing)',reason:'UNVERIFIED_OR_DECORATIVE_BUBBLE'});
   continue;
  }
  seen.add(cueId);
  const timestampMs=Math.round(e.outputStartMs);
  if(allowed.some(x=>Math.abs(x.timestampMs-timestampMs)<260)){
   held.push({id:cueId,reason:'SFX_OVERLAP_SAFETY'});
   continue;
  }
  allowed.push({
   id:cueId,timestampMs,semanticReason:reason,
   sourcePhrase:e.sourcePhrase,
   // Outgoing messages for right-side points; left-side for enumerated benefits.
   pan:reason.startsWith('point_')?.22:-.2
  });
 }
 allowed.sort((a,b)=>a.timestampMs-b.timestampMs);
 return {version:'ios-like-sent-bloup-v15',status:allowed.length?'ready':'no_qualified_cues',
  clipMs:MAX_BLOUP_DURATION_MS,cues:allowed,held,
  officialAppleAsset:false,customSynth:true};
}
const clamp=(x,min,max)=>Math.min(max,Math.max(min,x));
function wavStereo(samples,rate=RATE){
 const n=samples.length/2;
 const b=Buffer.allocUnsafe(44+n*4);
 b.write('RIFF',0,'ascii');b.writeUInt32LE(b.length-8,4);b.write('WAVE',8,'ascii');
 b.write('fmt ',12,'ascii');b.writeUInt32LE(16,16);b.writeUInt16LE(1,20);
 b.writeUInt16LE(2,22);b.writeUInt32LE(rate,24);b.writeUInt32LE(rate*4,28);
 b.writeUInt16LE(4,32);b.writeUInt16LE(16,34);
 b.write('data',36,'ascii');b.writeUInt32LE(n*4,40);
 for(let i=0;i<n*2;i++)b.writeInt16LE(Math.round(clamp(samples[i],-1,1)*32767),44+i*2);
 return b;
}
/** Deterministic ~235ms smooth rounded 'bloup' (no cartoon pop, no swoosh). */
export function synthIOSLikeBloop({sampleRate=RATE,durationMs=235}={}){
 if(!Number.isInteger(sampleRate)||sampleRate<16000||sampleRate>96000)throw Error('INVALID_SAMPLE_RATE');
 const n=Math.round(sampleRate*durationMs/1000),out=new Float32Array(n);
 let p1=0,p2=0;
 for(let i=0;i<n;i++){
  const t=i/sampleRate;
  const f1=520+340*Math.exp(-t/.054)-38*Math.exp(-t/.16);
  const f2=740+285*Math.exp(-t/.042);
  p1+=2*Math.PI*f1/sampleRate;p2+=2*Math.PI*f2/sampleRate;
  const env=(1-Math.exp(-t/.0045))*Math.exp(-Math.pow(t/.112,1.7));
  let sample=(.058*Math.sin(p1+.15*Math.sin(2*Math.PI*25*t)*Math.exp(-30*t))+
              .016*Math.sin(p2))*env;
  // Original deterministic soft attack click, no stock/copyrighted sample.
  sample+=.003*Math.sin(2*Math.PI*1260*t)*Math.exp(-t/.008);
  const fadeStart=Math.max(0,n-Math.round(.019*sampleRate));
  if(i>=fadeStart)sample*=Math.max(0,(n-i)/(n-fadeStart));
  out[i]=sample;
 }
 return out;
}
/** Write exactly one bloup per meaningful on-screen bubble. */
export async function writeIOSBubbleSfxTrack({filePath,plan,durationMs,sampleRate=RATE}){
 if(!plan?.cues?.length)throw Error('IOS_SFX_NO_VERIFIED_CUES');
 const n=Math.ceil((durationMs+120)/1000*sampleRate),samples=new Float32Array(n*2);
 const bloup=synthIOSLikeBloop({sampleRate});
 for(const cue of plan.cues){
  const first=Math.round(cue.timestampMs/1000*sampleRate);
  const pan=clamp(cue.pan,-.8,.8);
  const left=Math.sqrt(1-pan),right=Math.sqrt(1+pan);
  for(let j=0;j<bloup.length&&first+j<n;j++){
   samples[2*(first+j)]+=bloup[j]*left;
   samples[2*(first+j)+1]+=bloup[j]*right;
  }
 }
 await fs.mkdir(path.dirname(filePath),{recursive:true});
 await fs.writeFile(filePath,wavStereo(samples,sampleRate));
 return {filePath,durationMs,renderedCues:plan.cues.length,channels:2};
}
function run(command,args){
 return new Promise((resolve,reject)=>{
  const proc=spawn(command,args,{shell:false,stdio:['ignore','ignore','pipe']});
  let err='';proc.stderr.on('data',b=>{err=(err+b.toString()).slice(-1700)});
  proc.on('error',reject);
  proc.on('close',c=>c===0?resolve():reject(new Error('IOS_SFX_MIX_FAILED '+err)));
 });
}
/** Mix from the untouched original voice in a video; never from a prior edited output. */
/**
 * V15 user-selected outgoing iMessage sound.
 * A caller-provided reference sound may be used for PRIVATE PREVIEW only.
 * Paid delivery requires rights verification for the supplied audio asset.
 * No synthetic fallback: the user rejected the previous "bloup".
 */
export async function renderIOSAudioWithOriginalVoice({
 postCutsSourceVideo,outputAudioFile,plan,durationMs,
 approvedSoundAssetPath,soundRightsVerified=false,privatePreviewOnly=false
}={}){
 if(!postCutsSourceVideo||!outputAudioFile||!plan?.cues?.length||
    !Number.isFinite(durationMs)||durationMs<500)throw Error('IOS_SFX_BAD_ARGS');
 if(!approvedSoundAssetPath)throw Error('IOS_SELECTED_SOUND_REQUIRED_NO_SYNTHETIC_FALLBACK');
 if(!soundRightsVerified&&!privatePreviewOnly)
   throw Error('IOS_SFX_COMMERCIAL_RIGHTS_NOT_VERIFIED');
 const n=plan.cues.length;
 const split=Array.from({length:n},(_,i)=>'[srcfx'+i+']').join('');
 const setup='[1:a:0]aresample=48000,asetpts=PTS-STARTPTS,asplit='+n+split+';';
 const filters=plan.cues.map((cue,i)=>{
  const ms=Math.round(cue.timestampMs);
  return '[srcfx'+i+']volume=0.65,adelay='+ms+'|'+ms+'[sound'+i+'];';
 }).join('');
 const inputs=plan.cues.map((_,i)=>'[sound'+i+']').join('');
 const chain='[0:a:0]aresample=48000,asetpts=PTS-STARTPTS[voice];'
    +setup+filters+'[voice]'+inputs+
    'amix=inputs='+(n+1)+':duration=first:dropout_transition=0:normalize=0,'
    +'alimiter=limit=0.85:level=0[a]';
 await run('ffmpeg',['-nostdin','-hide_banner','-loglevel','error','-y',
  '-i',postCutsSourceVideo,'-i',approvedSoundAssetPath,
  '-filter_complex',chain,'-map','[a]','-vn','-c:a','aac',
  '-b:a','224k','-ar','48000','-ac','2',
  '-t',String(durationMs/1000),outputAudioFile]);
 return {outputAudioFile,model:'ios-sent-user-selection-v15',
  voice:'original post-cuts only',addedSounds:n,
  soundSource:'caller-supplied external asset',
  licensedForCommercial:soundRightsVerified,
  privatePreviewOnly:!soundRightsVerified,
  readyForCommercialUse:soundRightsVerified};
}
