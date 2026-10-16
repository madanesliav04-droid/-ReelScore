import test from 'node:test';
import assert from 'node:assert/strict';
import {makeHormoziMotionBeats} from '../src/hormozi-beat-timing.js';
test('beat starts quantize to verified spoken words within half a 30 fps frame',()=>{
 const r=makeHormoziMotionBeats({type:'sequence',startMs:5234,endMs:8630,itemStarts:[5234,6526,8044]});
 assert.equal(r.held,undefined);
 assert.equal(r.beats.length,3);
 for(let i=0;i<3;i++)assert.ok(Math.abs(r.beats[i].atMs-[5234,6526,8044][i])<=16.67);
});
test('each reveal ends before the next spoken beat, no arbitrary fixed delay',()=>{
 const r=makeHormoziMotionBeats({type:'sequence',startMs:1200,endMs:5000,itemStarts:[1200,1772,3000]});
 assert.ok(r.beats.every((b,i)=>i===2||b.easeMs<r.beats[i+1].atMs-b.atMs));
 assert.ok(r.beats.every(b=>b.easeMs>=95&&b.easeMs<=230));
});
test('invalid too-tight or reversed beats are held instead of creating visual lag',()=>{
 assert.equal(makeHormoziMotionBeats({type:'sequence',startMs:1200,endMs:3000,itemStarts:[1200,1250]}).held,'INVALID_BEAT_SPACING');
 assert.equal(makeHormoziMotionBeats({type:'sequence',startMs:1200,endMs:3000,itemStarts:[1700,1450]}).held,'INVALID_BEAT_SPACING');
 assert.equal(makeHormoziMotionBeats({type:'comparison',startMs:1200,endMs:3000,rightStartMs:null}).held,'MISSING_WORD_ANCHOR');
});
