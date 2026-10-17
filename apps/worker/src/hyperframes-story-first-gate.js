/**
 * Edit+ staging editorial safety gate:
 * NEVER show a meaningful object, diagram, label or comparison
 * before the source video actually introduces its semantic concept.
 *
 * HyperFrames only renders approved scenes. The planner, not HyperFrames,
 * provides transcript-based anchors and edit decisions.
 *
 * No guessed timecodes, no generic "speech started" fallback.
 */
import {findSpokenPhrase,mapSourceToOutput,validateSpeechWords} from './hyperframes-speech-sync.js';

const num=x=>typeof x==='number'&&Number.isFinite(x);
const clamp=(n,low,high)=>Math.min(high,Math.max(low,n));
const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'')
  .toLowerCase().replace(/[^a-z0-9 ]/g,' ').replace(/\s+/g,' ').trim();

/**
 * Plan one semantic object. The cited phrase is an EXACT excerpt
 * of word-aligned speech, never an invented caption or paraphrase.
 * This also rejects automatic premature exposition in visual metaphors.
 */
export function gateSemanticVisual({
 event,words,alignment,sourceDurationMs,keepRanges,
 latencyMs=90
}={}){
 const reject=(reason)=>({status:'held',accepted:false,reason,
   eventId:String(event?.id||''),sourceStartMs:null,outputStartMs:null});
 if(!event||typeof event!=='object')return reject('INVALID_EVENT');
 if(!['object','diagram','title','chart','caption','comparison','arrow'].includes(event.kind)){
   return reject('UNSUPPORTED_VISUAL_TYPE');
 }
 if(!Array.isArray(keepRanges)||!keepRanges.length)return reject('CUT_MAP_MISSING');
 if(!num(sourceDurationMs)||sourceDurationMs<=0)return reject('DURATION_MISSING');
 const speech=validateSpeechWords(words,{durationMs:sourceDurationMs,alignment});
 if(speech.status!=='verified')return reject('VERIFIED_WORD_ALIGNMENT_MISSING');
 const phrase=norm(event.spokenEvidence);
 if(!phrase)return reject('SPOKEN_EVIDENCE_MISSING');
 // A human reading the video must explicitly choose between repeated phrases.
 const tokens=phrase.split(' ');
 // French contractions may be one ASR word: "quelqu'un" -> ["quelqu","un"].
 // Expand each ASR word without losing its original evidence timestamps.
 const expanded=speech.words.flatMap(w=>norm(w.text).split(' ').filter(Boolean)
   .map(token=>({token,startMs:w.startMs,endMs:w.endMs})));
 const hits=[];
 for(let i=0;i<=expanded.length-tokens.length;i++){
   if(tokens.every((x,j)=>expanded[i+j].token===x)){
     hits.push({startMs:expanded[i].startMs,
       endMs:expanded[i+tokens.length-1].endMs});
   }
 }
 if(!hits.length)return reject('PHRASE_NOT_SPOKEN');
 if(hits.length>1&&!Number.isInteger(event.occurrenceIndex))return reject('AMBIGUOUS_REPEATED_PHRASE');
 const match=hits[event.occurrenceIndex??0];
 if(!match)return reject('OCCURRENCE_NOT_FOUND');
 // Editorial invariance: object may not preempt the FIRST word.
 const firstWord=match.startMs;
 const at=clamp(firstWord+Math.max(0,latencyMs),0,sourceDurationMs);
 const outputStartMs=mapSourceToOutput(at,keepRanges);
 if(outputStartMs===null)return reject('ANCHOR_REMOVED_BY_CUT');
 const sourceEndMs=num(event.sourceEndMs)?event.sourceEndMs:Math.min(sourceDurationMs,match.endMs+1500);
 if(sourceEndMs<=at)return reject('EVENT_ENDS_BEFORE_SPOKEN_ANCHOR');
 let endOutput=mapSourceToOutput(Math.min(sourceEndMs-.01,sourceDurationMs-.01),keepRanges);
 if(endOutput===null)return reject('VISUAL_OVERLAPS_REMOVED_SOURCE');
 if(endOutput<=outputStartMs)return reject('INVALID_OUTPUT_DURATION');
 return {
   accepted:true,status:'speech_verified',eventId:String(event.id||''),
   kind:event.kind,spokenEvidence:event.spokenEvidence,
   sourceStartMs:at,sourceEndMs,
   outputStartMs,outputEndMs:endOutput,
   semanticIntroducedAtMs:firstWord,provenance:alignment.method,
   // The planner can animate the object during the proved phrase;
   // it must never animate into view earlier.
   motionSpec:event.motionSpec||null
 };
}
export function reviewSemanticStoryboard({events=[],words=[],alignment=null,
 sourceDurationMs,keepRanges}={}){
 const approved=[],held=[];
 for(const event of events){
   const result=gateSemanticVisual({event,words,alignment,
     sourceDurationMs,keepRanges});
   (result.accepted?approved:held).push(result);
 }
 return {accepted:approved,held,policy:'NO_SEMANTIC_VISUAL_BEFORE_SPOKEN_EVIDENCE',
   failClosed:true,version:1};
}
