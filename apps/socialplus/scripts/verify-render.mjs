// Reproducible, local-only technical proof. These media are generated QA
// fixtures and must never be described as real speech rushes or model masters.
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {performance} from 'node:perf_hooks';
import {renderVideo,probeVideo} from '../server/render.mjs';
const exec=promisify(execFile);
const dir=path.resolve(process.argv[2]||'artifacts/render');
await mkdir(dir,{recursive:true});
const results=[];
for(const [width,height] of [[640,360],[360,640],[360,360]]) {
  const sourcePath=path.join(dir,`technical-fixture-${width}x${height}.mp4`);
  const outputPath=path.join(dir,`technical-export-${width}x${height}.mp4`);
  await exec('ffmpeg',['-v','error','-nostdin','-y','-f','lavfi','-i',`color=c=0x253345:s=${width}x${height}:r=30:d=3`,
    '-f','lavfi','-i','sine=frequency=440:duration=3','-c:v','libx264','-threads','1','-pix_fmt','yuv420p','-c:a','aac','-shortest',sourcePath]);
  const start=performance.now();
  const result=await renderVideo({sourcePath,outputPath,modelId:'technical-export'});
  results.push({fixture:'synthetic color + 440 Hz tone, not a speech rush',modelId:'technical-export',sourcePath,outputPath,
    sourceSha256:createHash('sha256').update(await readFile(sourcePath)).digest('hex'),
    outputSha256:createHash('sha256').update(await readFile(outputPath)).digest('hex'),
    elapsedMs:Math.round(performance.now()-start),metadata:result.metadata,audit:result.audit});
}
const sourcePath=results[0].sourcePath,outputPath=path.join(dir,'alex-reference-grammar-synthetic.mp4');
const meta=await probeVideo(sourcePath),previous=process.env.SOCIALPLUS_BETA_RENDER;
process.env.SOCIALPLUS_BETA_RENDER='staging';
try {
  const timeline={outputDurationMs:meta.durationMs,keepRanges:[{startMs:0,endMs:meta.durationMs}],export:{width:meta.width,height:meta.height},audio:{hasAudio:true}};
  const analysis={transcript:{alignment:{method:'forced_alignment',verified:true,confidence:.99},words:[{text:'30',startMs:200,endMs:600},{text:'jours',startMs:650,endMs:1000}]},
    hormozi_storyboards:[{type:'metric',spoken_anchor:'30 jours',text:'30'}],
    composition_proof:{source:'independent_frame_sampler',verified:true,frames:Array.from({length:16},(_,i)=>({ms:i*200,confidence:.99,clearTopNormalized:1}))}};
  const start=performance.now();
  const result=await renderVideo({sourcePath,outputPath,modelId:'alex-hormozi-v16',timeline,analysis});
  results.push({fixture:'synthetic empty frame with synthetic alignment/frame evidence, not real speech',modelId:'alex-hormozi-v16',sourcePath,outputPath,
    elapsedMs:Math.round(performance.now()-start),metadata:result.metadata,audit:result.audit});
} finally {if(previous===undefined)delete process.env.SOCIALPLUS_BETA_RENDER;else process.env.SOCIALPLUS_BETA_RENDER=previous;}
const report={generatedAt:new Date().toISOString(),scope:'Technical FFmpeg/ASS execution only. No certification of V16, V28 or another artistic model; three new real speech rushes per model remain required.',results};
await writeFile(path.join(dir,'report.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
