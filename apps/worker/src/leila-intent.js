/**
 * Edit+ Leila: evidence-first visual decisions.
 * An overlay is OPTIONAL. Never generate a comparison card just because a
 * transcript contains a business keyword. Displayed copy is always excerpted
 * from the actual timed transcript, never invented by a generative model.
 */
const TYPES=new Set(['comparison','steps','flow','metric','emphasis']);
const normalization=s=>String(s??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'')
  .toLowerCase().replace(/[^a-z0-9€$%]+/g,' ').trim().replace(/\s+/g,' ');
const joined=items=>items.map(x=>String(x.text).trim()).join(' ').replace(/\s+([,.;!?])/g,'$1').trim();
const tail=(items,index,count=5)=>joined(items.slice(index,Math.min(items.length,index+count)));
const isTimed=(w,duration)=>Number.isFinite(Number(w?.startMs))&&Number.isFinite(Number(w?.endMs))
  &&Number(w.endMs)>Number(w.startMs)&&Number(w.startMs)>=0
  &&Number(w.endMs)<=duration+300&&Boolean(normalization(w.text));
const lexemes=items=>items.map(w=>normalization(w.text));
const phraseWindow=(items,phrase)=>{
  const wanted=normalization(phrase).split(' ').filter(Boolean);
  if(wanted.length<2)return null;
  const tokens=lexemes(items);
  for(let i=0;i<items.length;i++){
    for(let len=wanted.length;len<=Math.min(wanted.length+3,items.length-i);len++){
      if(normalization(joined(items.slice(i,i+len)))===wanted.join(' '))
        return {first:i,last:i+len-1};
    }
  }
  return null;
};
const gapOk=(words,a,b,maxMs)=>a>=0&&b>a&&b<words.length&&
  words[b].startMs-words[a].startMs<=maxMs;
const near=(items,i,r=2)=>joined(items.slice(Math.max(0,i-r),Math.min(items.length,i+r+1)));
const placement=v=>['left','right','top'].includes(v)?v:'left';
const seconds=v=>Number.isFinite(Number(v))?Number(v)*1000:NaN;

function explicitCompare(words,first,last){
  const toks=lexemes(words.slice(first,last+1));
  const p=toks.findIndex(x=>x==='vs'||x==='versus');
  if(p<2||p>toks.length-3)return null;
  const idx=first+p;
  const left=joined(words.slice(Math.max(first,idx-3),idx));
  const right=joined(words.slice(idx+1,Math.min(last+1,idx+4)));
  if(normalization(left).split(' ').length<1||normalization(right).split(' ').length<1)return null;
  return [left,right];
}
function stepPair(words,first,last){
  const tokens=lexemes(words);
  let a=-1,b=-1;
  const firstRe=/^(premier|premiere|premierement|1er|1ere|1|dabord)$/;
  const secondRe=/^(deuxieme|second|deuxiemement|ensuite|2e|2eme|2)$/;
  for(let i=first;i<=last;i++){
    if(a<0&&firstRe.test(tokens[i]))a=i;
    else if(a>=0&&secondRe.test(tokens[i])&&gapOk(words,a,i,15000)){b=i;break;}
  }
  if(a<0||b<0)return null;
  return {first:a,second:b,items:[tail(words,a,4),tail(words,b,4)]};
}
function flowPair(words,first,last){
  const toks=lexemes(words);
  let a=-1,b=-1;
  for(let i=first;i<=last;i++){
    if(a<0&&['si','parce','cause'].includes(toks[i]))a=i;
    else if(a>=0&&['alors','donc'].includes(toks[i])&&gapOk(words,a,i,11000)){b=i;break;}
  }
  return a>=0&&b>=0?{first:a,second:b,items:[tail(words,a,4),tail(words,b,4)]}:null;
}
function metricAt(words,first,last){
  const toks=lexemes(words);
  for(let i=first;i<=last;i++){
    const num=/^\d+(?:[,.]\d+)?(?:[%€$])?$/.test(toks[i]);
    if(!num)continue;
    const adjacent=toks[i+1]||'';
    const before=toks[i-1]||'';
    const unit=/^(€|\$|%|euros?|dollars?|jours?|heures?|minutes?|secondes?|mois|ans?|clients?|abonnes?|vues?)$/;
    if(!unit.test(adjacent)&&!unit.test(before)&&!/[€$%]/.test(toks[i]))continue;
    return {at:i,value:joined(words.slice(i,Math.min(last+1,i+2)))};
  }
  return null;
}
const candidatesFromSpeech=words=>{
  const cues=[],t=lexemes(words);
  for(let i=0;i<words.length;i++){
    const end=Math.min(words.length-1,i+17);
    if(t[i]==='vs'||t[i]==='versus'){
      const compare=explicitCompare(words,Math.max(0,i-4),Math.min(words.length-1,i+4));
      if(compare){
        cues.push({type:'comparison',startMs:words[Math.max(0,i-2)].startMs,
          endMs:Math.min(words.at(-1).endMs,words[i].startMs+2800),
          items:compare,reason:'spoken_explicit_contrast'});
      }
    }
    const steps=stepPair(words,i,end);
    if(steps&&steps.first===i)cues.push({type:'steps',startMs:words[i].startMs,
      endMs:Math.min(words[steps.second].endMs+2300,words[end].endMs+500),
      items:steps.items,reason:'two_spoken_step_markers'});
    const flow=flowPair(words,i,end);
    if(flow&&flow.first===i)cues.push({type:'flow',startMs:words[i].startMs,
      endMs:Math.min(words[flow.second].endMs+2300,words[end].endMs+500),
      items:flow.items,reason:'spoken_cause_effect'});
    const metric=metricAt(words,i,i+1<words.length?i+1:i);
    if(metric&&metric.at===i)cues.push({type:'metric',startMs:words[i].startMs,
      endMs:words[i].endMs+1700,items:[metric.value],reason:'measured_unit_spoken'});
    if(/^(pourquoi|comment)$/.test(t[i])&&i+3<words.length){
      const endIndex=Math.min(words.length-1,i+9);
      const text=joined(words.slice(i,endIndex+1));
      if(/[?]/.test(text))cues.push({type:'emphasis',startMs:words[i].startMs,
        endMs:Math.min(words[endIndex].endMs+350,words[i].startMs+2500),
        items:[joined(words.slice(i,Math.min(words.length,i+6)))],reason:'spoken_question'});
    }
  }
  return cues;
};
function fromSemantic(words,intent){
  if(!intent||Number(intent.confidence)<0.76)return null;
  const type=String(intent.type||'').toLowerCase();
  if(!TYPES.has(type))return null;
  const quote=String(intent.evidence_quote||'');
  const found=phraseWindow(words,quote);
  if(!found)return null;
  const first=found.first,last=Math.min(words.length-1,found.last+9);
  const heard=words.slice(first,last+1);
  const explicit=explicitCompare(words,first,last);
  const step=stepPair(words,first,last);
  const flow=flowPair(words,first,last);
  const metric=metricAt(words,first,last);
  // Cross-check the model's recommendation with the actual spoken structure.
  if(type==='comparison'&&!explicit)return null;
  if(type==='steps'&&!step)return null;
  if(type==='flow'&&!flow)return null;
  if(type==='metric'&&!metric)return null;
  let items=type==='comparison'?explicit:type==='steps'?step.items:
    type==='flow'?flow.items:type==='metric'?[metric.value]:[joined(heard.slice(0,6))];
  // The proposed time must overlap the actual timed words, not just fit a duration.
  const proposed=seconds(intent.start_sec);
  if(Number.isFinite(proposed)&&Math.abs(proposed-words[first].startMs)>1600)return null;
  return {type,startMs:words[first].startMs,
    endMs:Math.min(words[last].endMs+650,words[first].startMs+3400),
    placement:placement(intent.placement),items,reason:'semantic_intent_verified_by_spoken_evidence'};
}
export function planLeilaVisuals(rawWords,durationMs,intents=null){
  if(!Number.isFinite(durationMs)||durationMs<=0)return [];
  const words=Array.isArray(rawWords)?rawWords.filter(w=>isTimed(w,durationMs))
    .map(w=>({...w,startMs:Number(w.startMs),endMs:Number(w.endMs)}))
    .sort((a,b)=>a.startMs-b.startMs):[];
  if(words.length<3)return [];
  // AI may deliberately propose no overlays. Honor that choice. If analysis is
  // older and has no visual plan, use strictly conservative spoken signals.
  const raw=Array.isArray(intents)?intents.map(x=>fromSemantic(words,x)).filter(Boolean)
    :candidatesFromSpeech(words);
  const order={comparison:5,steps:4,flow:3,metric:2,emphasis:1};
  raw.sort((a,b)=>(order[b.type]-order[a.type])||(a.startMs-b.startMs));
  const accepted=[],limit=Math.min(5,Math.ceil(durationMs/9000));
  for(const item of raw){
    if(accepted.length>=limit)break;
    if(!TYPES.has(item.type)||!item.items?.every(x=>String(x).trim()))continue;
    const start=Math.max(0,Math.round(item.startMs));
    const end=Math.min(durationMs,Math.round(Math.max(start+700,item.endMs)));
    if(end-start<700)continue;
    if(accepted.some(s=>start<s.endMs+1200&&end>s.startMs-1200))continue;
    accepted.push({...item,startMs:start,endMs:end,placement:item.placement||'left'});
  }
  return accepted.sort((a,b)=>a.startMs-b.startMs);
}
