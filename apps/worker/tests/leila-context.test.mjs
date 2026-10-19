import test from 'node:test';
import assert from 'node:assert/strict';
import {planLeilaVisuals} from '../src/leila-intent.js';
import {buildEditTimeline} from '../src/edit.js';

const words=(text)=>text.split(/\s+/).map((text,i)=>({
  text,startMs:i*350,endMs:i*350+260
}));
const auto=(text)=>planLeilaVisuals(words(text),Math.max(8000,text.split(/\s+/).length*350+1000));
const analysis=(text,width=910,height=512)=>({
  measurable:{durationSec:12,width,height,silenceWindows:[],audioCodec:'aac'},
  transcript:{words:words(text)},timeline:[]
});

test('Leila never invents a comparison for generic business narration',()=>{
  const cues=auto('Je vais aider des personnes à gagner de argent en ligne avec mon expérience');
  assert.equal(cues.some(c=>c.type==='comparison'),false);
  assert.equal(cues.some(c=>c.type==='metric'),false);
  assert.equal(cues.filter(c=>c.type==='comparison').length,0);
});
test('Two explicitly contrasted items produce a comparison, not on other reels',()=>{
  const cues=auto('Je préfère YouTube versus TikTok pour publier mes vidéos');
  assert.equal(cues[0]?.type,'comparison');
  assert.deepEqual(cues[0].items,['YouTube','TikTok']);
});
test('Genuine two steps do not use a comparison table',()=>{
  const cues=auto("D'abord on filme le produit ensuite on ajoute le montage");
  assert.equal(cues[0]?.type,'steps');
  assert.ok(cues.every(c=>c.type!=='comparison'));
});
test('Spoken cause and effect gets a different visual grammar',()=>{
  const cues=auto('Si tu aides ton client alors il obtient un meilleur résultat');
  assert.equal(cues[0]?.type,'flow');
  assert.ok(cues.every(c=>c.type!=='comparison'));
});
test('Numbers are never made up and must carry a spoken unit',()=>{
  assert.deepEqual(auto('Le nombre 200 est juste un exemple').filter(c=>c.type==='metric'),[]);
  const cues=auto('La vidéo a obtenu 200 vues cette semaine');
  assert.equal(cues[0]?.type,'metric');
  assert.match(cues[0].items[0],/200 vues/);
});
test('An explicit spoken question gets light typography, not a table',()=>{
  const cues=auto("Comment gagner de argent en ligne ?");
  assert.equal(cues[0]?.type,'emphasis');
  assert.ok(cues.every(c=>c.type!=='comparison'));
});
test('Deliberate no-graphic semantic recommendation is respected',()=>{
  assert.deepEqual(planLeilaVisuals(words('Je préfère YouTube versus TikTok'),9000,[]),[]);
});
test('Hallucinated multimodal evidence is refused',()=>{
  const input=[{type:'comparison',evidence_quote:'mon café est moins cher que le vôtre',
    confidence:0.98,start_sec:0,placement:'right'}];
  assert.deepEqual(planLeilaVisuals(words('Je préfère YouTube versus TikTok'),9000,input),[]);
});
test('Validated semantic intent uses exact spoken comparison and a suggested placement',()=>{
  const w=words('Je préfère YouTube versus TikTok pour les vidéos');
  const input=[{type:'comparison',evidence_quote:'YouTube versus TikTok',
    confidence:0.92,start_sec:0.7,placement:'right'}];
  const cues=planLeilaVisuals(w,9000,input);
  assert.equal(cues.length,1);
  assert.equal(cues[0].type,'comparison');
  assert.equal(cues[0].placement,'right');
  assert.deepEqual(cues[0].items,['YouTube','TikTok']);
});
test('No reliable timestamps means no overlays or made-up captions',()=>{
  assert.deepEqual(planLeilaVisuals([{text:'YouTube'},{text:'versus'},{text:'TikTok'}],9000),[]);
});
test('Landscape and portrait preserve their native aspect; no forced vertical',()=>{
  const horiz=buildEditTimeline({analysis:analysis('Voici une vidéo vraiment simple à regarder') ,style:'leila'});
  assert.deepEqual([horiz.export.width,horiz.export.height],[910,512]);
  assert.equal(horiz.leilaScenes.length,0);
  const portrait=buildEditTimeline({analysis:analysis('Voici une vidéo vraiment simple à regarder',512,910),style:'leila'});
  assert.deepEqual([portrait.export.width,portrait.export.height],[512,910]);
});
test('Missing timed transcript fails closed instead of inventing text',()=>{
  assert.throws(()=>buildEditTimeline({style:'leila',analysis:{
    measurable:{durationSec:5,width:910,height:512},
    transcript:{words:[]}
  }}),/LEILA_TRANSCRIPT_REQUIRED/);
});
