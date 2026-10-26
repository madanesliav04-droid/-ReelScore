import test from 'node:test';
import assert from 'node:assert/strict';
import {discourseScenes} from '../src/alex-v16-discourse.js';
const fixture=(left,right)=>{
 const text=`Une ${left} et une ${right}, ça n'a rien à voir. Observons tranquillement les situations concrètes de notre équipe au quotidien. Une démarche régulière apporte du revenu et améliore les résultats de notre équipe. Prenons maintenant du recul et examinons nos besoins essentiels avant de poursuivre. Ça me permet d'évaluer la demande, ça me permet de choisir une offre, ça me permet de mesurer la valeur finale.`;
 const words=text.split(' ').map((text,i)=>({text,startMs:i*350,endMs:i*350+280}));return {words,duration:words.length*.35+2};
};
for(const [left,right] of [['réunion','décision'],['rapport','preuve'],['contact','contrat']])test(`extractive relations accept new subject ${left}/${right}, not a fixed rush script`,()=>{
 const {words,duration}=fixture(left,right);const scenes=discourseScenes(words,duration);
 assert.ok(scenes);assert.deepEqual(new Set(scenes.map(s=>s.kind)),new Set(['question','value','chain']));
 for(const scene of scenes){
  assert.ok(scene.relationEvidence.type);
  for(const e of scene.evidence)assert.equal(e.text,words.slice(e.firstWord,e.lastWord+1).map(w=>w.text).join(' ').replace(/^[,.;:!?\s]+|[,.;:!?\s]+$/g,''));
 }
 assert.ok(scenes.some(s=>s.text.title.toLowerCase().includes(left)));
});
test('a list alone is not enough evidence to invent a comparison or financial result',()=>{
 const {words,duration}=fixture('réunion','décision');
 const changed=words.map(w=>({...w,text:w.text.replace(/revenu|argent|valeur|rien/g,'élément')}));
 assert.equal(discourseScenes(changed,duration),null);
});
test('relations are deterministic and follow changed timecodes',()=>{
 const {words,duration}=fixture('contact','contrat');const a=discourseScenes(words,duration);
 assert.deepEqual(a,discourseScenes(words,duration));
 const shifted=discourseScenes(words.map(w=>({...w,startMs:w.startMs+1200,endMs:w.endMs+1200})),duration+1.2);
 for(let i=0;i<3;i++)assert.ok(Math.abs(shifted[i].start-a[i].start-1.2)<.0001);
});
test('écouter is not misclassified as coût and cannot justify a money diagram',()=>{
 const {words,duration}=fixture('réunion','décision');
 const changed=words.map(w=>({...w,text:w.text.replace(/revenu|valeur/g,'écouter')}));
 assert.equal(discourseScenes(changed,duration),null);
});
