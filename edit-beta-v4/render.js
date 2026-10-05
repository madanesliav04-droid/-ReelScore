import {els,state,once,wait,setProgress,showError,bytes,fmt} from './state.js?v=44';
import {dims,drawCover,drawVisual,drawCaptions,punchScale,transitionOverlay} from './draw.js?v=44';

const isIOS=()=>/iPhone|iPad|iPod/.test(navigator.userAgent)||(/Mac/.test(navigator.userAgent)&&navigator.maxTouchPoints>1);

function mimeChoice(w,h){
  if(!window.MediaRecorder)return null;
  const portrait=h>w;
  const ios=isIOS();
  const list=ios&&portrait
    ?['video/webm;codecs=vp8,opus','video/webm','video/mp4','video/mp4;codecs=avc1.42E01E,mp4a.40.2']
    :ios
      ?['video/mp4','video/mp4;codecs=avc1.42E01E,mp4a.40.2','video/webm;codecs=vp8,opus','video/webm']
      :['video/webm;codecs=vp9,opus','video/webm;codecs=vp8,opus','video/mp4','video/webm'];
  return list.find(x=>MediaRecorder.isTypeSupported(x))||'';
}

async function ensureAudio(v){
  const Ctx=window.AudioContext||window.webkitAudioContext;
  if(!Ctx)return null;
  if(!state.audioContext){
    state.audioContext=new Ctx();
    state.srcNode=state.audioContext.createMediaElementSource(v);
    state.gain=state.audioContext.createGain();
    state.srcNode.connect(state.gain);
    state.gain.connect(state.audioContext.destination);
  }
  if(state.audioContext.state==='suspended')await state.audioContext.resume();
  const dest=state.audioContext.createMediaStreamDestination();
  state.srcNode.connect(dest);
  return dest;
}

async function verifyOutput(blob){
  const test=document.createElement('video');test.playsInline=true;test.preload='metadata';
  const u=URL.createObjectURL(blob);
  try{test.src=u;test.load();await once(test,'loadedmetadata',8000);return{ok:true,width:test.videoWidth,height:test.videoHeight,duration:test.duration}}
  catch{return{ok:false,width:0,height:0,duration:0}}
  finally{URL.revokeObjectURL(u)}
}

async function convertPortraitToMp4(blob,w,h){
  if(!(isIOS()&&h>w))return blob;
  setProgress(96,'Finalisation portrait iPhone…',`Conversion sûre vers MP4 H.264 ${w}×${h}, sans rotation metadata.`);
  const mb=await import('https://cdn.jsdelivr.net/npm/mediabunny@1.52.0/+esm');
  const {Input,Output,Conversion,ALL_FORMATS,BlobSource,Mp4OutputFormat,BufferTarget,Quality,canEncodeAudio}=mb;
  try{
    if(canEncodeAudio&&!(await canEncodeAudio('aac'))){
      const aac=await import('https://cdn.jsdelivr.net/npm/@mediabunny/aac-encoder/+esm');
      aac.registerAacEncoder?.();
    }
  }catch(e){console.warn('AAC extension fallback',e)}
  const target=new BufferTarget();
  const input=new Input({formats:ALL_FORMATS,source:new BlobSource(blob)});
  const output=new Output({format:new Mp4OutputFormat({fastStart:'in-memory'}),target});
  const conversion=await Conversion.init({
    input,output,
    video:{
      width:w,height:h,fit:'fill',codec:'avc',frameRate:30,
      quality:new Quality('high'),allowRotationMetadata:false,
      forceTranscode:true,hardwareAcceleration:'prefer-hardware'
    },
    audio:{codec:'aac',forceTranscode:true},
    tags:{}
  });
  if(!conversion.isValid)throw new Error('Conversion portrait MP4 indisponible sur cet iPhone.');
  conversion.onProgress=p=>setProgress(96+p*3,'Finalisation portrait iPhone…',`${Math.round(p*100)}% · MP4 H.264 sans rotation metadata`);
  await conversion.execute();
  if(!target.buffer?.byteLength)throw new Error('Le MP4 portrait final est vide.');
  return new Blob([target.buffer],{type:'video/mp4'});
}

async function normalizeForSafari(){
  if(state.normalizing||state.normalized)return false;
  state.normalizing=true;setProgress(55,'Compatibilité iPhone…','Normalisation locale H.264 / 30 fps du rush source.');
  try{
    const mb=await import('https://cdn.jsdelivr.net/npm/mediabunny@1.52.0/+esm');
    const {Input,Output,Conversion,ALL_FORMATS,BlobSource,Mp4OutputFormat,BufferTarget,Quality}=mb;
    const target=new BufferTarget(),input=new Input({formats:ALL_FORMATS,source:new BlobSource(state.file)}),output=new Output({format:new Mp4OutputFormat({fastStart:'in-memory'}),target});
    const conversion=await Conversion.init({input,output,video:{codec:'avc',frameRate:30,quality:new Quality('high'),allowRotationMetadata:false,forceTranscode:true},audio:{codec:'aac'},tags:{}});
    if(!conversion.isValid)throw new Error('Normalisation non supportée');
    conversion.onProgress=p=>setProgress(55+p*20,'Compatibilité iPhone…',`${Math.round(p*100)}%`);
    await conversion.execute();if(!target.buffer?.byteLength)throw new Error('Fichier normalisé vide');
    const blob=new Blob([target.buffer],{type:'video/mp4'}),name=(state.originalFile?.name||'rush').replace(/\.[^.]+$/,'')+'-compatible.mp4';
    state.file=new File([blob],name,{type:'video/mp4'});state.normalized=true;
    if(state.objectUrl)URL.revokeObjectURL(state.objectUrl);state.objectUrl=URL.createObjectURL(state.file);
    const v=els.sourceVideo;v.pause();v.src=state.objectUrl;v.preload='auto';v.playsInline=true;v.load();if(v.readyState<1)await once(v,'loadedmetadata',10000);
    state.duration=Number(v.duration)||state.duration;els.fileMeta.textContent=`${bytes(state.originalFile?.size||state.file.size)} · ${fmt(state.duration)} · mode compatibilité iPhone`;return true;
  }catch(e){throw new Error(`Normalisation iPhone impossible : ${e.message||e}`)}finally{state.normalizing=false}
}

function isCutTime(t){for(const[a,b]of state.cutRanges){if(t>=a&&t<b)return true}return false}
async function rewindOnce(v){v.pause();if((v.currentTime||0)<.08)return;v.currentTime=0;await Promise.race([once(v,'seeked',4000),wait(500)]);if(v.readyState<2)await Promise.race([once(v,'canplay',4000),wait(700)])}

async function renderContinuous(){
  if(!window.MediaRecorder||!els.renderCanvas.captureStream)throw new Error('Ce navigateur ne permet pas le rendu local.');
  const[w,h]=dims(),canvas=els.renderCanvas,ctx=canvas.getContext('2d',{alpha:false});canvas.width=w;canvas.height=h;
  const mime=mimeChoice(w,h);if(mime===null)throw new Error('MediaRecorder indisponible');
  const v=els.sourceVideo;
  setProgress(58,'Préparation du rendu V4.4…',`${w}×${h} · ${isIOS()&&h>w?'portrait iPhone sécurisé':'rendu standard'}`);
  const dest=await ensureAudio(v);if(state.gain)state.gain.gain.value=0;
  const cvs=canvas.captureStream(30),tracks=[...cvs.getVideoTracks()];if(dest?.stream.getAudioTracks().length)tracks.push(dest.stream.getAudioTracks()[0]);
  const out=new MediaStream(tracks),chunks=[];
  const rec=new MediaRecorder(out,mime?{mimeType:mime,videoBitsPerSecond:w>=2160?18000000:8000000,audioBitsPerSecond:160000}:{videoBitsPerSecond:8000000});
  rec.ondataavailable=e=>{if(e.data?.size)chunks.push(e.data)};
  let stopResolve,stopReject;const stopped=new Promise((res,rej)=>{stopResolve=res;stopReject=rej});rec.onstop=stopResolve;rec.onerror=()=>stopReject(new Error('Encodage interrompu'));
  const keptDuration=Math.max(.01,state.duration-state.cutRanges.reduce((s,[a,b])=>s+(b-a),0));
  let raf=0,drawing=true,lastCut=null,segStart=0,renderError=null;
  const draw=()=>{if(!drawing)return;const t=v.currentTime||0;ctx.fillStyle='#07080c';ctx.fillRect(0,0,w,h);const hasVisual=drawVisual(ctx,w,h,t);if(!hasVisual)drawCover(ctx,v,w,h,punchScale(t));drawCaptions(ctx,w,h,t);transitionOverlay(ctx,w,h,t,segStart);raf=requestAnimationFrame(draw)};
  els.outputArea.hidden=true;els.renderCanvas.hidden=false;els.previewMode.textContent='Rendu V4.4 en cours';v.style.visibility='hidden';v.controls=false;
  try{
    await rewindOnce(v);rec.start(800);const initiallyCut=isCutTime(0);if(initiallyCut&&rec.state==='recording')rec.pause();lastCut=initiallyCut;draw();await v.play();
    await new Promise((resolve,reject)=>{
      let lastTime=v.currentTime||0,stalls=0,lastTick=performance.now();
      const tick=()=>{
        if(v.error){reject(new Error('Decoding failed'));return}
        const t=v.currentTime||0,cut=isCutTime(t);
        if(cut!==lastCut){try{if(cut&&rec.state==='recording')rec.pause();if(!cut&&rec.state==='paused'){segStart=t;rec.resume()}}catch(e){reject(new Error(`Erreur encodeur : ${e.message||e}`));return}lastCut=cut}
        if(Math.abs(t-lastTime)<.004){if(performance.now()-lastTick>250)stalls++}else{stalls=0;lastTick=performance.now();lastTime=t}
        if(stalls>45){reject(new Error('Lecture bloquée pendant le rendu'));return}
        const cutBefore=state.cutRanges.reduce((sum,[a,b])=>t<=a?sum:sum+Math.max(0,Math.min(t,b)-a),0),outputTime=Math.max(0,t-cutBefore),pct=62+(outputTime/keptDuration)*31;
        setProgress(pct,'Montage V4.4…',`${fmt(outputTime)} / ${fmt(keptDuration)} · captions + visuels + portrait sécurisé`);
        if(v.ended||t>=state.duration-.04){resolve();return}requestAnimationFrame(tick)
      };tick()
    });
  }catch(e){renderError=e}
  finally{drawing=false;if(raf)cancelAnimationFrame(raf);v.pause();try{if(rec.state==='paused')rec.resume()}catch{}await wait(90);try{if(rec.state!=='inactive')rec.stop()}catch{}try{await Promise.race([stopped,wait(2200)])}catch{}if(state.gain)state.gain.gain.value=1;v.style.visibility='visible';v.controls=true;els.renderCanvas.hidden=true;for(const a of state.assets)if(a.type==='video')a.el.pause()}
  if(renderError)throw renderError;if(!chunks.length)throw new Error('Aucun fichier final produit');

  let blob=new Blob(chunks,{type:mime||chunks[0].type||'video/webm'});
  if(isIOS()&&h>w){blob=await convertPortraitToMp4(blob,w,h)}
  setProgress(99,'Validation du Reel…','Contrôle des dimensions du fichier final.');
  const check=await verifyOutput(blob);
  if(state.outputUrl)URL.revokeObjectURL(state.outputUrl);state.outputUrl=URL.createObjectURL(blob);
  els.outputArea.hidden=false;els.outputVideo.style.display='block';els.outputVideo.poster=canvas.toDataURL('image/jpeg',.84);els.outputVideo.src=state.outputUrl;els.outputVideo.load();
  els.downloadBtn.href=state.outputUrl;els.downloadBtn.download=`reel-v44-${Date.now()}.mp4`;els.downloadBtn.textContent=`Enregistrer le Reel · ${bytes(blob.size)}`;
  els.outputMeta.textContent=`${state.preset} · demandé ${w}×${h} · fichier ${check.width||'?'}×${check.height||'?'} · MP4 H.264 · rotation metadata OFF`;
  els.previewMode.textContent='Reel V4.4 généré';els.outputArea.scrollIntoView({behavior:'smooth',block:'center'});
  if(check.ok&&check.height>=check.width){setProgress(100,'Reel portrait validé',`${check.width}×${check.height} · MP4 H.264 · aucune rotation metadata`)}
  else if(check.ok&&h<=w){setProgress(100,'Reel V4.4 terminé',`${check.width}×${check.height}`)}
  else{throw new Error(`Le fichier final n'est toujours pas portrait (${check.width}×${check.height}). Export bloqué pour éviter un faux résultat.`)}
}

export async function runRenderWithCompatibility(){try{return await renderContinuous()}catch(e){const msg=String(e?.message||e);if(!state.normalized&&/Decoding failed|Lecture bloquée|decode/i.test(msg)){await normalizeForSafari();return await renderContinuous()}throw e}}
