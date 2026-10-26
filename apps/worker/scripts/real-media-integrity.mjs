// Real-byte transfer and real FFmpeg verification, NOT an Alex render or cloud E2E.
import assert from 'node:assert/strict';
import {createReadStream} from 'node:fs';
import {mkdtemp,rm,writeFile,stat} from 'node:fs/promises';
import {createServer} from 'node:http';
import {createHash,randomBytes} from 'node:crypto';
import {promisify} from 'node:util';
import {execFile} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {receiveObject,verifySource} from '../src/media-integrity.js';
import {verifyMp4} from '../src/export-integrity.js';
import {editContract} from '../src/model-contract.js';
const run=promisify(execFile);
const source=process.env.SOCIALPLUS_TEST_RUSH;
if(!source)throw Error('Set SOCIALPLUS_TEST_RUSH to an existing private rush.');
const dir=process.env.SOCIALPLUS_TEST_OUTPUT?resolve(process.env.SOCIALPLUS_TEST_OUTPUT):await mkdtemp(join(tmpdir(),'real-transfer-'));
const {mkdir}=await import('node:fs/promises');await mkdir(dir,{recursive:true,mode:0o700});
const token=randomBytes(32).toString('hex');const size=(await stat(source)).size;
const server=createServer((req,res)=>{
 if(req.headers.authorization!=='Bearer '+token){res.writeHead(401);res.end();return;}
 res.writeHead(200,{'Content-Type':'video/quicktime','Content-Length':size});createReadStream(source).pipe(res);
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
try{
 const address='http://127.0.0.1:'+server.address().port;
 assert.equal((await fetch(address)).status,401);
 const imported=join(dir,'imported.mov');
 await receiveObject(await fetch(address,{headers:{Authorization:'Bearer '+token}}),imported,{expectedBytes:size});
 const hash=createHash('sha256');for await(const b of createReadStream(source))hash.update(b);const sha256=hash.digest('hex');
 await verifySource(imported,{sizeBytes:size,sha256});
 const {stdout}=await run('ffprobe',['-v','error','-show_streams','-show_format','-of','json',imported]);
 const p=JSON.parse(stdout),v=p.streams.find(s=>s.codec_type==='video'),hasAudio=p.streams.some(s=>s.codec_type==='audio');
 const out=join(dir,'technical-streamcopy.mp4');
 await run('ffmpeg',['-v','error','-i',imported,'-map','0:v:0',...(hasAudio?['-map','0:a:0']:[]),'-c','copy','-movflags','+faststart',out]);
 const verified=await verifyMp4(out,{width:v.width,height:v.height,durationMs:Number(p.format.duration)*1000,hasAudio});
 await run('ffmpeg',['-v','error','-i',out,'-f','null','-']);
 const pcm=async file=>(await run('ffmpeg',['-v','error','-i',file,'-map','0:a:0','-f','s16le','-'],{encoding:'buffer',maxBuffer:30_000_000})).stdout;
 if(hasAudio)assert.deepEqual(await pcm(imported),await pcm(out));
 await assert.rejects(verifyMp4(out,{width:v.height,height:v.width,durationMs:verified.durationMs,hasAudio}),{code:'EXPORT_QA_FAILED'});
 const gate=editContract('hormozi_omni');assert.equal(gate.ok,false);
 const report={realRushTransferred:true,unauthorizedTransferRejected:true,sourceSha256:sha256,verified,fullDecode:true,audioPcmIdentical:hasAudio?true:null,wrongDimensionsRejected:true,alexRenderExecuted:false,alexBlocker:gate.code,cloudE2E:false,physicalSafari:false,note:'Technical transfer/remux proof only. This is not an Alex montage.'};
 await writeFile(join(dir,'results.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}finally{await new Promise(r=>server.close(r));if(!process.env.SOCIALPLUS_TEST_OUTPUT)await rm(dir,{recursive:true,force:true});}
