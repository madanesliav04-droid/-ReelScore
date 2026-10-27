// Real offline engine, existing artistic rules. All detailed output stays private.
import {renderAlexV16} from '../src/alex-v16-pipeline.js';
import {readFile,writeFile} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import path from 'node:path';
import assert from 'node:assert/strict';
const exec=promisify(execFile),directory=process.env.SOCIALPLUS_ACTIONS_WORK_DIR;
assert(directory&&path.isAbsolute(directory));
for(const key of ['SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY','GEMINI_API_KEY','SOCIALPLUS_PRIVATE_DELIVERY_TOKEN','SOCIALPLUS_R2_TRANSFER','R2_ACCESS_KEY_ID','R2_SECRET_ACCESS_KEY'])assert(!process.env[key],`Compute must not receive ${key}`);
const source=path.join(directory,'source.mov'),output=path.join(directory,'alex.mp4');
const probe=async file=>JSON.parse((await exec('ffprobe',['-v','error','-show_streams','-show_format','-of','json',file],{maxBuffer:2000000})).stdout);
const audioHash=async file=>(await exec('ffmpeg',['-v','error','-i',file,'-map','0:a:0','-c:a','copy','-f','hash','-hash','sha256','-'])).stdout.trim();
try{
  const before=await probe(source);
  const result=await renderAlexV16({sourcePath:source,workDir:directory,outputPath:output,reviewDraft:true});
  const plan=JSON.parse(await readFile(path.join(directory,'alex-plan.json'),'utf8'));
  const after=await probe(output),video=after.streams.find(s=>s.codec_type==='video'),audio=after.streams.filter(s=>s.codec_type==='audio');
  assert.equal(video.codec_name,'h264');assert.equal(audio.length,1);assert.equal(audio[0].codec_name,'aac');
  await exec('ffmpeg',['-v','error','-i',output,'-f','null','-'],{timeout:180000});
  const prepared=path.join(directory,'alex-native-cfr.mp4');
  assert.equal(await audioHash(prepared),await audioHash(output),'Final audio must be bit-identical to the prepared original track');
  const packets=async file=>JSON.parse((await exec('ffprobe',['-v','error','-select_streams','a:0','-show_packets','-show_entries','packet=pts_time,duration_time','-of','json',file],{maxBuffer:8000000})).stdout).packets;
  const a=await packets(prepared),b=await packets(output);assert.equal(a.length,b.length);
  const maxAudioTimestampDifferenceSeconds=Math.max(0,...a.map((p,i)=>Math.abs(Number(p.pts_time)-Number(b[i].pts_time))));
  assert(maxAudioTimestampDifferenceSeconds<.001);
  const fps=video.avg_frame_rate.split('/').map(Number).reduce((x,y)=>x/y);
  const avEndDifferenceSeconds=Math.abs(Number(video.start_time||0)+Number(video.duration)-Number(audio[0].start_time||0)-Number(audio[0].duration));
  assert(avEndDifferenceSeconds<=1/fps+.03);
  const wordWindowsValid=plan.words.every((w,i)=>w.end>w.start&&w.start>=0&&(!i||w.start>=plan.words[i-1].end)&&w.end<=plan.outputDurationMs/1000+.01);
  assert(wordWindowsValid);assert.equal(plan.scenes.length,3);
  const report={technicalSuccess:true,source:{durationSeconds:Number(before.format.duration),width:before.streams.find(s=>s.codec_type==='video').width,height:before.streams.find(s=>s.codec_type==='video').height},
    output:{durationSeconds:Number(after.format.duration),width:video.width,height:video.height,bytes:result.bytes,sha256:result.outputSha256,videoCodec:video.codec_name,audioCodec:audio[0].codec_name},
    engine:plan.engine,referenceUsed:result.referenceUsed,graphicScenes:plan.scenes.length,regeneratedGraphicFrames:result.qa.regeneratedGraphicFrames,
    cuts:plan.removedRanges,fullDecode:true,originalPreparedAudioBitIdentical:true,maxAudioTimestampDifferenceSeconds,avEndDifferenceSeconds,
    subtitleWindowsValid:wordWindowsValid,wordCount:plan.words.length,reviewRequired:result.reviewRequired,uncertainEntries:plan.issues,
    phoneticAlignmentCertified:false,visualReferenceComparisonPerformed:false,
    notice:'Technical synchronization only. Original speech is retained; uncertain words and visual fidelity require human review. No full word-perfect or commercial validation.'};
  await writeFile(path.join(directory,'report.json'),JSON.stringify(report,null,2),{mode:0o600});
}catch(error){
  await writeFile(path.join(directory,'report.json'),JSON.stringify({technicalSuccess:false,code:error.code||'ALEX_TEST_FAILED',message:error.message},null,2),{mode:0o600});
  process.exitCode=1;
}
