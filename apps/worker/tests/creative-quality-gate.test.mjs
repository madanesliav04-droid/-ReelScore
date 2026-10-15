import test from 'node:test';
import assert from 'node:assert/strict';
import {reviewCreativeTimeline,CREATIVE_GATE_VERSION} from '../src/creative-quality-gate.js';

function timeline({
 duration=40000,
 aspect=910/512,
 style='v15_b',
 captions=[
  {startMs:1800,endMs:3300,text:'Tu peux etre tres bon dans un domaine'},
  {startMs:5000,endMs:6500,text:'mais quand meme rester a zero'},
  {startMs:10000,endMs:12500,text:'Je me forme encore'},
  {startMs:18500,endMs:21400,text:'Je peux aider les personnes qui ont besoin de moi'},
  {startMs:25600,endMs:28300,text:'Tu dois toucher les coeurs des gens'},
  {startMs:33000,endMs:35800,text:'Tu peux gagner de l argent'}
 ]
}={}) {return {outputDurationMs:duration,sourceAspect:aspect,style,captions};}

const cue=(startMs,endMs,query,visualAnchor=query)=>({startMs,endMs,query,visualAnchor,sourcePage:'https://example.com/rights',license:'cc0'});

test('abstract expertise never licenses a stock office cutaway',()=>{
 const res=reviewCreativeTimeline({timeline:timeline(),brollCues:[cue(1800,3000,'business meeting expertise')]});
 assert.equal(res.brollCues.length,0);
 assert.equal(res.rejected[0].reason,'GENERIC_STOCK');
});

test('computer typing is not proof of learning',()=>{
 const res=reviewCreativeTimeline({timeline:timeline(),brollCues:[cue(10500,12200,'typing laptop at desk')]});
 assert.equal(res.brollCues.length,0);
 assert.equal(res.rejected[0].reason,'GENERIC_STOCK');
});

test('a clearly identifiable lesson matches learning only on spoken passage',()=>{
 const res=reviewCreativeTimeline({timeline:timeline(),brollCues:[
  cue(10100,12000,'online course training lesson on screen'),
  cue(2000,3700,'online course training lesson on screen')
 ]});
 assert.equal(res.brollCues.length,1);
 assert.equal(res.brollCues[0].startMs,10100);
 assert.ok(res.rejected.some(r=>r.reason==='NO_NARRATIVE_VISUAL_MATCH'));
});

test('a helping visual matches the helping phrase, but not a random earlier hook',()=>{
 const res=reviewCreativeTimeline({timeline:timeline(),brollCues:[
  cue(18900,21100,'mentor helping a person learn'),
  cue(2700,4500,'mentor helping a person learn')
 ]});
 assert.equal(res.brollCues.length,1);
 assert.equal(res.brollCues[0].startMs,18900);
});

test('unverified oversized mastery card is discarded',()=>{
 const res=reviewCreativeTimeline({timeline:timeline(),graphicCues:[
  {startMs:1800,endMs:3300,text:'EXPERTISE MAITRISE',mode:'impact'}
 ]});
 assert.equal(res.graphicCues.length,0);
 assert.equal(res.rejected[0].reason,'DECORATIVE_OR_UNSPOKEN_GRAPHIC');
});

test('verbatim spoken overlay may survive, without inventing a number',()=>{
 const res=reviewCreativeTimeline({timeline:timeline(),graphicCues:[
  {startMs:5100,endMs:6500,text:'rester a zero',mode:'impact'},
  {startMs:33000,endMs:34500,text:'10 000 EUROS',mode:'data',kind:'stat'}
 ]});
 assert.equal(res.graphicCues.length,1);
 assert.equal(res.graphicCues[0].text,'rester a zero');
 assert.ok(res.rejected.some(r=>r.reason==='DECORATIVE_OR_UNSPOKEN_GRAPHIC'));
});

test('no valid media produces a clean facecam, not mandatory rhythmic effects',()=>{
 const res=reviewCreativeTimeline({timeline:timeline(),brollCues:[],graphicCues:[]});
 assert.equal(res.brollCues.length,0);
 assert.equal(res.graphicCues.length,0);
 assert.equal(res.audit.nonActionIsValid,true);
 assert.equal(res.policy,CREATIVE_GATE_VERSION);
});

test('horizontal quota and adjacent cutaways are constrained',()=>{
 const m=timeline({duration:90000, captions:[
  {startMs:10500,endMs:12200,text:'je me forme encore'},
  {startMs:21000,endMs:24300,text:'je veux apprendre un cours'},
  {startMs:46500,endMs:48500,text:'je continue un cours de formation'},
  {startMs:70000,endMs:73000,text:'je veux apprendre un atelier'}
 ]});
 const r=reviewCreativeTimeline({timeline:m,brollCues:[
  cue(10500,12000,'online course lesson'),
  cue(12400,14400,'training workshop'),
  cue(21500,23500,'study notebook training'),
  cue(46900,48300,'tutorial learning course'),
  cue(70100,72100,'workshop study course')
 ]});
 assert.ok(r.brollCues.length<=4);
 assert.ok(r.rejected.some(x=>x.reason==='NO_NARRATIVE_VISUAL_MATCH'||x.reason==='BROLL_TOO_CLOSE'||x.reason==='BROLL_BUDGET_REACHED'));
});

test('refuses untimed transcript without inventing overlays',()=>{
 const r=reviewCreativeTimeline({timeline:{outputDurationMs:35000,sourceAspect:1.8,captions:[]},
 brollCues:[cue(1000,3000,'training lesson')],graphicCues:[{startMs:1000,endMs:3000,text:'lesson'}]});
 assert.equal(r.brollCues.length,0);
 assert.equal(r.graphicCues.length,0);
 assert.equal(r.audit.status,'held_no_transcript');
});

test('vertical format leaves more room for substantive B-roll than horizontal',()=>{
 const c=[
  {startMs:1000,endMs:2800,text:'je suis en formation etudie cours'},
  {startMs:8000,endMs:10200,text:'apprendre une nouvelle lecon'},
  {startMs:16000,endMs:18000,text:'j ai besoin d aide'},
  {startMs:24000,endMs:26000,text:'je veux payer euros argent'}
 ];
 const shots=[
  cue(1000,2800,'training course'),
  cue(8000,9800,'study lesson notebook'),
  cue(16200,17700,'coaching helping'),
  cue(24300,25700,'money coins euro')
 ];
 const h=reviewCreativeTimeline({timeline:timeline({aspect:16/9,captions:c}),brollCues:shots,style:'impact'});
 const v=reviewCreativeTimeline({timeline:timeline({aspect:9/16,captions:c}),brollCues:shots,style:'impact'});
 assert.ok(v.brollCues.length>h.brollCues.length);
});
