// Presigned URLs are bearer credentials: never print or commit the manifest.
export const maxLifetimeSeconds=3600;
export function validateManifest(value,now=new Date(),initial=true,requireValidated=true){
  if(value?.version!==1||value.privacyVerified!==true)throw new Error('R2_PRIVATE_VERIFICATION_REQUIRED');
  if(requireValidated&&value.accessesValidated!==true)throw new Error('R2_ACCESS_VALIDATION_REQUIRED');
  const created=Date.parse(value.createdAt),expires=Date.parse(value.expiresAt);
  if(!Number.isFinite(created)||expires-created!==3600000||now.getTime()<created-60000||now.getTime()>=expires-60000)
    throw new Error('R2_CAPABILITIES_EXPIRED_OR_INVALID');
  if(initial&&now.getTime()-created>600000)throw new Error('R2_CAPABILITIES_TOO_OLD_TO_START');
  if(!/^[a-f0-9]{32}$/.test(value.accountId)||!/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(value.bucket)||!/^socialplus-ci\/[a-f0-9-]{36}$/.test(value.prefix)||!Number.isSafeInteger(value.sourceBytes)||value.sourceBytes<1||value.sourceBytes>200000000)
    throw new Error('R2_TRANSFER_SCOPE_INVALID');
  if(!/^[a-f0-9]{64}$/.test(value.sourceSha256))throw new Error('R2_SOURCE_HASH_REQUIRED');
  const names={sourceGet:'source.mov',resultPut:'alex.mp4',resultGet:'alex.mp4',proofsPut:'proofs.zip',proofsGet:'proofs.zip'};
  for(const [role,file] of Object.entries(names)){
    let url;try{url=new URL(value.urls?.[role]);}catch{throw new Error('R2_CAPABILITY_INVALID');}
    const params=url.searchParams;
    if(url.protocol!=='https:'||url.username||url.password||url.hash||url.host!==value.accountId+'.r2.cloudflarestorage.com'||
      url.pathname!=='/'+value.bucket+'/'+value.prefix+'/'+file||
      params.get('X-Amz-Expires')!=='3600'||params.get('X-Amz-Algorithm')!=='AWS4-HMAC-SHA256'||
      !/^[a-f0-9]{64}$/.test(params.get('X-Amz-Signature')||'')||params.get('X-Amz-SignedHeaders')!=='host')
      throw new Error('R2_CAPABILITY_SCOPE_INVALID');
    const timestamp=new Date(created).toISOString().replace(/[-:]|\.\d{3}/g,'');
    if(params.get('X-Amz-Date')!==timestamp)throw new Error('R2_CAPABILITY_TIME_MISMATCH');
  }
  return value;
}
