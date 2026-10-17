import test from 'node:test';
import assert from 'node:assert/strict';
import {gateSemanticVisual,reviewSemanticStoryboard} from '../src/hyperframes-story-first-gate.js';

const sourceDurationMs=44500;
const keepRanges=[
 {startMs:0,endMs:3790},{startMs:5520,endMs:7670},
 {startMs:8200,endMs:9990},{startMs:10770,endMs:14640},
 {startMs:15820,endMs:16880},{startMs:17960,endMs:43780}
];
const alignment={verified:true,method:'forced_word_alignment'};
const words=[
 {text:'comment',startMs:10970,endMs:11210},
 {text:'gagner',startMs:11220,endMs:11500},
 {text:'de',startMs:11510,endMs:11620},
 {text:"l'argent",startMs:11630,endMs:11930},
 {text:'tu',startMs:21520,endMs:21620},
 {text:'dois',startMs:21635,endMs:21795},
 {text:'aider',startMs:21820,endMs:22090},
 {text:"quelqu'un",startMs:22100,endMs:22420},
 {text:'pour',startMs:22900,endMs:23080},
 {text:'résoudre',startMs:23100,endMs:23410},
 {text:'un',startMs:23420,endMs:23500},
 {text:'problème',startMs:23510,endMs:23930}
];
test('Regression: a human/help visual cannot appear during the earlier money question',()=>{
 const out=gateSemanticVisual({
   event:{id:'early-person',kind:'object',spokenEvidence:"aider quelqu'un",sourceEndMs:24400,
     // This previous timeline suggestion at 12.7s MUST NOT be trusted:
     suggestedStartMs:12700},
   words,alignment,sourceDurationMs,keepRanges
 });
 assert.equal(out.accepted,true);
 assert.equal(out.semanticIntroducedAtMs,21820);
 assert.equal(out.sourceStartMs,21910);
 assert.ok(out.sourceStartMs>12700);
 assert.ok(out.outputStartMs>0);
});
test('Remove early animation entirely when no speech-aligned transcript exists',()=>{
 const out=gateSemanticVisual({
   event:{id:'early-person',kind:'object',spokenEvidence:"aider quelqu'un"},
   words:[],alignment:null,sourceDurationMs,keepRanges
 });
 assert.equal(out.accepted,false);
 assert.equal(out.reason,'VERIFIED_WORD_ALIGNMENT_MISSING');
});
test('A visually attractive paraphrase is insufficient as proof',()=>{
 const out=gateSemanticVisual({
   event:{id:'help',kind:'diagram',spokenEvidence:"aider les autres",sourceEndMs:24400},
   words,alignment,sourceDurationMs,keepRanges
 });
 assert.equal(out.accepted,false);
 assert.equal(out.reason,'PHRASE_NOT_SPOKEN');
});
test('A source word removed by a cut cannot trigger a visual',()=>{
 const out=gateSemanticVisual({
   event:{id:'money',kind:'object',spokenEvidence:'comment gagner',sourceEndMs:11800},
   words,alignment,sourceDurationMs,keepRanges:[{startMs:12000,endMs:44500}]
 });
 assert.equal(out.accepted,false);
 assert.equal(out.reason,'ANCHOR_REMOVED_BY_CUT');
});
test('No scene may fall back to generic voice onset and anticipate subject',()=>{
 const out=reviewSemanticStoryboard({
   events:[
     {id:'invalid',kind:'object',spokenEvidence:'the user has not said this',sourceEndMs:13200},
     {id:'valid',kind:'object',spokenEvidence:"aider quelqu'un",sourceEndMs:24400}
   ],
   words,alignment,sourceDurationMs,keepRanges
 });
 assert.equal(out.held.length,1);
 assert.equal(out.accepted.length,1);
 assert.equal(out.policy,'NO_SEMANTIC_VISUAL_BEFORE_SPOKEN_EVIDENCE');
});
