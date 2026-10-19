import test from 'node:test';
import assert from 'node:assert/strict';
import {r2Settings,r2Presign} from '../src/r2-sign.js';

const cfg={accountId:'0123456789abcdef0123456789abcdef',accessKeyId:'user_key_sample',secretAccessKey:'sample_secret_key_not_real',bucket:'socialplus-test'};
test('R2 credentials remain disabled until all settings exist',()=>{
  assert.equal(r2Settings(()=>undefined),null);
  assert.equal(r2Settings(k=>k==='R2_ACCOUNT_ID'?cfg.accountId:null),null);
  assert.deepEqual(r2Settings(k=>({
    R2_ACCOUNT_ID:cfg.accountId,R2_ACCESS_KEY_ID:cfg.accessKeyId,
    R2_SECRET_ACCESS_KEY:cfg.secretAccessKey,R2_BUCKET_NAME:cfg.bucket
  })[k]),cfg);
});
test('R2 presigned URL stays private and includes expiry and SigV4 query',async()=>{
  const url=await r2Presign(cfg,'PUT','u/r2-uploads/recording.mp4',600,new Date('2026-10-19T17:00:00Z'));
  const parsed=new URL(url);
  assert.equal(parsed.protocol,'https:');
  assert.equal(parsed.host,cfg.accountId+'.r2.cloudflarestorage.com');
  assert.equal(parsed.pathname,'/'+cfg.bucket+'/u/r2-uploads/recording.mp4');
  assert.equal(parsed.searchParams.get('X-Amz-Expires'),'600');
  assert.equal(parsed.searchParams.get('X-Amz-SignedHeaders'),'host');
  assert.match(parsed.searchParams.get('X-Amz-Signature'),/^[a-f0-9]{64}$/);
  assert.doesNotMatch(url,/sample_secret_key/);
  assert.equal(url,await r2Presign(cfg,'PUT','u/r2-uploads/recording.mp4',600,new Date('2026-10-19T17:00:00Z')));
});
test('R2 rejects unsafe bucket keys, unsupported methods and excessive lifetime',async()=>{
  await assert.rejects(()=>r2Presign(cfg,'DELETE','u/recording.mp4'));
  await assert.rejects(()=>r2Presign(cfg,'PUT','u/../hidden.mp4'));
  await assert.rejects(()=>r2Presign(cfg,'GET','u/a.mp4',86400));
});
