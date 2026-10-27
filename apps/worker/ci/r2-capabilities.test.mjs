import test from 'node:test';
import assert from 'node:assert/strict';
import {r2Presign} from '../src/r2-sign.js';
import {validateManifest} from './r2-capabilities.mjs';
const now=new Date('2026-10-27T12:00:00Z');
async function fixture(){
  const cfg={accountId:'0123456789abcdef0123456789abcdef',bucket:'socialplus-test',accessKeyId:'fake-key-id',secretAccessKey:'fake-test-secret'};
  const prefix='socialplus-ci/11111111-1111-4111-8111-111111111111',urls={};
  for(const [role,method,file] of [['sourceGet','GET','source.mov'],['resultPut','PUT','alex.mp4'],['resultGet','GET','alex.mp4'],['proofsPut','PUT','proofs.zip'],['proofsGet','GET','proofs.zip']])
    urls[role]=await r2Presign(cfg,method,prefix+'/'+file,3600,now);
  return {version:1,privacyVerified:true,accessesValidated:true,createdAt:now.toISOString(),expiresAt:new Date(now.getTime()+3600000).toISOString(),accountId:cfg.accountId,bucket:cfg.bucket,prefix,sourceBytes:100,sourceSha256:'a'.repeat(64),urls};
}
test('capabilities are scoped to exact objects and one hour',async()=>{
  const value=await fixture();assert.equal(validateManifest(value,now),value);
  assert.notEqual(value.urls.resultGet,value.urls.resultPut,'GET and PUT have different signatures');
});
test('unvalidated storage access cannot start a render',async()=>{
  const value=await fixture();value.accessesValidated=false;
  assert.throws(()=>validateManifest(value,now),/ACCESS_VALIDATION_REQUIRED/);
});
test('public or unchecked bucket cannot start a render',async()=>{
  const value=await fixture();value.privacyVerified=false;
  assert.throws(()=>validateManifest(value,now),/PRIVATE_VERIFICATION_REQUIRED/);
});
test('another object or host cannot replace the authorized file',async()=>{
  for(const replace of [url=>url.replace('/source.mov','/other.mov'),url=>url.replace('.r2.cloudflarestorage.com','.example.com')]){
    const value=await fixture();value.urls.sourceGet=replace(value.urls.sourceGet);
    assert.throws(()=>validateManifest(value,now),/SCOPE_INVALID/);
  }
});
test('an extended expiration or old start is rejected',async()=>{
  let value=await fixture();value.urls.sourceGet=value.urls.sourceGet.replace('X-Amz-Expires=3600','X-Amz-Expires=7200');
  assert.throws(()=>validateManifest(value,now),/SCOPE_INVALID/);
  value=await fixture();assert.throws(()=>validateManifest(value,new Date(now.getTime()+660000)),/TOO_OLD_TO_START/);
  assert.equal(validateManifest(value,new Date(now.getTime()+1200000),false),value);
  assert.throws(()=>validateManifest(value,new Date(now.getTime()+3600000),false),/EXPIRED_OR_INVALID/);
});
