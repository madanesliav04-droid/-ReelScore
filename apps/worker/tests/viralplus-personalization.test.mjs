import test from 'node:test';
import assert from 'node:assert/strict';
import {reviewHookSuggestions,reviewEditorialFixes,reviewSupplementalCopy,reviewedTimelineMoments,brollEvidenceCheck} from '../src/viral-personalization.js';

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

test('headline and CTA cannot claim unsupported results or become template advice',()=>{
  assert.equal(reviewSupplementalCopy('Les secrets de la réussite',ugc,'title').text,'');
  assert.equal(reviewSupplementalCopy('9000 euros gagnés en UGC restaurant',ugc,'title').text,'');
  assert.equal(reviewSupplementalCopy('Regarde jusqu à la fin',ugc,'cta').text,'');
  assert.equal(reviewSupplementalCopy('Comment écrire un message personnalisé pour une collaboration UGC restaurant',ugc,'title').status,'hypothesis_related_to_video');
});

test('risk map only includes a moment overlapping an independently approved edit',()=>{
 const timeline=[
   {start_sec:0,end_sec:2,severity:'red',problem:'Accroche confuse'},
   {start_sec:7,end_sec:10,severity:'orange',problem:'Décrochage non vérifié'},
   {start_sec:12,end_sec:15,severity:'red',problem:'Autre problème sans preuve'}
 ];
 const fixes=[{area:'hook',start_sec:0,end_sec:2,exact_change:'Réécrire la phrase initiale'}];
 const vetted=reviewedTimelineMoments(timeline,fixes);
 assert.equal(vetted.length,1);
 assert.equal(vetted[0].start_sec,0);
 assert.equal(vetted[0].evidence_status,'checked_against_approved_video_fix');
 assert.equal(reviewedTimelineMoments(timeline,[]).length,0);
});

test('regression: never suggest fake 99 percent market failure from actual spoken video',()=>{
  const spoken={text:"Tu fais pas d'argent et tu en feras probablement pas parce que tu te poses la mauvaise question dès le départ. Ce qui compte ce sont les questions qui permettent de comprendre le vrai problème."};
  const candidate={proposed_hook:"Voici pourquoi 99% des débutants échouent à gagner leur premier euro en ligne.",source_quote:"tu te poses la mauvaise question dès le départ",
    why_test:"On voudrait rendre l'ouverture plus forte avec une affirmation statistique.",
    test_hypothesis:"La mention d'une statistique pourrait provoquer plus d'attention, mais elle n'existe pas dans les paroles.",
    variable_changed:"statistique"};
  const reviewed=reviewHookSuggestions([candidate],spoken);
  assert.equal(reviewed.candidates.length,0);
  assert.ok(reviewed.rejected_reasons[0].reasons.includes('CHIFFRE_NON_PRESENT_DANS_LA_VIDEO'));
});

test('reject automatic B-roll suggestion based only on a static shot',()=>{
 const suggestion={
  area:'visual',start_sec:2,end_sec:6,
  problem:'Il manque des B-rolls : la vidéo reste en plan fixe.',
  exact_change:'Ajouter des B-rolls dynamiques pour rendre la vidéo plus engageante.',
  example:'Mettre des B-rolls plus dynamiques pendant les longues phrases.',
  evidence_type:'visual',source_quote:'',
  observable_evidence:'La vidéo reste en plan fixe sans variations visuelles.'
 };
 assert.equal(reviewEditorialFixes([suggestion],ugc,20).fixes.length,0);
 assert.equal(brollEvidenceCheck(suggestion,ugc).valid,false);
});
test('retain contextual B-roll justified by specific spoken example',()=>{
 const evidence={
  area:'visual',start_sec:2,end_sec:5,
  problem:'Le message personnalisé envoyé au restaurant est décrit sans être montré.',
  exact_change:'Insérer un B-roll bref du message de prospection envoyé au restaurant au moment précis où tu en parles.',
  example:'Afficher une capture du message de prospection au restaurant avec les données privées masquées.',
  evidence_type:'visual',source_quote:'',
  observable_evidence:'Le message personnalisé envoyé au restaurant est expliqué oralement mais pas montré.'
 };
 const actual=reviewEditorialFixes([evidence],ugc,20);
 assert.equal(actual.fixes.length,1);
});
test('reject correct quote placed at wrong timestamp despite full-transcript match',()=>{
 const spoken={
  text:'Pour ma première collaboration UGC avec le restaurant je filme la carte puis je montre le message personnalisé envoyé.',
  words:[
   {text:'Pour',startMs:0,endMs:150},{text:'ma',startMs:180,endMs:270},{text:'première',startMs:300,endMs:660},
   {text:'collaboration',startMs:700,endMs:1000},{text:'UGC',startMs:1040,endMs:1210},
   {text:'avec',startMs:1260,endMs:1390},{text:'le',startMs:1400,endMs:1520},{text:'restaurant',startMs:1530,endMs:2000},
   {text:'je',startMs:5000,endMs:5150},{text:'filme',startMs:5200,endMs:5500},
   {text:'la',startMs:5520,endMs:5590},{text:'carte',startMs:5600,endMs:5900},
   {text:'puis',startMs:9100,endMs:9400},{text:'je',startMs:9420,endMs:9600},
   {text:'montre',startMs:9650,endMs:10000},{text:'le',startMs:10010,endMs:10200},
   {text:'message',startMs:10220,endMs:10500},{text:'personnalisé',startMs:10520,endMs:11000},
   {text:'envoyé',startMs:11020,endMs:11400}
  ]
 };
 const fix={area:'hook',start_sec:8.8,end_sec:11.5,
  problem:'La collaboration arrive trop tard dans cette démonstration.',
  exact_change:'Commencer cette séquence par l’annonce de la collaboration UGC et du restaurant.',
  example:'Afficher la phrase sur la collaboration UGC au début de la scène.',
  evidence_type:'transcript',
  source_quote:'Pour ma première collaboration UGC avec le restaurant',
  observable_evidence:'La collaboration UGC avec le restaurant est annoncée clairement dans l’ouverture.'
 };
 assert.equal(reviewEditorialFixes([fix],spoken,15).fixes.length,0);
 assert.equal(reviewEditorialFixes([{...fix,start_sec:0,end_sec:2.2}],spoken,15).fixes.length,1);
});
