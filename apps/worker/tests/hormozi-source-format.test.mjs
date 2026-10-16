import test from 'node:test';
import assert from 'node:assert/strict';
import {buildEditTimeline} from '../src/edit.js';
const fake=(width,height)=>({measurable:{width,height,durationSec:8},
 transcript:{words:[],alignment:{method:'none',verified:false}},silences:[]});
test('Hormozi 16:9 raw rush stays landscape even when upstream selects portrait',()=>{
 const t=buildEditTimeline({analysis:fake(910,512),style:'hormozi_omni',format:'portrait'});
 assert.equal(t.width,910);
 assert.equal(t.height,512);
 assert.equal(t.format,'native');
 assert.equal(t.sourceFramePreservation.cropAllowed,false);
 assert.equal(t.sourceFramePreservation.paddingAllowed,false);
});
test('Hormozi 9:16 raw rush stays portrait even when upstream selects landscape',()=>{
 const t=buildEditTimeline({analysis:fake(512,910),style:'hormozi_omni',format:'landscape'});
 assert.equal(t.width,512);
 assert.equal(t.height,910);
 assert.equal(t.format,'native');
 assert.equal(t.sourceFramePreservation.appliedFormat,'native');
});
test('Other Edit+ models keep their explicitly selected output format',()=>{
 const t=buildEditTimeline({analysis:fake(910,512),style:'codie',format:'portrait'});
 assert.equal(t.width,1080);
 assert.equal(t.height,1920);
 assert.equal(t.sourceFramePreservation,null);
});
