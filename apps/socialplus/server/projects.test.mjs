import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { mkdtemp, rm, readdir, writeFile } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { createProjects } from './projects.mjs';

async function fixture(t,renderOverrides={},limits={}) {
  const dataDir=await mkdtemp(join(tmpdir(),'socialplus-project-test-')),db=new DatabaseSync(':memory:');
  t.after(async()=>{db.close();await rm(dataDir,{recursive:true,force:true});});
  const render={MODEL_CATALOG:[{id:'absent',available:false,reason:'Source manquante.'}],probeVideo:async()=>({width:1920,height:1080,durationMs:1000}),...renderOverrides};
  return {projects:createProjects({db,dataDir,render,maxUploadBytes:100,...limits}),db,dataDir};
}
test('projects: measured reports are cached per source, isolated, invalidated on replacement and deleted with member data',async t=>{
  let calls=0;
  const report={engineVersion:'local-acoustic-v1',fingerprint:'fixture',metadata:{durationMs:4000,width:640,height:360,hasAudio:true},suggestions:[{id:'pause-0',startMs:1000,endMs:2000}]};
  const {projects,db}=await fixture(t,{analyzeSource:async()=>{calls++;return report;},renderVideo:async({outputPath,localEdit})=>{assert.equal(localEdit.report.fingerprint,'fixture');await writeFile(outputPath,'fixture');return {};}});
  const p=projects.create('alice');
  const upload=async()=>{const req=Readable.from([Buffer.from('video')]);req.headers={'content-type':'video/mp4'};await projects.upload('alice',p.id,req);};
  await upload();assert.equal(projects.signalReport('alice',p.id),null);
  assert.throws(()=>projects.startRender('alice',p.id,{style_id:'guided-edit'}),{code:'SOURCE_ANALYSIS_REQUIRED'});
  assert.deepEqual(await projects.analyze('alice',p.id),report);
  await projects.analyze('alice',p.id);assert.equal(calls,1);
  await assert.rejects(projects.analyze('bob',p.id),{code:'PROJECT_NOT_FOUND'});
  assert.throws(()=>projects.signalReport('bob',p.id),{code:'PROJECT_NOT_FOUND'});
  assert.throws(()=>projects.startRender('alice',p.id,{style_id:'guided-edit',approvedPauseIds:['fake']}),{code:'INVALID_EDIT'});
  assert.equal(db.prepare('SELECT started_count n FROM studio_render_usage').get().n,1);
  const job=projects.startRender('alice',p.id,{style_id:'guided-edit',approvedPauseIds:['pause-0']});
  for(let i=0;i<100&&projects.job('alice',job.id).state==='rendering';i++)await delay(10);
  assert.equal(projects.job('alice',job.id).state,'complete');
  assert.equal(projects.exportData('alice').source_analyses.length,1);
  await upload();assert.equal(projects.signalReport('alice',p.id),null);
  await projects.analyze('alice',p.id);assert.equal(calls,2);
  await projects.deleteUserData('alice');assert.equal(db.prepare('SELECT count(*) n FROM studio_signal_reports').get().n,0);
});
test('projects: tenant boundary covers get update delete upload and job lookup',async t=>{
  const {projects}=await fixture(t),p=projects.create('alice',{name:'Privé'});
  assert.equal(projects.list('bob').length,0);
  assert.throws(()=>projects.get('bob',p.id),{code:'PROJECT_NOT_FOUND'});
  assert.throws(()=>projects.update('bob',p.id,{name:'Volé'}),{code:'PROJECT_NOT_FOUND'});
  await assert.rejects(projects.remove('bob',p.id),{code:'PROJECT_NOT_FOUND'});
  assert.equal(projects.get('alice',p.id).name,'Privé');
  assert.throws(()=>projects.job('bob','id'),{code:'JOB_NOT_FOUND'});
});
test('projects: metadata persists; unavailable model cannot produce fake job',async t=>{
  const {projects}=await fixture(t),p=projects.create('alice');
  const req=Readable.from([Buffer.from('video-fixture')]);req.headers={'content-type':'application/octet-stream','x-filename':encodeURIComponent('test été.mp4')};
  const uploaded=await projects.upload('alice',p.id,req);
  assert.equal(uploaded.source_name,'test été.mp4');assert.equal(uploaded.has_source,true);
  assert.equal(projects.list('alice')[0].metadata.width,1920);
  assert.throws(()=>projects.startRender('alice',p.id,{style_id:'absent'}),{code:'MODEL_UNAVAILABLE'});
  assert.equal(projects.get('alice',p.id).has_output,false);
});
test('projects: invalid probe and interrupted uploads leave no partial file',async t=>{
  const {projects,dataDir}=await fixture(t,{probeVideo:async()=>{throw Object.assign(new Error('Invalid media'),{code:'INVALID_VIDEO'});}}),p=projects.create('alice');
  const req=Readable.from([Buffer.from('not-a-video')]);req.headers={'content-type':'video/mp4'};
  await assert.rejects(projects.upload('alice',p.id,req),{code:'INVALID_VIDEO'});
  assert.deepEqual(await readdir(join(dataDir,'media')),[]);
  assert.equal(projects.get('alice',p.id).has_source,false);
});
test('projects: byte limit is enforced even without Content-Length',async t=>{
  const {projects,dataDir}=await fixture(t),p=projects.create('alice');
  const req=Readable.from([Buffer.alloc(101)]);req.headers={'content-type':'video/mp4'};
  await assert.rejects(projects.upload('alice',p.id,req),{code:'UPLOAD_QUOTA'});
  assert.deepEqual(await readdir(join(dataDir,'media')),[]);
});
test('projects: daily compute quota survives project deletion and remains scoped to its member',async t=>{
  const {projects}=await fixture(t,{renderVideo:async({outputPath})=>{await writeFile(outputPath,'technical-fixture');return {};}},{maxRendersPerDay:1});
  const upload=async user=>{const p=projects.create(user);const req=Readable.from([Buffer.from('video-fixture')]);req.headers={'content-type':'video/mp4'};await projects.upload(user,p.id,req);return p;};
  const finish=async(user,job)=>{for(let i=0;i<500&&projects.job(user,job.id).state==='rendering';i++)await delay(10);assert.equal(projects.job(user,job.id).state,'complete');};
  const first=await upload('alice');await finish('alice',projects.startRender('alice',first.id,{style_id:'technical-export'}));await projects.remove('alice',first.id);
  const second=await upload('alice');assert.throws(()=>projects.startRender('alice',second.id,{style_id:'technical-export'}),{code:'DAILY_RENDER_QUOTA'});
  const other=await upload('bob');await finish('bob',projects.startRender('bob',other.id,{style_id:'technical-export'}));
  assert.equal(projects.exportData('alice').render_usage[0].started_count,1);
});
test('projects: deletion during asynchronous render metadata check leaves no orphaned private export',async t=>{
  const {projects,db,dataDir}=await fixture(t,{renderVideo:async({outputPath})=>{await writeFile(outputPath,'technical-render-fixture');return {};}}),p=projects.create('alice');
  const req=Readable.from([Buffer.from('video-fixture')]);req.headers={'content-type':'video/mp4'};await projects.upload('alice',p.id,req);
  const prepare=db.prepare.bind(db);let deletion;
  db.prepare=sql=>{
    const statement=prepare(sql);
    if(sql==='SELECT id FROM studio_projects WHERE id=? AND user_id=?')return {get(...args){const row=statement.get(...args);if(row)queueMicrotask(()=>{deletion=projects.deleteUserData('alice');});return row;}};
    return statement;
  };
  projects.startRender('alice',p.id,{style_id:'technical-export'});
  for(let i=0;i<100&&!deletion;i++)await delay(10);assert(deletion,'Deletion must run at the stat() yield point.');await deletion;
  let files=await readdir(join(dataDir,'media'));for(let i=0;i<100&&files.length;i++){await delay(10);files=await readdir(join(dataDir,'media'));}
  assert.deepEqual(files,[]);assert.equal(projects.list('alice').length,0);
});

test('projects: offline transcripts cache by model and source, isolate tenants and follow privacy deletion',async t=>{
 let calls=0,key='model-v1';
 const result={words:[{text:'test',startMs:100,endMs:300}],reviewed:false,warnings:[]};
 const {projects,db}=await fixture(t,{transcriptionKey:()=>key,transcribeSource:async()=>{calls++;return result;}});
 const p=projects.create('alice');
 const upload=async()=>{const req=Readable.from([Buffer.from('video')]);req.headers={'content-type':'video/mp4'};await projects.upload('alice',p.id,req);};
 await upload();assert.equal(projects.transcript('alice',p.id),null);
 assert.deepEqual(await projects.transcribe('alice',p.id),result);
 await projects.transcribe('alice',p.id);assert.equal(calls,1);
 assert.throws(()=>projects.transcript('bob',p.id),{code:'PROJECT_NOT_FOUND'});
 await assert.rejects(projects.transcribe('bob',p.id),{code:'PROJECT_NOT_FOUND'});
 key='model-v2';await projects.transcribe('alice',p.id);assert.equal(calls,2);
 assert.equal(projects.exportData('alice').transcripts.length,1);
 await upload();assert.equal(projects.transcript('alice',p.id),null);
 await projects.transcribe('alice',p.id);assert.equal(calls,3);
 await projects.deleteUserData('alice');assert.equal(db.prepare('SELECT count(*) n FROM studio_transcripts').get().n,0);
});
test('projects: missing offline model does not consume quota and deleted project leaves no ASR result',async t=>{
 let key=null,finish;
 const {projects,db}=await fixture(t,{transcriptionKey:()=>key,transcribeSource:()=>new Promise(resolve=>{finish=resolve;})});
 const p=projects.create('alice'),req=Readable.from([Buffer.from('video')]);req.headers={'content-type':'video/mp4'};await projects.upload('alice',p.id,req);
 await assert.rejects(projects.transcribe('alice',p.id),{code:'ASR_NOT_CONFIGURED'});
 assert.equal(db.prepare('SELECT count(*) n FROM studio_render_usage').get().n,0);
 key='local-model';const pending=projects.transcribe('alice',p.id);
 await assert.rejects(projects.transcribe('alice',p.id),{code:'RENDER_BUSY'});
 await projects.deleteUserData('alice');finish({words:[],reviewed:false});
 await assert.rejects(pending,{code:'PROJECT_REMOVED'});
 assert.equal(db.prepare('SELECT count(*) n FROM studio_transcripts').get().n,0);
});

test('projects: Cinematic web route uses autonomous source planner and exposes review without certifying words',async t=>{
 const metadata={width:640,height:360,durationMs:2000,hasAudio:true};
 const report={metadata,fingerprint:'new-source',suggestions:[]};
 let received;
 const {projects}=await fixture(t,{probeVideo:async()=>metadata,analyzeSource:async()=>report,renderVideo:async args=>{received=args;await writeFile(args.outputPath,'test-only-render');return {audit:{testDouble:true}};}});
 const p=projects.create('alice');const req=Readable.from([Buffer.from('video')]);req.headers={'content-type':'video/mp4'};await projects.upload('alice',p.id,req);
 const input={style_id:'cinematic-storytelling-v7',placementReviewed:true,allowUnreviewedPreview:true,transcript:[{text:'Bonjour.',startMs:100,endMs:650,probability:.6}]};
 assert.throws(()=>projects.startRender('alice',p.id,input),{code:'SOURCE_ANALYSIS_REQUIRED'});
 await projects.analyze('alice',p.id);
 const job=projects.startRender('alice',p.id,input);
 for(let i=0;i<100&&projects.job('alice',job.id).state==='rendering';i++)await delay(10);
 assert.equal(projects.job('alice',job.id).state,'complete');
 assert.equal(received.restoredInput.sourceSha256,'new-source');
 assert.equal(received.restoredInput.engineVersion,'cinematic-v7-autonomous-1');
 assert.equal(projects.job('alice',job.id).audit.review.length,1);
 assert.equal(projects.job('alice',job.id).audit.releaseApproved,false);
 assert.equal(projects.get('alice',p.id).latestJob.id,job.id);
 assert.equal(projects.list('bob').length,0);
});
