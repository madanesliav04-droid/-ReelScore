// Clip+ short-form contract: prioritize timestamp-grounded, standalone micro-highlights.
// Never fabricate a viral score or invent evenly spaced "best moments".
export const DEFAULT_MIN_HIGHLIGHT_SECONDS=10;
export const DEFAULT_MAX_HIGHLIGHT_SECONDS=15;

function seconds(v){const n=Number(v);return Number.isFinite(n)?n:NaN}
function round(v){return Number(v.toFixed(3))}
function overlap(a,b){
  const intersection=Math.max(0,Math.min(a.end_sec,b.end_sec)-Math.max(a.start_sec,b.start_sec));
  return intersection/Math.max(.01,Math.min(a.end_sec-a.start_sec,b.end_sec-b.start_sec));
}
function anchoredWords(words,start,end){
  return (Array.isArray(words)?words:[])
    .map(w=>({
      start:seconds(w.startMs)/1000,end:seconds(w.endMs)/1000,
      text:String(w.text||'').trim()
    }))
    .filter(w=>w.text&&Number.isFinite(w.start)&&Number.isFinite(w.end)&&w.end>w.start&&w.start>=start-.1&&w.end<=end+.1)
    .sort((a,b)=>a.start-b.start);
}
function shortWindow(words,start,end,minSec,maxSec,anchor){
  const candidates=[];
  // Timestamped speech is the only permitted source for shortening a long proposal.
  for(let i=0;i<words.length;i++){
    const first=words[i];
    const previous=words[i-1];
    const boundary=i===0||/[.!?]$/.test(previous.text)||(first.start-previous.end)>=.36;
    for(let j=i+1;j<words.length;j++){
      const last=words[j];
      const length=last.end-first.start;
      if(length>maxSec+.001)break;
      if(length<minSec-.001)continue;
      const punctuation=/[.!?]$/.test(last.text);
      const hook=/^(mais|pourquoi|jamais|personne|erreur|imagine|attention|voici|regarde|comment|sauf|arrête|tu|vous|c'est|on|le secret|la vérité|the|why|never|stop|imagine|here)/i.test(first.text);
      const insideAnchor=Number.isFinite(anchor)&&anchor>=first.start&&anchor<=last.end;
      const score=(boundary?4:0)+(punctuation?5:0)+(hook?2:0)+(insideAnchor?3:0)
        -Math.abs(length-(minSec+maxSec)/2)*.25
        -Math.max(0,first.start-start)*.015;
      candidates.push({start:first.start,end:last.end,score});
    }
  }
  candidates.sort((a,b)=>b.score-a.score||a.start-b.start);
  return candidates[0]||null;
}
export function normalizeHighlight(raw,{duration,words=[],minSec=10,maxSec=15}){
  if(!raw||typeof raw!=='object')return null;
  let start=seconds(raw.start_sec),end=seconds(raw.end_sec);
  const limit=seconds(duration);
  if(!Number.isFinite(start)||!Number.isFinite(end)||!Number.isFinite(limit))return null;
  if(start<0||end>limit+.01||end<=start)return null;
  const clipQuality=seconds(raw.viral_score);
  // An unavailable score is not a synthetic 55/100.
  if(!Number.isFinite(clipQuality)||clipQuality<0||clipQuality>100)return null;
  if(end-start<minSec-.001)return null;
  let condensed=false;
  if(end-start>maxSec+.001){
    const sceneWords=anchoredWords(words,start,end);
    const selected=shortWindow(sceneWords,start,end,minSec,maxSec,seconds(raw.hook_time_sec));
    if(selected){
      start=selected.start;end=selected.end;condensed=true;
    }else if(end-start<=maxSec+.35){
      end=start+maxSec;condensed=true;
    }else{
      // Without word timestamps, trimming a long passage cuts the payoff at random.
      return null;
    }
  }
  if(end-start<minSec-.001||end-start>maxSec+.001)return null;
  return {
    start_sec:round(start),end_sec:round(end),
    title:String(raw.title||'Moment fort').slice(0,140),
    hook:String(raw.hook||'').slice(0,220),
    rationale:String(raw.rationale||'').slice(0,500),
    viral_score:Math.round(clipQuality),
    ...(condensed?{condensed_from_long_passage:true}:{})
  };
}
export function rankHighlights(raw,{duration,words=[],minSec=10,maxSec=15,minQuality=64,count=5,poolSize=20}){
  const sorted=(Array.isArray(raw)?raw:[])
    .slice(0,Math.max(poolSize,50))
    .sort((a,b)=>Number(b?.viral_score||0)-Number(a?.viral_score||0));
  const picked=[];
  for(const candidate of sorted){
    const clip=normalizeHighlight(candidate,{duration,words,minSec,maxSec});
    if(!clip||clip.viral_score<minQuality)continue;
    if(picked.some(other=>overlap(clip,other)>.35))continue;
    picked.push(clip);
    if(picked.length>=Math.min(count,poolSize))break;
  }
  return picked;
}
