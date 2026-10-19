/**
 * Edit+ Cinematic Storytelling (V1): evidence-first narrative storyboard.
 * No generated claims, fake B-roll links or automatic decorative overlays.
 * Every on-screen word must be taken from validated ASR word timestamps.
 */
const clean=s=>String(s??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'')
  .toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const quote=words=>words.map(w=>String(w.text||'').trim()).join(' ')
  .replace(/\s+([,.;!?])/g,'$1').trim();
const MARKERS={
  turn:{tokens:new Set(['mais','pourtant','cependant','sauf']),weight:4},
  resolution:{tokens:new Set(['finalement','maintenant','aujourdhui','desormais']),weight:3},
  memory:{tokens:new Set(['avant','autrefois','jadis']),weight:3},
  progression:{tokens:new Set(['ensuite','apres','puis']),weight:2},
  question:{tokens:new Set(['pourquoi','comment']),weight:2}
};
function evidence(words,index){
  const from=index,to=Math.min(words.length,index+6);
  const segment=words.slice(from,to);
  return {quote:quote(segment).slice(0,116),wordTimings:segment.map(w=>({...w})),startMs:words[index].startMs,
    endMs:Math.min(words.at(-1).endMs,words[Math.min(words.length-1,index+5)].endMs+550)};
}
function semanticCandidates(words,intents){
  if(!Array.isArray(intents))return [];
  const tokens=words.map(w=>clean(w.text));
  const candidates=[];
  for(const intent of intents.slice(0,8)){
    if(Number(intent?.confidence)<.78)continue;
    const actual=clean(intent.evidence_quote).split(' ').filter(Boolean);
    if(actual.length<3)continue;
    let index=-1;
    for(let i=0;i<=tokens.length-actual.length;i++){
      if(tokens.slice(i,i+actual.length).join(' ')===actual.join(' ')){index=i;break;}
    }
    if(index<0)continue;
    const type=String(intent.type||'').toLowerCase();
    const kind=type==='metric'?'evidence':type==='flow'?'turn':
      type==='steps'?'progression':type==='comparison'?'turn':
      type==='emphasis'?'chapter':null;
    if(!kind)continue;
    const segment=words.slice(index,index+actual.length);
    candidates.push({kind,quote:quote(segment).slice(0,116),wordTimings:segment.map(w=>({...w})),
      startMs:segment[0].startMs,
      endMs:Math.min(words.at(-1).endMs,segment.at(-1).endMs+1400),
      reason:'verified_semantic_quote',weight:6});
  }
  return candidates;
}
export function planCinematicStoryboard(rawWords,durationMs,intents=null){
  if(!Number.isFinite(durationMs)||durationMs<1000)return [];
  const words=Array.isArray(rawWords)?rawWords.map(w=>({
    text:String(w?.text||'').trim(),startMs:Number(w?.startMs),endMs:Number(w?.endMs)
  })).filter(w=>w.text&&Number.isFinite(w.startMs)&&Number.isFinite(w.endMs)
    &&w.startMs>=0&&w.endMs>w.startMs&&w.endMs<=durationMs+250)
    .sort((a,b)=>a.startMs-b.startMs):[];
  if(words.length<6)return [];
  const candidates=semanticCandidates(words,intents);
  const tokens=words.map(w=>clean(w.text));
  for(let i=0;i<words.length;i++){
    if(i<2||i>words.length-5)continue;
    for(const [kind,{tokens:set,weight}] of Object.entries(MARKERS)){
      if(!set.has(tokens[i]))continue;
      // A single conjunction is not evidence of a visual story beat:
      // require a complete, intelligible local quote with spoken context.
      const item=evidence(words,i);
      if(item.quote.split(/\s+/).length<5)continue;
      candidates.push({...item,kind,reason:'explicit_spoken_transition',weight});
      break;
    }
  }
  // Keep the most relevant verified moments, not a fixed motion every N seconds.
  candidates.sort((a,b)=>b.weight-a.weight||a.startMs-b.startMs);
  const accepted=[],maximum=Math.min(3,Math.max(1,Math.ceil(durationMs/23000)));
  for(const scene of candidates){
    if(accepted.length>=maximum)break;
    const startMs=Math.round(Math.max(0,scene.startMs));
    const endMs=Math.round(Math.min(durationMs,Math.max(startMs+1300,scene.endMs)));
    if(endMs-startMs<900)continue;
    if(accepted.some(x=>startMs<x.endMs+2100&&endMs>x.startMs-2100))continue;
    accepted.push({
      kind:scene.kind,quote:scene.quote,wordTimings:scene.wordTimings||[],startMs,endMs,
      evidence:'transcript',reason:scene.reason,depth:1.5
    });
  }
  return accepted.sort((a,b)=>a.startMs-b.startMs);
}
