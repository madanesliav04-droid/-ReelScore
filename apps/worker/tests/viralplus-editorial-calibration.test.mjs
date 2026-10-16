import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {SCORE_WEIGHTS,SCORE_RUBRIC,SCORE_CRITERION_BASIS,editorialScoreAudit,calculateScore,detectUnsupportedFormatPenalty} from '../src/viral-quality.js';

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

test('real Oct 16 16:9 score explanation is detected as an invalid vertical-flow assumption',()=>{
 const evidence={
  scroll_stop:"Le premier plan est un facecam cadré en contre-plongée légère dans un format horizontal 16:9, ce qui limite l'impact visuel initial dans un flux mobile vertical.",
  visual:"Les diapositives graphiques sont épurées et professionnelles, mais le cadrage facecam reste brut (webcam fixe, format horizontal natif)."
 };
 const disputed_keys=['scroll_stop','visual'];
 const biases=detectUnsupportedFormatPenalty({evidence,measurable:staticLandscape,review:{disputed_keys}});
 assert.deepEqual(biases.map(x=>x.criterion),['visual','scroll_stop']);
});
test('a legitimately weak crop can be criticized without falsely declaring landscape a failure',()=>{
 const evidence={visual:'Le sujet est coupé sur le bord droit et sa bouche sort du cadre, malgré le format 16:9.'};
 const biases=detectUnsupportedFormatPenalty({evidence,measurable:staticLandscape,review:{disputed_keys:['visual']}});
 assert.equal(biases.length,0);
});
test('vertical videos are allowed to be evaluated for vertical feed compatibility',()=>{
 const evidence={scroll_stop:'Le 16:9 dans un flux mobile vertical limite la visibilité du visage.'};
 const biases=detectUnsupportedFormatPenalty({evidence,measurable:briskPortrait});
 assert.equal(biases.length,0);
});

test('editorial prompt never imposes vertical safe-zone defects on native landscape uploads',()=>{
  const prompt=readFileSync(new URL('../src/viral.js',import.meta.url),'utf8');
  assert.match(prompt,/const sourceLandscape=/);
  assert.match(prompt,/POLITIQUE DE FORMAT \(OBLIGATOIRE\)/);
  assert.doesNotMatch(prompt,/tout ratio non adapté au short-form/);
  assert.match(prompt,/SOURCE HORIZONTALE NATIVE/);
});
