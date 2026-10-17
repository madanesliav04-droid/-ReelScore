/**
 * Edit+ MODEL 02 / Social Kinetic Reference V4
 *
 * Reproduce observed editorial MOVEMENT, not an Instagram screen recording.
 * Always preserve source frame/original audio. Every visual must have a
 * contiguous source speech anchor and independently sampled visual safe-area.
 * Gemini merely suggests events; the evidence gate rejects unsupported edits.
 */
import {validateSpeechWords,mapSourceToOutput} from './hyperframes-speech-sync.js';

export const SOCIAL_KINETIC_V4_CONTRACT=Object.freeze({
 model:'social_kinetic_reference_v4',referenceDurationMs:55167,
 referenceSource:'user supplied 2026-10-17 Instagram screen recording',
 nativeVideoOnly:true,instagramUI:false,preserveVoice:true,brollAutomatic:false,
 camera:'wide human-led, no rhythmic punch-in',
 events:['hero','phrase','keyword','chat','metric'],
 timing:'post-cut word timestamps',layout:'face-safe dynamic lateral lane',
 messages:'spoken evidence only; no fabricated chats',
 transitions:'fast 180-280ms motion; no repetitive cards',
 ui:'no comment/like/follow/social notification overlays',
 target:'staging, not certified for commercial use'
});
const good=x=>typeof x==='number'&&Number.isFinite(x);
const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'')
 .toLowerCase().replace(/[^a-z0-9€%]+/g,' ').replace(/\s+/g,' ').trim();
const esc=s=>String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;')
 .replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');

function blocked(reason,held=[]){
 return {status:'blocked',model:SOCIAL_KINETIC_V4_CONTRACT.model,
   reason,events:[],held,releaseStatus:'NOT_APPROVED'};
}
function proofFor(proofs,event,start,end) {
 const proof=proofs?.[event.id];
 if(proof?.source!=='independent_frame_sampler'||proof.verified!==true)
   return {reason:'MISSING_INDEPENDENT_FRAME_PROOF'};
 const rect=proof.safeRect;
 if(!rect||![rect.x,rect.y,rect.w,rect.h].every(good)||
   rect.x<0||rect.y<0||rect.w<.20||rect.h<.13||
   rect.x+rect.w>1.001||rect.y+rect.h>1.001)
   return {reason:'INVALID_SAFE_RECT'};
 const frames=(proof.frames||[]).filter(x=>good(x.ms)&&x.ms>=start-250&&x.ms<=end+250)
   .sort((a,b)=>a.ms-b.ms);
 if(frames.length<3||frames[0].ms>start+270||
   frames.at(-1).ms<end-270||frames.some(x=>!good(x.confidence)||x.confidence<.90||x.subjectOverlap!==false))
   return {reason:'FRAME_SAFETY_INCOMPLETE'};
 if(frames.some((x,i)=>i&&x.ms-frames[i-1].ms>650))
   return {reason:'FRAME_SAFETY_GAP'};
 return {rect,palette:proof.palette||{},reason:null};
}
function findSpeechMatch(words,phrase,occurrenceIndex){
 const needle=norm(phrase).split(' ').filter(Boolean);
 if(!needle.length)return {reason:'SPEECH_EVIDENCE_MISSING'};
 const expanded=words.flatMap(w=>norm(w.text).split(' ').filter(Boolean)
   .map(text=>({text,startMs:w.startMs,endMs:w.endMs,sourceIndex:w.sourceIndex})));
 const matches=[];
 for(let i=0;i<=expanded.length-needle.length;i++){
   if(needle.every((v,k)=>expanded[i+k].text===v))
     matches.push({startMs:expanded[i].startMs,
       endMs:expanded[i+needle.length-1].endMs,sourceIndex:expanded[i].sourceIndex});
 }
 if(!matches.length)return {reason:'PHRASE_NOT_IN_SPEECH'};
 if(matches.length>1&&!Number.isInteger(occurrenceIndex))
   return {reason:'AMBIGUOUS_REPEATED_PHRASE'};
 const match=matches[occurrenceIndex??0];
 return match?{match}:{reason:'INVALID_PHRASE_OCCURRENCE'};
}
function displayWords(words,startMs,endMs,keepRanges){
 const mapped=[];
 for(const w of words){
  if(w.startMs<startMs||w.endMs>endMs)continue;
  const r=keepRanges.find(r=>w.startMs>=r.startMs&&w.endMs<=r.endMs);
  if(!r)continue;
  const at=mapSourceToOutput(w.startMs,keepRanges);
  if(at!==null)mapped.push({text:w.text,startMs:at,sourceIndex:w.sourceIndex});
 }
 return mapped;
}
/**
 * The reference shows max 3 conversations at once: the fourth replaces
 * the oldest instead of stacking a fourth over the creator's face.
 */
export function retireOldestChatEvent(accepted,upcoming){
 if(upcoming.kind!=='chat')return null;
 const active=accepted.filter(x=>x.kind==='chat'&&
   upcoming.startMs<x.endMs&&upcoming.endMs>x.startMs)
   .sort((a,b)=>a.startMs-b.startMs);
 if(active.length<3)return null;
 const oldest=active[0];
 oldest.endMs=Math.min(oldest.endMs,
   Math.max(oldest.startMs+120,upcoming.startMs-40));
 return oldest.id;
}

/**
 * editorialEvents come from speech-aware directing, not a timer/keyword quota.
 * one event = {id,kind,spokenEvidence,sourceEndMs,...}
 * Chat text must be verbatim or explicitly user-authored illustration.
 * In either case a real phrase from speaker must anchor the event.
 */
export function buildSocialKineticReferenceV4Plan({
 analysis,timeline,editorialEvents=[],frameProof={}
}={}){
 const durationMs=Number(timeline?.sourceDurationMs);
 const outputDurationMs=Number(timeline?.outputDurationMs);
 const keepRanges=timeline?.keepRanges||[];
 if(!good(durationMs)||!good(outputDurationMs)||durationMs<1000||
   !Array.isArray(keepRanges)||!keepRanges.length)
   return blocked('TIMELINE_MISSING');
 const sum=keepRanges.reduce((n,r)=>n+Number(r.endMs)-Number(r.startMs),0);
 if(!good(sum)||Math.abs(sum-outputDurationMs)>60)
   return blocked('CUT_TIMING_DRIFT');
 if(!analysis?.measurable?.audioCodec||timeline?.audio?.hasAudio!==true)
   return blocked('ORIGINAL_AUDIO_REQUIRED');
 const sourceW=Number(analysis?.measurable?.width);
 const sourceH=Number(analysis?.measurable?.height);
 const exportW=Number(timeline?.export?.width);
 const exportH=Number(timeline?.export?.height);
 if(![sourceW,sourceH,exportW,exportH].every(good)||
   sourceW<240||sourceH<240||exportW<240||exportH<240||
   (sourceW>sourceH)!==(exportW>exportH))
   return blocked('NATIVE_ORIENTATION_REQUIRED');
 const alignment=analysis?.transcript?.alignment;
 const validation=validateSpeechWords(analysis?.transcript?.words,{durationMs,alignment});
 if(validation.status!=='verified')return blocked('ASR_WORD_TIMING_NOT_EVIDENCED');
 // Provider offsets are not a final human audio certification.
 const speech=validation.words;
 const allowed=new Set(SOCIAL_KINETIC_V4_CONTRACT.events);
 const accepted=[],held=[];
 for(const event of editorialEvents){
  const hold=(reason)=>held.push({id:event?.id||null,reason});
  if(!event||!event.id||!allowed.has(event.kind)){hold('INVALID_EDITORIAL_EVENT');continue;}
  if(!String(event.text||'').trim()||String(event.text).length>180){
   hold('INVALID_ONSCREEN_TEXT');continue;
  }
  const found=findSpeechMatch(speech,event.spokenEvidence,event.occurrenceIndex);
  if(found.reason){hold(found.reason);continue;}
  const speechTime=found.match.startMs;
  const sourceEnd=Number(event.sourceEndMs);
  if(!good(sourceEnd)||sourceEnd<=speechTime+150||sourceEnd>durationMs){
   hold('INVALID_SOURCE_EVENT_END');continue;
  }
  const proof=proofFor(frameProof,event,speechTime,sourceEnd);
  if(proof.reason){hold(proof.reason);continue;}
  const outputStart=mapSourceToOutput(speechTime,keepRanges);
  const outputEnd=mapSourceToOutput(sourceEnd-1,keepRanges);
  const keep=keepRanges.find(r=>speechTime>=r.startMs&&sourceEnd<=r.endMs);
  if(!keep||outputStart===null||outputEnd===null||outputEnd-outputStart<140){
   hold('EVENT_CROSSES_CUT');continue;
  }
  const kind=event.kind;
  // Fragment overlays differ from generic subtitles: display exactly the
  // approved spoken clause, never append extra words from the next sentence.
  if(kind==='phrase'&&norm(event.text)!==norm(event.spokenEvidence)){
   hold('PHRASE_TEXT_NOT_VERBATIM');continue;
  }
  if(kind==='chat'&&norm(event.text)!==norm(event.spokenEvidence)&&
    !(event.exampleOnly===true&&event.userApprovedText===true)){
   hold('CHAT_NOT_VERBATIM_OR_APPROVED_EXAMPLE');continue;
  }
  if(kind==='metric'){
   const digits=String(event.text).match(/\d[\d\s.,]*\s*(?:€|euros?|%|dollars?)?/gi)||[];
   if(!digits.length){hold('METRIC_VALUE_MISSING');continue;}
   const spokenDigits=norm(event.spokenEvidence).match(/\d[\d\s.,]*/g)||[];
   if(!spokenDigits.length||!spokenDigits.some(d=>norm(event.text).includes(norm(d)))){
    hold('METRIC_UNSPOKEN_VALUE');continue;
   }
  }
  const evt={
   id:String(event.id),kind,text:String(event.text),startMs:outputStart,
   endMs:outputEnd+1,sourceSpeechStartMs:speechTime,
   spokenEvidence:String(event.spokenEvidence),safeRect:proof.rect,
   words:displayWords(speech,speechTime,
     kind==='phrase'?found.match.endMs:sourceEnd,keepRanges),
   palette:proof.palette,exampleOnly:event.exampleOnly===true,
   displayPriority:Number(event.displayPriority)||0,
   groupId:event.groupId||null
  };
  // Stagger messages by replacing the oldest before checking layer bounds.
  // All word evidence and placements are still reviewed independently.
  retireOldestChatEvent(accepted,evt);
  // Two text effects may coexist only if independently cleared rectangles
  // do not collide. This permits stacked blue messages but not random labels
  // drawn over the same part of the speaker's frame.
  const collides=accepted.some(other=>{
   const concurrent=evt.startMs<other.endMs&&evt.endMs>other.startMs;
   const a=evt.safeRect,b=other.safeRect;
   const touching=Math.min(a.x+a.w,b.x+b.w)>Math.max(a.x,b.x)&&
    Math.min(a.y+a.h,b.y+b.h)>Math.max(a.y,b.y);
   return concurrent&&touching;
  });
  if(collides){hold('ONSCREEN_EFFECT_COLLISION');continue;}
  accepted.push(evt);
 }
 accepted.sort((a,b)=>a.startMs-b.startMs||b.displayPriority-a.displayPriority);
 return {status:accepted.length?'staging_renderable':'blocked',
   model:SOCIAL_KINETIC_V4_CONTRACT.model,
   releaseStatus:'REQUIRES_REAL_RUSH_VISUAL_AND_AUDIO_QA',
   reason:accepted.length?null:'NO_SAFE_SPOKEN_EVENTS',
   outputDurationMs,events:accepted,held,
   audio:'source_only',imageFormat:'native',referenceRuntimeMs:55167};
}

export function socialKineticReferenceV4Html(plan,{width=1280,height=720}={}){
 if(!plan||!Array.isArray(plan.events)||!plan.events.length)
   throw new Error('SOCIAL_KINETIC_NO_APPROVED_EVENTS');
 if(!Number.isInteger(width)||!Number.isInteger(height)||width<320||height<240||
    width>4096||height>4096)throw new Error('INVALID_NATIVE_RASTER');
 const sec=ms=>(ms/1000).toFixed(3);
 const font=Math.round(Math.min(width*.027,height*.06));
 const maxEvents=plan.events.slice(0,200);
 const blocks=maxEvents.map((e,i)=>{
  const r=e.safeRect, left=Math.round(r.x*width),top=Math.round(r.y*height);
  const w=Math.round(r.w*width),h=Math.round(r.h*height);
  const className=e.kind==='hero'?'hero':e.kind==='phrase'?'phrase':
    e.kind==='keyword'?'keyword':e.kind==='chat'?'bubble':'metric';
  const example=e.exampleOnly?'<span class="example">EXEMPLE</span>':'';
  const html=e.kind==='phrase'?(
   e.words.filter(w=>w.startMs>=e.startMs&&w.startMs<=e.endMs)
     .map((w,k)=>'<span class="spoken" id="s'+i+'_'+k+'">'+esc(w.text.toUpperCase())+'</span>').join(' ')
  ):esc(e.text.toUpperCase());
  return '<div class="clip '+className+'" id="e'+i+'" data-start="'+sec(e.startMs)+
   '" data-duration="'+sec(e.endMs-e.startMs)+'" data-track-index="3" style="left:'+left+
   'px;top:'+top+'px;width:'+w+'px;height:'+h+'px">'+
   example+'<div class="content" id="c'+i+'">'+(html||esc(e.text.toUpperCase()))+'</div></div>';
 }).join('\n');
 const animations=[];
 for(let i=0;i<maxEvents.length;i++){
  const e=maxEvents[i],start=sec(e.startMs),end=sec(Math.max(e.startMs+100,e.endMs-110));
  let entering=e.kind==='keyword'||e.kind==='hero'
   ?'{opacity:0,y:12,scale:.88,filter:"blur(6px)"}'
   :'{opacity:0,y:11,scale:.98,filter:"blur(3px)"}';
  animations.push('tl.fromTo("#c'+i+'",'+entering+
   ',{opacity:1,y:0,scale:1,filter:"blur(0px)",duration:.23,ease:"power2.out"},'+start+');');
  if(e.kind==='phrase'){
   let words=e.words.filter(w=>w.startMs>=e.startMs&&w.startMs<=e.endMs);
   for(let k=0;k<words.length;k++)
    animations.push('tl.fromTo("#s'+i+'_'+k+'",{opacity:0,y:4},{opacity:1,y:0,duration:.15},'+sec(words[k].startMs)+');');
  }
  animations.push('tl.to("#c'+i+'",{opacity:0,y:-3,duration:.10,ease:"power1.in"},'+end+');');
 }
 return '<!doctype html><html><head><meta charset="utf-8"><style>'+
 '*{box-sizing:border-box}html,body,#root{margin:0;width:'+width+'px;height:'+height+'px;background:transparent!important;overflow:hidden}'+
 '#root{position:relative}.clip{position:absolute;pointer-events:none;overflow:visible}'+
 '.content{font-family:Arial,"Helvetica Neue",sans-serif;font-weight:800;color:#F9FAFD;font-size:'+font+
 'px;line-height:1.14;letter-spacing:-.035em;text-align:center;text-shadow:0 2px 9px #0a1016c4}'+
 '.phrase .content{font-size:'+Math.round(font*.90)+'px;font-weight:760}'+
 '.spoken{opacity:0;display:inline-block;white-space:nowrap}'+
 '.hero .content,.keyword .content{font-weight:900;color:#214421;font-size:'+Math.round(font*2.13)+'px;line-height:1.02;letter-spacing:-.04em}'+
 '.bubble .content{background:#0B63BC;color:white;font-size:'+Math.round(font*.73)+'px;'+
 'line-height:1.25;letter-spacing:-.02em;border-radius:12px;padding:10px 14px;'+
 'font-weight:750;text-shadow:none;box-shadow:0 2px 8px #070f2035}'+
 '.example{position:absolute;top:-17px;right:2px;color:#e7f0ff;font-size:10px;'+
 'font-family:Arial,sans-serif;letter-spacing:.06em}'+
 '.metric .content{font-weight:850;font-size:'+Math.round(font*1.75)+'px;'+
 'background:#06111a84;border-radius:3px;padding:7px 14px;color:#fff;'+
 'font-variant-numeric:tabular-nums;letter-spacing:-.04em}'+
 '</style></head><body><div id="root" data-composition-id="editplus-social-kinetic-reference-v4"'+
 ' data-start="0" data-duration="'+sec(plan.outputDurationMs)+'"'+
 ' data-width="'+width+'" data-height="'+height+'" data-fps="30">'+blocks+'</div>'+
 '<script src="https://cdn.jsdelivr.net/npm/gsap@3.13.0/dist/gsap.min.js"></script>'+
 '<script>const tl=gsap.timeline({paused:true});'+animations.join('')+
 'window.__timelines=window.__timelines||{};'+
 'window.__timelines["editplus-social-kinetic-reference-v4"]=tl;</script></body></html>';
}
