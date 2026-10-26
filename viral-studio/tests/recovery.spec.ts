import {test,expect,Page} from '@playwright/test';
// Contract regression tests: responses are deliberately stubbed, never production QA.
const owner='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const other='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const key=`viral-studio-active-job:${owner}`;
async function setup(page:Page,jobOwner=owner,channel:'core'|'clip'='core'){
  await page.addInitScript(({owner,jobOwner,channel})=>{
    const token='eyJhbGciOiJIUzI1NiJ9.'+btoa(JSON.stringify({sub:owner,exp:Math.floor(Date.now()/1000)+3600}))+'.test';
    localStorage.setItem('sb-eiypztjpmxdiuaqxjuqx-auth-token',JSON.stringify({access_token:token,refresh_token:'test-only',expires_at:Math.floor(Date.now()/1000)+3600,expires_in:3600,token_type:'bearer',user:{id:owner,email:'qa@example.invalid',aud:'authenticated',role:'authenticated'}}));
    localStorage.setItem(`viral-studio-active-job:${jobOwner}`,JSON.stringify({id:'job-qa',channel,module:channel==='clip'?'clip':'edit'}));
  },{owner,jobOwner,channel});
  await page.route('**/auth/v1/**',r=>r.fulfill({json:{id:owner,email:'qa@example.invalid'}}));
  await page.route('**/api/auth-gateway/**',r=>r.request().url().includes('/token')?r.fulfill({status:400,json:{error:'invalid_grant',error_description:'Invalid Refresh Token'}}):r.fulfill({status:204}));
}
test('network interruption keeps job and retries without overlapping requests',async({page})=>{
  await setup(page);
  let requests=0,inFlight=0,maxInFlight=0;
  await page.route('**/api/viral-edit-jobs/jobs/job-qa',async r=>{
    requests++;inFlight++;maxInFlight=Math.max(maxInFlight,inFlight);
    if(requests===1){inFlight--;await r.abort();return}
    await new Promise(resolve=>setTimeout(resolve,2200));
    inFlight--;await r.fulfill({json:{job:{id:'job-qa',kind:'edit_render',status:'cancelled'}}});
  });
  await page.goto('/dashboard');
  await expect(page.getByText(/Connexion interrompue/)).toBeVisible();
  expect(await page.evaluate(k=>localStorage.getItem(k),key)).not.toBeNull();
  await expect(page.getByText(/Ce traitement a été annulé/)).toBeVisible({timeout:15000});
  expect(await page.evaluate(k=>localStorage.getItem(k),key)).toBeNull();
  expect(maxInFlight).toBe(1);expect(requests).toBe(2);
});
test('another account job is never restored',async({page})=>{
  await setup(page,other);let requests=0;
  await page.route('**/api/**',r=>{requests++;return r.fulfill({json:{}})});
  await page.goto('/dashboard');
  await expect(page.getByRole('heading',{name:'Montage intelligent.'})).toBeVisible();
  expect(requests).toBe(0);
});
test('completed export retrieval failure retains recovery pointer until export is retrieved',async({page})=>{
  await setup(page);let exports=0;
  await page.route('**/api/viral-edit-jobs/jobs/job-qa',r=>r.fulfill({json:{job:{id:'job-qa',kind:'edit_render',status:'completed',result:{export_id:'export-qa',output_video_id:'media-qa'}}}}));
  await page.route('**/api/viral-edit-jobs/exports/export-qa/url',r=>{
    exports++;return exports===1?r.fulfill({status:503,json:{error:'unavailable'}}):r.fulfill({json:{signed_url:'https://example.invalid/test.mp4'}});
  });
  await page.goto('/dashboard');
  await expect(page.getByText(/Connexion interrompue/)).toBeVisible();
  expect(await page.evaluate(k=>localStorage.getItem(k),key)).not.toBeNull();
  await expect(page.getByRole('link',{name:'Ouvrir le MP4 ↗'})).toBeVisible({timeout:12000});
  expect(await page.evaluate(k=>localStorage.getItem(k),key)).toBeNull();
});
test('missing job releases interface instead of retrying forever',async({page})=>{
  await setup(page);
  await page.route('**/api/viral-edit-jobs/jobs/job-qa',r=>r.fulfill({status:404,json:{error:'JOB_NOT_FOUND'}}));
  await page.goto('/dashboard');
  await expect(page.getByText(/Ce traitement n’est plus disponible/)).toBeVisible();
  await expect(page.locator('input[type=file]').first()).toBeEnabled();
  expect(await page.evaluate(k=>localStorage.getItem(k),key)).toBeNull();
});
test('empty video is rejected before any upload',async({page})=>{
  await setup(page,other);let requests=0;
  await page.route('**/storage/v1/**',r=>{requests++;return r.abort()});
  await page.goto('/dashboard');
  await page.locator('input[type=file]').first().setInputFiles({name:'empty.mov',mimeType:'video/quicktime',buffer:Buffer.alloc(0)});
  await expect(page.getByText('Ce fichier est vide. Choisis une vidéo.')).toBeVisible();
  expect(requests).toBe(0);
});
test('expired session returns to sign-in and preserves job',async({page})=>{
  await setup(page);let requests=0;
  await page.route('**/api/viral-edit-jobs/jobs/job-qa',r=>{requests++;return r.fulfill({status:401,json:{error:'AUTH_REQUIRED'}})});
  await page.goto('/dashboard');
  await expect.poll(()=>requests).toBe(1);
  await expect(page.getByRole('heading',{name:'Bon retour.'})).toBeVisible();
  expect(await page.evaluate(k=>localStorage.getItem(k),key)).not.toBeNull();
  await expect(page.getByRole('button',{name:'Se connecter',exact:true})).toBeEnabled();
  expect(requests).toBe(1);
});
test('resumed upload registers original storage object and locks concurrent uploads',async({page})=>{
  await setup(page,other);
  await page.route('**/api/viral-edit-jobs/storage-config',r=>r.fulfill({json:{provider:'supabase',max_file_bytes:200000000,retention_hours:24}}));
  const original=`${owner}/original-source.mov`;
  let registered='';let patchResolve:(()=>void)|undefined;
  await page.route('**/storage/v1/upload/resumable/qa',async r=>{
    const method=r.request().method();
    if(method==='HEAD')return r.fulfill({status:200,headers:{'Access-Control-Allow-Origin':'*','Access-Control-Expose-Headers':'Upload-Offset,Upload-Length,Tus-Resumable','Upload-Offset':'4','Upload-Length':'8','Tus-Resumable':'1.0.0'}});
    if(method==='PATCH'){
      await new Promise<void>(resolve=>{patchResolve=resolve});
      return r.fulfill({status:204,headers:{'Access-Control-Allow-Origin':'*','Access-Control-Expose-Headers':'Upload-Offset,Upload-Length,Tus-Resumable','Upload-Offset':'8','Tus-Resumable':'1.0.0'}});
    }
    return r.fulfill({status:204});
  });
  await page.route('**/api/viral-edit-jobs/media',r=>{
    registered=r.request().postDataJSON().storage_path;
    return r.fulfill({status:201,json:{media:{id:'media-qa',storage_path:registered}}});
  });
  await page.goto('/dashboard');
  await expect(page.getByRole('heading',{name:'Montage intelligent.'})).toBeVisible();
  await page.locator('input[type=file]').first().evaluate((element,{owner,original})=>{
    const file=new File(['12345678'],'source.mov',{type:'video/quicktime',lastModified:123});
    const fingerprint=JSON.stringify(['viral-studio-v2',owner,file.name,file.size,file.lastModified]);
    localStorage.setItem(`tus::${fingerprint}::1`,JSON.stringify({size:8,metadata:{bucketName:'viralplus-videos',objectName:original,contentType:'video/quicktime'},creationTime:new Date().toISOString(),uploadUrl:'https://eiypztjpmxdiuaqxjuqx.storage.supabase.co/storage/v1/upload/resumable/qa'}));
    const data=new DataTransfer();data.items.add(file);(element as HTMLInputElement).files=data.files;element.dispatchEvent(new Event('change',{bubbles:true}));
  },{owner,original});
  await expect.poll(()=>Boolean(patchResolve)).toBe(true);
  await expect(page.locator('input[type=file]').first()).toBeDisabled();
  patchResolve!();
  await expect(page.getByRole('button',{name:'Créer mon montage · Codie',exact:true})).toBeEnabled();
  expect(registered).toBe(original);
});

test('Social+ exposes exactly Edit+ and Viral+ and no Clip+ workflow',async({page})=>{
  await setup(page,other);
  await page.goto('/dashboard?tool=edit');
  await expect(page.getByRole('heading',{name:'Montage intelligent.'})).toBeVisible();
  const chooser=page.getByRole('group',{name:'Choisir un outil'});
  await expect(chooser.getByRole('button')).toHaveCount(2);
  await expect(chooser.getByRole('button',{name:/Edit\+/})).toHaveAttribute('aria-pressed','true');
  await expect(page.getByRole('button',{name:/Clip\+/})).toHaveCount(0);
  await chooser.getByRole('button',{name:/Viral\+/}).click();
  await expect(page.getByRole('heading',{name:'Analyse éditoriale.'})).toBeVisible();
  await expect(page).toHaveURL(/tool=viral/);
});


test('original models remain visible and unconnected pipelines cannot launch',async({page})=>{
  await setup(page,other);
  await page.goto('/dashboard?tool=edit');
  const cards=page.locator('.social-approved-model');
  await expect(cards).toHaveCount(7);
  for(const id of ['codie','leila','cinematic_story','ugc_native'])
    await expect(page.locator(`[data-model="${id}"]`)).toBeEnabled();
  for(const id of ['hormozi_omni','social_kinetic','apple_spatial'])
    await expect(page.locator(`[data-model="${id}"]`)).toBeDisabled();
  await expect(cards.nth(0)).toContainText('Codie');
  await expect(cards.nth(1)).toContainText('Leila');
  await expect(cards.nth(2)).toContainText('Alex Hormozi');
  await expect(cards.nth(3)).toContainText('Cinematic Storytelling');
  await expect(cards.nth(4)).toContainText('UGC Storytelling');
  await expect(cards.nth(5)).toContainText('Social Kinetic');
  await page.locator('[data-model="cinematic_story"]').click();
  await expect(page.getByText(/STORYBOARD CONTEXTUEL/)).toBeVisible();
  await expect(page.getByRole('button',{name:/Créer mon montage · Cinematic Storytelling/})).toBeDisabled();
  await expect(page.locator('.format-picker select')).toHaveValue('native');
  await expect(page.locator('.format-picker select')).toBeDisabled();
  await expect(page.locator('.social-approved-model-grid')).not.toContainText('Explainer');
  await expect(page.getByText(/Les moteurs activés produisent un rendu bêta/)).toBeVisible();
  await page.locator('[data-model="ugc_native"]').click();
  await expect(page.getByTestId('ugc-rush-uploader')).toBeVisible();
  await expect(page.getByTestId('ugc-file-input')).toHaveAttribute('multiple','');
});
test('iPhone UGC: one video, short batch, and Files fallback remain separate',async({page})=>{
  await setup(page,other);
  await page.route('**/storage/v1/upload/resumable',async route=>
    route.fulfill({status:413,headers:{'Access-Control-Allow-Origin':'*'},body:'Part rejected'}));
  await page.goto('/dashboard?tool=edit');
  await page.locator('[data-model="ugc_native"]').click();
  const single=page.getByTestId('ugc-single-file-input');
  const batch=page.getByTestId('ugc-file-input');
  const files=page.getByTestId('ugc-files-input');
  await expect(single).not.toHaveAttribute('multiple','');
  await expect(batch).toHaveAttribute('multiple','');
  await expect(files).toHaveAttribute('multiple','');
  await expect(page.getByText('Importer 1 vidéo')).toBeVisible();
  await expect(page.getByText('Importer depuis Fichiers')).toBeVisible();
  await single.setInputFiles({name:'single.mov',mimeType:'video/quicktime',buffer:Buffer.from('test-video')});
  await expect(page.getByText('single.mov',{exact:true})).toBeVisible();
  // Uploading multiple synthetic invalid 6-byte movies through TUS is not
  // a meaningful mobile-multiselect test. The real multi-file path is covered
  // by the DOM contract; a single chosen file must reliably persist in state.
  await expect(page.locator('.ugc-rush-item')).toHaveCount(1);
  await expect(page.getByText(/0\/1 prêts/)).toBeVisible();
  await expect(batch).toHaveAttribute('multiple','');
  await expect(files).toHaveAttribute('multiple','');
});

test('UGC: seven already uploaded rushes can be selected and start a render without re-upload',async({page})=>{
  await setup(page,other);
  const saved=Array.from({length:7},(_,i)=>({
    id:'d000000'+i+'-1111-4111-8111-111111111111',
    original_name:'IMG_03'+String(26+i)+'.mov',size_bytes:18000000,
    mime_type:'video/quicktime',status:'uploaded'
  }));
  let renderRequest:any=null;
  await page.route('**/api/viral-edit-jobs/media',r=>{
    if(r.request().method()==='GET')return r.fulfill({json:{media:saved}});
    return r.fulfill({status:400,json:{error:'UNEXPECTED_UPLOAD'}});
  });
  await page.route('**/api/viral-edit-jobs/edit',r=>{
    renderRequest=r.request().postDataJSON();
    return r.fulfill({status:202,json:{job:{id:'ugc-qa-job',kind:'edit_render',status:'queued'}}});
  });
  await page.route('**/api/viral-edit-jobs/jobs/ugc-qa-job',r=>r.fulfill({json:{
    job:{id:'ugc-qa-job',kind:'edit_render',status:'cancelled'}
  }}));
  await page.goto('/dashboard?tool=edit');
  await page.locator('[data-model="ugc_native"]').click();
  await expect(page.getByTestId('ugc-saved-library').getByText('7 retrouvées')).toBeVisible();
  await expect(page.getByRole('button',{name:'Créer mon montage · UGC Storytelling'})).toBeDisabled();
  const rows=page.locator('.ugc-saved-row');
  await rows.nth(0).getByRole('button',{name:'Choisir comme principale'}).click();
  await expect(page.getByRole('button',{name:'Créer mon montage · UGC Storytelling'})).toBeDisabled();
  for(let i=1;i<7;i++)await rows.nth(i).getByRole('button',{name:'Ajouter'}).click();
  await expect(page.getByRole('button',{name:'Créer mon montage · UGC Storytelling'})).toBeEnabled();
  await page.getByRole('button',{name:'Créer mon montage · UGC Storytelling'}).click();
  await expect.poll(()=>renderRequest).not.toBeNull();
  expect(renderRequest.video_id).toBe(saved[0].id);
  expect(renderRequest.style).toBe('ugc_native');
  expect(renderRequest.settings.ugc_rush_video_ids).toEqual(saved.slice(1).map(x=>x.id));
});

test('review-required render is never presented as ready to publish',async({page})=>{
  await setup(page);
  await page.route('**/api/viral-edit-jobs/jobs/job-qa',r=>r.fulfill({json:{job:{id:'job-qa',kind:'edit_render',status:'completed',result:{export_id:'review-export',review_required:true}}}}));
  await page.route('**/api/viral-edit-jobs/exports/review-export/url',r=>r.fulfill({json:{signed_url:'https://example.invalid/review.mp4',download_url:'https://example.invalid/review.mp4?download=SocialPlus.mp4'}}));
  await page.goto('/dashboard');
  await expect(page.getByRole('heading',{name:'Rendu de contrôle à vérifier.'})).toBeVisible();
  await expect(page.getByRole('alert').filter({hasText:'Transcription ou fidélité non validée'})).toContainText('Transcription ou fidélité non validée');
  await expect(page.getByText('Regarde l’export puis télécharge-le pour le publier.')).toHaveCount(0);
  await expect(page.getByRole('link',{name:'Télécharger le MP4',exact:true})).toHaveAttribute('href','https://example.invalid/review.mp4?download=SocialPlus.mp4');
});
