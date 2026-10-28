import test from 'node:test';import assert from 'node:assert/strict';
import {stat,mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import path from 'node:path';
import {connectedRuntime} from './runtime-admission.mjs';
const models=['codie-omni-v60','alex-hormozi-v16','leila-hormozi-v53','social-kinetic-v28','apple-premium-spatial','cinematic-storytelling-v7'];
const engines={MODEL_CATALOG:models.map(id=>({id,available:true})),renderVideo:async value=>({unchanged:value})};
test('unconnected models and historical preview aliases fail before rendering, without a generic replacement',async()=>{
 const runtime=connectedRuntime(engines,{});assert.deepEqual(runtime.MODEL_CATALOG.filter(x=>x.available).map(x=>x.id),['social-kinetic-v28']);
 for(const id of models.filter(x=>x!=='social-kinetic-v28'))await assert.rejects(runtime.renderVideo({modelId:'restored-preview:'+id}),e=>e.code==='MODEL_PIPELINE_NOT_CONNECTED');
 assert.deepEqual(await runtime.renderVideo({modelId:'social-kinetic-v28'}),{unchanged:{modelId:'social-kinetic-v28'}});
});
test('Alex keeps submitted corrections, binds them to source bytes and cleans their temporary JSON',async()=>{
 const directory=await mkdtemp(path.join(tmpdir(),'alex-input-test-')),sourcePath=path.join(directory,'source');let captured,temp;
 try{
  await writeFile(sourcePath,'unit fixture, not a real video');
  const runtime=connectedRuntime(engines,{SOCIALPLUS_ALEX_V16_PIPELINE:'true',ALEX_V16_RECONSTRUCTION_ENABLED:'true',ALEX_V16_REVIEW_DRAFTS:'true'},{alex:async options=>{temp=options.workDir;captured=JSON.parse(await readFile(options.transcriptPath,'utf8'));return {reviewRequired:true}}});
  const words=[{text:'Correction explicite',startMs:0,endMs:100,probability:.2}];
  await runtime.renderVideo({modelId:'alex-hormozi-v16',sourcePath,outputPath:path.join(directory,'output'),restoredInput:{transcript:words,captionsReviewed:false}});
  assert.deepEqual(captured.words,words);assert.equal(captured.reviewed,false);assert.match(captured.sourceSha256,/^[a-f0-9]{64}$/);await assert.rejects(stat(temp),{code:'ENOENT'});
 }finally{await rm(directory,{recursive:true,force:true})}
});
test('explicit Alex admission uses the existing shared worker pipeline, never the legacy overlay',async()=>{
 let call;const runtime=connectedRuntime(engines,{SOCIALPLUS_ALEX_V16_PIPELINE:'true',ALEX_V16_RECONSTRUCTION_ENABLED:'true',ALEX_V16_REVIEW_DRAFTS:'true'},{alex:async options=>{call=options;return {reviewRequired:true,review:{issues:['unconfirmed']},bytes:10}}});
 const result=await runtime.renderVideo({modelId:'alex-hormozi-v16',sourcePath:'/private/new.mov',outputPath:'/private/new.mp4'});
 assert.equal(call.sourcePath,'/private/new.mov');assert.equal(call.reviewDraft,true);assert.equal(result.engine,'alex-v16-shared-worker');assert.equal(result.reviewRequired,true);assert.equal(result.referenceUsed,false);
 await assert.rejects(stat(call.workDir),{code:'ENOENT'});
});
