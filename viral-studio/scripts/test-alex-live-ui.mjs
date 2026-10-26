// Real integration test: no fulfilled/mocked API responses; secrets and media stay outside Git.
import {createRequire} from 'node:module';import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';import {resolve,sep} from 'node:path';import {pathToFileURL,fileURLToPath} from 'node:url';
const require=createRequire(import.meta.url);const {chromium}=require('playwright');
const base=process.env.SOCIALPLUS_TEST_URL||'http://127.0.0.1:3211';
if(!['127.0.0.1','localhost'].includes(new URL(base).hostname))throw Error('Local isolated test origin required');
if(!process.env.SOCIALPLUS_TEST_CREDENTIALS||!process.env.SOCIALPLUS_TEST_RUSH||!process.env.SOCIALPLUS_TEST_OUTPUT)throw Error('Set SOCIALPLUS_TEST_CREDENTIALS, SOCIALPLUS_TEST_RUSH and SOCIALPLUS_TEST_OUTPUT outside the repository');
const output=resolve(process.env.SOCIALPLUS_TEST_OUTPUT),repo=resolve(fileURLToPath(new URL('../..',import.meta.url)));
if(output===repo||output.startsWith(repo+sep))throw Error('Private test outputs must stay outside the repository');
mkdirSync(output,{recursive:true,mode:0o700});
const dir=pathToFileURL(output+sep),c=JSON.parse(readFileSync(process.env.SOCIALPLUS_TEST_CREDENTIALS));const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});const ctx=await browser.newContext({viewport:{width:390,height:844},acceptDownloads:true});
const page=await ctx.newPage(),steps=[],requests=[];
await ctx.route('**/*',route=>{const u=new URL(route.request().url());if(!['127.0.0.1','localhost'].includes(u.hostname)&&['http:','https:'].includes(u.protocol))return route.abort();return route.continue();});
page.on('response',r=>{const u=new URL(r.url());if(u.pathname.startsWith('/api/'))requests.push({path:u.pathname,status:r.status()});});
try{
 await page.goto(base+'/dashboard?tool=edit');await page.getByLabel('Adresse email',{exact:true}).fill(c.email);await page.getByLabel('Mot de passe',{exact:true}).fill(c.password);await page.getByRole('button',{name:'Se connecter',exact:true}).click();await page.locator('.upload-zone input[type=file]').first().waitFor({timeout:30000});steps.push('real-password-login');
 await page.locator('.upload-zone input[type=file]').first().setInputFiles(process.env.SOCIALPLUS_TEST_RUSH);
 await page.waitForResponse(r=>r.url().includes('/api/viral-edit-jobs/media')&&r.request().method()==='POST'&&r.status()===201,{timeout:60000});
 await page.locator('button[data-model="hormozi_omni"]').click({timeout:15000});await page.getByRole('button',{name:/Créer mon montage · Alex Hormozi/}).click({timeout:60000});steps.push('real-import-and-job-submission');
 await page.getByRole('link',{name:'Ouvrir le MP4 ↗'}).waitFor({timeout:600000});steps.push('real-offline-render-completed');
 const video=page.locator('video.result-video');await video.evaluate(v=>v.play());await page.waitForFunction(()=>{const v=document.querySelector('video.result-video');return v&&v.currentTime>.2&&v.videoWidth>0&&v.videoHeight>0;},{},{timeout:30000});steps.push('mp4-preview-decoded');
 const href=await page.getByRole('link',{name:'Ouvrir le MP4 ↗'}).getAttribute('href');if(!['127.0.0.1','localhost'].includes(new URL(href).hostname))throw Error('Download must remain on the isolated local stack');const response=await ctx.request.get(href);if(response.status()!==200)throw Error('Download HTTP '+response.status());const bytes=await response.body();writeFileSync(new URL('Alex_V16_UI_download.mp4',dir),bytes);steps.push('real-signed-download');
 await page.screenshot({path:new URL('real-ui-completed.png',dir).pathname,fullPage:true});
 await page.reload();await page.locator('.upload-zone input[type=file]').first().waitFor();steps.push('authenticated-session-reopened');
 await page.screenshot({path:new URL('real-ui-result.png',dir).pathname,fullPage:true});writeFileSync(new URL('e2e-result.json',dir),JSON.stringify({ok:true,steps,requests,bytes:bytes.length,physicalIPhone:false,mocks:false},null,2));console.log('Real UI test passed; private result saved');
}catch(e){await page.screenshot({path:new URL('real-ui-failure.png',dir).pathname,fullPage:true}).catch(()=>{});writeFileSync(new URL('e2e-result.json',dir),JSON.stringify({ok:false,steps,requests,error:String(e),body:(await page.locator('body').innerText()).slice(-5000),physicalIPhone:false,mocks:false},null,2));console.log('Real UI test failed; see private evidence');process.exitCode=1;}finally{await browser.close();}
