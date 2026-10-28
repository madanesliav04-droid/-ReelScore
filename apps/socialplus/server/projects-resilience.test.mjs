import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {mkdtemp,rm,writeFile,mkdir,stat} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {Readable} from 'node:stream';
import {setTimeout as delay} from 'node:timers/promises';
import {createProjects} from './projects.mjs';
async function setup(t,renderVideo){
 const dataDir=await mkdtemp(join(tmpdir(),'socialplus-resilience-')),db=new DatabaseSync(':memory:');
 t.after(async()=>{await delay(20);db.close();await rm(dataDir,{recursive:true,force:true});});
 const projects=createProjects({db,dataDir,render:{MODEL_CATALOG:[],probeVideo:async()=>({width:640,height:360,durationMs:1000,hasAudio:true}),renderVideo}});
 const p=projects.create('alice');const upload=async()=>{const req=Readable.from([Buffer.from('fixture')]);req.headers={'content-type':'video/mp4'};return projects.upload('alice',p.id,req);};await upload();
 const finish=async job=>{for(let i=0;i<200&&['queued','rendering'].includes(projects.job('alice',job.id).state);i++)await delay(5);await delay(5);return projects.job('alice',job.id);};
 return {db,dataDir,projects,p,upload,finish};
}
test('filesystem cleanup failure cannot invalidate a newly committed upload or export',async t=>{
 const f=await setup(t,async({outputPath})=>{await writeFile(outputPath,'non-empty-test-render');return {};});
 const old=join(f.dataDir,'media','locked-old');await mkdir(old);await writeFile(join(old,'held'),'fixture');
 f.db.prepare('UPDATE studio_projects SET source_path=? WHERE id=?').run(old,f.p.id);
 await f.upload();assert.equal(f.projects.get('alice',f.p.id).has_source,true);
 assert.equal(f.db.prepare('SELECT count(*) n FROM studio_media_cleanup').get().n,1);
 f.db.prepare('UPDATE studio_projects SET output_path=? WHERE id=?').run(old,f.p.id);
 const job=await f.finish(f.projects.startRender('alice',f.p.id,{style_id:'technical-export'}));
 assert.equal(job.state,'complete');assert.equal(f.projects.get('alice',f.p.id).has_output,true);
 const path=f.db.prepare('SELECT output_path FROM studio_projects').get().output_path;assert.ok((await stat(path)).size>0);
});
test('empty or missing final files are never presented as completed exports',async t=>{
 const f=await setup(t,async({outputPath})=>{await writeFile(outputPath,'');return {};});
 const failed=await f.finish(f.projects.startRender('alice',f.p.id,{style_id:'technical-export'}));assert.equal(failed.state,'failed');assert.equal(failed.error_code,'OUTPUT_MISSING');assert.equal(f.projects.get('alice',f.p.id).has_output,false);
 const path=join(f.dataDir,'media','valid.mp4');await writeFile(path,'fixture');
 f.db.prepare("UPDATE studio_jobs SET state='complete' WHERE id=?").run(failed.id);f.db.prepare("UPDATE studio_projects SET output_path=?,state='complete' WHERE id=?").run(path,f.p.id);
 await rm(path);assert.equal(f.projects.get('alice',f.p.id).latestJob.state,'failed');assert.equal(f.projects.job('alice',failed.id).state,'failed');
});
test('idempotency reuses the same task and quota while conflicts and other concurrent requests fail closed',async t=>{
 let release;const gate=new Promise(r=>{release=r;});let calls=0;
 const f=await setup(t,async({outputPath})=>{calls++;await gate;await writeFile(outputPath,'test-render');return {};});
 const input={style_id:'technical-export',requestId:'one-request-key-0001'};
 const job=f.projects.startRender('alice',f.p.id,input);
 assert.equal(f.projects.startRender('alice',f.p.id,input).id,job.id);
 assert.throws(()=>f.projects.startRender('alice',f.p.id,{...input,captionCues:[]}),{code:'REQUEST_CONFLICT'});
 assert.throws(()=>f.projects.startRender('alice',f.p.id,{style_id:'technical-export'}),{code:'RENDER_BUSY'});
 release();assert.equal((await f.finish(job)).state,'complete');assert.equal(f.projects.startRender('alice',f.p.id,input).id,job.id);assert.equal(calls,1);
 assert.equal(f.db.prepare('SELECT started_count n FROM studio_render_usage').get().n,1);
 assert.throws(()=>f.projects.job('bob',job.id),{code:'JOB_NOT_FOUND'});
});

test('publication transaction failure keeps the previous usable export and never advertises the new file',async t=>{
 const f=await setup(t,async({outputPath})=>{await writeFile(outputPath,'new-export-fixture');return {};});
 const previous=join(f.dataDir,'media','previous.mp4');await writeFile(previous,'previous-usable-fixture');
 f.db.prepare("UPDATE studio_projects SET output_path=?,output_bytes=23,state='complete' WHERE id=?").run(previous,f.p.id);
 const prepare=f.db.prepare.bind(f.db);
 f.db.prepare=sql=>sql.startsWith("UPDATE studio_jobs SET state='complete'")?{run(){throw Error('Injected database publication failure');}}:prepare(sql);
 const result=await f.finish(f.projects.startRender('alice',f.p.id,{style_id:'technical-export'}));
 assert.equal(result.state,'failed');assert.equal(f.db.prepare('SELECT output_path FROM studio_projects').get().output_path,previous);
 assert.ok((await stat(previous)).size>0);assert.equal(f.projects.get('alice',f.p.id).has_output,true);
});
