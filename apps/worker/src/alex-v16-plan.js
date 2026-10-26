// Reconstructed V16 fullscreen grammar. Explicit speech evidence, no master
// timings/pixels and no generic visual fallback. Initial French business intents
// are deliberately bounded: unsupported content is held for editorial review.
import {mapOriginalToOutput} from './edit.js';
import {validateTimedWords} from './word-timing.js';
import {discourseScenes} from './alex-v16-discourse.js';
const norm=s=>String(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
const fail=(code,message)=>{throw Object.assign(new Error(message),{code});};

export function alexKeepRanges(words,silences,durationMs){
 const removals=[];
 // Remove only measured, long pauses BETWEEN completed sentences, with release
 // margins. Never remove fillers, syllables or a pause merely inferred by ASR.
 for(let i=1;i<words.length;i++){
  const left=words[i-1],right=words[i];
  if(!/[.!?;:]$/.test(left.text)||right.startMs-left.endMs<800)continue;
  for(const s of silences||[]){
   const start=Math.max(left.endMs+160,Math.ceil(s.start*1000)+100);
   const end=Math.min(right.startMs-160,Math.floor(s.end*1000)-100);
   if(end-start>=400)removals.push({startMs:start,endMs:end,reason:'measured-inter-sentence-silence'});
  }
 }
 removals.sort((a,b)=>a.startMs-b.startMs);
 const unique=[];
 for(const r of removals){const prev=unique.at(-1);if(prev&&r.startMs<=prev.endMs)prev.endMs=Math.max(prev.endMs,r.endMs);else unique.push({...r});}
 const keepRanges=[];let cursor=0;
 for(const r of unique){if(r.startMs>cursor)keepRanges.push({startMs:cursor,endMs:r.startMs});cursor=r.endMs;}
 if(cursor<durationMs)keepRanges.push({startMs:cursor,endMs:durationMs});
 return {keepRanges,removedRanges:unique};
}

export function buildAlexV16Plan({transcript,measurable}){
 const durationMs=Math.round(measurable.durationSec*1000);
 const checked=validateTimedWords(transcript?.words,durationMs);
 if(!checked.ok)fail('ALEX_TRANSCRIPT_REQUIRED','Horodatage réel des mots requis : '+checked.reason);
 // Stricter than the legacy validator: no overlapping active-word windows.
 if(checked.words.some((w,i)=>i&&w.startMs<checked.words[i-1].endMs))fail('ALEX_TIMING_REVIEW_REQUIRED','Des mots se chevauchent.');
 const {keepRanges,removedRanges}=alexKeepRanges(checked.words,measurable.silenceWindows,durationMs);
 const outputDurationMs=keepRanges.reduce((a,r)=>a+r.endMs-r.startMs,0);
 const words=checked.words.map((w,i)=>({...w,sourceIndex:i,sourceStartMs:w.startMs,sourceEndMs:w.endMs,startMs:mapOriginalToOutput(w.startMs,keepRanges),endMs:mapOriginalToOutput(w.endMs,keepRanges)}));
 if(words.some(w=>w.startMs==null||w.endMs==null||w.endMs<=w.startMs))fail('ALEX_CUT_WORD_LOSS','Un cut traverse un mot.');
 const tokens=words.map(w=>norm(w.text));
 let scenes=discourseScenes(words,outputDurationMs/1000);
 const plannerStrategy=scenes?'extractive-discourse-relations':'bounded-legacy-intents';
 if(!scenes){
 function find(phrases,after=0){
  for(const phrase of phrases){
   const p=phrase.split(/\s+/).map(norm);
   for(let i=after;i<=tokens.length-p.length;i++)if(p.every((t,j)=>tokens[i+j]===t))return {first:i,last:i+p.length-1,text:words.slice(i,i+p.length).map(w=>w.text).join(' ').replace(/[.,!?;:]+$/g,''),start:words[i].startMs/1000,end:words[i+p.length-1].endMs/1000};
  }
  fail('ALEX_SCENE_EVIDENCE_REQUIRED','Relation éditoriale non reconnue : '+phrases.join(' / '));
 }
 const qTitle=find(['au début','au départ']);
 const qLeft=find(['expliquer'],qTitle.last);
 const qRight=find(['vivent déjà le problème','vivent le problème'],qLeft.last);
 const qCallout=find(['se plaignent déjà','cherchent déjà une solution'],qRight.last);
 const valueTitle=find(['parce que vendre'],qRight.last);
 const valueLeft=find(['vendre'],valueTitle.first);
 const valueRight=find(['plus simple'],valueLeft.last);
 const valueCallout=find(['la personne sait déjà'],valueRight.last);
 const chainTitle=find(['ton boulot','votre travail'],valueRight.last);
 const chain1=find(['montrer'],chainTitle.last);
 const chain2=find(['ta solution','votre solution'],chain1.last);
 const chain3=find(['la bonne'],chain2.last);
 const chainCallout=find(['comment faire'],chain3.last);
 function sentenceEnd(after){let i=after;while(i<words.length-1&&!/[.!?]$/.test(words[i].text))i++;return Math.min(outputDurationMs/1000,words[i].endMs/1000+.16);}
 const qStart=qTitle.start,vStart=valueTitle.start,cStart=chain1.start;
 const qEnd=Math.min(vStart-.18,sentenceEnd(qCallout.last)),vEnd=Math.min(cStart-.18,sentenceEnd(valueCallout.last)),cEnd=outputDurationMs/1000;
 const headline=x=>x.text.toLocaleUpperCase('fr');
 function common(kind,start,end,title,labels,conclusion,spans,cues){
  if(end-start<2)fail('ALEX_SCENE_TOO_SHORT','La relation ne dispose pas du temps de lecture nécessaire.');
  return {kind,start,end,text:{chapter:`0${kind==='question'?1:kind==='value'?2:3} / ${headline(title)}`,title:headline(title),labels:labels.map(headline),conclusion:headline(conclusion),...(kind==='chain'?{}:{symbols:kind==='question'?['?','+']:['+','€']})},evidence:spans.map(s=>({firstWord:s.first,lastWord:s.last,start:s.start,end:s.end,text:s.text})),cues};
 }
 scenes=[
  common('question',qStart,qEnd,qTitle,[qLeft,qRight],qCallout,[qTitle,qLeft,qRight,qCallout],{rightHighlight:qRight.start-qStart,arrowStart:qRight.start-qStart,arrowDuration:Math.max(.3,qRight.end-qRight.start),calloutStart:qCallout.start-qStart,calloutDuration:.45}),
  common('value',vStart,vEnd,valueTitle,[valueLeft,valueRight],valueCallout,[valueTitle,valueLeft,valueRight,valueCallout],{rightHighlight:valueRight.start-vStart,arrowStart:valueLeft.end-vStart,arrowDuration:Math.max(.3,valueRight.start-valueLeft.end),calloutStart:valueCallout.start-vStart,calloutDuration:.43}),
  common('chain',cStart,cEnd,chainTitle,[chain1,chain2,chain3],chainCallout,[chainTitle,chain1,chain2,chain3,chainCallout],{nodeStarts:[0,chain2.start-cStart,chain3.start-cStart],arrowStarts:[chain1.end-cStart,chain2.end-cStart],arrowDuration:.4,calloutStart:chainCallout.start-cStart,calloutDuration:.2})
 ];
 }
 for(const s of scenes){if(s.end-s.start-s.cues.calloutStart<1)fail('ALEX_SCENE_TOO_SHORT','Bandeau trop bref pour être lu.');}
 const issues=words.filter(w=>Number(w.probability??0)<.75||/\s/.test(w.text)).map(w=>({wordIndex:w.sourceIndex,text:w.text,startMs:w.sourceStartMs,endMs:w.sourceEndMs,probability:w.probability??null,...(/\s/.test(w.text)?{reason:'ASR_GROUP_WITHOUT_DISTINCT_WORD_BOUNDARIES'}:{})}));
 const reviewed=transcript.reviewed===true;
 return {schemaVersion:1,purpose:'new-rush',engine:'alex-v16-reconstructed-discourse-v2',plannerStrategy,wordVerification:reviewed?'human-confirmed':'automatic-needs-review',reviewRequired:!reviewed||issues.length>0,issues,warnings:transcript.warnings||[],scenes,words:words.map(w=>({text:w.text,start:w.startMs/1000,end:w.endMs/1000,sourceIndex:w.sourceIndex,sourceStart:w.sourceStartMs/1000,sourceEnd:w.sourceEndMs/1000,probability:w.probability})),keepRanges,removedRanges,outputDurationMs,sourceDurationMs:durationMs,supportedIntent:'Extractive French contrasts, functional financial effects and explicit enumerations; ambiguous or incomplete sets are held. Heuristic relations, not general semantic certification.'};
}
