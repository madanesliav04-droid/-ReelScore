import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
import {codiePlan,captionAss,alignOriginalAudio} from './render-codie-v60.mjs';
const report={fingerprint:'unit-source',metadata:{hasAudio:true,width:910,height:512,durationMs:6000},suggestions:[]};
const words=[{text:'temps',startMs:500,endMs:900,probability:.99},{text:'argent.',startMs:3000,endMs:3500,probability:.99}];
test('Codie uses only source-bound timed evidence and preserves beta missing-insert status',()=>{const p=codiePlan(report,{words,sourceSha256:'unit-source'});assert.deepEqual(p.cues.map(x=>x.kind),['clock','euro']);assert.equal(p.fullModelRestored,false);assert.equal(p.captionStatus,'unreviewed_preview');assert.deepEqual(p,codiePlan(report,{words}));assert.throws(()=>codiePlan(report,{words,sourceSha256:'another-source'}));});
test('Uncertain words never authorize an icon; no guessed cue or portrait fallback',()=>{const p=codiePlan(report,{words:[{...words[0],probability:.2},words[1]]});assert.deepEqual(p.cues.map(x=>x.kind),['euro']);assert.throws(()=>codiePlan(report,{words:words.map(x=>({...x,probability:.1}))}));assert.throws(()=>codiePlan({...report,metadata:{...report.metadata,width:512,height:910}},{words}));});
test('Historical dialogue/timings do not enter newly generated ASS',async()=>{const header=await readFile(new URL('../engines/codie-v60-caption-header.ass',import.meta.url),'utf8');assert(!header.includes('Dialogue:'));const ass=captionAss(header,codiePlan(report,{words}));assert(ass.includes('SocialPlus Display SemiBold'));assert(ass.includes('temps'));assert(!ass.includes('Tu ne fais pas'));});

test('Audio alignment refuses source overwrite and invalid ranges before launching FFmpeg',async()=>{await assert.rejects(alignOriginalAudio('/same.mov','/same.mov',[{startMs:0,endMs:1000}]));await assert.rejects(alignOriginalAudio('/source.mov','/output.mp4',[{startMs:1000,endMs:0}]));});

test('Reviewed graphic directions are honored; unrelated icons and overlaps are rejected',()=>{
 const event={wordIndex:1,wordCount:1,kind:'euro',endMs:4800,rect:[.73,.1,.22,.34]};
 const p=codiePlan(report,{words},{events:[event],placementReviewed:true});assert.equal(p.cues.length,1);assert.equal(p.cues[0].kind,'euro');assert(p.cues[0].x>report.metadata.width/2);
 assert.throws(()=>codiePlan(report,{words},{events:[{...event,kind:'clock'}],placementReviewed:true}));assert.throws(()=>codiePlan(report,{words},{events:[event,event],placementReviewed:true}));assert.throws(()=>codiePlan(report,{words},{events:[event]}));
});
