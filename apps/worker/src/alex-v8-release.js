/**
 * Edit+ Alex Hormozi V8 - production candidate contract.
 * Keeps the user's locked V7 optical typography; adds a fail-closed admission
 * gate for every real upload. No synthetic words, invented cues or timing.
 * Model release in production is a separate, explicit operational decision.
 */
import {buildAlexV7AudioPlan} from './alex-v7-audio-captions.js';

const numeric=x=>typeof x==='number'&&Number.isFinite(x);

function deny(reason,details={}){
 return {
  model:'alex_hormozi_v8',status:'blocked',releaseStatus:'NOT_APPROVED',
  reason,groups:[],semanticVisuals:[],wordCount:0,
  quality:{passed:false,reason,...details}
 };
}
export function buildAlexV8ReleasePlan({analysis,timeline,semanticEvents=[]}={}){
 const dur=Number(timeline?.outputDurationMs);
 const sourceDur=Number(timeline?.sourceDurationMs);
 const width=Number(timeline?.export?.width),height=Number(timeline?.export?.height);
 const srcW=Number(analysis?.measurable?.width),srcH=Number(analysis?.measurable?.height);
 if(!numeric(dur)||!numeric(sourceDur)||dur<750||dur>600000)
   return deny('INVALID_SOURCE_OR_OUTPUT_DURATION');
 if(!numeric(width)||!numeric(height)||!numeric(srcW)||!numeric(srcH)||
    Math.min(width,height,srcW,srcH)<240)
   return deny('VIDEO_DIMENSIONS_NOT_VERIFIED');
 // Portrait must remain portrait, landscape must remain landscape.
 if((srcW>srcH)!==(width>height))
   return deny('NATIVE_ORIENTATION_REQUIRED');
 if(analysis?.measurable?.audioCodec==null||timeline?.audio?.hasAudio!==true)
   return deny('ORIGINAL_AUDIO_REQUIRED');
 const plan=buildAlexV7AudioPlan({analysis,timeline,semanticEvents,
   allowProviderPreview:true});
 if(plan.status==='blocked')return deny(plan.reason||'TIMED_WORDS_MISSING');
 const transcriptWords=analysis?.transcript?.words;
 // Reject implausibly sparse ASR rather than shipping attractive but mostly
 // silent/empty captions. Short clips (under 10 s) need at least 3 real words.
 const wordFloor=dur>=10000?Math.max(6,Math.floor(dur/1000*.55)):3;
 if(plan.wordCount<wordFloor)
   return deny('TRANSCRIPT_INCOMPLETE',{wordCount:plan.wordCount,wordFloor});
 const sorted=plan.groups;
 if(!sorted.length||!Array.isArray(transcriptWords)||!transcriptWords.length)
   return deny('NO_CAPTION_GROUPS');
 let last=-1,shown=0;
 for(const g of sorted){
   if(!numeric(g.startMs)||!numeric(g.endMs)||
      g.startMs<0||g.startMs<last||g.endMs<=g.startMs||
      g.endMs>dur+35||!g.words?.length)
     return deny('INVALID_CAPTION_TIMELINE');
   // Words must not be displayed ahead of their source time after cuts.
   for(const w of g.words){
     if(!numeric(w.startMs)||!numeric(w.endMs)||w.startMs<g.startMs||
        w.endMs>dur+35||w.endMs<=w.startMs)
       return deny('WORD_OUTSIDE_OUTPUT');
     shown++;
   }
   last=g.endMs;
 }
 // No unsupported semantic graphics sneak through provider-only evidence.
 if(plan.status==='preview_transcript_timed'&&plan.semanticVisuals.length)
   return deny('UNVERIFIED_SEMANTIC_VISUALS');
 return {
  ...plan,model:'alex_hormozi_v8',design:'alex-v7-apple-kinetic-LOCKED',
  status:'ready_for_render',
  releaseStatus:'REQUIRES_REAL_RUSH_QA',
  quality:{
   passed:true,outputDurationMs:dur,sourceDurationMs:sourceDur,
   transcriptionSource:plan.alignment?.source||'unknown',
   captionCount:sorted.length,wordCount:shown,wordFloor,
   uncertainty:'Provider offsets are unconfirmed against human listening',
   layout:'original_orientation',audio:'original_audio_only',
   graphics:'speech-evidence-only'
  }
 };
}

export function assertAlexV8Deployment({mode=process.env.ENABLE_ALEX_V8_WORD_SYNC,
 publicEnabled=process.env.ENABLE_ALEX_V8_PUBLIC}={}){
 if(mode!=='staging'&&mode!=='production')
   throw new Error('ALEX_V8_WORD_SYNC_DISABLED');
 if(mode==='production'&&publicEnabled!=='true')
   throw new Error('ALEX_V8_PRODUCTION_REQUIRES_RELEASE_APPROVAL');
 return mode;
}
