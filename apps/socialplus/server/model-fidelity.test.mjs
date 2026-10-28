import test from 'node:test';
import assert from 'node:assert/strict';
import {restoredPlan} from './restored-models.mjs';
import {renderFont} from './render-fonts.mjs';
const transcript=['Résoudre','ce','problème','aider','les','personnes','besoin','de','toi'].map((text,i)=>({text,startMs:100+i*250,endMs:300+i*250}));
const meta={width:910,height:512,durationMs:3000,hasAudio:true};
const input={transcript,allowUnreviewedPreview:true,captionsReviewed:false,placementReviewed:true,events:[{wordIndex:0,wordCount:3,endMs:2800,rect:[.05,.08,.27,.45],kind:'fullscreen',details:[{wordIndex:3,wordCount:3},{wordIndex:6,wordCount:3}]}]};
test('reference scene details quote current words and use their measured cues in every compositor',()=>{
 for(const model of ['alex-hormozi-v16','leila-hormozi-v53','apple-premium-spatial','cinematic-storytelling-v7']){
  const p=restoredPlan(model,meta,input);assert.deepEqual(p.events[0].details.map(d=>d.text),['aider les personnes','besoin de toi']);assert.equal(p.events[0].details[0].startMs,850);
 }
 assert.match(restoredPlan('leila-hormozi-v53',meta,input).ass,/SocialPlus Sans SemiBold/);
 assert.equal(renderFont('EBGaramond08-Regular.ttf').family,'SocialPlus Serif');
});
test('details reject absent words, malformed data, historic times and overlaps',()=>{
 for(const details of ['old text',Array(4).fill({wordIndex:3}),[{wordIndex:90}],[{wordIndex:3},{wordIndex:1}],[{wordIndex:0,wordCount:0}]])assert.throws(()=>restoredPlan('leila-hormozi-v53',meta,{...input,events:[{...input.events[0],details}]}));
});
test('kinetic captions can follow separately reviewed left/right zones without changing word times',()=>{
 const p=restoredPlan('social-kinetic-v28',meta,{...input,events:[],captionZones:[{firstWord:0,lastWord:8,rect:[.65,.69,.3,.22]}]});assert.equal(p.captions[0].rect.x,.65);assert.equal(p.captions[0].words[0].outputStartMs,100);
 assert.throws(()=>restoredPlan('social-kinetic-v28',meta,{...input,events:[],captionZones:[{firstWord:0,lastWord:8,rect:[.65,.9,.3,.22]}]}));
});


test('graphic endpoints inside removed pauses collapse to the actual splice instead of using a guessed scene duration',async()=>{
 const {mapEditBoundary}=await import('./edit-boundaries.mjs');
 const ranges=[{startMs:0,endMs:7534},{startMs:7960,endMs:9349},{startMs:9677,endMs:25000}];
 assert.equal(mapEditBoundary(7800,ranges),7534);assert.equal(mapEditBoundary(7960,ranges),7534);assert.equal(mapEditBoundary(10000,ranges),9246);
});

test('Spatial focus keeps its reviewed wall anchor while using a native fullscreen overlay',()=>{
 const p=restoredPlan('apple-premium-spatial',meta,{...input,events:[{...input.events[0],kind:'focus'}]});assert.deepEqual(p.events[0].rect,[0,0,1,1]);assert.deepEqual(p.events[0].anchorRect,[.05,.08,.27,.45]);
 assert.throws(()=>restoredPlan('apple-premium-spatial',meta,{...input,events:[{...input.events[0],kind:'focus',rect:[.8,.8,.4,.4]}]}));
});

test('Spatial focus really composites V9/V10 with native video and copied AAC',async()=>{
 const {mkdtemp,rm}=await import('node:fs/promises');const {tmpdir}=await import('node:os');const {join}=await import('node:path');const {execFile}=await import('node:child_process');const {promisify}=await import('node:util');const exec=promisify(execFile);const {renderVideo}=await import('./render.mjs');
 const dir=await mkdtemp(join(tmpdir(),'socialplus-focus-'));
 try{
  const source=join(dir,'source.mp4'),output=join(dir,'focus.mp4');
  await exec('ffmpeg',['-v','error','-f','lavfi','-i','testsrc2=s=640x360:r=30:d=3','-f','lavfi','-i','sine=frequency=440:duration=3','-c:v','libx264','-threads','1','-pix_fmt','yuv420p','-c:a','aac','-shortest',source]);
  const result=await renderVideo({sourcePath:source,outputPath:output,modelId:'apple-premium-spatial',restoredInput:{...input,events:[{...input.events[0],kind:'focus'}]}});
  assert.equal(result.metadata.width,640);assert.equal(result.metadata.height,360);assert.equal(result.metadata.audioStreams,1);assert.equal(result.audit.audioMode,'source_aac_passthrough');
  const adts=async p=>(await exec('ffmpeg',['-v','error','-i',p,'-map','0:a:0','-c:a','copy','-f','adts','pipe:1'],{encoding:'buffer'})).stdout;
  assert.deepEqual(await adts(source),await adts(output));
  const frame=async p=>(await exec('ffmpeg',['-v','error','-ss','1.5','-i',p,'-frames:v','1','-pix_fmt','rgb24','-f','rawvideo','pipe:1'],{encoding:'buffer',maxBuffer:2_000_000})).stdout;
  const before=await frame(source),after=await frame(output);let change=0;for(let i=0;i<640*60*3;i++)change+=Math.abs(before[i]-after[i]);assert.ok(change/(640*60*3)>5,'the spatial defocus/tint is visible outside the title');
 }finally{await rm(dir,{recursive:true,force:true});}
});
