import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm,stat,appendFile} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
import {bundle} from '@remotion/bundler';
import {ensureBrowser,selectComposition,renderStill} from '@remotion/renderer';

const exec=promisify(execFile),dir=await mkdtemp(path.join(os.tmpdir(),'socialplus-actions-'));
const result={node:process.version,architecture:process.arch,platform:process.platform};
try{
  for(const name of ['SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY','GEMINI_API_KEY','R2_ACCESS_KEY_ID','R2_SECRET_ACCESS_KEY'])
    assert(!process.env[name],`Unexpected backend credential: ${name}`);
  const video=path.join(dir,'synthetic.mp4');
  await exec('ffmpeg',['-v','error','-f','lavfi','-i','testsrc2=size=320x180:rate=25','-f','lavfi','-i','sine=frequency=440:sample_rate=48000','-t','1','-c:v','libx264','-pix_fmt','yuv420p','-c:a','aac','-movflags','+faststart',video]);
  const metadata=JSON.parse((await exec('ffprobe',['-v','error','-show_streams','-show_format','-of','json',video])).stdout);
  assert.equal(metadata.streams.filter(s=>s.codec_type==='video').length,1);
  assert.equal(metadata.streams.filter(s=>s.codec_type==='audio').length,1);
  assert.equal(metadata.streams.find(s=>s.codec_type==='video').codec_name,'h264');
  assert.equal(metadata.streams.find(s=>s.codec_type==='audio').codec_name,'aac');
  assert(Math.abs(Number(metadata.format.duration)-1)<.1);
  await exec('ffmpeg',['-v','error','-i',video,'-f','null','-']);
  result.ffmpeg={encoded:true,decoded:true,duration:metadata.format.duration,bytes:(await stat(video)).size};
  const browser=await ensureBrowser({logLevel:'error'});
  assert('path' in browser&&browser.path,'Pinned Remotion browser missing');
  result.chromiumVersion=(await exec(browser.path,['--version'])).stdout.trim();
  const serveUrl=await bundle({entryPoint:fileURLToPath(new URL('./probe.jsx',import.meta.url)),outDir:path.join(dir,'bundle')});
  const composition=await selectComposition({serveUrl,id:'InfrastructureProbe',browserExecutable:browser.path,logLevel:'error'});
  const image=path.join(dir,'probe.png');
  await renderStill({serveUrl,composition,browserExecutable:browser.path,output:image,imageFormat:'png',frame:1,logLevel:'error'});
  const png=await readFile(image);
  assert(png.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])));
  assert.equal(png.readUInt32BE(16),320);assert.equal(png.readUInt32BE(20),180);
  result.remotion={compositionSelected:true,chromiumRendered:true,pngBytes:png.length};
  console.log(JSON.stringify(result,null,2));
  if(process.env.GITHUB_STEP_SUMMARY)await appendFile(process.env.GITHUB_STEP_SUMMARY,
    '## Social+ secret-free infrastructure gate\n\n'+
    'Worker Node tests ran in the previous step. FFmpeg H.264/AAC encode/decode and a real Remotion/Chromium PNG render passed.\n\n'+
    'Synthetic public fixture only; **not an Alex V16 MP4 or an authenticated application test**. No cache/artifact upload, backend secret or deployment.\n');
}finally{await rm(dir,{recursive:true,force:true});}
