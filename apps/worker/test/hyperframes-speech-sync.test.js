import test from 'node:test';
import assert from 'node:assert/strict';
import {validateSpeechWords,findSpokenPhrase,mapSourceToOutput,resolveMotionTrigger} from '../src/hyperframes-speech-sync.js';

const keep=[[0,3790],[5520,7670],[8200,9990],[10770,14640],[15820,16880],[17960,43780]];
const words=[
  {text:'aider',startMs:21520,endMs:21820},
  {text:'les',startMs:21830,endMs:21950},
  {text:'autres',startMs:21960,endMs:22350},
  {text:'créer',startMs:25960,endMs:26250},
  {text:'de',startMs:26260,endMs:26360},
  {text:'la',startMs:26370,endMs:26450},
  {text:'valeur',startMs:26460,endMs:26720}
];
const verified={verified:true,method:'forced_word_alignment'};
test('word-based cues are anchored to verified speech',()=>{
  const x=findSpokenPhrase({words,phrase:'AIDER LES AUTRES',alignment:verified,durationMs:44500});
  assert.equal(x.status,'verified');assert.equal(x.match.startMs,21520);
  const y=resolveMotionTrigger({words,phrase:'créer de la valeur',alignment:verified,
    durationMs:44500,keepRanges:keep,latencyMs:80});
  assert.equal(y.status,'word_verified');
  assert.equal(y.sourceMs,26040);
  assert.ok(y.outputMs>0);
});
test('no invented word-level fidelity',()=>{
  const x=resolveMotionTrigger({words,phrase:'aider les autres',alignment:null,
    durationMs:44500,keepRanges:keep,acousticAnchorMs:21456});
  assert.equal(x.status,'speech_fallback_unverified');
  assert.equal(x.confidence,'approximate');
  assert.match(x.warning,/word timestamps/);
});
test('no words, no invented subtitles',()=>{
  const x=resolveMotionTrigger({phrase:'un texte non prononcé',words:[],
    durationMs:44500,keepRanges:keep});
  assert.equal(x.status,'blocked');assert.equal(x.outputMs,null);
});
test('trimmed times remap deterministically',()=>{
  assert.equal(mapSourceToOutput(1000,keep),1000);
  assert.equal(mapSourceToOutput(5600,keep),3870);
  assert.equal(mapSourceToOutput(4300,keep),null);
});
test('invalid timestamps and fake verification are rejected',()=>{
  assert.equal(validateSpeechWords([{text:'test',startMs:1500,endMs:600}],{durationMs:2000,alignment:verified}).status,'unverified');
  assert.equal(findSpokenPhrase({words,phrase:'aider les autres',alignment:{verified:true,method:'manual'},durationMs:44500}).status,'unverified');
});
