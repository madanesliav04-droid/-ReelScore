import test from 'node:test';
import assert from 'node:assert/strict';
import {reviewCreativeTimeline,preflightBrollProposal} from '../src/creative-quality-gate.js';

// Representative edit-timeline excerpts measured from actual IMG_0533 (39.6s original, 34.63s edited).
// These are NOT newly invented dialogue; the master asset remains the source of truth.
const captions=[
 {startMs:0,endMs:1260,text:'Il y a une chose que beaucoup'},
 {startMs:1260,endMs:3200,text:'de personnes découvrent beaucoup trop tard'},
 {startMs:3200,endMs:5220,text:'tu peux etre vraiment bon dans un domaine'},
 {startMs:5300,endMs:6660,text:'mais quand meme rester a zero'},
 {startMs:6740,endMs:8020,text:'Je t explique pourquoi'},
 {startMs:8400,endMs:10500,text:'La realite c est que tres souvent on se cache'},
 {startMs:10900,endMs:12700,text:'je me forme encore'},
 {startMs:13400,endMs:14900,text:'je peaufine mon travail'},
 {startMs:17200,endMs:19100,text:'resoudre ce probleme'},
 {startMs:19140,endMs:22500,text:'va aider les personnes qui ont besoin de toi'},
 {startMs:25000,endMs:27000,text:'resoudre leurs problematiques'},
 {startMs:27500,endMs:29200,text:'bon vendeur crois moi'},
 {startMs:29400,endMs:31600,text:'toucher les coeurs des gens'},
 {startMs:31900,endMs:34600,text:'aider cette personne la puis la prochaine personne'}
];
const timeline={sourceAspect:910/512,outputDurationMs:34633,captions,style:'v15_b'};

test('IMG_0533: rejects the old three uninstructive library cutaways',()=>{
 const broll=[
  {startMs:4200,endMs:5200,query:'man wearing glasses at computer screen',visualAnchor:'man watching screen'},
  {startMs:10900,endMs:12400,query:'typing laptop at desk',visualAnchor:'hands typing on keyboard'},
  {startMs:19300,endMs:21000,query:'business meeting',visualAnchor:'people with laptops at office'}
 ];
 const out=reviewCreativeTimeline({timeline,brollCues:broll});
 assert.equal(out.brollCues.length,0);
 assert.equal(out.rejected.filter(x=>x.kind==='broll').length,3);
});

test('IMG_0533: a concrete learning demonstration is permitted, but not obligatory',()=>{
 const broll=[
  {startMs:11100,endMs:12900,query:'online course learning lesson on laptop',visualAnchor:'training course'},
  {startMs:19300,endMs:21000,query:'mentor helping a student solve a problem',visualAnchor:'coaching demonstrating solution'}
 ];
 const out=reviewCreativeTimeline({timeline,brollCues:broll});
 assert.equal(out.brollCues.length,2);
 assert.equal(out.audit.brollAccepted,2);
});

test('IMG_0533: rejects MAITRISE card and permits tiny meaningful symbol only',()=>{
 const graphicCues=[
  {startMs:3500,endMs:4800,text:'EXPERTISE MAITRISE',mode:'impact',screenAreaRatio:.19},
  {startMs:5530,endMs:6150,kind:'zero',symbol:'0',mode:'organic',screenAreaRatio:.04},
  {startMs:7000,endMs:7600,kind:'why',symbol:'?',mode:'organic',screenAreaRatio:.02},
  {startMs:29500,endMs:30800,kind:'heart',symbol:'♥',mode:'organic',screenAreaRatio:.04}
 ];
 const out=reviewCreativeTimeline({timeline,graphicCues});
 // The question follows zero by only 850 ms: it is grounded but too dense.
 assert.equal(out.graphicCues.length,2);
 assert.deepEqual(out.graphicCues.map(x=>x.kind),['zero','heart']);
 assert.ok(out.rejected.some(x=>x.reason==='GRAPHICS_TOO_DENSE'));
 assert.ok(out.rejected.some(x=>x.reason==='OVERSIZED_UI_COVERS_SCENE'));
});

test('IMG_0533: preflight prohibits generic stock before expensive retrieval',()=>{
 const generic=preflightBrollProposal({cue:{startMs:11100,endMs:12900,query:'typing laptop at desk'},captions});
 const helpful=preflightBrollProposal({cue:{startMs:11100,endMs:12900,query:'real online training class tutorial'},captions});
 assert.deepEqual(generic,{eligible:false,reason:'GENERIC_STOCK'});
 assert.equal(helpful.eligible,true);
});
