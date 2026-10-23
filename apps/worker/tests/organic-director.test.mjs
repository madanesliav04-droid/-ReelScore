import test from 'node:test';
import assert from 'node:assert/strict';
import {buildOrganicCues} from '../src/organic-director.js';
import {buildOrganicAss} from '../src/organic-render.js';
const words=[
{text:'Ça',startMs:5300,endMs:5550},{text:'marche',startMs:5550,endMs:5850},{text:'comment?',startMs:5850,endMs:6210},
{text:'Mais',startMs:11300,endMs:11550},{text:'le',startMs:11550,endMs:11750},{text:'contenu',startMs:11750,endMs:12100},{text:'ne',startMs:12100,endMs:12300},{text:'fonctionne',startMs:12300,endMs:12900},{text:'pas.',startMs:12900,endMs:13200}
];
const captions=[{text:'Ça marche comment?',startMs:5200,endMs:6300},{text:'Mais le contenu ne fonctionne pas.',startMs:11000,endMs:13500}];
test('no ungrounded titles without timed words',()=>assert.deepEqual(buildOrganicCues({captions,durationMs:18000}),[]));
test('semantic question anchored to actual word',()=>{
 const cues=buildOrganicCues({captions,words,durationMs:18000});
 assert.ok(cues.length>0);assert.equal(cues[0].startMs,5300);
 assert.equal(cues[0].text,'Ça marche comment?');
});
test('no data fabrication in labels',()=>{
 const cues=buildOrganicCues({captions,words,durationMs:18000});
 assert.ok(cues.every(x=>captions.some(c=>c.text.includes(x.text))));
});
test('natural typography only',()=>{
 const cues=buildOrganicCues({captions,words,durationMs:18000});
 const ass=buildOrganicAss({graphicCues:cues},512,910);
 assert.match(ass,/Noto Serif/);
 assert.match(ass,/move/);
 assert.doesNotMatch(ass,/\\p1/);
});
