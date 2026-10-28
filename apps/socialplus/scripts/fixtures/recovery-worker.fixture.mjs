// Test-only child process, intentionally terminated before its real renderer completes.
import {createApp} from '../../server/index.mjs';
import {createReadStream} from 'node:fs';
const [dataDir,source]=process.argv.slice(2);
const app=await createApp({dataDir});const p=app.projects.create('recovery-test');
const stream=createReadStream(source);stream.headers={'content-type':'video/mp4'};
await app.projects.upload('recovery-test',p.id,stream);
const job=app.projects.startRender('recovery-test',p.id,{style_id:'technical-export',requestId:'real-recovery-request-01'});
process.stdout.write(JSON.stringify({jobId:job.id,projectId:p.id})+'\n');
setInterval(()=>{},1000);
