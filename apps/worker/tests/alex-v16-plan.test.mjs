import test from 'node:test';
import assert from 'node:assert/strict';
import {buildAlexV16Plan,alexKeepRanges} from '../src/alex-v16-plan.js';
import {editContract} from '../src/model-contract.js';
// Synthetic wording only. These tests are not claimed as real voice validation.
const text='Au début, expliquer aux clients pourquoi ils vivent déjà le problème et se plaignent déjà de leur situation actuelle. Parce que vendre devient beaucoup plus simple quand la personne sait déjà ce dont elle a réellement besoin. Ton boulot consiste alors à montrer pourquoi ta solution peut être la bonne et comment faire pour agir concrètement.';
const words=text.split(' ').map((text,i)=>({text,startMs:i*280,endMs:i*280+210,probability:.99}));
const input=()=>({transcript:{words:structuredClone(words),reviewed:false,warnings:[]},measurable:{durationSec:words.length*.28+.4,silenceWindows:[]}});

test('Alex is only accepted by explicit server reconstruction gate',()=>{
 assert.equal(editContract('hormozi_omni').ok,false);
 assert.equal(editContract('alex_hormozi',{alexReconstruction:true}).workerStyle,'hormozi_omni');
});
test('three reconstructed scenes and their text have actual ordered speech evidence',()=>{
 const plan=buildAlexV16Plan(input());
 assert.deepEqual(plan.scenes.map(x=>x.kind),['question','value','chain']);
 for(const s of plan.scenes){
  assert.ok(s.end>s.start);
  for(const evidence of s.evidence)assert.equal(evidence.text,words.slice(evidence.firstWord,evidence.lastWord+1).map(w=>w.text).join(' ').replace(/[.,!?;:]+$/g,''));
 }
 assert.equal(plan.reviewRequired,true);
 assert.equal(plan.wordVerification,'automatic-needs-review');
});
test('same words and settings yield the same full plan',()=>{
 assert.deepEqual(buildAlexV16Plan(input()),buildAlexV16Plan(input()));
});
test('new timing moves scenes rather than reusing reference timestamps',()=>{
 const a=buildAlexV16Plan(input()),changed=input();
 changed.transcript.words.forEach(w=>{w.startMs+=900;w.endMs+=900;});changed.measurable.durationSec+=.9;
 const b=buildAlexV16Plan(changed);
 for(let i=0;i<3;i++)assert.ok(Math.abs(b.scenes[i].start-a.scenes[i].start-.9)<.001);
});
test('unsupported content cannot be replaced by generic three scenes',()=>{
 const x=input();x.transcript.words=[{text:'Bonjour',startMs:0,endMs:500},{text:'le',startMs:500,endMs:700},{text:'monde.',startMs:700,endMs:1100}];
 assert.throws(()=>buildAlexV16Plan(x),{code:'ALEX_SCENE_EVIDENCE_REQUIRED'});
});
test('uncertain words remain reported, never auto-reviewed',()=>{
 const x=input();x.transcript.words[3].probability=.3;
 const p=buildAlexV16Plan(x);assert.equal(p.issues[0].wordIndex,3);assert.equal(p.reviewRequired,true);
});
test('no arbitrary cut inside a sentence, or without measured silence',()=>{
 const w=[{text:'une',startMs:0,endMs:400},{text:'phrase',startMs:2000,endMs:2300}];
 assert.equal(alexKeepRanges(w,[{start:.5,end:1.9}],3000).removedRanges.length,0);
 w[0].text='Fin.';
 assert.equal(alexKeepRanges(w,[],3000).removedRanges.length,0);
 const r=alexKeepRanges(w,[{start:.5,end:1.9}],3000);
 assert.equal(r.removedRanges.length,1);assert.ok(r.removedRanges[0].startMs>w[0].endMs);assert.ok(r.removedRanges[0].endMs<w[1].startMs);
});
test('overlapping active words require review, not fabricated boundaries',()=>{
 const x=input();x.transcript.words[1].startMs=100;
 assert.throws(()=>buildAlexV16Plan(x),{code:'ALEX_TIMING_REVIEW_REQUIRED'});
});
