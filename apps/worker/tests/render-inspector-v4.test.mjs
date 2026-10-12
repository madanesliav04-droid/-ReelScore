import test from 'node:test';
import assert from 'node:assert/strict';
import {parseRenderSignals,inspectRenderedVideo} from '../src/render-inspector-v4.js';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';

test('unremarkable media produces no false creative success',()=>{
 const r=parseRenderSignals('max_volume: -3.2 dB',4);
 assert.equal(r.verdict,'NO_MEASURABLE_ALERT');
 assert.match(r.limitations,/premium aesthetics/);
});
test('black screens measured by time',()=>{
 const r=parseRenderSignals('black_start:1 black_end:2.8 black_duration:1.8',5);
 assert.equal(r.review[0].type,'EXTENDED_BLACK_FRAME');
});
test('long audio silence asks review, not automatic rejection',()=>{
 const r=parseRenderSignals('silence_start:1\nsilence_end:5.2 | silence_duration:4.2',6);
 assert.equal(r.verdict,'NEEDS_HUMAN_REVIEW');
});
test('short freeze is not an alert',()=>{
 const r=parseRenderSignals('freeze_start: 1\nfreeze_end: 2 | freeze_duration: 1',7);
 assert.equal(r.review.length,0);
});
test('near 0 dBFS peak needs review',()=>{
 const r=parseRenderSignals('max_volume: 0.0 dB',4);
 assert.equal(r.review[0].type,'AUDIO_PEAK_NEAR_FULL_SCALE');
});
test('silent original without audio track handled',()=>{
 const r=parseRenderSignals('',3,false);
 assert.equal(r.audioSilenceEvents,null);
});
test('missing file fails, no invented success',()=>assert.rejects(
 inspectRenderedVideo('/tmp/does-not-exist-viral-v4.mp4',{durationSec:2})
));
test('real FFmpeg black fixture is detected',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'viral-v4-')),file=join(dir,'test.mp4');
 try{
  const p=spawnSync('ffmpeg',['-hide_banner','-loglevel','error','-nostdin','-y',
   '-f','lavfi','-i','color=c=black:s=128x128:r=12:d=2.6',
   '-c:v','libx264','-pix_fmt','yuv420p',file],{timeout:20000});
  assert.equal(p.status,0,p.stderr?.toString());
  const r=await inspectRenderedVideo(file,{durationSec:2.6,hasAudio:false});
  assert.ok(r.review.some(x=>x.type==='EXTENDED_BLACK_FRAME'));
 }finally{await rm(dir,{recursive:true,force:true})}
});
