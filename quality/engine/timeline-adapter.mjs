/**
 * Adapter: semantic EDL -> actual current FFmpeg/ASS renderer timeline.
 * Experimental only. Blocks rendering until word-level timing is available.
 * Leila intentionally exercises the existing Editorial Breakdown diagram
 * renderer, rather than pretending a new rendering stack is already working.
 */
import {CAPTION_PRESETS} from '../../apps/worker/src/edit.js';
const presets={
  codie:'codie',leila:'editorial',impact:'impact',clean:'clean',
  explainer:'explainer',ugc_native:'ugc'
};
export function timelineFromAdaptivePlan(plan,{width=360,height=640,hasAudio=true}={}){
  if(!plan?.renderReady)throw Error('NOT_RENDER_READY: word-level timing required');
  if(!presets[plan?.style])throw Error('UNKNOWN_STYLE');
  if(!(Number(plan.durationMs)>0))throw Error('INVALID_DURATION');
  const isLeila=plan.style==='leila';
  const preset=presets[plan.style];
  const cfg={...CAPTION_PRESETS[preset]};
  const captions=buildTimedCaptions(plan.wordTiming,cfg,width,height);
  if(!captions.length)throw Error('MISSING_PRECISE_CAPTIONS');
  const punchIns=plan.actions
    .filter(a=>['narrative-crop','subtle-crop','impact-emphasis'].includes(a.type))
    .map(a=>({startMs:a.startMs,endMs:Math.min(a.endMs,a.startMs+1400),
      scale:Number(a.scale)||1.06,reason:a.rationale||a.type}));
  const graphicCues=[];
  for(const a of plan.actions){
    if(isLeila&&a.type==='executive-diagram'){
      const figures=(a.figures||[]).filter(Boolean);
      if(!figures.length)continue; // comparatives without figures should not invent visual data
      graphicCues.push({
        startMs:a.startMs,endMs:Math.min(a.endMs,a.startMs+2600),
        mode:'editorial_breakdown',evidence:'timestamped_transcript',
        kind:'figures',figures,text:a.evidence.text
      });
    }
    if(plan.style==='explainer'&&a.type==='demonstration'&&a.ordinal){
      graphicCues.push({startMs:a.startMs,endMs:Math.min(a.endMs,a.startMs+1900),
        text:'STEP '+String(a.ordinal).padStart(2,'0')});
    }
    if(plan.style==='impact'&&a.type==='impact-emphasis'){
      graphicCues.push({startMs:a.startMs,endMs:Math.min(a.endMs,a.startMs+1100),
        text:a.evidence.text.split(/\s+/).slice(0,3).join(' ')});
    }
  }
  return {
    version:4,engine:'editplus-adaptive-lab-1',modelId:isLeila?'editorial_breakdown':plan.style,
    style:plan.style,
    modelContractVersion:plan.contract,
    outputDurationMs:plan.durationMs,
    durationMs:plan.durationMs,
    sourceAspect:width/height,
    export:{width,height,fps:30,codec:'h264',pixelFormat:'yuv420p',format:'portrait'},
    captions,captionConfig:cfg,punchIns,graphicCues,
    brollCues:[], // broll requires separately verified media, no silent fallback.
    audio:{hasAudio,normalize:true,targetLufs:-14,limiterDb:-1}
  };
}


/**
 * Prevent ASS WrapStyle=2 overflows by grouping *actual timestamped words*
 * into small, visually measurable caption phrases. No invented word timings.
 */
export function buildTimedCaptions(words=[],cfg={},width=360,height=640){
  const ratio=Math.max(.55,Math.min(1.15,height/1920));
  const displayedSize=Math.max(22,Math.min(110,Math.round(Number(cfg.fontSize||68)*ratio)));
  const safeChars=Math.max(10,Math.min(36,Math.floor((width*.74)/(displayedSize*.60))));
  const maxWords=Math.min(4,Math.max(2,Number(cfg.maxWordsPerLine||4)));
  const ordered=(Array.isArray(words)?words:[])
    .map(x=>({text:String(x.text||'').trim(),startMs:Number(x.startMs),endMs:Number(x.endMs)}))
    .filter(x=>x.text&&Number.isFinite(x.startMs)&&Number.isFinite(x.endMs)&&x.endMs>x.startMs)
    .sort((a,b)=>a.startMs-b.startMs);
  const out=[];let group=[];
  const text=()=>group.map(x=>x.text).join(' ').replace(/\s+([,.!?;:])/g,'$1');
  const flush=()=>{
    if(!group.length)return;
    out.push({startMs:group[0].startMs,endMs:group.at(-1).endMs,text:text(),
      words:group.map(x=>({...x}))});
    group=[];
  };
  for(const w of ordered){
    const proposed=group.length?text()+' '+w.text:w.text;
    if(group.length&&(
      proposed.length>safeChars||group.length>=maxWords||
      w.startMs-group.at(-1).endMs>350
    ))flush();
    group.push(w);
    if(/[.!?]$/.test(w.text))flush();
  }
  flush();
  return out;
}
