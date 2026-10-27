// One fixed private repository. Never print tokens, bodies, signed URLs or media.
import {readFile,writeFile,stat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
export const repository='madanesliav04-droid/socialplus-ios-private-tests';
export const sourceSha='53de1e48bb02b3fa7d086154f374e7f4ca38a346c2305038bc2b211c29d5716a';
export function assertPrivate(info){
  if(info.private!==true||info.full_name?.toLowerCase()!==repository.toLowerCase())throw new Error('PRIVATE_DESTINATION_REQUIRED');
}
const token=()=>{const value=process.env.SOCIALPLUS_PRIVATE_DELIVERY_TOKEN;if(!value)throw new Error('PRIVATE_DELIVERY_TOKEN_REQUIRED');return value;};
async function api(route,options={}){
  const response=await fetch('https://api.github.com/repos/'+repository+route,{...options,headers:{Authorization:'Bearer '+token(),Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28',...options.headers},signal:AbortSignal.timeout(120000)});
  if(!response.ok)throw new Error('PRIVATE_TRANSFER_HTTP_'+response.status);
  return response;
}
export async function preflight(){assertPrivate(await (await api('')).json());}
async function download(directory){
  await preflight();
  const response=await api('/contents/Resources/fixture.mov',{headers:{Accept:'application/vnd.github.raw+json'}});
  const bytes=Buffer.from(await response.arrayBuffer());
  if(bytes.length>200000000||createHash('sha256').update(bytes).digest('hex')!==sourceSha)throw new Error('PRIVATE_SOURCE_INTEGRITY');
  await writeFile(path.join(directory,'source.mov'),bytes,{mode:0o600});
}
async function upload(directory){
  await preflight(); // Recheck privacy immediately before publishing each result.
  const releaseId=425860214;
  const release=await (await api('/releases/'+releaseId)).json();
  if(release.draft!==true||release.tag_name!=='socialplus-alex-actions-20261027')throw new Error('PRIVATE_DRAFT_REQUIRED');
  const run=String(process.env.GITHUB_RUN_ID||'');
  const attempt=String(process.env.GITHUB_RUN_ATTEMPT||'');
  if(!/^\d+$/.test(run)||!/^\d+$/.test(attempt))throw new Error('ACTIONS_RUN_ID_REQUIRED');
  const uploaded=[];
  for(const [file,type] of [['alex.mp4','video/mp4'],['report.json','application/json'],['metrics.json','application/json'],['proofs.zip','application/zip']]){
    const full=path.join(directory,file);if(!(await stat(full).catch(()=>null)))continue;
    const bytes=await readFile(full),digest=createHash('sha256').update(bytes).digest('hex');
    if(bytes.length>200000000)throw new Error('PRIVATE_OUTPUT_SIZE_LIMIT');
    await preflight();
    const name='run-'+run+'-attempt-'+attempt+'-'+file;
    const response=await fetch('https://uploads.github.com/repos/'+repository+'/releases/'+releaseId+'/assets?name='+encodeURIComponent(name),{method:'POST',headers:{Authorization:'Bearer '+token(),'Content-Type':type,'X-GitHub-Api-Version':'2022-11-28'},body:bytes,signal:AbortSignal.timeout(120000)});
    if(!response.ok)throw new Error('PRIVATE_UPLOAD_HTTP_'+response.status);
    const asset=await response.json();
    const fetched=Buffer.from(await (await api('/releases/assets/'+asset.id,{headers:{Accept:'application/octet-stream'}})).arrayBuffer());
    if(createHash('sha256').update(fetched).digest('hex')!==digest)throw new Error('PRIVATE_UPLOAD_INTEGRITY');
    uploaded.push({file,assetId:asset.id,sha256:digest,bytes:bytes.length});
  }
  await writeFile(path.join(directory,'delivery.json'),JSON.stringify({repository,releaseId,uploaded},null,2),{mode:0o600});
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{
    const command=process.argv[2],directory=process.env.SOCIALPLUS_ACTIONS_WORK_DIR;
    if(command==='preflight')await preflight();
    else if(command==='download'&&directory)await download(directory);
    else if(command==='upload'&&directory)await upload(directory);
    else throw new Error('INVALID_TRANSFER_COMMAND');
    console.log('Private transfer step completed');
  }catch(error){console.error(String(error.message).match(/^[A-Z_]+(?:\d+)?$/)?.[0]||'PRIVATE_TRANSFER_FAILED');process.exitCode=1;}
}
