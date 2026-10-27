// Read-only Cloudflare inspection + local signing. No service/bucket/object is
// created, no policy is modified, no GitHub workflow is dispatched.
import {writeFile,readFile,realpath,stat} from 'node:fs/promises';
import {randomUUID,createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {r2Presign} from '../src/r2-sign.js';
import {validateManifest} from './r2-capabilities.mjs';
import {sourceSha} from './private-transfer.mjs';

async function main(){
  const mode=process.argv[2],output=process.argv[3];
  if(!['inspect','sign','validate'].includes(mode)||!output||!path.isAbsolute(output))throw new Error('PRIVATE_OUTPUT_PATH_REQUIRED');
  const parent=await realpath(path.dirname(output)),repoRoot=fileURLToPath(new URL('../../../',import.meta.url));
  if(!path.relative(repoRoot,path.join(parent,path.basename(output))).startsWith('..'+path.sep))throw new Error('CAPABILITIES_MUST_STAY_OUTSIDE_REPOSITORY');
  if((await stat(parent)).mode&0o077)throw new Error('PRIVATE_DIRECTORY_PERMISSIONS_REQUIRED');
  const accountId=process.env.R2_ACCOUNT_ID?.toLowerCase(),bucket=process.env.R2_BUCKET_NAME,token=process.env.CLOUDFLARE_API_TOKEN;
  if(!/^[a-f0-9]{32}$/i.test(accountId||'')||!/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(bucket||'')||!token)throw new Error('R2_MANAGEMENT_ACCESS_NOT_CONFIGURED');
  const base='https://api.cloudflare.com/client/v4/accounts/'+accountId+'/r2/buckets/'+bucket;
  async function get(suffix,allowAbsent=false){
    let response;try{response=await fetch(base+suffix,{headers:{Authorization:'Bearer '+token},signal:AbortSignal.timeout(30000)});}catch{throw new Error('R2_METADATA_NETWORK_FAILED');}
    if(allowAbsent&&response.status===404)return null;
    if(!response.ok)throw new Error('R2_METADATA_HTTP_'+response.status);
    const data=await response.json();if(data.success!==true||!data.result)throw new Error('R2_METADATA_INVALID');return data.result;
  }
  const bucketInfo=await get('');
  const managed=await get('/domains/managed'),custom=await get('/domains/custom');
  const domains=Array.isArray(custom)?custom:custom.domains;
  if(bucketInfo.name!==bucket||managed.enabled!==false||!Array.isArray(domains)||domains.some(d=>d.enabled!==false))throw new Error('R2_BUCKET_NOT_CONFIRMED_PRIVATE');
  if(bucketInfo.storage_class!=='Standard')throw new Error('R2_STANDARD_STORAGE_REQUIRED');
  if(bucketInfo.jurisdiction&&bucketInfo.jurisdiction!=='default')throw new Error('R2_ENDPOINT_JURISDICTION_REQUIRES_REVIEW');
  const cors=await get('/cors',true),lifecycle=await get('/lifecycle',true);
  const inspected={checkedAt:new Date().toISOString(),accountId,bucket,bucketInfo,managedDomainEnabled:false,enabledCustomDomains:0,cors,lifecycle,
    note:'Direct public bucket domains checked. Public Workers/proxies and billing usage are not audited by this inspection.'};
  if(mode==='inspect'){
    await writeFile(output,JSON.stringify(inspected,null,2),{mode:0o600,flag:'wx'});
    console.log('Existing bucket inspection saved privately; no policy changed');return;
  }
  if(mode==='validate'){
    const value=JSON.parse(await readFile(output,'utf8')),controller=JSON.parse(await readFile(output+'.controller.json','utf8'));
    validateManifest(value,new Date(),true,false);
    if(value.accountId!==accountId||value.bucket!==bucket)throw new Error('R2_BUCKET_SCOPE_MISMATCH');
    if(process.env.R2_FREE_USAGE_CONFIRMED!=='true'||!process.env.R2_BILLING_EVIDENCE)throw new Error('R2_FREE_USAGE_CONFIRMATION_REQUIRED');
    const put=new URL(controller.sourcePut),get=new URL(value.urls.sourceGet);
    if(put.origin!==get.origin||put.pathname!==get.pathname||put.searchParams.get('X-Amz-Expires')!=='3600')throw new Error('R2_STAGING_SCOPE_INVALID');
    const source=process.argv[4];if(!source||!path.isAbsolute(source))throw new Error('REAL_SOURCE_PATH_REQUIRED');
    const bytes=await readFile(source);
    if(bytes.length!==value.sourceBytes||createHash('sha256').update(bytes).digest('hex')!==value.sourceSha256)throw new Error('R2_SOURCE_INTEGRITY');
    // Only the actual requested rush is staged; no empty/fake MP4 probe.
    let written;try{written=await fetch(controller.sourcePut,{method:'PUT',headers:{'Content-Type':'video/quicktime'},body:bytes,redirect:'error',signal:AbortSignal.timeout(120000)});}catch{throw new Error('R2_STAGING_NETWORK_FAILED');}
    if(!written.ok)throw new Error('R2_STAGING_HTTP_'+written.status);
    const response=await fetch(value.urls.sourceGet,{redirect:'error',signal:AbortSignal.timeout(120000)});
    if(!response.ok)throw new Error('R2_READBACK_HTTP_'+response.status);
    const returned=Buffer.from(await response.arrayBuffer());
    if(createHash('sha256').update(returned).digest('hex')!==value.sourceSha256)throw new Error('R2_STAGED_SOURCE_INTEGRITY');
    value.accessesValidated=true;value.validatedAt=new Date().toISOString();
    await writeFile(output+'.validated.json',JSON.stringify(value,null,2),{mode:0o600,flag:'wx'});
    console.log('Private source upload/readback validated; capabilities saved privately; no workflow started');return;
  }
  const accessKeyId=process.env.R2_ACCESS_KEY_ID,secretAccessKey=process.env.R2_SECRET_ACCESS_KEY;
  if(!accessKeyId||!secretAccessKey)throw new Error('R2_SIGNING_ACCESS_NOT_CONFIGURED');
  const cfg={accountId,bucket,accessKeyId,secretAccessKey},now=new Date(Math.floor(Date.now()/1000)*1000),prefix='socialplus-ci/'+randomUUID();
  const urls={};
  for(const [role,method,file] of [['sourceGet','GET','source.mov'],['resultPut','PUT','alex.mp4'],['resultGet','GET','alex.mp4'],['proofsPut','PUT','proofs.zip'],['proofsGet','GET','proofs.zip']])
    urls[role]=await r2Presign(cfg,method,prefix+'/'+file,3600,now);
  const manifest={version:1,privacyVerified:true,accessesValidated:false,createdAt:now.toISOString(),expiresAt:new Date(now.getTime()+3600000).toISOString(),accountId,bucket,prefix,sourceSha256:sourceSha,sourceBytes:1334977,urls};
  validateManifest(manifest,now,true,false);
  // This staging URL is for the owner/controller, not the GitHub runner.
  const sourcePut=await r2Presign(cfg,'PUT',prefix+'/source.mov',3600,now);
  await writeFile(output,JSON.stringify(manifest,null,2),{mode:0o600,flag:'wx'});
  await writeFile(output+'.controller.json',JSON.stringify({inspected,sourcePut,resultGet:urls.resultGet,proofsGet:urls.proofsGet,
    accessesValidated:false,billingValidated:false,
    next:'Check free usage, stage real rush privately, verify its hash and access before permitting a workflow run. Presigned URLs are reusable until expiry.'},null,2),{mode:0o600,flag:'wx'});
  console.log('Object-scoped one-hour capabilities saved privately; no transfer or execution performed');
}
main().catch(e=>{console.error(/^[A-Z][A-Z0-9_]*$/.test(e.message)?e.message:'R2_PREPARATION_FAILED');process.exitCode=1;});
