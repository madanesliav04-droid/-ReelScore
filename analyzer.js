async function analyzeWithAI(file,setProgress){
 const endpoint=String(window.VIRAL_API_URL||'').replace(/\/$/,'');
 if(!endpoint)throw new Error('Le backend Viral+ n’est pas encore connecté.');
 if(file.size>500*1024*1024)throw new Error(`Cette vidéo fait ${(file.size/1048576).toFixed(1)} Mo. Viral+ Beta accepte actuellement jusqu’à 500 Mo par vidéo.`);
 setProgress('Connexion au moteur Viral+…',20);
 const timers=[setTimeout(()=>setProgress('Envoi sécurisé de la vidéo…',35),700),setTimeout(()=>setProgress('Traitement vidéo par Gemini…',52),3000),setTimeout(()=>setProgress('Analyse du hook et des signaux…',67),7000),setTimeout(()=>setProgress('Analyse de la rétention et du partage…',80),12000),setTimeout(()=>setProgress('Préparation des recommandations…',91),18000)];
 try{
  const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':file.type||'video/mp4','X-File-Name':encodeURIComponent(file.name||'video.mp4'),'X-File-Size':String(file.size)},body:file});
  let payload={};try{payload=await response.json()}catch{}
  if(!response.ok){if(response.status===413)throw new Error('Cette vidéo dépasse la capacité de transfert du serveur bêta.');throw new Error(payload?.error||`Erreur serveur ${response.status}`)}
  if(!payload?.scores)throw new Error('Le moteur Viral+ a renvoyé une analyse incomplète.');setProgress('Analyse terminée.',100);return payload;
 }finally{timers.forEach(clearTimeout)}
}
window.analyzeWithAI=analyzeWithAI;
