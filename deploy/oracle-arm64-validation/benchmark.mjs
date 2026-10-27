// Offline native benchmark only: no account, key, API, upload or deployment.
import {writeFile} from 'node:fs/promises';
import {performance} from 'node:perf_hooks';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {renderAlexV16} from '/app/src/alex-v16-pipeline.js';
import {startTelemetry} from './telemetry.mjs';

if(process.arch!=='arm64')throw new Error('Run in the ARM64 image; x86 measurements are not A1 measurements.');
const started=performance.now();
const telemetry=await startTelemetry({directory:'/output'});
const probe=async file=>JSON.parse((await promisify(execFile)('ffprobe',['-v','error','-show_entries','stream=codec_type,codec_name,width,height:format=duration,size','-of','json',file],{maxBuffer:2_000_000})).stdout);
let result,error,source,output;
try {
  source=await probe('/input/rush.mov');
  result=await renderAlexV16({sourcePath:'/input/rush.mov',workDir:'/output',outputPath:'/output/alex.mp4',reviewDraft:true});
  output=await probe('/output/alex.mp4');
}catch(e){error={code:e.code||'BENCHMARK_FAILED',message:String(e.message).slice(0,2000)};}
const metrics=await telemetry.stop();
const video=output?.streams.find(s=>s.codec_type==='video');
await writeFile('/output/benchmark.json',JSON.stringify({
  architecture:process.arch,node:process.version,elapsedSeconds:(performance.now()-started)/1000,
  metrics,source,output,ok:!error,error,bytes:result?.bytes,outputSha256:result?.outputSha256,
  atLeast1080p:video?Math.min(video.width,video.height)>=1080:null,
  reviewRequired:result?.reviewRequired,phoneticAlignmentCertified:false,
  testedConcurrency:1,
  note:'No upscale or engine change. Single render only; concurrency capacity is not inferred. This benchmark never certifies speech or visual fidelity.'
},null,2),{mode:0o600});
if(error)process.exitCode=1;
