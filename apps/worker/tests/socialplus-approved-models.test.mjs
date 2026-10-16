import test from 'node:test';
import assert from 'node:assert/strict';
import {EDIT_STYLES,buildEditTimeline,describeEditActions} from '../src/edit.js';
import {renderSocialKineticAss} from '../src/social-kinetic-v1.js';
import {renderHormoziOmniAss} from '../src/hormozi-omni-render.js';

const analysis={
 measurable:{durationSec:5.2,width:1280,height:720,audioCodec:'aac',silenceWindows:[]},
 transcript:{text:'Pour savoir si une idée plaît, regarde les questions, pas les likes.',words:[
  {text:'Pour',startMs:0,endMs:290},{text:'savoir',startMs:350,endMs:720},
  {text:'si',startMs:750,endMs:850},{text:'une',startMs:900,endMs:1050},
  {text:'idée',startMs:1080,endMs:1380},{text:'plaît,',startMs:1400,endMs:1750},
  {text:'regarde',startMs:1870,endMs:2300},
  {text:'les',startMs:2330,endMs:2480},
  {text:'questions,',startMs:2510,endMs:3120},
  {text:'pas',startMs:3270,endMs:3420},
  {text:'les',startMs:3490,endMs:3610},
  {text:'likes.',startMs:3700,endMs:4250}
 ]},
 timeline:[]
};
test('approved models are distinct real rendering contracts',()=>{
 assert.ok(EDIT_STYLES.codie);
 assert.ok(EDIT_STYLES.social_kinetic);
 assert.ok(EDIT_STYLES.hormozi_omni);
 assert.notEqual(describeEditActions('social_kinetic').model,describeEditActions('hormozi_omni').model);
 assert.notEqual(EDIT_STYLES.social_kinetic.captions,EDIT_STYLES.hormozi_omni.captions);
});
test('Hormozi preserve native 16:9 even when portrait selected',()=>{
 const result=buildEditTimeline({analysis,style:'hormozi_omni',format:'portrait'});
 assert.equal(result.modelId,'hormozi_omni');
 assert.equal(result.export.width,1280);
 assert.equal(result.export.height,720);
 assert.equal(result.sourceFramePreservation.enabled,true);
 assert.equal(result.sourceFramePreservation.cropAllowed,false);
});
test('Social Kinetic does not hallucinate inserts when video evidence absent',()=>{
 const result=buildEditTimeline({analysis,style:'social_kinetic',format:'native'});
 assert.equal(result.modelId,'social_kinetic');
 assert.equal(result.graphicCues.length,0);
 assert.equal(result.brollCues.length,0);
 assert.equal(result.captionPreset,'social_kinetic');
});
test('renderers emit compatible ASS even without unsupported evidence',()=>{
 assert.match(renderSocialKineticAss({graphicCues:[]},1280,720),/\[Events\]/);
 assert.match(renderHormoziOmniAss({graphicCues:[]},1280,720),/\[Events\]/);
});
