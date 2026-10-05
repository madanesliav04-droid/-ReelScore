async function analyzeWithAI(file,setProgress){
 const oldEndpoint=String(window.VIRAL_API_URL||'').replace(/\/$/,'');
 if(!oldEndpoint)throw new Error('Le backend Viral+ n’est pas connecté.');
 if(file.size>500*1024*1024)throw new Error(`Cette vidéo fait ${(file.size/1048576).toFixed(1)} Mo. Maximum bêta : 500 Mo.`);
 const base=oldEndpoint.split('/functions/v1/')[0];
 const type=file.type||'video/mp4';
 setProgress('Préparation de l’upload…',5);
 const tr=await fetch(`${base}/functions/v1/viralplus-upload-ticket`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({size:file.size,type})});
 const ticket=await tr.json();if(!tr.ok||!ticket?.path||!ticket?.token)throw new Error(ticket?.error||'Impossible de préparer l’upload.');
 const uploadUrl=`${base}/storage/v1/object/upload/sign/viralplus-videos/${ticket.path}?token=${encodeURIComponent(ticket.token)}`;
 setProgress('Upload direct…',8);
 await new Promise((resolve,reject)=>{const x=new XMLHttpRequest();x.open('POST',uploadUrl,true);x.setRequestHeader('Content-Type',type);x.setRequestHeader('Authorization',`Bearer ${ticket.token}`);x.upload.onprogress=e=>{if(e.lengthComputable)setProgress('Upload direct…',8+Math.round((e.loaded/e.total)*57))};x.onload=()=>{if(x.status>=200&&x.status<300)resolve();else{let msg=`Upload impossible (${x.status}).`;try{const d=JSON.parse(x.responseText||'{}');if(d.message||d.error)msg+=` ${d.message||d.error}`}catch{}reject(new Error(msg))}};x.onerror=()=>reject(new Error('Connexion interrompue pendant l’upload.'));x.send(file)});
 setProgress('Vidéo reçue · traitement IA…',68);
 const pr=await fetch(`${base}/functions/v1/viralplus-process`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({path:ticket.path,type})});
 let data={};try{data=await pr.json()}catch{}
 if(!pr.ok)throw new Error(data?.error||`Traitement impossible (${pr.status}).`);
 if(!data?.scores)throw new Error('Le moteur a renvoyé une analyse incomplète.');
 setProgress('Diagnostic prêt…',100);return data;
}
window.analyzeWithAI=analyzeWithAI;
