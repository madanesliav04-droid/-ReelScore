import {test,expect} from '@playwright/test';
// UI contract only: synthetic browser session, never a live render or upload.
test('explicit isolated beta starts on Alex and disables every other model',async({page})=>{
 test.skip(process.env.NEXT_PUBLIC_SOCIALPLUS_ALEX_ONLY!=='true','Requires explicit beta-mode test environment');
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL!;
 const key='sb-'+new URL(url).hostname.split('.')[0]+'-auth-token';
 await page.addInitScript(({key})=>{
  const owner='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';const exp=Math.floor(Date.now()/1000)+3600;
  const token='eyJhbGciOiJIUzI1NiJ9.'+btoa(JSON.stringify({sub:owner,exp}))+'.unit';
  localStorage.setItem(key,JSON.stringify({access_token:token,refresh_token:'unit',expires_at:exp,expires_in:3600,token_type:'bearer',user:{id:owner,email:'unit@example.invalid',aud:'authenticated',role:'authenticated'}}));
 },{key});
 await page.route('**/api/**',route=>route.fulfill({json:{quota:{used:0,limit:20,remaining:20},media:[]}}));
 await page.goto('/dashboard?tool=edit');
 const alex=page.locator('button[data-model=hormozi_omni]');await expect(alex).toBeEnabled();await expect(alex).toHaveClass(/selected/);
 const others=page.locator('button[data-model]:not([data-model=hormozi_omni])');
 expect(await others.count()).toBeGreaterThanOrEqual(5);
 for(const button of await others.all())await expect(button).toBeDisabled();
});
