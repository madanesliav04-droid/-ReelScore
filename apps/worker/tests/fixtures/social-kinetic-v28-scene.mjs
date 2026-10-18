import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {buildSocialKineticV28Plan,socialKineticV28Html} from '../../src/social-kinetic-v28-engine.js';
const d=5000;
const words=[
 ['Comment',200,420],['gagner',480,710],['du',730,850],['temps',900,1120],
 ['et',1300,1490],['aider',1660,1950],['les',2150,2310],
 ['personnes',2450,2880],['maintenant.',3150,3700]
].map(([text,startMs,endMs])=>({text,startMs,endMs}));
const safe=rect=>({source:'independent_frame_sampler',verified:true,rect,
 frames:Array.from({length:30},(_,i)=>({ms:i*170,confidence:.99,
  subjectOverlap:false,protectedContentOverlap:false}))});
const frameProof=Object.fromEntries(Array.from({length:20},(_,i)=>
 ['caption-'+i,safe({x:.045,y:.66,w:.45,h:.22})]));
frameProof['bubble-0']=safe({x:.615,y:.31,w:.34,h:.17});
const plan=buildSocialKineticV28Plan({
 analysis:{measurable:{durationSec:d/1000},transcript:{words,
  alignment:{verified:true,method:'provider_word_timestamps',source:'gemini_interactions_word_info'}}},
 timeline:{keepRanges:[{startMs:0,endMs:d}],outputDurationMs:d},
 frameProof,editorialEvents:[{id:'bubble-0',kind:'bubble',
  phrase:'gagner du temps',text:'gagner du temps'}]
});
if(plan.status!=='staging_renderable'||!plan.events.some(e=>e.kind==='bubble'))
 throw new Error('V28_SAMPLE_FAILED:'+JSON.stringify({status:plan.status,held:plan.held}));
const target=path.resolve(process.argv[2]||'/tmp/editplus-v28-smoke');
await mkdir(target,{recursive:true});
await writeFile(path.join(target,'index.html'),socialKineticV28Html(plan,{width:910,height:512}),'utf8');
console.log('V28_READY',target,plan.events.length,'verified visual events');
