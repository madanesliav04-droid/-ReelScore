import test from 'node:test';
import assert from 'node:assert/strict';
import {buildAlexV8ReleasePlan,assertAlexV8Deployment}
  from '../src/alex-v8-release.js';

const keepRanges=[
 {startMs:0,endMs:3790},{startMs:5520,endMs:7670},
 {startMs:8200,endMs:9990},{startMs:10770,endMs:14640},
 {startMs:15820,endMs:16880},{startMs:17960,endMs:43780}
];
const timeline={sourceDurationMs:44500,outputDurationMs:38480,
 keepRanges,export:{width:910,height:512},audio:{hasAudio:true}};
const speech=Array.from({length:48},(_,i)=>({
 text:'parole'+i,startMs:18100+i*360,endMs:18380+i*360
}));
const analysis={measurable:{width:910,height:512,audioCodec:'aac'},
 transcript:{words:speech,alignment:{
  verified:true,method:'provider_word_timestamps',
  source:'gemini_interactions_word_info',reviewedAgainstAudio:false
 }}};
const build=(a=analysis,t=timeline)=>buildAlexV8ReleasePlan({analysis:a,timeline:t});

test('V8 accepts a sufficiently evidenced original 16:9 voice, keeps V7 look',()=>{
 const p=build();
 assert.equal(p.status,'ready_for_render');
 assert.equal(p.quality.passed,true);
 assert.equal(p.model,'alex_hormozi_v8');
 assert.equal(p.design,'alex-v7-apple-kinetic-LOCKED');
 assert.equal(p.releaseStatus,'REQUIRES_REAL_RUSH_QA');
 assert.ok(p.wordCount>=30);
 assert.deepEqual(p.semanticVisuals,[]);
 for(let i=0;i<p.groups.length-1;i++)
  assert.ok(p.groups[i].endMs<=p.groups[i+1].startMs);
});
test('V8 cannot claim production without a release flag',()=>{
 assert.equal(assertAlexV8Deployment({mode:'staging',publicEnabled:'false'}),'staging');
 assert.throws(()=>assertAlexV8Deployment({mode:'production',publicEnabled:'false'}),/RELEASE_APPROVAL/);
 assert.equal(assertAlexV8Deployment({mode:'production',publicEnabled:'true'}),'production');
});
test('V8 blocks provider output with missing/partial speech words',()=>{
 const a={...analysis,transcript:{...analysis.transcript,words:speech.slice(0,6)}};
 const p=build(a);
 assert.equal(p.status,'blocked');
 assert.equal(p.reason,'TRANSCRIPT_INCOMPLETE');
});
test('V8 blocks native orientation reversal',()=>{
 const t={...timeline,export:{width:512,height:910}};
 assert.equal(build(analysis,t).reason,'NATIVE_ORIENTATION_REQUIRED');
});
test('V8 blocks missing original sound and simulated false ASR assurance',()=>{
 const a={...analysis,measurable:{...analysis.measurable,audioCodec:null}};
 assert.equal(build(a).reason,'ORIGINAL_AUDIO_REQUIRED');
 const b={...analysis,transcript:{...analysis.transcript,alignment:{verified:false}}};
 assert.equal(build(b).status,'blocked');
});
test('V8 blocks caption cut-duration drift and bad source timing',()=>{
 assert.equal(build(analysis,{...timeline,outputDurationMs:40380}).reason,
  'CUT_TIMELINE_DURATION_MISMATCH');
 const fake={...analysis,transcript:{...analysis.transcript,words:
    speech.map((w,i)=>i===15?{...w,startMs:999999}:w)}};
 assert.equal(build(fake).status,'blocked');
});
