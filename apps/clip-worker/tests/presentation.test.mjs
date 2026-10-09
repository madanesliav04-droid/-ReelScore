import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildClipVideoFilter,buildClipCaptionAss} from '../src/clip-presentation.js';
test('preserves entire source in portrait canvas rather than center-cropping',()=>{
  const vf=buildClipVideoFilter();
  assert.match(vf,/force_original_aspect_ratio=decrease/);
  assert.match(vf,/overlay=\(W-w\)\/2:\(H-h\)\/2/);
  assert.doesNotMatch(vf,/crop=1080:1920:\(iw-1080\)\/2:\(ih-1920\)\*0\.42/);
});
test('mobile captions remain in safe zone and wrap under four words',()=>{
  const words=Array.from({length:8},(_,i)=>({startMs:1000+i*400,endMs:1300+i*400,text:'essentiel'}));
  const ass=buildClipCaptionAss(words,1000,6000);
  assert.match(ass,/95,95,430,1/);
  assert.match(ass,/WrapStyle: 0/);
  assert.match(ass,/\\N/);
  const dialogue=ass.split('\n').filter(x=>x.startsWith('Dialogue:'));
  assert.ok(dialogue.length>=2);
  assert.ok(dialogue.every(x=>x.length<180));
});
test('landscape and portrait compositions use same 1080x1920 safe styling',()=>{
  const cfg=buildClipVideoFilter('/tmp/captions.ass');
  assert.match(cfg,/scale=1080:1920/);
  assert.match(cfg,/ass='/);
  assert.match(buildClipCaptionAss([],0,15000),/PlayResY: 1920/);
});
