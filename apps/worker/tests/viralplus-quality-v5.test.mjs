import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SCORE_VERSION,SCORE_WEIGHTS,validateSemanticAnalysis,
  calculateScore,priorityDiagnostics,editorialRiskMap
} from '../src/viral-quality.js';

const keys=Object.keys(SCORE_WEIGHTS);
const fixture=()=>({
  scores:Object.fromEntries(keys.map(k=>[k,76])),
  score_evidence:Object.fromEntries(keys.map(k=>[k,'Observation précise issue de la vidéo, à vérifier sur le passage.'])),
  fix_plan:[
    {area:'hook',start_sec:0,end_sec:2,problem:'Début peu spécifique pour l’audience',exact_change:'Remplacer la première phrase par la conséquence concrète.',example:'Exemple de reformulation adaptée'},
    {area:'retention',start_sec:4,end_sec:8,problem:'Le milieu répète une même proposition',exact_change:'Supprimer la phrase redondante et avancer la démonstration.'},
    {area:'structure',start_sec:9,end_sec:13,problem:'La conclusion arrive avant la preuve',exact_change:'Déplacer le résultat immédiatement avant la conclusion.'}
  ],
  timeline:[
    {start_sec:0,end_sec:2,severity:'red',label:'hook',problem:'Introduction peu spécifique',correction:'Remplacer la première phrase'},
    {start_sec:4,end_sec:8,severity:'orange',label:'retention',problem:'Répétition détectée',correction:'Couper la répétition'},
    {start_sec:15,end_sec:16,severity:'green',label:'structure',problem:'Point clairement expliqué',correction:''}
  ]
});
test('score v5 stable and weights sum to exactly 100 excluding CTA',()=>{
  assert.equal(SCORE_VERSION,'vp-score-5-evidence-priority');
  assert.equal(Object.values(SCORE_WEIGHTS).reduce((a,b)=>a+b,0),100);
  assert.equal(SCORE_WEIGHTS.cta,0);
  const s=fixture().scores;
  assert.equal(calculateScore(s),76);
  s.cta=0;
  assert.equal(calculateScore(s),76);
  s.cta=100;
  assert.equal(calculateScore(s),76);
});
test('identical input deterministic with no fabricated Instagram statistics',()=>{
  const f=fixture();
  const a=validateSemanticAnalysis(f);
  const b=validateSemanticAnalysis(structuredClone(f));
  assert.deepEqual(a,b);
  assert.equal(a.validation.source,'observed_video_not_instagram_analytics');
  assert.equal(calculateScore(a.scores),calculateScore(b.scores));
});
test('0-10 scale is only normalized when every criterion has that scale',()=>{
  const f=fixture();
  f.scores=Object.fromEntries(keys.map(k=>[k,7]));
  const a=validateSemanticAnalysis(f);
  assert.equal(a.scores.hook,70);
  assert.equal(a.validation.score_scale,'normalized_0_10_to_0_100');
  const mixed=fixture();
  mixed.scores.hook=7;
  assert.equal(validateSemanticAnalysis(mixed).scores.hook,7);
});
test('missing score, missing evidence or generic fixes block publication',()=>{
  const scoreMissing=fixture();
  delete scoreMissing.scores.originality;
  assert.throws(()=>validateSemanticAnalysis(scoreMissing),/VIRAL_SCORE_INVALID/);
  const missingEvidence=fixture();
  missingEvidence.score_evidence=Object.fromEntries(keys.map(k=>[k,'']));
  assert.throws(()=>validateSemanticAnalysis(missingEvidence),/VIRAL_EVIDENCE_INSUFFICIENT/);
  const missingFix=fixture();
  missingFix.fix_plan=[{problem:'très vague',exact_change:'plus dynamique'}];
  assert.throws(()=>validateSemanticAnalysis(missingFix),/VIRAL_FIX_PLAN_INSUFFICIENT/);
  const missingTimeline=fixture();
  missingTimeline.timeline=[];
  assert.throws(()=>validateSemanticAnalysis(missingTimeline),/VIRAL_TIMELINE_INSUFFICIENT/);
});
test('priority ranks weighted opportunity, not the smallest raw score',()=>{
  const f=fixture();
  for(const key of keys)f.scores[key]=100;
  f.scores.hook=50; // 10 recoverable score points
  f.scores.audio=0; // 5 recoverable score points
  f.scores.cta=0; // 0 weighted points
  const ranked=priorityDiagnostics(f.scores,f.score_evidence,f.fix_plan,f.timeline,20);
  assert.equal(ranked[0].key,'hook');
  assert.equal(ranked[0].impact_points,10);
  assert.equal(ranked[0].exact_change,'Remplacer la première phrase par la conséquence concrète.');
  assert.equal(ranked[0].start_sec,0);
  assert.equal(ranked.find(x=>x.key==='audio').impact_points,5);
  assert.equal(ranked.some(x=>x.key==='cta'),false);
});
test('timeline does not claim measured audience retention',()=>{
  const f=fixture();
  const risks=editorialRiskMap(f.timeline,6);
  assert.equal(risks.length,2);
  assert.equal(risks[1].end_sec,6);
  assert.equal(risks[0].type,'estimated_editorial_dropout_risk');
  assert.match(risks[0].disclaimer,/aucune donnée de rétention Instagram/i);
  assert.equal(risks.some(x=>x.severity==='green'),false);
});
