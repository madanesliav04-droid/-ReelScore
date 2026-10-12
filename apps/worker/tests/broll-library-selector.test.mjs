import test from 'node:test';
import assert from 'node:assert/strict';
import {rankDownloadedBroll,planLocalBrollInserts} from '../src/broll-library-selector.js';
const clips=[
 {id:'MX-1',status:'asset_ready',asset_path:'clips/1.mp4',sha256:'abc',duration_sec:8,title:'man texting on whatsapp',intent:['interaction']},
 {id:'MX-2',status:'asset_ready',asset_path:'clips/2.mp4',sha256:'def',duration_sec:10,title:'person scrolling social media smartphone',intent:['interaction']},
 {id:'MX-3',status:'asset_ready',asset_path:'clips/3.mp4',sha256:'ghi',duration_sec:10,title:'counting cash money banknotes',intent:['finance']},
 {id:'MX-4',status:'reference_discovered',duration_sec:null,title:'woman writing a message',intent:['interaction']}
];
test('returns only verified source files',()=>assert.ok(rankDownloadedBroll({text:'sur instagram des likes',items:clips}).every(x=>x.sha256&&x.asset_path)));
test('matches explicit WhatsApp discussion',()=>assert.equal(rankDownloadedBroll({text:'message whatsapp',items:clips})[0]?.id,'MX-1'));
test('matches Instagram to filmed scrolling',()=>assert.equal(rankDownloadedBroll({text:'likes instagram',items:clips})[0]?.id,'MX-2'));
test('matches earnings only as illustrative finance scene',()=>assert.equal(rankDownloadedBroll({text:'argent euros',items:clips})[0]?.id,'MX-3'));
test('rejects abstract motivational text',()=>assert.equal(rankDownloadedBroll({text:'la motivation est une opportunité',items:clips}).length,0));
test('does not use undownloaded references',()=>assert.deepEqual(rankDownloadedBroll({text:'message whatsapp',items:[clips[3]]}),[]));
test('inserts cap by model',()=>{
 const r=planLocalBrollInserts({items:clips,durationMs:26000,style:'codie',segments:[
  {text:'les likes instagram',startMs:3200,endMs:5000},
  {text:'message whatsapp',startMs:9700,endMs:12100},
  {text:'argent euros',startMs:17800,endMs:20100}
 ]});
 assert.equal(r.cues.length,2);
 assert.ok(r.cues.every(x=>x.creative_review_required));
});
test('no visual if no concrete evidence',()=>assert.equal(planLocalBrollInserts({items:clips,durationMs:9000,segments:[{text:'c’est important',startMs:2100,endMs:4000}]}).cues.length,0));
