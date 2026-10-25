import test from 'node:test';
import assert from 'node:assert/strict';
import {editorialIndicators,EDITORIAL_VERSION} from './editorial-analysis.mjs';
const report={fingerprint:'source-hash',engineVersion:'acoustic-test',metadata:{durationMs:15000,width:640,height:360,hasAudio:true},meanVolumeDb:-28,peakVolumeDb:-.01,suggestions:[{startMs:4000,endMs:5000}],criteria:{voiceLevel:{score:85}}};
test('editorial indicators quote timed source words and cannot invent semantic, retention or originality scores',()=>{
 const transcript={reviewed:false,engineVersion:'test-asr',words:[{text:'Comment',startMs:1800,endMs:2200,probability:.9},{text:'commentez',startMs:12500,endMs:13000,probability:.6}]};
 const result=editorialIndicators(report,transcript);
 assert.equal(result.engineVersion,EDITORIAL_VERSION);assert.deepEqual(result,editorialIndicators(structuredClone(report),structuredClone(transcript)));
 assert.equal(result.globalEditorialScore,null);assert.equal(result.criteria.retention.score,null);assert.equal(result.criteria.originality.status,'not_evaluable');assert.equal(result.criteria.visuals.status,'not_evaluable');
 assert.ok(result.findings.some(f=>f.id==='opening-delay'&&f.endMs===1800));
 const cta=result.findings.find(f=>f.id==='cta-marker-found');assert.equal(cta.evidence,'commentez');assert.equal(cta.startMs,12500);assert.equal(cta.provisional,true);
 assert.ok(result.findings.every(f=>f.what&&f.why&&f.how&&f.verify&&Number.isFinite(f.startMs)&&Number.isFinite(f.endMs)));
 assert.equal(result.reviewItems.length,1);assert.equal(result.cost.externalPaidCalls,0);
 assert.notEqual(result.inputHash,editorialIndicators(report,transcript,{goal:'leads'}).inputHash);
});
test('missing transcript and malformed timings fail honestly, measured audio remains separate',()=>{
 const result=editorialIndicators(report,null);assert.equal(result.criteria.hook.status,'not_evaluable');assert.equal(result.criteria.cta.status,'not_evaluable');assert.equal(result.criteria.audio.score,85);
 assert.ok(!result.findings.some(f=>f.criterion==='cta'));
 assert.throws(()=>editorialIndicators(report,{words:[{text:'wrong',startMs:20,endMs:10}]}),{code:'EDITORIAL_TIMING'});
});
