import test from 'node:test';
import assert from 'node:assert/strict';
import {buildEditTimeline,curateCodiePunchIns} from '../src/edit.js';

test('Codie prioritizes evidence and composition instead of first three chronological zooms',()=>{
  const proposals=[
    {startMs:800,endMs:1750,reason:'editorial_emphasis'},
    {startMs:3000,endMs:4300,reason:'general moment'},
    {startMs:3540,endMs:5100,reason:'punchline contradiction'},
    {startMs:9400,endMs:10800,reason:'important counterpoint'},
    {startMs:14600,endMs:16100,reason:'key insight revelation'},
    {startMs:19600,endMs:19900,reason:'punchline'}
  ];
  const words=[{startMs:3600},{startMs:9400},{startMs:14600}];
  const result=curateCodiePunchIns(proposals,words,21000,3);
  assert.equal(result.length,3);
  assert.deepEqual(result.map(x=>x.startMs),[3600,9400,14600]);
  assert.ok(result.every(x=>x.endMs-x.startMs>=700));
  assert.ok(result.every(x=>x.evidence==='analysis_timeline'));
  assert.ok(result.every(x=>[1.065,1.125].includes(x.scale)));
  assert.ok(!result.some(x=>x.reason==='general moment'));
  assert.ok(!result.some(x=>x.reason==='editorial_emphasis'));
});

test('Codie does not force any camera move without a specific spoken editorial cue',()=>{
  assert.deepEqual(curateCodiePunchIns([],[],30000,3),[]);
  assert.deepEqual(curateCodiePunchIns([{startMs:400,endMs:1800,reason:'editorial_emphasis'}],[],30000,3),[]);
  assert.deepEqual(curateCodiePunchIns([{startMs:2500,endMs:2800,reason:'punchline'}],[],30000,3),[]);
  assert.deepEqual(curateCodiePunchIns([{startMs:2500,endMs:4300,reason:'punchline'}],[],30000,0),[]);
});

test('Codie quality policy is used in the real timeline builder',()=>{
  const analysis={
    measurable:{durationSec:20,width:1080,height:1920,audioCodec:'aac',silenceWindows:[]},
    transcript:{words:[
      {text:'Ça',startMs:3500,endMs:3700},{text:'change.',startMs:3700,endMs:4100},
      {text:'Pourtant',startMs:9800,endMs:10200},
      {text:'Voilà.',startMs:14800,endMs:15100}
    ]},
    timeline:[
      {severity:'red',start_sec:0.9,end_sec:1.9,label:'editorial_emphasis'},
      {severity:'red',start_sec:3.5,end_sec:4.7,label:'punchline contradiction'},
      {severity:'red',start_sec:9.8,end_sec:11.2,label:'important counterpoint'},
      {severity:'red',start_sec:14.8,end_sec:16.2,label:'key insight revelation'}
    ]
  };
  const timeline=buildEditTimeline({analysis,style:'codie',format:'portrait'});
  assert.equal(timeline.modelId,'codie');
  // 20 seconds at a 3/30s ceiling permits only two deliberate punch-ins.
  assert.equal(timeline.punchIns.length,2);
  assert.deepEqual(timeline.punchIns.map(p=>p.startMs),[3500,14800]);
  assert.ok(timeline.punchIns.every(p=>p.evidence==='analysis_timeline'));
  assert.ok(!timeline.punchIns.some(p=>p.reason==='editorial_emphasis'));
  assert.ok(timeline.punchIns.every(p=>[1.065,1.125].includes(p.scale)));
  assert.equal(timeline.captionConfig.activeWord,false);
});
