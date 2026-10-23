import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {analyzeSource,renderVideo} from './render.mjs';
import {buildLocalEdit} from './local-edit.mjs';
import {mapOriginalToOutput} from '../../worker/src/edit.js';
const exec=promisify(execFile);
test('multiple subframe pause cuts do not pad or shift the retained original audio',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'socialplus-audio-clock-'));
 try{
  const source=join(dir,'chirp.mp4'),output=join(dir,'edited.mp4');
  await exec('ffmpeg',['-v','error','-f','lavfi','-i','color=c=0xDADAD0:s=640x360:r=30:d=5','-f','lavfi','-i','aevalsrc=0.2*sin(2*PI*(400*t+100*t*t)):s=48000:d=5','-af',"volume=0:enable='between(t,0.7,1.6)+between(t,2.2,3.2)'",'-c:v','libx264','-threads','1','-pix_fmt','yuv420p','-c:a','aac','-shortest',source]);
  const report=await analyzeSource(source);assert.equal(report.suggestions.length,2);
  const localEdit={report,approvedPauseIds:report.suggestions.map(p=>p.id)};const edit=buildLocalEdit(localEdit);
  await renderVideo({sourcePath:source,outputPath:output,modelId:'guided-edit',localEdit});
  const pcm=async p=>(await exec('ffmpeg',['-v','error','-i',p,'-map','0:a:0','-ac','1','-ar','8000','-f','f32le','pipe:1'],{encoding:'buffer'})).stdout;
  const [before,after]=await Promise.all([pcm(source),pcm(output)]);
  for(const sourceMs of [1800,4000]){
   const reference=Math.round(sourceMs*8),expected=Math.round(mapOriginalToOutput(sourceMs,edit.keepRanges)*8),n=640;
   let best=-Infinity,lag=Infinity;
   for(let shift=-640;shift<=640;shift++){
    let dot=0,a2=0,b2=0;
    for(let i=0;i<n;i++){const a=before.readFloatLE((reference+i)*4),b=after.readFloatLE((expected+shift+i)*4);dot+=a*b;a2+=a*a;b2+=b*b;}
    const score=dot/Math.sqrt(a2*b2);if(score>best){best=score;lag=shift;}
   }
   assert.ok(best>.95,`original waveform correlation ${best}`);assert.ok(Math.abs(lag)<=2,`source ${sourceMs}ms shifted by ${lag/8}ms`);
  }
 }finally{await rm(dir,{recursive:true,force:true});}
});
