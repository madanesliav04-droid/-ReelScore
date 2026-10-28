import test from 'node:test';import assert from 'node:assert/strict';import http from 'node:http';
import {EventEmitter} from 'node:events';import {PassThrough} from 'node:stream';import {mkdtemp,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';import {randomUUID} from 'node:crypto';
import {quickTunnelUrl,cloudflaredArguments,tunnelHandler,waitForTunnel,verifyPublicOrigin,TUNNEL_HOST,MAX_TUNNEL_UPLOAD} from './windows-tunnel.mjs';
import {createApp} from '../server/index.mjs';import {totpCode} from '../server/security.mjs';
test('Quick Tunnel launcher selects account-free HTTP2 and an isolated config, never credentials or a public origin port',()=>{
 assert.equal(quickTunnelUrl('Visit https://test-only-example.trycloudflare.com |'),'https://test-only-example.trycloudflare.com');
 assert.equal(quickTunnelUrl('https://test.trycloudflare.com.attacker.invalid'),null);
 assert.equal(quickTunnelUrl('http://test.trycloudflare.com'),null);
 const args=cloudflaredArguments(4321,'/private/empty.yml');assert.ok(args.includes('http2'));assert.ok(args.includes('http://127.0.0.1:4321'));assert.ok(args.includes('--http-host-header'));assert.ok(!args.includes('--token'));assert.ok(args.includes('--no-autoupdate'));assert.throws(()=>cloudflaredArguments(0,'x'));
});
test('startup parser requires both an assigned HTTPS URL and a registered connection; closes early on failure',async()=>{
 const child=()=>Object.assign(new EventEmitter(),{stdout:new PassThrough(),stderr:new PassThrough()});
 const c=child(),ready=waitForTunnel(c,{timeoutMs:2000});c.stderr.write('https://test-only-');c.stderr.write('example.trycloudflare.com\n');c.stdout.write('Registered tunnel connection\n');assert.equal(await ready,'https://test-only-example.trycloudflare.com');
 const bad=child(),failed=waitForTunnel(bad,{timeoutMs:2000});bad.emit('close',1);await assert.rejects(failed,/avant la connexion/);
});
test('loopback gateway refuses other hosts, waits for initialization and limits declared tunnel uploads',()=>{
 const result=(req,app)=>{let status,body;const res={writeHead:s=>{status=s;},setHeader(){},end:b=>{body=b;}};tunnelHandler(()=>app)({socket:{remoteAddress:'127.0.0.1'},headers:{host:TUNNEL_HOST},method:'GET',url:'/',...req},res);return {status,body};};
 assert.equal(result({socket:{remoteAddress:'192.168.1.9'}}).status,403);
 assert.equal(result({headers:{host:'another-host'}}).status,421);
 assert.equal(result({}).status,503);
 assert.equal(result({method:'POST',url:'/api/projects/test/source',headers:{host:TUNNEL_HOST,'content-length':MAX_TUNNEL_UPLOAD+1}},{}).status,413);
});
test('real app behind tunnel transport retains MFA, Secure cookies, private data and exact-origin CSRF',async t=>{
 const dir=await mkdtemp(join(tmpdir(),'socialplus-tunnel-security-'));const ownerId=randomUUID(),seed='JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP',origin='https://test-only-example.trycloudflare.com';
 const app=await createApp({dataDir:dir,origin,securityConfig:{ownerId,ownerTotpSecret:seed,secureCookies:true}});const server=http.createServer(tunnelHandler(()=>app));await new Promise(r=>server.listen(0,'127.0.0.1',r));
 t.after(async()=>{await app.projects.shutdown();await new Promise(r=>server.close(r));app.releaseRuntime();app.db.close();await rm(dir,{recursive:true,force:true});});
 const base='http://127.0.0.1:'+server.address().port;
 const request=(path,{method='GET',body,cookie,csrf,from=origin}={})=>new Promise((done,reject)=>{const data=body?JSON.stringify(body):null;const req=http.request(base+path,{method,headers:{Host:TUNNEL_HOST,Origin:from,'Content-Type':'application/json',...(data?{'Content-Length':Buffer.byteLength(data)}:{}),...(cookie?{Cookie:cookie}:{}),...(csrf?{'X-CSRF-Token':csrf}:{})}},res=>{const chunks=[];res.on('data',c=>chunks.push(c));res.on('end',()=>done({status:res.statusCode,headers:{get:key=>{const value=res.headers[key.toLowerCase()];return Array.isArray(value)?value.join(','):value;}},json:async()=>JSON.parse(Buffer.concat(chunks).toString())}));});req.on('error',reject);req.end(data);});
 await app.security.provisionOwner({id:ownerId,email:'tunnel@example.test',password:'Local-test-only-123!'});
 assert.equal((await request('/api/projects')).status,401);assert.equal((await request('/.env.local')).status,404);
 assert.equal((await request('/api/auth/login',{method:'POST',body:{email:'tunnel@example.test',password:'Local-test-only-123!'}})).status,401);
 const login=await request('/api/auth/login',{method:'POST',body:{email:'tunnel@example.test',password:'Local-test-only-123!',totp:totpCode(seed)}});assert.equal(login.status,200);const set=login.headers.get('set-cookie');assert.match(set,/Secure/);assert.match(set,/HttpOnly/);assert.match(set,/SameSite=Strict/);const cookie=set.split(';')[0],csrf=(await login.json()).csrf;
 assert.equal((await request('/api/projects',{method:'POST',cookie,csrf,from:'https://old.trycloudflare.com',body:{name:'Wrong origin'}})).status,403);
 assert.equal((await request('/api/projects',{method:'POST',cookie,body:{name:'Missing CSRF'}})).status,403);
 const created=await request('/api/projects',{method:'POST',cookie,csrf,body:{name:'Tunnel security fixture'}});assert.equal(created.status,201);const id=(await created.json()).project.id;
 assert.equal((await request('/api/projects/'+id)).status,401);assert.equal((await request('/api/projects/'+id,{cookie})).status,200);
});

test('external readiness waits for DNS but refuses an anonymous-success backend immediately',async()=>{
 let calls=0;const result=await verifyPublicOrigin('https://test-only-example.trycloudflare.com',{pause:async()=>{},fetchImpl:async url=>{calls++;if(calls===1)throw Error('DNS not ready');return url.endsWith('/healthz')?{ok:true,json:async()=>({app:'Social+'})}:{status:401};}});assert.deepEqual(result,{health:200,anonymousProjects:401});
 await assert.rejects(verifyPublicOrigin('https://test-only-example.trycloudflare.com',{pause:async()=>{},fetchImpl:async url=>url.endsWith('/healthz')?{ok:true,json:async()=>({app:'Social+'})}:{status:200}}),/Accès anonyme/);
});
