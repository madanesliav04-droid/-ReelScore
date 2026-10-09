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
  const captions=plan.actions.filter(a=>a.type==='caption').map(a=>({
    startMs:a.startMs,endMs:a.endMs,text:a.evidence.text
  }));
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
