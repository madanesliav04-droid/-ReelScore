// Controlled failure fixtures test recovery UI; this is explicitly NOT a renderer validation.
import {createApp} from '../server/index.mjs';
import * as render from '../server/render.mjs';
import {totpCode} from '../server/security.mjs';
import {chromium} from 'playwright-core';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {randomUUID,randomBytes} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
const dataDir=await mkdtemp(join(tmpdir(),'socialplus-recovery-'));
const out=resolve(process.env.SOCIALPLUS_BROWSER_ARTIFACT_DIR||join(tmpdir(),'socialplus-recovery-artifacts'));await mkdir(out,{recursive:true});
const ownerId=randomUUID(),seed='JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP',password=randomBytes(24).toString('base64url');let release;
const gate=new Promise(r=>{release=r;});
const app=await createApp({dataDir,origin:'http://localhost:4335',securityConfig:{ownerId,ownerTotpSecret:seed,secureCookies:false},render:{...render,renderVideo:async()=>{await gate;throw Object.assign(Error('Dépendance de test indisponible (échec injecté).'),{code:'TOOL_UNAVAILABLE'});}}});
let browser;
try{
 const source=join(dataDir,'technical-pause.mp4');execFileSync('ffmpeg',['-v','error','-f','lavfi','-i','color=c=0x253348:s=640x360:r=30','-f','lavfi','-i','sine=frequency=440:sample_rate=48000','-t','6','-af',"volume=0:enable='between(t,2,4)'",'-c:v','libx264','-pix_fmt','yuv420p','-c:a','aac',source]);
 await app.security.provisionOwner({id:ownerId,email:'recovery@example.test',password,displayName:'Camille'});await new Promise(r=>app.server.listen(4335,'localhost',r));
 browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--disable-dev-shm-usage']});
 const page=await browser.newPage({viewport:{width:402,height:874},isMobile:true,hasTouch:true});page.setDefaultTimeout(15000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://localhost:4335');await page.locator('[name=email]').fill('recovery@example.test');await page.locator('[name=password]').fill(password);await page.locator('[name=totp]').fill(totpCode(seed));await page.locator('form[data-form=login] button[type=submit]').click();await page.getByRole('heading',{name:'Bonjour, Camille.'}).waitFor();
 await page.screenshot({path:join(out,'iphone-home.png'),fullPage:true,animations:'disabled',style:'#toast{display:none!important}'});
 await page.locator('[data-action=new-project]').first().click();await page.locator('#video-input').setInputFiles(source);await page.locator('#source-preview').waitFor();
 await page.locator('[data-action=project-analysis]').click();await page.locator('#analyze-video-button').click();await page.locator('[data-analysis-pause]').waitFor({state:'attached'});
 await page.locator('details').filter({has:page.locator('[data-analysis-pause]')}).locator('summary').first().click();await page.locator('[data-analysis-pause]').first().check();
 await page.locator('[data-action=analysis-to-montage]').click();await page.locator('[data-pause-id]').waitFor({state:'attached'});assert.equal(await page.locator('[data-pause-id]').first().isChecked(),true);
 await page.locator('details').filter({has:page.locator('[data-action=technical-export]')}).locator('summary').first().click();
 let aborted=false;await page.route('**/api/jobs/*',route=>{aborted=true;return route.abort('failed');});
 await page.locator('[data-action=technical-export]').click();await page.locator('[data-action=resume-job]').waitFor();assert.equal(aborted,true);
 await page.unroute('**/api/jobs/*');release();
 await page.locator('[data-action=resume-job]').click();await page.locator('.render-failure').waitFor();assert.ok((await page.locator('.render-failure').innerText()).includes('Votre rush est conservé'));
 await page.screenshot({path:join(out,'iphone-error.png'),fullPage:true,animations:'disabled'});
 // Refresh restores project id and failed task, without storing media or auth in sessionStorage.
 await page.reload();await page.locator('.render-failure').waitFor();assert.equal(await page.locator('#source-preview').count(),1);
 const storage=await page.evaluate(()=>Object.keys(sessionStorage));assert.ok(storage.every(k=>k.startsWith('socialplus-project-')));
 await page.locator('#main-nav [data-tab=projects]').click();await page.locator('[data-action=project-options]').click();
 page.once('dialog',d=>d.accept());await page.locator('[data-action=remove-project]').click();await page.getByRole('heading',{name:'Aucun projet ici.'}).waitFor();
 // Layout and access to existing support/FAQ stay intact.
 await page.locator('#account-button').click();await page.locator('#sheet [data-action=faq]').click();await page.locator('#faq-search').waitFor();await page.locator('#close-sheet').click();
 await page.emulateMedia({reducedMotion:'reduce'});await page.locator('#main-nav [data-tab=home]').click();await page.getByRole('heading',{name:'Bonjour, Camille.'}).waitFor();
 assert.equal(await page.locator('.page').evaluate(el=>getComputedStyle(el).animationName),'none');
 const oldTheme=await page.locator('html').getAttribute('data-theme');
 await page.locator('#account-button').click();await page.locator('#sheet [data-action=theme]').click();await page.locator('#close-sheet').click();
 assert.notEqual(await page.locator('html').getAttribute('data-theme'),oldTheme);
 await page.locator('#toast').waitFor({state:'hidden',timeout:7000});
 await page.screenshot({path:join(out,'iphone-home-dark.png'),fullPage:true,animations:'disabled'});
 await page.locator('#account-button').click();await page.locator('#sheet [data-action=theme]').click();await page.locator('#close-sheet').click();
 assert.equal(await page.locator('html').getAttribute('data-theme'),oldTheme);
 await page.screenshot({path:join(out,'iphone-home-light.png'),fullPage:true,animations:'disabled'});
 await page.locator('#main-nav [data-tab=montage]').click();await page.locator('#graphic-zone').waitFor();
 const inputFontPx=await page.locator('#graphic-zone').evaluate(el=>parseFloat(getComputedStyle(el).fontSize));assert.ok(inputFontPx>=16);
 const performance=await page.evaluate(()=>({navigation:performance.getEntriesByType('navigation').map(n=>({domContentLoadedMs:n.domContentLoadedEventEnd,responseEndMs:n.responseEnd})),fontSize:getComputedStyle(document.querySelector('.button')).fontSize}));
 assert.deepEqual(errors,[]);
 const results={controlledFailureFixture:true,notEngineCertification:true,pauseSelectionReused:true,networkRecovery:true,failedTaskVisible:true,sourceRetained:true,refreshResumes:true,deletion:true,faqPreserved:true,reducedMotion:true,themes:true,inputFontPx,performance,javascriptErrors:errors,physicalIphone:false};
 await writeFile(join(out,'recovery-results.json'),JSON.stringify(results,null,2));console.log(JSON.stringify(results));
}finally{release();await browser?.close();await new Promise(r=>app.server.close(r));app.db.close();await rm(dataDir,{recursive:true,force:true});}
