import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {spawn,execFileSync} from 'node:child_process';
import {once} from 'node:events';
import {setTimeout as delay} from 'node:timers/promises';
import {createApp} from './index.mjs';
import {probeVideo} from './render.mjs';
import {fileURLToPath} from 'node:url';

test('real process termination resumes the same persisted job once, using FFmpeg and unchanged quota',async t=>{
 const dir=await mkdtemp(join(tmpdir(),'socialplus-process-recovery-')),dataDir=join(dir,'data'),source=join(dir,'source.mp4');
 let app,child;t.after(async()=>{if(child&&child.exitCode===null&&child.signalCode===null){child.kill('SIGKILL');await once(child,'exit');}if(app)app.db.close();await rm(dir,{recursive:true,force:true});});
 execFileSync('ffmpeg',['-v','error','-f','lavfi','-i','color=c=0x253348:s=360x640:r=30','-f','lavfi','-i','sine=frequency=440:sample_rate=48000','-t','2','-c:v','libx264','-pix_fmt','yuv420p','-c:a','aac',source]);
 child=spawn(process.execPath,[fileURLToPath(new URL('../test/fixtures/recovery-worker.mjs',import.meta.url)),dataDir,source],{stdio:['ignore','pipe','pipe']});
 const descriptor=await new Promise((resolve,reject)=>{let output='';const timer=setTimeout(()=>reject(Error('Recovery fixture did not start')),15000);child.stdout.on('data',b=>{output+=b;const line=output.split('\n').find(l=>l.startsWith('{'));if(line){clearTimeout(timer);resolve(JSON.parse(line));}});child.once('error',reject);});
 child.kill('SIGKILL');await once(child,'exit');
 app=await createApp({dataDir});
 for(let i=0;i<1000&&['rendering','queued'].includes(app.projects.job('recovery-test',descriptor.jobId).state);i++)await delay(10);
 const job=app.projects.job('recovery-test',descriptor.jobId);assert.equal(job.state,'complete');
 assert.equal(app.db.prepare('SELECT attempts FROM studio_render_requests').get().attempts,2);
 assert.equal(app.db.prepare('SELECT started_count n FROM studio_render_usage').get().n,1);
 const path=app.db.prepare('SELECT output_path FROM studio_projects').get().output_path;
 const meta=await probeVideo(path);assert.equal(meta.width,360);assert.equal(meta.height,640);assert.equal(meta.audioStreams,1);assert.ok((await readFile(path)).length>0);
 execFileSync('ffmpeg',['-v','error','-i',path,'-f','null','-']);
 await assert.rejects(createApp({dataDir}),{code:'LOCAL_INSTANCE_RUNNING'});
});
