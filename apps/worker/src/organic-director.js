// Experimental evidence-first editorial planner. No new LLM calls.
// Rejects ungrounded text/timings; gives up rather than making up a title.
const normalize=s=>String(s||'').replace(/\s+/g,' ').trim();
const tokens=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim().split(/\s+/).filter(Boolean);
function timing(text,words){
  const needle=tokens(text),hay=[];
  for(const w of words||[])for(const tok of tokens(w.text))hay.push({tok,start:Number(w.startMs),end:Number(w.endMs)});
  for(let i=0;i<=hay.length-needle.length;i++){
    if(needle.every((x,j)=>hay[i+j].tok===x)&&Number.isFinite(hay[i].start)&&Number.isFinite(hay[i+needle.length-1].end))
      return {startMs:hay[i].start,endMs:hay[i+needle.length-1].end};
  }
  return null;
}
export function buildOrganicCues({captions=[],words=[],durationMs=0,maxPer30s=2}={}){
  if(!Number.isFinite(durationMs)||durationMs<500)return [];
  const limit=Math.min(7,Math.ceil(durationMs/30000*maxPer30s));
  const ordered=[...captions].filter(x=>Number.isFinite(Number(x.startMs))&&Number.isFinite(Number(x.endMs))).sort((a,b)=>a.startMs-b.startMs);
  const sentences=[];let buffer=[];
  const flush=()=>{if(buffer.length){sentences.push({text:normalize(buffer.map(x=>x.text).join(' '))});buffer=[]}};
  for(const c of ordered){
    const t=normalize(c.text).replace(/\\N/g,' ');
    if(!t||c.endMs<=c.startMs||c.endMs>durationMs+400)continue;
    const prev=buffer.at(-1);
    if(prev&&(c.startMs-prev.endMs>750||buffer.map(x=>x.text).join(' ').length+t.length>205))flush();
    buffer.push({...c,text:t});
    if(/[.!?]$/.test(t)||buffer.length>=6)flush();
  }
  flush();
  const results=[];
  for(const sentence of sentences){
    const p=sentence.text;
    if(p.length<10||p.length>245||/\b(?:euh|heu|umm)\b/i.test(p))continue;
    const opts=[
      ['sequence',p.match(/attirer[,]?\s+convertir\s+et\s+livrer/i)],
      ['question',p.match(/(?:est.ce que|comment|pourquoi|combien|how|why|what|who)[^?]{3,82}\?|(?:ça|ca)[^?]{0,35}comment\?/i)],
      ['number',p.match(/\b\d+(?:[,.]\d+)?\s?(?:%|€|\$|euros?|clients?|jours?|heures?|ans?)\b/i)],
      ['sequence',p.match(/\b(?:premi[eè]r|deuxi[eè]me|troisi[eè]me)\s+(?:point|étape)\b/i)],
      ['contrast',p.match(/\b(?:mais|pourtant|en revanche|however|instead)\b[^.!?]{15,80}[.!?]/i)]
    ];
    const matched=opts.find(([,m])=>m&&normalize(m[0]).length<=58);
    if(!matched)continue;
    const [kind,m]=matched,text=normalize(m[0]),where=timing(text,words);
    if(!where||where.startMs<0||where.startMs>=durationMs)continue;
    results.push({startMs:where.startMs,endMs:Math.min(durationMs,where.startMs+2100),text,mode:'organic',kind,evidence:'timed_transcript'});
  }
  results.sort((a,b)=>a.startMs-b.startMs);
  return results.filter((cue,i)=>results.findIndex(other=>Math.abs(other.startMs-cue.startMs)<4200)===i).slice(0,limit);
}
