// Event-driven timing: source-verified word starts beat arbitrary percentage delays.
// Speech anchors must be derived from verified alignment upstream, not guessed here.
export const BEAT_TIMING_VERSION='hormozi-beat-timing-v1';
const finite=n=>n!==null&&n!==undefined&&n!==''&&Number.isFinite(Number(n));
export function makeHormoziMotionBeats(cue,{fps=30}={}){
 if(!Number.isInteger(fps)||fps<24||fps>60)return {beats:[],held:'INVALID_FPS'};
 const start=Number(cue?.startMs),end=Number(cue?.endMs);
 if(!finite(start)||!finite(end)||end-start<400)return {beats:[],held:'INVALID_INTERVAL'};
 const source=cue.type==='sequence'?cue.itemStarts:
   cue.type==='comparison'?[cue.startMs,cue.rightStartMs]:[cue.startMs];
 if(!Array.isArray(source)||source.length<1||source.length>5||source.some(v=>!finite(v)))
  return {beats:[],held:'MISSING_WORD_ANCHOR'};
 const quantize=ms=>Math.round(Number(ms)/1000*fps)*1000/fps;
 const starts=source.map(quantize);
 if(starts.some((v,i)=>v<start-100||v>end-150||
   (i>0&&v-starts[i-1]<110)))return {beats:[],held:'INVALID_BEAT_SPACING'};
 return {policy:BEAT_TIMING_VERSION,beats:starts.map((atMs,i)=>{
   const next=starts[i+1]??end;
   const gap=Math.max(0,next-atMs);
   return {index:i,atMs:Number(atMs.toFixed(2)),
     // Motion cannot overrun the next spoken idea. No arbitrary stagger.
     easeMs:Math.round(Math.min(230,Math.max(95,Math.min(gap*.45,190)))),
     direction:i===0?'reveal':'follow_speech'};
 }),frameToleranceMs:Number((500/fps).toFixed(2))};
}
