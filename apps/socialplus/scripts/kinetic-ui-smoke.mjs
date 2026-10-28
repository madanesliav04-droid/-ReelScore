// Actual authenticated UI -> upload -> local ASR -> locked renderer -> MP4 -> restart.
// Requires the real owner-approved rush and offline ASR; never injects a job or result.
import {createApp} from '../server/index.mjs';import {totpCode} from '../server/security.mjs';
import {KINETIC_RELEASE,assertKineticRelease} from '../server/kinetic-release.mjs';
import {chromium} from 'playwright-core';import https from 'node:https';
import {mkdtemp,mkdir,readFile,writeFile,copyFile,rm} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';import {randomBytes,randomUUID,createHash} from 'node:crypto';import {tmpdir} from 'node:os';import {join,resolve} from 'node:path';import assert from 'node:assert/strict';
const source=process.env.SOCIALPLUS_TEST_RUSH;if(!source)throw Error('SOCIALPLUS_TEST_RUSH requis : vrai rush, pas de résultat simulé.');
const out=resolve(process.env.SOCIALPLUS_BROWSER_ARTIFACT_DIR||join(tmpdir(),'socialplus-kinetic-ui-proof'));await mkdir(out,{recursive:true});
const dataDir=await mkdtemp(join(tmpdir(),'socialplus-kinetic-ui-'));const ownerId=randomUUID(),seed='JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP',password=randomBytes(24).toString('base64url');
const origin='https://localhost:4343';const cert=join(dataDir,'test.crt'),key=join(dataDir,'test.key');
execFileSync('openssl',['req','-x509','-newkey','rsa:2048','-nodes','-keyout',key,'-out',cert,'-days','1','-subj','/CN=localhost','-addext','subjectAltName=DNS:localhost,IP:127.0.0.1'],{stdio:'ignore'});
let app,server,browser;const events=[],errors=[],progress=[];let projectId;
const config={dataDir,origin,securityConfig:{ownerId,ownerTotpSecret:seed,secureCookies:true}};
async function start(){app=await createApp(config);server=https.createServer({key:await readFile(key),cert:await readFile(cert),minVersion:'TLSv1.2'},app.server.listeners('request')[0]);server.requestTimeout=600000;await new Promise(r=>server.listen(4343,'localhost',r));}
async function stop(){await app.projects.shutdown();await new Promise(r=>server.close(r));app.releaseRuntime();app.db.close();}
try{
 assertKineticRelease();await start();await app.security.provisionOwner({id:ownerId,email:'kinetic-ui@example.test',password,displayName:'Recette Kinetic'});
 browser=await chromium.launch({headless:true,executablePath:process.env.SOCIALPLUS_CHROMIUM||'/usr/bin/chromium',args:['--disable-dev-shm-usage']});
 // Self-signed cert is accepted only by this isolated local test context.
 const context=await browser.newContext({viewport:{width:402,height:874},isMobile:true,hasTouch:true,acceptDownloads:true,ignoreHTTPSErrors:true});const page=await context.newPage();page.setDefaultTimeout(20000);page.on('pageerror',e=>errors.push(e.message));
 page.on('response',async res=>{try{if(/\/api\/jobs\//.test(res.url())&&res.ok())progress.push((await res.json()).job.progress);}catch{}});
 await page.goto(origin);await page.locator('[name=email]').fill('kinetic-ui@example.test');await page.locator('[name=password]').fill(password);await page.locator('[name=totp]').fill(totpCode(seed));await page.locator('[data-form=login] button[type=submit]').click();await page.locator('#main-nav').waitFor();assert.ok((await context.cookies()).some(c=>c.secure&&c.httpOnly));events.push('HTTPS login, Secure HttpOnly session, owner MFA');
 await page.locator('[data-action=new-project]').first().click();await page.locator('#video-input').setInputFiles(resolve(source));await page.locator('#source-preview').waitFor({timeout:60000});
 projectId=await page.locator('.studio-page').getAttribute('data-project-id');assert.ok(projectId);events.push('Actual browser video upload persisted');
 await page.locator('[data-action=select-style][data-id=social-kinetic-v28]').click();await page.waitForFunction(()=>document.querySelector('[data-action=select-style][data-id=social-kinetic-v28]')?.getAttribute('aria-pressed')==='true');
 const started=performance.now();await page.locator('[data-action=prepare-model]').click();await page.waitForFunction(()=>document.querySelector('#transcript')?.value.length>10,{},{timeout:600000});await page.waitForFunction(()=>!document.querySelector('[data-action=prepare-model]').disabled,{},{timeout:600000});
 const actualTranscript=JSON.parse(await page.locator('#transcript').inputValue());const direction=JSON.parse(await page.locator('#reference-events').inputValue());assert.ok(direction.layout,'Source/transcript does not match a reviewed direction; do not silently use another template.');events.push('Real offline ASR and source-bound approved direction');
 // A visual placement review is not a phonetic transcription confirmation.
 await page.locator('#placement-reviewed').check();assert.equal(await page.locator('#captions-reviewed').isChecked(),false);assert.equal(await page.locator('[data-action=select-style][aria-pressed=true]').getAttribute('data-id'),'social-kinetic-v28');await page.locator('[data-action=render]').click();await page.locator('#render-status video').waitFor({timeout:600000});
 const elapsedSeconds=(performance.now()-started)/1000;events.push('Real queued render through UI and locked renderer');
 const execution=JSON.parse(app.db.prepare('SELECT payload FROM studio_render_requests WHERE project_id=?').get(projectId).payload);console.log(JSON.stringify({actualModel:execution.modelId,release:execution.kineticRelease,hasDirection:Boolean(execution.restoredInput?.kineticDirection)}));assert.equal(execution.kineticRelease,KINETIC_RELEASE);assert.ok(execution.restoredInput.kineticDirection.layout);
 const video=page.locator('#render-status video');await video.evaluate(async e=>{e.muted=true;await e.play();});await page.waitForFunction(()=>document.querySelector('#render-status video')?.currentTime>.25);events.push('Generated MP4 plays in mobile Chromium');
 const download=page.waitForEvent('download');await page.locator('#render-status a[download]').click();const item=await download,path=await item.path();const bytes=await readFile(path),sha=createHash('sha256').update(bytes).digest('hex');await copyFile(path,join(out,'SocialPlus_Kinetic_V28_UI.mp4'));
 const saved=app.db.prepare('SELECT output_path FROM studio_projects WHERE id=?').get(projectId);assert.equal(createHash('sha256').update(await readFile(saved.output_path)).digest('hex'),sha);events.push('Authenticated full download matches server MP4 hash');
 const range=await context.request.get(origin+'/api/projects/'+projectId+'/output',{headers:{Range:'bytes=0-1023'}});assert.equal(range.status(),206);assert.equal((await range.body()).length,1024);events.push('Authenticated HTTP Range works');
 const guest=await browser.newContext({ignoreHTTPSErrors:true});assert.equal((await guest.request.get(origin+'/api/projects/'+projectId+'/output')).status(),401);await guest.close();
 execFileSync('ffmpeg',['-v','error','-i',join(out,'SocialPlus_Kinetic_V28_UI.mp4'),'-f','null','-'],{stdio:['ignore','ignore','pipe']});
 const pcm=file=>execFileSync('ffmpeg',['-v','error','-i',file,'-map','0:a:0','-vn','-f','s16le','-'],{maxBuffer:20_000_000});assert.ok(pcm(resolve(source)).equals(pcm(join(out,'SocialPlus_Kinetic_V28_UI.mp4'))));
 await stop();await start();await page.reload();await page.locator('#main-nav').waitFor();await page.locator('[data-tab=projects]').click();await page.locator('[data-action=open-project][data-id="'+projectId+'"]').click();await page.locator('#render-status video').waitFor();events.push('Project, source, direction, job and MP4 survive real server restart');
 const csrf=await page.evaluate(async()=>{const d=await (await fetch('/api/session')).json();return d.csrf;});const remembered=await context.request.post(origin+'/api/projects/'+projectId+'/kinetic-direction',{headers:{Origin:origin,'X-CSRF-Token':csrf},data:{transcript:actualTranscript}});assert.equal(remembered.status(),200);assert.deepEqual((await remembered.json()).direction,execution.restoredInput.kineticDirection);
 const downgrade=await context.request.post(origin+'/api/projects/'+projectId+'/render',{headers:{Origin:origin,'X-CSRF-Token':csrf},data:{style_id:'social-kinetic-v28',transcript:actualTranscript,events:[],placementReviewed:true,allowUnreviewedPreview:true}});assert.equal(downgrade.status(),422);assert.equal((await downgrade.json()).code,'KINETIC_DIRECTION_REQUIRED');events.push('Generic Kinetic fallback rejected with 422');
 assert.deepEqual(errors,[]);assert.ok(progress.includes(100));
 const report={release:KINETIC_RELEASE,events,progress,elapsedSecondsIncludingAnalysisAndASR:elapsedSeconds,bytes:bytes.length,outputSha256:sha,completeDecode:true,sourcePcmIdentical:true,jsErrors:errors,https:true,certificate:'self-signed accepted by isolated test context; not a trusted public/iPhone certificate',physicalSafari:false,paidServicesCalled:false,remoteDeployment:false,arbitraryRushDirectionAutomatic:false};await writeFile(join(out,'RESULTATS.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}catch(e){await writeFile(join(out,'failure.txt'),String(e.stack));throw e;}
finally{await browser?.close();if(server?.listening)await stop();await rm(dataDir,{recursive:true,force:true});}
