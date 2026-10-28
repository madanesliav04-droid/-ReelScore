import {test,expect} from '@playwright/test';
import {measureAudio} from '../lib/local-video-analysis';
import {mkdtemp,rm,readFile} from 'node:fs/promises';import {tmpdir} from 'node:os';import path from 'node:path';
import {execFileSync} from 'node:child_process';
let directory:string,fixture:string;
test.beforeAll(async()=>{
 directory=await mkdtemp(path.join(tmpdir(),'socialplus-local-check-'));fixture=path.join(directory,'authorized-synthetic.mp4');
 execFileSync('ffmpeg',['-v','error','-f','lavfi','-i','color=c=blue:s=320x180:r=25:d=2','-f','lavfi','-i','sine=frequency=440:sample_rate=16000:duration=2','-af',"volume='if(between(t,0.6,1.1),0,0.3)':eval=frame",'-c:v','libx264','-pix_fmt','yuv420p','-c:a','aac','-movflags','+faststart',fixture]);
});
test.afterAll(async()=>{await rm(directory,{recursive:true,force:true})});
test('same PCM produces identical measured windows; quiet audio is not an invented editorial score',()=>{
 const data=new Float32Array(2000);data.fill(.5,0,500);data.fill(.5,1000);
 const a=measureAudio([data],1000),b=measureAudio([data],1000);expect(a).toEqual(b);
 expect(a.windows).toEqual([{start:.5,end:1}]);expect(a.silenceRatio).toBe(.25);expect(a.peakDb).toBeCloseTo(-6.021,2);
 expect(measureAudio([new Float32Array(1000)],1000).peakDb).toBeNull();
 expect(()=>measureAudio([new Float32Array([NaN])],1000)).toThrow();
});
test('real MP4 import, playback metadata, local audio decode, timestamps and JSON download without server upload',async({page})=>{
 const uploads:string[]=[];page.on('request',r=>{if(['POST','PUT'].includes(r.method())||r.url().includes('/api/'))uploads.push(r.method())});
 await page.setViewportSize({width:390,height:844});await page.goto('/analyse-locale');
 await page.getByLabel('Importer une vidéo pour analyse locale').setInputFiles(fixture);
 await expect(page.getByRole('status')).toContainText('Vidéo chargée');
 await page.getByRole('button',{name:'Analyser les caractéristiques',exact:true}).click();
 await expect(page.getByRole('status')).toContainText('Vérification terminée');
 await expect(page.getByText('320 × 180',{exact:true})).toBeVisible();
 await expect(page.getByText('Horizontal',{exact:true})).toBeVisible();
 await expect(page.getByText(/Mesuré sur la piste décodée/)).toBeVisible();
 expect(await page.locator('video').evaluate((v:HTMLVideoElement)=>v.readyState)).toBeGreaterThanOrEqual(1);
 await page.locator('video').evaluate(async(v:HTMLVideoElement)=>{v.muted=true;await v.play()});
 await expect.poll(()=>page.locator('video').evaluate((v:HTMLVideoElement)=>v.currentTime)).toBeGreaterThan(.1);
 const downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:'Télécharger le rapport JSON'}).click();
 const download=await downloadPromise;const report=JSON.parse(await readFile((await download.path())!,'utf8'));
 expect(report.width).toBe(320);expect(report.duration).toBeCloseTo(2,1);expect(report.audio).not.toBeNull();expect(report.audio.windows.length).toBeGreaterThan(0);
 expect(report.limits.join(' ')).toContain('Aucun score éditorial');expect(uploads).toEqual([]);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
 await page.getByRole('button',{name:'Retirer',exact:true}).click();await expect(page.locator('video')).toHaveCount(0);await expect(page.getByRole('region',{name:'Résultat de l’analyse technique'})).toHaveCount(0);
});
test('file validation rejects an empty MOV without claiming upload success',async({page})=>{
 await page.goto('/analyse-locale');await page.getByLabel('Importer une vidéo pour analyse locale').setInputFiles({name:'empty.mov',mimeType:'video/quicktime',buffer:Buffer.alloc(0)});
 await expect(page.getByRole('alert').filter({hasText:'Ce fichier est vide'})).toContainText('vide');await expect(page.locator('video')).toHaveCount(0);
});
