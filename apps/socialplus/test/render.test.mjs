import test from 'node:test';
import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
const execFileAsync=promisify(execFile);
import {mkdtemp,rm,stat} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {MODEL_CATALOG,probeVideo,renderVideo} from '../server/render.mjs';

test('the six artistic references stay distinct from technical conversion and fail closed',async()=>{
  assert.equal(MODEL_CATALOG.length,6);
  assert.equal(new Set(MODEL_CATALOG.map(m=>m.id)).size,6);
  assert.ok(MODEL_CATALOG.every(m=>m.available===false));
  await assert.rejects(renderVideo({modelId:'cinematic-storytelling-v7'}),{code:'MODEL_SOURCE_MISSING'});
  await assert.rejects(renderVideo({modelId:'alex-hormozi-v16'}),{code:'MODEL_QA_REQUIRED'});
  await assert.rejects(renderVideo({modelId:'not-a-model'}),{code:'UNKNOWN_MODEL'});
});

// Deliberately generated technical fixtures: these are NOT speech rushes,
// not a master comparison, and do not certify any artistic model.
test('real FFmpeg conversions keep native orientation, duration, H.264 and one AAC track',async()=>{
  const dir=await mkdtemp(path.join(tmpdir(),'socialplus-render-test-'));
  try {
    for(const [width,height] of [[640,360],[360,640],[360,360]]) {
      const source=path.join(dir,`fixture-${width}x${height}.mp4`),output=path.join(dir,`output-${width}x${height}.mp4`);
      await execFileAsync('ffmpeg',['-hide_banner','-loglevel','error','-f','lavfi','-i',`color=c=0x253345:s=${width}x${height}:r=30:d=3`,
        '-f','lavfi','-i','sine=frequency=440:duration=3','-map','0:v','-map','1:a','-c:v','libx264','-threads','1','-pix_fmt','yuv420p','-c:a','aac','-shortest',source]);
      const result=await renderVideo({sourcePath:source,outputPath:output,modelId:'technical-export'});
      assert.equal(result.audit.artisticModel,false);
      assert.equal(result.metadata.width,width);assert.equal(result.metadata.height,height);
      assert.equal(result.metadata.videoCodec,'h264');assert.equal(result.metadata.audioCodec,'aac');
      assert.equal(result.metadata.audioStreams,1);assert.ok(Math.abs(result.metadata.durationMs-3000)<100);
      assert.ok((await stat(output)).size>1000);
      // A decoded output still carries the supplied 440 Hz source tone.
      const {stdout:pcm}=await execFileAsync('ffmpeg',['-v','error','-i',output,'-map','0:a:0','-ac','1','-ar','8000','-f','s16le','pipe:1'],{encoding:'buffer'});
      let crossings=0;for(let i=2;i<pcm.length;i+=2)if(pcm.readInt16LE(i-2)<0&&pcm.readInt16LE(i)>=0)crossings++;
      const frequency=crossings/(pcm.length/2/8000);assert.ok(frequency>425&&frequency<450,`source frequency ${frequency}`);
    }
  } finally {await rm(dir,{recursive:true,force:true});}
});

test('Alex reference grammar performs a real local overlay only with evidence; missing evidence rejects',async()=>{
  const dir=await mkdtemp(path.join(tmpdir(),'socialplus-alex-test-'));
  const previous=process.env.SOCIALPLUS_BETA_RENDER;
  process.env.SOCIALPLUS_BETA_RENDER='staging';
  try {
    const source=path.join(dir,'synthetic-technical-fixture.mp4'),output=path.join(dir,'alex-reference-grammar.mp4');
    await execFileAsync('ffmpeg',['-v','error','-f','lavfi','-i','color=c=0x253345:s=640x360:r=30:d=3',
      '-f','lavfi','-i','sine=frequency=440:duration=3','-c:v','libx264','-threads','1','-pix_fmt','yuv420p','-c:a','aac','-shortest',source]);
    const meta=await probeVideo(source);
    const timeline={outputDurationMs:meta.durationMs,keepRanges:[{startMs:0,endMs:meta.durationMs}],export:{width:640,height:360},audio:{hasAudio:true}};
    await assert.rejects(renderVideo({sourcePath:source,outputPath:output,modelId:'alex-hormozi-v16',timeline}),{code:'VERIFIED_EVIDENCE_REQUIRED'});
    const analysis={transcript:{alignment:{method:'forced_alignment',verified:true,confidence:.99},words:[{text:'30',startMs:200,endMs:600},{text:'jours',startMs:650,endMs:1000}]},
      hormozi_storyboards:[{type:'metric',spoken_anchor:'30 jours',text:'30'}],
      // The technical fixture is a uniform, known empty frame. This evidence
      // is synthetic test input and never exposed as a real subject analysis.
      composition_proof:{source:'independent_frame_sampler',verified:true,frames:Array.from({length:16},(_,i)=>({ms:i*200,confidence:.99,clearTopNormalized:1}))}};
    const result=await renderVideo({sourcePath:source,outputPath:output,modelId:'alex-hormozi-v16',timeline,analysis});
    assert.equal(result.audit.engine,'hormozi-omni-explainer-v1');
    assert.equal(result.audit.acceptedCues,1);assert.match(result.audit.release,/not_V16_certified/);
    assert.equal(result.metadata.audioStreams,1);assert.equal(result.metadata.videoCodec,'h264');
    const frameArgs=p=>['-v','error','-ss','0.8','-i',p,'-frames:v','1','-f','rawvideo','-pix_fmt','rgb24','pipe:1'];
    const [{stdout:before},{stdout:after}]=await Promise.all([source,output].map(p=>execFileAsync('ffmpeg',frameArgs(p),{encoding:'buffer',maxBuffer:2_000_000})));
    assert.equal(before.length,after.length);let changed=0;
    for(let i=0;i<before.length;i+=3)if(Math.max(Math.abs(before[i]-after[i]),Math.abs(before[i+1]-after[i+1]),Math.abs(before[i+2]-after[i+2]))>60)changed++;
    assert.ok(changed>40,`visible ASS glyph pixels: ${changed}`);
  } finally {
    if(previous===undefined)delete process.env.SOCIALPLUS_BETA_RENDER;else process.env.SOCIALPLUS_BETA_RENDER=previous;
    await rm(dir,{recursive:true,force:true});
  }
});
