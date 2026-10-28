"use client";
import {useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import {Upload,Download,Trash2} from 'lucide-react';
import {videoUploadPreflight} from '@/lib/upload-limits';
import {measureAudio,LOCAL_ANALYSIS_VERSION,AudioMeasurements} from '@/lib/local-video-analysis';

type Report={version:string;name:string;bytes:number;duration:number;width:number;height:number;audio:AudioMeasurements|null;audioStatus:string;limits:string[]};
export function LocalVideoCheck(){
 const [file,setFile]=useState<File|null>(null),[url,setUrl]=useState(''),[report,setReport]=useState<Report|null>(null);
 const [error,setError]=useState(''),[stage,setStage]=useState(''),[busy,setBusy]=useState(false);
 const video=useRef<HTMLVideoElement>(null),generation=useRef(0),audioContext=useRef<AudioContext|null>(null);
 useEffect(()=>()=>{generation.current++;void audioContext.current?.close().catch(()=>{})},[]);
 useEffect(()=>()=>{if(url)URL.revokeObjectURL(url)},[url]);
 function choose(selected:File){
  const invalid=videoUploadPreflight(selected);if(invalid){setError(invalid);return}
  generation.current++;void audioContext.current?.close().catch(()=>{});audioContext.current=null;
  setFile(selected);setUrl(URL.createObjectURL(selected));setReport(null);setError('');setBusy(false);setStage('Lecture des métadonnées…');
 }
 async function analyze(){
  if(!file||!video.current||busy)return;
  const element=video.current;
  if(!Number.isFinite(element.duration)||element.duration<=0||!element.videoWidth)return setError('Attends le chargement de la vidéo ou choisis un format décodable sur cet appareil.');
  if(element.duration>600)return setError('Ce test est limité à 10 minutes pour préserver la mémoire de ton appareil.');
  const id=++generation.current;setBusy(true);setError('');setStage('Vérification du format natif…');
  const result:Report={version:LOCAL_ANALYSIS_VERSION,name:file.name,bytes:file.size,duration:element.duration,width:element.videoWidth,height:element.videoHeight,audio:null,audioStatus:'Non mesuré',limits:['Aucune transcription : les paroles et les sous-titres ne sont pas évalués.','Hook, clarté, structure narrative, CTA et rétention non évalués. Aucun score éditorial n’est calculé.','Décodage intégral, sous-titres et synchronisation mot à mot non vérifiés.','Pas de transfert serveur ni de montage MP4 dans ce parcours local.']};
  let context:AudioContext|null=null;
  try{
   if(file.size>40_000_000||element.duration>90){result.audioStatus='Audio non mesuré : fichier supérieur à 40 Mo ou 90 secondes, limite de mémoire de ce test mobile. Le lecteur accepte jusqu’à 200 Mo.';}
   else{
    setStage('Décodage de la piste audio sur cet appareil…');
    const AudioCtor=window.AudioContext||(window as unknown as {webkitAudioContext?:typeof AudioContext}).webkitAudioContext;
    if(!AudioCtor)throw Error('AUDIO_DECODER_UNAVAILABLE');
    context=new AudioCtor();audioContext.current=context;
    // No microphone, MediaRecorder, network upload, model or external API.
    const decoded=await context.decodeAudioData(await file.arrayBuffer());
    if(id!==generation.current)return;
    setStage('Mesure des niveaux et des silences…');
    result.audio=measureAudio(Array.from({length:decoded.numberOfChannels},(_,i)=>decoded.getChannelData(i)),decoded.sampleRate);
    result.audioStatus='Mesuré sur la piste décodée par ce navigateur. RMS et crête dBFS, pas des LUFS ni une certification de qualité vocale.';
   }
  }catch{result.audioStatus='Audio non mesuré : ce navigateur n’a pas décodé la piste. Cela ne prouve pas que la vidéo est muette. Essaie une version MP4 H.264/AAC pour ce contrôle.';}
  finally{if(context){await context.close().catch(()=>{});if(audioContext.current===context)audioContext.current=null;}if(id===generation.current){setReport(result);setBusy(false);setStage('Vérification terminée — consulte les limites ci-dessous.')}}
 }
 function clear(){generation.current++;void audioContext.current?.close().catch(()=>{});audioContext.current=null;setFile(null);setUrl('');setReport(null);setStage('');setError('');setBusy(false)}
 function download(){if(!report)return;const object=URL.createObjectURL(new Blob([JSON.stringify(report,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=object;a.download='SocialPlus-analyse-technique.json';a.click();setTimeout(()=>URL.revokeObjectURL(object),60000)}
 return <main className="info-page local-video-check"><Link href="/apercu?tool=viral">← Social+</Link><small className="eyebrow">ANALYSE SUR CET APPAREIL</small><h1>Teste ta vidéo.</h1><p>Importe un vrai fichier pour le visionner et vérifier ses caractéristiques. Il reste sur ton appareil : aucun envoi vers un serveur.</p><p className="preview-notice">Ce contrôle technique ne remplace pas l’analyse éditoriale de Social+, encore indisponible sans backend isolé.</p>
 <label className="local-upload" onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();if(e.dataTransfer.files.length===1)choose(e.dataTransfer.files[0]);else setError('Choisis une seule vidéo.')}}><Upload size={24}/><strong>{file?.name||'Choisir une vidéo'}</strong><span>MP4 · MOV · WebM · 200 Mo maximum</span><input aria-label="Importer une vidéo pour analyse locale" type="file" accept="video/mp4,video/quicktime,video/webm,.mov,.mp4,.webm" onChange={e=>{const next=e.currentTarget.files?.[0];e.currentTarget.value='';if(next)choose(next)}}/></label>
 {url&&<video ref={video} controls playsInline preload="metadata" src={url} onLoadedMetadata={()=>{setError('');setStage('Vidéo chargée. Lance le contrôle technique.')}} onError={()=>{setError('Lecture impossible sur cet appareil. MOV/HEVC dépend du navigateur ; essaie un MP4 H.264/AAC.');setStage('')}}/>}
 {file&&<div className="local-actions"><button onClick={()=>void analyze()} disabled={busy}>{busy?'Vérification en cours…':'Analyser les caractéristiques'}</button><button onClick={clear}><Trash2 size={17}/> Retirer</button></div>}
 {stage&&<p role="status" aria-live="polite">{stage}</p>}{error&&<p role="alert" className="error">{error}</p>}
 {report&&<section aria-label="Résultat de l’analyse technique"><h2>Ce qui a été mesuré</h2><dl className="local-metrics"><div><dt>Durée</dt><dd>{report.duration.toFixed(2)} s</dd></div><div><dt>Définition native</dt><dd>{report.width} × {report.height}</dd></div><div><dt>Format</dt><dd>{report.width>report.height?'Horizontal':report.width<report.height?'Vertical':'Carré'}</dd></div><div><dt>Taille</dt><dd>{(report.bytes/1e6).toFixed(2)} Mo</dd></div></dl><h2>Audio</h2><p>{report.audioStatus}</p>{report.audio&&<><dl className="local-metrics"><div><dt>Crête</dt><dd>{report.audio.peakDb===null?'Aucun signal mesuré':report.audio.peakDb.toFixed(1)+' dBFS'}</dd></div><div><dt>Niveau RMS</dt><dd>{report.audio.rmsDb===null?'Aucun signal mesuré':report.audio.rmsDb.toFixed(1)+' dBFS'}</dd></div><div><dt>Silence mesuré</dt><dd>{(report.audio.silenceRatio*100).toFixed(1)} %</dd></div></dl>{report.audio.clippedSamples>0&&<p>Des échantillons atteignent presque le maximum numérique. Réécoute les pics pour vérifier une éventuelle saturation ; ce constat seul ne certifie pas une distorsion.</p>}<h3>Passages à réécouter</h3><p>Fenêtres sous −35 dBFS pendant au moins 0,3 s. Vérifie chaque pause avant de couper : ce test ne connaît pas les frontières des phrases.</p>{report.audio.windows.length?<ol>{report.audio.windows.slice(0,30).map((w,i)=><li key={i}><button className="timestamp" onClick={()=>{if(video.current){video.current.currentTime=w.start;video.current.focus()}}}>{w.start.toFixed(1)} s → {w.end.toFixed(1)} s</button> · Réécouter ; raccourcir uniquement si cette pause n’est pas narrative.</li>)}</ol>:<p>Aucune fenêtre correspondant à ce seuil. Ce n’est pas une validation du rythme éditorial.</p>}</>}
 <h2>Non vérifié</h2><ul>{report.limits.map(x=><li key={x}>{x}</li>)}</ul><p>Version {report.version}. Les mesures audio dépendent du décodeur du navigateur ; aucun taux de viralité, score de hook ou rétention réelle n’est inventé.</p><button onClick={download}><Download size={17}/> Télécharger le rapport JSON</button></section>}
 </main>;
}
