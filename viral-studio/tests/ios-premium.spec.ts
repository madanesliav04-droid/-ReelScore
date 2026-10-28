import {test,expect} from '@playwright/test';

for(const width of [320,390,1440])test(`read-only real frontend at ${width}px has safe tabs, six retained models and no simulated data`,async({page},testInfo)=>{
 await page.setViewportSize({width,height:844});
 const calls:string[]=[];page.on('request',r=>{if(r.url().includes('/api/')||r.url().includes('supabase.co'))calls.push(r.url())});
 await page.goto('/apercu');
 await expect(page.getByText(/Aperçu de l’interface/)).toBeVisible();
 const nav=page.getByRole('navigation',{name:'Navigation Social+'});
 await expect(nav.getByRole('button')).toHaveCount(4);
 for(const button of await nav.getByRole('button').all()){
  const box=await button.boundingBox();expect(box!.height).toBeGreaterThanOrEqual(44);expect(box!.width).toBeGreaterThanOrEqual(44);
 }
 await expect(page.locator('.social-approved-model')).toHaveCount(6);
 await expect(page.getByRole('button',{name:/Créer mon montage/})).toBeDisabled();
 expect(await page.locator('.upload-zone input').isDisabled()).toBe(true);
 await nav.getByRole('button',{name:'Analyse',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Analyse éditoriale.'})).toBeVisible();
 await expect(page.getByRole('button',{name:'Analyser ma vidéo',exact:true})).toBeDisabled();
 await nav.getByRole('button',{name:'Historique',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Historique',exact:true})).toBeVisible();
 await expect(page.getByText(/Aucun historique fictif/)).toBeVisible();
 await nav.getByRole('button',{name:'Profil',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Profil',exact:true})).toBeVisible();
 await expect(page.getByRole('link',{name:/Questions fréquentes/})).toBeVisible();
 await nav.getByRole('button',{name:'Montage',exact:true}).click();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
 await expect(page.locator('body')).not.toContainText(/Viral\+|Edit\+|Clip\+/);
 expect(calls).toEqual([]);
 if(width===390)await page.screenshot({path:testInfo.outputPath('ios-390.png'),fullPage:true});
});

test('support pages state real limitations and contain no invented legal identity',async({page})=>{
 await page.goto('/faq');await expect(page.getByRole('heading',{name:'Questions fréquentes'})).toBeVisible();
 await page.getByText('Puis-je utiliser mon iPhone ?', {exact:true}).click();
 await expect(page.getByText(/appareil physique reste à effectuer/)).toBeVisible();
 await page.goto('/confidentialite');await expect(page.getByText(/restent à compléter/)).toBeVisible();
});

test('completed job without an accessible export never announces an available result',async({page})=>{
 await page.addInitScript(()=>{
  const owner='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',exp=Math.floor(Date.now()/1000)+3600;
  localStorage.setItem('sb-eiypztjpmxdiuaqxjuqx-auth-token',JSON.stringify({access_token:'eyJhbGciOiJIUzI1NiJ9.'+btoa(JSON.stringify({sub:owner,exp}))+'.unit',refresh_token:'unit',expires_at:exp,token_type:'bearer',user:{id:owner,email:'unit@example.invalid'}}));
  localStorage.setItem(`viral-studio-active-job:${owner}`,JSON.stringify({id:'missing-export',channel:'core',module:'edit'}));
 });
 await page.route('**/api/viral-edit-jobs/jobs/missing-export',r=>r.fulfill({json:{job:{id:'missing-export',kind:'edit_render',status:'completed',progress:100,result:{export_id:'gone'}}}}));
 await page.route('**/api/viral-edit-jobs/exports/gone/url',r=>r.fulfill({status:503,json:{error:'EXPORT_NOT_AVAILABLE'}}));
 await page.goto('/dashboard');
 await expect(page.getByText('Vérification du résultat',{exact:true})).toBeVisible();
 await expect(page.getByText('Résultat disponible',{exact:true})).toHaveCount(0);
 await expect(page.locator('.result-video')).toHaveCount(0);
});
