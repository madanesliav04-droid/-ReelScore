const VP_BASE='https://eiypztjpmxdiuaqxjuqx.supabase.co';
const VP_ANON=['eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9','eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVpeXB6dGpwbXhkaXVhcXhqdXF4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEwOTQ2OTksImV4cCI6MjEwNjY3MDY5OX0','5b0he172DcA53GqF7EQHtEDiiCbAg0kCfjmSKXeL4LQ'].join('.');
const enc=s=>btoa(unescape(encodeURIComponent(s)));
async function tusUpload(file,path,setProgress){
 const meta=`bucketName ${enc('viralplus-videos')},objectName ${enc(path)},contentType ${enc(file.type||'video/mp4')},cacheControl ${enc('3600')}`;
 const headers={'Authorization':'Bearer '+VP_ANON,'apikey':VP_ANON,'Tus-Resumable':'1.0.0'};
 const init=await fetch(VP_BASE+'/storage/v1/upload/resumable',{method:'POST',headers:{...headers,'Upload-Length':String(file.size),'Upload-Metadata':meta,'x-upsert':'false'}});
 if(!init.ok)throw new Error(`Initialisation upload impossible (${init.status}) ${(await init.text()).slice(0,120)}`);
 let loc=init.headers.get('Location');if(!loc)throw new Error('Session upload absente.');if(loc.startsWith('/'))loc=VP_BASE+loc;
 let offset=0;const chunkSize=6*1024*1024;
 while(offset<file.size){const end=Math.min(offset+chunkSize,file.size);const r=await fetch(loc,{method:'PATCH',headers:{...headers,'Upload-Offset':String(offset),'Content-Type':'application/offset+octet-stream'},body:file.slice(offset,end)});if(!r.ok)throw new Error(`Upload interrompu (${r.status}) ${(await r.text()).slice(0,120)}`);const serverOffset=Number(r.headers.get('Upload-Offset'));offset=serverOffset>offset?serverOffset:end;setProgress('Upload sécurisé…',8+Math.round(offset/file.size*57))}
}
async function analyzeWithAI(file,setProgress){
 if(file.size>500*1024*1024)throw new Error(`Cette vidéo fait ${(file.size/1048576).toFixed(1)} Mo. Maximum bêta : 500 Mo.`);
 const type=file.type||'video/mp4',ext=type.includes('quicktime')?'mov':type.includes('webm')?'webm':'mp4',path=`beta/${crypto.randomUUID()}.${ext}`;
 setProgress('Préparation de l’upload…',5);await tusUpload(file,path,setProgress);setProgress('Vidéo reçue · traitement IA…',68);
 const pr=await fetch(VP_BASE+'/functions/v1/viralplus-process',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({path,type})});let data={};try{data=await pr.json()}catch{}if(!pr.ok)throw new Error(data?.error||`Traitement impossible (${pr.status}).`);if(!data?.scores)throw new Error('Le moteur a renvoyé une analyse incomplète.');setProgress('Diagnostic prêt…',100);return data;
}
window.analyzeWithAI=analyzeWithAI;
