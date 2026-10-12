import test from 'node:test';
import assert from 'node:assert/strict';
import {assessCutCandidates,arbitrateEditorialEffects,inspectPremiumQuality} from '../src/premium-quality-v3.js';

const cut={startMs:1600,endMs:2200,reason:'silence'};
const words=[{text:'Bonjour',startMs:100,endMs:1000},{text:'ensuite',startMs:3000,endMs:3500}];
const alignment={method:'forced_alignment',verified:true,confidence:.98};
const motion={verified:true,windows:[{startMs:1400,endMs:2400,basis:'independent_frame_tracking',gestureContinuitySafe:true,subjectContinuitySafe:true,framesChecked:16,confidence:.98}]};
const safe={transcript:{words,alignment},motion_evidence:motion};
const run=(analysis,entry=cut)=>assessCutCandidates({candidates:[entry],analysis,durationMs:5000});

test('ASR words without independent forced alignment cannot remove footage',()=>assert.ok(run({transcript:{words}}).held[0].reasons.includes('UNVERIFIED_WORD_ALIGNMENT')));
test('missing gesture tracking blocks even forced aligned cuts',()=>assert.ok(run({transcript:{words,alignment}}).held[0].reasons.includes('UNVERIFIED_GESTURE_CONTINUITY')));
test('both independently verified proofs allow a clean mid-gap edit',()=>assert.equal(run(safe).accepted.length,1));
test('cuts intersecting words are never authorized',()=>assert.ok(run(safe,{startMs:900,endMs:1200}).held[0].reasons.includes('CUT_TOUCHES_SPEECH')));
test('Gemini single-frame box is not dynamic tracking proof',()=>assert.equal(run({...safe,motion_evidence:{windows:[{...motion.windows[0],basis:'gemini_single_frame'}]}}).accepted.length,0));
test('graphics outrank b-roll and punch-in on collision',()=>{
 const r=arbitrateEditorialEffects({durationMs:5000,graphicCues:[{startMs:1000,endMs:2500,text:'Title'}],brollCues:[{startMs:900,endMs:1600}],punchIns:[{startMs:1200,endMs:2000}]});
 assert.deepEqual([r.graphicCues.length,r.brollCues.length,r.punchIns.length],[1,0,0]);
});
test('independent spaced editorial effects survive',()=>{
 const r=arbitrateEditorialEffects({durationMs:5000,graphicCues:[{startMs:100,endMs:1000,text:'Title'}],punchIns:[{startMs:2000,endMs:2600}]});
 assert.deepEqual([r.graphicCues.length,r.punchIns.length],[1,1]);
});
test('empty title rejected',()=>assert.equal(arbitrateEditorialEffects({durationMs:5000,graphicCues:[{startMs:100,endMs:600,text:''}]}).rejected[0].reason,'EMPTY_GRAPHIC'));
test('creative report does not call an unreviewed edit premium',()=>{
 const r=inspectPremiumQuality({analysis:safe,timeline:{keepRanges:[{startMs:0,endMs:5000}],outputDurationMs:5000}});
 assert.equal(r.verdict,'NOT_PROVEN_PREMIUM');
});
test('inconsistent output time map blocked',()=>{
 const r=inspectPremiumQuality({analysis:safe,timeline:{keepRanges:[{startMs:0,endMs:1000}],outputDurationMs:5000}});
 assert.ok(r.blocking.includes('INVALID_TIME_MAP'));
});
