import {test,expect} from '@playwright/test';
test('disconnected Preview refuses auth and jobs on the actual server, without using production',async({page,request})=>{
 test.skip(process.env.NEXT_PUBLIC_SOCIALPLUS_BACKEND_DISABLED!=='true','Explicit disconnected build only');
 await page.goto('/dashboard');
 await expect(page.getByText(/Le backend de cette prévisualisation n’est pas connecté/)).toBeVisible();
 await expect(page.getByRole('button',{name:'Se connecter',exact:true})).toBeDisabled();
 const auth=await request.post('/api/auth-gateway/token?grant_type=password',{data:{email:'fixture@example.invalid',password:'not-a-real-account'}});
 expect(auth.status()).toBe(503);expect((await auth.json()).code).toBe('BACKEND_NOT_CONFIGURED');
 const jobs=await request.get('/api/viral-edit-jobs/media',{headers:{Authorization:'Bearer fixture'}});
 expect(jobs.status()).toBe(503);expect((await jobs.json()).error).toBe('BACKEND_NOT_CONFIGURED');
 await page.getByRole('link',{name:'Explorer l’interface sans traitement'}).click();
 await expect(page.getByRole('navigation',{name:'Navigation Social+'})).toBeVisible();
});
