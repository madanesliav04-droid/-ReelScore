import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,rm,access} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

async function run(publicBucket){
  const dir=await mkdtemp(path.join(os.tmpdir(),'socialplus-r2-config-test-'));
  try{
    const mock=path.join(dir,'mock.mjs'),output=path.join(dir,'capabilities.json');
    await writeFile(mock,`globalThis.fetch=async (url,options)=>{
      if(!String(url).startsWith('https://api.cloudflare.com/')||options.method)throw new Error('Unexpected network mutation');
      let result;
      if(String(url).endsWith('/domains/managed'))result={enabled:${publicBucket}};
      else if(String(url).endsWith('/domains/custom'))result={domains:[]};
      else if(String(url).endsWith('/cors')||String(url).endsWith('/lifecycle'))return new Response('{}',{status:404});
      else result={name:'socialplus-test',storage_class:'Standard',jurisdiction:'default'};
      return Response.json({success:true,result});
    };`);
    const env={...process.env,R2_ACCOUNT_ID:'0123456789abcdef0123456789abcdef',R2_BUCKET_NAME:'socialplus-test',
      CLOUDFLARE_API_TOKEN:'mock-management-token-not-real',R2_ACCESS_KEY_ID:'mock-access-id',R2_SECRET_ACCESS_KEY:'mock-secret-not-real'};
    let code=0;
    try{await promisify(execFile)(process.execPath,['--import',mock,fileURLToPath(new URL('./prepare-r2-transfer.mjs',import.meta.url)),'sign',output],{env});}
    catch(error){code=error.code;}
    if(publicBucket){assert.notEqual(code,0);await assert.rejects(()=>access(output));}
    else{
      assert.equal(code,0);const raw=await readFile(output,'utf8'),value=JSON.parse(raw);
      assert.equal(value.accessesValidated,false);
      assert.equal(Date.parse(value.expiresAt)-Date.parse(value.createdAt),3600000);
      assert(!raw.includes(env.R2_SECRET_ACCESS_KEY));assert(!raw.includes(env.CLOUDFLARE_API_TOKEN));
    }
  }finally{await rm(dir,{recursive:true,force:true});}
}
test('mock public bucket blocks signing without writing capabilities',()=>run(true));
test('mock private configuration can sign but cannot mark live access validated',()=>run(false));
