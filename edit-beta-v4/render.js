import {els,state,once,wait,setProgress,showError,bytes,fmt} from './state.js';
import {dims,drawCover,drawVisual,drawCaptions,punchScale,transitionOverlay} from './draw.js';

function mimeChoice(){
  if(!window.MediaRecorder)return null;
  const ios=/iPhone|iPad|iPod/.test(navigator.userAgent)||(/Mac/.test(navigator.userAgent)&&navigator.maxTouchPoints>1);
  const list=ios
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
  const test=document.createElement('video');
  test.playsInline=true;test.preload='metadata';
  const u=URL.createObjectURL(blob);
  try{test.src=u;test.load();await once(test,'loadedmetadata',6000);return true}
  catch{return false}
  finally{URL.revokeObjectURL(u)}
}

async function normalizeForSafari(){
  if(state.normalizing||state.normalized)return false;
  state.normalizing=true;
  setProgress(55,'Compatibilité iPhone…','Normalisation locale H.264 / 30 fps uniquement pour ce rush.');
  try{
    const mb=await import('https://cdn.jsdelivr.net/npm/mediabunny@1.52.0/+esm');
    const {Input,Output,Conversion,ALL_FORMATS,BlobSource,Mp4OutputFormat,BufferTarget,Quality}=mb;
    const target=new BufferTarget();
    const input=new Input({formats:ALL_FORMATS,source:new BlobSource(state.file)});
    const output=new Output({format:new Mp4OutputFormat({fastStart:'in-memory'}),target});
    const conversion=await Conversion.init({
      input,output,
      video:{codec:'avc',frameRate:30,quality:new Quality('high'),allowRotationMetadata:false},
      audio:{codec:'aac'},tags:{}
    });
    if(!conversion.isValid)throw new Error('Normalisation non supportée');
    conversion.onProgress=p=>setProgress(55+p*20,'Compatibilité iPhone…',`${Math.round(p*100)}%`);
    await conversion.execute();
    if(!target.buffer?.byteLength)throw new Error('Fichier normalisé vide');
    const blob=new Blob([target.buffer],{type:'video/mp4'});
    const name=(state.originalFile?.name||'rush').replace(/\.[^.]+$/,'')+'-compatible.mp4';
    state.file=new File([blob],name,{type:'video/mp4'});
    state.normalized=true;
    if(state.objectUrl)URL.revokeObjectURL(state.objectUrl);
    state.objectUrl=URL.createObjectURL(state.file);
    const v=els.sourceVideo;
    v.pause();v.src=state.objectUrl;v.preload='auto';v.playsInline=true;v.load();
    if(v.readyState<1)await once(v,'loadedmetadata',10000);
    state.duration=Number(v.duration)||state.duration;
    els.fileMeta.textContent=`${bytes(state.originalFile?.size||state.file.size)} · ${fmt(state.duration)} · mode compatibilité iPhone`;
    return true;
  }catch(e){
    throw new Error(`Encodage incompatible avec Safari et normalisation impossible : ${e.message||e}`);
  }finally{state.normalizing=false}
}

function isCutTime(t){
  for(const [a,b] of state.cutRanges){if(t>=a&&t<b)return true}
  return false;
}

async function rewindOnce(v){
  v.pause();
  if((v.currentTime||0)<.08)return;
  v.currentTime=0;
  await Promise.race([once(v,'seeked',4000),wait(500)]);
  if(v.readyState<2)await Promise.race([once(v,'canplay',4000),wait(700)]);
}

async function renderContinuous(){
  if(!window.MediaRecorder||!els.renderCanvas.captureStream)throw new Error('Ce navigateur ne permet pas le rendu local.');
  const [w,h]=dims();
  const canvas=els.renderCanvas,ctx=canvas.getContext('2d',{alpha:false});
  canvas.width=w;canvas.height=h;
  const mime=mimeChoice();
  if(mime===null)throw new Error('MediaRecorder indisponible');
  const ext=mime.includes('mp4')?'mp4':'webm';
  const v=els.sourceVideo;
  setProgress(58,'Préparation du rendu V4.2…',`${els.aspectRatio.value} · ${w}×${h} · lecture continue iPhone`);
  const dest=await ensureAudio(v);
  if(state.gain)state.gain.gain.value=0;
  const cvs=canvas.captureStream(30);
  const tracks=[...cvs.getVideoTracks()];
  if(dest?.stream.getAudioTracks().length)tracks.push(dest.stream.getAudioTracks()[0]);
  const out=new MediaStream(tracks),chunks=[];
  const rec=new MediaRecorder(out,mime?{
    mimeType:mime,
    videoBitsPerSecond:w>=2160?18000000:8000000,
    audioBitsPerSecond:160000
  }:{videoBitsPerSecond:8000000});
  rec.ondataavailable=e=>{if(e.data?.size)chunks.push(e.data)};
  let stopResolve,stopReject;
  const stopped=new Promise((res,rej)=>{stopResolve=res;stopReject=rej});
  rec.onstop=stopResolve;
  rec.onerror=()=>stopReject(new Error('Encodage interrompu'));

  const keptDuration=Math.max(.01,state.duration-state.cutRanges.reduce((s,[a,b])=>s+(b-a),0));
  let raf=0,drawing=true,lastCut=null,segStart=0,renderError=null;
  const draw=()=>{
    if(!drawing)return;
    const t=v.currentTime||0;
    ctx.fillStyle='#07080c';ctx.fillRect(0,0,w,h);
    const hasVisual=drawVisual(ctx,w,h,t);
    if(!hasVisual)drawCover(ctx,v,w,h,punchScale(t));
    drawCaptions(ctx,w,h,t);
    transitionOverlay(ctx,w,h,t,segStart);
    raf=requestAnimationFrame(draw);
  };

  els.outputArea.hidden=true;
  els.renderCanvas.hidden=false;
  els.previewMode.textContent='Rendu V4.2 en cours';
  v.style.visibility='hidden';v.controls=false;

  try{
    await rewindOnce(v);
    rec.start(800);
    const initiallyCut=isCutTime(0);
    if(initiallyCut&&rec.state==='recording')rec.pause();
    lastCut=initiallyCut;
    draw();
    await v.play();

    await new Promise((resolve,reject)=>{
      let lastTime=v.currentTime||0,stalls=0,lastTick=performance.now();
      const tick=()=>{
        if(v.error){reject(new Error('Decoding failed'));return}
        const t=v.currentTime||0;
        const cut=isCutTime(t);

        if(cut!==lastCut){
          try{
            if(cut&&rec.state==='recording')rec.pause();
            if(!cut&&rec.state==='paused'){segStart=t;rec.resume()}
          }catch(e){reject(new Error(`Erreur pause/resume encodeur : ${e.message||e}`));return}
          lastCut=cut;
        }

        if(Math.abs(t-lastTime)<.004){
          if(performance.now()-lastTick>250)stalls++;
        }else{
          stalls=0;lastTick=performance.now();lastTime=t;
        }
        if(stalls>45){reject(new Error('Lecture bloquée pendant le rendu'));return}

        const cutBefore=state.cutRanges.reduce((sum,[a,b])=>{
          if(t<=a)return sum;
          return sum+Math.max(0,Math.min(t,b)-a);
        },0);
        const outputTime=Math.max(0,t-cutBefore);
        const pct=62+(outputTime/keptDuration)*32;
        setProgress(pct,'Montage V4.2…',`lecture continue · ${fmt(outputTime)} / ${fmt(keptDuration)} · captions + visuels`);

        if(v.ended||t>=state.duration-.04){resolve();return}
        requestAnimationFrame(tick);
      };
      tick();
    });
  }catch(e){renderError=e}
  finally{
    drawing=false;if(raf)cancelAnimationFrame(raf);
    v.pause();
    try{if(rec.state==='paused')rec.resume()}catch{}
    await wait(90);
    try{if(rec.state!=='inactive')rec.stop()}catch{}
    try{await Promise.race([stopped,wait(2000)])}catch{}
    if(state.gain)state.gain.gain.value=1;
    v.style.visibility='visible';v.controls=true;els.renderCanvas.hidden=true;
    for(const a of state.assets)if(a.type==='video')a.el.pause();
  }

  if(renderError)throw renderError;
  if(!chunks.length)throw new Error('Aucun fichier final produit');

  const blob=new Blob(chunks,{type:mime||chunks[0].type||'video/webm'});
  setProgress(96,'Validation du Reel…','Vérification du fichier final.');
  const playable=await verifyOutput(blob);
  if(state.outputUrl)URL.revokeObjectURL(state.outputUrl);
  state.outputUrl=URL.createObjectURL(blob);
  els.outputArea.hidden=false;
  els.outputVideo.style.display='block';
  els.outputVideo.poster=canvas.toDataURL('image/jpeg',.84);
  els.outputVideo.src=state.outputUrl;els.outputVideo.load();
  els.downloadBtn.href=state.outputUrl;
  els.downloadBtn.download=`reel-v42-${Date.now()}.${ext}`;
  els.downloadBtn.textContent=`Enregistrer le Reel · ${bytes(blob.size)}`;
  els.outputMeta.textContent=`${state.preset} · ${els.aspectRatio.value} · ${w}×${h} · ${state.words.length} mots · ${state.visualPlan.length} visuels · moteur continu`;
  els.previewMode.textContent='Reel V4.2 généré';
  els.outputArea.scrollIntoView({behavior:'smooth',block:'center'});

  if(playable){
    setProgress(100,'Reel V4.2 terminé',`${state.words.length} mots captionnés · ${state.visualPlan.length} visuels · rendu sans seeks`);
  }else{
    setProgress(100,'Reel V4.2 généré','Preview Safari limitée, fichier disponible.');
    showError('Le fichier est généré mais Safari refuse sa preview. Utilise “Enregistrer le Reel”.');
  }
}

export async function runRenderWithCompatibility(){
  try{return await renderContinuous()}
  catch(e){
    const msg=String(e?.message||e);
    if(!state.normalized&&/Decoding failed|Lecture bloquée|decode/i.test(msg)){
      await normalizeForSafari();
      return await renderContinuous();
    }
    throw e;
  }
}
