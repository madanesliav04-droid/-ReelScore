import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {checkRender} from './check-render.mjs';

function ffmpeg(...args){
 const p=spawnSync('ffmpeg',['-nostdin','-y','-hide_banner','-loglevel','error',...args],{encoding:'utf8',timeout:30000});
 assert.equal(p.status,0,p.stderr);
}
async function fixture(kind){
 const dir=await mkdtemp(path.join(tmpdir(),'viral-studio-qa-'));
 const file=path.join(dir,'video.mp4');
 if(kind==='black'){
   ffmpeg('-f','lavfi','-i','color=c=black:s=320x568:r=30:d=2.3','-f','lavfi','-i','sine=frequency=440:duration=2.3','-c:v','libx264','-threads','1','-pix_fmt','yuv420p','-c:a','aac','-shortest',file);
 }else if(kind==='silent'){
   ffmpeg('-f','lavfi','-i','testsrc2=size=320x568:rate=30:duration=2.3','-c:v','libx264','-threads','1','-pix_fmt','yuv420p',file);
 }else{
   ffmpeg('-f','lavfi','-i','testsrc2=size=320x568:rate=30:duration=2.3','-f','lavfi','-i','sine=frequency=440:duration=2.3','-c:v','libx264','-threads','1','-pix_fmt','yuv420p','-c:a','aac','-shortest',file);
 }
 return {dir,file};
}
test('valid technical MP4 passes — never claims professional creative quality',async()=>{
 const f=await fixture('good');
 try{
  const result=await checkRender(f.file,{width:320,height:568});
  assert.equal(result.verdict,'PASS',JSON.stringify(result.errors));
  assert.equal(result.scope,'MEDIA_INTEGRITY_ONLY');
 }finally{await rm(f.dir,{force:true,recursive:true})}
});
test('decodable MP4 with black output must fail',async()=>{
 const f=await fixture('black');
 try{
  const result=await checkRender(f.file);
  assert.equal(result.verdict,'FAIL');
  assert.ok(result.errors.some(x=>x.code==='LONG_BLACK'),JSON.stringify(result.errors));
 }finally{await rm(f.dir,{force:true,recursive:true})}
});
test('video export missing an audio track must fail',async()=>{
 const f=await fixture('silent');
 try{
  const result=await checkRender(f.file);
  assert.equal(result.verdict,'FAIL');
  assert.ok(result.errors.some(x=>x.code==='NO_AUDIO'));
 }finally{await rm(f.dir,{force:true,recursive:true})}
});
