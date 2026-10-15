import test from 'node:test';
import assert from 'node:assert/strict';
import {proposeOmniSemanticCues,verifyOmniCue} from '../src/omni-semantic-director.js';
import {buildOmniBubblesAss} from '../src/omni-bubbles-render.js';
import {arbitrateEditorialEffects} from '../src/premium-quality-v3.js';
import {reviewCreativeTimeline} from '../src/creative-quality-gate.js';
const proof={lateralSafe:true,basis:'independent_frame_tracking',framesChecked:12,confidence:.97};
const examples=[
 ['absence','Je suis parti de zéro', ['0']],
 ['solution','Je veux résoudre ce problème', ['✓']],
 ['progress','Je progresse chaque jour', ['↗']],
 ['choice','Tu as deux choix possibles', ['A','B']],
 ['value','Ça coûte 100 euros', ['100 €']],
 ['sales','Je veux être un bon vendeur', ['€']],
 ['emotion','Je veux toucher les cœurs', ['♥']],
 ['time','Tu perds 3 heures', ['◷']]
];
function words(phrase,start=1400){
 return phrase.split(' ').map((text,i)=>({text,startMs:start+i*180,endMs:start+i*180+148}));
}
const plan=(phrase,options={})=>proposeOmniSemanticCues({
 words:words(phrase),durationMs:9000,style:'codie',compositionProof:proof,enabled:true,...options});
test('seven actual semantic ideas, not seven keyword-only decorative inserts',()=>{
 for(const [kind,phrase,icons] of examples){
  const q=plan(phrase);
  assert.equal(q.cues.length,1,kind+':'+JSON.stringify(q));
  assert.equal(q.cues[0].kind,kind);
  assert.deepEqual(q.cues[0].icons,icons);
  assert.equal(q.cues[0].layout,icons.length===2?'paired_relation':'single_support');
  assert.equal(q.cues[0].audioBaseline,'preserve_original_voice');
 }
});
test('no graphic on random noun, isolated tag, invented improvement or fake earnings',()=>{
 for(const phrase of ['cœur','zéro problème','problème','mes ventes explosent','tu gagnes plein de sous','ordinateur','je vais bien']){
  assert.equal(plan(phrase).cues.length,0,phrase);
 }
});
test('tracking absent, unverified or flag off always blocks all overlays',()=>{
 assert.equal(plan('Je suis parti de zéro',{enabled:false}).cues.length,0);
 assert.equal(plan('Je suis parti de zéro',{compositionProof:null}).cues.length,0);
 assert.equal(plan('Je suis parti de zéro',{compositionProof:{...proof,framesChecked:1}}).cues.length,0);
 assert.equal(plan('Je suis parti de zéro',{compositionProof:{...proof,basis:'gemini_single_frame'}}).cues.length,0);
});
test('creative gate validates semantic, timing and composition together',()=>{
 for(const [kind,phrase] of examples){
  const cue=plan(phrase).cues[0],caption={startMs:1000,endMs:4900,text:phrase};
  assert.ok(verifyOmniCue(cue,caption.text),kind);
  const timeline={outputDurationMs:9000,width:910,height:512,captions:[caption]};
  const reviewed=reviewCreativeTimeline({timeline,style:'codie',graphicCues:[cue]});
  assert.equal(reviewed.graphicCues.length,1,kind+':'+JSON.stringify(reviewed.rejected));
  for(const bad of [
    {...cue,icons:['💸']},
    {...cue,spoken_anchor:'argent garanti'},
    {...cue,compositionProof:{...proof,framesChecked:2}}
  ]){
   const r=reviewCreativeTimeline({timeline,style:'codie',graphicCues:[bad]});
   assert.equal(r.graphicCues.length,0,kind);
  }
 }
});
test('one meaningful symbol draws one bubble; relations draw two',()=>{
 const value=plan('Ça coûte 100 euros').cues[0];
 const problem=plan('Je veux résoudre ce problème').cues[0];
 const count=cue=>buildOmniBubblesAss({graphicCues:[cue]},910,512)
   .split('\n').filter(x=>x.startsWith('Dialogue:')).length;
 assert.equal(count(value),2);
 assert.equal(count(problem),2);
 const text=buildOmniBubblesAss({graphicCues:[value]},910,512);
 assert.ok(text.includes('100 €'));
 assert.ok(text.includes('\\move(')&&text.includes('\\p1'));
 assert.ok(text.includes('\\fscx45')&&text.includes('\\t(0,155,'));
 assert.ok(text.includes('\\an5')&&text.includes('\\an7'));
 assert.ok(!text.includes('Dialogue: 2,0:00:00.'));
 // No false assumptions about lateral space in vertical formats.
 assert.equal(count({...value}),2);
 assert.equal(buildOmniBubblesAss({graphicCues:[value]},512,910).split('\n').filter(x=>x.startsWith('Dialogue:')).length,0);
});
test('SFX only eligible for the actual problem-solution transition',()=>{
 for(const [kind,phrase] of examples){
  const cue=plan(phrase).cues[0];
  assert.equal(cue.sfxIntent,kind==='solution'?'optional_subtle_resolution':'silence');
 }
});

test('real downstream effect arbitration keeps verified OMNI vector graphics but rejects blank decoration',()=>{
 const cue=plan('Je veux résoudre ce problème').cues[0];
 const result=arbitrateEditorialEffects({graphicCues:[cue],durationMs:9000});
 assert.equal(result.graphicCues.length,1);
 const bad={...cue,compositionProof:null};
 const rejected=arbitrateEditorialEffects({graphicCues:[bad],durationMs:9000});
 assert.equal(rejected.graphicCues.length,0);
 assert.equal(rejected.rejected[0].reason,'EMPTY_GRAPHIC');
});

test('strong sales and emotional speech outrank early decorative zero',()=>{
 const segments=[
  ['Je suis parti de zéro.',1200],
  ['Je veux résoudre ce problème.',10500],
  ['Je veux être un bon vendeur.',19900],
  ['Je dois toucher les cœurs.',26600]
 ];
 const timed=segments.flatMap(([phrase,start])=>words(phrase,start));
 const r=proposeOmniSemanticCues({
  words:timed,durationMs:34500,style:'codie',compositionProof:proof,enabled:true
 });
 assert.deepEqual(r.cues.map(x=>x.kind),['solution','sales','emotion']);
 assert.ok(r.cues.every(x=>x.icons.length===1));
 assert.ok(!r.cues.some(x=>x.kind==='absence'));
});
test('there is no invented money icon without an actual sales or earnings phrase',()=>{
 for(const phrase of ['Je pense souvent aux clients','Je vais aider les gens','Je cherche une solution']){
  const r=plan(phrase);
  assert.ok(!r.cues.some(x=>x.kind==='sales'));
 }
});
