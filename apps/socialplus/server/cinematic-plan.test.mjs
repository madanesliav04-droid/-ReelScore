import test from 'node:test';
import assert from 'node:assert/strict';
import {planCinematic,cinematicReviewItems} from './cinematic-plan.mjs';
import {restoredPlan} from './restored-models.mjs';
const words='Tu peux résoudre un problème concret. Ensuite tu peux aider les personnes autour de toi.'.split(' ').map((text,i)=>({text,startMs:1800+i*350,endMs:2000+i*350,probability:.99}));
const report={fingerprint:'rush-only',metadata:{width:910,height:512,hasAudio:true,durationMs:13000},suggestions:[]};
test('automatic cinematic plan is deterministic, source quoted and accepted by the existing compositor',()=>{
 const input={words,reviewed:true};const p=planCinematic(report,input);
 assert.deepEqual(p,planCinematic(report,input));assert.ok(p.events.length);
 assert.doesNotThrow(()=>restoredPlan('cinematic-storytelling-v7',report.metadata,p));
 for(const e of p.events)assert.equal(words.slice(e.wordIndex,e.wordIndex+e.wordCount).map(w=>w.text).join(' '),words.filter(w=>w.startMs>=words[e.wordIndex].startMs&&w.startMs<=words[e.wordIndex+e.wordCount-1].startMs).map(w=>w.text).join(' '));
 assert.ok(p.events.every(e=>e.endMs<=report.metadata.durationMs));
 const shifted={words:words.map(w=>({...w,startMs:w.startMs+500,endMs:w.endMs+500})),reviewed:true};
 assert.equal(planCinematic(report,shifted).events[0].endMs,p.events[0].endMs+500);
});
test('new source identity, uncertain words and multiword timing cannot be silently confirmed',()=>{
 assert.throws(()=>planCinematic(report,{words,sourceSha256:'other',reviewed:true}),/autre vidéo/);
 const uncertain={words:words.map((w,i)=>i===1?{...w,probability:.2}:w),reviewed:true};
 assert.throws(()=>planCinematic(report,uncertain),/non confirmée/);
 const p=planCinematic(report,uncertain,{preview:true});assert.equal(p.captionsReviewed,false);assert.ok(p.warnings.length);
 assert.ok(p.events.every(e=>!(e.wordIndex<=1&&e.wordIndex+e.wordCount>1)));
 assert.throws(()=>planCinematic(report,{words:[{text:'deux mots',start:0,end:1,confirmed:true}],reviewed:true}),/non confirmée/);
});
test('only measured complete-phrase pauses are cut and raw ASR spans protect quiet syllables',()=>{
 const transcript={reviewed:true,words:[{text:'Avant.',startMs:500,endMs:1500},{text:'Après.',startMs:3500,endMs:4000}]};
 const r={...report,suggestions:[{id:'p',startMs:1750,endMs:3250}]};
 const p=planCinematic(r,transcript);assert.deepEqual(p.approvedPauseIds,['p']);assert.equal(p.outputDurationMs,11500);assert.equal(p.mappedWords[1].outputStartMs,2000);
 const guarded=planCinematic(r,{...transcript,words:[{...transcript.words[0],asrEndMs:3450},transcript.words[1]]});
 assert.deepEqual(guarded.approvedPauseIds,[]);assert.equal(guarded.heldPauses.length,1);
});
test('native format is preserved and cinematic limits do not loosen other model title limits',()=>{
 assert.throws(()=>planCinematic({...report,metadata:{...report.metadata,width:911}},{words,reviewed:true}),/impaires/);
 const p=planCinematic(report,{words,reviewed:true});assert.equal(p.events[0].wordCount,6);
 assert.throws(()=>restoredPlan('codie-omni-v60',report.metadata,{...p,events:[{...p.events[0],kind:'clock',rect:[.05,.05,.3,.3]}]}));
});

test('preview never reports merged timestamps as reviewed, even with a text confirmation',()=>{
 const data={words:[{text:'deux mots',start:0,end:1,confirmed:true}],reviewed:true};
 const plan=planCinematic(report,data,{preview:true});
 assert.equal(plan.captionsReviewed,false);assert.equal(plan.captionStatus,'unreviewed_preview');
 const [item]=cinematicReviewItems(plan);assert.equal(item.requiresIndividualWordBoundaries,true);assert.equal(item.automaticallyConfirmed,false);
});
test('review entries expose exact source and edited times without changing text or timings',()=>{
 const input={reviewed:false,words:[{text:'Avant.',startMs:500,endMs:1500,probability:.95},{text:'Après.',startMs:3500,endMs:4000,probability:.95},{text:'incertain',startMs:5000,endMs:5500,probability:.2}]};
 const plan=planCinematic({...report,suggestions:[{id:'p',startMs:1750,endMs:3250}]},input,{preview:true});
 const [item]=cinematicReviewItems(plan);assert.equal(item.wordIndex,2);assert.equal(item.sourceStartMs,5000);assert.equal(item.outputStartMs,3500);assert.equal(item.text,'incertain');assert.equal(item.status,'pending_human_review');
});
