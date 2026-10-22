import test from 'node:test';
import assert from 'node:assert/strict';
import {scoreSocialKineticV10,V10_SCORE_RUBRIC} from '../src/social-kinetic-v10-score.js';
const sample=(sha,w,h)=>({
 sha256:sha.repeat(64),sourceWidth:w,sourceHeight:h,
 sourceFullDecodePassed:true,hyperframesFullEditPassed:true,
 wordTimingAudioReviewed:true,frameSafeVisualReviewed:true,
 finalAudioReviewed:true,finalFullDecodePassed:true,mobileReviewPassed:true
});
function proven(){
 return {
  speech:{alignment:{verified:true,method:'provider_word_timestamps',
    reviewedAgainstAudio:true,maxObservedDriftMs:30},
    verifiedWords:149,spokenWords:151},
  video:{fullDecodePassed:true,sourceWidth:910,sourceHeight:512,
    width:960,height:540,measuredFps:30,durationSeconds:38.533,
    expectedDurationSeconds:38.533},
  audio:{sourceVoiceVerified:true,fullTimelineCompared:true,aiVoice:false,
    sourceChannels:2,channels:2,voiceCorrelation:.9999,truePeakDbTP:-1.3},
  visual:{frameSampler:'independent_frames',framesSampled:250,safeFrames:250,
    handCollisions:0,textClipping:0,textBeforeSpeech:0,
    unsupportedClaimGraphics:0,protectedContentCollisions:0,
    maxUnmotivatedSilentGapSec:1.5},
  review:{humanReferenceComparison:true,mobileReviewPassed:true,
    sfxListeningApproved:true,userApproved:true},
  regression:{realRushCount:3,allPassed:true,failureCount:0,
    portraitPassed:true,landscapePassed:true,
    sampleEvidence:[sample('a',512,910),sample('b',910,512),sample('c',910,512)]}
 };
}
test('Scoring weights sum to exactly 100',()=>{
 assert.equal(V10_SCORE_RUBRIC.reduce((s,c)=>s+c.weight,0),100);
});
test('Evidence-free model is NOT certified or quality-scored 100',()=>{
 const x=scoreSocialKineticV10();
 assert.equal(x.score,0);
 assert.equal(x.releaseReady,false);
 assert.equal(x.status,'NOT_CERTIFIED');
});
test('All independent evidence can lead to certified release (synthetic fixture ONLY)',()=>{
 const x=scoreSocialKineticV10(proven());
 assert.equal(x.score,100);
 assert.equal(x.releaseReady,true);
});
test('Three successful smoke transcodes with no full HyperFrames edit are NOT 100',()=>{
 const x=proven();x.regression.sampleEvidence[2].hyperframesFullEditPassed=false;
 const o=scoreSocialKineticV10(x);
 assert.equal(o.releaseReady,false);
 assert.ok(o.score<100);
});
test('Pretty animation and no text/audio review cannot be 100',()=>{
 const x=proven();x.speech.alignment.reviewedAgainstAudio=false;
 x.review.humanReferenceComparison=false;
 const o=scoreSocialKineticV10(x);
 assert.equal(o.releaseReady,false);assert.ok(o.score<=75);
});
test('A user cannot simply override the release gate by claiming 100',()=>{
 const x=proven();delete x.visual.maxUnmotivatedSilentGapSec;
 const o=scoreSocialKineticV10(x);
 assert.equal(o.score,100);
 assert.equal(o.releaseReady,false);
 assert.equal(o.status,'NOT_CERTIFIED');
});
test('Source mono retained mono is eligible; a dub or changed channel is not',()=>{
 const x=proven();x.audio.sourceChannels=1;x.audio.channels=1;
 assert.equal(scoreSocialKineticV10(x).releaseReady,true);
 x.audio.channels=2;assert.equal(scoreSocialKineticV10(x).releaseReady,false);
});
