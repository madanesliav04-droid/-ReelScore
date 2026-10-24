// Cinematic V7 only: derive editorial cues from this source, never historical timings.
import {mapOriginalToOutput} from '../../worker/src/edit.js';
import {buildLocalEdit} from './local-edit.mjs';
export const CINEMATIC_VERSION='cinematic-v7-autonomous-1';
const invalid=message=>Object.assign(new Error(message),{code:'CINEMATIC_INPUT',status:422});
const pending=w=>w.reviewRequired===true&&w.confirmed!==true;
const lexical=s=>s.toLocaleLowerCase('fr').normalize('NFD').replace(/\p{M}/gu,'');
export function normalizeCinematicTranscript(input,report,{preview=false}={}){
 const data=Array.isArray(input)?{words:input}:input;
 if(data?.sourceSha256&&data.sourceSha256!==report.fingerprint)throw invalid('La transcription appartient à une autre vidéo.');
 const supplied=data?.words??data?.transcript;
 if(!Array.isArray(supplied)||!supplied.length)throw invalid('Une transcription horodatée non vide est nécessaire.');
 const words=supplied.map(w=>{
  if(!w||typeof w!=='object')throw invalid('Entrée de transcription invalide.');
  const text=typeof (w.text??w.word)==='string'?(w.text??w.word).trim():'';
  const uncertain=pending(w)||(w.probability!==undefined&&w.probability<.75)||/\s/.test(text);
  return {...w,text,startMs:w.startMs??Math.round(w.start*1000),endMs:w.endMs??Math.round(w.end*1000),...(uncertain?{reviewRequired:true,confirmed:w.confirmed===true}:{})};
 });
 // Reuse the existing timing, text and raw-ASR-interval safeguards.
 buildLocalEdit({report,transcript:words,captionsReviewed:false,previewOnly:true});
 const reviewed=data.reviewed===true||data.captionsReviewed===true;
 if(!preview&&(!reviewed||words.some(w=>pending(w)||/\s/.test(w.text))))throw invalid('Transcription non confirmée : relisez les mots et horaires, ou utilisez --preview pour un export explicitement non validé.');
 return {words,reviewed:reviewed&&!words.some(pending),warnings:words.flatMap((w,i)=>[
  ...(pending(w)?[{code:'WORD_REVIEW_REQUIRED',wordIndex:i}]:[]),
  ...(/\s/.test(w.text)?[{code:'MULTIWORD_ASR_TOKEN',wordIndex:i}]:[])
 ])};
}
export function planCinematic(report,transcription,{preview=false}={}){
 const {words,reviewed,warnings}=normalizeCinematicTranscript(transcription,report,{preview});
 if(!report.metadata.hasAudio)throw invalid('La voix originale est requise.');
 if(report.metadata.durationMs>60_000||report.metadata.width*report.metadata.height>1920*1080)throw invalid('Ce port V7 accepte actuellement 60 secondes et 1080p natif maximum.');
 if(report.metadata.width%2||report.metadata.height%2)throw invalid('Dimensions impaires : ce port H.264 conserve uniquement les dimensions natives paires.');
 // Cut only a measured internal pause, with retained silence on both sides,
 // outside the original ASR intervals. Keep ambiguous/incomplete phrases intact.
 const approvedPauseIds=[],heldPauses=[];
 for(const pause of report.suggestions){
  const before=words.findLastIndex(w=>w.endMs<=pause.startMs);
  const after=words.findIndex(w=>w.startMs>=pause.endMs);
  const left=words[before],right=words[after];
  if(!left||!right||pending(left)||pending(right)||(!/[.!?]$/.test(left.text)&&right.startMs-left.endMs<1100)){
   heldPauses.push({id:pause.id,reason:'Phrase boundary or confident word gap not established'});continue;
  }
  try{buildLocalEdit({report,approvedPauseIds:[pause.id],transcript:words,captionsReviewed:reviewed,previewOnly:preview});approvedPauseIds.push(pause.id);}catch{heldPauses.push({id:pause.id,reason:'Original ASR interval or 120ms word guard intersects the pause'});}
 }
 const edit=buildLocalEdit({report,approvedPauseIds,transcript:words,captionsReviewed:reviewed,previewOnly:preview});
 // Clause boundaries come only from supplied punctuation and measured word gaps.
 const clauses=[];let first=0;
 const flush=last=>{if(last>=first)clauses.push({first,last});first=last+1;};
 for(let i=0;i<words.length;i++)if(/[.!?,;:]$/.test(words[i].text)||i===words.length-1||words[i+1].startMs-words[i].endMs>380)flush(i);
 // Hold uncertain words on camera; retain confident contiguous phrases
 // around them rather than discarding an otherwise useful whole clause.
 const runs=[];
 for(const clause of clauses){let begin=clause.first;for(let i=clause.first;i<=clause.last+1;i++){
  if(i>clause.last||pending(words[i])||/\s/.test(words[i].text)){
   if(i-begin>=3)runs.push({first:begin,last:i-1});begin=i+1;
  }
 }}
 const candidates=[];
 for(const clause of runs){
  const selected=words.slice(clause.first,clause.last+1);const text=selected.map(w=>w.text).join(' '),duration=selected.at(-1).endMs-selected[0].startMs;
  if(selected.length>12||text.length>80||duration<1000||duration>6500||/^(a|à|de|et|ou|que|qui|un|une|le|la|les|des|du|pour|dans|en)$/i.test(selected.at(-1).text))continue;
  const normalized=lexical(text);
  const score=Number(/\?/.test(text))*3+Number(/aider|valeur|probleme|competence|apprendr|temps|argent|besoin|concret|solution|productif|objectif/.test(normalized))*2+Number(/[.!?]$/.test(text));
  candidates.push({...clause,text,score,startMs:selected[0].startMs,endMs:Math.min(report.metadata.durationMs,selected.at(-1).endMs+280)});
 }
 // Sparse scenes across the current story; at most 35% of this source is covered.
 const chosen=[];let occupied=0;const budget=report.metadata.durationMs*.35;
 for(const c of candidates.sort((a,b)=>b.score-a.score||a.first-b.first)){
  if(chosen.length===4)break;
  if(c.startMs<report.metadata.durationMs*.08||c.endMs>report.metadata.durationMs-300||c.endMs-c.startMs+occupied>budget||chosen.some(p=>c.startMs<p.endMs+1400&&p.startMs<c.endMs+1400))continue;
  chosen.push(c);occupied+=c.endMs-c.startMs;
 }
 const events=chosen.sort((a,b)=>a.startMs-b.startMs).map((c,i)=>{
  // A secondary item is an entire subsequent confident clause, not an
  // arbitrary chunk of three words. This preserves what was actually said.
  const total=c.last-c.first+1,details=[];
  let endMs=c.endMs;
  for(const next of candidates.filter(n=>n.first>c.last).sort((a,b)=>a.first-b.first)){
   const count=next.last-next.first+1;
   if(next.startMs-endMs>1200||next.endMs-c.startMs>6500||details.length===3||occupied+next.endMs-endMs>budget)break;
   if(count>8||next.text.length>42||chosen.some(other=>other!==c&&next.startMs<other.endMs&&next.endMs>other.startMs))break;
   // Do not jump over an uncertain/missing phrase to manufacture a sequence.
   const previousLast=details.length?details.at(-1).wordIndex+details.at(-1).wordCount-1:c.last;
   if(words.slice(previousLast+1,next.first).some(w=>pending(w)||/\s/.test(w.text)))break;
   details.push({wordIndex:next.first,wordCount:count});occupied+=next.endMs-endMs;endMs=next.endMs;
  }
  const kind=/\?/.test(c.text)?'cinematic-question':details.length>=3?'cinematic-chain':details.length>=2?'cinematic-cards':'cinematic-key';
  return {wordIndex:c.first,wordCount:total,endMs,kind,details};
 });
 if(!events.length)warnings.push({code:'NO_CONFIDENT_GRAPHIC_PHRASE'});
 return {engineVersion:CINEMATIC_VERSION,sourceSha256:report.fingerprint,transcript:words,captionsReviewed:reviewed,allowUnreviewedPreview:preview,placementReviewed:true,events,approvedPauseIds,
  cuts:edit.cuts,keepRanges:edit.keepRanges,outputDurationMs:edit.outputDurationMs,warnings,heldPauses,mappedWords:words.map(w=>({...w,outputStartMs:mapOriginalToOutput(w.startMs,edit.keepRanges),outputEndMs:mapOriginalToOutput(w.endMs,edit.keepRanges)})),
  transcriptionEngine:{version:transcription.transcriptionEngine?.version??transcription.engineVersion??'supplied_timestamps',modelSha256:transcription.transcriptionEngine?.modelSha256??transcription.modelSha256??null,timingMethod:transcription.transcriptionEngine?.timingMethod??transcription.timingMethod??'supplied_not_independently_verified'},
  placementPolicy:'Native camera unchanged; V7 full-screen graphics replace camera only during derived scenes. No face/hand tracking claimed.',
  captionStatus:reviewed?'user_confirmed_not_independently_phonetic':'unreviewed_preview',releaseApproved:false};
}
