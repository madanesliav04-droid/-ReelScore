import test from 'node:test';
import assert from 'node:assert/strict';
import {assessSocialKineticV10CommercialRelease} from '../src/social-kinetic-v10-release.js';
function passing(){
 return {
  speech:{alignment:{verified:true,method:'forced_alignment',reviewedAgainstAudio:true,maxObservedDriftMs:62},
    verifiedWords:149,spokenWords:151},
  video:{fullDecodePassed:true,sourceWidth:960,sourceHeight:540,width:960,height:540,
    measuredFps:30,durationSeconds:38.533,expectedDurationSeconds:38.533},
  audio:{sourceVoiceVerified:true,aiVoice:false,sourceChannels:2,channels:2,voiceCorrelation:.999,
    truePeakDbTP:-1.2},
  visual:{frameSampler:'independent_frames',framesSampled:200,safeFrames:200,
    handCollisions:0,textClipping:0,textBeforeSpeech:0,unsupportedClaimGraphics:0,
    maxUnmotivatedSilentGapSec:1.3},
  review:{humanReferenceComparison:true,mobileReviewPassed:true,
    sfxListeningApproved:true,userApproved:true},
  regression:{realRushCount:3,allPassed:true,failureCount:0,portraitPassed:true,
    landscapePassed:true,
    // Artificial unit-test proofs, never production receipts.
    sampleEvidence:[
      {sha256:'a'.repeat(64),sourceWidth:512,sourceHeight:910},
      {sha256:'b'.repeat(64),sourceWidth:910,sourceHeight:512},
      {sha256:'c'.repeat(64),sourceWidth:910,sourceHeight:512}
    ].map(x=>({...x,sourceFullDecodePassed:true,hyperframesFullEditPassed:true,
      wordTimingAudioReviewed:true,frameSafeVisualReviewed:true,
      finalAudioReviewed:true,finalFullDecodePassed:true,mobileReviewPassed:true}))}
 };
}
test('V10 commercial admission is blocked by default',()=>{
 const x=assessSocialKineticV10CommercialRelease();
 assert.equal(x.ready,false);
 assert.ok(x.blockedBy.includes('SPEECH_WORD_TIMING_NOT_FORCE_ALIGNED'));
 assert.ok(x.blockedBy.includes('REAL_RUSH_REGRESSION_NOT_PROVEN'));
});
test('Passing criteria require every independent proof',()=>{
 const x=assessSocialKineticV10CommercialRelease(passing());
 assert.equal(x.ready,true);assert.equal(x.blockedBy.length,0);
});
for(const [reason,modify] of [
 ['SPEECH_WORD_TIMING_NOT_FORCE_ALIGNED',x=>{x.speech.alignment.reviewedAgainstAudio=false}],
 ['SPEECH_MISSING_VERIFIED_WORD_COVERAGE',x=>{x.speech.verifiedWords=100}],
 ['VIDEO_DECODE_OR_NATIVE_GEOMETRY_FAILED',x=>{x.video.width=540;x.video.height=960}],
 ['ORIGINAL_VOICE_OR_AUDIO_CHANNELS_NOT_VERIFIED',x=>{x.audio.channels=1}],
 ['VFX_FACE_COLLISION_OR_MOTION_GAPS',x=>{x.visual.handCollisions=1}],
 ['REFERENCE_VISUAL_REVIEW_NOT_APPROVED',x=>{x.review.userApproved=false}],
 ['REAL_RUSH_REGRESSION_NOT_PROVEN',x=>{x.regression.realRushCount=1}]
]){
 test('V10 rejects '+reason,()=>{
  const x=passing();modify(x);
  const r=assessSocialKineticV10CommercialRelease(x);
  assert.equal(r.ready,false);assert.ok(r.blockedBy.includes(reason));
 });
}

test('Commercial gate accepts original mono as well as original stereo when every proof is met',()=>{
 const x=passing();x.audio.sourceChannels=1;x.audio.channels=1;
 assert.equal(assessSocialKineticV10CommercialRelease(x).ready,true);
 x.audio.channels=2;
 assert.equal(assessSocialKineticV10CommercialRelease(x).ready,false);
});

test('A third independent raw source does NOT count as 3 full autonomous HyperFrames edits',()=>{
 const x=passing();
 x.regression.sampleEvidence[2].hyperframesFullEditPassed=false;
 assert.equal(assessSocialKineticV10CommercialRelease(x).ready,false);
});
test('Duplicate raw sources cannot inflate 3-rush regression count',()=>{
 const x=passing();
 x.regression.sampleEvidence[2].sha256=x.regression.sampleEvidence[1].sha256;
 assert.equal(assessSocialKineticV10CommercialRelease(x).ready,false);
});
test('New whiteboard original smoke-pass with no word timestamps is still blocked',()=>{
 const x=passing();
 x.regression.sampleEvidence[2]={sha256:'5b05ad6e25080291a89a87ab6ad2f3e566787a7276994d6ed02949647e9f5bd9',
   sourceWidth:910,sourceHeight:512,sourceFullDecodePassed:true,
   pipelineSmokePassed:true,hyperframesFullEditPassed:false,
   wordTimingAudioReviewed:false,frameSafeVisualReviewed:false,
   finalAudioReviewed:false,finalFullDecodePassed:false,mobileReviewPassed:false};
 assert.equal(assessSocialKineticV10CommercialRelease(x).ready,false);
});
