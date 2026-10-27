// Local integration harness, NOT a deployed Social+/Supabase API or iPhone test.
// Real bytes, offline transcription, shared worker renderer, Range/download.
import http from 'node:http';
import path from 'node:path';
import {Readable} from 'node:stream';
import {createReadStream} from 'node:fs';
import {stat,mkdir,writeFile,readFile} from 'node:fs/promises';
import {randomBytes,createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {receiveObject,verifySource} from '../src/media-integrity.js';
import {renderAlexV16} from '../src/alex-v16-pipeline.js';
import {editContract} from '../src/model-contract.js';

const [rush,directory]=process.argv.slice(2);
if(!rush||!directory)throw Error('Usage: node scripts/alex-v16-upload-test.mjs RAW_MOV PRIVATE_DIRECTORY');
const dir=path.resolve(directory);await mkdir(dir,{recursive:true,mode:0o700});
const sourcePath=path.join(dir,'imported.mov'),outputPath=path.join(dir,'Alex_V16_rush_brut_a_verifier.mp4');
const token=randomBytes(32).toString('hex');const size=(await stat(rush)).size;
const sha=b=>createHash('sha256').update(b).digest('hex');
let job={status:'idle',pct:0},task,result;const progress=[];
const server=http.createServer(async(req,res)=>{
 try{
  if(req.headers.authorization!=='Bearer '+token){req.resume();res.writeHead(401);return res.end('AUTH_REQUIRED');}
  if(req.method==='POST'&&req.url==='/import?model=hormozi_omni'){
   if(job.status!=='idle'){res.writeHead(409);return res.end();}
   assert.equal(editContract('hormozi_omni',{alexReconstruction:true}).ok,true);
   await receiveObject(new Response(Readable.toWeb(req),{headers:{'content-length':String(req.headers['content-length'])}}),sourcePath,{expectedBytes:size});
   await verifySource(sourcePath,{sizeBytes:size});job={status:'queued',pct:0};
   task=renderAlexV16({sourcePath,workDir:dir,outputPath,reviewDraft:true,onProgress:async(status,pct,stage)=>{job={status,pct,stage};progress.push({status,pct});}})
    .then(r=>{result=r;job={status:'completed',pct:100,review_required:r.reviewRequired};})
    .catch(e=>{job={status:'failed',pct:job.pct,error:e.code||e.message};});
   res.writeHead(202,{'content-type':'application/json'});return res.end(JSON.stringify({job_id:'private-local-test'}));
  }
  if(req.method==='GET'&&req.url==='/job'){res.writeHead(200,{'content-type':'application/json'});return res.end(JSON.stringify(job));}
  if(req.method==='GET'&&['/preview','/download'].includes(req.url)){
   if(job.status!=='completed'){res.writeHead(409);return res.end('EXPORT_NOT_AVAILABLE');}
   const bytes=(await stat(outputPath)).size;
   let start=0,end=bytes-1,code=200;
   if(req.headers.range){const m=req.headers.range.match(/^bytes=(\d+)-(\d*)$/);if(!m){res.writeHead(416);return res.end();}start=Number(m[1]);end=m[2]?Math.min(bytes-1,Number(m[2])):bytes-1;if(start>end||start>=bytes){res.writeHead(416);return res.end();}code=206;}
   res.writeHead(code,{'content-type':'video/mp4','cache-control':'private, no-store','accept-ranges':'bytes','content-length':end-start+1,'content-disposition':req.url==='/download'?'attachment; filename="Alex-V16-review.mp4"':'inline',...(code===206?{'content-range':`bytes ${start}-${end}/${bytes}`}:{})});
   return createReadStream(outputPath,{start,end}).pipe(res);
  }
  res.writeHead(404);res.end();
 }catch(e){res.writeHead(500);res.end(e.code||'TEST_FAILURE');}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base='http://127.0.0.1:'+server.address().port,headers={authorization:'Bearer '+token};
try{
 assert.equal((await fetch(base+'/job')).status,401);
 assert.equal((await fetch(base+'/preview',{headers})).status,409);
 const uploaded=await fetch(base+'/import?model=hormozi_omni',{method:'POST',headers:{...headers,'content-length':String(size)},body:createReadStream(rush),duplex:'half'});assert.equal(uploaded.status,202);
 await task;assert.equal(job.status,'completed',JSON.stringify(job));
 const range=await fetch(base+'/preview',{headers:{...headers,range:'bytes=0-1023'}});assert.equal(range.status,206);assert.equal((await range.arrayBuffer()).byteLength,1024);
 const download=await fetch(base+'/download',{headers});assert.equal(download.status,200);assert.match(download.headers.get('content-disposition'),/attachment/);
 const bytes=Buffer.from(await download.arrayBuffer());assert.equal(sha(bytes),result.outputSha256);
 assert.equal(sha(await readFile(rush)),sha(await readFile(sourcePath)));
 assert.ok(progress.every((p,i)=>!i||p.pct>=progress[i-1].pct));
 const report={scope:'Real localhost upload/shared-worker/offline-ASR/export test, not hosted UI/Supabase/physical Safari',authenticated:true,unauthorizedStatus:401,preCompletionPreviewStatus:409,uploadStatus:202,model:'hormozi_omni',sourceSha256:result.sourceSha256,outputSha256:result.outputSha256,bytes:bytes.length,previewRangeStatus:range.status,downloadStatus:download.status,downloadHashMatched:true,progressMonotonic:true,transcriptSource:'fresh-offline-ASR-no-transcript-input',masterUsed:false,reviewRequired:result.reviewRequired,issues:result.review.issues.length};
 await writeFile(path.join(dir,'upload-e2e.json'),JSON.stringify(report,null,2),{mode:0o600});console.log(JSON.stringify(report,null,2));
}finally{await new Promise(resolve=>server.close(resolve));}
