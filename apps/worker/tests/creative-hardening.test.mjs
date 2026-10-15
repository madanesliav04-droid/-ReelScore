import test from 'node:test';
import assert from 'node:assert/strict';
import {CREATIVE_STYLE_PROFILES,projectedGraphicArea,reviewCreativeTimeline} from '../src/creative-quality-gate.js';

const eight=['codie','impact','clean','authority','explainer','data','ugc_native','cinematic_story'];
const base={width:1080,height:1920,outputDurationMs:60000,
 captions:[
  {startMs:1000,endMs:6900,text:'je veux apprendre avec cette formation'},
  {startMs:11000,endMs:16500,text:'je veux apprendre avec cette formation'},
  {startMs:24500,endMs:31000,text:'je veux apprendre avec cette formation'},
  {startMs:39000,endMs:44500,text:'je veux apprendre avec cette formation'}
 ]};
const shot=(startMs)=>({startMs,endMs:startMs+1800,query:'online training course lesson',visualAnchor:'real training course'});

test('eight customer-facing styles have independently tuned budgets',()=>{
 const signatures=eight.map(k=>{
  assert.ok(CREATIVE_STYLE_PROFILES[k],k);
  const {maxBrollPer30s,maxGraphicsPer30s,minGraphicGapMs,minBrollGapMs,maxGraphicArea}=CREATIVE_STYLE_PROFILES[k];
  assert.ok(maxGraphicArea>0&&maxGraphicArea<=.12,k);
  return JSON.stringify({maxBrollPer30s,maxGraphicsPer30s,minGraphicGapMs,minBrollGapMs,maxGraphicArea});
 });
 assert.equal(new Set(signatures).size,eight.length);
});

test('speaker-first Authority is less intrusive than Impact with identical valid shots',()=>{
 const shots=[shot(1200),shot(11500),shot(25000),shot(39800)];
 const impact=reviewCreativeTimeline({timeline:base,brollCues:shots,style:'impact'});
 const authority=reviewCreativeTimeline({timeline:base,brollCues:shots,style:'authority'});
 assert.equal(impact.brollCues.length,4);
 assert.equal(authority.brollCues.length,2);
});

test('a zero-sized declared graphic cannot bypass the renderer footprint estimate',()=>{
 const caption='POURQUOI '.repeat(15).trim();
 const t={...base,outputDurationMs:15000,captions:[{startMs:1000,endMs:10000,text:caption}]};
 const graphic={startMs:1800,endMs:6000,text:caption,mode:'impact',screenAreaRatio:0};
 const projected=projectedGraphicArea(graphic,1080,1920);
 assert.ok(projected>.10,projected);
 const result=reviewCreativeTimeline({timeline:t,graphicCues:[graphic],style:'impact'});
 assert.equal(result.graphicCues.length,0);
 assert.equal(result.rejected[0].reason,'OVERSIZED_UI_COVERS_SCENE');
 assert.match(result.audit.geometryPolicy,/not measured pixels/);
});

test('a small transcript-grounded organic icon becomes a renderable cue',()=>{
 const t={...base,captions:[{startMs:1000,endMs:3500,text:'Je te dis pourquoi maintenant'}]};
 const result=reviewCreativeTimeline({timeline:t,style:'codie',graphicCues:[
  {startMs:1500,endMs:2800,kind:'why',symbol:'?',mode:'organic',screenAreaRatio:.02}
 ]});
 assert.equal(result.graphicCues.length,1);
 assert.equal(result.graphicCues[0].text,'?');
 assert.equal(result.graphicCues[0].evidence,'timed_transcript');
});

test('portrait and landscape yield different projected text footprints',()=>{
 const graphic={text:'CETTE FORMATION',mode:'impact'};
 const portrait=projectedGraphicArea(graphic,1080,1920);
 const landscape=projectedGraphicArea(graphic,1920,1080);
 assert.ok(Number.isFinite(portrait)&&Number.isFinite(landscape));
 assert.notEqual(portrait,landscape);
});
