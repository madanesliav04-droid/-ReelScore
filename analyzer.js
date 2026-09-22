async function analyzeWithAI(file,setProgress){
 const ext=file.name.includes('.')?'.'+file.name.split('.').pop().replace(/[^a-zA-Z0-9]/g,'').slice(0,8):'';
 const tempPath=`reelscore-${Date.now()}-${Math.random().toString(36).slice(2,8)}${ext}`;
 let uploaded=false;
 try{
  setProgress('Envoi temporaire de la vidéo…',30);
  await puter.fs.write(tempPath,file);uploaded=true;
  const videoURL=await puter.fs.getReadURL(tempPath,60*60*1000);
  const prompt=`Tu es un auditeur strict de vidéos courtes Instagram Reels, TikTok et Shorts. Analyse cette vidéo réelle sans promettre qu'elle sera virale. Évalue seulement son potentiel de performance à partir de ce qui est réellement visible et audible. Si un élément n'est pas détectable, écris INDETECTABLE au lieu d'inventer.

Évalue sur 100 : hook parlé dans les 0-3 premières secondes, hook visuel, potentiel de rétention, clarté, valeur/émotion, titre ou texte écran, rythme, CTA. Recherche spécificité, curiosité, tension, douleur ou désir ciblé, densité de valeur, redondances, changements visuels et pertinence du CTA.

Réponds uniquement avec un JSON valide sans markdown, sous cette forme exacte :
{"detected_spoken_hook":"...","detected_visual_hook":"...","detected_title_text":"...","detected_cta":"...","scores":{"spoken_hook":0,"visual_hook":0,"retention":0,"clarity":0,"value_emotion":0,"title":0,"rhythm":0,"cta":0},"verdict":"...","main_problem":"...","why":"...","recommended_hook":"...","alternative_hooks":["...","...","..."],"recommended_title":"...","recommended_cta":"...","timeline":[{"time":"0:00","status":"red","label":"Ouverture","reason":"..."}],"action_items":["..."],"confidence":{"audio":0,"visual":0,"text":0}}`;
  setProgress('Analyse du hook et de la vidéo…',55);
  const response=await puter.ai.chat(prompt,videoURL,{model:'google/gemini-3.8-flash',normalize:true});
  setProgress('Analyse de la rétention…',75);
  let text=response?.message?.content||String(response||'');
  text=text.trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'');
  const start=text.indexOf('{'),end=text.lastIndexOf('}');
  if(start>=0&&end>start)text=text.slice(start,end+1);
  const data=JSON.parse(text);
  setProgress('Préparation des recommandations…',95);
  return data;
 }finally{
  if(uploaded){try{await puter.fs.delete(tempPath)}catch{}}
 }
}
window.analyzeWithAI=analyzeWithAI;