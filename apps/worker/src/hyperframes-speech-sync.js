/**
 * Edit+ speech-to-motion planner, staging only.
 * HyperFrames renders motion; word alignment must come from a verified ASR/forced aligner.
 * No transcript, no invented exact words or timestamps.
 */
const finite=v=>Number.isFinite(Number(v));
const asNumber=v=>Number(v);
const sorted=a=>[...a].sort((x,y)=>x.startMs-y.startMs);

/** @returns {{status:string, words:Array,errors:Array}} */
export function validateSpeechWords(words,{durationMs,alignment}={}){
 const errors=[];
 if(!Array.isArray(words)||!words.length)return {status:'missing',words:[],errors:['WORDS_UNAVAILABLE']};
 if(!finite(durationMs)||asNumber(durationMs)<=0)errors.push('INVALID_SOURCE_DURATION');
 let last=-1;
 const verified=[];
 for(let i=0;i<words.length;i++){
   const w=words[i],text=String(w?.text||'').trim();
   const start=asNumber(w?.startMs),end=asNumber(w?.endMs);
   if(!text||!finite(w?.startMs)||!finite(w?.endMs)||
      start<0||end<=start||end>durationMs+35||
      start<last-90){errors.push('INVALID_WORD:'+i);continue}
   last=Math.max(last,start);
   verified.push({text,startMs:start,endMs:end,sourceIndex:i});
 }
 if(!verified.length)errors.push('NO_VALID_WORDS');
 const evidence=alignment?.verified===true&&
   ['forced_word_alignment','provider_word_timestamps'].includes(alignment.method);
 if(!evidence)errors.push('WORD_ALIGNMENT_NOT_VERIFIED');
 return {status:errors.length?'unverified':'verified',words:verified,errors};
}

/** Find a spoken phrase, with accurate timestamps ONLY if the word alignment is verified. */
export function findSpokenPhrase({words,phrase,alignment,durationMs}){
 const result=validateSpeechWords(words,{durationMs,alignment});
 if(result.status!=='verified')return {status:'unverified',reason:result.errors,match:null};
 const norm=s=>String(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase()
   .replace(/[^a-z0-9 ]+/g,' ').replace(/\s+/g,' ').trim();
 const needle=norm(phrase).split(' ').filter(Boolean);
 if(!needle.length)return {status:'invalid_phrase',match:null};
 for(let i=0;i<=result.words.length-needle.length;i++){
   if(needle.every((s,j)=>norm(result.words[i+j].text)===s)){
     return {status:'verified',match:{
       startMs:result.words[i].startMs,endMs:result.words[i+needle.length-1].endMs,
       words:result.words.slice(i,i+needle.length)
     }};
   }
 }
 return {status:'phrase_not_found',match:null};
}

/** Map source timestamp through full source keep-ranges, preserving cut ordering. */
export function mapSourceToOutput(sourceMs,keepRanges){
 if(!Array.isArray(keepRanges)||!keepRanges.length)return null;
 let offset=0,prior=0;
 for(const r of keepRanges){
   const start=Number(r.startMs??r[0]),end=Number(r.endMs??r[1]);
   if(!Number.isFinite(start)||!Number.isFinite(end)||start<prior||end<=start)return null;
   if(sourceMs>=start&&sourceMs<end)return Math.round(offset+sourceMs-start);
   offset+=end-start;
   prior=end;
 }
 return null;
}
/** A motion cue may only claim true word-level sync if its anchor was independently verified. */
export function resolveMotionTrigger({phrase,words=[],alignment=null,durationMs,keepRanges,
 acousticAnchorMs=null,latencyMs=60}){
 const match=findSpokenPhrase({words,phrase,alignment,durationMs});
 if(match.status==='verified'){
   const at=match.match.startMs+latencyMs, mapped=mapSourceToOutput(at,keepRanges);
   return {status:mapped===null?'cut_conflict':'word_verified',sourceMs:at,
     outputMs:mapped,confidence:'verified',basis:'word-alignment',
     anchor:phrase,wordStartMs:match.match.startMs};
 }
 if(finite(acousticAnchorMs)&&acousticAnchorMs!==null){
   const at=Number(acousticAnchorMs)+Math.max(0,latencyMs);
   return {status:'speech_fallback_unverified',sourceMs:at,
     outputMs:mapSourceToOutput(at,keepRanges),confidence:'approximate',
     basis:'acoustic-speech-onset',anchor:phrase,
     warning:'Not aligned with the spoken phrase; require verified word timestamps before commercial export'};
 }
 return {status:'blocked',sourceMs:null,outputMs:null,confidence:'none',
   basis:'none',anchor:phrase,warning:'No transcript or speech evidence'};
}
