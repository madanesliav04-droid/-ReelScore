import test from 'node:test';import assert from 'node:assert/strict';
import {referenceDirection,referenceKineticHtml} from './kinetic-reference.mjs';
const plan={width:512,height:910,durationMs:4000,referenceWords:[{text:'Une',startMs:0,endMs:200},{text:'solution',startMs:200,endMs:600},{text:'réelle',startMs:800,endMs:1100},{text:'ici',startMs:1400,endMs:1600}],referenceDirection:{layout:{hero:[.08,.04,.84,.15],chat:[.14,.14,.72,.05],captionLeft:[.08,.63,.6,.12],captionRight:[.32,.63,.6,.12]},impacts:[{firstWord:0,accentWord:1,lastWord:1}],bubbles:[{firstWord:2,lastWord:2,stack:0},{firstWord:3,lastWord:3,stack:1}]}};
test('reference direction uses only the new transcript, rejects missing words and unsafe layouts',()=>{
 const p=referenceDirection(plan);assert.equal(p.impacts[0].word,'SOLUTION');assert.equal(p.bubbles[0].label,'RÉELLE');assert.equal(p.impacts[0].accent[0].t,.2);
 assert.throws(()=>referenceDirection({...plan,referenceDirection:{...plan.referenceDirection,impacts:[{firstWord:0,accentWord:1,lastWord:50}]}}),/WORD_RANGE/);
 assert.throws(()=>referenceDirection({...plan,referenceDirection:{...plan.referenceDirection,bubbles:'invented'}}),/DIRECTION_SHAPE/);
 assert.throws(()=>referenceDirection({...plan,referenceDirection:{...plan.referenceDirection,layout:{...plan.referenceDirection.layout,hero:[.8,.1,.4,.2]}}}),/SAFE_RECT/);
});
test('historical composition adapts without old media/timing; browser verifies titles and reflow',async()=>{
 const html=await referenceKineticHtml(plan);assert.ok(!html.includes('OLD_EDL'));assert.ok(!html.includes('IMG_0506'));assert.ok(!html.includes("PAS D'ARGENT"));
 const {chromium}=await import('playwright-core');const {createRequire}=await import('node:module');const {readFile}=await import('node:fs/promises');
 const gsap=await readFile(createRequire(import.meta.url).resolve('gsap/dist/gsap.min.js'),'utf8');
 const browser=await chromium.launch({headless:true,executablePath:'/usr/bin/chromium',args:['--disable-dev-shm-usage']});
 try{const page=await browser.newPage({viewport:{width:512,height:910}}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.route('**/*',r=>r.abort());await page.setContent(html.replace(/<script src="https:[^"]+"><\/script>/,()=>'<script>'+gsap.replace(/<\/script/gi,'<\\/script')+'</script>'));
 const at=async t=>page.evaluate(t=>{window.__timelines['editplus-social-kinetic-v28-native'].seek(t,false);return [...document.querySelectorAll('.hero,.chat')].map(e=>({id:e.id,text:e.textContent,y:e.getBoundingClientRect().y,opacity:+getComputedStyle(e).opacity}));},t);
 const early=await at(.1);assert.equal(early.find(e=>e.id==='hero0').text,'UNE SOLUTION ');
 const before=await at(1.05),after=await at(1.5);assert.ok(after.find(e=>e.id==='bubble0').y<before.find(e=>e.id==='bubble0').y);assert.deepEqual(errors,[]);
 }finally{await browser.close();}
});
