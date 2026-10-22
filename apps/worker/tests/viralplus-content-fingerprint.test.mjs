import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import os from 'node:os';
import {decodedSourceFingerprint,probeFingerprintSource} from '../src/viral-fingerprint.js';

function run(program,args){
 const p=spawnSync(program,args,{timeout:90000,encoding:'utf8'});
 if(p.error)throw p.error;
 assert.equal(p.status,0,program+': '+p.stderr?.slice(-450));
}
test('same decoded video in differently tagged MOV files yields identical cache key, different video does not',{timeout:180000},async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'viralplus-repeat-'));
 try{
  const a=path.join(dir,'clip-1.mov'),b=path.join(dir,'clip-2.mov'),c=path.join(dir,'different.mov');
  run('ffmpeg',['-v','error','-y','-f','lavfi','-i','color=c=blue:s=320x180:r=24:d=3','-f','lavfi','-i','sine=frequency=380:sample_rate=44100:duration=3','-shortest','-c:v','libx264','-c:a','aac','-pix_fmt','yuv420p',a]);
  run('ffmpeg',['-v','error','-y','-i',a,'-map','0','-c','copy','-metadata','comment=SocialPlus alternate upload metadata','-movflags','+faststart',b]);
  run('ffmpeg',['-v','error','-y','-f','lavfi','-i','color=c=red:s=320x180:r=24:d=3','-f','lavfi','-i','sine=frequency=380:sample_rate=44100:duration=3','-shortest','-c:v','libx264','-c:a','aac','-pix_fmt','yuv420p',c]);
  const sha=async f=>createHash('sha256').update(await readFile(f)).digest('hex');
  assert.notEqual(await sha(a),await sha(b),'MOV metadata must actually alter raw file SHA');
  const fingerprints=await Promise.all([a,b,c].map(async f=>{
   const x=await probeFingerprintSource(f);
   return decodedSourceFingerprint({filePath:f,...x});
  }));
  assert.equal(fingerprints[0],fingerprints[1],'identical decoded AV must reuse one score');
  assert.notEqual(fingerprints[0],fingerprints[2],'different visual content must not share cached score');
 }finally{await rm(dir,{recursive:true,force:true})}
});
