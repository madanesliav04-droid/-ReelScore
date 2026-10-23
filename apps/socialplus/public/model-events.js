// Drafts reference only actual supplied words. Layout always requires review.
const stop=new Set(['beaucoup','personnes','vraiment','souvent','derrière','encore','pourquoi','réellement','quand','comme','cette','c’est','c\'est','parce','domaine']);
export function draftModelEvents(model,words,zone='left'){
 if(!Array.isArray(words)||!words.length)throw Error('Transcrivez ce rush avant de préparer les événements.');
 const start=w=>w.startMs??Math.round(w.start*1000),end=w=>w.endMs??Math.round(w.end*1000);
 const duration=end(words.at(-1)),rect=zone==='right'?[.73,.10,.22,.34]:[.05,.10,.22,.34];
 const picked=[];
 for(let i=0;i<words.length;i++){
  const text=String(words[i].text).toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');
  const kind=model==='codie-omni-v60'?(text==='temps'?'clock':text==='argent'?'euro':null):null;
  if(model==='codie-omni-v60'&&!kind)continue;
  if(model!=='codie-omni-v60'&&(text.length<6||text.length>18||stop.has(text)))continue;
  const a=start(words[i]);if(picked.length&&a-picked.at(-1).endMs<1800)continue;
  const endMs=Math.min(duration,a+1800);if(endMs-a<500)continue;
  picked.push({wordIndex:i,wordCount:1,endMs,...(model==='cinematic-storytelling-v7'?{}:model==='alex-hormozi-v16'?{kind:'fullscreen'}:{kind:kind||(model==='social-kinetic-v28'?'bubble':undefined),rect})});
  if(picked.length>=(model==='codie-omni-v60'?8:3))break;
 }
 return picked;
}
