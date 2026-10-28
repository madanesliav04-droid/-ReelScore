import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {socialKineticV28Html} from '../../worker/src/social-kinetic-v28-engine.js';
function capture(events){
 const html=socialKineticV28Html({model:'social_kinetic_v28',status:'staging_renderable',durationMs:2000,events},{width:910,height:512});
 const calls=[],tl={fromTo(selector,from,to,start){calls.push({selector,to,start});return tl;},to(selector,to,start){calls.push({selector,to,start});return tl;}};
 const script=html.match(/<script>const tl=[\s\S]+?<\/script>/)[0].slice(8,-9);
 vm.runInNewContext(script,{gsap:{timeline:()=>tl},window:{}});return calls;
}
const rect={x:.1,y:.7,w:.8,h:.2};
test('V28 fast speech fades finish inside word durations; the last word stays visible until its release',()=>{
 const words=[{text:'un',outputStartMs:100,outputEndMs:120},{text:'mot',outputStartMs:120,outputEndMs:200}];
 const calls=capture([{kind:'caption',startMs:100,endMs:200,rect,words}]);
 const word=calls.find(c=>c.selector==='#w0_0');assert.equal(word.to.duration,0);
 const leave=calls.find(c=>c.selector==='#i0'&&c.to.opacity===0);
 assert.ok(leave.start>=.18);assert.ok(leave.start+leave.to.duration<=.200001);
});
test('V28 a single short word no longer persists past the next caption',()=>{
 const calls=capture([{kind:'caption',startMs:100,endMs:120,rect,words:[{text:'oui',outputStartMs:100,outputEndMs:120}]}]);
 const leave=calls.find(c=>c.selector==='#i0'&&c.to.opacity===0);assert.ok(leave.start+leave.to.duration<=.120001);
});
test('V28 existing bubble entrance and exit stay unchanged',()=>{
 const calls=capture([{kind:'bubble',text:'Test',startMs:100,endMs:1300,rect}]);
 assert.equal(calls[0].to.duration,.19);assert.equal(calls[1].to.duration,.14);assert.equal(calls[1].start,1.145);
});

test('V28 Chromium actually displays a one-frame word and clears it at the timed boundary',async()=>{
 const {chromium}=await import('playwright-core');
 const {createRequire}=await import('node:module');const {readFile}=await import('node:fs/promises');
 const require=createRequire(import.meta.url),gsap=await readFile(require.resolve('gsap/dist/gsap.min.js'),'utf8');
 const words=[{text:'oui',outputStartMs:100,outputEndMs:120}];
 const html=socialKineticV28Html({model:'social_kinetic_v28',status:'staging_renderable',durationMs:1000,events:[{kind:'caption',startMs:100,endMs:120,rect,words}]},{width:910,height:512}).replace(/<script src="https:[^"]+"><\/script>/,()=>'<script>'+gsap.replace(/<\/script/gi,'<\\/script')+'</script>');
 const browser=await chromium.launch({headless:true,executablePath:process.env.SOCIALPLUS_CHROMIUM||'/usr/bin/chromium',args:['--disable-dev-shm-usage']});
 try{
  const page=await browser.newPage();await page.route('**/*',route=>route.abort());await page.setContent(html);
  const opacity=async t=>page.evaluate(t=>{window.__timelines['editplus-social-kinetic-v28-native'].seek(t,false);return Number(getComputedStyle(document.querySelector('#i0')).opacity)*Number(getComputedStyle(document.querySelector('#w0_0')).opacity);},t);
  assert.equal(await opacity(.1),1);assert.equal(await opacity(.12),0);
 }finally{await browser.close();}
});

test('portrait adapter keeps a readable bubble fitted to its text rather than stretching a thin bar',async()=>{
 const {kineticPortraitStyles}=await import('./kinetic-capture.mjs');
 const {chromium}=await import('playwright-core');
 const meta={width:512,height:910};
 assert.equal(kineticPortraitStyles({width:910,height:512}),'');
 const html=socialKineticV28Html({model:'social_kinetic_v28',status:'staging_renderable',durationMs:1000,events:[{kind:'bubble',text:'Convaincre',startMs:0,endMs:900,rect:{x:.08,y:.055,w:.84,h:.2}}]},meta).replace('</style>',kineticPortraitStyles(meta)+'</style>').replace(/<script[\s\S]*?<\/script>/g,'');
 const browser=await chromium.launch({headless:true,executablePath:process.env.SOCIALPLUS_CHROMIUM||'/usr/bin/chromium',args:['--disable-dev-shm-usage']});
 try{
  const page=await browser.newPage({viewport:meta});await page.setContent(html);
  const sizes=await page.locator('.bubble .inner').evaluate(el=>({font:parseFloat(getComputedStyle(el).fontSize),width:el.offsetWidth,available:el.parentElement.offsetWidth,height:el.offsetHeight}));
  assert.ok(sizes.font>=22);assert.ok(sizes.width<sizes.available*.9);assert.ok(sizes.width<=sizes.available);assert.ok(sizes.height>sizes.font);
 }finally{await browser.close();}
});
