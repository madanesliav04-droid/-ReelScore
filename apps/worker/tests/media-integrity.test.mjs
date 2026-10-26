import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm,writeFile,stat} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {receiveObject,verifySource} from '../src/media-integrity.js';
import {editContract} from '../src/model-contract.js';
const withFile=async fn=>{const d=await mkdtemp(join(tmpdir(),'transfer-integrity-'));try{await fn(join(d,'source'));}finally{await rm(d,{recursive:true,force:true});}};
test('transport aliases reach actual legacy worker styles, artistic IDs never fallback',()=>{
 assert.equal(editContract('clean').workerStyle,'creator_clean');
 assert.equal(editContract('impact').workerStyle,'business_viral');
 for(const style of ['alex_hormozi','hormozi_omni'])assert.equal(editContract(style).code,'ALEX_V16_SOURCE_REQUIRED');
 for(const style of ['social_kinetic','apple_spatial','unknown'])assert.equal(editContract(style).ok,false);
});
test('complete transfer verifies byte count and SHA-256',()=>withFile(async file=>{
 const body=Buffer.from('real transferred bytes');
 await receiveObject(new Response(body),file,{expectedBytes:body.length});
 await verifySource(file,{sizeBytes:body.length,sha256:createHash('sha256').update(body).digest('hex')});
 assert.deepEqual(await readFile(file),body);
}));
test('chunked transfer cannot exceed the registered size and leaves no partial source',()=>withFile(async file=>{
 const stream=new ReadableStream({start(c){c.enqueue(new Uint8Array([1,2,3]));c.enqueue(new Uint8Array([4,5,6]));c.close();}});
 await assert.rejects(receiveObject(new Response(stream),file,{expectedBytes:4}),{code:'SOURCE_TOO_LARGE'});
 await assert.rejects(stat(file),{code:'ENOENT'});
}));
test('truncation and corrupt same-size sources are detected',()=>withFile(async file=>{
 await assert.rejects(receiveObject(new Response('short'),file,{expectedBytes:20}),{code:'SOURCE_SIZE_MISMATCH'});
 await writeFile(file,'same');
 await assert.rejects(verifySource(file,{sizeBytes:4,sha256:'0'.repeat(64)}),{code:'SOURCE_HASH_MISMATCH'});
}));
test('multipart source is assembled from exact parts',()=>withFile(async file=>{
 await receiveObject(new Response('first'),file,{expectedBytes:5});
 await receiveObject(new Response('second'),file,{expectedBytes:6,append:true});
 assert.equal((await verifySource(file,{sizeBytes:11})).bytes,11);
 assert.equal(await readFile(file,'utf8'),'firstsecond');
}));
import {displayFrame} from '../src/display-frame.js';
test('iPhone display rotation determines native output orientation',()=>{
 assert.deepEqual(displayFrame({width:1920,height:1080,side_data_list:[{rotation:90}]}),{width:1080,height:1920,rawWidth:1920,rawHeight:1080,rotation:90});
 assert.equal(displayFrame({width:1920,height:1080,tags:{rotate:'-90'}}).rotation,270);
 assert.equal(displayFrame({width:1920,height:1080}).width,1920);
 assert.throws(()=>displayFrame({width:1920,height:1080,tags:{rotate:'45'}}),{code:'VIDEO_ROTATION_UNSUPPORTED'});
});
test('Edge and worker style contracts cannot drift',async()=>{
 const {existsSync}=await import('node:fs');
 const edge=new URL('../../../supabase/functions/viral-edit-jobs/model-contract.js',import.meta.url);
 if(existsSync(edge))assert.equal(await readFile(edge,'utf8'),await readFile(new URL('../src/model-contract.js',import.meta.url),'utf8'));
});
test('oversized advertised content is cancelled before writing',()=>withFile(async file=>{
 let cancelled=false;
 const stream=new ReadableStream({cancel(){cancelled=true;}});
 await assert.rejects(receiveObject(new Response(stream,{headers:{'content-length':'500'}}),file,{expectedBytes:100}),{code:'SOURCE_TOO_LARGE'});
 assert.equal(cancelled,true);
 await assert.rejects(stat(file),{code:'ENOENT'});
}));
import {retryableJobError} from '../src/retry-policy.js';
test('missing validated source and corrupt input fail without automatic render retries',()=>{
 for(const code of ['ALEX_V16_SOURCE_REQUIRED','SOURCE_HASH_MISMATCH','SOURCE_SIZE_MISMATCH','VIDEO_ROTATION_UNSUPPORTED'])assert.equal(retryableJobError({code}),false);
 assert.equal(retryableJobError({code:'ECONNRESET'}),true);
});
test('restored historical Alex modules match their recorded immutable source hashes',async()=>{
 const manifest=JSON.parse(await readFile(new URL('../references/alex/sources.json',import.meta.url),'utf8'));
 for(const entry of manifest.files){
  const name=entry.path.split('/').at(-1);
  const bytes=await readFile(new URL('../src/'+name,import.meta.url));
  assert.equal(createHash('sha256').update(bytes).digest('hex'),entry.sha256);
 }
 assert.equal(manifest.autonomousV16RendererFound,false);
});
