import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtemp,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {buildEditTimeline} from '../src/edit.js';
import {preprocessVideo,renderNativeEdit} from '../src/render.js';

const run=(program,args)=>{
 const r=spawnSync(program,args,{encoding:'utf8',timeout:120000});
 if(r.error)throw r.error;
 assert.equal(r.status,0,`${program} failed: ${r.stderr?.slice(-1000)}`);
 return r.stdout;
};
test('FFmpeg real render smoke: native 16:9 Hormozi and Social Kinetic', {timeout:180000},async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'socialplus-render-'));
 try{
  const src=path.join(dir,'input.mp4');
  run('ffmpeg',['-v','error','-y','-f','lavfi','-i','color=c=0x192733:s=640x360:r=24:d=2.5','-f','lavfi','-i','sine=frequency=440:sample_rate=44100:duration=2.5','-shortest','-c:v','libx264','-pix_fmt','yuv420p','-c:a','aac','-b:a','96k',src]);
  const analysis={measurable:{width:640,height:360,durationSec:2.5,audioCodec:'aac',silenceWindows:[]},transcript:{text:'Les questions comptent plus que les likes.',words:[
   {text:'Les',startMs:0,endMs:270},{text:'questions',startMs:320,endMs:880},{text:'comptent',startMs:920,endMs:1330},
   {text:'plus',startMs:1370,endMs:1570},{text:'que',startMs:1600,endMs:1750},
   {text:'les',startMs:1790,endMs:1900},{text:'likes.',startMs:1940,endMs:2330}
  ]},timeline:[]};
  for(const style of ['hormozi_omni','social_kinetic']){
   const timeline=buildEditTimeline({analysis,style,format:'native',sourceWidth:640,sourceHeight:360});
   const prepared=path.join(dir,`${style}-prepared.mp4`);
   const out=path.join(dir,`${style}-output.mp4`);
   await preprocessVideo({inputPath:src,outputPath:prepared,keepRanges:timeline.keepRanges,sourceDurationMs:2500,hasAudio:true});
   await renderNativeEdit({sourcePath:prepared,outputPath:out,durationMs:timeline.outputDurationMs,timeline});
   const data=JSON.parse(run('ffprobe',['-v','error','-show_entries','stream=codec_name,width,height,codec_type','-of','json',out]));
   const video=data.streams.find(x=>x.codec_type==='video');
   const audio=data.streams.find(x=>x.codec_type==='audio');
   assert.equal(video.width,640);
   assert.equal(video.height,360);
   assert.ok(audio,'original audio track must survive');
  }
 }finally{await rm(dir,{recursive:true,force:true})}
});
