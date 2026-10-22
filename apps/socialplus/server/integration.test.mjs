import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable, Writable } from 'node:stream';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { createApp } from './index.mjs';
import { totpCode } from './security.mjs';

// Exercises the complete HTTP request handler without requiring a listening socket.
async function request(app,path,{method='GET',body,cookie,csrf}={}) {
  const req=Readable.from(body===undefined?[]:[Buffer.from(JSON.stringify(body))]);
  req.url=path;req.method=method;req.socket={remoteAddress:'127.0.0.1'};
  req.headers={origin:'http://localhost:4318','content-type':'application/json',...(cookie?{cookie}:{}),...(csrf?{'x-csrf-token':csrf}:{})};
  const headers={},chunks=[];
  const res=new Writable({write(chunk,encoding,cb){chunks.push(Buffer.from(chunk));cb();}});
  res.setHeader=(key,value)=>{headers[key.toLowerCase()]=value;};
  res.writeHead=(status,values={})=>{res.statusCode=status;Object.entries(values).forEach(([key,value])=>res.setHeader(key,value));res.headersSent=true;};
  const complete=new Promise((resolve,reject)=>{res.on('finish',resolve);res.on('error',reject);});
  await app.server.listeners('request')[0](req,res);await complete;
  const text=Buffer.concat(chunks).toString();
  return {status:res.statusCode,headers,body:text?JSON.parse(text):null};
}
test('integrated HTTP: public legal, owner MFA, private projects, method admin and immediate member revocation',async t=>{
  const dir=await mkdtemp(join(tmpdir(),'socialplus-http-'));
  const ownerId=randomUUID(),seed='GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ'; // Public RFC test seed; never a real credential.
  const app=await createApp({dataDir:dir,securityConfig:{ownerId,ownerTotpSecret:seed}});
  t.after(async()=>{app.db.close();await rm(dir,{recursive:true,force:true});});
  await app.security.provisionOwner({id:ownerId,email:'owner@example.test',password:'Owner-test-only-123!'});
  const legal=await request(app,'/api/privacy/privacy');assert.equal(legal.status,200);assert.equal(legal.body.status,'draft');
  assert.equal((await request(app,'/api/projects')).status,401);
  assert.equal((await request(app,'/admin')).status,401);
  assert.equal((await request(app,'/api/auth/login',{method:'POST',body:{email:'owner@example.test',password:'Owner-test-only-123!'}})).status,401);
  const login=await request(app,'/api/auth/login',{method:'POST',body:{email:'owner@example.test',password:'Owner-test-only-123!',totp:totpCode(seed)}});
  assert.equal(login.status,200);
  const cookie=login.headers['set-cookie'].split(';')[0],csrf=login.body.csrf;
  assert.match(login.headers['set-cookie'],/HttpOnly/);
  const styles=await request(app,'/api/studio/styles',{cookie});assert.equal(styles.body.styles.length,6);
  const project=await request(app,'/api/projects',{method:'POST',cookie,csrf,body:{name:'HTTP integration fixture'}});assert.equal(project.status,201);
  const id=project.body.project.id;
  assert.equal((await request(app,'/api/projects',{method:'POST',cookie,body:{name:'Missing CSRF'}})).status,403);
  const methods=await request(app,'/api/admin/method-versions',{cookie});assert.equal(methods.status,200);assert.equal(methods.body.methods.length,12);
  const usage=await request(app,'/api/admin/usage',{cookie});assert.equal(usage.status,200);assert.equal(usage.body.projects,1);
  const exported=await request(app,'/api/privacy/export',{cookie});assert.equal(exported.status,200);assert.equal(exported.body.projects[0].id,id);assert.deepEqual(exported.body.render_jobs,[]);assert.deepEqual(exported.body.media_downloads,[]);
  const invite=await request(app,'/api/admin/invites',{method:'POST',cookie,csrf,body:{email:'member@example.test',emailVerifiedByOwner:true,durationDays:7}});assert.equal(invite.status,201);
  const activation=await request(app,'/api/auth/activate',{method:'POST',body:{email:'member@example.test',password:'Member-test-only-123!',displayName:'Integration member',code:invite.body.code,acceptTerms:true,role:'owner'}});
  assert.equal(activation.status,201);assert.equal(activation.body.user.role,'member');
  const memberCookie=activation.headers['set-cookie'].split(';')[0];
  assert.equal((await request(app,'/api/projects/'+id,{cookie:memberCookie})).status,404);
  assert.equal((await request(app,'/api/admin/method-versions',{cookie:memberCookie})).status,403);
  assert.equal((await request(app,'/admin',{cookie:memberCookie})).status,403);
  await request(app,'/api/admin/members/'+activation.body.user.id+'/revoke',{method:'POST',cookie,csrf,body:{}});
  assert.equal((await request(app,'/api/projects',{cookie:memberCookie})).status,401);
});
