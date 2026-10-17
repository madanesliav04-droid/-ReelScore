/**
 * Edit+ Social Kinetic V10 — paid-release admission gate.
 * Fail CLOSED: passing a synthetic HyperFrames render is not evidence that
 * real words match real voice, reference styling or customer rushes.
 */
const finite=n=>typeof n==='number'&&Number.isFinite(n);
const ratio=(a,b)=>finite(a)&&finite(b)&&b>0?a/b:0;
export const V10_MINIMUMS=Object.freeze({
 exactWordMaxDriftMs:90,minimumRealRushes:3,minimumVoiceCorrelation:.995,
 minimumWordCoverage:.97,minimumVisualSamplingFrames:60,
 minimumSafeFramesRatio:.99,minimumMeasuredFps:24,
 maxSilentGapSec:3.0
});
export function assessSocialKineticV10CommercialRelease({
 speech={},video={},audio={},visual={},regression={},review={}
}={}){
 const blocked=[];
 const fail=(name,condition)=>{if(!condition)blocked.push(name);};
 fail('SPEECH_WORD_TIMING_NOT_FORCE_ALIGNED',
   speech.alignment?.verified===true&&
   ['forced_alignment','provider_word_timestamps'].includes(speech.alignment?.method)&&
   speech.alignment?.reviewedAgainstAudio===true&&
   finite(speech.alignment?.maxObservedDriftMs)&&
   speech.alignment.maxObservedDriftMs<=V10_MINIMUMS.exactWordMaxDriftMs);
 fail('SPEECH_MISSING_VERIFIED_WORD_COVERAGE',
   finite(speech.verifiedWords)&&finite(speech.spokenWords)&&
   speech.spokenWords>0&&ratio(speech.verifiedWords,speech.spokenWords)>=V10_MINIMUMS.minimumWordCoverage);
 fail('VIDEO_DECODE_OR_NATIVE_GEOMETRY_FAILED',
   video.fullDecodePassed===true&&
   finite(video.sourceWidth)&&finite(video.sourceHeight)&&
   video.sourceWidth>=320&&video.sourceHeight>=240&&
   video.width===video.sourceWidth&&video.height===video.sourceHeight&&
   finite(video.measuredFps)&&video.measuredFps>=V10_MINIMUMS.minimumMeasuredFps&&
   finite(video.durationSeconds)&&video.durationSeconds>2&&
   finite(video.expectedDurationSeconds)&&
   Math.abs(video.durationSeconds-video.expectedDurationSeconds)<.067);
 fail('ORIGINAL_VOICE_OR_STEREO_NOT_VERIFIED',
   audio.sourceVoiceVerified===true&&audio.aiVoice===false&&
   audio.channels===2&&
   finite(audio.voiceCorrelation)&&audio.voiceCorrelation>=V10_MINIMUMS.minimumVoiceCorrelation&&
   finite(audio.truePeakDbTP)&&audio.truePeakDbTP<=-1.0);
 fail('VFX_FACE_COLLISION_OR_MOTION_GAPS',
   visual.frameSampler==='independent_frames'&&
   finite(visual.framesSampled)&&visual.framesSampled>=V10_MINIMUMS.minimumVisualSamplingFrames&&
   finite(visual.safeFrames)&&ratio(visual.safeFrames,visual.framesSampled)>=V10_MINIMUMS.minimumSafeFramesRatio&&
   visual.handCollisions===0&&visual.textClipping===0&&
   visual.textBeforeSpeech===0&&visual.unsupportedClaimGraphics===0&&
   finite(visual.maxUnmotivatedSilentGapSec)&&
   visual.maxUnmotivatedSilentGapSec<=V10_MINIMUMS.maxSilentGapSec);
 fail('REFERENCE_VISUAL_REVIEW_NOT_APPROVED',
   review.humanReferenceComparison===true&&review.mobileReviewPassed===true&&
   review.sfxListeningApproved===true&&review.userApproved===true);
 fail('REAL_RUSH_REGRESSION_NOT_PROVEN',
   regression.realRushCount>=V10_MINIMUMS.minimumRealRushes&&
   regression.allPassed===true&&regression.failureCount===0&&
   regression.portraitPassed===true&&regression.landscapePassed===true);
 return {
  model:'social_kinetic_v10',
  admission:blocked.length?'BLOCKED':'APPROVED_FOR_PAID_DELIVERY',
  ready:blocked.length===0,
  blockedBy:blocked,
  referenceScene:'social_kinetic_v10_commercial_qa_candidate',
  gate:'FAIL_CLOSED',
  syntheticRenderingCannotOverride:true
 };
}
