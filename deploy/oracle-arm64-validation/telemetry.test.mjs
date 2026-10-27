import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,mkdir,symlink,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {cpuSummary,directoryBytes} from './telemetry.mjs';

test('CPU counters report weighted average and sampled peaks for two CPUs',()=>{
  const result=cpuSummary([{atMs:0,usageUsec:0},{atMs:1000,usageUsec:2000000},{atMs:3000,usageUsec:3000000}]);
  assert.equal(result.averageCorePercent,100);
  assert.equal(result.averageCapacityPercent,50);
  assert.equal(result.peakSampledCorePercent,200);
  assert.equal(result.peakSampledCapacityPercent,100);
});
test('missing telemetry is unknown, not zero CPU usage',()=>assert.equal(cpuSummary([]),null));
test('counter resets and invalid time cannot become valid performance results',()=>{
  assert.throws(()=>cpuSummary([{atMs:0,usageUsec:2},{atMs:1,usageUsec:1}]));
  assert.throws(()=>cpuSummary([{atMs:0,usageUsec:0},{atMs:0,usageUsec:1}]));
});
test('workspace measurement includes nested files and does not follow outside symlinks',async()=>{
  const dir=await mkdtemp(path.join(os.tmpdir(),'socialplus-telemetry-'));
  try{
    await writeFile(path.join(dir,'a'),'abc');await mkdir(path.join(dir,'nested'));
    await writeFile(path.join(dir,'nested','b'),'12345');await symlink(os.tmpdir(),path.join(dir,'outside'));
    const result=await directoryBytes(dir);assert.equal(result.apparentBytes,8);assert.equal(result.files,2);
  }finally{await rm(dir,{recursive:true,force:true});}
});
