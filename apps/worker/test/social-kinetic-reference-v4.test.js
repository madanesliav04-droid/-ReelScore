import test from 'node:test';
import assert from 'node:assert/strict';
import {buildSocialKineticReferenceV4Plan,socialKineticReferenceV4Html}
 from '../src/social-kinetic-reference-v4.js';

const time=55000;
const transcript={
 words:[
  {text:'Il',startMs:0,endMs:160},
  {text:'existe',startMs:180,endMs:380},
  {text:'trois',startMs:400,endMs:660},
  {text:'façons',startMs:670,endMs:1000},
  {text:'de',startMs:1010,endMs:1100},
  {text:'générer',startMs:1100,endMs:1390},
  {text:'du',startMs:1400,endMs:1540},
  {text:'cash',startMs:1550,endMs:1850},
  {text:'Hey',startMs:10500,endMs:10700},
  {text:'ça',startMs:10710,endMs:10850},
  {text:'fait',startMs:10860,endMs:11000},
  {text:'quelques',startMs:11020,endMs:11300},
  {text:'mois',startMs:11320,endMs:11600},
  {text:'je',startMs:12000,endMs:12200},
  {text:'commence',startMs:12200,endMs:12600},
  {text:'les',startMs:12600,endMs:12800},
  {text:'résultats',startMs:12820,endMs:13100},
  {text:'3000€',startMs:46000,endMs:46500},
  {text:'1',startMs:48200,endMs:48300},
  {text:'mois',startMs:48320,endMs:48600},
  {text:'1000€',startMs:49800,endMs:50200}
 ],
 alignment:{verified:true,method:'provider_word_timestamps',
  source:'gemini_interactions_word_info',reviewedAgainstAudio:false}
};
const analysis={transcript,measurable:{width:910,height:512,audioCodec:'aac'}};
const timeline={sourceDurationMs:time,outputDurationMs:time,
 keepRanges:[{startMs:0,endMs:time}],export:{width:910,height:512},audio:{hasAudio:true}};
const proof=(start,end,rect={x:.58,y:.26,w:.36,h:.40})=>({
 source:'independent_frame_sampler',verified:true,
 safeRect:rect,
 frames:Array.from({length:Math.ceil((end-start)/400)+2},(_,i)=>({
  ms:start-100+i*400,confidence:.98,subjectOverlap:false
 }))
});
const events=[
 {id:'opening',kind:'hero',text:'3 FAÇONS',spokenEvidence:'trois façons',
  sourceEndMs:1550},
 {id:'firstmsg',kind:'chat',text:'Hey ça fait quelques mois',
  spokenEvidence:'Hey ça fait quelques mois',sourceEndMs:11600},
 {id:'amount',kind:'metric',text:'3000€',spokenEvidence:'3000€',
  sourceEndMs:47100}
];
const frameProof={
 opening:proof(400,1550),
 firstmsg:proof(10500,11600),
 amount:proof(46000,47100)
};
const build=(args={})=>buildSocialKineticReferenceV4Plan({
 analysis,timeline,editorialEvents:events,frameProof,...args
});
test('Observed social reference cues stay speech-led and camera-safe',()=>{
 const p=build();
 assert.equal(p.status,'staging_renderable');
 assert.equal(p.events.length,3);
 assert.deepEqual(p.events.map(e=>e.kind),['hero','chat','metric']);
 assert.equal(p.events[1].startMs,10500);
 assert.equal(p.audio,'source_only');
 assert.equal(p.releaseStatus,'REQUIRES_REAL_RUSH_VISUAL_AND_AUDIO_QA');
});
test('Missing independent face/hands tracking blocks every proposed visual',()=>{
 const p=build({frameProof:{}});
 assert.equal(p.status,'blocked');
 assert.equal(p.events.length,0);
 assert.equal(p.held.length,3);
});
test('Semantic visuals never reveal before the first word of spoken evidence',()=>{
 const p=build();
 for(const e of p.events) assert.ok(e.startMs>=e.sourceSpeechStartMs);
});
test('Cuts cannot misalign or prematurely move semantic graphics',()=>{
 const alt={...timeline,keepRanges:[{startMs:0,endMs:10000},{startMs:10500,endMs:time}],
 outputDurationMs:time-500};
 const p=build({timeline:alt});
 assert.equal(p.status,'staging_renderable');
 assert.equal(p.events[1].startMs,10000);
 assert.equal(p.events[2].startMs,45500);
 const drift=build({timeline:{...alt,outputDurationMs:time}});
 assert.equal(drift.status,'blocked');
 assert.equal(drift.reason,'CUT_TIMING_DRIFT');
});
test('Speech absent or repeated phrase not disambiguated holds the effect',()=>{
 const a=build({editorialEvents:[{
  id:'no',kind:'keyword',text:'INVENTÉ',spokenEvidence:'pas dit',
  sourceEndMs:4800
 }],frameProof:{no:proof(2000,4800)}});
 assert.equal(a.events.length,0);
 assert.equal(a.held[0].reason,'PHRASE_NOT_IN_SPEECH');
});
test('Nonverbatim blue chat without prior approval is rejected',()=>{
 const p=build({editorialEvents:[{
  id:'firstmsg',kind:'chat',text:'Fausse conversation',
  spokenEvidence:'Hey ça fait quelques mois',sourceEndMs:11600
 }]});
 assert.equal(p.status,'blocked');
 assert.equal(p.held[0].reason,'CHAT_NOT_VERBATIM_OR_APPROVED_EXAMPLE');
});
test('No Instagram interface and no boxed generic subtitle in HyperFrames',()=>{
 const p=build();
 const html=socialKineticReferenceV4Html(p,{width:1280,height:720});
 assert.match(html,/editplus-social-kinetic-reference-v4/);
 assert.match(html,/data-width="1280"/);
 assert.ok(!html.includes('instagram'));
 assert.ok(!html.includes('likes'));
 assert.ok(!html.includes('background:#000000'));
 assert.match(html,/bubble/);
 assert.match(html,/metric/);
 assert.match(html,/gsap.timeline/);
});
test('Text is escaped so a fake transcript cannot execute HTML',()=>{
 const p=build();
 p.events[0].text='<img src=x>';
 const html=socialKineticReferenceV4Html(p,{width:1280,height:720});
 assert.ok(!html.includes('<img src=x>'));
 assert.ok(html.includes('&lt;IMG SRC=X&gt;'));
});
