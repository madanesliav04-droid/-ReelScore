import test from 'node:test';
import assert from 'node:assert/strict';
import {buildVisualEditorialDecisions} from '../src/multimodal-director.js';
const words=[
 {text:'Ça',startMs:4200,endMs:4450},
 {text:'coûte',startMs:4450,endMs:4770},
 {text:'combien',startMs:4770,endMs:5180},
 {text:'?',startMs:5180,endMs:5190}
];
const base={action:'graphic',spoken_anchor:'Ça coûte combien ?',start_sec:4.2,visual_evidence:'face visible center lower, clear top band',
 visual_confidence:.95,audio_confidence:.95,safe_area:'top',protected_regions:[{type:'face',x:.34,y:.31,w:.24,h:.29}]};
const run=(d,w=words)=>buildVisualEditorialDecisions({analysis:{editorial_director:{decisions:[d]}},mappedWords:w,outputDurationMs:25000});
test('verbatim timed visible title accepted',()=>{const r=run(base);assert.equal(r.cues.length,1);assert.equal(r.cues[0].lane,'top')});
test('invented headline rejected',()=>assert.equal(run({...base,spoken_anchor:'Deviens riche demain'}).cues.length,0));
test('weak visual evidence rejected',()=>assert.equal(run({...base,visual_confidence:.3}).cues.length,0));
test('no bounding boxes rejected',()=>assert.equal(run({...base,protected_regions:[]}).cues.length,0));
test('mismatched timestamp rejected',()=>assert.equal(run({...base,start_sec:10}).cues.length,0));
test('intersecting face and board prevent all graphics',()=>assert.equal(run({...base,protected_regions:[{type:'board',x:0,y:0,w:1,h:1}]}).cues.length,0));
test('limited layout fallback avoids face',()=>{const r=run({...base,protected_regions:[{type:'face',x:.25,y:.1,w:.6,h:.18}]});assert.equal(r.cues[0]?.lane,'left')});
test('sensitive crops refuse hands on edge',()=>{const r=run({...base,action:'soft_punch',subject_centered:true,protected_regions:[{type:'hands',x:.02,y:.2,w:.4,h:.4}]});assert.equal(r.punchIns.length,0)});
test('central subject enables gentle punch',()=>{const r=run({...base,action:'soft_punch',subject_centered:true});assert.equal(r.punchIns[0].scale,1.045)});
test('unknown video with no observed decisions gets no visual effect',()=>{const r=buildVisualEditorialDecisions({analysis:{},mappedWords:words,outputDurationMs:24000});assert.equal(r.cues.length+r.punchIns.length,0)});
test('no transcript gets no visual effect',()=>{const r=run(base,[]);assert.equal(r.cues.length+r.punchIns.length,0)});
