// Framework-free presentation helpers: safe HTML, no engine or authentication logic.
export const MODEL_ORDER=['codie-omni-v60','alex-hormozi-v16','leila-hormozi-v53','social-kinetic-v28','cinematic-storytelling-v7','apple-premium-spatial'];
export const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function projectStatus(project){
 if(project.state==='rendering')return {label:`Montage · ${Math.max(0,Math.min(99,Number(project.latestJob?.progress)||0))} %`,tone:'working'};
 if(project.latestJob?.state==='failed')return {label:'À reprendre',tone:'warning'};
 return {label:({draft:'Brouillon',ready:'Rush prêt',complete:'MP4 prêt'})[project.state]||'Projet enregistré',tone:project.has_output?'good':''};
}
export const ACOUSTIC_SUMMARY_VERSION='acoustic-summary-v1';
export function acousticScore(report){
 const values=Object.values(report.criteria||{}).filter(c=>Number.isFinite(c.score));
 return values.length?Math.round(values.reduce((sum,c)=>sum+c.score,0)/values.length):null;
}
export function sourceMeta(project){
 const m=project?.metadata;
 return m?`${m.width} × ${m.height} · ${(m.durationMs/1000).toLocaleString('fr-FR',{maximumFractionDigits:1})} s · ${m.width>=m.height?'horizontal':'vertical'}`:'Format natif préservé';
}
export function transcriptRows(words){
 return words.map((w,i)=>{
  const start=(w.startMs??Math.round(w.start*1000))/1000;
  const uncertain=w.reviewRequired===true||Number.isFinite(w.probability)&&w.probability<.75||/\s/.test(w.text);
  return `<div class="word-row ${uncertain?'word-uncertain':''}"><button type="button" class="word-time" data-action="seek-source" data-time="${start}" aria-label="Écouter à ${start.toFixed(2)} secondes">${start.toFixed(2)} s</button><input aria-label="Mot ${i+1}${uncertain?', à vérifier':''}" data-word-index="${i}" value="${escapeHtml(w.text)}" maxlength="40">${uncertain?'<span class="word-flag">À vérifier</span>':''}</div>`;
 }).join('');
}
