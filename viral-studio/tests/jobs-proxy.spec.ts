import {test,expect} from '@playwright/test';
import {proxyJobs} from '../lib/jobs-proxy';
const origin='https://isolated.example.invalid';
const request=(suffix='',auth='Bearer unit')=>new Request('https://social.example/api/viral-edit-jobs/media'+suffix,{headers:{authorization:auth}});
test('real Next route refuses anonymous job access and unknown functions',async({request})=>{
 expect((await request.get('/api/viral-edit-jobs/media')).status()).toBe(401);
 expect((await request.get('/api/not-a-function/media',{headers:{authorization:'Bearer unit'}})).status()).toBe(404);
});
test('jobs proxy preserves query, authentication and no-store without redirects',async()=>{
 let called=false;
 const send:typeof fetch=async(input,init)=>{
  called=true;expect(String(input)).toBe(origin+'/functions/v1/viral-edit-jobs/media?limit=5&cursor=abc');
  expect(init?.cache).toBe('no-store');expect(init?.redirect).toBe('error');
  expect(new Headers(init?.headers).get('authorization')).toBe('Bearer unit');
  return Response.json({media:[]});
 };
 const result=await proxyJobs(request('?limit=5&cursor=abc'),'viral-edit-jobs',['media'],origin,send);
 expect(called).toBe(true);expect(result.status).toBe(200);expect(result.headers.get('cache-control')).toContain('private');
});
test('jobs proxy refuses anonymous and path traversal before upstream',async()=>{
 const send:typeof fetch=async()=>{throw Error('must not call upstream')};
 expect((await proxyJobs(request('',''),'viral-edit-jobs',['media'],origin,send)).status).toBe(401);
 expect((await proxyJobs(request(),'viral-edit-jobs',['..','auth'],origin,send)).status).toBe(404);
 expect((await proxyJobs(request(),'unknown',['media'],origin,send)).status).toBe(404);
});
test('jobs network failure returns actionable error without leaking upstream secrets',async()=>{
 const send:typeof fetch=async()=>{throw Error('private-url-or-token')};
 const response=await proxyJobs(request(),'viral-edit-jobs',['media'],origin,send);
 expect(response.status).toBe(503);expect(await response.text()).not.toContain('private-url-or-token');
});
test('jobs keeps empty deletion responses and retry instructions',async()=>{
 const send:typeof fetch=async()=>new Response(null,{status:204});
 expect((await proxyJobs(request(),'viral-edit-jobs',['media'],origin,send)).status).toBe(204);
 const limited:typeof fetch=async()=>Response.json({error:'LIMIT'},{status:429,headers:{'Retry-After':'30'}});
 const response=await proxyJobs(request(),'viral-edit-jobs',['media'],origin,limited);
 expect(response.status).toBe(429);expect(response.headers.get('retry-after')).toBe('30');
});
