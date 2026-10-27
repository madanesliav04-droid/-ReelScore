// Offline native benchmark only: no account, key, API, upload or deployment.
import {readFile,writeFile} from 'node:fs/promises';
import {performance} from 'node:perf_hooks';
import {renderAlexV16} from '/app/src/alex-v16-pipeline.js';

if(process.arch!=='arm64')throw new Error('Run in the ARM64 image; x86 measurements are not A1 measurements.');
const started=performance.now();
let result,error;
try {
  result=await renderAlexV16({sourcePath:'/input/rush.mov',workDir:'/output',outputPath:'/output/alex.mp4',reviewDraft:true});
}catch(e){error={code:e.code||'BENCHMARK_FAILED',message:String(e.message).slice(0,2000)};}
const counters={};
for(const name of ['memory.peak','memory.events','cpu.stat']){
  try{counters[name]=(await readFile('/sys/fs/cgroup/'+name,'utf8')).trim();}catch{counters[name]=null;}
}
await writeFile('/output/benchmark.json',JSON.stringify({
  architecture:process.arch,node:process.version,elapsedSeconds:(performance.now()-started)/1000,
  cgroup:counters,ok:!error,error,bytes:result?.bytes,outputSha256:result?.outputSha256,
  reviewRequired:result?.reviewRequired,phoneticAlignmentCertified:false,
  note:'Container CPU/RAM counters include child processes. This benchmark never certifies speech or visual fidelity.'
},null,2),{mode:0o600});
if(error)process.exitCode=1;
