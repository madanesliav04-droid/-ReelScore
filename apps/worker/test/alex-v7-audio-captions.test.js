import test from 'node:test';
import assert from 'node:assert/strict';
import {buildAlexV7AudioPlan,alexV7CaptionHtml} from '../src/alex-v7-audio-captions.js';

const alignment={verified:true,method:'provider_word_timestamps',
 source:'gemini_interactions_word_info',reviewedAgainstAudio:false};
const sourceWords=[
 {text:'gagner',startMs:11000,endMs:11260},
 {text:'de',startMs:11270,endMs:11400},
 {text:"l'argent",startMs:11420,endMs:11830},
 {text:'pour',startMs:12000,endMs:12280},
 {text:'aider',startMs:21820,endMs:22060},
 {text:"quelqu'un",startMs:22080,endMs:22440},
 {text:'à',startMs:22470,endMs:22620},
 {text:'résoudre',startMs:22700,endMs:23100},
 {text:'un',startMs:23120,endMs:23200},
 {text:'problème',startMs:23220,endMs:23800}
];
const t={sourceDurationMs:44500,outputDurationMs:39970,
 keepRanges:[{startMs:0,endMs:3790},{startMs:5520,endMs:7670},
   {startMs:8200,endMs:9990},{startMs:10770,endMs:14640},
   {startMs:15820,endMs:16880},{startMs:17960,endMs:43780}]};
const obj={id:'human_figure',kind:'object',spokenEvidence:"aider quelqu'un",sourceEndMs:24400};

test('Gemini word offsets drive timed captions in post-cut time without sound-onset guesses',()=>{
 const p=buildAlexV7AudioPlan({analysis:{transcript:{alignment,words:sourceWords}},
   timeline:t,semanticEvents:[obj]});
 assert.equal(p.status,'preview_transcript_timed');
 assert.equal(p.releaseStatus,'NEEDS_HUMAN_AUDIO_QA');
 assert.equal(p.wordCount,sourceWords.length);
 assert.ok(p.groups.length>=2);
 assert.equal(p.groups[0].words[0].originalStartMs,11000);
 assert.ok(p.groups[0].words[0].startMs<11000);
 assert.deepEqual(p.semanticVisuals,[]);
 assert.equal(p.heldVisuals[0].reason,'AUDIO_SEMANTIC_PROOF_PENDING');
});
test('A visual NEVER anticipates "aider quelqu\'un" on provider timecodes',()=>{
 const p=buildAlexV7AudioPlan({analysis:{transcript:{alignment,words:sourceWords}},
   timeline:t,semanticEvents:[obj]});
 assert.equal(p.semanticVisuals.length,0);
});
test('No timed ASR => no invented captions or semantic visuals',()=>{
 const p=buildAlexV7AudioPlan({analysis:{transcript:{words:sourceWords}},
   timeline:t,semanticEvents:[obj]});
 assert.equal(p.status,'blocked');assert.equal(p.groups.length,0);
 assert.equal(p.heldVisuals.length,1);
});
test('Removing a word in a cut does not allow it to render as a caption',()=>{
 const x={...t,keepRanges:[{startMs:0,endMs:3790},{startMs:13000,endMs:44500}],
   outputDurationMs:35290};
 const p=buildAlexV7AudioPlan({analysis:{transcript:{alignment,words:sourceWords}},
   timeline:x});
 assert.ok(!p.groups.some(g=>g.text.includes("gagner")));
 assert.ok(p.groups.some(g=>g.text.includes("aider")));
});
test('Generated native HyperFrames HTML has no caption panel; every word gets its own time',()=>{
 const p=buildAlexV7AudioPlan({analysis:{transcript:{alignment,words:sourceWords}},
   timeline:t});
 const html=alexV7CaptionHtml(p,{width:1280,height:720});
 assert.match(html,/data-width="1280"/);
 assert.match(html,/data-composition-id="alex-v7-word-synced"/);
 assert.ok(!html.includes('captionback'));
 assert.ok(!html.includes('border-left'));
 assert.match(html,/w0_0/);assert.match(html,/w0_1/);
 assert.match(html,/blur\(5px\)/);
 assert.match(html,/.+tl.fromTo/);
});
test('HTML escaping prevents user-supplied transcript markup from becoming elements',()=>{
 const input=sourceWords.map(x=>({...x}));
 input[0].text='<script>';
 const p=buildAlexV7AudioPlan({analysis:{transcript:{alignment,words:input}},timeline:t});
 const html=alexV7CaptionHtml(p);
 assert.ok(!html.includes('<span class="token" id="w0_0"><script>'));
 assert.ok(html.includes('&lt;script&gt;'));
});
