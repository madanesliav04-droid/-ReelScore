import {test} from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {spawn} from 'node:child_process';
import {once} from 'node:events';

test('real worker stays unready on queue quota error, backs off, then recovers without leaking error bodies',async()=>{
 let broken=true,calls=0;const hit=[];
 const backend=http.createServer((req,res)=>{
  calls++;hit.push(Date.now());res.setHeader('content-type','application/json');
  res.statusCode=broken?402:200;
  res.end(broken?JSON.stringify({code:'PAYMENT_REQUIRED',message:'secret-sentinel-do-not-log'}):'[]');
 });
 backend.listen(0,'127.0.0.1');await once(backend,'listening');
 const reserve=http.createServer();reserve.listen(0,'127.0.0.1');await once(reserve,'listening');
 const port=reserve.address().port;await new Promise(r=>reserve.close(r));
 const child=spawn(process.execPath,['src/index.js'],{cwd:new URL('..',import.meta.url),env:{...process.env,PORT:String(port),POLL_MS:'1000',SUPABASE_URL:`http://127.0.0.1:${backend.address().port}`,SUPABASE_SERVICE_ROLE_KEY:'unit-private-key',GEMINI_API_KEY:'unit-no-external-network',SOCIALPLUS_ALEX_ONLY:'false'},stdio:['ignore','pipe','pipe']});
 let logs='';child.stdout.on('data',b=>logs+=b);child.stderr.on('data',b=>logs+=b);
 const until=async(predicate)=>{const end=Date.now()+10000;while(Date.now()<end){if(await predicate())return;await new Promise(r=>setTimeout(r,80))}throw Error('worker check timed out')};
 const health=()=>fetch(`http://127.0.0.1:${port}/health`).then(r=>r.json()).catch(()=>null);
 try{
  await until(async()=>Boolean((await health())?.queue_failures));
  assert.equal((await fetch(`http://127.0.0.1:${port}/ready`)).status,503);
  const state=await health();assert.equal(state.queue_connected,false);assert.equal(state.last_error_code,'PAYMENT_REQUIRED');
  await until(()=>calls>=2);assert.ok(hit[1]-hit[0]>=1800,'queue retries must back off');
  assert.ok(!logs.includes('secret-sentinel-do-not-log'));assert.ok(!logs.includes('unit-private-key'));
  broken=false;
  await until(async()=>Boolean((await health())?.queue_connected));
  assert.equal((await fetch(`http://127.0.0.1:${port}/ready`)).status,200);
  assert.equal((await health()).queue_failures,0);
 }finally{child.kill('SIGKILL');await once(child,'exit');backend.closeAllConnections();await new Promise(r=>backend.close(r));}
});
