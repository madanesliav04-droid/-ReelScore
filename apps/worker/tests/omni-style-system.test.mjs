import test from 'node:test';
import assert from 'node:assert/strict';
import {OMNI_TYPE_STYLES,resolveOmniTypography,proposeOmniBubblePairs} from '../src/omni-style-system.js';
import {buildOmniBubblesAss} from '../src/omni-bubbles-render.js';
import {reviewCreativeTimeline,projectedGraphicArea} from '../src/creative-quality-gate.js';
const names=['codie','impact','clean','authority','explainer','data','ugc_native','cinematic_story'];
test('all eight user-selected Pinterest typeface references reach subtitle render settings',()=>{
 assert.equal(Object.keys(OMNI_TYPE_STYLES).length,8);
 const signatures=new Set();
 for(const name of names){
  const v=resolveOmniTypography(name,{textColor:'#ffffff'});
  assert.equal(v.referenceTypeface,OMNI_TYPE_STYLES[name].reference);
  assert.equal(v.fontFamily,OMNI_TYPE_STYLES[name].preview);
  assert.equal(v.typefaceVerification,'preview_substitute_not_exact_reference');
  assert.equal(v.background,false);
  assert.equal(v.textColor,'#ffffff');
  signatures.add([v.fontFamily,v.fontSize,v.maxWordsPerLine,v.position].join('|'));
 }
 assert.equal(signatures.size,8);
 assert.equal(resolveOmniTypography('creator_clean').referenceTypeface,'Optima');
});
const words=[
 {startMs:1400,endMs:1710,text:'zéro'},
 {startMs:10100,endMs:10450,text:'résoudre'},
 {startMs:22000,endMs:22300,text:'cœurs'}
];
test('OMNI bubbles are three real spoken-anchored pairs, not stock emojis',()=>{
 const cues=proposeOmniBubblePairs({words,durationMs:34500,sourceAspect:910/512,enabled:true});
 assert.deepEqual(cues.map(c=>c.kind),['zero','solution','heart']);
 assert.equal(new Set(cues.flatMap(c=>c.icons)).size,6);
 assert.ok(cues.every(c=>c.evidence==='timed_transcript'&&c.layout==='lateral_symmetric'));
 assert.deepEqual(cues.map(c=>c.startMs),words.map(w=>w.startMs));
});
test('portrait or lack of independent face-safe approval means no automatic bubbles',()=>{
 assert.equal(proposeOmniBubblePairs({words,durationMs:34500,sourceAspect:.56,enabled:true}).length,0);
 assert.equal(proposeOmniBubblePairs({words,durationMs:34500,sourceAspect:1.8,enabled:false}).length,0);
});
test('vector ASS draws two paired bubbles and two icons per cue',()=>{
 const cues=proposeOmniBubblePairs({words,durationMs:34500,sourceAspect:910/512,enabled:true});
 const ass=buildOmniBubblesAss({graphicCues:cues},910,512);
 assert.equal(ass.split('\n').filter(s=>s.startsWith('Dialogue:')).length,12);
 assert.ok(ass.includes('\\p1')&&ass.includes('\\move('));
 assert.equal(buildOmniBubblesAss({graphicCues:cues},512,910),'');
});
test('creative gate refuses invented icon pairs and accepts grounded placements',()=>{
 const cues=proposeOmniBubblePairs({words,durationMs:34500,sourceAspect:910/512,enabled:true});
 const timeline={outputDurationMs:34500,width:910,height:512,
  captions:words.map(w=>({...w,text:w.text}))};
 const result=reviewCreativeTimeline({timeline,style:'codie',graphicCues:cues});
 assert.equal(result.graphicCues.length,3,JSON.stringify(result.rejected));
 assert.ok(projectedGraphicArea(cues[0],910,512)>0);
 const bad={...cues[0],icons:['spark','heart_solid']};
 const rejected=reviewCreativeTimeline({timeline,style:'codie',graphicCues:[bad]});
 assert.equal(rejected.graphicCues.length,0);
 assert.equal(rejected.rejected[0].reason,'UNVERIFIED_OMNI_BUBBLE');
});
