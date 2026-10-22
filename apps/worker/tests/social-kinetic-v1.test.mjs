import test from 'node:test';
import assert from 'node:assert/strict';
import {buildSocialKineticCues,renderSocialKineticAss} from '../src/social-kinetic-v1.js';
const words=[
{text:'Première',startMs:100,endMs:400},
{text:'solution',startMs:500,endMs:750},
{text:'3000',startMs:3100,endMs:3350},
{text:'euros',startMs:3350,endMs:3700},
{text:'comment',startMs:6200,endMs:6500},
{text:'développer',startMs:6500,endMs:6800},
{text:'clients',startMs:6800,endMs:7000}
];
const frames=Array.from({length:55},(_,i)=>({ms:i*200,confidence:.99,clearTopNormalized:.46}));
const input={words,durationMs:10000,alignment:{method:'forced_alignment',verified:true,confidence:.98},visualProof:{source:'independent_frame_sampler',verified:true,frames}};
test('aucune transcription certifiée = aucun graphique',()=>{
 assert.deepEqual(buildSocialKineticCues({...input,alignment:null}),[]);
});
test('aucune preuve visuelle indépendante = aucun graphique',()=>{
 assert.deepEqual(buildSocialKineticCues({...input,visualProof:null}),[]);
});
test('transcription + preuve = déclenche des graphiques justifiés',()=>{
 const cues=buildSocialKineticCues(input);
 assert.ok(cues.length>0);
 assert.ok(cues.some(c=>c.kind==='metric'&&c.text==='3000 euros'));
 assert.ok(cues.every((c,i)=>i===0||c.startMs>=cues[i-1].endMs));
 assert.ok(cues.every(c=>c.evidence==='forced_alignment_plus_independent_frame_safety'));
});
test('les chiffres non prononcés ne peuvent pas être affichés',()=>{
 const cues=buildSocialKineticCues(input);
 assert.ok(cues.every(c=>!c.text.includes('5000')));
});
test('visage ou zone haute non vérifiés = aucun graphique',()=>{
 assert.deepEqual(buildSocialKineticCues({...input,visualProof:{...input.visualProof,frames:frames.map(x=>({...x,clearTopNormalized:.08}))}}),[]);
});
test('rendu ASS distinct avec timings et mouvement',()=>{
 const cues=buildSocialKineticCues(input);
 const ass=renderSocialKineticAss({graphicCues:cues},1080,1920);
 assert.match(ass,/Dialogue: 4/);
 assert.match(ass,/\\fad\(120,220\)/);
 assert.match(ass,/3000 euros/);
 assert.doesNotMatch(ass,/undefined/);
});
test('refuser les panneaux trop petits',()=>{
 assert.throws(()=>renderSocialKineticAss({},200,200),/CANVAS_TOO_SMALL/);
});