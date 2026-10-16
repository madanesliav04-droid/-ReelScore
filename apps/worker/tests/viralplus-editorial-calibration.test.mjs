import test from 'node:test';
import assert from 'node:assert/strict';
import {SCORE_WEIGHTS,SCORE_RUBRIC,SCORE_CRITERION_BASIS,editorialScoreAudit,calculateScore} from '../src/viral-quality.js';

const videoScore={
 hook:70,scroll_stop:65,clarity:83,rhythm:75,retention:70,
 structure:80,text_captions:90,visual:88,audio:80,originality:67,cta:25
};
const staticLandscape={aspectRatio:1.7778,sceneCutsPer10Sec:0,wordsPerMinute:225.2,silenceRatio:.2353,longestSilenceSec:1.088,meanVolumeDb:-19.7,audioCodec:'aac'};
const briskPortrait={aspectRatio:.5625,sceneCutsPer10Sec:8.5,wordsPerMinute:148,silenceRatio:.018,longestSilenceSec:.12,meanVolumeDb:-15.5,audioCodec:'aac'};

test('one video cannot lose points simply because its edit is a static native landscape with pauses',()=>{
 const first=editorialScoreAudit({scores:videoScore},staticLandscape);
 const second=editorialScoreAudit({scores:videoScore},briskPortrait);
 assert.deepEqual(first.scores,second.scores);
 assert.equal(calculateScore(first.scores),calculateScore(second.scores));
 assert.ok(first.audit.caveats.some(x=>x.includes('Format horizontal')));
 assert.ok(first.audit.caveats.some(x=>x.includes('Silences')));
 assert.equal(first.audit.machine_signals_used_as_context_not_auto_penalties,true);
});
test('different observed quality scores produce different overall scores, not a globally static number',()=>{
 const strong={...videoScore,hook:92,scroll_stop:87,clarity:93,rhythm:89,retention:91,structure:94,visual:93,originality:80};
 const weak={...videoScore,hook:25,scroll_stop:35,clarity:38,rhythm:45,retention:28,structure:32,visual:55,originality:27};
 const excellent=calculateScore(editorialScoreAudit({scores:strong},staticLandscape).scores);
 const needsWork=calculateScore(editorialScoreAudit({scores:weak},briskPortrait).scores);
 assert.ok(excellent>needsWork+30,`unexpectedly flat scores: ${excellent} vs ${needsWork}`);
});
test('no platform metrics or guaranteed reach are inferred from editorial scores',()=>{
 const result=editorialScoreAudit({scores:videoScore},staticLandscape).audit;
 assert.equal(result.not_a_virality_prediction,true);
 assert.equal(result.empirically_calibrated_against_platform_outcomes,false);
 assert.equal(result.independent_criteria,true);
 assert.equal(SCORE_WEIGHTS.cta,0);
 assert.equal(Object.values(SCORE_WEIGHTS).reduce((a,b)=>a+b,0),100);
 assert.ok(SCORE_RUBRIC[90].includes('Excellent'));
 assert.ok(SCORE_CRITERION_BASIS.retention.includes('pas une courbe'));
});
test('a static plan can score 95 on visual craft when justified by observed content',()=>{
 const scores=editorialScoreAudit({scores:{...videoScore,visual:95}},staticLandscape).scores;
 assert.equal(scores.visual,95);
 assert.equal(scores.rhythm,75);
});
