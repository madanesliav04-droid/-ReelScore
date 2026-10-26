import test from 'node:test';
import assert from 'node:assert/strict';
import {buildEditTimeline,EDIT_STYLES} from '../src/edit.js';

const analysis={measurable:{durationSec:4,width:1920,height:1080,silenceWindows:[]},transcript:{words:[]},timeline:[]};

test('unsupported editing model never falls back to creator_clean',()=>{
  assert.throws(()=>buildEditTimeline({analysis,style:'alex_hormozi'}),error=>
    error.code==='EDIT_STYLE_NOT_IMPLEMENTED' && /alex_hormozi/.test(error.message));
});

test('approved but not implemented style cannot be reported as rendered',()=>{
  assert.throws(()=>buildEditTimeline({analysis,style:'social_kinetic'}),
    {code:'EDIT_STYLE_NOT_IMPLEMENTED'});
});

test('existing creator_clean style remains available',()=>{
  assert.ok(Object.hasOwn(EDIT_STYLES,'creator_clean'));
  const timeline=buildEditTimeline({analysis,style:'creator_clean'});
  assert.equal(timeline.style,'creator_clean');
  assert.ok(timeline.outputDurationMs>0);
});

test('horizontal uploads remain horizontal after timeline planning',()=>{
  const timeline=buildEditTimeline({analysis,style:'creator_clean'});
  assert.equal(timeline.export.width,1920);
  assert.equal(timeline.export.height,1080);
  assert.equal(timeline.width,1920);
  assert.equal(timeline.height,1080);
});

test('vertical uploads remain vertical after timeline planning',()=>{
  const vertical={...analysis,measurable:{...analysis.measurable,width:1080,height:1920}};
  const timeline=buildEditTimeline({analysis:vertical,style:'creator_clean'});
  assert.equal(timeline.export.width,1080);
  assert.equal(timeline.export.height,1920);
});
