import test from 'node:test';
import assert from 'node:assert/strict';
import {durationOffsetMs,extractAsrWordAnnotations,validateTimedWords,semanticMatchesWords} from '../src/word-timing.js';
import {revealTimedWord} from '../remotion/word-reveal.js';
import {buildEditTimeline} from '../src/edit.js';
const annotation=(text,start,end)=>({type:'word_info',text,start_offset:start,end_offset:end});
const fixture={output_text:'Je veux aider les autres',steps:[{content:[
  {type:'not_text',annotations:[
    annotation('Je','0s','0.16s'),
    annotation('veux','0.17s','0.48s'),
    annotation('aider','0.49s','0.88s'),
    annotation('les','0.89s','1.13s'),
    annotation('autres','1.14s','1.6s')
  ]}
]}]};
test('ASR annotations survive non-text step content and return exactly timed words',()=>{
  const words=extractAsrWordAnnotations(fixture);
  assert.equal(words.length,5);
  assert.deepEqual([words[1].startMs,words[1].endMs],[170,480]);
  assert.equal(validateTimedWords(words,2000).ok,true);
  assert.equal(semanticMatchesWords(fixture.output_text,words),true);
});
test('Timestamp parser accepts offset duration and rejects missing data',()=>{
  assert.equal(durationOffsetMs('2.075s'),2075);
  assert.equal(durationOffsetMs('00:01:02.050'),62050);
  assert.ok(Number.isNaN(durationOffsetMs('about two seconds')));
});
test('Bad audio alignments are rejected rather than guessed',()=>{
  const words=extractAsrWordAnnotations(fixture);
  assert.equal(validateTimedWords([{...words[0],startMs:2100},...words.slice(1)],2000).ok,false);
  assert.equal(validateTimedWords([words[0],{...words[1],startMs:-1},...words.slice(2)],2000).ok,false);
  assert.equal(validateTimedWords([{...words[0],text:''},...words.slice(1)],2000).ok,false);
  assert.equal(validateTimedWords([{...words[0],endMs:4500},...words.slice(1)],2000).ok,false);
});
test('Transcript word layer must broadly match spoken text',()=>{
  const words=extractAsrWordAnnotations(fixture);
  assert.equal(semanticMatchesWords('Une vidéo sur les pizzas',words),false);
});
test('Word opacity starts at spoken word, never 300ms early',()=>{
  const word={startMs:1000,endMs:1350};
  assert.equal(revealTimedWord(999,word).opacity,0);
  assert.equal(revealTimedWord(1010,word).active,true);
  assert.ok(revealTimedWord(1030,word).opacity>0);
  assert.equal(revealTimedWord(1130,word).opacity,1);
  assert.equal(revealTimedWord(1400,word).active,false);
  assert.equal(revealTimedWord(1400,word).opacity,1);
});
test('Leila timeline refuses invalid times and preserves spoken texts only',()=>{
  const words=extractAsrWordAnnotations(fixture);
  const analysis={measurable:{durationSec:2,width:1280,height:720,silenceWindows:[]},
    transcript:{words},timeline:[],edit_visual_intents:[]};
  const t=buildEditTimeline({analysis,style:'leila'});
  assert.equal(t.captions.map(x=>x.words.map(w=>w.text).join(' ')).join(' '),'Je veux aider les autres');
  assert.deepEqual(t.leilaScenes,[]);
  const invalid={...analysis,transcript:{words:words.map((w,i)=>i===4?{...w,startMs:5000}:w)}};
  assert.throws(()=>buildEditTimeline({analysis:invalid,style:'leila'}),/ASR_TIMING_INVALID/);
});
