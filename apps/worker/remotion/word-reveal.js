// One Remotion frame at a time: never display words before their audio start.
export function revealTimedWord(ms,word){
  const start=Number(word?.startMs),end=Number(word?.endMs);
  if(!Number.isFinite(ms)||!Number.isFinite(start)||!Number.isFinite(end)||end<=start)
    return {opacity:0,scale:0.95,active:false};
  if(ms<start)return {opacity:0,scale:0.95,active:false};
  const t=Math.min(1,Math.max(0,(ms-start)/105));
  const ease=1-(1-t)**3;
  return {
    opacity:ease,
    scale:0.96+0.04*ease,
    active:ms>=start&&ms<=end
  };
}
