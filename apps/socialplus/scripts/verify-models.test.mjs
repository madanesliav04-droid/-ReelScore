import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {verifyModels,fileHash} from './verify-models.mjs';
import {RESTORED_PREVIEWS} from '../server/restored-models.mjs';

async function fixture(fn){
 const dir=await mkdtemp(join(tmpdir(),'socialplus-qa-cache-'));
 try{
  const sourcePath=join(dir,'source.mock');await writeFile(sourcePath,'test data, not a speech rush');
  const plan={sourceSha256:await fileHash(sourcePath),speechReviewed:true,captionsReviewed:true,transcript:[{text:'temps',start:.5,end:.8}],models:Object.fromEntries(RESTORED_PREVIEWS.map(id=>[id,{placementReviewed:true,events:[{wordIndex:0,kind:id==='social-kinetic-v28'?'bubble':'clock',rect:id==='alex-hormozi-v16'?[.15,.05,.7,.2]:[.1,.1,.4,.4]}]}]))};
  let calls=0,engine='engine-1';
  const dependencies={engineHash:async()=>engine,probeVideo:async()=>({width:640,height:360,durationMs:3000,hasAudio:true}),renderVideo:async({outputPath,modelId})=>{calls++;await writeFile(outputPath,modelId);return {metadata:{},audit:{release:'beta_not_master_certified'}};}};
  const run=(options={})=>verifyModels({sourcePath,plan,outputDir:join(dir,'qa'),dependencies,...options});
  await fn({dir,plan,dependencies,run,calls:()=>calls,setEngine:value=>{engine=value;}});
 }finally{await rm(dir,{recursive:true,force:true});}
}

test('six-model QA reuses only intact output for the same source, reviewed plan and engine',async()=>fixture(async f=>{
 const first=await f.run();assert.equal(f.calls(),6);assert.equal(first.providerCalls,0);assert.equal(first.releaseApproved,false);
 const second=await f.run();assert.equal(f.calls(),6);assert.ok(second.results.every(row=>row.cached));
 await writeFile(join(f.dir,'qa',first.results[0].outputFile),'corrupted');await f.run();assert.equal(f.calls(),7);
 f.plan.models['codie-omni-v60'].events[0].endMs=2000;await f.run();assert.equal(f.calls(),8);
 f.setEngine('engine-2');await f.run();assert.equal(f.calls(),14);
}));

test('QA can force a fresh run after a toolchain/font update; renderer browser configuration invalidates cache',async()=>fixture(async f=>{
 const previous=process.env.SOCIALPLUS_CHROMIUM;
 try{
  await f.run();await f.run({reuseCache:false});assert.equal(f.calls(),12);
  process.env.SOCIALPLUS_CHROMIUM='local-test-browser-path';
  assert.ok((await f.run()).results.every(row=>row.cached===false));assert.equal(f.calls(),18);
 }finally{if(previous===undefined)delete process.env.SOCIALPLUS_CHROMIUM;else process.env.SOCIALPLUS_CHROMIUM=previous;}
}));

test('unreviewed speech and source mismatch block all renders, even with an existing cache',async()=>fixture(async f=>{
 await f.run();f.plan.speechReviewed=false;
 assert.ok((await f.run()).results.every(row=>row.status==='blocked'));assert.equal(f.calls(),6);
 f.plan.speechReviewed=true;f.plan.sourceSha256='wrong';
 assert.ok((await f.run()).results.every(row=>row.status==='blocked'));assert.equal(f.calls(),6);
}));

test('a missing style plan or failed renderer does not prevent the other styles being checked',async()=>fixture(async f=>{
 delete f.plan.models['codie-omni-v60'];
 const render=f.dependencies.renderVideo;
 f.dependencies.renderVideo=async args=>{if(args.modelId==='alex-hormozi-v16')throw Object.assign(new Error('Unavailable renderer'),{code:'TOOL_UNAVAILABLE'});return render(args);};
 const report=await f.run();assert.equal(report.results.length,6);
 assert.equal(report.results.find(row=>row.modelId==='codie-omni-v60').status,'blocked');assert.equal(report.results.find(row=>row.modelId==='alex-hormozi-v16').status,'failed');
 assert.equal(report.results.filter(row=>row.status==='passed_technical_checks').length,4);
 assert.equal(JSON.parse(await readFile(join(f.dir,'qa','report.json'),'utf8')).results.length,6);
 assert.equal(f.calls(),4);
}));
