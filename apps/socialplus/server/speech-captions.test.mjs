import test from 'node:test';
import assert from 'node:assert/strict';
import {speechCaptionAss} from './speech-captions.mjs';
import {buildLocalEdit,acousticReport} from './local-edit.mjs';
const meta={width:910,height:512,durationMs:3000,hasAudio:true};
const words=[{text:'Ceci',startMs:100,endMs:120},{text:'est',startMs:120,endMs:140},{text:'rapide',startMs:140,endMs:400},{text:'et',startMs:600,endMs:700},{text:'lisible',startMs:700,endMs:900}];
const base=buildLocalEdit({report:{metadata:meta,suggestions:[]},transcript:words,previewOnly:true});
const lines=s=>s.split('\n').filter(l=>l.startsWith('Dialogue:'));
const ms=t=>{const [h,m,s]=t.split(':').map(Number);return Math.round((h*3600+m*60+s)*1000);};
test('word captions retain 20ms words without overlapping ASS events',()=>{
 const events=lines(speechCaptionAss(base,'leila-hormozi-v53',meta)).map(l=>l.split(','));
 assert.equal(events.length,5);
 for(let i=0;i<events.length;i++){assert.ok(ms(events[i][2])>ms(events[i][1]));if(i)assert.ok(ms(events[i][1])>=ms(events[i-1][2]));}
});
test('cinematic scene only suppresses its covered intervals, preserving adjacent camera captions',()=>{
 const output=lines(speechCaptionAss(base,'cinematic-storytelling-v7',meta,[{startMs:200,endMs:650}]));
 assert.ok(output.some(l=>l.includes('0:00:00.14,0:00:00.20')));
 assert.ok(output.some(l=>l.includes('0:00:00.65,0:00:00.70')));
 assert.ok(output.some(l=>l.includes('0:00:00.70,0:00:00.90')));
});
test('real acoustic pauses merge and narrow conservatively around words',()=>{
 const report=acousticReport('silence_start: 1\nsilence_end: 1.5\nsilence_start: 1.5\nsilence_end: 2.1',meta,'fixture');
 assert.equal(report.suggestions.length,1);
 const edit=buildLocalEdit({report,approvedPauseIds:['pause-0'],transcript:[{text:'avant',startMs:500,endMs:1200},{text:'après',startMs:1800,endMs:2000}],previewOnly:true});
 assert.deepEqual(edit.cuts.map(({startMs,endMs})=>({startMs,endMs})),[{startMs:1320,endMs:1680}]);
 assert.equal(edit.captions.flatMap(c=>c.words)[1].startMs,1440);
});

test('caption edge refinements cannot widen a cut into the original ASR speech interval',()=>{
 const report={metadata:{...meta,durationMs:4000},suggestions:[{id:'pause',startMs:1250,endMs:2250}]};
 const transcript=[{text:'avant',startMs:800,endMs:1100,asrEndMs:1300},{text:'après',startMs:2400,endMs:2800,asrStartMs:2100}];
 const edit=buildLocalEdit({report,approvedPauseIds:['pause'],transcript,previewOnly:true});
 assert.deepEqual(edit.cuts.map(c=>[c.startMs,c.endMs]),[[1420,1980]]);
 const hostile=transcript.map(w=>({...w,asrStartMs:999999,asrEndMs:-999999}));
 const fallback=buildLocalEdit({report,approvedPauseIds:['pause'],transcript:hostile,previewOnly:true});
 assert.deepEqual(fallback.cuts.map(c=>[c.startMs,c.endMs]),[[1250,2250]]);
});
