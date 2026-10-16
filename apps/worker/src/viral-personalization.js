// Viral+ editorial grounding. A testable hypothesis is never a measured performance gain.
// Deterministic lexical checks provide guardrails, not proof of semantic truth.
const text=v=>String(v??'').trim();
const canonical=v=>text(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/['’]/g,' ').replace(/[^a-z0-9]+/g,' ').trim().replace(/\s+/g,' ');
const tokens=v=>canonical(v).split(' ').filter(Boolean);
const STOP=new Set('je tu il elle nous vous ils elles de du des un une les le la l d a au aux en et est sont sur pour par dans avec que qui quoi ou ou ca ce ces cet cette son sa ses mes tes votre vos notre nos comme plus pas ne se on y il faut faire avoir etre un une the this that for and you your from with how why what are was can not into'.split(' '));
const meaningful=v=>tokens(v).filter(w=>w.length>2&&!STOP.has(w));
const excerptInSource=(needle,source)=>{
  const n=canonical(needle),s=canonical(source);
  if(n.length<12||!s)return false;
  if(s.includes(n))return true;
  const target=n.split(' ').filter(Boolean);
  const sourceTokens=s.split(' ').filter(Boolean);
  if(target.length<4||sourceTokens.length<target.length)return false;
  // Require a near-contiguous ASR match; scattered keywords cannot pass.
  let best=0;
  for(let i=0;i<=sourceTokens.length-target.length;i++){
    let matches=0;
    for(let j=0;j<target.length;j++)if(sourceTokens[i+j]===target[j])matches++;
    best=Math.max(best,matches/target.length);
  }
  return best>=.85;
};
const suspicious=/\b(garanti|garantie de resultats?|viral assure|100 ?% de vues|devenir riche|exploser a coup sur|sans aucun effort|gain certain)\b/i;
const vague=/(^|\b)(tu veux savoir|le secret|personne ne (te|vous) dit|regarde jusqu a la fin|incroyable astuce|c est fou|deviens viral|change ta vie|voici pourquoi)(\b|$)/i;
const numericClaims=v=>[...new Set((canonical(v).match(/\b\d+(?:[.,]\d+)?\b/g)||[]))];
const isConcrete=v=>meaningful(v).length>=3;
export function reviewHookSuggestions(rawCandidates,transcript,context={}){
  const source=text(transcript?.text)||text((transcript?.words||[]).map(x=>x.text).join(' '));
  const candidates=Array.isArray(rawCandidates)?rawCandidates:[];
  const accepted=[],rejected=[];
  for(const [i,item] of candidates.slice(0,5).entries()){
    const proposed=text(item?.proposed_hook||item?.text);
    const sourceQuote=text(item?.source_quote);
    const why=text(item?.why_test);
    const hypothesis=text(item?.test_hypothesis);
    const change=text(item?.variable_changed);
    const problems=[];
    if(!source)problems.push('TRANSCRIPTION_ABSENTE');
    if(!excerptInSource(sourceQuote,source))problems.push('CITATION_SOURCE_NON_VERIFIABLE');
    if(proposed.length<18||proposed.length>240||!isConcrete(proposed))problems.push('ACCROCHE_TROP_VAGUE');
    if(vague.test(canonical(proposed)))problems.push('FORMULE_GENERIQUE');
    if(suspicious.test(canonical(proposed)))problems.push('PROMESSE_NON_DEMONTREE');
    const sourceTerms=new Set(meaningful(sourceQuote));
    const transcriptTerms=new Set(meaningful(source));
    const overlapping=meaningful(proposed).filter(w=>sourceTerms.has(w)||transcriptTerms.has(w));
    if(new Set(overlapping).size<2)problems.push('HORS_SUJET_OU_SANS_ANCRAGE');
    const numbers=numericClaims(proposed).filter(n=>!numericClaims(source).includes(n));
    if(numbers.length)problems.push('CHIFFRE_NON_PRESENT_DANS_LA_VIDEO');
    if(why.length<25||hypothesis.length<20||change.length<8)problems.push('JUSTIFICATION_OU_TEST_INCOMPLET');
    if(canonical(proposed)===canonical(sourceQuote))problems.push('AUCUN_CHANGEMENT');
    if(accepted.some(x=>canonical(x.proposed_hook)===canonical(proposed)))problems.push('DOUBLON');
    if(problems.length){
      rejected.push({index:i+1,reasons:problems});
      continue;
    }
    accepted.push({
      proposed_hook:proposed,
      source_quote:sourceQuote,
      why_test:why,
      test_hypothesis:hypothesis,
      variable_changed:change,
      experiment:'Comparer A (accroche actuelle) et B (accroche proposée) sur des publications comparables, avec la même durée et le même sujet ; examiner les données réelles disponibles.',
      status:'hypothesis_ready_for_test',
      claim:'Hypothèse éditoriale fondée sur le discours, pas une promesse de performance.'
    });
  }
  return {
    candidates:accepted.slice(0,3),
    rejected_count:rejected.length,
    rejected_reasons:rejected,
    status:accepted.length?'testable_hypotheses':'insufficient_verified_context',
    caution:'Aucune accroche ne peut être déclarée meilleure sans résultat de test réel.'
  };
}
export function reviewEditorialFixes(fixes,transcript,durationSec){
  const source=text(transcript?.text)||text((transcript?.words||[]).map(x=>x.text).join(' '));
  const max=Number.isFinite(Number(durationSec))&&Number(durationSec)>0?Number(durationSec):null;
  const approved=[],rejected=[];
  for(const [i,x] of (Array.isArray(fixes)?fixes:[]).slice(0,8).entries()){
    const type=text(x?.evidence_type).toLowerCase();
    const quote=text(x?.source_quote),observed=text(x?.observable_evidence);
    const action=text(x?.exact_change),example=text(x?.example);
    const start=Number(x?.start_sec),end=Number(x?.end_sec);
    const errors=[];
    if(!['transcript','visual','audio','technical'].includes(type))errors.push('TYPE_PREUVE_ABSENT');
    if(!Number.isFinite(start)||!Number.isFinite(end)||start<0||end<start||(max!==null&&end>max+1))errors.push('TIMESTAMP_INVALIDE');
    if(observed.length<22)errors.push('OBSERVATION_NON_SPECIFIQUE');
    if(action.length<28||!isConcrete(action)||vague.test(canonical(action)))errors.push('CORRECTION_GENERIQUE');
    // Precise-looking but decorative changes are not evidence-based fixes.
    const gratuitous=/\b(transitions? aleatoires?|b roll generiques?|explosions?|effets? gratuits?|images? au hasard|zooms? aleatoires?)\b/i;
    if(gratuitous.test(canonical(action+' '+example)))errors.push('EFFETS_NON_MOTIVES');
    if(example.length<16)errors.push('EXEMPLE_NON_PERSONNALISE');
    if(type==='transcript'&&!excerptInSource(quote,source))errors.push('CITATION_INTROUVABLE');
    if(errors.length){rejected.push({index:i+1,reasons:errors});continue;}
    approved.push({
      ...x,
      evidence_type:type,
      source_quote:quote,
      observable_evidence:observed,
      evidence_status:type==='transcript'?'transcript_excerpt_verified':'model_observation_to_verify',
      expected_effect:text(x.expected_effect)||'Hypothèse de clarification éditoriale à vérifier, sans promesse de vues.'
    });
  }
  return {fixes:approved,rejected,review_status:approved.length?'grounded_diagnostics':'not_enough_evidence'};
}

export function reviewSupplementalCopy(raw,transcript,kind='title'){
  const proposed=text(raw);
  const source=text(transcript?.text)||text((transcript?.words||[]).map(x=>x.text).join(' '));
  if(!source||!proposed||proposed.length>240)return {text:'',status:'not_verified'};
  const keywordOverlap=new Set(meaningful(proposed).filter(word=>meaningful(source).includes(word)));
  const inventedNumbers=numericClaims(proposed).filter(number=>!numericClaims(source).includes(number));
  const valid=keywordOverlap.size>=2&&inventedNumbers.length===0
    &&!suspicious.test(canonical(proposed))&&!vague.test(canonical(proposed));
  return {text:valid?proposed:'',status:valid?'hypothesis_related_to_video':'not_verified',
    kind,note:'Texte proposé à tester ; cohérence sémantique à contrôler avant publication.'};
}

export function reviewedTimelineMoments(timeline,verifiedFixes){
  const fixes=(Array.isArray(verifiedFixes)?verifiedFixes:[])
    .filter(f=>Number.isFinite(Number(f.start_sec))&&Number.isFinite(Number(f.end_sec))&&Number(f.end_sec)>Number(f.start_sec));
  return (Array.isArray(timeline)?timeline:[])
    .filter(moment=>fixes.some(fix=>{
      const a=Number(moment.start_sec),b=Number(moment.end_sec);
      if(!Number.isFinite(a)||!Number.isFinite(b)||b<a)return false;
      // The same verified editorial issue must overlap the claimed passage.
      return a<Number(fix.end_sec)+.25&&b>Number(fix.start_sec)-.25;
    })).map(item=>({...item,evidence_status:'checked_against_approved_video_fix'}));
}
