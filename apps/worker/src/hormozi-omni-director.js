/**
 * Alex Hormozi-inspired explanatory montage with OMNI visual identity.
 * Staging-only: explicit verified speech + independently sampled frame safety.
 * This is a visual grammar, not a claim of a fully autonomous editor.
 */
import {makeHormoziMotionBeats} from './hormozi-beat-timing.js';
import {OMNI_BRAND_TOKENS,OMNI_LOGO_REFERENCE_VERSION} from './omni-brand-tokens.js';
export const HORMOZI_OMNI_VERSION='hormozi-omni-explainer-v1';
export const HORMOZI_OMNI_PALETTE=Object.freeze({
  graphite:OMNI_BRAND_TOKENS.slateNavy,
  ink:OMNI_BRAND_TOKENS.slateNavy,
  white:OMNI_BRAND_TOKENS.pearlWhite,
  chrome:OMNI_BRAND_TOKENS.chromeLight,
  cyan:OMNI_BRAND_TOKENS.iridescentBlue,
  violet:OMNI_BRAND_TOKENS.iridescentGlow,
  reference:OMNI_LOGO_REFERENCE_VERSION
});
export const HORMOZI_VISUAL_BEHAVIORS=Object.freeze({
  metric:{purpose:'spoken quantity made prominent',motion:'fast-reveal',sfx:'soft_low_hit'},
  sequence:{purpose:'ordered spoken steps progressively revealed',motion:'step-by-step',sfx:'quiet_tick'},
  comparison:{purpose:'two contrasting spoken ideas',motion:'split-reveal',sfx:'short_soft_whoosh'},
  chart:{purpose:'actual sourced measurements with visible source',motion:'trace-verified-data',sfx:'none'}
});
const normalize=s=>String(s??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'')
  .toLowerCase().replace(/œ/g,'oe').replace(/[^a-z0-9€$% ]+/g,' ').replace(/\s+/g,' ').trim();
const wordsOf=s=>normalize(s).split(' ').filter(Boolean);
function timedPhrase(phrase,words){
 const target=wordsOf(phrase),flat=[];
 if(!target.length||target.length>16)return null;
 for(const w of words||[]){
  const start=Number(w.startMs),end=Number(w.endMs);
  if(!Number.isFinite(start)||!Number.isFinite(end)||end<=start)continue;
  for(const t of wordsOf(w.text))flat.push({t,start,end});
 }
 for(let i=0;i<=flat.length-target.length;i++){
  if(target.every((t,j)=>flat[i+j].t===t))
   return {startMs:flat[i].start,endMs:flat[i+target.length-1].end};
 }
 return null;
}
function hasSafeBand(proof,start,end){
 if(proof?.source!=='independent_frame_sampler'||proof?.verified!==true)return false;
 const frames=(Array.isArray(proof.frames)?proof.frames:[])
   .filter(f=>Number.isFinite(Number(f.ms))&&f.ms>=start-300&&f.ms<=end+300)
   .sort((a,b)=>a.ms-b.ms);
 return frames.length>=5&&frames[0].ms<=start+300&&frames.at(-1).ms>=end-300&&
   frames.every(f=>Number(f.confidence)>=.90&&Number(f.clearTopNormalized)>=.18)&&
   frames.every((f,i)=>i===0||f.ms-frames[i-1].ms<=550);
}
const uniqueAnchors=(text,words)=>timedPhrase(text,words);
function textEvidence(p,words){
 const anchor=uniqueAnchors(p.spoken_anchor,words);if(!anchor)return null;
 if(p.type==='metric'){
  const raw=String(p.text||'').trim();
  // A metric needs a number actually present in the spoken anchor.
  if(!/\d/.test(raw)||!normalize(p.spoken_anchor).includes(normalize(raw)))return null;
  return {anchor,text:raw.slice(0,28)};
 }
 if(p.type==='sequence'){
  const items=Array.isArray(p.items)?p.items.filter(x=>String(x).trim()):[];
  if(items.length<2||items.length>5)return null;
  const matches=items.map(item=>uniqueAnchors(item,words));
  if(matches.some(x=>!x)||matches.some((x,i)=>i>0&&x.startMs<matches[i-1].startMs))return null;
  if(matches.some(x=>x.startMs<anchor.startMs-600||x.endMs>anchor.endMs+2500))return null;
  return {anchor,text:items.join(' / ').slice(0,100),items:items.map(x=>String(x).trim()),itemStarts:matches.map(x=>x.startMs)};
 }
 if(p.type==='comparison'){
  const left=String(p.left||'').trim(),right=String(p.right||'').trim();
  const a=uniqueAnchors(left,words),b=uniqueAnchors(right,words);
  if(!a||!b||a.startMs>b.startMs||a.startMs<anchor.startMs-450||b.endMs>anchor.endMs+1900)return null;
  return {anchor,text:left+' ≠ '+right,left,right,rightStartMs:b.startMs};
 }
 if(p.type==='chart'){
  const series=Array.isArray(p.series)?p.series:[];
  // Charts may only use supplied, independently cited measurements.
  if(p.source_verified!==true||!String(p.source_id||'').trim()||
    series.length<2||series.length>8||series.some(x=>!Number.isFinite(Number(x.value))||!String(x.label||'').trim()))
    return null;
  return {anchor,text:String(p.title||p.spoken_anchor).slice(0,65),
    sourceId:String(p.source_id).slice(0,100),
    series:series.map(x=>({label:String(x.label).slice(0,18),value:Number(x.value)}))};
 }
 return null;
}
export function planHormoziOmniStoryboard({analysis,words,durationMs,enabled=false}={}){
 const held=[],cues=[],soundIntents=[];
 if(!enabled)return {cues,held:[{reason:'FEATURE_OFF'}],soundIntents,policy:HORMOZI_OMNI_VERSION};
 const alignment=analysis?.transcript?.alignment;
 if(alignment?.method!=='forced_alignment'||alignment?.verified!==true||Number(alignment.confidence)<.92)
  return {cues,held:[{reason:'UNVERIFIED_SPEECH_ALIGNMENT'}],soundIntents,policy:HORMOZI_OMNI_VERSION};
 if(!Array.isArray(words)||!words.length||!Number.isFinite(Number(durationMs))||durationMs<1000)
  return {cues,held:[{reason:'MISSING_TIMED_SPEECH'}],soundIntents,policy:HORMOZI_OMNI_VERSION};
 const proposals=Array.isArray(analysis?.hormozi_storyboards)?analysis.hormozi_storyboards:[];
 for(const [i,p] of proposals.slice(0,16).entries()){
  if(!HORMOZI_VISUAL_BEHAVIORS[p.type]){held.push({i,reason:'UNSUPPORTED_GRAPHIC_TYPE'});continue}
  if(p.type==='chart'){held.push({i,reason:'CHART_RENDERER_PENDING_INDEPENDENT_PIXEL_QA'});continue}
  const evidence=textEvidence(p,words);
  if(!evidence){held.push({i,reason:'UNSPOKEN_OR_UNVERIFIED_VISUAL'});continue}
  const start=evidence.anchor.startMs,end=Math.min(durationMs,Math.max(evidence.anchor.endMs+600,start+1250));
  if(!hasSafeBand(analysis?.composition_proof,start,end)){held.push({i,reason:'UNVERIFIED_DYNAMIC_FRAME_SAFETY'});continue}
  if(cues.some(c=>start<c.endMs+1200&&end>c.startMs-1200)){held.push({i,reason:'TOO_DENSE'});continue}
  const cue={mode:'hormozi_omni',type:p.type,startMs:start,endMs:end,
   text:evidence.text,spoken_anchor:String(p.spoken_anchor),evidence:'verbatim_speech_plus_independent_frames',
   textFamily:'Futura reference; geometric sans fallback',
   palette:OMNI_LOGO_REFERENCE_VERSION,editorialPurpose:HORMOZI_VISUAL_BEHAVIORS[p.type].purpose,
   ...(evidence.items?{items:evidence.items}:{}),
   ...(evidence.itemStarts?{itemStarts:evidence.itemStarts}:{}),
   ...(evidence.left?{left:evidence.left,right:evidence.right,rightStartMs:evidence.rightStartMs}:{}),
   ...(evidence.series?{series:evidence.series,sourceId:evidence.sourceId}:{}),
   renderingApproval:'requires_human_review'};
  const timing=makeHormoziMotionBeats(cue);
  if(timing.held){held.push({i,reason:timing.held});continue}
  cue.motionBeats=timing.beats;
  cue.motionTimingPolicy=timing.policy;
  cues.push(cue);
  const sound=HORMOZI_VISUAL_BEHAVIORS[p.type].sfx;
  if(sound!=='none')soundIntents.push({atMs:start,kind:sound,permission:'preview_only_not_mixed'});
  if(cues.length>=Math.ceil(durationMs/30000*3))break;
 }
 return {policy:HORMOZI_OMNI_VERSION,cues,held,soundIntents,
  notValidated:['real_clip_render','licensed_proof_broll','audio_mix','independent_creative_review']};
}
