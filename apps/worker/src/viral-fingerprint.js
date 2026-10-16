// Reproducible fingerprint of decoded audiovisual samples, independent of MP4/MOV metadata.
// The original byte SHA remains stored for exact identity; this is a second, cautious cache key.
import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';

function ffmpegBuffer(args,{timeoutMs=20000,maxBytes=262144}={}){
 return new Promise((resolve,reject)=>{
  const cp=spawn('ffmpeg',['-v','error','-nostdin',...args],{stdio:['ignore','pipe','pipe']});
  let parts=[],bytes=0,err='',done=false;
  const timer=setTimeout(()=>cp.kill('SIGKILL'),timeoutMs);
  cp.stdout.on('data',b=>{bytes+=b.length;if(bytes>maxBytes){cp.kill('SIGKILL');return;}parts.push(b)});
  cp.stderr.on('data',b=>{err+=String(b).slice(0,700)});
  cp.once('error',e=>{if(!done){done=true;clearTimeout(timer);reject(e)}});
  cp.once('close',code=>{
    clearTimeout(timer);if(done)return;done=true;
    if(code!==0||!bytes||bytes>maxBytes)return reject(new Error('AUDIOVISUAL_FINGERPRINT_FAILED: '+String(err).slice(0,240)));
    resolve(Buffer.concat(parts));
  });
 });
}
export async function decodedSourceFingerprint({filePath,durationSec,width,height,hasAudio=true}){
 const duration=Number(durationSec),w=Number(width),h=Number(height);
 if(!filePath||!Number.isFinite(duration)||duration<=0||!Number.isFinite(w)||w<=0||!Number.isFinite(h)||h<=0)throw new Error('FINGERPRINT_INVALID_SOURCE');
 const hash=createHash('sha256');
 // Dimensions and duration prevent accidental collisions between unrelated clips.
 hash.update('viralplus-visual-audio-samples-v1\0'+w+'x'+h+'\0'+Math.round(duration*10));
 const points=[.05,.2,.35,.5,.65,.8,.95];
 for(const fraction of points){
  const at=Math.max(0,Math.min(duration-.02,duration*fraction));
  const frame=await ffmpegBuffer(['-ss',at.toFixed(3),'-i',filePath,'-map','0:v:0','-frames:v','1','-vf','scale=24:24:flags=area,format=gray','-f','rawvideo','pipe:1'],{maxBytes:2048});
  if(frame.length!==576)throw new Error('FINGERPRINT_FRAME_DIMENSION');
  hash.update(frame);
 }
 if(hasAudio){
  for(const fraction of [.12,.5,.88]){
   const at=Math.max(0,Math.min(duration-.02,duration*fraction));
   const slice=Math.max(.05,Math.min(.6,duration-at));
   const pcm=await ffmpegBuffer(['-ss',at.toFixed(3),'-i',filePath,'-map','0:a:0','-t',slice.toFixed(3),'-ac','1','-ar','8000','-f','s16le','pipe:1'],{maxBytes:12000});
   hash.update(pcm);
  }
 }else hash.update('NO_AUDIO');
 return 'av1-'+hash.digest('hex');
}

export async function probeFingerprintSource(filePath){
 return new Promise((resolve,reject)=>{
  const cp=spawn('ffprobe',['-v','error','-show_streams','-show_format','-of','json',filePath],{stdio:['ignore','pipe','pipe']});
  let output='',error='',finished=false;
  const timer=setTimeout(()=>cp.kill('SIGKILL'),18000);
  cp.stdout.on('data',b=>{output+=String(b);if(output.length>300000)cp.kill('SIGKILL')});
  cp.stderr.on('data',b=>{error+=String(b).slice(0,300)});
  cp.once('error',e=>{if(!finished){finished=true;clearTimeout(timer);reject(e)}});
  cp.once('close',code=>{
    clearTimeout(timer);if(finished)return;finished=true;
    if(code!==0)return reject(new Error('FINGERPRINT_PROBE_FAILED '+error.slice(0,180)));
    try{
      const data=JSON.parse(output);
      const video=(data.streams||[]).find(x=>x.codec_type==='video');
      const audio=(data.streams||[]).find(x=>x.codec_type==='audio');
      if(!video)throw new Error('NO_VIDEO_STREAM');
      resolve({durationSec:Number(data.format?.duration||video.duration),width:Number(video.width),height:Number(video.height),hasAudio:Boolean(audio)});
    }catch(e){reject(e)}
  });
 });
}
