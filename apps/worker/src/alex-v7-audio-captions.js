/**
 * EDIT+ ALEX V7: a transcript drives every kinetic word in output time.
 * No invented subtitles, no "animate every N seconds", no cut drift.
 * Provider timestamps are PROVISIONAL until the final audio is listened to.
 */
import {validateSpeechWords,mapSourceToOutput} from './hyperframes-speech-sync.js';
import {reviewSemanticStoryboard} from './hyperframes-story-first-gate.js';

const good=n=>typeof n==='number'&&Number.isFinite(n);
const max=(n,a,b)=>Math.min(Math.max(n,a),b);

export function buildAlexV7AudioPlan({
  analysis,timeline,semanticEvents=[],allowProviderPreview=true
}={}){
 const duration=Number(timeline?.sourceDurationMs);
 const words=analysis?.transcript?.words||[];
 const alignment=analysis?.transcript?.alignment||null;
 const keepRanges=timeline?.keepRanges||[];
 const check=validateSpeechWords(words,{durationMs:duration,alignment});
 const blocked=(reason)=>({status:'blocked',reason,groups:[],semanticVisuals:[],
   heldVisuals:semanticEvents.map(e=>({eventId:e.id,reason})),wordCount:0,
   releaseStatus:'NOT_APPROVED',design:'alex-v7-apple-kinetic'});
 // A cut-aware overlay must have exactly the same runtime as the edited video.
 // Reject stale manifests instead of shifting captions silently at every cut.
 const cutsDuration=keepRanges.reduce((sum,r)=>sum+Number(r.endMs)-Number(r.startMs),0);
 if(!keepRanges.length||!Number.isFinite(cutsDuration)||
    !good(Number(timeline?.outputDurationMs))||
    Math.abs(cutsDuration-Number(timeline.outputDurationMs))>100)
   return blocked('CUT_TIMELINE_DURATION_MISMATCH');
 if(check.status!=='verified')return blocked(check.errors.join(',')||'TRANSCRIPT_UNVERIFIED');
 // Verified field structure is not a human audio audit. Treat as provisional.
 const provider=alignment.method==='provider_word_timestamps';
 if(provider&&!allowProviderPreview)return blocked('PROVIDER_TIMING_NEEDS_REVIEW');
 const mapped=[];
 for(const w of check.words){
   const start=mapSourceToOutput(w.startMs,keepRanges);
   const end=mapSourceToOutput(Math.max(w.startMs,w.endMs-1),keepRanges);
   if(start===null||end===null||end<start)continue; // remove words cut by editor
   const range=keepRanges.findIndex(r=>w.startMs>=r.startMs&&w.endMs<=r.endMs);
   if(range<0)continue; // source word crosses a removed silence
   mapped.push({text:w.text,startMs:start,endMs:Math.max(start+40,end+1),
     originalStartMs:w.startMs,originalEndMs:w.endMs,sourceIndex:w.sourceIndex,range});
 }
 if(mapped.length<3)return blocked('INSUFFICIENT_UNCUT_WORDS');
 const groups=[];let batch=[];
 const flush=()=>{
   if(!batch.length)return;
   const s=batch[0].startMs,e=batch[batch.length-1].endMs;
   groups.push({id:'alexv7-caption-'+String(groups.length+1).padStart(3,'0'),
     startMs:s,endMs:Math.min(Number(timeline.outputDurationMs),e+150),
     text:batch.map(w=>w.text).join(' ').replace(/\s+([,.;!?])/g,'$1'),
     words:batch.map(w=>({...w})),entrance:'optical-kinetic-no-panel'});
   batch=[];
 };
 for(const w of mapped){
   const prev=batch[batch.length-1];
   if(prev&&(batch.length>=4 || w.startMs-prev.endMs>310 ||
      w.endMs-batch[0].startMs>1600 || w.range!==prev.range)){
     flush();
   }
   batch.push(w);
   if(/[.!?]$/.test(w.text))flush();
 }
 flush();
 // Avoid showing two complete phrases on top of each other at a boundary.
 for(let i=0;i<groups.length-1;i++){
   const nextStart=groups[i+1].startMs;
   groups[i].endMs=Math.min(groups[i].endMs,Math.max(groups[i].startMs+1,nextStart-8));
 }
 // Semantic objects require independent audio verified content, not an ASR guess.
 // In provider-preview mode they remain held until editorial QA signs off.
 const allowVisuals=!provider && alignment.reviewedAgainstAudio===true;
 const decision=allowVisuals?reviewSemanticStoryboard({
   events:semanticEvents,words,alignment,
   sourceDurationMs:duration,keepRanges
 }):{accepted:[],held:semanticEvents.map(e=>({eventId:e.id,reason:'AUDIO_SEMANTIC_PROOF_PENDING'}))};
 return {
  status:provider?'preview_transcript_timed':'audio_reviewed',
  releaseStatus:provider?'NEEDS_HUMAN_AUDIO_QA':'READY_FOR_VISUAL_QA',
  design:'alex-v7-apple-kinetic',wordCount:mapped.length,groups,
  semanticVisuals:decision.accepted,heldVisuals:decision.held,
  alignment:{source:alignment.source||'unknown',method:alignment.method,
    scope:provider?'provider offsets, not forced audio verification':'reviewed'},
  outputDurationMs:Number(timeline.outputDurationMs)
 };
}

/* Rendering contract: HyperFrames timestamps are POST-CUT output timestamps. */
export function alexV7CaptionHtml(plan,{width=1280,height=720,responsiveV8=false}={}){
 if(!plan?.groups?.length)throw Error('ALEX_V7_CAPTIONS_REQUIRE_TIMED_WORDS');
 const W=Math.round(width),H=Math.round(height);
 if(W<320||H<240||W>4096||H>4096)throw Error('BAD_RASTER');
 const sec=ms=>(Math.max(0,ms)/1000).toFixed(3);
 const esc=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;')
   .replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
 const portrait=H>W;
 const fsize=responsiveV8&&portrait?
   Math.round(Math.min(W*.065,H*.055)):
   Math.round(Math.min(W*.039,H*.071));
 const y=Math.round(H*(responsiveV8?(portrait?.63:.72):.76));
 const blockHeight=Math.round(H*(responsiveV8?.20:.15));
 const ids=[];
 const blocks=plan.groups.map((g,gi)=>{
   const id='wordgroup'+gi;ids.push(id);
   const html=g.words.map((w,wi)=>'<span class="token" id="w'+gi+'_'+wi+'">'+esc(w.text)+'</span>').join(' ');
   return '<div class="clip" id="'+id+'" data-start="'+sec(g.startMs)+
     '" data-duration="'+sec(Math.max(200,g.endMs-g.startMs))+
     '" data-track-index="2" style="left:'+Math.round(W*.075)+'px;top:'+y+
     'px;width:'+Math.round(W*.85)+'px;height:'+blockHeight+'px">'+
     '<div class="phrase" id="'+id+'_inner">'+html+'</div></div>';
 }).join('\n');
 const tweens=[];
 for(let gi=0;gi<plan.groups.length;gi++){
   let g=plan.groups[gi],id='wordgroup'+gi;
   for(let wi=0;wi<g.words.length;wi++){
     const w=g.words[wi],start=sec(w.startMs),selector='#w'+gi+'_'+wi;
     tweens.push("tl.fromTo('"+selector+"',{opacity:0,y:10,scale:.96,filter:'blur(5px)'},{opacity:1,y:0,scale:1,filter:'blur(0px)',duration:.24,ease:'power2.out'},"+start+");");
   }
   const fade=Math.max(g.startMs/1000+.10,(g.endMs-105)/1000);
   tweens.push("tl.to('#"+id+"_inner',{opacity:0,y:-4,duration:.10,ease:'power1.in'},"+fade.toFixed(3)+");");
 }
 const duration=sec(plan.outputDurationMs);
 return '<!doctype html><html lang="fr"><head><meta charset="utf-8"><style>'+
 '*{box-sizing:border-box}html,body{width:'+W+'px;height:'+H+'px;margin:0;overflow:hidden;background:transparent!important}'+
 '#root{position:relative;width:'+W+'px;height:'+H+'px;background:transparent!important;overflow:hidden}'+
 '.clip{position:absolute;pointer-events:none}'+
 '.phrase{font-family:Arial,"Helvetica Neue",sans-serif;font-weight:850;font-size:'+fsize+'px;'+
 'line-height:1.12;text-align:center;letter-spacing:-.052em;color:#F9FAFD;opacity:1;'+
 (responsiveV8?'white-space:normal;overflow-wrap:break-word;':'white-space:nowrap;')+
 'text-shadow:0 2px 8px #050917bc,0 8px 30px #03091491}'+
 '.token{display:inline-block;opacity:0;will-change:transform,filter,opacity}'+
 '</style></head><body><div id="root" data-composition-id="alex-v7-word-synced" data-start="0" data-duration="'+duration+
 '" data-width="'+W+'" data-height="'+H+'" data-fps="30">'+blocks+'</div>'+
 '<script src="https://cdn.jsdelivr.net/npm/gsap@3.13.0/dist/gsap.min.js"></script>'+
 '<script>const tl=gsap.timeline({paused:true});'+tweens.join('')+
 'window.__timelines=window.__timelines||{};window.__timelines["alex-v7-word-synced"]=tl;</script></body></html>';
}
