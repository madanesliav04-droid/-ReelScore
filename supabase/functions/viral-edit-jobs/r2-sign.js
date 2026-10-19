/**
 * Cloudflare R2 S3 Signature V4 presigned URL (Deno + Node 22 WebCrypto).
 * Use only with a private R2 bucket. Credentials stay in server-side secrets.
 */
const encoder=new TextEncoder();
const bytes=s=>encoder.encode(s);
const hex=b=>Array.from(new Uint8Array(b),x=>x.toString(16).padStart(2,'0')).join('');
const esc=s=>encodeURIComponent(String(s)).replace(/[!'()*]/g,c=>'%'+c.charCodeAt(0).toString(16).toUpperCase());
async function digest(value){return hex(await crypto.subtle.digest('SHA-256',bytes(value)));}
async function mac(key,message){
  const imported=await crypto.subtle.importKey('raw',key,{name:'HMAC',hash:'SHA-256'},false,['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC',imported,bytes(message)));
}
export function r2Settings(env){
  if(env('R2_ENABLED')!=='true')return null;
  const accountId=env('R2_ACCOUNT_ID')||'';
  const accessKeyId=env('R2_ACCESS_KEY_ID')||'';
  const secretAccessKey=env('R2_SECRET_ACCESS_KEY')||'';
  const bucket=env('R2_BUCKET_NAME')||'';
  if(!accountId||!accessKeyId||!secretAccessKey||!bucket)return null;
  if(!/^[a-f0-9]{32}$/i.test(accountId)||!/^[a-z0-9][a-z0-9-]{1,61}$/i.test(bucket))
    throw new Error('R2_CONFIG_INVALID');
  return {accountId,accessKeyId,secretAccessKey,bucket};
}
export async function r2Presign(config,method,key,expires=600,now=new Date()){
  if(!['PUT','GET','HEAD'].includes(method)||!Number.isSafeInteger(expires)||expires<1||expires>3600)throw new Error('R2_SIGNATURE_INVALID');
  if(typeof key!=='string'||!key||key.length>700||key.startsWith('/')||key.split('/').some(p=>!p||p==='.'||p==='..'))throw new Error('R2_OBJECT_KEY_INVALID');
  const timestamp=now.toISOString().replace(/[-:]|\.\d{3}/g,'');
  const date=timestamp.slice(0,8),region='auto',service='s3';
  const scope=`${date}/${region}/${service}/aws4_request`;
  const host=`${config.accountId}.r2.cloudflarestorage.com`;
  const uri='/'+esc(config.bucket)+'/'+key.split('/').map(esc).join('/');
  const params={
    'X-Amz-Algorithm':'AWS4-HMAC-SHA256',
    'X-Amz-Credential':config.accessKeyId+'/'+scope,
    'X-Amz-Date':timestamp,
    'X-Amz-Expires':String(expires),
    'X-Amz-SignedHeaders':'host'
  };
  const query=Object.entries(params).map(([k,v])=>esc(k)+'='+esc(v)).sort().join('&');
  const canonical=[method,uri,query,`host:${host}\n`,'host','UNSIGNED-PAYLOAD'].join('\n');
  const toSign=['AWS4-HMAC-SHA256',timestamp,scope,await digest(canonical)].join('\n');
  const kDate=await mac(bytes('AWS4'+config.secretAccessKey),date);
  const kRegion=await mac(kDate,region);
  const kService=await mac(kRegion,service);
  const signingKey=await mac(kService,'aws4_request');
  const signature=hex(await mac(signingKey,toSign));
  return `https://${host}${uri}?${query}&X-Amz-Signature=${signature}`;
}
