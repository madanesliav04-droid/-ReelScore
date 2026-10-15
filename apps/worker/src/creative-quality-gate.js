/**
 * Edit+ Creative Quality Gate (staging, opt-in).
 * Rejects ungrounded B-roll and gratuitous graphics before FFmpeg/Remotion.
 * No fixed animation cadence. Failing to find a valid visual = keep the facecam.
 * Existing caption QA + pixel verification remain independently mandatory.
 */
export const CREATIVE_GATE_VERSION='editplus-creative-gate-v1';

const normalized=s=>String(s??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'')
  .toLowerCase().replace(/[^a-z0-9 ]/g,' ').replace(/\s+/g,' ').trim();
const tokens=s=>normalized(s).split(' ').filter(Boolean);
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const genericStock=/\b(business meeting|corporate office|professional office|person working|people working|happy business|smiling business|keyboard typing|typing laptop|laptop typing|man at computer|office desk|stock trading screens)\b/i;
const fakeProof=/\b(testimonial|case study|growth chart|profit chart|revenue dashboard|sales dashboard|payment confirmation)\b/i;
const concrete=[
  {spoken:/\b(instagram|likes?|reseaux sociaux|followers?|abonnes?|commentaires?|dm|notifications?)\b/,
   visual:/\b(instagram|social media|like|heart|notification|comments?|smartphone|phone screen)\b/,label:'social'},
  {spoken:/\b(argent|euros?|prix|payer|achat|vente|facture|revenu)\b/,
   visual:/\b(cash|money|euros?|coins?|invoice|receipt|payment|price|transaction)\b/,label:'money'},
  {spoken:/\b(se former|forme encore|formation|apprendre|etudi|cours|lecon|tutorial)\b/,
   visual:/\b(course|training|lesson|learning|study|studying|tutorial|classroom|workshop|notebook)\b/,label:'learning'},
  {spoken:/\b(aider|aide|accompagner|expliquer|montrer|collaborer|ensemble)\b/,
   visual:/\b(helping|teaching|coaching|mentoring|assisting|demonstrating|explaining|collaborat)\b/,label:'help'},
  {spoken:/\b(contrat|signer|signature|document|papier)\b/,
   visual:/\b(contract|signing|document|signature|paperwork)\b/,label:'document'},
  {spoken:/\b(telephone|portable|iphone|smartphone|appeler|appel)\b/,
   visual:/\b(phone|smartphone|iphone|calling)\b/,label:'phone'},
  {spoken:/\b(filmer|camera|video|tourner|montage|monter)\b/,
   visual:/\b(camera|filming|recording|editing|video timeline)\b/,label:'production'},
  {spoken:/\b(ordinateur|clavier|laptop|pc)\b/,
   visual:/\b(laptop|computer|keyboard|pc)\b/,label:'computer'}
];
const profiles={
  v15_b:{maxBrollPer30s:1.5,maxGraphicsPer30s:3,minGraphicGapMs:1850,minBrollGapMs:3500},
  codie:{maxBrollPer30s:1.5,maxGraphicsPer30s:3,minGraphicGapMs:1850,minBrollGapMs:3500},
  ugc_native:{maxBrollPer30s:2,maxGraphicsPer30s:2,minGraphicGapMs:2300,minBrollGapMs:2600},
  impact:{maxBrollPer30s:4,maxGraphicsPer30s:4,minGraphicGapMs:1000,minBrollGapMs:1900},
  alex:{maxBrollPer30s:3,maxGraphicsPer30s:4,minGraphicGapMs:1200,minBrollGapMs:2200},
  clean:{maxBrollPer30s:2,maxGraphicsPer30s:2,minGraphicGapMs:2400,minBrollGapMs:3500}
};
const isNum=x=>typeof x==='number'&&Number.isFinite(x);
const overlap=(a,b)=>a.startMs<b.endMs&&a.endMs>b.startMs;
const numeric=s=>normalized(s).match(/\b\d+(?:\s\d+)*\b/g)||[];

function spokenWindow(captions,start,end){
 return (captions||[]).filter(c=>
    Number(c.endMs)>start-350&&Number(c.startMs)<end+500
  ).map(c=>String(c.text||'')).join(' ');
}
function matchesVisualEvidence(speech,visual){
 const spoken=normalized(speech),shown=normalized(visual);
 const hits=concrete.filter(c=>c.spoken.test(spoken));
 // Abstract language alone cannot authorize a generic photographed scene.
 return hits.some(c=>c.visual.test(shown));
}
function isGenericBroll(cue){
 const q=String(cue.query||cue.visualAnchor||'');
 return genericStock.test(normalized(q))||
        /^(business|success|expertise|motivation|team|office|laptop|computer|working)$/i.test(q.trim());
}
const symbolEvidence=[
 {names:['why','question','?'],spoken:/\b(pourquoi|question|raison|why)\b/},
 {names:['money','euro','€'],spoken:/\b(argent|euros?|prix|payer|vente|revenu|money)\b/},
 {names:['zero','0'],spoken:/\b(zero|aucun|rien|0)\b/},
 {names:['heart','coeur','cœur','♥'],spoken:/\b(coeurs?|toucher|emotions?|aider|love|heart)\b/},
 {names:['clock','time','temps'],spoken:/\b(temps|heures?|minutes?|secondes?|time)\b/},
 {names:['help','aide'],spoken:/\b(aider|aide|besoin|help)\b/}
];
/** Pre-search editorial check; avoids downloading visually irrelevant stock. */
export function preflightBrollProposal({cue,captions=[]}={}){
 const startMs=Number(cue?.startMs),endMs=Number(cue?.endMs);
 if(!isNum(startMs)||!isNum(endMs)||endMs<=startMs)
  return {eligible:false,reason:'INVALID_BROLL_TIMING'};
 const speech=spokenWindow(captions,startMs,endMs);
 const desc=[cue?.query,cue?.visualAnchor].filter(Boolean).join(' ');
 if(!speech.trim())return {eligible:false,reason:'NO_SPOKEN_ANCHOR'};
 if(isGenericBroll(cue))return {eligible:false,reason:'GENERIC_STOCK'};
 if(fakeProof.test(normalized(desc)))
  return {eligible:false,reason:'POTENTIAL_FAKE_PROOF'};
 if(!matchesVisualEvidence(speech,desc))
  return {eligible:false,reason:'NO_NARRATIVE_VISUAL_MATCH'};
 return {eligible:true,reason:'SPOKEN_GROUNDED_VISUAL'};
}

function hasGraphicAnchor(graphic,speech){
 const speechNorm=normalized(speech);
 const name=String(graphic.kind||graphic.symbol||graphic.icon||'').trim().toLowerCase();
 const match=symbolEvidence.find(x=>x.names.includes(name));
 if(match&&match.spoken.test(speechNorm))return true;
 const visible=normalized(graphic.text||graphic.spoken_anchor||'');
 if(!visible)return false;
 const spoken=normalized(speech);
 const words=tokens(visible).filter(w=>w.length>2);
 if(graphic.kind==='stat'||graphic.mode==='data'||graphic.figures?.length){
   const numbers=numeric(visible);
   if(!numbers.length||!numbers.every(n=>numeric(spoken).includes(n)))return false;
 }
 const spokenTokens=new Set(tokens(spoken));
 return words.length>0 && words.every(w=>spokenTokens.has(w));
}
function hasEditorialEvidence(graphic){
 return ['timestamped_transcript','gemini_visual_observation_plus_verbatim_timed_words','analysis_timeline'].includes(graphic.evidence);
}

/**
 * @param {{timeline:object, brollCues?:object[], graphicCues?:object[], style?:string}} input
 * @returns {{brollCues:object[],graphicCues:object[],rejected:object[],audit:object}}
 */
export function reviewCreativeTimeline({timeline,brollCues,graphicCues,style}={}){
 const duration=Math.max(0,Number(timeline?.outputDurationMs)||0);
 const captions=Array.isArray(timeline?.captions)?timeline.captions:[];
 const width=Number(timeline?.width),height=Number(timeline?.height);
 const aspect=isNum(width)&&width>0&&isNum(height)&&height>0
   ?width/height:Number(timeline?.sourceAspect)||1;
 const horizontal=aspect>=1.2;
 const model=String(style||timeline?.style||'clean').toLowerCase();
 const cfg=profiles[model]||profiles.clean;
 const profile={...cfg};
 // Horizontal native has room for small contextual UI; B-roll is rare, never mandatory.
 if(horizontal){
   profile.maxBrollPer30s=Math.min(profile.maxBrollPer30s,1.5);
   profile.maxGraphicsPer30s=Math.min(profile.maxGraphicsPer30s,3);
 }
 const rejected=[],broll=[],graphics=[];
 if(duration<1000||!captions.length){
   return {policy:CREATIVE_GATE_VERSION,brollCues:[],graphicCues:[],rejected:[{kind:'all',reason:'NO_TIMED_TRANSCRIPT'}],
    audit:{format:horizontal?'horizontal':'vertical',status:'held_no_transcript'}};
 }
 const capB=Math.max(0,Math.ceil(duration/30000*profile.maxBrollPer30s));
 const capG=Math.max(0,Math.floor(duration/30000*profile.maxGraphicsPer30s));
 for(const cue of [...(brollCues||[])].sort((a,b)=>a.startMs-b.startMs)){
   const start=Number(cue.startMs),end=Number(cue.endMs);
   let reason=null;
   const speech=spokenWindow(captions,start,end);
   const desc=[cue.query,cue.visualAnchor,cue.alt,cue.reason].filter(Boolean).join(' ');
   if(!isNum(start)||!isNum(end)||end-start<1000||start<0||end>duration+250)reason='INVALID_BROLL_TIMING';
   else if(broll.length>=capB)reason='BROLL_BUDGET_REACHED';
   else if(isGenericBroll(cue))reason='GENERIC_STOCK';
   else if(fakeProof.test(normalized(desc)))reason='POTENTIAL_FAKE_PROOF';
   else if(!matchesVisualEvidence(speech,desc))reason='NO_NARRATIVE_VISUAL_MATCH';
   else if(broll.some(prev=>start<prev.endMs+profile.minBrollGapMs))reason='BROLL_TOO_CLOSE';
   if(reason)rejected.push({kind:'broll',reason,startMs:start,query:String(cue.query||'').slice(0,100)});
   else broll.push({...cue,creativeEvidence:'speech_window_plus_shot_metadata',creativeGateVersion:CREATIVE_GATE_VERSION});
 }
 // Allowed motion graphics must have a precise spoken word anchor, NOT a template rhythm.
 for(const cue of [...(graphicCues||[])].sort((a,b)=>a.startMs-b.startMs)){
   const start=Number(cue.startMs),end=Number(cue.endMs);
   let reason=null;
   const speech=spokenWindow(captions,start,end);
   if(!isNum(start)||!isNum(end)||start<0||end<=start||end>duration+250)reason='INVALID_GRAPHIC_TIMING';
   else if(Number(cue.screenAreaRatio||0)>.15)reason='OVERSIZED_UI_COVERS_SCENE';
   else if(graphics.length>=capG)reason='GRAPHIC_BUDGET_REACHED';
   else if(cue.mode==='organic'||cue.mode==='multimodal_organic'||cue.mode==='premium_storyboard'){
      const iconName=String(cue.kind||cue.symbol||cue.icon||'').trim().toLowerCase();
      const groundedSymbol=symbolEvidence.some(x=>x.names.includes(iconName)&&x.spoken.test(normalized(speech)));
      if(!hasEditorialEvidence(cue)&&!cue.spoken_anchor&&!groundedSymbol)reason='UNVERIFIED_GRAPHIC_ANCHOR';
      else if(!hasGraphicAnchor(cue,speech))reason='UNSPOKEN_GRAPHIC_CLAIM';
   }else if(!hasGraphicAnchor(cue,speech))reason='DECORATIVE_OR_UNSPOKEN_GRAPHIC';
   // These constraints apply to every mode, including grounded organic graphics.
   if(!reason&&graphics.some(prev=>start<prev.endMs+profile.minGraphicGapMs))reason='GRAPHICS_TOO_DENSE';
   if(!reason&&broll.some(shot=>overlap(shot,{startMs:start,endMs:end})))reason='COMPETES_WITH_BROLL';
   if(reason)rejected.push({kind:'graphic',reason,startMs:start,text:String(cue.text||'').slice(0,80)});
   else graphics.push({...cue,creativeEvidence:'spoken_caption_anchor',creativeGateVersion:CREATIVE_GATE_VERSION});
 }
 return {policy:CREATIVE_GATE_VERSION,brollCues:broll,graphicCues:graphics,rejected,
  audit:{format:horizontal?'horizontal':'vertical',model,durationMs:duration,
    brollCandidates:(brollCues||[]).length,brollAccepted:broll.length,
    graphicCandidates:(graphicCues||[]).length,graphicAccepted:graphics.length,
    nonActionIsValid:true,
    limitations:'Transcript/metadata gates only. Visual pixel QA and subjective editorial review are separate.'}};
}
