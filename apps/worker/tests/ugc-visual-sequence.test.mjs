import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,rm,stat} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {renderUgcVisualSequence,probeUgcMedia} from '../src/ugc-visual-sequence.js';

function execute(bin,args){
  return new Promise((resolve,reject)=>{
    const p=spawn(bin,args,{stdio:['ignore','pipe','pipe']});
    let err='';
    p.stderr.on('data',b=>{err=(err+String(b)).slice(-2000)});
    p.on('error',reject);
    p.on('close',code=>code===0?resolve():reject(new Error(bin+' '+code+' '+err)));
  });
}

test('real FFmpeg: silent UGC clips concatenate; original primary audio remains single',async()=>{
  const dir=await mkdtemp(path.join(os.tmpdir(),'ugc-visual-qa-'));
  try{
    const source=path.join(dir,'voice.mp4');
    const detail=path.join(dir,'detail.mp4');
    const result=path.join(dir,'final.mp4');
    await execute('ffmpeg',['-loglevel','error','-y','-f','lavfi','-i','color=c=red:s=128x224:r=30',
      '-f','lavfi','-i','sine=frequency=440:sample_rate=44100',
      '-t','1.1','-c:v','libx264','-preset','ultrafast','-pix_fmt','yuv420p','-c:a','aac',source]);
    await execute('ffmpeg',['-loglevel','error','-y','-f','lavfi','-i','color=c=blue:s=128x224:r=30',
      '-t','1.2','-c:v','libx264','-preset','ultrafast','-pix_fmt','yuv420p',detail]);
    const data=await renderUgcVisualSequence({sourcePath:source,rushPaths:[detail],workDir:dir,outputPath:result});
    const probe=await probeUgcMedia(result);
    assert.equal(data.sourceCount,2);
    assert.equal(data.originalAudioPreserved,true);
    assert.equal(probe.hasAudio,true);
    assert.equal(probe.width,1080);
    assert.equal(probe.height,1920);
    assert.ok(probe.duration>1.9);
    assert.ok((await stat(result)).size>8192);
  }finally{
    await rm(dir,{recursive:true,force:true});
  }
});
