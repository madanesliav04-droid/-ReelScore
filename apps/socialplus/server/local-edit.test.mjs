import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {acousticReport,buildLocalEdit} from './local-edit.mjs';
import {analyzeSource,renderVideo} from './render.mjs';
const exec=promisify(execFile);
const metadata={durationMs:6000,width:640,height:360,hasAudio:true};
const log='silence_start: 2\nsilence_end: 4\nmean_volume: -26.0 dB\nmax_volume: -1.0 dB';
const report=acousticReport(log,metadata,'test-fingerprint');

test('local acoustic analysis is deterministic and preserves safety margins',()=>{
 assert.deepEqual(report,acousticReport(log,metadata,'test-fingerprint'));
 assert.deepEqual(report.suggestions,[{id:'pause-0',startMs:2250,endMs:3750}]);
 assert.equal(report.meanVolumeDb,-26);assert.equal(report.silenceRatio,1/3);
 assert.equal(report.recommendations.length,2);
 const silent=acousticReport('silence_start: 0\nmean_volume: -inf dB\nmax_volume: -inf dB',metadata,'silent');
 assert.equal(silent.silenceRatio,1);assert.equal(silent.meanVolumeDb,null);assert.deepEqual(silent.suggestions,[]);
});
test('guided edit maps supplied words through approved cuts using inherited time mapping',()=>{
 const transcript=[{text:'Avant',start:1,end:1.5},{text:'Après',start:4.5,end:5}];
 const edit=buildLocalEdit({report,approvedPauseIds:['pause-0'],transcript,captionsReviewed:true});
 assert.equal(edit.outputDurationMs,4500);assert.equal(edit.captions[1].startMs,3000);
 assert.match(edit.ass,/Après/);assert.match(edit.ass,/0:00:03.00/);
 assert.deepEqual(edit.keepRanges,[{startMs:0,endMs:2250},{startMs:3750,endMs:6000}]);
 assert.equal(buildLocalEdit({report}).outputDurationMs,6000);
});
test('guided edit rejects unsafe words, unreviewed timing and fabricated cuts',()=>{
 const bad=[
 {approvedPauseIds:['invented']}, {approvedPauseIds:['pause-0','pause-0']},
 {transcript:[{text:'Mot',start:1,end:1.5}]},
 {transcript:[{text:'{\\pos(0,0)}',start:1,end:1.5}],captionsReviewed:true},
 {transcript:[{text:'Mot',start:2.3,end:2.6}],captionsReviewed:true,approvedPauseIds:['pause-0']},
 {transcript:[{text:'Un',start:1,end:2},{text:'Deux',start:1.5,end:3}],captionsReviewed:true},
 {transcript:[{text:'Fin',start:5.5,end:7}],captionsReviewed:true}
 ];
 for(const input of bad)assert.throws(()=>buildLocalEdit({report,...input}),{code:'INVALID_EDIT'});
});
test('real local analysis and edited MP4 shorten only approved measured silence and retain original audio',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'socialplus-guided-'));
 try{
  const source=join(dir,'source.mp4'),output=join(dir,'edit.mp4');
  await exec('ffmpeg',['-v','error','-f','lavfi','-i','color=c=0x253348:s=640x360:r=30:d=6','-f','lavfi','-i','sine=frequency=440:sample_rate=48000:duration=6','-af',"volume=0:enable='between(t,2,4)'",'-c:v','libx264','-threads','1','-pix_fmt','yuv420p','-c:a','aac','-shortest',source]);
  const measured=await analyzeSource(source);assert.equal(measured.suggestions.length,1);
  assert.match(measured.fingerprint,/^[a-f0-9]{64}$/);assert.ok(Math.abs(measured.silenceRatio-1/3)<.02);
  assert.deepEqual(measured,await analyzeSource(source));
  const result=await renderVideo({sourcePath:source,outputPath:output,modelId:'guided-edit',localEdit:{report:measured,approvedPauseIds:[measured.suggestions[0].id],transcript:[{text:'Fixture',start:.5,end:1},{text:'technique',start:4.5,end:5}],captionsReviewed:true}});
  assert.equal(result.audit.cuts,1);assert.equal(result.audit.captionCount,2);
  assert.equal(result.metadata.videoCodec,'h264');assert.equal(result.metadata.audioCodec,'aac');assert.equal(result.metadata.audioStreams,1);
  assert.equal(result.metadata.width,640);assert.equal(result.metadata.height,360);
  assert.ok(result.metadata.durationMs>4400&&result.metadata.durationMs<4700);
  const {stdout:audio}=await exec('ffmpeg',['-v','error','-i',output,'-t','1.5','-vn','-ac','1','-ar','8000','-f','s16le','pipe:1'],{encoding:'buffer'});
  let crossings=0;for(let i=2;i<audio.length;i+=2)if(audio.readInt16LE(i-2)<0&&audio.readInt16LE(i)>=0)crossings++;
  assert.ok(crossings/1.5>425&&crossings/1.5<450);
 }finally{await rm(dir,{recursive:true,force:true});}
});
