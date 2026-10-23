import {spawn} from 'node:child_process';
import {readFile,mkdir,writeFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {createRequire} from 'node:module';
import {once} from 'node:events';
import {socialKineticV28Html} from '../../worker/src/social-kinetic-v28-engine.js';
const require=createRequire(import.meta.url);

// Reuses the V28 HTML/GSAP compositor, entirely offline. The caller supplies
// reviewed text and rectangles; no independent tracking evidence is invented.
export async function captureKinetic(plan,outputPath,{signal}={}){
 const {chromium}=await import('playwright-core');
 const gsap=await readFile(require.resolve('gsap/dist/gsap.min.js'),'utf8');
 const events=plan.events.map((e,i)=>({id:'reviewed-'+i,kind:e.kind==='hero'?'hero':'bubble',text:e.text,startMs:e.startMs,endMs:e.endMs,rect:{x:e.rect[0],y:e.rect[1],w:e.rect[2],h:e.rect[3]}}));
 const html=socialKineticV28Html({model:'social_kinetic_v28',status:'staging_renderable',durationMs:plan.durationMs,events},{width:plan.width,height:plan.height,fps:30})
   .replace(/<script src="https:[^"]+"><\/script>/,()=>'<script>'+gsap.replace(/<\/script/gi,'<\\/script')+'</script>');
 const browser=await chromium.launch({headless:true,...(process.env.SOCIALPLUS_CHROMIUM?{executablePath:process.env.SOCIALPLUS_CHROMIUM}:process.platform==='linux'?{executablePath:'/usr/bin/chromium'}:{}),args:['--disable-dev-shm-usage']});
 const frameDir=outputPath+'.frames';await mkdir(frameDir,{recursive:true});
 let child,stderr='',processError;
 const timer=setTimeout(()=>{processError=new Error('Délai de rendu Social Kinetic dépassé.');child?.kill('SIGKILL');browser.close().catch(()=>{});},600_000);
 const abort=()=>{processError=new Error('Rendu annulé.');child?.kill('SIGKILL');browser.close().catch(()=>{});};signal?.addEventListener('abort',abort,{once:true});
 try{
  if(signal?.aborted)throw new Error('Rendu annulé.');
  const page=await browser.newPage({viewport:{width:plan.width,height:plan.height},deviceScaleFactor:1});
  await page.route('**/*',route=>route.abort());
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.setContent(html);await page.evaluate(()=>document.fonts.ready);
  if(errors.length)throw new Error(errors.join('; '));
  const cdp=await page.context().newCDPSession(page);
  await cdp.send('Emulation.setDefaultBackgroundColorOverride',{color:{r:0,g:0,b:0,a:0}});
  for(let frame=0;frame<Math.ceil(plan.durationMs/1000*30);frame++){
   if(processError)throw processError;
   await page.evaluate(t=>{window.__timelines['editplus-social-kinetic-v28-native'].seek(t,false);},frame/30);
   const shot=await cdp.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false,optimizeForSpeed:true});
   const png=Buffer.from(shot.data,'base64');
   await writeFile(join(frameDir,String(frame).padStart(6,'0')+'.png'),png);
  }
  child=spawn('ffmpeg',['-hide_banner','-loglevel','error','-nostdin','-y','-framerate','30','-start_number','0','-i',join(frameDir,'%06d.png'),'-an','-c:v','qtrle',outputPath],{stdio:['ignore','ignore','pipe']});
  child.stderr.on('data',b=>{stderr=(stderr+b).slice(-4000);});
  const [code]=await once(child,'close');if(code!==0)throw new Error('Rendu V28 échoué : '+stderr);
 }finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);if(child&&!child.killed&&child.exitCode===null)child.kill('SIGKILL');await browser.close();await rm(frameDir,{recursive:true,force:true});}
}
