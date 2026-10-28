// Opt-in real UI test of the shared Alex V16 worker through the standalone server.
// Requires the real owner-approved rush and offline ASR; never injects a job or result.
import {createApp} from '../server/index.mjs';import {totpCode} from '../server/security.mjs';
import {KINETIC_RELEASE,assertKineticRelease} from '../server/kinetic-release.mjs';
import {chromium} from 'playwright-core';import https from 'node:https';
import {mkdtemp,mkdir,readFile,writeFile,copyFile,rm} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';import {randomBytes,randomUUID,createHash} from 'node:crypto';import {tmpdir} from 'node:os';import {join,resolve} from 'node:path';import assert from 'node:assert/strict';
const source=process.env.SOCIALPLUS_TEST_RUSH;if(!source)throw Error('SOCIALPLUS_TEST_RUSH requis : vrai rush, pas de résultat simulé.');
const out=resolve(process.env.SOCIALPLUS_BROWSER_ARTIFACT_DIR||join(tmpdir(),'socialplus-alex-standalone-ui-proof'));await mkdir(out,{recursive:true});
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
 await page.locator('[data-action=select-style][data-id=alex-hormozi-v16]').click();
 await page.locator('[data-action=prepare-model]').click();
 await page.waitForFunction(()=>document.querySelector('#transcript')?.value.length>10,{},{timeout:600000});
 await page.waitForFunction(()=>!document.querySelector('[data-action=prepare-model]').disabled,{},{timeout:600000});
 await page.locator('#placement-reviewed').check();assert.equal(await page.locator('#captions-reviewed').isChecked(),false);
 await page.locator('[data-action=render]').click();await page.locator('#render-status video').waitFor({timeout:600000});
 const saved=app.db.prepare('SELECT output_path FROM studio_projects WHERE id=?').get(projectId);
 const job=app.db.prepare('SELECT audit FROM studio_jobs WHERE project_id=? ORDER BY created_at DESC LIMIT 1').get(projectId);const audit=JSON.parse(job.audit);
 assert.equal(audit.engine,'alex-v16-shared-worker');assert.equal(audit.referenceUsed,false);assert.equal(audit.releaseApproved,false);
 const video=page.locator('#render-status video');await video.evaluate(async e=>{e.muted=true;await e.play()});await page.waitForFunction(()=>document.querySelector('#render-status video').currentTime>.1);
 const pending=page.waitForEvent('download');await page.locator('#render-status a[download]').click();const download=await pending;const bytes=await readFile(await download.path());assert.equal(createHash('sha256').update(bytes).digest('hex'),createHash('sha256').update(await readFile(saved.output_path)).digest('hex'));
 await copyFile(await download.path(),join(out,'SocialPlus_Alex_V16_standalone_UI.mp4'));
 execFileSync('ffmpeg',['-v','error','-i',saved.output_path,'-f','null','-'],{stdio:['ignore','ignore','pipe']});
 assert.deepEqual(errors,[]);await stop();await start();await page.reload();await page.locator('#main-nav').waitFor();
 const restored=await context.request.get(origin+'/api/projects/'+projectId);assert.equal(restored.status(),200);assert.equal((await restored.json()).project.has_output,true);
 const report={scope:'Real isolated local HTTPS UI/Auth/upload/offline ASR/shared Alex worker/preview/download/restart, not public cloud or physical Safari',authenticatedUI:true,realUpload:true,offlineTranscription:true,sharedWorkerPipeline:true,referenceUsed:false,fullDecode:true,downloadHashMatches:true,persistedAfterRestart:true,reviewRequired:audit.reviewRequired,releaseApproved:false,paidCalls:0,physicalSafari:false};
 await writeFile(join(out,'RESULTATS.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}catch(e){await writeFile(join(out,'failure.txt'),String(e.stack));throw e;}
finally{await browser?.close();if(server?.listening)await stop();await rm(dataDir,{recursive:true,force:true});}
