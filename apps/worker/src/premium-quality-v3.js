/**
 * Viral Studio / Edit+ — V3 experimental quality director.
 * Editorial candidates are not automatically proven-safe operations.
 * Gemini timed words are not independent phonetic alignment.
 */
const finite=x=>x!==null&&x!==undefined&&x!==''&&Number.isFinite(Number(x));
const overlaps=(a,b,tolerance=0)=>Math.min(a.endMs,b.endMs)-Math.max(a.startMs,b.startMs)>tolerance;
const inside=(x,lo,hi)=>finite(x)&&Number(x)>=lo&&Number(x)<=hi;

/** Accept cuts only with independent word alignment AND tracked subject continuity. */
export function assessCutCandidates({candidates=[],analysis={},durationMs=0}={}){
 const transcript=analysis?.transcript||{},alignment=transcript.alignment||{};
 const aligned=alignment.method==='forced_alignment'&&alignment.verified===true&&
   finite(alignment.confidence)&&Number(alignment.confidence)>=.92;
 const words=Array.isArray(transcript.words)?transcript.words:[];
 const tracks=Array.isArray(analysis?.motion_evidence?.windows)?analysis.motion_evidence.windows:[];
 const accepted=[],held=[];
 for(const c of candidates){
  const startMs=Number(c.startMs),endMs=Number(c.endMs),reasons=[];
  if(!inside(c.startMs,0,durationMs)||!inside(c.endMs,0,durationMs)||endMs-startMs<120)
   reasons.push('INVALID_CUT_WINDOW');
  if(!aligned||!words.length)reasons.push('UNVERIFIED_WORD_ALIGNMENT');
  if(aligned&&words.length){
   const touchesSpeech=words.some(w=>finite(w.startMs)&&finite(w.endMs)&&
     Number(w.endMs)>startMs-85&&Number(w.startMs)<endMs+85);
   if(touchesSpeech)reasons.push('CUT_TOUCHES_SPEECH');
   const prev=[...words].reverse().find(w=>Number(w.endMs)<=startMs);
   const next=words.find(w=>Number(w.startMs)>=endMs);
   if(!prev||!next)reasons.push('MISSING_SPEECH_CONTEXT');
  }
  const tracked=tracks.find(w=>{
   const st=Number(w.startMs),ed=Number(w.endMs);
   return finite(w.startMs)&&finite(w.endMs)&&st<=startMs-150&&ed>=endMs+150&&
     w.basis==='independent_frame_tracking'&&w.gestureContinuitySafe===true&&
     w.subjectContinuitySafe===true&&Number(w.framesChecked)>=8&&Number(w.confidence)>=.90;
  });
  if(!tracked)reasons.push('UNVERIFIED_GESTURE_CONTINUITY');
  if(reasons.length)held.push({...c,decision:'HOLD',reasons});
  else accepted.push({...c,decision:'ALLOW',evidence:{wordAlignment:alignment.method,gestureTracking:tracked.basis}});
 }
 return {accepted,held,policy:'editplus-proof-first-v3'};
}

/** One dominant editorial intervention at a time; captions remain independent. */
export function arbitrateEditorialEffects({punchIns=[],graphicCues=[],brollCues=[],durationMs=0}={}){
 const items=[],rejected=[];
 const inputs=[
  ...graphicCues.map((v,i)=>({kind:'graphic',priority:3,index:i,raw:v})),
  ...brollCues.map((v,i)=>({kind:'broll',priority:2,index:i,raw:v})),
  ...punchIns.map((v,i)=>({kind:'punch',priority:1,index:i,raw:v}))
 ];
 for(const item of inputs){
  const c=item.raw;
  if(!inside(c.startMs,0,durationMs)||!inside(c.endMs,0,durationMs+150)||Number(c.endMs)<=Number(c.startMs)){
   rejected.push({kind:item.kind,index:item.index,reason:'INVALID_EFFECT_INTERVAL'});continue;
  }
  if(item.kind==='graphic'&&!String(c.text||'').trim()){
   rejected.push({kind:item.kind,index:item.index,reason:'EMPTY_GRAPHIC'});continue;
  }
  items.push({...item,startMs:Number(c.startMs),endMs:Number(c.endMs)});
 }
 items.sort((a,b)=>b.priority-a.priority||a.startMs-b.startMs);
 const kept=[];
 for(const item of items){
  const collides=kept.find(k=>overlaps(item,k,0));
  if(collides)rejected.push({kind:item.kind,index:item.index,reason:'DOMINANT_EFFECT_COLLISION',with:collides.kind});
  else kept.push(item);
 }
 const entries=kind=>kept.filter(x=>x.kind===kind).sort((a,b)=>a.startMs-b.startMs).map(x=>x.raw);
 return {graphicCues:entries('graphic'),brollCues:entries('broll'),punchIns:entries('punch'),rejected,policy:'one-dominant-effect-v3'};
}

/** A structured constraint report is NOT certification of aesthetic quality. */
export function inspectPremiumQuality({analysis={},timeline={},cutReview=null,effectReview=null}={}){
 const blocking=[],notVerified=[],words=analysis?.transcript?.words||[],alignment=analysis?.transcript?.alignment;
 if(!Array.isArray(words)||!words.length)blocking.push('NO_TIMED_TRANSCRIPT');
 if(alignment?.method!=='forced_alignment'||alignment?.verified!==true)
  notVerified.push('SPEECH_ALIGNMENT_NOT_INDEPENDENTLY_VERIFIED');
 if(!analysis?.motion_evidence?.verified)
  notVerified.push('DYNAMIC_SUBJECT_TRACKING_NOT_VERIFIED');
 if(!analysis?.creative_review?.blind_human_pass)
  notVerified.push('ARTISTIC_QUALITY_NOT_BLIND_REVIEWED');
 const total=Number(timeline.outputDurationMs)||0;
 const kept=(timeline.keepRanges||[]).reduce((s,r)=>s+Math.max(0,Number(r.endMs)-Number(r.startMs)),0);
 if(total<500||Math.abs(kept-total)>5)blocking.push('INVALID_TIME_MAP');
 const effects=(timeline.graphicCues||[]).length+(timeline.punchIns||[]).length+(timeline.brollCues||[]).length;
 return {policy:'premium-creative-qa-v3',
   verdict:blocking.length?'INVALID_TECHNICAL_PLAN':notVerified.length?'NOT_PROVEN_PREMIUM':'READY_FOR_ARTISTIC_REVIEW',
   blocking,notVerified,
   metrics:{retainedDurationMs:kept,editorialEffects:effects,heldCuts:cutReview?.held?.length||0,
    heldConflictingEffects:effectReview?.rejected?.length||0},
   promise:'This report validates constraints, never aesthetic quality or virality.'};
}