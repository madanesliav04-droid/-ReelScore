// Edit+ Codie / OMNI v54 -- paid-quality requirements are evaluated, never assumed.
// A target of 2-3 b-rolls is not a quota to fill with unrelated stock.
export const OMNI_CODIE_CONTRACT_VERSION='omni-codie-v54-quality-contract';
const finite=x=>Number.isFinite(Number(x));
export function auditOmniCodieModel({timeline,analysis}={}){
 if(timeline?.style!=='codie'&&timeline?.modelId!=='codie')return null;
 const broll=Array.isArray(timeline.brollCues)?timeline.brollCues:[],
       bubbles=(timeline.graphicCues||[]).filter(x=>x.mode==='omni_bubbles'),
       captions=Array.isArray(timeline.captions)?timeline.captions:[],
       cutReview=timeline.cutReview||{},
       warnings=[];
 // 2-3 selected b-rolls only if related visuals actually exist.
 if(broll.length<2)warnings.push('INSUFFICIENT_CONTEXTUAL_BROLL');
 if(broll.length>3)warnings.push('EXCESSIVE_BROLL');
 if(broll.some(b=>!b.creativeEvidence||!String(b.visualAnchor||b.query||'').trim()))
   warnings.push('UNVERIFIED_BROLL_RELEVANCE');
 if(broll.some((b,i)=>i>0&&finite(b.startMs)&&finite(broll[i-1].endMs)&&
   Number(b.startMs)-Number(broll[i-1].endMs)<1100))
   warnings.push('BROLL_INSUFFICIENT_VISUAL_BREATHING_ROOM');
 if(bubbles.some(x=>!x.semanticMeaning||!x.compositionProof))
   warnings.push('DECORATIVE_OR_UNTRACKED_BUBBLE');
 if(!captions.length||timeline?.captionConfig?.safeCaptionPlacement!=='omni_bottom_center_adaptive')
   warnings.push('BOTTOM_CENTRED_CAPTIONS_NOT_PROVEN');
 if(!Array.isArray(cutReview.accepted)||!Array.isArray(cutReview.held))
   warnings.push('CUT_CONTINUITY_NOT_REVIEWED');
 // Synthetic checks can never prove the B-roll visually communicates the speech.
 warnings.push('HUMAN_VISUAL_AND_LISTENING_APPROVAL_REQUIRED');
 return {
  policy:OMNI_CODIE_CONTRACT_VERSION,
  target:{broll:'2-3 meaningful shots if evidence exists',bubbles:'few verbal-concept-driven cues',
    cuts:'independent alignment and gesture continuity required',
    captions:'Avenir reference, Inter Display temporary rendering, adaptive bottom-centre',
    sound:'sound tied to transitions only, original voice must remain recognizable'},
  observed:{brollCount:broll.length,bubbleCount:bubbles.length,captionCount:captions.length,
    acceptedCuts:cutReview.accepted?.length||0,heldCuts:cutReview.held?.length||0},
  commercialReady:false,warnings:[...new Set(warnings)]
 };
}
