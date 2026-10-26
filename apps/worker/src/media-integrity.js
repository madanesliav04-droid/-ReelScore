import {Transform,Readable} from 'node:stream';
import {pipeline} from 'node:stream/promises';
import {createWriteStream,createReadStream} from 'node:fs';
import {stat,rm} from 'node:fs/promises';
import {createHash} from 'node:crypto';
export const MAX_SOURCE_BYTES=200_000_000;
const error=(code,message)=>Object.assign(new Error(message),{code});
export async function receiveObject(response,outputPath,{expectedBytes=null,append=false,maxBytes=MAX_SOURCE_BYTES}={}){
 if(!response.ok||!response.body)throw error('STORAGE_READ_FAILED','Le stockage a refusé la lecture (HTTP '+response.status+').');
 if(expectedBytes!==null){
  if(!Number.isSafeInteger(Number(expectedBytes))||Number(expectedBytes)<=0||Number(expectedBytes)>MAX_SOURCE_BYTES)throw error('SOURCE_SIZE_INVALID','Taille de source invalide.');
  maxBytes=Math.min(maxBytes,Number(expectedBytes));
 }
 const length=response.headers.get('content-length');
 if(length!==null&&(!Number.isSafeInteger(Number(length))||Number(length)>maxBytes)){
  await response.body.cancel().catch(()=>{});
  throw error('SOURCE_TOO_LARGE','Le fichier dépasse la limite de lecture.');
 }
 let bytes=0;
 const limit=new Transform({transform(chunk,_,done){bytes+=chunk.length;if(bytes>maxBytes)return done(error('SOURCE_TOO_LARGE','Le fichier dépasse la limite de lecture.'));done(null,chunk);}});
 try{
  await pipeline(Readable.fromWeb(response.body),limit,createWriteStream(outputPath,{flags:append?'a':'w',mode:0o600}));
  if(expectedBytes!==null&&bytes!==Number(expectedBytes))throw error('SOURCE_SIZE_MISMATCH','Le nombre d’octets reçu diffère du fichier importé.');
  return bytes;
 }catch(e){await rm(outputPath,{force:true}).catch(()=>{});throw e;}
}
export async function verifySource(file,{sizeBytes,sha256}={}){
 const size=(await stat(file)).size;
 if(!size||size>MAX_SOURCE_BYTES)throw error('SOURCE_TOO_LARGE','Le rush doit contenir entre 1 octet et 200 Mo.');
 if(Number.isSafeInteger(Number(sizeBytes))&&Number(sizeBytes)>0&&size!==Number(sizeBytes))throw error('SOURCE_SIZE_MISMATCH','Le rush reçu est incomplet.');
 if(sha256){
  if(!/^[a-f0-9]{64}$/i.test(sha256))throw error('SOURCE_HASH_INVALID','Empreinte de source invalide.');
  const hash=createHash('sha256');for await(const chunk of createReadStream(file))hash.update(chunk);
  if(hash.digest('hex')!==sha256.toLowerCase())throw error('SOURCE_HASH_MISMATCH','Le rush reçu diffère du fichier importé.');
 }
 return {bytes:size};
}
