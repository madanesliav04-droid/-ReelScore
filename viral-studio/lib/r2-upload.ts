/** Direct upload to a PRIVATE Cloudflare R2 object via a short-lived signed PUT URL.
 * The R2 secret is never exposed to the browser. Bucket CORS must allow the app origin.
 */
export function uploadToR2({url,file,mime,onProgress,onRequest}:{
  url:string;file:File;mime:string;
  onProgress?:(percent:number)=>void;onRequest?:(xhr:XMLHttpRequest)=>void;
}):Promise<void>{
  return new Promise((resolve,reject)=>{
    let target:URL;
    try{target=new URL(url)}catch{return reject(new Error('Adresse R2 invalide.'))}
    if(target.protocol!=='https:'||target.username||target.password||target.hash||target.port||!/^[a-f0-9]{32}\.r2\.cloudflarestorage\.com$/.test(target.hostname))
      return reject(new Error('Adresse R2 invalide.'));
    const xhr=new XMLHttpRequest();
    onRequest?.(xhr);
    xhr.open('PUT',url,true);
    xhr.timeout=20*60*1000;
    xhr.setRequestHeader('Content-Type',mime);
    xhr.upload.onprogress=e=>{
      if(e.lengthComputable&&e.total>0)onProgress?.(Math.min(99,Math.round(100*e.loaded/e.total)));
    };
    xhr.onerror=()=>reject(new Error('Connexion R2 interrompue. Vérifie la configuration CORS du bucket.'));
    xhr.ontimeout=()=>reject(new Error('Transfert trop long. Réessaie avec un fichier plus court.'));
    xhr.onabort=()=>reject(new Error('Import annulé.'));
    xhr.onload=()=>xhr.status>=200&&xhr.status<300?resolve()
      :reject(new Error('Import R2 impossible (HTTP '+xhr.status+').'));
    xhr.send(file);
  });
}
