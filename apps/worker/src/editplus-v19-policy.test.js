import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {checkV19Format,applyV19Safety} from './editplus-v19-policy.js';
test('horizontal never switches full screen',()=>{
 const p=applyV19Safety({model:'v15b_horizontal',width:910,height:512,timeline:{brollCues:[{startMs:3}],graphicCues:[{kind:'bubble'}]}});
 assert.equal(p.ok,true);assert.deepEqual(p.timeline.brollCues,[]);
 assert.equal(p.timeline.fullScreenBrollAllowed,false);
 assert.equal(p.timeline.graphicCues.length,1);
});
test('no portrait as horizontal',()=>assert.equal(checkV19Format({model:'v15b_horizontal',width:512,height:910}).code,'HORIZONTAL_REQUIRED'));
test('vertical semantic broll allowed',()=>{
 for(const model of ['ugc_natif','impact','alex']){
 const p=applyV19Safety({model,width:512,height:910,timeline:{brollCues:[{}]}});
 assert.equal(p.ok,true);assert.equal(p.timeline.brollCues.length,1);
 }
});
test('reject forced aspect distortion',()=>assert.equal(checkV19Format({model:'impact',width:512,height:910,outputFormat:'landscape'}).code,'REQUIRES_CROP_OR_PADDING'));
