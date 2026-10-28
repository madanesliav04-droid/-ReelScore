import {test} from 'node:test';import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';import os from 'node:os';import path from 'node:path';
import {replayAnalysis} from '../src/analysis-replay.js';
test('independent imports of identical bytes reuse first persisted result only for same owner and configuration',async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'analysis-replay-'));const rows=[];
 const db={from(table){assert.equal(table,'viralplus_analyses');const filters={};return {select(){return this},eq(k,v){filters[k]=v;return this},order(){return this},limit(n){assert.equal(n,1);return this},async maybeSingle(){const row=rows.find(r=>r.owner===filters.user_id&&r.result.source_sha256===filters.video_sha256&&r.result.reproducibility.fingerprint===filters['result_json->reproducibility->>fingerprint']);return {data:row?{result_json:row.result}:null,error:null}}}}};
 let calls=0;const analyze=async()=>{calls++;return {final_score:43,scores:{hook:40},timeline:[]}};
 try{
  const a=path.join(dir,'first.mov'),b=path.join(dir,'second.mov');await writeFile(a,'unit-test-not-video');await writeFile(b,'unit-test-not-video');
  const input={db,userId:'owner',filePath:a,configuration:{model:'unit-v1'},analyze};
  const first=await replayAnalysis(input);rows.push({owner:'owner',result:first});
  const second=await replayAnalysis({...input,filePath:b});assert.deepEqual(second,first);assert.equal(calls,1);
  const third=await replayAnalysis({...input,configuration:{model:'unit-v2'}});assert.notEqual(third.reproducibility.fingerprint,first.reproducibility.fingerprint);assert.equal(calls,2);
  await replayAnalysis({...input,userId:'another-owner'});assert.equal(calls,3);
 }finally{await rm(dir,{recursive:true,force:true})}
});
test('database failure never silently falls through to a potentially billable analysis',async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'analysis-replay-'));let calls=0;
 try{
  const source=path.join(dir,'source');await writeFile(source,'fixture');
  const chain={select(){return this},eq(){return this},order(){return this},limit(){return this},async maybeSingle(){return {error:{code:'402'},data:null}}};
  await assert.rejects(replayAnalysis({db:{from:()=>chain},userId:'owner',filePath:source,configuration:{model:'unit'},analyze:async()=>{calls++}}),e=>e.code==='ANALYSIS_REPLAY_UNAVAILABLE');assert.equal(calls,0);
 }finally{await rm(dir,{recursive:true,force:true})}
});
