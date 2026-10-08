import {test} from 'node:test';
import assert from 'node:assert/strict';
import {rankHighlights,normalizeHighlight} from '../src/clip-highlights.js';

test('accept 10 and 15 seconds and enforce exact short-form bounds',()=>{
  const opts={duration:120};
  assert.equal(normalizeHighlight({start_sec:5,end_sec:15,viral_score:80},opts).end_sec,15);
  assert.equal(normalizeHighlight({start_sec:5,end_sec:20,viral_score:80},opts).end_sec,20);
  assert.equal(normalizeHighlight({start_sec:5,end_sec:14.99,viral_score:80},opts),null);
  assert.equal(normalizeHighlight({start_sec:5,end_sec:30,viral_score:80},opts),null);
});
test('rank by scored relevance before deduplicating overlap',()=>{
  const raw=[{start_sec:20,end_sec:33,viral_score:68},{start_sec:21,end_sec:34,viral_score:96},{start_sec:70,end_sec:81,viral_score:88}];
  const hits=rankHighlights(raw,{duration:120,minQuality:64,count:5});
  assert.equal(hits.length,2);assert.equal(hits[0].viral_score,96);
  assert.equal(hits[0].start_sec,21);
  assert.equal(hits[1].start_sec,70);
});
test('does not invent scores or phantom moments',()=>{
  const raw=[{start_sec:0,end_sec:12},{start_sec:35,end_sec:47,viral_score:44}];
  assert.deepEqual(rankHighlights(raw,{duration:120,minQuality:64}),[]);
});
test('condense a longer AI proposal using observed word timestamps ending on a sentence',()=>{
  const words=Array.from({length:32},(_,i)=>({
    startMs:i*600,endMs:i*600+450,text:i===22?'terminé.':i===0?'Mais':'chose'
  }));
  const candidate=normalizeHighlight({start_sec:0,end_sec:19.2,viral_score:82,title:'Une idée'}, {duration:60,words,minSec:10,maxSec:15});
  assert.ok(candidate);assert.ok(candidate.condensed_from_long_passage);
  assert.ok(candidate.end_sec-candidate.start_sec>=10);
  assert.ok(candidate.end_sec-candidate.start_sec<=15);
});
test('reject contextless oversized clips when there are no trustworthy timing anchors',()=>{
  assert.equal(normalizeHighlight({start_sec:0,end_sec:34,viral_score:92},{duration:40,words:[]}),null);
});
