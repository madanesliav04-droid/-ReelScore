// Opt-in private end-to-end test on a user-supplied speech rush.
import {mkdtemp,mkdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve,join} from 'node:path';
import {randomUUID,randomBytes} from 'node:crypto';
import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
import {createApp} from '../server/index.mjs';
import {totpCode} from '../server/security.mjs';
const [source,destination]=process.argv.slice(2);
if(!source||!destination)throw Error('Usage: node scripts/browser-spoken-rush.mjs SOURCE PRIVATE_OUTPUT_DIR');
const out=resolve(destination);await mkdir(out,{recursive:true,mode:0o700});
const dataDir=await mkdtemp(join(tmpdir(),'socialplus-spoken-ui-')),ownerId=randomUUID(),seed='JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP',password=randomBytes(24).toString('base64url');
const origin='http://localhost:4330';const app=await createApp({dataDir,origin,securityConfig:{ownerId,ownerTotpSecret:seed,secureCookies:false}});
let browser;
try{
 await app.security.provisionOwner({id:ownerId,email:'local-speech-fixture@example.test',password,displayName:'Essai privé'});
 await new Promise(resolve=>app.server.listen(4330,'localhost',resolve));
 browser=await chromium.launch({headless:true,executablePath:process.env.SOCIALPLUS_CHROMIUM||'/usr/bin/chromium',args:['--disable-dev-shm-usage']});
 const context=await browser.newContext({viewport:{width:1440,height:1000},colorScheme:'dark'}),page=await context.newPage();page.setDefaultTimeout(15000);
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(origin);await page.locator('[name=email]').fill('local-speech-fixture@example.test');await page.locator('[name=password]').fill(password);await page.locator('[name=totp]').fill(totpCode(seed));await page.locator('[data-form=login] button[type=submit]').click();await page.locator('#main-nav').waitFor();
 await page.locator('#main-nav [data-tab=montage]').click();await page.locator('#video-input').setInputFiles(resolve(source));await page.locator('#source-preview').waitFor({timeout:60000});await page.locator('[data-form=project-save] [name=title]').fill('Essai privé sur rush parlé');await page.locator('[data-form=project-save] button[type=submit]').click();await page.getByText('Votre projet est enregistré.',{exact:true}).waitFor({timeout:60000});
 const button=page.locator('[data-action=transcribe-source]');await button.waitFor();assert.equal(await button.isEnabled(),true);
 const transcription=page.waitForResponse(r=>r.url().endsWith('/transcript')&&r.request().method()==='POST',{timeout:600000});await button.click();const response=await transcription;assert.equal(response.status(),200);const data=await response.json();assert.ok(data.transcript.words.length>50);assert.equal(data.transcript.reviewed,false);
 await page.waitForFunction(()=>document.querySelector('#transcript').value.length>100);
 assert.equal(await page.locator('#captions-reviewed').isChecked(),false);
 for(const model of ['codie-omni-v60','alex-hormozi-v16','leila-hormozi-v53','social-kinetic-v28','apple-premium-spatial','cinematic-storytelling-v7']){
  await page.locator(`[data-action=select-style][data-id=${model}]`).click();await page.locator('[data-action=draft-model-events]').click();const events=JSON.parse(await page.locator('#reference-events').inputValue());assert.ok(Array.isArray(events));if(model==='codie-omni-v60')assert.equal(events.length,0);else assert.ok(events.length>0);assert.equal(await page.locator('#placement-reviewed').isChecked(),false);
 }
 await page.locator('[data-action=select-style][data-id=codie-omni-v60]').click();await page.locator('[data-action=draft-model-events]').click();await page.locator('#placement-reviewed').check();await page.locator('#caption-preview-mode').check();
 const render=page.waitForResponse(r=>r.url().endsWith('/render')&&r.request().method()==='POST');await page.locator('[data-action=render]').click();assert.equal((await render).status(),202);
 await page.locator('#render-status a[download]').waitFor({timeout:120000});const download=page.waitForEvent('download');await page.locator('#render-status a[download]').click();await (await download).saveAs(join(out,'browser-codie-real-rush.mp4'));
 await page.screenshot({path:join(out,'desktop-real-montage.png'),fullPage:true});
 await page.setViewportSize({width:390,height:844});await page.emulateMedia({colorScheme:'light'});await page.screenshot({path:join(out,'iphone-real-montage.png'),fullPage:true});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 assert.deepEqual(errors,[]);console.log(JSON.stringify({passed:true,localTranscriptWords:data.transcript.words.length,reviewUnchecked:true,sixEventDrafts:true,realMp4Downloaded:true,desktop:[1440,1000],mobileEmulation:[390,844],javascriptErrors:errors},null,2));
}finally{await browser?.close();await new Promise(resolve=>app.server.close(resolve));app.db.close();await rm(dataDir,{recursive:true,force:true});}
