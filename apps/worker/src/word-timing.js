// Edit+ quality gate: source-grounded word timestamps only.
// The ASR text must never be replaced with AI-invented on-screen words.
export function durationOffsetMs(value){
  if(typeof value==='number'&&Number.isFinite(value)&&value>=0)return Math.round(value*1000);
  const s=String(value??'').trim();
  const m=s.match(/^(\d+(?:\.\d+)?)s$/);
  if(m)return Math.round(Number(m[1])*1000);
  const colon=s.match(/^(?:(\d+):)?(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?$/);
  if(colon)return ((Number(colon[1]||0)*60+Number(colon[2]))*60+Number(colon[3]))*1000+Number((colon[4]||'').padEnd(3,'0'));
  return NaN;
}
const compactText=word=>String(word?.text||'').trim();
const normalize=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'')
 .toLowerCase().replace(/[^a-z0-9]+/g,' ').trim().replace(/\s+/g,' ');
/**
 * The SDK puts word_info in steps[].content[].annotations, sometimes content
 * is not type:text. Parse all annotation holders, not only text holders.
 * Leave sparse/malformed data visible as failed validation, never synthesize.
 */
export function extractAsrWordAnnotations(body){
  const seen=new Set(),out=[];
  for(const step of Array.isArray(body?.steps)?body.steps:[]){
    for(const content of Array.isArray(step?.content)?step.content:[]){
      for(const x of Array.isArray(content?.annotations)?content.annotations:[]){
        if(x?.type!=='word_info'||!compactText(x))continue;
        const startMs=durationOffsetMs(x.start_offset);
        const endMs=durationOffsetMs(x.end_offset);
        const key=[x.text,startMs,endMs,x.speaker||''].join('|');
        if(seen.has(key))continue;
        seen.add(key);
        out.push({text:compactText(x),startMs,endMs,speaker:x.speaker||null});
      }
    }
  }
  return out;
}
export function validateTimedWords(raw,durationMs,{minWords=3}={}){
  if(!Array.isArray(raw)||raw.length<minWords)
    return {ok:false,reason:'ASR_NOT_READY',words:[],count:raw?.length||0};
  if(!Number.isFinite(durationMs)||durationMs<=0)
    return {ok:false,reason:'ASR_DURATION_INVALID',words:[],count:raw.length};
  const words=[];
  let lastStart=-1,previousEnd=-1;
  for(const w of raw){
    const text=compactText(w);
    const a=Number(w.startMs),b=Number(w.endMs);
    if(!text||!Number.isFinite(a)||!Number.isFinite(b)||a<0||b<=a||
       b>durationMs+200||b-a>3200||
       a+120<lastStart||a+300<previousEnd){
      return {ok:false,reason:'ASR_TIMING_INVALID',words:[],count:raw.length};
    }
    words.push({...w,text,startMs:Math.round(a),endMs:Math.round(b)});
    lastStart=a;previousEnd=Math.max(previousEnd,b);
  }
  const spokenText=normalize(words.map(x=>x.text).join(' '));
  return {ok:true,reason:null,words,count:words.length,spokenText,
    firstMs:words[0].startMs,lastMs:words.at(-1).endMs};
}
export function semanticMatchesWords(text,words){
  const textNorm=normalize(text);
  const wordsNorm=normalize((words||[]).map(w=>w.text).join(' '));
  if(!textNorm||!wordsNorm)return false;
  // Punctuation and normalization vary; check ordered content rather than
  // requiring byte-identical ASR output.
  const speech=wordsNorm.split(' '),reference=textNorm.split(' ');
  let i=0;
  for(const token of reference){
    if(speech[i]===token)i++;
    if(i>=speech.length)return true;
  }
  return i/Math.max(1,speech.length)>=0.82;
}
