import test from 'node:test';
import assert from 'node:assert/strict';
import {planCinematicStoryboard} from '../src/cinematic-intent.js';
const words=(line,step=420)=>line.split(' ').map((text,index)=>({
  text,startMs:index*step,endMs:index*step+Math.min(350,step-30)
}));
test('cinematic: verified turning point produces a unique scene',()=>{
  const input=words('Pendant trois ans je travaillais tous les jours mais je ne comprenais pas vraiment pourquoi cela ne fonctionnait pas');
  const out=planCinematicStoryboard(input,11000,[]);
  assert.equal(out.length,1);
  assert.equal(out[0].kind,'turn');
  assert.equal(out[0].evidence,'transcript');
  assert.match(out[0].quote,/mais/);
});
test('cinematic: no speech marker yields no invented visuals',()=>{
  const input=words('Nous présentons simplement notre produit et son fonctionnement dans cette vidéo pratique sans aucune démonstration supplémentaire');
  assert.deepEqual(planCinematicStoryboard(input,10000,[]),[]);
});
test('cinematic: emotional conclusion and business question have distinct beats',()=>{
  const emotional=words('Cette aventure semblait impossible depuis plusieurs mois finalement nous avons retrouvé notre motivation et continué ensemble');
  const business=words('Quand tu analyses les résultats de ton entreprise pourquoi tes prospects ne prennent ils jamais de rendez vous');
  const e=planCinematicStoryboard(emotional,11000,[]);
  const b=planCinematicStoryboard(business,11000,[]);
  assert.equal(e[0]?.kind,'resolution');
  assert.equal(b[0]?.kind,'question');
  assert.notEqual(e[0]?.quote,b[0]?.quote);
});
test('cinematic: hallucinated semantic cue is ignored',()=>{
  const input=words('Je travaille sur cette histoire depuis plusieurs années et je veux en parler de manière simple');
  const out=planCinematicStoryboard(input,10000,[{confidence:.99,type:'metric',evidence_quote:'100000 euros de revenus inventés'}]);
  assert.deepEqual(out,[]);
});
test('cinematic: corrupt/outside timing never produces visuals',()=>{
  const input=words('Je pensais tout réussir mais les résultats étaient différents avant de tout revoir').map(w=>({...w,startMs:-100,endMs:20000}));
  assert.deepEqual(planCinematicStoryboard(input,4000,[]),[]);
});
