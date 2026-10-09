import test from 'node:test';
import assert from 'node:assert/strict';
import {adaptivePlan,STYLES} from './adaptive-director.mjs';
const utterances=[
 'Can we guarantee results?',
 'But nobody can guarantee a perfect result.',
 'First we check the promise.',
 'Next we examine the price of 150 euros.',
 'Person A works 2 hours versus Person B working 4 hours.',
 'Finally I show you the actual dashboard.'
];
let time=300;
const words=utterances.flatMap(s=>{
 const list=s.split(' ').map(text=>{const w={text,startMs:time,endMs:time+220};time+=260;return w;});
 time+=540;return list;
});
const source={sourceId:'synthetic-test',durationMs:20000,words};
const kinds=p=>[...new Set(p.actions.filter(a=>a.type!=='caption').map(a=>a.type))].sort().join(',');
test('all six styles generate grounded and substantively different actions',()=>{
 const names=Object.keys(STYLES);
 assert.deepEqual(names,['codie','leila','impact','clean','explainer','ugc_native']);
 const plans=names.map(style=>adaptivePlan({...source,style}));
 assert.ok(plans.every(p=>p.audit.wordAccurate));
 assert.ok(plans.every(p=>p.actions.every(a=>a.evidence?.text&&a.endMs<=p.durationMs)));
 assert.equal(new Set(plans.map(kinds)).size,6,JSON.stringify(plans.map(kinds)));
 assert.ok(plans[1].actions.some(a=>a.type==='executive-diagram'));
 assert.ok(plans[2].actions.some(a=>a.type==='impact-emphasis'));
 assert.ok(plans[4].actions.some(a=>a.type==='demonstration'));
 assert.ok(plans.every(p=>!p.actions.some(a=>a.type==='verified-broll')));
});
test('Leila spoken diagrams never invent numbers or formulae',()=>{
 const p=adaptivePlan({...source,style:'leila'});
 const diagrams=p.actions.filter(a=>a.type==='executive-diagram');
 assert.ok(diagrams.length>0);
 assert.ok(diagrams.every(x=>x.figures.every(n=>x.evidence.text.includes(n))));
 assert.ok(diagrams.every(x=>!('calculatedResult' in x)));
});
test('no words/segments means no invented editorial choices',()=>{
 const p=adaptivePlan({style:'impact',durationMs:30000});
 assert.equal(p.actions.length,0);
 assert.ok(p.audit.warnings.includes('NO_TRANSCRIPT_NO_EDITORIAL_ACTIONS'));
});
test('segment-only evidence is never labeled word-accurate',()=>{
 const p=adaptivePlan({style:'leila',durationMs:10000,segments:[{text:'Compare 100 euros versus 200 euros',startSeconds:1,endSeconds:8}]});
 assert.equal(p.audit.wordAccurate,false);
 assert.ok(p.audit.warnings.includes('SEGMENT_TIMING_NOT_FRAME_ACCURATE'));
});
test('verified and licensed media only',()=>{
 const asset={assetId:'owned_clip',spokenAnchor:'dashboard',licensed:true,verified:true};
 const bad=adaptivePlan({...source,style:'explainer',verifiedMedia:[{...asset,verified:false}]});
 const good=adaptivePlan({...source,style:'explainer',verifiedMedia:[asset]});
 assert.ok(!bad.actions.some(a=>a.type==='verified-broll'));
 assert.ok(good.actions.some(a=>a.type==='verified-broll'));
});
