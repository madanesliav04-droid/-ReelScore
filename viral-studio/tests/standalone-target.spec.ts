import {test,expect} from '@playwright/test';import {standaloneTarget} from '../lib/standalone-target';
test('connected studio requires explicit verified HTTPS origin without credentials or token-bearing paths',()=>{
 expect(standaloneTarget('https://isolated.example.invalid','true')).toBe('https://isolated.example.invalid');
 for(const value of ['http://isolated.example.invalid','https://user:secret@isolated.example.invalid','https://isolated.example.invalid/?token=secret','https://isolated.example.invalid/private','https://project.supabase.co'])expect(standaloneTarget(value,'true')).toBeNull();
 expect(standaloneTarget('https://isolated.example.invalid','false')).toBeNull();
});
test('unconfigured cloud studio does not pretend to accept videos',async({page})=>{
 await page.goto('/studio');await expect(page.getByRole('status')).toContainText('Aucun serveur isolé vérifié');await expect(page.locator('input[type=file]')).toHaveCount(0);
});
