import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { mkdtemp, rm, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { createProjects } from './projects.mjs';

async function fixture(t,renderOverrides={}) {
  const dataDir=await mkdtemp(join(tmpdir(),'socialplus-project-test-')),db=new DatabaseSync(':memory:');
  t.after(async()=>{db.close();await rm(dataDir,{recursive:true,force:true});});
  const render={MODEL_CATALOG:[{id:'absent',available:false,reason:'Source manquante.'}],probeVideo:async()=>({width:1920,height:1080,durationMs:1000}),...renderOverrides};
  return {projects:createProjects({db,dataDir,render,maxUploadBytes:100}),db,dataDir};
}
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
  const req=Readable.from([Buffer.from('video-fixture')]);req.headers={'content-type':'video/mp4','x-filename':encodeURIComponent('test été.mp4')};
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
