import test from 'node:test';
import assert from 'node:assert/strict';
import {cinematicCutWindows,planCinematicMotion,holdCinematicCaptions} from '../src/cinematic-motion.js';
import {planCinematicStoryboard} from '../src/cinematic-intent.js';
import {buildEditTimeline} from '../src/edit.js';

const words=(text,interval=340)=>text.split(' ').map((w,i)=>({
  text:w,startMs:i*interval,endMs:i*interval+Math.min(interval-45,255)
}));

test('cinematic retains the opening and closing audio, trims only long interior gaps',()=>{
  const speech=[{text:'bonjour',startMs:750,endMs:1000},{text:'fin',startMs:6550,endMs:6700}];
  const silences=[{start:0,end:.6},{start:2,end:4},{start:9,end:10}];
  const cuts=cinematicCutWindows(silences,speech,10000);
  assert.equal(cuts.length,1);
  assert.deepEqual(cuts[0],{startMs:2280,endMs:3720,reason:'cinematic_long_silence'});
  assert.equal(cinematicCutWindows([{start:2,end:3.05}],speech,10000).length,0);
});

test('cinematic never cuts silence that contains speech or is adjacent to words',()=>{
  const actual=[{text:'mot',startMs:3050,endMs:3400}];
  assert.deepEqual(cinematicCutWindows([{start:2,end:4}],actual,10000),[]);
});

test('cinematic camera movements need verified transcript and never fire on a timer',()=>{
  const fictional={kind:'turn',startMs:2000,endMs:3300,evidence:'AI_guess'};
  assert.deepEqual(planCinematicMotion([fictional],10000),[]);
  const valid=[
    {...fictional,evidence:'transcript'},
    {kind:'resolution',startMs:11200,endMs:12900,evidence:'transcript'},
    {kind:'memory',startMs:20200,endMs:22700,evidence:'transcript'}
  ];
  const moves=planCinematicMotion(valid,25000);
  assert.equal(moves.length,2);
  assert.ok(moves.every(m=>m.scale<=1.03));
  assert.ok(moves.every(m=>m.startMs>=0&&m.endMs<=25000));
});

test('cinematic captions hold their last word without overlapping next group',()=>{
  const inWords=[{startMs:300,endMs:700},{startMs:900,endMs:1120}];
  const groups=holdCinematicCaptions(inWords,1550);
  assert.deepEqual(groups.map(x=>x.endMs),[880,1300]);
  assert.ok(groups[0].endMs<groups[1].startMs);
});

test('cinematic scene quotes have word-level timestamps for synced visual reveal',()=>{
  const input=words('Pendant des mois on pensait tout savoir mais les faits racontaient une histoire totalement différente');
  const scenes=planCinematicStoryboard(input,11000,[]);
  assert.equal(scenes.length,1);
  assert.equal(scenes[0].kind,'turn');
  assert.equal(scenes[0].wordTimings[0].text,'mais');
  assert.equal(scenes[0].wordTimings[0].startMs,scenes[0].startMs);
  assert.ok(scenes[0].wordTimings.every(x=>x.startMs>=scenes[0].startMs));
});

test('cinematic timeline preserves native horizontal aspect and final 900ms',()=>{
  const spoken=words('Je pensais avoir compris mais ce qui arrive ensuite change complètement la manière de voir les choses');
  const analysis={
    measurable:{durationSec:12,width:1920,height:1080,silenceWindows:[
      {start:2,end:4},{start:11,end:12}
    ]},
    transcript:{words:spoken},timeline:[],edit_visual_intents:[]
  };
  const timeline=buildEditTimeline({analysis,style:'cinematic_story'});
  assert.equal(timeline.version,4);
  assert.equal(timeline.engine,'editplus-cinematic-narrative-v2');
  assert.equal(timeline.export.width,1920);
  assert.equal(timeline.export.height,1080);
  assert.equal(timeline.keepRanges.at(-1).endMs,12000);
  assert.ok(timeline.cinematicMotion.length<=2);
  assert.ok(timeline.cinematicScenes.every(s=>s.wordTimings.length));
  assert.equal(timeline.audio.targetLufs,-16);
  assert.equal(timeline.audio.limiterDb,-1);
});

test('cinematic never manufactures scenes when transcript lacks narrative evidence',()=>{
  const input=words('Voici une présentation simple de notre produit dans cette vidéo utile pour tout le monde');
  assert.deepEqual(planCinematicStoryboard(input,10000,[]),[]);
  assert.deepEqual(planCinematicMotion([],10000),[]);
});
