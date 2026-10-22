import test from 'node:test';
import assert from 'node:assert/strict';
import {planPremiumStoryboards,renderPremiumStoryboardsAss} from '../src/premium-creative-grammar.js';
const words=[
 {text:'Les',startMs:1000,endMs:1190},
 {text:'likes',startMs:1190,endMs:1460},
 {text:'ou',startMs:1460,endMs:1610},
 {text:'les',startMs:1610,endMs:1820},
 {text:'questions',startMs:1820,endMs:2170}
];
const alignment={method:'forced_alignment',verified:true,confidence:.97};
const visualProof={source:'independent_frame_sampler',verified:true,frames:Array.from({length:19},(_,i)=>({ms:900+i*140,clearTopNormalized:.27,confidence:.98}))};
const compare={type:'comparison',spoken_anchor:'Les likes',start_ms:1000,duration_ms:2200,left:'likes',right:'questions'};
const run=(s=compare,a=alignment,p=visualProof)=>planPremiumStoryboards({suggestions:[s],words,alignment:a,visualProof:p,durationMs:5000});
test('verbatim comparison accepted with real alignment and tracked space',()=>assert.equal(run().accepted.length,1));
test('invented numbers rejected',()=>assert.equal(run({...compare,right:'10000 euros'}).accepted.length,0));
test('estimated ASR is not forced alignment',()=>assert.equal(run(compare,{method:'estimated',verified:true,confidence:1}).accepted.length,0));
test('Gemini-only boxes are not independently sampled',()=>assert.equal(run(compare,alignment,{...visualProof,source:'gemini_visual'}).accepted.length,0));
test('face encroachment invalidates side by side',()=>assert.equal(run(compare,alignment,{...visualProof,frames:visualProof.frames.map(f=>({...f,clearTopNormalized:.15}))}).accepted.length,0));
test('fabricated quote is rejected',()=>assert.equal(run({...compare,spoken_anchor:'double your income'}).accepted.length,0));
test('renderer outputs verifiable text, no slide rectangles',()=>{
 const cue=run().accepted[0],ass=renderPremiumStoryboardsAss({graphicCues:[cue]},512,910);
 assert.match(ass,/Noto Serif/);assert.match(ass,/QUESTIONS/);assert.doesNotMatch(ass,/\\p1/);
});