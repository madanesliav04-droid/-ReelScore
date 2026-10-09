import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtempSync,rmSync,statSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {
  PREMIUM_MODEL_CONTRACTS,PREMIUM_MODEL_CONTRACT_VERSION,
  EDIT_STYLES,CAPTION_PRESETS,buildEditTimeline,premiumModelContract
} from '../src/edit.js';
import {captionEntranceTag,buildCaptionAss,renderNativeEdit} from '../src/render.js';

const ids=['codie','impact','clean','explainer','ugc_native'];

function run(binary,args){
  return execFileSync(binary,args,{encoding:'utf8',timeout:90000,stdio:['ignore','pipe','pipe']});
}

const sourceAnalysis={
  measurable:{durationSec:2,width:360,height:640,audioCodec:'aac',silenceWindows:[]},
  transcript:{words:[
    {text:'Mais',startMs:150,endMs:370},
    {text:'regarde',startMs:380,endMs:720},
    {text:'ce',startMs:725,endMs:850},
    {text:'produit.',startMs:855,endMs:1400}
  ]},
  timeline:[{severity:'red',start_sec:0.65,end_sec:1.1,label:'spoken_emphasis'}]
};

test('five locked model contracts match actual font, color, cut and B-roll engine configuration',()=>{
  assert.deepEqual(Object.keys(PREMIUM_MODEL_CONTRACTS),ids);
  assert.match(PREMIUM_MODEL_CONTRACT_VERSION,/v4/);
  for(const id of ids){
    const spec=premiumModelContract(id);
    const cfg=EDIT_STYLES[id];
    const caption=CAPTION_PRESETS[cfg.captions];
    assert.ok(spec);
    assert.ok(spec.hook&&spec.framing&&spec.edits&&spec.broll&&spec.graphics&&spec.transitions&&spec.sound&&spec.color);
    assert.ok(spec.forbidden.length>=3);
    assert.equal(spec.typography.font,caption.fontFamily,id+' font');
    assert.equal(spec.typography.sizePx1080x1920,caption.fontSize,id+' size');
    assert.equal(spec.typography.weight,caption.fontWeight,id+' weight');
    assert.equal(spec.typography.primary.toLowerCase(),caption.textColor.toLowerCase(),id+' color');
    assert.equal(spec.typography.accent.toLowerCase(),caption.activeColor.toLowerCase(),id+' accent');
    assert.equal(spec.typography.maxWords,caption.maxWordsPerLine,id+' max words');
    assert.equal(spec.typography.position,caption.position,id+' position');
    assert.equal(spec.typography.wordHighlight,caption.activeWord,id+' word highlight');
    assert.equal(spec.typography.entrance,caption.entrance,id+' motion');
    assert.ok(captionEntranceTag(caption.entrance));
  }
  assert.equal(premiumModelContract('authority'),null);
  assert.equal(premiumModelContract('data'),null);
  assert.deepEqual(premiumModelContract('creator_clean'),premiumModelContract('clean'));
});

test('caption animation is actual ASS renderer output with distinctive motion contracts',()=>{
  for(const id of ids){
    const timeline=buildEditTimeline({analysis:sourceAnalysis,style:id,format:'native'});
    const subs=buildCaptionAss(timeline,360,640);
    assert.ok(subs.includes(timeline.captionConfig.fontFamily),id);
    assert.match(subs,/Dialogue: 0,/);
    assert.ok(subs.includes(captionEntranceTag(timeline.captionConfig.entrance)),id);
    if(id==='impact')assert.match(subs,/\\t\(0,120,/);
    if(id==='ugc_native')assert.match(subs,/\\t\(0,150,/);
    if(id==='codie'||id==='clean')assert.doesNotMatch(subs,/\\t\(0,120,/);
  }
});

test('all five models generate decodable, visually distinct rendered MP4s from the same test input',{timeout:240000},async()=>{
  const dir=mkdtempSync(join(tmpdir(),'edit-five-models-'));
  try{
    const src=join(dir,'input.mp4');
    run('ffmpeg',['-hide_banner','-loglevel','error','-y',
      '-f','lavfi','-i','testsrc2=size=360x640:rate=24:duration=2',
      '-f','lavfi','-i','sine=frequency=220:sample_rate=44100:duration=2',
      '-shortest','-c:v','libx264','-preset','ultrafast','-pix_fmt','yuv420p',
      '-c:a','aac','-movflags','+faststart',src]);
    const frameFingerprints=new Set();
    for(const id of ids){
      const timeline=buildEditTimeline({analysis:sourceAnalysis,style:id,format:'native'});
      const output=join(dir,id+'.mp4');
      await renderNativeEdit({sourcePath:src,outputPath:output,durationMs:timeline.outputDurationMs,timeline});
      const data=JSON.parse(run('ffprobe',['-v','error','-show_format','-show_streams','-of','json',output]));
      const video=data.streams.find(x=>x.codec_type==='video');
      assert.equal(video.codec_name,'h264',id);
      assert.equal(video.width,360,id);
      assert.equal(video.height,640,id);
      assert.ok(statSync(output).size>5000,id);
      assert.ok(Number(data.format.duration)>1.3,id);
      const fingerprint=run('ffmpeg',['-hide_banner','-loglevel','error','-ss','0.95','-i',output,'-frames:v','1','-f','framemd5','-']).split('\n').filter(x=>x&&!x.startsWith('#')).join('');
      assert.ok(fingerprint,id+' frame decodable');
      frameFingerprints.add(fingerprint);
    }
    assert.equal(frameFingerprints.size,5,'Five model renders must produce different visual pixels');
  }finally{
    rmSync(dir,{recursive:true,force:true});
  }
});
