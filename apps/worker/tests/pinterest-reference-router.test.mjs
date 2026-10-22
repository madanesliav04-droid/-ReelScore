import test from 'node:test';import assert from 'node:assert/strict';
import {omniReferenceFamilies,selectOmniPinterestReferences,omniBrollAssetCandidates} from '../src/pinterest-reference-router.js';
const pin={items:[{id:'PINCAP-1',category_id:'TIME',source_type:'pinterest_screenshot_reference',
 usable_as_broll:false,description_verified:'reference_annotee',file:'capture.jpg'}]};
test('French spoken time is not confused with money',()=>{
 assert.deepEqual(omniReferenceFamilies('gagner du temps'),['TIME']);
 assert.ok(omniReferenceFamilies('gagner de l argent').includes('MONEY'));
});
test('Pinterest may recommend graphic references but can never be inserted as stock footage',()=>{
 const r=selectOmniPinterestReferences({speech:'gagner du temps',catalog:pin});
 assert.equal(r.length,1);assert.equal(r[0].status,'INSPIRATION_ONLY');
 assert.equal(r[0].renderAssetUrl,null);assert.equal(r[0].licenseValid,false);
});
test('unrelated speech cannot cause random graphic',()=>{
 assert.deepEqual(selectOmniPinterestReferences({speech:'bonjour',catalog:pin}),[]);
});
test('local MP4 is still a candidate only: source rights and actual clip relevance must be checked',()=>{
 const catalog={items:[{id:'MX-1',title:'phone scrolling',status:'asset_ready',
  provider:'Mixkit',file:'clips/MX-1.mp4',local_mp4_available:true,source_url:'https://mixkit.co/'},
  {id:'PIN-2',title:'phone scrolling',status:'asset_ready',
  provider:'Pinterest',file:'copied.jpg',local_mp4_available:true}]};
 const r=omniBrollAssetCandidates({speech:'phone scrolling',catalog});
 assert.equal(r.length,1);assert.equal(r[0].automaticallyInsert,false);
 assert.equal(r[0].licensedUseMustBeChecked,true);
});
