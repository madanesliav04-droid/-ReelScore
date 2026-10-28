import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {createApp} from './index.mjs';
test('health is liveness, readiness refuses an unprovisioned/insecure runtime without exposing configuration secrets',async()=>{
 const dataDir=await mkdtemp(join(tmpdir(),'socialplus-ready-'));const app=await createApp({dataDir});
 await new Promise(r=>app.server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+app.server.address().port;
 try{
  assert.equal((await fetch(origin+'/healthz')).status,200);
  const response=await fetch(origin+'/readyz');assert.equal(response.status,503);const result=await response.json();
  assert.equal(result.ready,false);assert.equal(result.checks.sqlite,true);assert.equal(result.checks.ownerProvisioned,false);assert.equal(result.checks.httpsConfigured,false);assert.equal(result.checks.kineticReleaseIntact,true);
  assert.ok(!JSON.stringify(result).includes(dataDir));assert.equal((await fetch(origin+'/api/projects')).status,401);
 }finally{await app.projects.shutdown();await new Promise(r=>app.server.close(r));app.releaseRuntime();app.db.close();await rm(dataDir,{recursive:true,force:true})}
});
