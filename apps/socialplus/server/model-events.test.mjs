import test from 'node:test';
import assert from 'node:assert/strict';
import {draftModelEvents} from '../public/model-events.js';
import {restoredPlan,RESTORED_PREVIEWS} from './restored-models.mjs';
const transcript=['Bonjour','résoudre','le','problème','demande','du','temps','et','de','la','pratique','argent'].map((text,i)=>({text,startMs:i*650,endMs:i*650+400}));
test('automatic graphic drafts quote source words and pass each of the six model validators',()=>{
 for(const model of RESTORED_PREVIEWS){const events=draftModelEvents(model,transcript,'right');assert.ok(events.length);
 const plan=restoredPlan(model,{width:910,height:512,durationMs:8000,hasAudio:true},{transcript,allowUnreviewedPreview:true,placementReviewed:true,events});
 assert.ok(plan.events.every(e=>transcript.some(w=>w.text===e.text)));
 }
 assert.deepEqual(draftModelEvents('codie-omni-v60',transcript.slice(0,5)),[]);
});

test('Codie recognises spoken argent after an apostrophe without changing the supplied words',()=>{
 const words=[{text:"l’argent",startMs:100,endMs:500},{text:'ensuite',startMs:2600,endMs:3000}];
 const events=draftModelEvents('codie-omni-v60',words);
 assert.equal(events[0].kind,'euro');assert.equal(events[0].wordIndex,0);assert.equal(words[0].text,'l’argent');
});
