import test from 'node:test';
import assert from 'node:assert/strict';
import {reviewHookSuggestions,reviewEditorialFixes} from '../src/viral-personalization.js';

const ugc={text:"Pour ma première collaboration UGC avec le restaurant, j'ai filmé une vidéo de la carte puis j'ai envoyé un message personnalisé. Je vous montre le message et comment j'ai proposé cette vidéo."};
const valid=()=>({
  proposed_hook:"Pour ma première collaboration UGC avec ce restaurant, voici le message personnalisé que j'ai envoyé.",
  source_quote:"Pour ma première collaboration UGC avec le restaurant",
  why_test:"Cette formulation présente dès le début le cas concret traité par la vidéo plutôt qu'une promesse générale.",
  test_hypothesis:"Nommer la collaboration et le message dès l'ouverture pourrait clarifier ce que le spectateur va apprendre.",
  variable_changed:"spécificité du cas"
});
test('genuinely contextual UGC candidate remains only a hypothesis',()=>{
  const reviewed=reviewHookSuggestions([valid()],ugc);
  assert.equal(reviewed.status,'testable_hypotheses');
  assert.equal(reviewed.candidates.length,1);
  assert.equal(reviewed.candidates[0].status,'hypothesis_ready_for_test');
  assert.match(reviewed.caution,/sans résultat de test réel/i);
  assert.equal(reviewed.candidates[0].source_quote,valid().source_quote);
});
test('one-size-fits-all hook is rejected even when quote is legitimate',()=>{
  const x=valid();
  x.proposed_hook="Tu veux savoir le secret pour devenir viral ?";
  const out=reviewHookSuggestions([x],ugc);
  assert.equal(out.candidates.length,0);
  assert.equal(out.status,'insufficient_verified_context');
});
test('fabricated numerical proof and promise are rejected',()=>{
  const x=valid();
  x.proposed_hook="J'ai gagné 9000 euros avec ma première collaboration UGC au restaurant";
  assert.equal(reviewHookSuggestions([x],ugc).candidates.length,0);
  const y=valid();
  y.proposed_hook="Ma méthode garantie 100 % de collaboration UGC restaurant";
  assert.equal(reviewHookSuggestions([y],ugc).candidates.length,0);
});
test('unverifiable source quote or no transcript means no stronger hook',()=>{
  const x=valid();
  x.source_quote="Je suis allé à Tokyo investir en crypto-monnaie";
  assert.equal(reviewHookSuggestions([x],ugc).candidates.length,0);
  assert.equal(reviewHookSuggestions([valid()],{text:''}).candidates.length,0);
});
test('unrelated generic hook is rejected, even with a real reference quote',()=>{
  const x=valid();
  x.proposed_hook="Comment devenir riche en bourse grâce à des investissements";
  assert.equal(reviewHookSuggestions([x],ugc).candidates.length,0);
});
test('reject false transcribed edit, accept grounded quote and concrete action',()=>{
  const grounded={
    area:'hook',start_sec:0,end_sec:4,priority:1,
    problem:"Le sujet arrive tard au début de la vidéo.",
    exact_change:"Commencer directement avec le message envoyé pour la première collaboration UGC.",
    example:"Afficher la phrase de prospection au début avant d'expliquer la vidéo du restaurant.",
    evidence_type:"transcript",
    source_quote:"Pour ma première collaboration UGC avec le restaurant",
    observable_evidence:"L'annonce de la collaboration avec le restaurant sert de contexte et d'enjeu.",
  };
  const reviewed=reviewEditorialFixes([grounded],ugc,20);
  assert.equal(reviewed.fixes.length,1);
  assert.equal(reviewed.fixes[0].evidence_status,'transcript_excerpt_verified');
  assert.equal(reviewEditorialFixes([{...grounded,source_quote:'Je gagne un million par jour'}],ugc,20).fixes.length,0);
  assert.equal(reviewEditorialFixes([{...grounded,start_sec:27,end_sec:28}],ugc,20).fixes.length,0);
  assert.equal(reviewEditorialFixes([{...grounded,exact_change:'Sois plus dynamique'}],ugc,20).fixes.length,0);
});
test('visual opinions are visibly qualified and not independently proven',()=>{
 const x={area:'visual',start_sec:1,end_sec:3,priority:1,problem:'Visage coupé pendant la phrase.',exact_change:'Décaler le cadrage vers le centre en conservant les mains dans le champ.',example:'Recentrer le visage pendant la présentation de la carte.',evidence_type:'visual',source_quote:'',observable_evidence:'Le visage est placé très près du bord gauche du cadre.'};
 const a=reviewEditorialFixes([x],ugc,20);
 assert.equal(a.fixes[0].evidence_status,'model_observation_to_verify');
});
