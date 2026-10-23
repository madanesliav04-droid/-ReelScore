import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveOmniTypography} from '../src/omni-style-system.js';
import {buildCaptionAss} from '../src/render.js';
import {auditOmniCodieModel} from '../src/omni-codie-quality-contract.js';
const style=resolveOmniTypography('codie',{textColor:'#ffffff'});
test('Codie Avenir-reference captions stay centred and visible in native landscape',()=>{
 assert.equal(style.safeCaptionPlacement,'omni_bottom_center_adaptive');
 const tl={captionConfig:style,captions:[{startMs:0,endMs:1200,text:'Une idée qui compte'}]};
 const ass=buildCaptionAss(tl,910,512);
 assert.match(ass,/Style: Default,Inter Display,/);
 const styleLine=ass.split('\n').find(x=>x.startsWith('Style: Default,'));
 assert.match(styleLine,/,2,60,60,42,1$/);
 assert.match(ass,/Une idée qui compte/);
});
test('Codie subtitles leave wider bottom padding for portrait social controls',()=>{
 const tl={captionConfig:style,captions:[{startMs:200,endMs:800,text:'Parle aux gens'}]};
 const line=buildCaptionAss(tl,1080,1920).split('\n').find(x=>x.startsWith('Style: Default,'));
 assert.match(line,/,2,60,60,298,1$/);
});
test('two or three b-rolls are an artistic target, never a license to invent stock',()=>{
 const timeline={style:'codie',captionConfig:style,cutReview:{accepted:[],held:[]},
  captions:[{startMs:0,endMs:1200,text:'bonjour'}],graphicCues:[],brollCues:[]};
 let r=auditOmniCodieModel({timeline});
 assert.equal(r.commercialReady,false);
 assert.ok(r.warnings.includes('INSUFFICIENT_CONTEXTUAL_BROLL'));
 const b={startMs:2000,endMs:3400,visualAnchor:'real product',creativeEvidence:'speech_window_plus_shot_metadata'};
 r=auditOmniCodieModel({timeline:{...timeline,brollCues:[b,{...b,startMs:6000,endMs:7900}]}});
 assert.equal(r.observed.brollCount,2);
 assert.ok(!r.warnings.includes('INSUFFICIENT_CONTEXTUAL_BROLL'));
 assert.ok(r.warnings.includes('HUMAN_VISUAL_AND_LISTENING_APPROVAL_REQUIRED'));
});
test('no readiness claim from count alone or unsupported matching metadata',()=>{
 const bad={startMs:2000,endMs:3300,query:'generic office'};
 const t={modelId:'codie',captionConfig:style,cutReview:{accepted:[],held:[]},
  captions:[{startMs:0,endMs:1200,text:'bonjour'}],
  graphicCues:[],brollCues:[bad,{...bad,startMs:4100,endMs:5900}]};
 const r=auditOmniCodieModel({timeline:t});
 assert.equal(r.commercialReady,false);
 assert.ok(r.warnings.includes('UNVERIFIED_BROLL_RELEVANCE'));
 assert.ok(r.warnings.includes('BROLL_INSUFFICIENT_VISUAL_BREATHING_ROOM'));
});
