import test from 'node:test';
import assert from 'node:assert/strict';
import {createApiClient} from '../public/api-client.js';
test('API adapter fixes same-origin session policy and discards responses from an ended session',async()=>{
 const previous=globalThis.fetch;const state={user:{id:'alice'},csrf:'test',abortController:new AbortController()};let sent,resolve;
 const api=createApiClient(()=>state);
 try{
  globalThis.fetch=async(path,options)=>{sent={path,options};return {ok:true,json:async()=>({saved:true})};};
  assert.deepEqual(await api('/api/projects',{credentials:'omit'}),{saved:true});assert.equal(sent.options.credentials,'same-origin');assert.equal(sent.options.headers['X-CSRF-Token'],'test');
  await assert.rejects(api('https://outside.example/api/projects'),/local/);
  globalThis.fetch=()=>new Promise(r=>{resolve=r;});const pending=api('/api/projects');state.abortController=new AbortController();resolve({ok:true,json:async()=>({private:true})});await assert.rejects(pending,{code:'SESSION_CHANGED'});
 }finally{globalThis.fetch=previous;}
});
