const VP_BASE='https://eiypztjpmxdiuaqxjuqx.supabase.co';
const VP_STORAGE='https://eiypztjpmxdiuaqxjuqx.storage.supabase.co';
const VP_KEY='sb_publishable_Wl8iv037-iZ59iStDPu96A_RMn-US2C';
const enc=s=>btoa(unescape(encodeURIComponent(s)));
async function tusUpload(file,path,setProgress){
 const meta=`bucketName ${enc('viralplus-videos')},objectName ${enc(path)},contentType ${enc(file.type||'video/mp4')},cacheControl ${enc('3600')}`;
 const auth={'Authorization':'Bearer '+VP_KEY,'apikey':VP_KEY,'Tus-Resumable':'1.0.0'};
 const endpoint=VP_STORAGE+'/storage/v1/upload/resumable';
 const init=await fetch(endpoint,{method:'POST',headers:{...auth,'Upload-Length':String(file.size),'Upload-Metadata':meta,'x-upsert':'false'}});
 if(!init.ok)throw new Error(`Préparation upload impossible (${init.status}) ${(await init.text()).slice(0,240)}`);
 let loc=init.headers.get('Location');if(!loc)throw new Error('Supabase n’a pas créé de session d’upload.');
 if(loc.startsWith('/'))loc=VP_STORAGE+loc;
 let offset=0;const chunkSize=6*1024*1024;
 while(offset<file.size){
  const end=Math.min(offset+chunkSize,file.size);
  let done=false,last='';
  for(const delay of [0,1000,3000,5000]){
   if(delay)await new Promise(r=>setTimeout(r,delay));
   try{
    const r=await fetch(loc,{method:'PATCH',headers:{...auth,'Upload-Offset':String(offset),'Content-Type':'application/offset+octet-stream'},body:file.slice(offset,end)});
    if(r.ok){const serverOffset=Number(r.headers.get('Upload-Offset'));offset=serverOffset>offset?serverOffset:end;done=true;break}
    last=`${r.status} ${(await r.text()).slice(0,180)}`;
   }catch(e){last=String(e?.message||e)}
  }
  if(!done)throw new Error(`Upload vidéo interrompu (${last||'réseau'}).`);
  setProgress('Upload sécurisé…',8+Math.round(offset/file.size*57));
 }
 return path;
}
async function analyzeWithAI(file,setProgress){
 if(file.size>500*1024*1024)throw new Error(`Cette vidéo fait ${(file.size/1048576).toFixed(1)} Mo. Maximum bêta : 500 Mo.`);
 const type=file.type||'video/mp4',ext=type.includes('quicktime')?'mov':type.includes('webm')?'webm':'mp4',path=`beta/${crypto.randomUUID()}.${ext}`;
 setProgress('Préparation de l’upload…',5);
 await tusUpload(file,path,setProgress);
 setProgress('Vidéo reçue · traitement IA…',68);
 const pr=await fetch(VP_BASE+'/functions/v1/viralplus-process',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+VP_KEY,'apikey':VP_KEY},body:JSON.stringify({path,type})});
 let data={};try{data=await pr.json()}catch{}
 if(!pr.ok)throw new Error(data?.error||`Traitement impossible (${pr.status}).`);
 if(!data?.scores)throw new Error('Le moteur a renvoyé une analyse incomplète.');
 setProgress('Diagnostic prêt…',100);return data;
}
window.analyzeWithAI=analyzeWithAI;
