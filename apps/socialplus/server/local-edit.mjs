import {buildCaptionAss} from '../../worker/src/render.js';
import {mapOriginalToOutput} from '../../worker/src/edit.js';

const invalid=message=>Object.assign(new Error(message),{status:422,code:'INVALID_EDIT'});
export const SIGNAL_VERSION='local-acoustic-v2';

export function acousticReport(log,metadata,fingerprint){
  let windows=[];let start=null;
  for(const match of log.matchAll(/silence_(start|end):\s*([0-9.]+)/g)){
    const ms=Math.min(metadata.durationMs,Math.round(Number(match[2])*1000));
    if(match[1]==='start')start=ms;
    else if(start!==null){if(ms>start)windows.push({startMs:start,endMs:ms});start=null;}
  }
  if(start!==null&&start<metadata.durationMs)windows.push({startMs:start,endMs:metadata.durationMs});
  const merged=[];for(const w of windows){const previous=merged.at(-1);if(previous&&w.startMs<=previous.endMs+15)previous.endMs=Math.max(previous.endMs,w.endMs);else merged.push({...w});}windows=merged;
  const volume=key=>{const m=log.match(new RegExp(key+':\\s*(-?inf|-?[0-9.]+) dB'));return m&&Number.isFinite(Number(m[1]))?Number(m[1]):null;};
  const meanVolumeDb=volume('mean_volume'),peakVolumeDb=volume('max_volume');
  const silenceRatio=windows.reduce((n,w)=>n+w.endMs-w.startMs,0)/metadata.durationMs;
  const suggestions=windows.filter(w=>w.endMs-w.startMs>=800&&w.startMs>0&&w.endMs<metadata.durationMs)
    .slice(0,40).map((w,i)=>({id:'pause-'+i,startMs:w.startMs+250,endMs:w.endMs-250}));
  const recommendations=[];
  if(!metadata.hasAudio)recommendations.push('Aucune piste audio détectée : vérifiez si votre format nécessite une voix ou un son.');
  if(peakVolumeDb!==null&&peakVolumeDb>=-0.1)recommendations.push('Le pic audio approche 0 dBFS. Écoutez les passages forts pour vérifier une éventuelle saturation ; cette mesure ne prouve pas une distorsion.');
  if(meanVolumeDb!==null&&meanVolumeDb< -25)recommendations.push('Le niveau moyen est faible. Comparez la voix à volume d’écoute constant avant de normaliser.');
  if(silenceRatio>.25)recommendations.push('Plus d’un quart du fichier est sous le seuil de −35 dBFS. Examinez ces pauses ; elles peuvent être narratives ou contenir une voix faible.');
  if(!recommendations.length)recommendations.push('Aucune alerte acoustique parmi les critères mesurés. Vérifiez toujours la voix, le sens et la lisibilité avant publication.');
  return {engineVersion:SIGNAL_VERSION,fingerprint,metadata,meanVolumeDb,peakVolumeDb,silenceRatio,windows:windows.slice(0,200),suggestions,recommendations,
    notice:'Mesures locales du fichier, sans IA ni prédiction de viralité. Une pause acoustique ne prouve pas l’absence de parole. Les coupes proposées exigent votre validation après écoute.'};
}

export function buildLocalEdit({report,approvedPauseIds=[],transcript=[],captionsReviewed=false,previewOnly=false}={}){
  if(!report?.metadata)throw invalid('Analysez cette source avant de monter.');
  if(!Array.isArray(approvedPauseIds)||approvedPauseIds.length>40||new Set(approvedPauseIds).size!==approvedPauseIds.length)throw invalid('La sélection des pauses est invalide.');
  let cuts=approvedPauseIds.map(id=>{const pause=report.suggestions.find(p=>p.id===id);if(!pause)throw invalid('Cette pause n’appartient pas à l’analyse courante.');return pause;}).sort((a,b)=>a.startMs-b.startMs);
  if(!Array.isArray(transcript)||transcript.length>3000)throw invalid('La transcription doit contenir au maximum 3 000 mots alignés.');
  if(transcript.length&&!captionsReviewed&&!previewOnly)throw invalid('Confirmez avoir vérifié les mots et leur synchronisation.');
  let previousEnd=0;
  const words=transcript.map(w=>{
    if(!w||typeof w!=='object'||Array.isArray(w))throw invalid('Chaque mot doit contenir un texte, un début et une fin.');
    const startMs=typeof w.startMs==='number'?w.startMs:Math.round(w.start*1000),endMs=typeof w.endMs==='number'?w.endMs:Math.round(w.end*1000);
    const text=typeof w.text==='string'?w.text.trim():'';
    if(!Number.isFinite(startMs)||!Number.isFinite(endMs)||startMs<previousEnd||endMs<=startMs||endMs>report.metadata.durationMs||!text||text.length>40||/[{}\\\r\n\x00-\x1f]/.test(text))throw invalid('Mots invalides : texte court, ordre chronologique et bornes dans la vidéo requis.');
    const fontPx=Math.max(22,report.metadata.height*.035);
    if(text.split(/\s+/).some(word=>word.length*fontPx*.8>report.metadata.width-120))throw invalid('Un mot est trop long pour la zone de sous-titres de cette vidéo. Raccourcissez son affichage avant de continuer.');
    previousEnd=endMs;
    return {text,startMs,endMs};
  });
  if(words.length)cuts=cuts.map(c=>{
    const gaps=[];for(let i=-1;i<words.length;i++){const startMs=Math.max(c.startMs,i<0?0:words[i].endMs+120),endMs=Math.min(c.endMs,i+1>=words.length?report.metadata.durationMs:words[i+1].startMs-120);if(endMs-startMs>=220)gaps.push({startMs,endMs});}
    const gap=gaps.sort((a,b)=>(b.endMs-b.startMs)-(a.endMs-a.startMs))[0];
    if(!gap)throw invalid('Aucune coupe sûre entre les mots de cette pause. Désélectionnez-la.');
    return {...c,...gap};
  });
  const keepRanges=[];let cursor=0;
  for(const cut of cuts){if(cut.startMs<cursor||cut.endMs<=cut.startMs)throw invalid('Les coupes se chevauchent.');if(cut.startMs>cursor)keepRanges.push({startMs:cursor,endMs:cut.startMs});cursor=cut.endMs;}
  if(cursor<report.metadata.durationMs)keepRanges.push({startMs:cursor,endMs:report.metadata.durationMs});
  const outputDurationMs=keepRanges.reduce((sum,r)=>sum+r.endMs-r.startMs,0);
  const mapped=words.map(w=>({...w,startMs:mapOriginalToOutput(w.startMs,keepRanges),endMs:mapOriginalToOutput(w.endMs,keepRanges)}));
  const captions=[];let batch=[];
  const flush=()=>{if(batch.length){captions.push({startMs:batch[0].startMs,endMs:batch.at(-1).endMs,text:batch.map(w=>w.text).join(' '),words:batch.map(w=>({...w}))});batch=[];}};
  // Restrained two-line phrases; no karaoke timing inferred between words.
  const maxChars=Math.max(8,Math.min(32,Math.floor(report.metadata.width/Math.max(22,report.metadata.height*.035)*1.3)));
  for(const w of mapped){if(batch.length&&(batch.map(x=>x.text).join(' ').length+w.text.length+1>maxChars||w.startMs-batch.at(-1).endMs>350||w.endMs-batch[0].startMs>2000))flush();batch.push(w);if(/[.!?]$/.test(w.text))flush();}flush();
  const {width,height}=report.metadata;
  const timeline={keepRanges,outputDurationMs,captions,captionConfig:{fontFamily:'DejaVu Sans',fontSize:Math.max(22,height*.035)/Math.max(.55,Math.min(1.15,height/1920)),stroke:2,textColor:'#ffffff',background:false,shadow:true,entrance:'soft-fade',safeCaptionPlacement:'omni_bottom_center_adaptive'}};
  return {...timeline,cuts,ass:captions.length?buildCaptionAss(timeline,width,height):null};
}
