import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {RESTORED_PREVIEWS,restoredPlan} from './restored-models.mjs';
import {renderVideo,MODEL_CATALOG} from './render.mjs';
const exec=promisify(execFile);
const meta={width:640,height:360,durationMs:3000,hasAudio:true};
const input={transcript:[{text:'temps',start:.5,end:.8}],captionsReviewed:true,placementReviewed:true,events:[{wordIndex:0,kind:'clock',rect:[.1,.1,.4,.4]}]};

test('restored original source files remain byte-for-byte identical to the uploaded pack',async()=>{
 const root=fileURLToPath(new URL('../engines/originals/',import.meta.url));
 const manifest=JSON.parse(await readFile(join(root,'IMPORTED_SHA256.json')));
 for(const entry of manifest)assert.equal(createHash('sha256').update(await readFile(join(root,entry.path))).digest('hex'),entry.sha256,entry.path);
});
test('restored previews require reviewed speech and composition, reject unsafe or fabricated events',()=>{
 for(const bad of [{placementReviewed:false},{captionsReviewed:false},{events:[{wordIndex:55,rect:[.1,.1,.4,.4]}]},{events:[{wordIndex:0,kind:'clock',rect:[.1,.5,.4,.4]}]},{transcript:[{text:'bonjour',start:.5,end:.8}]}])assert.throws(()=>restoredPlan('codie-omni-v60',meta,{...input,...bad}));
 assert.equal(restoredPlan('codie-omni-v60',meta,input).events[0].startMs,500);
 assert.throws(()=>restoredPlan('codie-omni-v60',{...meta,durationMs:61000},input),{code:'REFERENCE_INPUT_REQUIRED'});
});
test('six reference releases remain guarded individually; recovered code is not master certification',async()=>{
 for(const model of MODEL_CATALOG){
  assert.equal(model.available,false);
  await assert.rejects(renderVideo({modelId:model.id}),{code:model.id==='cinematic-storytelling-v7'?'MODEL_REFERENCE_MEDIA_REQUIRED':'MODEL_QA_REQUIRED'});
 }
});
test('three restored original compositors render visible MP4s on new technical fixtures with native audio',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'socialplus-original-port-'));
 try{
  const source=join(dir,'new-technical-fixture.mp4');
  await exec('ffmpeg',['-v','error','-f','lavfi','-i','color=c=0xE0E0DA:s=640x360:r=30:d=3','-f','lavfi','-i','sine=frequency=440:duration=3','-c:v','libx264','-threads','1','-pix_fmt','yuv420p','-c:a','aac','-shortest',source]);
  const frame=p=>exec('ffmpeg',['-v','error','-ss','1.3','-i',p,'-frames:v','1','-f','rawvideo','-pix_fmt','rgb24','pipe:1'],{encoding:'buffer',maxBuffer:2_000_000});
  const before=(await frame(source)).stdout;
  for(const model of RESTORED_PREVIEWS){
   const output=join(dir,model+'.mp4');
   const result=await renderVideo({sourcePath:source,outputPath:output,modelId:'restored-preview:'+model,restoredInput:input});
   assert.equal(result.metadata.videoCodec,'h264');assert.equal(result.metadata.audioCodec,'aac');assert.equal(result.metadata.audioStreams,1);
   assert.equal(result.metadata.width,640);assert.equal(result.metadata.height,360);assert.ok(Math.abs(result.metadata.durationMs-3000)<150);
   assert.equal(result.audit.restoredModel,model);assert.equal(result.audit.release,'component_preview_not_master_certified');
   const after=(await frame(output)).stdout;let changed=0;
   // Check only the graphic zone, excluding subtitles and compression noise.
   for(let y=40;y<170;y++)for(let x=65;x<310;x++){const i=(y*640+x)*3;if(Math.max(...[0,1,2].map(k=>Math.abs(after[i+k]-before[i+k])))>30)changed++;}
   assert.ok(changed>80,model+' visible original component pixels: '+changed);
  }
 }finally{await rm(dir,{recursive:true,force:true});}
});
