import {readFile,writeFile,stat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {validateManifest} from './r2-capabilities.mjs';

function manifest(initial){
  let value;try{value=JSON.parse(process.env.SOCIALPLUS_R2_TRANSFER||'');}catch{throw new Error('R2_CAPABILITIES_NOT_CONFIGURED');}
  return validateManifest(value,new Date(),initial);
}
async function request(url,options={}){
  let response;try{response=await fetch(url,{...options,redirect:'error',signal:AbortSignal.timeout(180000)});}catch{throw new Error('R2_TRANSFER_NETWORK_FAILED');}
  if(!response.ok)throw new Error('R2_TRANSFER_HTTP_'+response.status);
  return response;
}
export async function runTransfer(command,directory){
  const cfg=manifest(command!=='upload');
  if(command==='preflight'){
    const response=await request(cfg.urls.sourceGet,{headers:{Range:'bytes=0-0'}});
    await response.body?.cancel();return;
  }
  if(!directory||!path.isAbsolute(directory))throw new Error('R2_PRIVATE_WORKSPACE_REQUIRED');
  if(command==='download'){
    const response=await request(cfg.urls.sourceGet),data=Buffer.from(await response.arrayBuffer());
    if(data.length!==cfg.sourceBytes||createHash('sha256').update(data).digest('hex')!==cfg.sourceSha256)throw new Error('R2_SOURCE_INTEGRITY');
    await writeFile(path.join(directory,'source.mov'),data,{mode:0o600});return;
  }
  if(command!=='upload')throw new Error('R2_TRANSFER_COMMAND_INVALID');
  const delivered=[];
  for(const [file,put,get,type] of [['alex.mp4','resultPut','resultGet','video/mp4'],['proofs.zip','proofsPut','proofsGet','application/zip']]){
    const full=path.join(directory,file);
    if(!(await stat(full).catch(()=>null)))continue;
    const data=await readFile(full);if(data.length>200000000)throw new Error('R2_RESULT_TOO_LARGE');
    await request(cfg.urls[put],{method:'PUT',headers:{'Content-Type':type},body:data});
    const returned=Buffer.from(await (await request(cfg.urls[get])).arrayBuffer());
    const hash=createHash('sha256').update(data).digest('hex');
    if(createHash('sha256').update(returned).digest('hex')!==hash)throw new Error('R2_DELIVERY_INTEGRITY');
    delivered.push({file,bytes:data.length,sha256:hash});
  }
  await writeFile(path.join(directory,'delivery.json'),JSON.stringify({provider:'r2',delivered},null,2),{mode:0o600});
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))
  runTransfer(process.argv[2],process.env.SOCIALPLUS_ACTIONS_WORK_DIR).then(()=>console.log('R2 private transfer step completed')).catch(e=>{console.error(/^[A-Z][A-Z0-9_]*$/.test(e.message)?e.message:'R2_TRANSFER_FAILED');process.exitCode=1;});
