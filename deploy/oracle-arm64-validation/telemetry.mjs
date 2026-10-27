import {readFile,readdir,lstat} from 'node:fs/promises';
import path from 'node:path';
import {performance} from 'node:perf_hooks';

export function cpuSummary(samples,capacityCpus=2){
  if(!Number.isFinite(capacityCpus)||capacityCpus<=0)throw new Error('Invalid CPU capacity');
  if(samples.length<2)return null;
  let cpuUsec=0,elapsedMs=0,peakCorePercent=0;
  for(let i=1;i<samples.length;i++){
    const ms=samples[i].atMs-samples[i-1].atMs;
    const usec=samples[i].usageUsec-samples[i-1].usageUsec;
    if(!Number.isFinite(ms+usec)||ms<=0||usec<0)throw new Error('Nonmonotonic CPU sample');
    cpuUsec+=usec;elapsedMs+=ms;
    peakCorePercent=Math.max(peakCorePercent,usec/ms/10);
  }
  const averageCorePercent=cpuUsec/elapsedMs/10;
  return {averageCorePercent,peakSampledCorePercent:peakCorePercent,
    averageCapacityPercent:averageCorePercent/capacityCpus,
    peakSampledCapacityPercent:peakCorePercent/capacityCpus,
    capacityCpus,sampledSeconds:elapsedMs/1000,
    convention:'100% core = one fully busy CPU; peak is interval-sampled, not instantaneous'};
}

export async function directoryBytes(directory){
  let apparentBytes=0,allocatedBytes=0,files=0;
  async function visit(dir){
    for(const name of await readdir(dir)){
      const file=path.join(dir,name),s=await lstat(file).catch(e=>{if(e.code==='ENOENT')return null;throw e;});
      if(!s||s.isSymbolicLink())continue;
      if(s.isDirectory())await visit(file);
      else if(s.isFile()){files++;apparentBytes+=s.size;allocatedBytes+=s.blocks*512;}
    }
  }
  await visit(directory);return {apparentBytes,allocatedBytes,files};
}

export async function startTelemetry({directory,cgroupRoot='/sys/fs/cgroup',intervalMs=1000}){
  const samples=[],warnings=new Set();let peakApparentBytes=0,peakAllocatedBytes=0,pending=null;
  async function sample(){
    const stat=await readFile(path.join(cgroupRoot,'cpu.stat'),'utf8').catch(()=>null);
    const usage=stat?.match(/^usage_usec (\d+)$/m);
    if(usage)samples.push({atMs:performance.now(),usageUsec:Number(usage[1])});
    else warnings.add('CGROUP_CPU_UNAVAILABLE');
    try{
      const size=await directoryBytes(directory);
      peakApparentBytes=Math.max(peakApparentBytes,size.apparentBytes);
      peakAllocatedBytes=Math.max(peakAllocatedBytes,size.allocatedBytes);
    }catch{warnings.add('WORKSPACE_SAMPLING_FAILED');}
  }
  await sample();
  const timer=setInterval(()=>{if(!pending)pending=sample().finally(()=>{pending=null;});},intervalMs);
  return {async stop(){
    clearInterval(timer);await pending;await sample();
    const counters={};
    for(const name of ['memory.peak','memory.events','cpu.stat'])
      counters[name]=await readFile(path.join(cgroupRoot,name),'utf8').then(s=>s.trim()).catch(()=>null);
    let cpu=null;try{cpu=cpuSummary(samples);}catch{warnings.add('CPU_COUNTER_RESET_OR_INVALID');}
    return {cpu,cpuSamples:samples,cgroup:counters,
      ramPeakBytes:counters['memory.peak']!==null&&/^\d+$/.test(counters['memory.peak'])?Number(counters['memory.peak']):null,
      workspacePeakApparentBytes:peakApparentBytes,workspacePeakAllocatedBytes:peakAllocatedBytes,
      samplingIntervalMs:intervalMs,warnings:[...warnings],
      note:'RAM is container cgroup peak including descendants/cache; disk and CPU peaks are sampled. Image/source disk is separate.'};
  }};
}
