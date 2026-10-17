import test from 'node:test';
import assert from 'node:assert/strict';
import {buildSocialKineticV10WordPlan,socialKineticV10Html} from '../src/social-kinetic-v10-word-plan.js';
const sourceDurationMs=5000;
const words=[
 {text:'Tu',startMs:500,endMs:750},
 {text:'apprends',startMs:780,endMs:1150},
 {text:'une',startMs:1200,endMs:1450},
 {text:'compétence',startMs:1480,endMs:1970},
 {text:'pour',startMs:2300,endMs:2510},
 {text:'aider',startMs:2530,endMs:2790},
 {text:'les',startMs:2830,endMs:3000},
 {text:'autres',startMs:3020,endMs:3460},
 {text:'maintenant',startMs:3550,endMs:3920}
];
const timeline={keepRanges:[{startMs:0,endMs:2050},{startMs:2250,endMs:5000}],
  outputDurationMs:4800,export:{width:910,height:512},audio:{hasAudio:true}};
const analysis={measurable:{durationSec:5},transcript:{words,alignment:{
  verified:true,method:'provider_word_timestamps',source:'gemini_interactions_word_info',
  reviewedAgainstAudio:false}}};
function proof(a,b){
 return {source:'independent_frame_sampler',verified:true,
  rect:{x:.58,y:.25,w:.35,h:.35},
  frames:Array.from({length:Math.ceil((b-a)/350)+2},(_,i)=>({
    ms:a-100+i*350,confidence:.98,subjectOverlap:false
  }))};
}
const evidence={};
const ids=['caption-0','caption-1','caption-2','caption-3','caption-4'];
for(const id of ids)evidence[id]=proof(0,5000);
function plan(extra={}){return buildSocialKineticV10WordPlan({
  analysis,timeline,frameProof:evidence,...extra
});}
test('true provider-word timestamps map after the 200ms deleted cut',()=>{
 const p=plan();
 assert.equal(p.status,'staging_renderable');
 assert.equal(p.keptWordCount,9);
 assert.ok(p.events.length>=2);
 const captionWithAider=p.events.find(x=>x.text.toLowerCase().includes('aider'));
 assert.ok(captionWithAider,'spoken group around aide found');
 assert.equal(captionWithAider.words.find(w=>w.text==='aider').outputStartMs,2330);
 assert.equal(p.releaseApproved,false);
});
test('estimated word stamps are NEVER accepted as verified source word timestamps',()=>{
 const mutated={...analysis,transcript:{...analysis.transcript,alignment:{
  verified:false,method:'estimated_from_segments',source:'segment_interpolation'}}};
 const p=plan({analysis:mutated});
 assert.equal(p.status,'blocked');assert.equal(p.reason,'ACTUAL_PROVIDER_WORD_TIMESTAMPS_MISSING');
});
test('frame sampler evidence is mandatory, no floating words over hands or faces',()=>{
 const p=plan({frameProof:{}});
 assert.equal(p.status,'blocked');
 assert.equal(p.reason,'NO_INDEPENDENTLY_SAFE_TEXT');
 assert.ok(p.held.length>0);
});
test('unsaid metrics and fabricated chat cannot become live graphics',()=>{
 const p=plan({editorialEvents:[
  {id:'paid',kind:'metric',phrase:'3000 euros',text:'3000 euros'},
  {id:'fake',kind:'bubble',phrase:'aider les autres',text:'ce client a réussi'}
 ]});
 assert.ok(p.held.some(x=>x.id==='paid'&&x.reason==='UNSPOKEN_EDITORIAL_TEXT'));
 assert.ok(p.held.some(x=>x.id==='fake'&&x.reason==='UNVERIFIED_MESSAGE'));
});
test('portrait layout uses the native aspect ratio, real timed words and no Instagram UI',()=>{
 const p=plan();
 const html=socialKineticV10Html(p,{width:512,height:910,fps:30});
 assert.match(html,/data-width="512"/);
 assert.match(html,/data-height="910"/);
 assert.match(html,/window.__timelines/);
 assert.match(html,/2\.330/);
 assert.ok(!html.includes('instagram'));
 assert.ok(!html.includes('D’ARGENT, 3000'));
});
test('no reused trim offsets: cuts must be sorted and source word end must be inside kept segment',()=>{
 const bad={...timeline,keepRanges:[{startMs:2250,endMs:5000},{startMs:0,endMs:2050}]};
 const p=plan({timeline:bad});
 assert.equal(p.status,'blocked');
});
