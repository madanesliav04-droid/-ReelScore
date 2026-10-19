import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {captionColorForLuma,sampleBackgroundLuma} from '../src/render.js';

function run(cmd,args){
  return new Promise((resolve,reject)=>{
    const p=spawn(cmd,args,{stdio:['ignore','ignore','pipe']});
    let err='';
    p.stderr.on('data',x=>err+=String(x));
    p.on('error',reject);
    p.on('close',c=>c===0?resolve():reject(new Error(err.slice(-500))));
  });
}
test('Bright actual backgrounds select dark ink; dark backgrounds select light ink',()=>{
  assert.equal(captionColorForLuma(199).mode,'dark');
  assert.equal(captionColorForLuma(75).mode,'light');
  assert.equal(captionColorForLuma(NaN).confidence,'unknown');
});
test('FFmpeg measured bright and dark frames drive per-source colors',async()=>{
  const dir=await mkdtemp(path.join(tmpdir(),'editplus-color-'));
  try{
    for(const [name,color] of [['bright','white'],['dark','black']]){
      const file=path.join(dir,name+'.mp4');
      await run('ffmpeg',['-v','error','-y','-f','lavfi','-i',
        'color=c='+color+':size=360x200:rate=10','-t','2',
        '-c:v','libx264','-pix_fmt','yuv420p',file]);
      const regions=await sampleBackgroundLuma(file,.25);
      assert.ok(Number.isFinite(regions.left));
      assert.ok(Number.isFinite(regions.right));
      assert.equal(captionColorForLuma(regions.left).mode,
        name==='bright'?'dark':'light');
    }
  }finally{await rm(dir,{recursive:true,force:true});}
});
