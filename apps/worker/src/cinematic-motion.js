/**
 * Cinematic Story V2 — editorial timing, not a metronome.
 * Pure functions shared with the future independent Social+ engine.
 * Speech is authoritative: only verified transcription drives movement.
 */
const finite=n=>typeof n==='number'&&Number.isFinite(n);
const clamp=(v,min,max)=>Math.min(max,Math.max(min,v));

export function cinematicCutWindows(silences,words,durationMs){
  if(!finite(durationMs)||durationMs<=0)return [];
  const speech=Array.isArray(words)?words.filter(w=>finite(w.startMs)&&finite(w.endMs)&&w.endMs>w.startMs):[];
  const out=[];
  for(const s of Array.isArray(silences)?silences:[]){
    const start=Math.round(Number(s?.start)*1000);
    const end=Math.round(Number(s?.end)*1000);
    if(!finite(start)||!finite(end))continue;
    // Protect the first beat and the entire last 900 ms from being eaten.
    if(start<400||end>durationMs-900||end-start<1100)continue;
    // Neither remove spoken phonemes nor place a cut immediately against one.
    if(speech.some(w=>w.startMs<end+150&&w.endMs>start-150))continue;
    const cutStart=clamp(start+280,0,durationMs);
    const cutEnd=clamp(end-280,0,durationMs);
    if(cutEnd-cutStart>=450)out.push({startMs:cutStart,endMs:cutEnd,reason:'cinematic_long_silence'});
  }
  return out;
}

export function planCinematicMotion(scenes,durationMs){
  if(!finite(durationMs)||durationMs<=0)return [];
  const accepted=[];
  const order=['turn','resolution','memory','question','progression','chapter','evidence'];
  const source=(Array.isArray(scenes)?scenes:[])
    .filter(s=>finite(s.startMs)&&finite(s.endMs)&&s.endMs>s.startMs&&s.evidence==='transcript')
    .sort((a,b)=>a.startMs-b.startMs||order.indexOf(a.kind)-order.indexOf(b.kind));
  for(const scene of source){
    if(accepted.length>=2)break;
    const startMs=clamp(Math.round(scene.startMs-160),0,durationMs);
    const endMs=clamp(Math.round(Math.max(scene.endMs,scene.startMs+1450)+240),0,durationMs);
    if(endMs-startMs<1000)continue;
    if(accepted.some(p=>p.endMs+2800>startMs))continue;
    accepted.push({
      startMs,endMs,scale:1.028,
      translateX:scene.kind==='resolution'?-.45:.45,
      translateY:scene.kind==='memory'?.3:-.25,
      reason:scene.kind,source:'verified_transcript'
    });
  }
  return accepted;
}

export function holdCinematicCaptions(captions,durationMs){
  return (Array.isArray(captions)?captions:[]).map((caption,index,list)=>{
    const next=list[index+1];
    const safeNext=next?next.startMs-1:durationMs;
    const endMs=Math.max(caption.endMs,Math.min(durationMs,safeNext,caption.endMs+180));
    return {...caption,endMs};
  });
}
