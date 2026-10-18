import test from 'node:test';
import assert from 'node:assert/strict';
import {EDIT_STYLES,describeEditActions,buildEditTimeline} from '../src/edit.js';
import {buildSocialKineticV28Plan,socialKineticV28Html,SOCIAL_KINETIC_V28_STYLE} from '../src/social-kinetic-v28-engine.js';
import {renderSocialKineticV28Staging} from '../src/social-kinetic-v28-runtime.js';

const originalWords=[
 ['Tu',200,360],['peux',400,590],['gagner',700,960],['du',1000,1170],
 ['temps',1200,1510],['et',1750,1960],['aider',2200,2480],
 ['les',2520,2700],['gens.',2750,3050]
].map(([text,startMs,endMs])=>({text,startMs,endMs}));
const safeRect=(rect)=>({
 source:'independent_frame_sampler',verified:true,rect,
 frames:Array.from({length:38},(_,i)=>({
  ms:i*200,confidence:.995,subjectOverlap:false,protectedContentOverlap:false
 }))
});
const captionProof=Object.fromEntries(Array.from({length:15},(_,i)=>
 ['caption-'+i,safeRect({x:.05,y:.64,w:.42,h:.22})]));
const timeline={keepRanges:[{startMs:0,endMs:8000}],outputDurationMs:8000,
 export:{width:910,height:512},audio:{hasAudio:true}};
const analysis={
 measurable:{durationSec:8,width:910,height:512,audioCodec:'aac'},
 transcript:{words:originalWords,alignment:{verified:true,method:'provider_word_timestamps',
 source:'gemini_interactions_word_info'}}
};
const frames={...captionProof,'bubble-one':safeRect({x:.61,y:.28,w:.34,h:.20})};
const events=[{id:'bubble-one',kind:'bubble',phrase:'gagner du temps',text:'gagner du temps'}];

test('V28 is a distinct actual Edit+ style, without changing legacy model',()=>{
 assert.ok(EDIT_STYLES.social_kinetic_v28);
 assert.ok(EDIT_STYLES.social_kinetic);
 assert.equal(describeEditActions('social_kinetic_v28').model,'social_kinetic_v28');
 assert.equal(EDIT_STYLES.social_kinetic_v28.captions,'social_kinetic');
 assert.equal(EDIT_STYLES.social_kinetic_v28.broll.maxPer30s,0);
 const t=buildEditTimeline({analysis,style:'social_kinetic_v28',format:'native',
  sourceWidth:910,sourceHeight:512});
 assert.equal(t.modelId,'social_kinetic_v28');
 assert.equal(t.width,910);
 assert.equal(t.height,512);
});
test('V28 sources bullet from real phrase and verified timing',()=>{
 const plan=buildSocialKineticV28Plan({analysis,timeline,frameProof:frames,editorialEvents:events});
 assert.equal(plan.status,'staging_renderable',JSON.stringify(plan.held));
 assert.equal(plan.model,'social_kinetic_v28');
 assert.equal(plan.releaseApproved,false);
 const bubbles=plan.events.filter(x=>x.kind==='bubble');
 assert.equal(bubbles.length,1);
 assert.equal(bubbles[0].text,'gagner du temps');
 assert.ok(Math.abs(bubbles[0].startMs-700)<5);
 const html=socialKineticV28Html(plan,{width:910,height:512});
 assert.match(html,/data-composition-id="editplus-social-kinetic-v28-native"/);
 assert.match(html,/#0C63BC/);
 assert.match(html,/#2E5F34/);
 assert.match(html,/GAGNER DU TEMPS/);
 assert.match(html,/window.__timelines/);
 assert.doesNotMatch(html,/APPRENDRE QUELQUE CHOSE|PRÊTES À TE PAYER/);
});
test('V28 refuses unverified words or missing face/hand safety proof',()=>{
 const unverified={...analysis,transcript:{...analysis.transcript,alignment:null}};
 assert.equal(buildSocialKineticV28Plan({analysis:unverified,timeline,frameProof:frames,
  editorialEvents:events}).status,'blocked');
 const missing=buildSocialKineticV28Plan({analysis,timeline,frameProof:{},
  editorialEvents:events});
 assert.equal(missing.status,'blocked');
 assert.throws(()=>socialKineticV28Html(missing,{width:910,height:512}),/VERIFIED_SCENE_REQUIRED/);
});
test('V28 never invents financial amounts or unspoken message text',()=>{
 const list=[
  ...events,
  {id:'fake-euros',kind:'metric',phrase:'3000 euros',text:'3 000 €'},
  {id:'fake-bubble',kind:'bubble',phrase:'gagner du temps',text:'Garantie 5 000 €'}
 ];
 const proof={...frames,'fake-euros':safeRect({x:.6,y:.1,w:.35,h:.2}),
  'fake-bubble':safeRect({x:.6,y:.1,w:.35,h:.2})};
 const plan=buildSocialKineticV28Plan({analysis,timeline,frameProof:proof,editorialEvents:list});
 assert.ok(plan.events.every(e=>!e.text.includes('3000')&&!e.text.includes('5 000')));
 assert.ok(plan.held.some(e=>e.reason==='UNSPOKEN_EDITORIAL_TEXT'));
 assert.ok(plan.held.some(e=>e.reason==='UNVERIFIED_MESSAGE'));
});
test('V28 renderer does not bypass staging and HyperFrames release gates',async()=>{
 const prev=process.env.ENABLE_SOCIAL_KINETIC_V28;
 try{
  delete process.env.ENABLE_SOCIAL_KINETIC_V28;
  await assert.rejects(renderSocialKineticV28Staging({}),/SOCIAL_KINETIC_V28_NOT_ENABLED/);
  process.env.ENABLE_SOCIAL_KINETIC_V28='staging';
  const before=process.env.ENABLE_HYPERFRAMES_RENDER;
  try{
   delete process.env.ENABLE_HYPERFRAMES_RENDER;
   await assert.rejects(renderSocialKineticV28Staging({}),/HYPERFRAMES_REQUIRED/);
  }finally{
   if(before===undefined)delete process.env.ENABLE_HYPERFRAMES_RENDER;
   else process.env.ENABLE_HYPERFRAMES_RENDER=before;
  }
 }finally{
  if(prev===undefined)delete process.env.ENABLE_SOCIAL_KINETIC_V28;
  else process.env.ENABLE_SOCIAL_KINETIC_V28=prev;
 }
});
