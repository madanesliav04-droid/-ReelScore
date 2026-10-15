/**
 * OMNI editorial intent planner V2.
 * Every cue is grounded in a contiguous spoken phrase, never a single keyword
 * used to justify decorative icons. No fabricated numbers, outcomes or proofs.
 * Tracking evidence is mandatory before placing any overlay.
 */
const norm=s=>String(s??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/œ/g,'oe').toLowerCase()
  .replace(/[^a-z0-9€% ]/g,' ').replace(/\s+/g,' ').trim();
const finite=n=>Number.isFinite(Number(n));
const styleBudgets={codie:2,impact:3,clean:1,authority:1,explainer:3,data:2,ugc_native:1,cinematic_story:1};
const patterns=[
 {kind:'absence',pattern:/\b(?:parti|commence|demarre|reparti|rester|reste)\s+(?:de|a)\s+zero\b/,marks:['0'],meaning:'starting_from_zero',sound:'none'},
 {kind:'solution',pattern:/\b(?:resoudre|regler)\s+(?:ce|le|un|des|les|mon|nos)?\s*(?:probleme|blocage)\b|\b(?:probleme|blocage)\s+(?:et|vers|puis|avec)\s+(?:la|une)?\s*solution\b/,marks:['?','✓'],meaning:'problem_to_solution',sound:'resolution'},
 {kind:'progress',pattern:/\b(?:je|tu|nous|on|ils|elles)\s+(?:ai|as|avons|a|ont)?\s*(?:commence\s+a\s+)?(?:progresse|progressons|avance|evolue)\b/,marks:['↗'],meaning:'direction_not_numeric_result',sound:'none'},
 {kind:'choice',pattern:/\b(?:deux|2)\s+(?:choix|possibilites|options)\b|\bchoisir\s+entre\s+.{2,22}\s+et\s+.{2,22}\b/,marks:['A','B'],meaning:'two_options_no_invented_labels',sound:'none'},
 {kind:'value',pattern:/\b(\d{1,5})\s*(euros?|€)\b/,marks:null,meaning:'verbatim_spoken_amount',sound:'none'},
 {kind:'emotion',pattern:/\b(?:toucher|atteindre|parler\s+aux)\s+(?:les|des|leurs|nos)?\s*(?:coeurs?|personnes)\b/,marks:['♥'],meaning:'emotional_connection',sound:'none'},
 {kind:'time',pattern:/\b(?:perds?|perdre|gagne|gagner|economise|economiser)\s+(?:(?:presque|environ|plus\s+de)\s+)?(\d+)\s*(minutes?|heures?|jours?)\b/,marks:['◷'],meaning:'spoken_time_cost',sound:'none'}
];
export const OMNI_SEMANTIC_POLICY='omni-editorial-semantics-v2';
export function segmentSpeech(words){
 const valid=Array.isArray(words)?words.filter(w=>finite(w.startMs)&&finite(w.endMs)&&
   Number(w.endMs)>Number(w.startMs)&&String(w.text||'').trim()).sort((a,b)=>a.startMs-b.startMs):[];
 const segments=[];let chunk=[];
 function flush(){if(chunk.length){segments.push(chunk);chunk=[]}}
 for(const w of valid){
  if(chunk.length&&(Number(w.startMs)-Number(chunk.at(-1).endMs)>650||chunk.length>=22))flush();
  chunk.push(w);
  if(/[.!?]$/.test(String(w.text||'')))flush();
 }
 flush();return segments;
}
function wordRange(segment,phrase){
 // Matches complete contiguous spoken tokens; no keyword bag or reordered words.
 const target=norm(phrase).split(' ').filter(Boolean),flat=[];
 for(const w of segment)for(const t of norm(w.text).split(' ').filter(Boolean))
   flat.push({t,start:Number(w.startMs),end:Number(w.endMs)});
 for(let i=0;i<=flat.length-target.length;i++)
  if(target.every((t,j)=>flat[i+j].t===t))
   return {startMs:flat[i].start,endMs:flat[i+target.length-1].end};
 return null;
}
function visualProofOk(p){
 return p?.lateralSafe===true&&p?.basis==='independent_frame_tracking'&&
  Number(p?.framesChecked)>=8&&Number(p?.confidence)>=.9;
}
export function proposeOmniSemanticCues({
 words=[],durationMs=0,style='codie',compositionProof=null,enabled=false
}={}){
 const held=[],cues=[],budget=styleBudgets[style]??0,duration=Number(durationMs);
 const rejection=reason=>({policy:OMNI_SEMANTIC_POLICY,cues:[],held:[{reason}]});
 if(!enabled)return rejection('FEATURE_OFF');
 if(!Number.isFinite(duration)||duration<3500)return rejection('INVALID_DURATION');
 if(!visualProofOk(compositionProof))return rejection('NO_INDEPENDENT_FACE_SAFE_TRACKING');
 const max=Math.min(4,Math.floor(duration/30000*budget)+1);
 const segments=segmentSpeech(words);
 for(const segment of segments){
  const sentence=norm(segment.map(w=>w.text).join(' '));
  for(const p of patterns){
   const match=p.pattern.exec(sentence);if(!match)continue;
   const timed=wordRange(segment,match[0]);
   if(!timed||timed.startMs<600||timed.endMs>duration+200){held.push({kind:p.kind,reason:'UNALIGNED_SPEECH'});continue}
   const start=Math.max(0,timed.startMs-80),end=Math.min(duration,Math.max(timed.endMs+650,start+1100));
   if(cues.some(c=>start<c.endMs+3800)){held.push({kind:p.kind,reason:'VISUAL_BREATHING_ROOM'});continue}
   const marks=p.kind==='value'?[match[1]+' €']:p.marks;
   if(marks.some(x=>!x||x.length>9)){held.push({kind:p.kind,reason:'ICON_CONTENT_INVALID'});continue}
   const pair=marks.length===2;
   const cue={mode:'omni_bubbles',kind:p.kind,icons:marks,layout:pair?'paired_relation':'single_support',
     startMs:start,endMs:end,spoken_anchor:match[0],evidence:'timed_transcript',
     semanticMeaning:p.meaning,compositionProof:{
       basis:compositionProof.basis,framesChecked:compositionProof.framesChecked,
       confidence:compositionProof.confidence,lateralSafe:true
     },
     sfxIntent:p.sound==='resolution'?'optional_subtle_resolution':'silence',
     audioBaseline:'preserve_original_voice',creativeReviewRequired:true};
   cues.push(cue);
   if(cues.length>=max)break;
  }
  if(cues.length>=max)break;
 }
 return {policy:OMNI_SEMANTIC_POLICY,cues,held,limits:{max,nonActionIsValid:true}};
}
export function verifyOmniCue(cue,spokenWindow){
 if(cue?.mode!=='omni_bubbles')return false;
 if(!visualProofOk(cue?.compositionProof))return false;
 const kind=String(cue.kind||''),pattern=patterns.find(p=>p.kind===kind);
 if(!pattern)return false;
 const phrase=norm(cue.spoken_anchor);
 const spoken=norm(spokenWindow);
 if(!phrase||!spoken.includes(phrase)||!pattern.pattern.test(phrase))return false;
 const match=pattern.pattern.exec(phrase),marks=kind==='value'?[match[1]+' €']:pattern.marks;
 return JSON.stringify(marks)===JSON.stringify(cue.icons)&&
   cue.layout===(marks.length===2?'paired_relation':'single_support')&&
   cue.evidence==='timed_transcript'&&
   cue.audioBaseline==='preserve_original_voice'&&
   (cue.sfxIntent==='silence'||(kind==='solution'&&cue.sfxIntent==='optional_subtle_resolution'));
}
