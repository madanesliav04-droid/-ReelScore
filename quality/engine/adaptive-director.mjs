/**
 * Experimental six-style semantic Edit Decision List.
 * This is a planner, not a premium renderer. Never fabricate timestamps,
 * values, B-roll sources or subject positions. Production is unchanged.
 */
export const STYLES=Object.freeze({
  codie:{intent:'business-documentary',font:'Noto Sans',accent:'#FF9B45',placement:'middle_low'},
  leila:{intent:'leadership-analysis',font:'Noto Serif',accent:'#E9DED0',placement:'upper-negative-space'},
  impact:{intent:'dynamic-argument',font:'DejaVu Sans',accent:'#37E6FF',placement:'middle_low'},
  clean:{intent:'minimal-professional',font:'Noto Sans',accent:'#FFFFFF',placement:'lower_third'},
  explainer:{intent:'visual-teaching',font:'DejaVu Sans',accent:'#7CE8FF',placement:'upper-mid'},
  ugc_native:{intent:'authentic-product',font:'DejaVu Sans',accent:'#FF3FBF',placement:'lower_middle'}
});
const signals={
  number:/(?:[$€£]\s*\d+|\d+[.,]?\d*\s*(?:%|euros?|dollars?|hours?|heures?|days?|jours?|clients?|minutes?|ans|years?)\b)/i,
  compare:/\b(?:contre|versus|vs\.?|instead|rather than|plus que|moins que|more than|less than|compar|person a|person b|whereas|alors que|différence)\b/i,
  step:/\b(?:premièrement|deuxièmement|troisièmement|ensuite|étape|premier|deuxième|first|second|third|step|next|finally|enfin)\b/i,
  contrast:/\b(?:mais|pourtant|sauf|jamais|erreur|however|but|never|mistake|wrong|instead|cannot|can't|impossible|false|fausse)\b/i,
  evidence:/\b(?:preuve|résultat|garantie|chiffre|coût|prix|revenu|example|exemple|evidence|result|proof|cost|profit|salary|hourly|sales)\b/i,
  demo:/\b(?:regarde|montre|clique|ouvre|écran|graphique|interface|look at|screen|click|dashboard|chart|demonstrat|show you)\b/i,
  product:/\b(?:produit|testé|j'utilise|acheté|livraison|product|review|unboxing|tried|using|bought|delivery)\b/i,
  question:/\?/,
  punch:/\b(?:seule chose|vraie raison|personne ne|secret|vérité|important|crucial|never|always|the truth|biggest|only way)\b/i
};
const num=n=>Math.max(0,Math.round(Number(n)||0));
const clean=s=>String(s||'').replace(/\s+/g,' ').trim();
export function speechUnits({words=[],segments=[],durationMs=0}={}){
  const end=num(durationMs);
  const valid=(Array.isArray(words)?words:[]).map(x=>({
    text:clean(x.text),startMs:num(x.startMs),endMs:num(x.endMs)
  })).filter(x=>x.text&&x.endMs>x.startMs&&x.startMs<end).sort((a,b)=>a.startMs-b.startMs);
  if(valid.length){
    const result=[];let group=[];
    const flush=()=>{if(group.length){result.push({
      text:group.map(x=>x.text).join(' ').replace(/\s+([,.!?;:])/g,'$1'),
      startMs:group[0].startMs,endMs:group.at(-1).endMs,timing:'word'
    });group=[];}};
    for(const w of valid){
      const last=group.at(-1);
      if(last&&(w.startMs-last.endMs>490||w.endMs-group[0].startMs>4000||group.length>=18))flush();
      group.push(w);if(/[!?;.]$/.test(w.text))flush();
    }flush();return result;
  }
  return (Array.isArray(segments)?segments:[]).map(x=>({
    text:clean(x.text),
    startMs:num(x.startMs??Number(x.startSeconds)*1000),
    endMs:num(x.endMs??Number(x.endSeconds)*1000),
    timing:'segment'
  })).filter(x=>x.text&&x.endMs>x.startMs&&x.startMs<end).sort((a,b)=>a.startMs-b.startMs);
}
function spokenNumbers(t){
  return [...String(t).matchAll(/(?:[$€£]\s*\d+(?:[.,]\d+)?|\d+(?:[.,]\d+)?\s*(?:%|€|\$|euros?|dollars?|hours?|heures?|jours?|days?|minutes?|ans|years?)?)/gi)].map(m=>m[0].trim());
}
export function adaptivePlan({
  style,durationMs,sourceId='',words=[],segments=[],verifiedMedia=[],visualFacts=[]
}={}){
  if(!STYLES[style])throw Error('Unsupported style '+style);
  const duration=num(durationMs);
  if(duration<1000)throw Error('Invalid source duration');
  const raw=speechUnits({words,segments,durationMs:duration});
  const unit=raw.map((u,index)=>{
    const flags=Object.fromEntries(Object.entries(signals).map(([k,re])=>[k,re.test(u.text)]));
    const base=flags.contrast*3+flags.punch*3+flags.number*2+flags.step*2+flags.demo*2+flags.evidence*2+flags.compare*2;
    const extra={
      codie:flags.contrast*3+flags.punch*2,
      leila:flags.number*5+flags.compare*4+flags.evidence*3+flags.step*2,
      impact:flags.contrast*5+flags.punch*5+flags.question*2,
      clean:flags.punch,
      explainer:flags.step*5+flags.demo*5,
      ugc_native:flags.product*5+flags.demo*2
    }[style];
    return {...u,index,flags,score:base+extra};
  });
  const actions=[];
  function emit(u,type,data={}){
    if(!u)return;
    actions.push({
      type,startMs:u.startMs,endMs:Math.min(u.endMs,duration),
      evidence:{text:u.text,timing:u.timing,index:u.index},
      confidence:u.timing==='word'?0.92:0.64,
      ...data
    });
  }
  const top=(predicate,n,gap=2200)=>{
    const ranked=unit.filter(predicate).sort((a,b)=>b.score-a.score||a.startMs-b.startMs),out=[];
    for(const x of ranked){
      if(out.length>=n)break;
      if(out.some(y=>Math.abs(y.startMs-x.startMs)<gap))continue;
      out.push(x);
    }
    return out.sort((a,b)=>a.startMs-b.startMs);
  };
  for(const u of unit)emit(u,'caption',{layout:STYLES[style].placement});
  const blocks=Math.max(1,Math.ceil(duration/30000));
  if(style==='codie'){
    for(const u of top(x=>x.flags.contrast||x.flags.punch,blocks*2,3000))
      emit(u,'narrative-crop',{scale:u.flags.punch?1.12:1.065,rationale:'Narrated contradiction or punchline'});
    for(const u of top(x=>x.flags.number&&x.flags.evidence,blocks,4500))
      emit(u,'spoken-fact',{figures:spokenNumbers(u.text),rationale:'Figures actually spoken'});
  }
  if(style==='leila'){
    for(const u of top(x=>x.flags.number||x.flags.compare||x.flags.step,blocks*3,2600))
      emit(u,'executive-diagram',{
        diagram:u.flags.compare?'comparison':u.flags.step?'steps':'spoken-figures',
        figures:spokenNumbers(u.text),layout:'upper-negative-space',
        rationale:'Accurate comparison, step, or narrated figure; never invent calculations'
      });
    for(const u of top(x=>x.flags.contrast&&!x.flags.number,blocks,4000))
      emit(u,'subtle-crop',{scale:1.045,rationale:'Understated leadership emphasis'});
  }
  if(style==='impact')
    for(const u of top(x=>x.flags.contrast||x.flags.punch||x.flags.question,blocks*4,1350))
      emit(u,'impact-emphasis',{scale:1.12,graphic:'spoken-keyword',rationale:'Actual hook, contrast, or strong statement'});
  if(style==='clean')
    for(const u of top(x=>x.flags.punch&&x.flags.contrast,blocks,3800))
      emit(u,'subtle-crop',{scale:1.035,rationale:'Rare justified emphasis'});
  if(style==='explainer'){
    let ordinal=0;
    for(const u of top(x=>x.flags.step||x.flags.demo,blocks*5,1700))
      emit(u,'demonstration',{ordinal:u.flags.step?++ordinal:null,source:'needs-real-interface-or-licensed-proof',rationale:'Actual spoken instruction'});
  }
  if(style==='ugc_native')
    for(const u of top(x=>x.flags.product,blocks*2,3500))
      emit(u,'product-focus',{source:'verify-product-in-source',rationale:'Only authentic product or gesture'});
  for(const u of top(x=>x.flags.demo||x.flags.evidence||x.flags.product,blocks*2,2500)){
    const media=(Array.isArray(verifiedMedia)?verifiedMedia:[]).find(m=>m?.licensed===true&&m?.verified===true&&
      String(m.spokenAnchor||'').length>=4&&u.text.toLowerCase().includes(String(m.spokenAnchor).toLowerCase()));
    if(media)emit(u,'verified-broll',{assetId:media.assetId,license:media.license||'user-owned',rationale:'Speech-grounded visually inspected media'});
  }
  actions.sort((a,b)=>a.startMs-b.startMs||(a.type==='caption'?-1:1));
  const wordAccurate=unit.length>0&&unit.every(x=>x.timing==='word');
  // Segment timing can span 20+ seconds; never falsely place animated graphics
  // or subtitles based on that imprecision. Allow editor suggestions only.
  return {
    contract:'editplus-adaptive-lab-1',style,sourceId,durationMs:duration,
    styleTokens:STYLES[style],renderReady:wordAccurate,
    // Preserve actual speech timing for subtitle reflow: never estimate word
    // positions from sentence length when composing visual captions.
    wordTiming:wordAccurate?(Array.isArray(words)?words.map(w=>({text:String(w.text||''),startMs:num(w.startMs),endMs:num(w.endMs)})):[]):[],
    actions:wordAccurate?actions:[],
    editorialSuggestions:wordAccurate?[]:actions.filter(a=>a.type!=='caption').map(a=>({...a,renderSafe:false})),
    audit:{
      speechUnits:unit.length,
      wordAccurate,
      visualFactsReviewed:Array.isArray(visualFacts)?visualFacts.length:0,
      warnings:[
        ...(!unit.length?['NO_TRANSCRIPT_NO_EDITORIAL_ACTIONS']:[]),
        ...(unit.length&&unit.some(x=>x.timing!=='word')?['SEGMENT_TIMING_NOT_FRAME_ACCURATE']:[]),
        ...(!visualFacts?.length?['NO_FACE_TRACKING_VALIDATION']:[]),
        ...(!verifiedMedia?.length?['NO_VERIFIED_BROLL_ASSETS']:[])
      ]
    }
  };
}
