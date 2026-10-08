import test from 'node:test';
import assert from 'node:assert/strict';
import {EDIT_STYLES, MODEL_CONTRACT_VERSION, describeEditActions, buildEditTimeline} from '../src/edit.js';

const ids=['codie','impact','clean','authority','explainer','data','ugc_native','cinematic_story'];
const words=[
  {text:'Étape',startMs:1800,endMs:2050},
  {text:'1',startMs:2050,endMs:2220},
  {text:'créez',startMs:2220,endMs:2450},
  {text:'la',startMs:2450,endMs:2550},
  {text:'page.',startMs:2550,endMs:2850},
  {text:'Le',startMs:9000,endMs:9160},
  {text:'prix',startMs:9160,endMs:9460},
  {text:'est',startMs:9460,endMs:9630},
  {text:'400',startMs:9630,endMs:9940},
  {text:'euros.',startMs:9940,endMs:10200},
  {text:'Ensuite',startMs:13500,endMs:13800},
  {text:'on',startMs:13800,endMs:13950},
  {text:'publie.',startMs:13950,endMs:14300}
];
const analysis={
  measurable:{durationSec:30,width:1080,height:1920,audioCodec:'aac',silenceWindows:[{start:16,end:17.3}]},
  transcript:{words},
  timeline:[{severity:'red',start_sec:4,end_sec:5.2,label:'emphase narrative'}]
};
const make=(style,format='portrait')=>buildEditTimeline({analysis,style,format});

test('exactly eight operational contracts have distinct editorial configurations',()=>{
  assert.equal(ids.length,8);
  assert.match(MODEL_CONTRACT_VERSION,/v3/);
  const signature=new Set();
  for(const id of ids){
    const config=EDIT_STYLES[id];
    const action=describeEditActions(id);
    assert.ok(config);
    assert.equal(action.model,id);
    assert.equal(action.silenceCutThresholdMs,config.silenceThresholdMs);
    assert.equal(action.punchIns.maxPer30s,config.maxPunchInsPer30s);
    assert.equal(action.broll.maxPer30s,config.broll.maxPer30s);
    assert.match(action.broll.trigger,/./);
    signature.add([config.silenceThresholdMs,config.maxPunchInsPer30s,config.broll.maxPer30s,config.captions,config.soundDesign].join(':'));
  }
  assert.equal(signature.size,8);
});

test('limits and controlled captions are encoded in every exported timeline',()=>{
  const limits={codie:[3,2],impact:[8,5],clean:[3,1],authority:[2,2],explainer:[5,5],data:[5,4],ugc_native:[3,1],cinematic_story:[2,3]};
  for(const id of ids){
    const portrait=make(id);
    const landscape=make(id,'landscape');
    assert.deepEqual(limits[id],[portrait.actionContract.punchIns.maxPer30s,portrait.actionContract.broll.maxPer30s]);
    assert.equal(portrait.modelContractVersion,MODEL_CONTRACT_VERSION);
    assert.equal(portrait.format,'portrait');
    assert.equal(portrait.width,1080);
    assert.equal(portrait.height,1920);
    assert.equal(landscape.width,1920);
    assert.equal(landscape.height,1080);
    assert.ok(portrait.punchIns.length<=limits[id][0]);
  }
});

test('Codie, Clean, Authority, UGC Native and Cinematic Story never inject decorative graphics',()=>{
  for(const id of ['codie','clean','authority','ugc_native','cinematic_story']){
    assert.deepEqual(make(id).graphicCues,[],id);
  }
});

test('Explainer adds step cards only for steps present in the spoken words',()=>{
  const cues=make('explainer').graphicCues;
  assert.ok(cues.length>=1);
  assert.ok(cues.some(x=>/Étape\s+1|Ensuite/i.test(x.text)));
  assert.ok(cues.every(x=>/Étape\s+1|Ensuite/i.test(x.text)));
});

test('Data overlays contain only spoken figures and no unsupported CLAIM label',()=>{
  const cues=make('data').graphicCues;
  assert.ok(cues.length>=1);
  assert.ok(cues.some(x=>x.text.includes('400')));
  assert.ok(cues.every(x=>/\d/.test(x.text)));
  assert.ok(cues.every(x=>x.label==='DATA'));
  assert.ok(cues.every(x=>!x.text.includes('invented')));
});


test('Editorial Breakdown has a separate action contract from the original eight',()=>{
  const editorial=describeEditActions('editorial_breakdown');
  const clean=describeEditActions('clean');
  assert.equal(editorial.model,'editorial_breakdown');
  assert.equal(editorial.broll.maxPer30s,0);
  assert.equal(editorial.punchIns.maxPer30s,2);
  assert.equal(editorial.captions,'editorial');
  assert.notEqual(editorial.silenceCutThresholdMs,clean.silenceCutThresholdMs);
  assert.equal(make('editorial_breakdown').modelId,'editorial_breakdown');
});

test('Editorial Breakdown displays only timestamped figures actually spoken',()=>{
  const timeline=make('editorial_breakdown');
  assert.ok(timeline.graphicCues.length>=1);
  assert.ok(timeline.graphicCues.some(c=>c.figures.some(n=>n.includes('400'))));
  assert.ok(timeline.graphicCues.every(c=>c.evidence==='timestamped_transcript'));
  assert.ok(timeline.graphicCues.every(c=>c.figures.every(v=>/\\d/.test(v))));
  assert.ok(timeline.graphicCues.every(c=>!c.text.includes('600')));
  assert.equal(timeline.captionPreset,'editorial');
});

test('Editorial Breakdown never synthesizes percentages or equations without evidence',()=>{
  const a={measurable:{durationSec:12,width:1080,height:1920,audioCodec:'aac',silenceWindows:[]},
    transcript:{words:[
      {text:'Le',startMs:2000,endMs:2300},
      {text:'montage',startMs:2300,endMs:2700},
      {text:'est',startMs:2700,endMs:3000},
      {text:'important',startMs:3000,endMs:3500}
    ]},timeline:[]};
  const timeline=buildEditTimeline({analysis:a,style:'editorial_breakdown',format:'portrait'});
  assert.deepEqual(timeline.graphicCues,[]);
});
