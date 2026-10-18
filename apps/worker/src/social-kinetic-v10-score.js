/**
 * Real proof coverage (0..100). NEVER a subjective visual/art quality score.
 * Each point represents an explicitly independently verified release condition.
 * Scores under 100 block product labeling "100/100". Unit test mocks are not proof.
 */
import {assessSocialKineticV10CommercialRelease} from './social-kinetic-v10-release.js';
const finite=x=>typeof x==='number'&&Number.isFinite(x);
export const V10_SCORE_RUBRIC=Object.freeze([
 {id:'full_mp4_decoding',weight:8,claim:'La video finale se decode integralement',
  check:e=>e.video?.fullDecodePassed===true},
 {id:'native_aspect_format',weight:8,claim:'Ratio natif et orientation preserves',
  check:e=>finite(e.video?.sourceWidth)&&finite(e.video?.sourceHeight)&&
   finite(e.video?.width)&&finite(e.video?.height)&&
   Math.abs(e.video.width/e.video.height-e.video.sourceWidth/e.video.sourceHeight)<.012&&
   (e.video.width>e.video.height)===(e.video.sourceWidth>e.video.sourceHeight)},
 {id:'original_voice_entire_video',weight:10,claim:'Voix source identique sur toute la duree',
  check:e=>e.audio?.sourceVoiceVerified===true&&e.audio?.fullTimelineCompared===true&&
   e.audio?.aiVoice===false&&e.audio.channels===e.audio.sourceChannels&&
   finite(e.audio.voiceCorrelation)&&e.audio.voiceCorrelation>=.995},
 {id:'safe_audio_peak',weight:4,claim:'Aucun ecretage: pic vrai <= -1 dBTP',
  check:e=>finite(e.audio?.truePeakDbTP)&&e.audio.truePeakDbTP<=-1.0},
 {id:'word_timestamps_provider',weight:15,claim:'Mots reellement horodates par source ASR',
  check:e=>e.speech?.alignment?.verified===true&&
   ['provider_word_timestamps','forced_word_alignment','forced_alignment'].includes(e.speech.alignment.method)},
 {id:'words_audio_reviewed',weight:15,claim:'Tous les mots revus a l ecoute et derive max <=90 ms',
  check:e=>e.speech?.alignment?.reviewedAgainstAudio===true&&
   finite(e.speech.alignment.maxObservedDriftMs)&&e.speech.alignment.maxObservedDriftMs<=90&&
   finite(e.speech.verifiedWords)&&finite(e.speech.spokenWords)&&e.speech.spokenWords>0&&
   e.speech.verifiedWords/e.speech.spokenWords>=.97},
 {id:'video_safe_placement',weight:12,claim:'Visage mains ecritures et textes proteges',
  check:e=>e.visual?.frameSampler==='independent_frames'&&
   e.visual.framesSampled>=60&&e.visual.safeFrames/e.visual.framesSampled>=.99&&
   e.visual.handCollisions===0&&e.visual.textClipping===0&&
   e.visual.protectedContentCollisions===0&&e.visual.textBeforeSpeech===0&&
   e.visual.unsupportedClaimGraphics===0},
 {id:'reference_visual_audio',weight:10,claim:'Vraie comparaison video/reference image et son approuvee',
  check:e=>e.review?.humanReferenceComparison===true&&
   e.review?.mobileReviewPassed===true&&e.review?.sfxListeningApproved===true},
 {id:'three_distinct_full_edits',weight:12,claim:'Trois rushes distincts traites integralement en HyperFrames',
  check:e=>e.regression?.allPassed===true&&e.regression?.failureCount===0&&
   Array.isArray(e.regression.sampleEvidence)&&e.regression.sampleEvidence.length>=3&&
   new Set(e.regression.sampleEvidence.map(x=>x.sha256)).size===e.regression.sampleEvidence.length&&
   e.regression.sampleEvidence.every(x=>x.hyperframesFullEditPassed===true&&
     x.wordTimingAudioReviewed===true&&x.frameSafeVisualReviewed===true&&
     x.finalAudioReviewed===true&&x.finalFullDecodePassed===true&&x.mobileReviewPassed===true)},
 {id:'user_release_approval',weight:6,claim:'Approbation finale utilisateur',
  check:e=>e.review?.userApproved===true}
]);
export function scoreSocialKineticV10(evidence={}){
 const checks=V10_SCORE_RUBRIC.map(({id,weight,claim,check})=>{
   let pass=false;try{pass=check(evidence)===true}catch{}
   return {id,claim,weight,confirmed:pass,awarded:pass?weight:0};
 });
 const score=checks.reduce((sum,x)=>sum+x.awarded,0);
 const gate=assessSocialKineticV10CommercialRelease(evidence);
 return {version:'social_kinetic_v10_proof_scoring_2026_10_18',
   score,maxScore:100,scoreType:'verified_release_evidence_NOT_creative_quality',
   status:score===100&&gate.ready?'100_100_CERTIFIED':'NOT_CERTIFIED',
   releaseReady:score===100&&gate.ready,
   checks,blocking:checks.filter(x=>!x.confirmed).map(x=>x.id),commercialGate:gate};
}
