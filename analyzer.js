async function loadMetaRules(){
 try{
  const r=await fetch(`meta-rules.json?v=${Date.now()}`,{cache:'no-store'});
  if(!r.ok)throw new Error('rulebook unavailable');
  return await r.json();
 }catch{
  return {version:'fallback',methodology:'Use cautious short-form analysis; do not claim access to Meta private ranking weights.',principles:[]};
 }
}

async function cleanupTempVideos(){
 try{
  const items=await puter.fs.readdir('./');
  const stale=(items||[]).filter(x=>x && typeof x.name==='string' && (x.name.startsWith('reelscore-')||x.name.startsWith('viralplus-')));
  for(const item of stale){
   try{await puter.fs.delete(item.path||item.name)}catch{}
  }
 }catch{}
}

async function ensureStorageFor(file){
 await cleanupTempVideos();
 try{
  const space=await puter.fs.space();
  const capacity=Number(space?.capacity)||0;
  const used=Number(space?.used)||0;
  const available=Math.max(0,capacity-used);
  const reserve=2*1024*1024;
  if(capacity>0 && file.size+reserve>available){
   const maxMB=Math.max(0,Math.floor((available-reserve)/1048576));
   const err=new Error(`Cette vidéo fait ${(file.size/1048576).toFixed(1)} Mo mais il reste environ ${maxMB} Mo disponibles pour l’analyse temporaire. Choisis une vidéo plus légère ou exporte-la en 720p.`);
   err.code='viralplus_storage_limit';
   throw err;
  }
 }catch(e){
  if(e?.code==='viralplus_storage_limit')throw e;
 }
}

async function analyzeWithAI(file,setProgress){
 const ext=file.name.includes('.')?'.'+file.name.split('.').pop().replace(/[^a-zA-Z0-9]/g,'').slice(0,8):'';
 const tempPath=`viralplus-${Date.now()}-${Math.random().toString(36).slice(2,8)}${ext}`;
 let uploaded=false;
 try{
  setProgress('Chargement du référentiel Meta…',15);
  const rules=await loadMetaRules();
  setProgress('Nettoyage des fichiers temporaires…',22);
  await ensureStorageFor(file);
  setProgress('Envoi temporaire de la vidéo…',30);
  await puter.fs.write(tempPath,file);uploaded=true;
  const videoURL=await puter.fs.getReadURL(tempPath,60*60*1000);
  const principles=(rules.principles||[]).map(p=>`- ${p.id}: ${p.rule} | preuve: ${p.evidence||''}`).join('\n');
  const prompt=`Tu es le moteur d'analyse de contenu de Viral+. Analyse CETTE VIDÉO RÉELLE pour Instagram Reels. Tu n'as pas accès à l'algorithme privé de Meta et tu ne dois jamais prétendre le contraire. Tu dois distinguer : (A) signaux officiellement documentés ou cohérents avec le référentiel Meta fourni, (B) heuristiques créatives de Viral+. Ne promets jamais qu'une vidéo sera virale. Évalue seulement son potentiel de recommandation/distribution et explique l'incertitude.

RÉFÉRENTIEL ACTUEL ${rules.version||''}
${rules.methodology||''}
${principles}

Analyse ce qui est réellement visible et audible. Si un élément n'est pas détectable, écris INDETECTABLE au lieu d'inventer.

Attribue des scores 0-100 pour :
- retention : capacité probable à maintenir l'attention (densité, progression, temps mort, relances)
- shareability : probabilité qualitative que le contenu donne envie d'être envoyé/partagé car utile, surprenant, identitaire ou émotionnel
- originality : originalité / valeur créative propre, pénalise le contenu manifestement recyclé ou faiblement transformé
- audience_relevance : clarté de la cible et adéquation sujet-promesse pour une audience identifiable
- spoken_hook : qualité du hook parlé dans les 0-3 premières secondes
- visual_hook : qualité du hook visuel initial
- clarity : compréhension immédiate
- value_emotion : valeur utile ou émotionnelle
- title : force du texte/titre à l'écran
- rhythm : rythme et ruptures attentionnelles
- cta : qualité de conversion du CTA. IMPORTANT : ce score CTA n'est pas un signal de distribution et ne doit pas influencer ton verdict de recommandation.

Réponds uniquement avec un JSON valide sans markdown, sous cette forme exacte :
{"detected_spoken_hook":"...","detected_visual_hook":"...","detected_title_text":"...","detected_cta":"...","scores":{"retention":0,"shareability":0,"originality":0,"audience_relevance":0,"spoken_hook":0,"visual_hook":0,"clarity":0,"value_emotion":0,"title":0,"rhythm":0,"cta":0},"verdict":"...","main_problem":"...","why":"...","meta_alignment":"explique en une phrase quels éléments du référentiel Meta influencent ce diagnostic","recommended_hook":"...","alternative_hooks":["...","...","..."],"recommended_title":"...","recommended_cta":"...","timeline":[{"time":"0:00","status":"red","label":"Ouverture","reason":"..."}],"action_items":["..."],"confidence":{"audio":0,"visual":0,"text":0,"meta_evidence":0},"rulebook_version":"${rules.version||'unknown'}"}`;
  setProgress('Analyse du hook et des signaux Meta…',55);
  const response=await puter.ai.chat(prompt,videoURL,{model:'google/gemini-3.8-flash',normalize:true});
  setProgress('Analyse de la rétention et du partage…',75);
  let text=response?.message?.content||String(response||'');
  text=text.trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'');
  const start=text.indexOf('{'),end=text.lastIndexOf('}');
  if(start>=0&&end>start)text=text.slice(start,end+1);
  const data=JSON.parse(text);
  data.rulebook_version=data.rulebook_version||rules.version||'unknown';
  setProgress('Préparation des recommandations…',95);
  return data;
 }catch(e){
  if(e?.code==='storage_limit_reached' || e?.status===413){
   await cleanupTempVideos();
   const err=new Error('Espace temporaire insuffisant pour cette vidéo. Viral+ a nettoyé les anciens fichiers : réessaie une fois. Si le message revient, exporte la vidéo en 720p pour réduire son poids.');
   err.code='viralplus_storage_limit';
   throw err;
  }
  throw e;
 }finally{
  if(uploaded){try{await puter.fs.delete(tempPath)}catch{}}
 }
}
window.analyzeWithAI=analyzeWithAI;