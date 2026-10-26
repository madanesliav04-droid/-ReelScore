import test from 'node:test';
import assert from 'node:assert/strict';
import {buildEditTimeline} from '../src/edit.js';
import {HORMOZI_OMNI_PALETTE,planHormoziOmniStoryboard} from '../src/hormozi-omni-director.js';
import {renderHormoziOmniAss} from '../src/hormozi-omni-render.js';
const sample='Voici les 250 millions';
function timed(sentence,start=1200){
 return sentence.split(' ').map((text,i)=>({text,startMs:start+i*180,endMs:start+i*180+140}));
}
const frames=Array.from({length:35},(_,i)=>({ms:i*200,confidence:.97,clearTopNormalized:.24}));
const analysis=(text,proposals)=>({transcript:{
 alignment:{method:'forced_alignment',verified:true,confidence:.97},
 words:timed(text)
},measurable:{durationSec:7,width:910,height:512,audioCodec:'aac'},
 composition_proof:{source:'independent_frame_sampler',verified:true,frames},
 hormozi_storyboards:proposals});
const plan=(a)=>planHormoziOmniStoryboard({analysis:a,words:a.transcript.words,durationMs:7000,enabled:true});
test('restored historical palette stays distinct without enabling a fake V16 preset',()=>{
 assert.ok(HORMOZI_OMNI_PALETTE.chrome&&HORMOZI_OMNI_PALETTE.cyan);
 assert.notEqual(HORMOZI_OMNI_PALETTE.cyan,'#FFFF00');
});
test('only numerals literally present in forced-aligned speech may appear',()=>{
 const a=analysis(sample,[{type:'metric',spoken_anchor:sample,text:'250'}]);
 const r=plan(a);
 assert.equal(r.cues.length,1,JSON.stringify(r.held));
 assert.equal(r.cues[0].text,'250');
 assert.equal(r.soundIntents[0].kind,'soft_low_hit');
 const fake=plan({...a,hormozi_storyboards:[{type:'metric',spoken_anchor:sample,text:'999'}]});
 assert.equal(fake.cues.length,0);
 assert.equal(fake.held[0].reason,'UNSPOKEN_OR_UNVERIFIED_VISUAL');
});
test('spoken lists animate only actual ordered spoken items',()=>{
 const phrase='premier attirer ensuite convertir et enfin livrer';
 const r=plan(analysis(phrase,[{type:'sequence',spoken_anchor:phrase,
  items:['attirer','convertir','livrer']}]));
 assert.equal(r.cues.length,1,JSON.stringify(r.held));
 assert.equal(r.cues[0].itemStarts.length,3);
 const ass=renderHormoziOmniAss({graphicCues:r.cues},910,512);
 assert.ok(ass.includes('01  attirer')&&ass.includes('03  livrer'));
 assert.equal(ass.split('\n').filter(x=>x.startsWith('Dialogue:')).length,3);
});
test('a comparison appears on two distinct speech beats',()=>{
 const phrase='plus de temps moins de revenus';
 const r=plan(analysis(phrase,[{type:'comparison',spoken_anchor:phrase,
  left:'plus de temps',right:'moins de revenus'}]));
 assert.equal(r.cues.length,1,JSON.stringify(r.held));
 assert.ok(r.cues[0].rightStartMs>r.cues[0].startMs);
 const ass=renderHormoziOmniAss({graphicCues:r.cues},910,512);
 assert.equal(ass.split('\n').filter(x=>x.startsWith('Dialogue:')).length,2);
});
test('single-frame claims, missing alignment, and unverified charts never reach screen',()=>{
 const metric={type:'metric',spoken_anchor:sample,text:'250'};
 const a=analysis(sample,[metric]);
 assert.equal(plan({...a,composition_proof:{source:'gemini_single_frame',verified:true,frames}}).cues.length,0);
 assert.equal(plan({...a,transcript:{...a.transcript,alignment:{method:'gemini_words',verified:true,confidence:.99}}}).cues.length,0);
 const chart={type:'chart',spoken_anchor:sample,source_id:'unverified-link',
  source_verified:true,series:[{label:'A',value:1},{label:'B',value:2}]};
 const r=plan({...a,hormozi_storyboards:[chart]});
 assert.equal(r.cues.length,0);
 assert.equal(r.held[0].reason,'CHART_RENDERER_PENDING_INDEPENDENT_PIXEL_QA');
});
test('disabled by default: existing customer edits do not get new overlay spontaneously',()=>{
 const a=analysis(sample,[{type:'metric',spoken_anchor:sample,text:'250'}]);
 const r=planHormoziOmniStoryboard({analysis:a,words:a.transcript.words,durationMs:7000});
 assert.equal(r.cues.length,0);
 assert.equal(r.held[0].reason,'FEATURE_OFF');
 const old=process.env.ENABLE_HORMOZI_OMNI_GRAPHICS;
 delete process.env.ENABLE_HORMOZI_OMNI_GRAPHICS;
 try{
   assert.throws(()=>buildEditTimeline({analysis:a,style:'hormozi_omni'}),{code:'EDIT_STYLE_NOT_IMPLEMENTED'});
 } finally{if(old===undefined)delete process.env.ENABLE_HORMOZI_OMNI_GRAPHICS;else process.env.ENABLE_HORMOZI_OMNI_GRAPHICS=old}
});
