// Same-origin API adapter. Native shells must provide an explicit audited adapter.
export function uploadSource({projectId,file,csrf,signal,onProgress=()=>{}}){
 return new Promise((resolve,reject)=>{
  const xhr=new XMLHttpRequest();
  const abort=()=>xhr.abort();
  const finish=fn=>value=>{signal?.removeEventListener('abort',abort);fn(value);};
  const fail=finish(reject),done=finish(resolve);
  if(signal?.aborted){fail(new DOMException('Session fermée','AbortError'));return;}
  xhr.open('POST',`/api/projects/${encodeURIComponent(projectId)}/source`);
  xhr.withCredentials=true;xhr.timeout=600000;
  xhr.setRequestHeader('Content-Type',file.type||'application/octet-stream');
  xhr.setRequestHeader('X-Filename',encodeURIComponent(file.name));
  xhr.setRequestHeader('X-CSRF-Token',csrf);
  xhr.upload.onprogress=e=>{if(e.lengthComputable)onProgress(Math.round(e.loaded/e.total*100));};
  xhr.onload=()=>{
   let data;try{data=JSON.parse(xhr.responseText);}catch{fail(Error('Réponse d’import illisible. Réessayez depuis Projets.'));return;}
   if(xhr.status>=200&&xhr.status<300)done(data);
   else fail(Object.assign(Error(data.message||'Import refusé.'),{code:data.code,status:xhr.status}));
  };
  xhr.onerror=()=>fail(Error('Connexion interrompue. Vérifiez le Wi-Fi et réessayez cet import.'));
  xhr.ontimeout=()=>fail(Error('L’import a dépassé dix minutes. Essayez un rush plus court.'));
  xhr.onabort=()=>fail(new DOMException('Import interrompu','AbortError'));
  signal?.addEventListener('abort',abort,{once:true});xhr.send(file);
 });
}
export async function loadShareFile(projectId,{signal}={}){
 const response=await fetch(`/api/projects/${encodeURIComponent(projectId)}/output`,{credentials:'same-origin',signal});
 if(!response.ok)throw Error('Impossible de préparer ce MP4. Téléchargez-le depuis le projet.');
 if(Number(response.headers.get('content-length'))>100*1048576)throw Error('Pour un MP4 de plus de 100 Mo, téléchargez-le puis partagez-le depuis Fichiers.');
 return new File([await response.blob()],'SocialPlus.mp4',{type:'video/mp4'});
}
