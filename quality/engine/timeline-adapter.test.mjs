import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtemp,rm,mkdir,copyFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {adaptivePlan} from './adaptive-director.mjs';
import {timelineFromAdaptivePlan,buildTimedCaptions} from './timeline-adapter.mjs';
import {renderNativeEdit} from '../../apps/worker/src/render.js';
import {checkRender} from '../tools/check-render.mjs';
function exec(command,args,timeout=60000){
 const x=spawnSync(command,args,{encoding:'utf8',timeout});
 assert.equal(x.status,0,x.stderr?.slice(-1100)||x.error?.message||String(x.status));
 return x.stdout||'';
}
const words='First compare 100 euros versus 200 euros.'.split(' ').map((text,i)=>({
 text,startMs:200+i*270,endMs:400+i*270
}));
test('imprecise segments are rejected by adapter',()=>{
 const plan=adaptivePlan({style:'leila',durationMs:3500,segments:[{text:'First compare 100 euros',startMs:200,endMs:3200}]});
 assert.equal(plan.renderReady,false);
 assert.throws(()=>timelineFromAdaptivePlan(plan),/NOT_RENDER_READY/);
});
test('two narrative models produce valid and visually distinct MP4s',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'editplus-adaptive-real-'));
 try{
  const source=path.join(dir,'source.mp4');
  exec('ffmpeg',['-hide_banner','-loglevel','error','-y',
    '-f','lavfi','-i','color=c=0x393632:s=360x640:r=30:d=3',
    '-f','lavfi','-i','sine=frequency=440:duration=3',
    '-c:v','libx264','-threads','1','-pix_fmt','yuv420p',
    '-c:a','aac','-shortest',source]);
  const hashes=[];
  for(const style of ['codie','leila']){
    const plan=adaptivePlan({style,durationMs:3000,words});
    assert.equal(plan.renderReady,true);
    const timeline=timelineFromAdaptivePlan(plan,{width:360,height:640,hasAudio:true});
    if(style==='leila')assert.ok(timeline.graphicCues.some(x=>x.mode==='editorial_breakdown'&&x.figures.length));
    assert.ok(timeline.captions.length>=2,'Captions must be split into readable timed phrases');
    assert.ok(timeline.captions.every(c=>c.text.length<=22),JSON.stringify(timeline.captions));
    const out=path.join(dir,style+'.mp4');
    await renderNativeEdit({sourcePath:source,outputPath:out,durationMs:3000,timeline});
    const qa=await checkRender(out,{width:360,height:640});
    assert.equal(qa.verdict,'PASS',JSON.stringify(qa.errors));
    const frame=path.join(dir,style+'.png');
    exec('ffmpeg',['-hide_banner','-loglevel','error','-y','-ss','1.3','-i',out,'-frames:v','1',frame]);
    hashes.push(createHash('sha256').update(await readFile(frame)).digest('hex'));
    if(process.env.QA_ARTIFACT_DIR){
      await mkdir(process.env.QA_ARTIFACT_DIR,{recursive:true});
      await copyFile(out,path.join(process.env.QA_ARTIFACT_DIR,style+'-synthetic-edit.mp4'));
      await copyFile(frame,path.join(process.env.QA_ARTIFACT_DIR,style+'-synthetic-frame.png'));
    }
  }
  assert.notEqual(hashes[0],hashes[1],'Codie and Leila must not render identical frames');
 }finally{await rm(dir,{recursive:true,force:true})}
});

test('long sentence never overflows a narrow portrait card',()=>{
 const cfg={fontSize:80,maxWordsPerLine:5};
 const words='An extremely meaningful sentence about an important business decision'.split(' ')
    .map((text,i)=>({text,startMs:i*230,endMs:i*230+200}));
 const captions=buildTimedCaptions(words,cfg,360,640);
 assert.ok(captions.length>2);
 assert.ok(captions.every(c=>c.text.length<=18||c.words.length===1),JSON.stringify(captions));
 assert.ok(captions.every(c=>c.endMs>c.startMs));
});
