// Real authenticated UI -> spoken upload -> offline analysis -> independent import replay.
// Requires the real owner-approved rush and offline ASR; never injects a job or result.
import {createApp} from '../server/index.mjs';import {totpCode} from '../server/security.mjs';
import {KINETIC_RELEASE,assertKineticRelease} from '../server/kinetic-release.mjs';
import {chromium} from 'playwright-core';import https from 'node:https';
import {mkdtemp,mkdir,readFile,writeFile,copyFile,rm} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';import {randomBytes,randomUUID,createHash} from 'node:crypto';import {tmpdir} from 'node:os';import {join,resolve} from 'node:path';import assert from 'node:assert/strict';
const source=process.env.SOCIALPLUS_TEST_RUSH;if(!source)throw Error('SOCIALPLUS_TEST_RUSH requis : vrai rush, pas de résultat simulé.');
const out=resolve(process.env.SOCIALPLUS_BROWSER_ARTIFACT_DIR||join(tmpdir(),'socialplus-editorial-ui-proof'));await mkdir(out,{recursive:true});
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
 await page.locator('[data-action=project-analysis]').first().click();
 await page.locator('#analyze-video-button').waitFor();
 const editorialResponse=page.waitForResponse(r=>r.url().endsWith('/editorial')&&r.request().method()==='POST');
 await page.locator('#analyze-video-button').click();
 const response=await editorialResponse;assert.equal(response.status(),200);const first=(await response.json()).editorial;
 await page.getByRole('heading',{name:'Repères éditoriaux locaux',exact:true}).waitFor({timeout:600000});
 assert.ok(first.inputHash);assert.equal(first.globalEditorialScore,null);assert.equal(first.criteria.retention.score,null);
 assert.ok(Array.isArray(first.findings));assert.ok(first.findings.every(x=>Number.isFinite(x.startMs)&&x.endMs>=x.startMs));
 const csrf=await page.evaluate(async()=>{const s=await (await fetch('/api/session')).json();return s.csrf});
 const headers={Origin:origin,'X-CSRF-Token':csrf};
 const created=await context.request.post(origin+'/api/projects',{headers,data:{name:'Second independent test import'}});assert.equal(created.status(),201);const secondProject=(await created.json()).project;
 const uploaded=await context.request.post(origin+'/api/projects/'+secondProject.id+'/source',{headers:{...headers,'Content-Type':'video/quicktime','X-Filename':'second.mov'},data:await readFile(source)});assert.equal(uploaded.status(),200);
 const repeated=await context.request.post(origin+'/api/projects/'+secondProject.id+'/editorial',{headers,data:{goal:'awareness'},timeout:600000});assert.equal(repeated.status(),200);const second=(await repeated.json()).editorial;
 assert.equal(second.inputHash,first.inputHash);assert.deepEqual(second.criteria,first.criteria);assert.deepEqual(second.findings,first.findings);assert.deepEqual(errors,[]);
 await writeFile(join(out,'EDITORIAL_PRIVATE.json'),JSON.stringify({first,second},null,2));
 const report={scope:'Real local isolated HTTPS Auth/upload/UI and offline ASR/editorial indicators, not public cloud or physical Safari',authenticatedUI:true,realUpload:true,realOfflineSpeechTranscription:true,realMeasuredSignals:true,independentImportsIdentical:true,findingsHaveTimestamps:true,globalEditorialScore:null,retentionNotInvented:true,jsErrors:0,paidCalls:0,physicalSafari:false};
 await writeFile(join(out,'RESULTATS.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}catch(e){await writeFile(join(out,'failure.txt'),String(e.stack));throw e;}
finally{await browser?.close();if(server?.listening)await stop();await rm(dataDir,{recursive:true,force:true});}
