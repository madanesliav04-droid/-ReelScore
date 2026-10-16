// Viral+ V5 editorial quality contracts. No private social-platform ranking weights.
export const SCORE_VERSION='vp-score-8-native-format-rubric';
export const SCORE_WEIGHTS=Object.freeze({
  hook:15,scroll_stop:5,clarity:15,rhythm:10,retention:15,
  structure:10,text_captions:5,visual:10,audio:5,cta:0,originality:10
});
const REQUIRED_KEYS=Object.keys(SCORE_WEIGHTS);
const SCORED_KEYS=REQUIRED_KEYS.filter(key=>SCORE_WEIGHTS[key]>0);
const clamp=n=>Math.max(0,Math.min(100,Math.round(n)));
const short=(v,max=700)=>String(v??'').trim().slice(0,max);
const finite=v=>(typeof v==='number'||typeof v==='string'&&v.trim()!=='')&&Number.isFinite(Number(v));
const exactArea=(value,key)=>{
  const v=String(value||'').trim().toLowerCase().replace(/[\s-]+/g,'_');
  const aliases={accroche:'hook',intro:'hook',opening:'hook',stop_scroll:'scroll_stop',
    retention_risk:'retention',pacing:'rhythm',rythme:'rhythm',message:'clarity',
    subtitles:'text_captions',captions:'text_captions',sound:'audio',
    montage:'visual',originalite:'originality'};
  return (aliases[v]||v)===key;
};
export function validateSemanticAnalysis(input){
  if(!input||typeof input!=='object')throw new Error('VIRAL_SCORE_INVALID: réponse IA absente.');
  const original=input.scores;
  if(!original||typeof original!=='object')throw new Error('VIRAL_SCORE_INVALID: scores manquants.');
  const invalid=REQUIRED_KEYS.filter(key=>!finite(original[key])||Number(original[key])<0||Number(original[key])>100);
  if(invalid.length)throw new Error('VIRAL_SCORE_INVALID: critères non mesurés : '+invalid.join(', '));
  const values=REQUIRED_KEYS.map(key=>Number(original[key]));
  // Old Gemini 0..10 output is accepted only when ALL fields use the same scale.
  const scale=values.every(v=>v<=10)?10:1;
  const scores=Object.fromEntries(REQUIRED_KEYS.map(key=>[key,clamp(Number(original[key])*scale)]));
  const evidence=input.score_evidence&&typeof input.score_evidence==='object'?input.score_evidence:{};
  const grounded=SCORED_KEYS.filter(key=>short(evidence[key],900).length>=15);
  if(grounded.length<7)throw new Error('VIRAL_EVIDENCE_INSUFFICIENT: au moins 7 critères doivent être justifiés par des observations.');
  const fixes=Array.isArray(input.fix_plan)?input.fix_plan:[];
  const concrete=fixes.filter(x=>x&&short(x.problem).length>=10&&short(x.exact_change).length>=18);
  // Never force a fix from a low score: unclear source, silent video or short clip
  // may have no defensible recommendation. Always prefer an honest empty plan.
  const timeline=Array.isArray(input.timeline)?input.timeline:[];
  const groundedMoments=timeline.filter(x=>x&&finite(x.start_sec)&&finite(x.end_sec)&&Number(x.end_sec)>=Number(x.start_sec)&&short(x.problem).length>=8);
  // Zero risky passages is a valid outcome. No invented retention dips.
  return {...input,scores,score_evidence:evidence,validation:{
    score_scale:scale===10?'normalized_0_10_to_0_100':'native_0_100',
    evidenced_criteria:grounded.length,concrete_fixes:concrete.length,
    grounded_moments:groundedMoments.length,source:'observed_video_not_instagram_analytics'
  }};
}
export function calculateScore(scores){
  if(!scores||SCORED_KEYS.some(key=>!finite(scores[key])))throw new Error('VIRAL_SCORE_INVALID: scoring incomplet.');
  return Math.round(SCORED_KEYS.reduce((sum,key)=>sum+clamp(Number(scores[key]))*SCORE_WEIGHTS[key],0)/100);
}
export function priorityDiagnostics(scores,evidence={},fixPlan=[],timeline=[],durationSec=null){
  const fixes=Array.isArray(fixPlan)?fixPlan:[];
  const moments=Array.isArray(timeline)?timeline:[];
  const duration=finite(durationSec)&&Number(durationSec)>0?Number(durationSec):null;
  return SCORED_KEYS.map(key=>{
    const score=clamp(Number(scores[key]||0)),weight=SCORE_WEIGHTS[key];
    const impact=Math.round((100-score)*weight*100/100)/100; // recoverable score points
    const fix=fixes.find(x=>exactArea(x?.area,key)&&short(x?.exact_change).length>0);
    const moment=moments.find(x=>exactArea(x?.label,key)&&short(x?.problem).length>0);
    const original=fix||moment||null;
    let start=finite(original?.start_sec)?Math.max(0,Number(original.start_sec)):null;
    let end=finite(original?.end_sec)?Math.max(0,Number(original.end_sec)):null;
    if(duration!==null){
      if(start!==null)start=Math.min(start,duration);
      if(end!==null)end=Math.min(end,duration);
    }
    if(start!==null&&end!==null&&end<start)end=start;
    return {
      key,score,weight,impact_points:Math.round(impact*100)/100,
      evidence:short(evidence[key],900)||null,
      start_sec:start,end_sec:end,
      problem:short(original?.problem)||null,
      exact_change:short(fix?.exact_change||moment?.correction)||null,
      example:short(fix?.example)||null,
      basis:'weighted_editorial_opportunity'
    };
  }).sort((a,b)=>b.impact_points-a.impact_points||a.score-b.score).map((x,i)=>({...x,rank:i+1}));
}
export function editorialRiskMap(timeline=[],durationSec=null){
  const end=finite(durationSec)&&Number(durationSec)>0?Number(durationSec):null;
  return (Array.isArray(timeline)?timeline:[])
    .filter(x=>['red','orange'].includes(x?.severity)&&short(x?.problem).length>0)
    .map(x=>{
      const start=Math.max(0,Number(x.start_sec)||0);
      const finish=Math.max(start,Number(x.end_sec)||start);
      return {
        start_sec:end===null?start:Math.min(end,start),
        end_sec:end===null?finish:Math.min(end,finish),
        severity:x.severity,
        observed_problem:short(x.problem),
        suggested_correction:short(x.correction),
        type:'estimated_editorial_dropout_risk',
        disclaimer:'Risque éditorial estimé : aucune donnée de rétention Instagram n’a été mesurée.'
      };
    }).sort((a,b)=>a.start_sec-b.start_sec);
}


/**
 * The score is a weighted editorial review, not a probability of virality.
 * Numeric signals are evidence for the reviewer, NEVER a blind grading formula.
 * Examples of wrong shortcuts: "0 cuts => -15 points", "225 WPM => 82/100",
 * "horizontal => a weak video", or "audio exists => 78/100".
 */
export const SCORE_RUBRIC=Object.freeze({
  0:'Incompréhensible ou défaut majeur observable',
  20:'Plusieurs obstacles éditoriaux importants, étayés par le contenu',
  40:'Intention perceptible mais exécution inégale',
  60:'Correct et compréhensible ; axes de progression précis',
  75:'Solide, cohérent et bien exécuté sur le critère',
  90:'Excellent, avec des éléments positifs exceptionnels observés',
  100:'Quasi irréprochable sur ce seul critère, preuve très forte requise'
});
export const SCORE_CRITERION_BASIS=Object.freeze({
  hook:'L’ouverture exprime une promesse réelle, précise et crédible dans le sujet de la vidéo.',
  scroll_stop:'Les éléments réellement présents dans les premières secondes donnent une raison perceptible de regarder. Ce n’est pas un taux de scroll-stop mesuré.',
  clarity:'Le message peut être compris sans effort excessif ; exemples et vocabulaire appropriés.',
  rhythm:'Le débit, le silence, les coupes et les mouvements sont intentionnels ; un plan fixe ou une pause ne sont pas des défauts automatiques.',
  retention:'La progression narrative, les exemples, les transitions et la conclusion soutiennent potentiellement l’attention ; pas une courbe de rétention réelle.',
  structure:'La démonstration suit une logique cohérente et apporte l’information annoncée.',
  text_captions:'Les éléments de texte présents sont lisibles et fidèles aux paroles. Ne pénalise pas automatiquement une vidéo sans sous-titres si le contexte ne le requiert pas.',
  visual:'Cadre et images servent le message. Le format horizontal natif n’est pas une faiblesse éditoriale intrinsèque.',
  audio:'Intelligibilité, niveaux et pertinence du son réel. Une vidéo silencieuse volontaire peut être excellente.',
  originality:'Angle, exemple, preuve ou perspective propre à CETTE vidéo, sans imposer du sensationnalisme.',
  cta:'La prochaine action est pertinente ou son absence est justifiée ; ce critère ne pèse pas dans le score.'
});
export function editorialScoreAudit(semantic,measurable){
  const sourceScores=semantic?.scores||{};
  // Scores have already been strictly checked by validateSemanticAnalysis().
  const scores=Object.fromEntries(REQUIRED_KEYS.map(key=>[key,clamp(Number(sourceScores[key]))]));
  const flags=[];
  const cuts=Number(measurable?.sceneCutsPer10Sec);
  const silent=Number(measurable?.silenceRatio);
  if(Number.isFinite(cuts)&&cuts===0)flags.push('Détecteur automatique : aucun changement de scène net. Cela ne prouve pas que l’image est statique ou que le montage est mauvais.');
  if(Number.isFinite(silent)&&silent>.2)flags.push('Silences détectés en audio : leur intention éditoriale doit être jugée dans le contexte, pas pénalisée automatiquement.');
  if(Number(measurable?.aspectRatio)>1)flags.push('Format horizontal : ne pas assimiler le cadrage natif à une faute de montage.');
  return {
    scores,
    audit:{
      methodology:'editorial_observed_quality_v1',
      version:SCORE_VERSION,
      not_a_virality_prediction:true,
      empirically_calibrated_against_platform_outcomes:false,
      machine_signals_used_as_context_not_auto_penalties:true,
      independent_criteria:true,
      score_basis:'Évaluation éditoriale argumentée, pondérée et versionnée ; sans métriques sociales externes',
      caveats:flags,
      criterion_anchors:SCORE_RUBRIC
    }
  };
}


/**
 * Catch invalid platform assumptions, not legitimate criticisms of framing.
 * A horizontal native video can still have a bad crop, but the container's
 * aspect ratio ALONE does not prove poor craft or a weak hook.
 */
export function detectUnsupportedFormatPenalty({evidence={},measurable={},review={}}={}){
  if(Number(measurable.aspectRatio||0)<1)return [];
  const contested=new Set(Array.isArray(review?.disputed_keys)?review.disputed_keys:[]);
  const results=[];
  for(const key of ['visual','scroll_stop','retention','rhythm']){
    const rationale=String(evidence[key]||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
    const aspect=/\b(16\s*[:/]\s*9|format horizontal|cadrage horizontal|horizontal natif|format paysage|mode paysage)\b/.test(rationale);
    const negative=/(limite|penalis|moins adapt|faible|defavor|frein|impact reduit|manque de|reste brut|visuellement brut|moins fort)/.test(rationale);
    const assumesVertical=/(flux mobile vertical|flux vertical|fil vertical|format vertical|reels vertical|tiktok vertical|shorts vertical)/.test(rationale);
    if(aspect&&negative&&(assumesVertical||contested.has(key))){
      results.push({criterion:key,issue:'native_horizontal_treated_as_vertical_failure',evidence:String(evidence[key]||'').slice(0,360)});
    }
  }
  return results;
}
