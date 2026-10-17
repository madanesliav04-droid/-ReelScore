/**
 * Edit+ Social Kinetic V10 -- source-word verified, face-safe editorial plan.
 * This is the GENERAL model, not the hard-coded 38s demonstration timeline.
 * Motion must come after actual speech. NO artificial words or fake conversations.
 */
import {validateSpeechWords,mapSourceToOutput,findSpokenPhrase} from './hyperframes-speech-sync.js';
const finite=x=>typeof x==='number'&&Number.isFinite(x);
const normalize=t=>String(t||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[’']/g,' ').toLowerCase().replace(/[^a-z0-9€%]+/g,' ').replace(/\s+/g,' ').trim();
const escape=t=>String(t||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');

function reject(reason,details={}){
 return {model:'social_kinetic_v10',status:'blocked',reason,events:[],releaseApproved:false,...details};
}
function safeRect(proof,a,b) {
 if(proof?.source!=='independent_frame_sampler'||proof.verified!==true)return null;
 const r=proof.rect;
 if(!r||![r.x,r.y,r.w,r.h].every(finite)||r.x<0||r.y<0||r.w<=.20||r.h<=.10||r.x+r.w>1.001||r.y+r.h>1.001)return null;
 const frames=(proof.frames||[]).filter(f=>finite(f.ms)&&f.ms>=a-160&&f.ms<=b+160)
  .sort((x,y)=>x.ms-y.ms);
 if(frames.length<3||frames[0].ms>a+250||frames.at(-1).ms<b-250)return null;
 if(frames.some((f,i)=>!(f.confidence>=.92)||f.subjectOverlap!==false||(i&&f.ms-frames[i-1].ms>600)))return null;
 return r;
}
function approvedMatches(words,phrase,sourceDuration){
 const alignment={verified:true,method:'provider_word_timestamps'};
 const r=findSpokenPhrase({words,phrase,alignment,durationMs:sourceDuration});
 return r.status==='verified'?r.match:null;
}
/**
 * @param analysis Gemini word_info transcript with original source offsets.
 * @param timeline real keepRanges in source time; not already remapped words.
 * @param frameProof evidence keyed by event id, independently sampled from original media.
 * @param editorialEvents optional semantic events grounded in actual *verbatim* speech.
 */
export function buildSocialKineticV10WordPlan({analysis,timeline,frameProof={},editorialEvents=[]}={}){
 const d=Math.round(Number(analysis?.measurable?.durationSec||0)*1000);
 const aligned=analysis?.transcript?.alignment;
 const requiredSource='gemini_interactions_word_info';
 if(!aligned||aligned.verified!==true||aligned.method!=='provider_word_timestamps'||aligned.source!==requiredSource)
  return reject('ACTUAL_PROVIDER_WORD_TIMESTAMPS_MISSING');
 const v=validateSpeechWords(analysis?.transcript?.words,{durationMs:d,alignment:aligned});
 if(v.status!=='verified'||v.words.length<6)return reject('ACTUAL_WORD_TIMESTAMPS_INVALID',{alignmentErrors:v.errors});
 const ranges=timeline?.keepRanges||[];
 if(!Array.isArray(ranges)||!ranges.length)return reject('REAL_CUT_MAP_MISSING');
 const sourceEnd=Number(timeline?.outputDurationMs);
 if(!finite(sourceEnd)||sourceEnd<=0)return reject('EDITED_DURATION_MISSING');
 // Drop words that straddle cuts rather than attributing inaccurate positions.
 const words=[];
 for(const word of v.words){
  const within=ranges.some(r=>word.startMs>=r.startMs&&word.endMs<=r.endMs);
  if(!within)continue;
  const start=mapSourceToOutput(word.startMs,ranges);
  const end=mapSourceToOutput(Math.max(word.startMs,word.endMs-1),ranges);
  if(start===null||end===null)continue;
  words.push({...word,outputStartMs:start,outputEndMs:end+1});
 }
 if(words.length<5)return reject('VERIFIED_WORDS_NOT_IN_EDIT');
 const cues=[],held=[];
 let group=[],n=0;
 const flush=()=>{
  if(!group.length)return;
  const a=group[0].outputStartMs,b=group.at(-1).outputEndMs;
  const id='caption-'+(n++);
  const proof=safeRect(frameProof[id],group[0].startMs,group.at(-1).endMs);
  if(!proof){held.push({id,reason:'INDEPENDENT_FACE_HAND_SAFE_ZONE_MISSING'});group=[];return;}
  cues.push({id,kind:'caption',startMs:a,endMs:Math.min(sourceEnd,b+130),
   rect:proof,text:group.map(w=>w.text).join(' '),
   words:group.map(w=>({text:w.text,outputStartMs:w.outputStartMs,outputEndMs:w.outputEndMs}))});
  group=[];
 };
 for(const w of words){
  const prev=group.at(-1);
  if(prev&&(w.outputStartMs-prev.outputEndMs>260||group.length>=3||group.map(x=>x.text).join(' ').length+w.text.length>29))flush();
  group.push(w);
  if(/[?!.,]$/.test(w.text))flush();
 }
 flush();
 for(const e of editorialEvents){
  const id=String(e?.id||'');
  if(!id||!['keyword','bubble','metric'].includes(e?.kind)||typeof e.phrase!=='string')continue;
  const matched=approvedMatches(v.words,e.phrase,d);
  if(!matched){held.push({id,reason:'UNSPOKEN_EDITORIAL_TEXT'});continue;}
  // A blue dialogue is a literal excerpt or a marked user-approved illustration.
  if(e.kind==='bubble'&&normalize(e.text)!==normalize(e.phrase)&&!(e.exampleOnly&&e.userApprovedText)){
   held.push({id,reason:'UNVERIFIED_MESSAGE'});continue;
  }
  if(e.kind==='metric'&&!/\d/.test(e.phrase)){
   held.push({id,reason:'NUMERIC_CLAIM_NOT_IN_SPEECH'});continue;
  }
  const start=mapSourceToOutput(matched.startMs,ranges);
  const end=mapSourceToOutput(Math.max(matched.startMs,matched.endMs-1),ranges);
  const within=ranges.some(r=>matched.startMs>=r.startMs&&matched.endMs<=r.endMs);
  if(!within||start===null||end===null){held.push({id,reason:'GRAPHIC_CROSSES_CUT'});continue;}
  const rect=safeRect(frameProof[id],matched.startMs,matched.endMs);
  if(!rect){held.push({id,reason:'GRAPHIC_SAFE_ZONE_MISSING'});continue;}
  cues.push({id,kind:e.kind,startMs:start,endMs:Math.min(sourceEnd,Math.max(end+350,start+500)),
   rect,text:e.text||e.phrase,sourceEvidence:e.phrase,exampleOnly:!!e.exampleOnly});
 }
 cues.sort((a,b)=>a.startMs-b.startMs);
 return {model:'social_kinetic_v10',status:cues.length?'staging_renderable':'blocked',
   reason:cues.length?null:'NO_INDEPENDENTLY_SAFE_TEXT',
   source:'real_gemini_word_info',alignmentReviewedAgainstAudio:aligned.reviewedAgainstAudio===true,
   releaseApproved:false,spokenWordCount:v.words.length,keptWordCount:words.length,
   durationMs:sourceEnd,events:cues,held};
}
/** HyperFrames scene with real time metadata; CSS is relative to true native canvas. */
export function socialKineticV10Html(plan,{width,height,fps=30}={}){
 if(plan?.status!=='staging_renderable'||!plan.events?.length)throw Error('V10_UNVERIFIED_PLAN');
 if(!Number.isInteger(width)||!Number.isInteger(height)||width<320||height<240)throw Error('V10_INVALID_CANVAS');
 const esc=escape,sec=n=>(n/1000).toFixed(3),portrait=height>width;
 const font=Math.round(Math.min(width,height)*(portrait?.054:.055));
 const blocks=plan.events.map((e,i)=>{
  const r=e.rect;
  const styles='left:'+Math.round(r.x*width)+'px;top:'+Math.round(r.y*height)+'px;width:'+Math.round(r.w*width)+'px;height:'+Math.round(r.h*height)+'px';
  const content=e.kind==='caption'?e.words.map((w,k)=>'<span class="word" id="w'+i+'_'+k+'">'+esc(w.text.toUpperCase())+'</span>').join(' '):esc(e.text.toUpperCase());
  return '<div class="event '+e.kind+'" id="e'+i+'" data-start="'+sec(e.startMs)+'" data-duration="'+sec(e.endMs-e.startMs)+'" data-track-index="2" style="'+styles+'"><div class="inner" id="i'+i+'">'+content+'</div></div>';
 }).join('');
 const t=[];
 for(let i=0;i<plan.events.length;i++){
  const e=plan.events[i];
  t.push('tl.fromTo("#i'+i+'",{opacity:0,y:13,scale:.96,filter:"blur(5px)"},{opacity:1,y:0,scale:1,filter:"blur(0px)",duration:.22,ease:"power3.out"},'+sec(e.startMs)+');');
  if(e.kind==='caption'){
   for(let k=0;k<e.words.length;k++)t.push('tl.fromTo("#w'+i+'_'+k+'",{opacity:0,y:9,filter:"blur(3px)"},{opacity:1,y:0,filter:"blur(0px)",duration:.14,ease:"power2.out"},'+sec(e.words[k].outputStartMs)+');');
  }
  t.push('tl.to("#i'+i+'",{opacity:0,y:-4,duration:.12},'+sec(Math.max(e.startMs+160,e.endMs-120))+');');
 }
 return '<!doctype html><html><head><meta charset="utf-8"><style>'+
 '*{box-sizing:border-box}html,body{margin:0;width:'+width+'px;height:'+height+'px;background:transparent!important;overflow:hidden}'+
 '#root{position:relative;width:100%;height:100%;overflow:hidden}.event{position:absolute;pointer-events:none;overflow:hidden}.inner{font-family:"DejaVu Sans Condensed",Arial,sans-serif;'+
 'font-size:'+font+'px;font-weight:900;line-height:1.05;letter-spacing:-.038em;color:#fff;text-align:center;text-shadow:0 2px 7px #000e}'+
 '.word{display:inline-block;opacity:0;white-space:nowrap}.keyword .inner{font-size:'+Math.round(font*1.70)+'px;color:#225932;-webkit-text-stroke:.6px #b1c8af}'+
 '.bubble .inner{background:#0b63bc;border-radius:12px;padding:10px;color:#fff;font-size:'+Math.round(font*.65)+'px}'+
 '.metric .inner{font-size:'+Math.round(font*1.5)+'px;background:#09141bbb;padding:8px}'+
 '</style></head><body><div id="root" data-composition-id="social-kinetic-v10-autonomous" data-start="0" data-duration="'+sec(plan.durationMs)+'" data-width="'+width+'" data-height="'+height+'" data-fps="'+fps+'">'+blocks+'</div>'+
 '<script src="https://cdn.jsdelivr.net/npm/gsap@3.13.0/dist/gsap.min.js"></script>'+
 '<script>const tl=gsap.timeline({paused:true});'+t.join('')+
 'window.__timelines=window.__timelines||{};window.__timelines["social-kinetic-v10-autonomous"]=tl;</script></body></html>';
}
