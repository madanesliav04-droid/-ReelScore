// Viral+ V5 editorial quality contracts. No private social-platform ranking weights.
export const SCORE_VERSION='vp-score-5-evidence-priority';
export const SCORE_WEIGHTS=Object.freeze({
  hook:20,scroll_stop:10,clarity:10,rhythm:5,retention:20,
  structure:10,text_captions:5,visual:5,audio:5,cta:0,originality:10
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
  if(grounded.length<8)throw new Error('VIRAL_EVIDENCE_INSUFFICIENT: au moins 8 critères doivent être justifiés par des observations.');
  const fixes=Array.isArray(input.fix_plan)?input.fix_plan:[];
  const concrete=fixes.filter(x=>x&&short(x.problem).length>=10&&short(x.exact_change).length>=18);
  if(concrete.length<2)throw new Error('VIRAL_FIX_PLAN_INSUFFICIENT: corrections exécutables manquantes.');
  const timeline=Array.isArray(input.timeline)?input.timeline:[];
  const groundedMoments=timeline.filter(x=>x&&finite(x.start_sec)&&finite(x.end_sec)&&Number(x.end_sec)>=Number(x.start_sec)&&short(x.problem).length>=8);
  if(groundedMoments.length<2)throw new Error('VIRAL_TIMELINE_INSUFFICIENT: passages horodatés non démontrés.');
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
