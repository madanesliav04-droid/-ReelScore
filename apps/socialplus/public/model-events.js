// Drafts reference only actual supplied words. Layout always requires review.
const stop=new Set(['beaucoup','personnes','vraiment','souvent','derrière','encore','pourquoi','réellement','quand','comme','cette','c’est','c\'est','parce','domaine']);
export function draftModelEvents(model,words,zone='left'){
 if(!Array.isArray(words)||!words.length)throw Error('Transcrivez ce rush avant de préparer les événements.');
 const start=w=>w.startMs??Math.round(w.start*1000),end=w=>w.endMs??Math.round(w.end*1000);
 const duration=end(words.at(-1)),rect=zone==='right'?[.73,.10,.22,.34]:[.05,.10,.22,.34];
 const picked=[];
 for(let i=0;i<words.length;i++){
  const raw=String(words[i].text).toLowerCase();
  const text=raw.replace(/[^\p{L}\p{N}]/gu,'');
  const kind=model==='codie-omni-v60'?(/\btemps\b/.test(raw)?'clock':/\bargent\b/.test(raw)?'euro':null):null;
  if(model==='codie-omni-v60'&&!kind)continue;
  if(words[i].reviewRequired&&!words[i].confirmed)continue;
  if(model!=='codie-omni-v60'&&(text.length<6||text.length>18||stop.has(text)))continue;
  const a=start(words[i]);if(picked.length&&a-picked.at(-1).endMs<1800)continue;
  const rich=['alex-hormozi-v16','leila-hormozi-v53','apple-premium-spatial','cinematic-storytelling-v7'].includes(model);
  const endMs=Math.min(duration,a+(rich?3800:1800));if(endMs-a<500)continue;
  const details=[];
  if(rich)for(let j=i+1;j<words.length;j++){
   const w=words[j],token=String(w.text).toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');
   if(end(w)>endMs)break;
   if(start(w)<a+450||token.length<5||token.length>14||stop.has(token)||token===text||w.reviewRequired&&!w.confirmed||w.probability!==undefined&&w.probability<.8)continue;
   if(details.length&&start(w)-start(words[details.at(-1).wordIndex])<450)continue;
   details.push({wordIndex:j,wordCount:1});if(details.length===2)break;
  }
  picked.push({wordIndex:i,wordCount:1,endMs,...(details.length?{details}:{}),...(model==='cinematic-storytelling-v7'?{}:model==='alex-hormozi-v16'?{kind:'fullscreen'}:{kind:kind||(model==='social-kinetic-v28'?'bubble':model==='apple-premium-spatial'?'focus':undefined),rect})});
  if(picked.length>=(model==='codie-omni-v60'?8:3))break;
 }
 return picked;
}
