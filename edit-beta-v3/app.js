const $ = id => document.getElementById(id);
const els = {
  videoInput:$('videoInput'), fileState:$('fileState'), fileName:$('fileName'), fileMeta:$('fileMeta'),
  sourceVideo:$('sourceVideo'), previewPlaceholder:$('previewPlaceholder'), renderCanvas:$('renderCanvas'),
  createBtn:$('createBtn'), progressWrap:$('progressWrap'), progressLabel:$('progressLabel'), progressPct:$('progressPct'),
  progressBar:$('progressBar'), progressDetail:$('progressDetail'), errorBox:$('errorBox'), presetGrid:$('presetGrid'),
  captionStyle:$('captionStyle'), fontStyle:$('fontStyle'), captionPosition:$('captionPosition'), quality:$('quality'),
  aspectRatio:$('aspectRatio'), removeSilences:$('removeSilences'), manualTranscript:$('manualTranscript'),
  formatPill:$('formatPill'), previewMode:$('previewMode'), outputArea:$('outputArea'), outputVideo:$('outputVideo'),
  outputMeta:$('outputMeta'), downloadBtn:$('downloadBtn'), phoneScreen:$('phoneScreen')
};

const state = {file:null, objectUrl:null, outputUrl:null, duration:0, preset:'authority', cutRanges:[], keepSegments:[], punchTimes:[], words:[], rendering:false};
const PRESETS = {
  authority:{silence:.48,threshold:.20,pad:.10,zoom:1.10,gap:2.6},
  punch:{silence:.30,threshold:.24,pad:.06,zoom:1.15,gap:1.6},
  story:{silence:.68,threshold:.16,pad:.14,zoom:1.07,gap:4.2},
  ugc:{silence:.78,threshold:.14,pad:.16,zoom:1.045,gap:5.0},
  podcast:{silence:.44,threshold:.20,pad:.11,zoom:1.12,gap:2.3},
  minimal:{silence:.74,threshold:.15,pad:.15,zoom:1.035,gap:5.5}
};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const fmt=s=>{const m=Math.floor(s/60),x=Math.floor(s%60).toString().padStart(2,'0');return `${m}:${x}`};
const bytes=n=>n<1048576?`${(n/1024).toFixed(0)} KB`:`${(n/1048576).toFixed(1)} MB`;
function setProgress(p,label,detail=''){p=clamp(Math.round(p),0,100);els.progressWrap.hidden=false;els.progressPct.textContent=`${p}%`;els.progressBar.style.width=`${p}%`;els.progressLabel.textContent=label;els.progressDetail.textContent=detail}
function showError(m){els.errorBox.hidden=false;els.errorBox.textContent=m}
function clearError(){els.errorBox.hidden=true;els.errorBox.textContent=''}
function once(target,event,timeout=8000){return new Promise((resolve,reject)=>{let timer;const clean=()=>{clearTimeout(timer);target.removeEventListener(event,ok);target.removeEventListener('error',bad)};const ok=e=>{clean();resolve(e)};const bad=()=>{clean();reject(new Error(`Échec ${event}`))};target.addEventListener(event,ok,{once:true});target.addEventListener('error',bad,{once:true});timer=setTimeout(()=>{clean();reject(new Error(`Timeout ${event}`))},timeout)})}
function revoke(){if(state.objectUrl)URL.revokeObjectURL(state.objectUrl);if(state.outputUrl)URL.revokeObjectURL(state.outputUrl)}
function applyAspectUI(){const r=els.aspectRatio.value;els.formatPill.textContent=`${r} · ${els.quality.value==='2160'?'4K':els.quality.value+'p'}`;const map={'9:16':'9/16','4:5':'4/5','1:1':'1/1','16:9':'16/9'};els.phoneScreen.style.aspectRatio=map[r];els.phoneScreen.style.height='auto';els.phoneScreen.style.maxHeight=r==='16:9'?'320px':'620px'}
els.aspectRatio.addEventListener('change',applyAspectUI);els.quality.addEventListener('change',applyAspectUI);applyAspectUI();
async function handleFile(file){
  if(!file)return;clearError();
  if(!(file.type?.startsWith('video/')||/\.(mp4|mov|m4v|webm)$/i.test(file.name))){showError('Choisis une vidéo MP4, MOV, M4V ou WebM.');return}
  if(state.objectUrl)URL.revokeObjectURL(state.objectUrl);state.file=file;state.objectUrl=URL.createObjectURL(file);
  const v=els.sourceVideo;v.pause();v.src=state.objectUrl;v.playsInline=true;v.preload='auto';v.style.display='block';v.style.visibility='visible';els.previewPlaceholder.style.display='none';
  els.fileState.hidden=false;els.fileName.textContent=file.name;els.fileMeta.textContent=`${bytes(file.size)} · lecture…`;els.createBtn.disabled=true;
  try{v.load();if(v.readyState<1)await once(v,'loadedmetadata');state.duration=Number(v.duration)||0;if(!state.duration)throw new Error('Durée illisible');if(state.duration>300)throw new Error('Maximum 5 minutes pour cette bêta.');els.fileMeta.textContent=`${bytes(file.size)} · ${fmt(state.duration)} · ${v.videoWidth||'?'}×${v.videoHeight||'?'}`;els.createBtn.disabled=false;els.previewMode.textContent='Rush original'}catch(e){showError(`La vidéo a été sélectionnée mais Safari ne peut pas la lire correctement : ${e.message}`)}
}
els.videoInput.addEventListener('change',e=>handleFile(e.target.files?.[0]));
els.presetGrid.addEventListener('click',e=>{const b=e.target.closest('.preset');if(!b)return;document.querySelectorAll('.preset').forEach(x=>x.classList.remove('active'));b.classList.add('active');state.preset=b.dataset.preset});
function percentile(vals,p){if(!vals.length)return 0;const a=[...vals].sort((x,y)=>x-y);return a[Math.floor((a.length-1)*p)]||0}
async function analyseAudio(){
  const Ctx=window.AudioContext||window.webkitAudioContext;if(!Ctx||!els.removeSilences.checked){state.keepSegments=[[0,state.duration]];state.cutRanges=[];state.punchTimes=[];return}
  setProgress(8,'Analyse audio…','Détection des silences et du rythme.');
  const ctx=new Ctx();let buf;try{buf=await ctx.decodeAudioData((await state.file.arrayBuffer()).slice(0))}finally{ctx.close().catch(()=>{})}
  const cfg=PRESETS[state.preset],rate=buf.sampleRate,frameSec=.05,frame=Math.max(256,Math.floor(rate*frameSec)),rms=[];
  for(let start=0;start<buf.length;start+=frame){let sum=0,count=0,end=Math.min(buf.length,start+frame);for(let c=0;c<buf.numberOfChannels;c++){const d=buf.getChannelData(c);for(let i=start;i<end;i+=3){sum+=d[i]*d[i];count++}}rms.push(Math.sqrt(sum/Math.max(1,count)))}
  const ref=percentile(rms,.78),thr=clamp(ref*cfg.threshold,.0035,.038),silent=rms.map(v=>v<thr),cuts=[];let begin=null;
  for(let i=0;i<=silent.length;i++){const q=i<silent.length?silent[i]:false;if(q&&begin===null)begin=i;if(!q&&begin!==null){const a0=begin*frameSec,b0=i*frameSec;if(b0-a0>=cfg.silence){const a=Math.max(0,a0+cfg.pad),b=Math.min(state.duration,b0-cfg.pad);if(b-a>.16)cuts.push([a,b])}begin=null}}
  if(cuts.reduce((s,[a,b])=>s+b-a,0)>state.duration*.42)cuts.length=0;
  const keep=[];let cur=0;for(const[a,b]of cuts){if(a>cur+.04)keep.push([cur,a]);cur=Math.max(cur,b)}if(cur<state.duration-.02)keep.push([cur,state.duration]);if(!keep.length)keep.push([0,state.duration]);
  const peak=percentile(rms,.86),cand=[];for(let i=2;i<rms.length-2;i++)if(rms[i]>=peak&&rms[i]>=rms[i-1]&&rms[i]>=rms[i+1])cand.push({t:i*frameSec,v:rms[i]});cand.sort((a,b)=>b.v-a.v);const punches=[];for(const p of cand){if(p.t<.4||p.t>state.duration-.3||cuts.some(([a,b])=>p.t>=a&&p.t<=b))continue;if(punches.every(t=>Math.abs(t-p.t)>=cfg.gap))punches.push(p.t);if(punches.length>=12)break}punches.sort((a,b)=>a-b);
  state.keepSegments=keep;state.cutRanges=cuts;state.punchTimes=punches;
}
function makeWords(){const text=els.manualTranscript.value.trim();if(!text){state.words=[];return}const toks=text.split(/\s+/).filter(Boolean),total=state.keepSegments.reduce((s,[a,b])=>s+b-a,0)||state.duration,step=total/toks.length;state.words=[];for(let i=0;i<toks.length;i++){const o1=i*step,o2=(i+1)*step;state.words.push({text:toks[i],start:sourceAt(o1),end:sourceAt(o2)});}function sourceAt(off){let r=off;for(const[a,b]of state.keepSegments){const len=b-a;if(r<=len)return a+r;r-=len}return state.keepSegments.at(-1)?.[1]||state.duration}}
function wordAt(t){const i=state.words.findIndex(w=>t>=w.start&&t<=w.end+.06);if(i<0)return null;const from=Math.max(0,i-2),to=Math.min(state.words.length,i+3);return {list:state.words.slice(from,to),current:i-from}}
function punchScale(t){const z=PRESETS[state.preset].zoom;for(const p of state.punchTimes)if(Math.abs(t-p)<.5)return z;return 1}
function drawCover(ctx,v,w,h,z=1){const vw=v.videoWidth||1080,vh=v.videoHeight||1920,ta=w/h,sa=vw/vh;let sw,sh,sx,sy;if(sa>ta){sh=vh;sw=vh*ta;sx=(vw-sw)/2;sy=0}else{sw=vw;sh=vw/ta;sx=0;sy=(vh-sh)/2}sw/=z;sh/=z;sx=(vw-sw)/2;sy=(vh-sh)/2;ctx.drawImage(v,sx,sy,sw,sh,0,0,w,h)}
function captions(ctx,w,h,t){const d=wordAt(t);if(!d)return;const size=Math.max(30,Math.round(w*.065)),family=els.fontStyle.value==='editorial'?'Georgia,serif':els.fontStyle.value==='impact'?'Arial Black,Arial,sans-serif':'Arial,Helvetica,sans-serif';ctx.save();ctx.textAlign='center';ctx.textBaseline='middle';ctx.font=`900 ${size}px ${family}`;ctx.lineJoin='round';const text=d.list.map(x=>x.text.toUpperCase()).join(' '),y=els.captionPosition.value==='middle'?h*.53:els.captionPosition.value==='midlow'?h*.70:h*.80;ctx.strokeStyle='rgba(0,0,0,.8)';ctx.lineWidth=Math.max(4,w*.008);ctx.strokeText(text,w/2,y,w*.86);ctx.fillStyle='#fff';ctx.fillText(text,w/2,y,w*.86);ctx.restore()}
function dims(){const q=els.quality.value,r=els.aspectRatio.value,base=q==='2160'?2160:q==='720'?720:1080;if(r==='9:16')return[base,Math.round(base*16/9)];if(r==='4:5')return[base,Math.round(base*5/4)];if(r==='1:1')return[base,base];return[Math.round(base*16/9),base]}
function mimeChoice(){if(!window.MediaRecorder)return null;const ios=/iPhone|iPad|iPod/.test(navigator.userAgent)||(/Mac/.test(navigator.userAgent)&&navigator.maxTouchPoints>1);const list=ios?['video/mp4','video/mp4;codecs=avc1.42E01E,mp4a.40.2','video/webm;codecs=vp8,opus','video/webm']:['video/webm;codecs=vp9,opus','video/webm;codecs=vp8,opus','video/mp4','video/webm'];return list.find(x=>MediaRecorder.isTypeSupported(x))||''}
async function robustSeek(v,time){const targets=[time,Math.max(0,time-.08),Math.max(0,time-.16)];for(let attempt=0;attempt<targets.length;attempt++){try{v.pause();v.currentTime=targets[attempt];await Promise.race([once(v,'seeked',3000),wait(350)]);if(v.readyState<2)await Promise.race([once(v,'canplay',3000),wait(500)]);if(v.error)throw new Error(v.error.message||'decode');return}catch(e){if(attempt===targets.length-1)throw e;v.load();await Promise.race([once(v,'loadedmetadata',3000),wait(500)])}}}
async function ensureAudio(v){const Ctx=window.AudioContext||window.webkitAudioContext;if(!Ctx)return null;if(!state.audioContext){state.audioContext=new Ctx();state.srcNode=state.audioContext.createMediaElementSource(v);state.gain=state.audioContext.createGain();state.srcNode.connect(state.gain);state.gain.connect(state.audioContext.destination)}if(state.audioContext.state==='suspended')await state.audioContext.resume();const dest=state.audioContext.createMediaStreamDestination();state.srcNode.connect(dest);return dest}
async function verifyOutput(blob){const test=document.createElement('video');test.playsInline=true;test.preload='metadata';const u=URL.createObjectURL(blob);try{test.src=u;test.load();await once(test,'loadedmetadata',6000);return true}catch{return false}finally{URL.revokeObjectURL(u)}}
async function render(){
  if(!window.MediaRecorder||!els.renderCanvas.captureStream)throw new Error('Ce navigateur ne permet pas le rendu local.');
  const [w,h]=dims(),canvas=els.renderCanvas,ctx=canvas.getContext('2d',{alpha:false});canvas.width=w;canvas.height=h;const mime=mimeChoice();if(mime===null)throw new Error('MediaRecorder indisponible');const ext=mime.includes('mp4')?'mp4':'webm';
  setProgress(60,'Préparation du rendu…',`${w}×${h} · ${ext.toUpperCase()}`);const v=els.sourceVideo,dest=await ensureAudio(v);if(state.gain)state.gain.gain.value=0;const cvs=canvas.captureStream(30),tracks=[...cvs.getVideoTracks()];if(dest?.stream.getAudioTracks().length)tracks.push(dest.stream.getAudioTracks()[0]);const out=new MediaStream(tracks),chunks=[];const rec=new MediaRecorder(out,mime?{mimeType:mime,videoBitsPerSecond:w>=2160?18000000:8000000,audioBitsPerSecond:160000}:{videoBitsPerSecond:8000000});rec.ondataavailable=e=>{if(e.data?.size)chunks.push(e.data)};const stopped=new Promise((res,rej)=>{rec.onstop=res;rec.onerror=()=>rej(new Error('Encodage interrompu'))});
  const total=state.keepSegments.reduce((s,[a,b])=>s+b-a,0)||state.duration;let done=0,raf=0,drawing=true;const draw=()=>{if(!drawing)return;ctx.fillStyle='#07080c';ctx.fillRect(0,0,w,h);drawCover(ctx,v,w,h,punchScale(v.currentTime||0));captions(ctx,w,h,v.currentTime||0);raf=requestAnimationFrame(draw)};
  els.outputArea.hidden=true;els.renderCanvas.hidden=false;els.previewMode.textContent='Rendu en cours';v.style.visibility='hidden';v.controls=false;rec.start(800);draw();
  try{for(let i=0;i<state.keepSegments.length;i++){const[a,b]=state.keepSegments[i];await robustSeek(v,a);await v.play();await new Promise((resolve,reject)=>{let last=v.currentTime,stalls=0;const tick=()=>{if(v.error){reject(new Error('Decoding failed'));return}if(v.currentTime>=b-.03||v.ended){v.pause();resolve();return}if(Math.abs(v.currentTime-last)<.005)stalls++;else stalls=0;last=v.currentTime;if(stalls>180){reject(new Error('Lecture bloquée pendant le rendu'));return}const pct=64+((done+Math.max(0,v.currentTime-a))/Math.max(.01,total))*30;setProgress(pct,'Montage du Reel…',`${i+1}/${state.keepSegments.length} · ${fmt(done+Math.max(0,v.currentTime-a))} / ${fmt(total)}`);requestAnimationFrame(tick)};tick()});done+=b-a}}
  finally{drawing=false;if(raf)cancelAnimationFrame(raf);v.pause()}
  await wait(160);rec.stop();await stopped;if(state.gain)state.gain.gain.value=1;v.style.visibility='visible';v.controls=true;els.renderCanvas.hidden=true;if(!chunks.length)throw new Error('Aucun fichier final produit');
  const blob=new Blob(chunks,{type:mime||chunks[0].type||'video/webm'});setProgress(96,'Validation du fichier…','Vérification que la vidéo finale est relisible.');const playable=await verifyOutput(blob);
  if(state.outputUrl)URL.revokeObjectURL(state.outputUrl);state.outputUrl=URL.createObjectURL(blob);els.outputArea.hidden=false;els.outputVideo.style.display='block';els.outputVideo.poster=canvas.toDataURL('image/jpeg',.84);els.outputVideo.src=state.outputUrl;els.outputVideo.load();els.downloadBtn.href=state.outputUrl;els.downloadBtn.download=`reel-${Date.now()}.${ext}`;els.downloadBtn.textContent=`Enregistrer le Reel · ${bytes(blob.size)}`;els.outputMeta.textContent=`${els.aspectRatio.value} · ${w}×${h} · ${fmt(total)} · ${ext.toUpperCase()}`;els.previewMode.textContent='Reel généré';els.outputArea.scrollIntoView({behavior:'smooth',block:'center'});
  if(playable){setProgress(100,'Reel terminé','Le fichier final a été validé et est prêt à lire.')}else{setProgress(100,'Reel généré','La preview iPhone ne peut pas décoder ce conteneur, mais le fichier est disponible au téléchargement.');showError('Le rendu est terminé, mais Safari refuse la preview du fichier généré. Utilise “Enregistrer le Reel”.')}
}
els.createBtn.addEventListener('click',async()=>{if(state.rendering||!state.file)return;state.rendering=true;els.createBtn.disabled=true;clearError();try{setProgress(2,'Analyse du rush…','Préparation du montage.');await analyseAudio();makeWords();setProgress(52,'Plan prêt',`${state.cutRanges.length} cuts · ${state.punchTimes.length} punch-ins`);await render()}catch(e){console.error(e);showError(e.message||'Erreur de rendu');setProgress(0,'Rendu interrompu','Réessaie en 1080p si tu étais en 4K.')}finally{state.rendering=false;els.createBtn.disabled=!state.file;if(state.gain)state.gain.gain.value=1;els.sourceVideo.style.visibility='visible';els.sourceVideo.controls=true;els.renderCanvas.hidden=true}});
window.addEventListener('beforeunload',revoke);