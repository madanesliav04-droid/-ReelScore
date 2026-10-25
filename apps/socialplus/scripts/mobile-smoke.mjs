// Real spoken-rush end-to-end check. Artifacts default outside the public repository.
import {createApp} from '../server/index.mjs';
import {totpCode} from '../server/security.mjs';
import {probeVideo} from '../server/render.mjs';
import {chromium} from 'playwright-core';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {randomUUID,randomBytes} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
const source=process.env.SOCIALPLUS_TEST_RUSH;
if(!source)throw Error('SOCIALPLUS_TEST_RUSH doit désigner un vrai rush parlé. Aucun résultat de parole fictif n’est injecté.');
const out=resolve(process.env.SOCIALPLUS_BROWSER_ARTIFACT_DIR||join(tmpdir(),'socialplus-mobile-private'));
await mkdir(out,{recursive:true});
const dataDir=await mkdtemp(join(tmpdir(),'socialplus-mobile-'));
const origin='http://localhost:4334',ownerId=randomUUID(),seed='JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP',password=randomBytes(24).toString('base64url');
const app=await createApp({dataDir,origin,securityConfig:{ownerId,ownerTotpSecret:seed,secureCookies:false}});
let browser;
const checks={};
try{
 await app.security.provisionOwner({id:ownerId,email:'mobile-test@example.test',password,displayName:'Camille'});
 await new Promise(r=>app.server.listen(4334,'localhost',r));
 browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--disable-dev-shm-usage']});
 const context=await browser.newContext({viewport:{width:402,height:874},isMobile:true,hasTouch:true,deviceScaleFactor:2,acceptDownloads:true});
 const page=await context.newPage();page.setDefaultTimeout(20000);
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 let uploads=0;page.on('request',r=>{if(r.method()==='POST'&&r.url().endsWith('/source'))uploads++;});
 await page.goto(origin);
 await page.locator('[name=email]').fill('mobile-test@example.test');await page.locator('[name=password]').fill(password);await page.locator('[name=totp]').fill(totpCode(seed));await page.locator('[data-form=login] button[type=submit]').click();
 await page.getByRole('heading',{name:'Bonjour, Camille.'}).waitFor();assert.equal(await page.locator('#main-nav a').count(),4);checks.navigation=true;
 await page.screenshot({path:join(out,'iphone-home-empty.png'),fullPage:true,animations:'disabled'});
 await page.locator('[data-action=new-project]').first().click();await page.locator('#video-input').setInputFiles(resolve(source));
 await page.locator('#source-preview').waitFor({timeout:60000});checks.autoUpload=true;
 await page.locator('[data-action=project-analysis]').click();await page.locator('#analyze-video-button').click();
 await page.locator('[data-action=analysis-to-montage]').waitFor({timeout:60000});
 const score=await page.locator('.score-value').innerText();const analysisText=await page.locator('#video-analysis-result').innerText();
 await page.locator('#analyze-video-button').click();await page.locator('[data-action=analysis-to-montage]').waitFor();assert.equal(await page.locator('.score-value').innerText(),score);checks.analysisStable=true;
 await page.screenshot({path:join(out,'iphone-analysis.png'),fullPage:true,animations:'disabled'});
 await page.locator('[data-action=analysis-to-montage]').click();assert.equal(uploads,1);checks.sameSource=true;
 await page.locator('[data-action=prepare-model]').click();await page.waitForFunction(()=>document.querySelector('#transcript')?.value.length>10,{},{timeout:600000});
 await page.waitForFunction(()=>!document.querySelector('[data-action=prepare-model]').disabled,{},{timeout:600000});
 const six=[];
 for(const model of ['codie-omni-v60','alex-hormozi-v16','leila-hormozi-v53','social-kinetic-v28','cinematic-storytelling-v7','apple-premium-spatial']){
  await page.locator(`[data-action=select-style][data-id=${model}]`).click();assert.equal(await page.locator(`[data-id=${model}][aria-pressed=true]`).count(),1);assert.equal(await page.locator('#placement-reviewed').isChecked(),false);six.push(model);
 }
 assert.ok((await page.locator('#model-detail').innerText()).length>20);checks.sixModels=six;
 // Verify input is not presented as phonetic approval.
 assert.equal(await page.locator('#captions-reviewed').isChecked(),false);
 await page.locator('[data-action=select-style][data-id=leila-hormozi-v53]').click();
 await page.locator('#placement-reviewed').check();
 await page.locator('[data-action=render]').click();
 await page.locator('#main-nav [data-tab=projects]').click();
 await page.locator('.project-open').first().click();
 await page.locator('#render-status video').waitFor({timeout:180000});checks.renderResume=true;
 const player=page.locator('#render-status video');await player.evaluate(v=>{v.muted=true;return v.play();});await page.waitForTimeout(1200);
 const playback=await player.evaluate(v=>({time:v.currentTime,width:v.videoWidth,height:v.videoHeight,error:v.error?.message||null}));assert.ok(playback.time>0);assert.equal(playback.error,null);checks.playback=playback;
 const download=page.waitForEvent('download');await page.locator('#render-status a[download]').click();await (await download).saveAs(join(out,'real-rush-leila.mp4'));
 const metadata=await probeVideo(join(out,'real-rush-leila.mp4'));const original=await probeVideo(resolve(source));assert.equal(metadata.width,original.width);assert.equal(metadata.height,original.height);assert.equal(metadata.audioStreams,1);checks.nativeFormat=true;checks.singleAudio=true;
 execFileSync('ffmpeg',['-v','error','-i',join(out,'real-rush-leila.mp4'),'-f','null','-']);checks.fullDecode=true;
 // Source audio identity measured separately from its AAC re-encoding.
 const pcm=file=>execFileSync('ffmpeg',['-v','error','-i',file,'-map','0:a:0','-t','4','-ac','1','-ar','8000','-f','f32le','-'],{maxBuffer:4e6});
 const a=pcm(resolve(source)),b=pcm(join(out,'real-rush-leila.mp4'));let dot=0,aa=0,bb=0;
 for(let i=0;i<Math.min(a.length,b.length)-3;i+=4){const x=a.readFloatLE(i),y=b.readFloatLE(i);dot+=x*y;aa+=x*x;bb+=y*y;}
 checks.audioCorrelation=dot/Math.sqrt(aa*bb);assert.ok(checks.audioCorrelation>.98);
 await page.screenshot({path:join(out,'iphone-montage.png'),fullPage:true,animations:'disabled'});
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 // Touch targets and font size on mobile; no native Safari claim.
 assert.ok(await page.locator('#main-nav a').evaluateAll(rows=>rows.every(r=>r.getBoundingClientRect().height>=44)));
 await page.locator('#main-nav [data-tab=home]').click();await page.locator('.project-row').waitFor();assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'project filename must not widen the home grid');await page.screenshot({path:join(out,'iphone-home.png'),fullPage:true,animations:'disabled'});
 await page.locator('#main-nav [data-tab=projects]').click();await page.locator('[data-action=project-options]').first().click();await page.locator('#sheet video').waitFor();assert.equal(await page.locator('#sheet a[download]').count(),1);await page.locator('#close-sheet').click();checks.projectPreview=true;
 await page.screenshot({path:join(out,'iphone-projects.png'),fullPage:true,animations:'disabled'});
 for(const width of [320,390,402,440,768,1440]){
  await page.setViewportSize({width,height:900});
  for(const tab of ['home','montage','analysis','projects']){await page.locator(`#main-nav [data-tab=${tab}]`).click();await page.waitForTimeout(120);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`${tab} overflow at ${width}`);}
 }
 checks.responsiveWidths=[320,390,402,440,768,1440];
 await page.screenshot({path:join(out,'desktop-projects.png'),fullPage:true,animations:'disabled'});
 await page.emulateMedia({reducedMotion:'reduce',colorScheme:'light'});await page.locator('#account-button').click();await page.locator('[data-action=theme]').click();await page.locator('#close-sheet').click();checks.reducedMotion=true;
 // A separate explicitly synthetic portrait verifies upload/export plumbing, no speech claims.
 const portrait=join(dataDir,'portrait-technical.mp4');execFileSync('ffmpeg',['-v','error','-f','lavfi','-i','color=c=0x253348:s=360x640:r=30','-f','lavfi','-i','sine=frequency=440:sample_rate=48000','-t','2','-c:v','libx264','-pix_fmt','yuv420p','-c:a','aac',portrait]);
 await page.locator('[data-action=new-project]').click();await page.locator('#video-input').setInputFiles(portrait);await page.locator('#source-preview').waitFor();
 await page.locator('details').filter({has:page.locator('[data-action=technical-export]')}).locator('summary').first().click();await page.locator('[data-action=technical-export]').click();await page.locator('#render-status a[download]').waitFor({timeout:60000});
 const vertical=page.waitForEvent('download');await page.locator('#render-status a[download]').click();await (await vertical).saveAs(join(out,'portrait-technical.mp4'));const pm=await probeVideo(join(out,'portrait-technical.mp4'));assert.equal(pm.width,360);assert.equal(pm.height,640);checks.portraitTechnical=true;
 assert.deepEqual(errors,[]);checks.javascriptErrors=errors;
 checks.analysisText=analysisText;checks.physicalIphone=false;checks.nativeWindows=false;
 await writeFile(join(out,'results.json'),JSON.stringify(checks,null,2));console.log(JSON.stringify(checks));
}finally{await browser?.close();await new Promise(r=>app.server.close(r));app.db.close();await rm(dataDir,{recursive:true,force:true});}
