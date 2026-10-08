import {test,expect,Page} from '@playwright/test';
// Contract regression tests: responses are deliberately stubbed, never production QA.
const owner='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const other='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const key=`viral-studio-active-job:${owner}`;
async function setup(page:Page,jobOwner=owner){
  await page.addInitScript(({owner,jobOwner})=>{
    const token='eyJhbGciOiJIUzI1NiJ9.'+btoa(JSON.stringify({sub:owner,exp:Math.floor(Date.now()/1000)+3600}))+'.test';
    localStorage.setItem('sb-eiypztjpmxdiuaqxjuqx-auth-token',JSON.stringify({access_token:token,refresh_token:'test-only',expires_at:Math.floor(Date.now()/1000)+3600,expires_in:3600,token_type:'bearer',user:{id:owner,email:'qa@example.invalid',aud:'authenticated',role:'authenticated'}}));
    localStorage.setItem(`viral-studio-active-job:${jobOwner}`,JSON.stringify({id:'job-qa',channel:'core',module:'edit'}));
  },{owner,jobOwner});
  await page.route('**/auth/v1/**',r=>r.fulfill({json:{id:owner,email:'qa@example.invalid'}}));
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
  await expect(page.getByRole('heading',{name:'What are we creating today?'})).toBeVisible();
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
  await expect(page.getByRole('link',{name:'Open MP4 ↗'})).toBeVisible({timeout:12000});
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
  await expect(page.getByRole('heading',{name:'Welcome back.'})).toBeVisible();
  expect(await page.evaluate(k=>localStorage.getItem(k),key)).not.toBeNull();
  await expect(page.getByRole('button',{name:'Sign in',exact:true})).toBeEnabled();
  expect(requests).toBe(1);
});
test('resumed upload registers original storage object and locks concurrent uploads',async({page})=>{
  await setup(page,other);
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
  await expect(page.getByRole('heading',{name:'What are we creating today?'})).toBeVisible();
  await page.locator('input[type=file]').first().evaluate((element,{owner,original})=>{
    const file=new File(['12345678'],'source.mov',{type:'video/quicktime',lastModified:123});
    const fingerprint=JSON.stringify(['viral-studio-v2',owner,file.name,file.size,file.lastModified]);
    localStorage.setItem(`tus::${fingerprint}::1`,JSON.stringify({size:8,metadata:{bucketName:'viralplus-videos',objectName:original,contentType:'video/quicktime'},creationTime:new Date().toISOString(),uploadUrl:'https://eiypztjpmxdiuaqxjuqx.storage.supabase.co/storage/v1/upload/resumable/qa'}));
    const data=new DataTransfer();data.items.add(file);(element as HTMLInputElement).files=data.files;element.dispatchEvent(new Event('change',{bubbles:true}));
  },{owner,original});
  await expect.poll(()=>Boolean(patchResolve)).toBe(true);
  await expect(page.locator('input[type=file]').first()).toBeDisabled();
  patchResolve!();
  await expect(page.getByRole('button',{name:'Analyze video',exact:true})).toBeEnabled();
  expect(registered).toBe(original);
});
