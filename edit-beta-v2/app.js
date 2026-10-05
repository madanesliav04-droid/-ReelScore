const $ = (id) => document.getElementById(id);
const els = {
  videoInput:$('videoInput'), dropzone:$('dropzone'), fileState:$('fileState'), fileName:$('fileName'), fileMeta:$('fileMeta'),
  sourceVideo:$('sourceVideo'), previewPlaceholder:$('previewPlaceholder'), renderCanvas:$('renderCanvas'), createBtn:$('createBtn'),
  progressWrap:$('progressWrap'), progressLabel:$('progressLabel'), progressPct:$('progressPct'), progressBar:$('progressBar'), progressDetail:$('progressDetail'), errorBox:$('errorBox'),
  presetGrid:$('presetGrid'), captionStyle:$('captionStyle'), captionLanguage:$('captionLanguage'), fontStyle:$('fontStyle'), captionPosition:$('captionPosition'), quality:$('quality'), brollMode:$('brollMode'), autoTranscript:$('autoTranscript'), removeSilences:$('removeSilences'), soundDesign:$('soundDesign'), manualTranscript:$('manualTranscript'),
  sourceTimeline:$('sourceTimeline'), timelineTrack:$('timelineTrack'), analysisPanel:$('analysisPanel'), statCuts:$('statCuts'), statPunches:$('statPunches'), statCaptions:$('statCaptions'), savedTime:$('savedTime'), brollSuggestions:$('brollSuggestions'), previewMode:$('previewMode'), formatPill:$('formatPill'), outputArea:$('outputArea'), outputVideo:$('outputVideo'), outputMeta:$('outputMeta'), downloadBtn:$('downloadBtn'),
  chatPanel:$('chatPanel'), chatMessages:$('chatMessages'), chatForm:$('chatForm'), chatInput:$('chatInput'), rerenderBtn:$('rerenderBtn'), projectsDialog:$('projectsDialog'), projectsList:$('projectsList')
};

const state = {
  file:null, objectUrl:null, outputUrl:null, duration:0, preset:'authority', audioBuffer:null, audio16k:null,
  keepSegments:[], cutRanges:[], punchTimes:[], words:[], transcript:'', rendering:false, planReady:false,
  audioContext:null, mediaSourceNode:null, previewGain:null, recordDest:null,
  overrides:{ zoomMultiplier:1, punchMultiplier:1, silenceMultiplier:1, captionScale:1, accent:'#ffd45a' },
  exportCount:Number(localStorage.getItem('editBetaExportCount')||0), currentProjectId:null
};

const PRESETS = {
  authority:{silenceMin:.48, thresholdFactor:.20, padding:.10, zoom:1.105, punchGap:2.6, transition:'clean', caption:'highlight'},
  punch:{silenceMin:.31, thresholdFactor:.25, padding:.06, zoom:1.15, punchGap:1.55, transition:'flash', caption:'karaoke'},
  story:{silenceMin:.67, thresholdFactor:.16, padding:.14, zoom:1.07, punchGap:4.3, transition:'soft', caption:'multiline'},
  ugc:{silenceMin:.76, thresholdFactor:.14, padding:.16, zoom:1.045, punchGap:5.2, transition:'none', caption:'monoline'},
  podcast:{silenceMin:.45, thresholdFactor:.20, padding:.11, zoom:1.12, punchGap:2.25, transition:'clean', caption:'classic'},
  minimal:{silenceMin:.72, thresholdFactor:.15, padding:.15, zoom:1.04, punchGap:5.5, transition:'none', caption:'minimal'}
};

const wait = ms => new Promise(r=>setTimeout(r,ms));
const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));
function formatTime(sec){if(!Number.isFinite(sec))return'0:00';const m=Math.floor(sec/60),s=Math.floor(sec%60).toString().padStart(2,'0');return`${m}:${s}`}
function bytesLabel(bytes){if(bytes<1048576)return`${(bytes/1024).toFixed(0)} KB`;if(bytes<1073741824)return`${(bytes/1048576).toFixed(1)} MB`;return`${(bytes/1073741824).toFixed(2)} GB`}
function once(target,event){return new Promise((resolve,reject)=>{const ok=e=>{clean();resolve(e)},bad=()=>{clean();reject(new Error(`Échec pendant ${event}`))},clean=()=>{target.removeEventListener(event,ok);target.removeEventListener('error',bad)};target.addEventListener(event,ok,{once:true});target.addEventListener('error',bad,{once:true})})}
function setProgress(p,label,detail=''){els.progressWrap.hidden=false;p=clamp(Math.round(p),0,100);els.progressPct.textContent=`${p}%`;els.progressBar.style.width=`${p}%`;els.progressLabel.textContent=label;els.progressDetail.textContent=detail}
function showError(msg){els.errorBox.hidden=false;els.errorBox.textContent=msg}
function clearError(){els.errorBox.hidden=true;els.errorBox.textContent=''}
function isIOS(){return /iPad|iPhone|iPod/.test(navigator.userAgent)||(/Mac/.test(navigator.userAgent)&&navigator.maxTouchPoints>1)}
function projectHistory(){try{return JSON.parse(localStorage.getItem('editBetaHistory')||'[]')}catch{return[]}}
function saveHistory(item){const list=projectHistory().filter(x=>x.id!==item.id);list.unshift(item);localStorage.setItem('editBetaHistory',JSON.stringify(list.slice(0,20)));renderProjects()}
function renderProjects(){const list=projectHistory();els.projectsList.innerHTML=list.length?'':'<div class="project-row"><div><strong>Aucun export pour le moment</strong><span>Ton historique local apparaîtra ici.</span></div></div>';list.forEach(p=>{const row=document.createElement('div');row.className='project-row';row.innerHTML=`<div><strong>${escapeHtml(p.name||'Reel')}</strong><span>${escapeHtml(p.preset)} · ${escapeHtml(p.quality)} · ${p.duration}</span></div><time>${new Date(p.date).toLocaleDateString('fr-FR')}</time>`;els.projectsList.appendChild(row)})}
function escapeHtml(s){return String(s).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
function resetOutput(){state.keepSegments=[];state.cutRanges=[];state.punchTimes=[];state.words=[];state.transcript='';state.planReady=false;state.audioBuffer=null;state.audio16k=null;els.analysisPanel.hidden=true;els.chatPanel.hidden=true;els.sourceTimeline.hidden=true;els.outputArea.hidden=true;els.renderCanvas.hidden=true;els.progressWrap.hidden=true;els.rerenderBtn.disabled=true;clearError();if(state.outputUrl){URL.revokeObjectURL(state.outputUrl);state.outputUrl=null}}

async function handleFile(file){
  if(!file)return; clearError();
  if(!(file.type?.startsWith('video/')||/\.(mp4|mov|m4v|webm)$/i.test(file.name))){showError('Choisis une vidéo MP4, MOV, M4V ou WebM.');return}
  if(file.size>2*1024*1024*1024){showError('Cette bêta locale accepte jusqu’à 2 Go par rush.');return}
  resetOutput(); state.file=file; state.currentProjectId=crypto.randomUUID?.()||String(Date.now());
  if(state.objectUrl)URL.revokeObjectURL(state.objectUrl); state.objectUrl=URL.createObjectURL(file);
  const v=els.sourceVideo; v.pause(); v.src=state.objectUrl; v.preload='auto'; v.playsInline=true; v.setAttribute('webkit-playsinline',''); v.style.display='block'; v.style.visibility='visible'; els.previewPlaceholder.style.display='none';
  els.fileState.hidden=false; els.fileName.textContent=file.name; els.fileMeta.textContent=`${bytesLabel(file.size)} · lecture…`; els.createBtn.disabled=true; els.previewMode.textContent='Rush original';
  try{v.load(); if(v.readyState<1)await once(v,'loadedmetadata'); state.duration=Number(v.duration)||0; if(!state.duration)throw new Error('Durée illisible'); if(state.duration>300)throw new Error('La bêta accepte des rushs jusqu’à 5 minutes.'); els.fileMeta.textContent=`${bytesLabel(file.size)} · ${formatTime(state.duration)} · ${v.videoWidth||'?'}×${v.videoHeight||'?'}`; els.createBtn.disabled=false; try{v.currentTime=Math.min(.08,Math.max(0,state.duration-.05))}catch{}}
  catch(err){showError(err?.message||'La vidéo est sélectionnée mais ce navigateur ne peut pas la décoder. Ouvre le lien dans Safari/Chrome et utilise un MOV ou MP4 standard.');els.createBtn.disabled=true}
}

els.videoInput.addEventListener('change',e=>handleFile(e.target.files?.[0]));
['dragenter','dragover'].forEach(ev=>els.dropzone.addEventListener(ev,e=>{e.preventDefault();els.dropzone.classList.add('drag')}));
['dragleave','drop'].forEach(ev=>els.dropzone.addEventListener(ev,e=>{e.preventDefault();els.dropzone.classList.remove('drag')}));
els.dropzone.addEventListener('drop',e=>handleFile(e.dataTransfer?.files?.[0]));

els.presetGrid.addEventListener('click',e=>{const b=e.target.closest('.preset');if(!b)return;document.querySelectorAll('.preset').forEach(x=>x.classList.remove('active'));b.classList.add('active');state.preset=b.dataset.preset;const suggested=PRESETS[state.preset].caption;els.captionStyle.value=suggested;if(state.planReady){recomputePlanFromBuffer();els.rerenderBtn.disabled=false}});
els.quality.addEventListener('change',()=>{els.formatPill.textContent=`9:16 · ${els.quality.value==='2160'?'4K':els.quality.value+'p'}`;if(state.planReady)els.rerenderBtn.disabled=false});
['captionStyle','fontStyle','captionPosition','brollMode'].forEach(id=>els[id].addEventListener('change',()=>{if(state.planReady)els.rerenderBtn.disabled=false}));

function percentile(vals,p){if(!vals.length)return 0;const s=[...vals].sort((a,b)=>a-b);return s[Math.floor((s.length-1)*p)]||0}
async function decodeAudio(){
  if(state.audioBuffer)return state.audioBuffer;
  if(state.file.size>420*1024*1024)throw new Error('L’analyse audio détaillée est désactivée au-dessus de 420 MB sur mobile pour protéger la mémoire. Le rendu reste possible sans auto-cut.');
  setProgress(7,'Analyse audio…','Lecture locale du son.'); const Ctx=window.AudioContext||window.webkitAudioContext;if(!Ctx)throw new Error('AudioContext indisponible.'); const buf=await state.file.arrayBuffer(); const ctx=new Ctx(); try{state.audioBuffer=await ctx.decodeAudioData(buf.slice(0));return state.audioBuffer}finally{try{await ctx.close()}catch{}}
}
function analyzeAudioPlan(buffer){
  const base=PRESETS[state.preset],cfg={...base,silenceMin:base.silenceMin*state.overrides.silenceMultiplier,punchGap:base.punchGap/state.overrides.punchMultiplier};
  const rate=buffer.sampleRate,channels=buffer.numberOfChannels,frameSec=.05,frame=Math.max(256,Math.floor(rate*frameSec)),rms=[];
  for(let start=0;start<buffer.length;start+=frame){let sum=0,count=0,end=Math.min(buffer.length,start+frame);for(let c=0;c<channels;c++){const data=buffer.getChannelData(c);for(let i=start;i<end;i+=3){const x=data[i];sum+=x*x;count++}}rms.push(Math.sqrt(sum/Math.max(1,count)))}
  const ref=percentile(rms,.78),threshold=clamp(ref*cfg.thresholdFactor,.0035,.038),silent=rms.map(v=>v<threshold),cutRanges=[];let begin=null;
  if(els.removeSilences.checked){for(let i=0;i<=silent.length;i++){const quiet=i<silent.length?silent[i]:false;if(quiet&&begin===null)begin=i;if(!quiet&&begin!==null){const a0=begin*frameSec,b0=i*frameSec;if(b0-a0>=cfg.silenceMin){const a=Math.max(0,a0+cfg.padding),b=Math.min(state.duration,b0-cfg.padding);if(b-a>.16)cutRanges.push([a,b])}begin=null}}}
  let removed=cutRanges.reduce((s,[a,b])=>s+b-a,0);if(removed>state.duration*.44){cutRanges.length=0;removed=0}
  const keepSegments=[];let cursor=0;for(const[a,b]of cutRanges){if(a>cursor+.04)keepSegments.push([cursor,a]);cursor=Math.max(cursor,b)}if(cursor<state.duration-.02)keepSegments.push([cursor,state.duration]);if(!keepSegments.length)keepSegments.push([0,state.duration]);
  const peak=percentile(rms,.86),candidates=[];for(let i=2;i<rms.length-2;i++){if(rms[i]>=peak&&rms[i]>=rms[i-1]&&rms[i]>=rms[i+1])candidates.push({t:i*frameSec,v:rms[i]})}candidates.sort((a,b)=>b.v-a.v);const punchTimes=[];for(const p of candidates){if(p.t<.4||p.t>state.duration-.3||cutRanges.some(([a,b])=>p.t>=a&&p.t<=b))continue;if(punchTimes.every(t=>Math.abs(t-p.t)>=cfg.punchGap))punchTimes.push(p.t);if(punchTimes.length>=Math.ceil(state.duration/Math.max(1.2,cfg.punchGap)))break}punchTimes.sort((a,b)=>a-b);return{cutRanges,keepSegments,punchTimes,removed}
}
function recomputePlanFromBuffer(){if(!state.audioBuffer)return;const p=analyzeAudioPlan(state.audioBuffer);state.cutRanges=p.cutRanges;state.keepSegments=p.keepSegments;state.punchTimes=p.punchTimes;renderTimeline();showAnalysis(p.removed,buildBrollSuggestions(state.transcript))}

async function resampleTo16k(buffer){if(state.audio16k)return state.audio16k;const Offline=window.OfflineAudioContext||window.webkitOfflineAudioContext;if(!Offline)throw new Error('Rééchantillonnage audio indisponible.');const rate=16000,offline=new Offline(1,Math.ceil(buffer.duration*rate),rate),mono=offline.createBuffer(1,buffer.length,buffer.sampleRate),out=mono.getChannelData(0);for(let c=0;c<buffer.numberOfChannels;c++){const src=buffer.getChannelData(c);for(let i=0;i<src.length;i++)out[i]+=src[i]/buffer.numberOfChannels}const s=offline.createBufferSource();s.buffer=mono;s.connect(offline.destination);s.start();const rendered=await offline.startRendering();state.audio16k=rendered.getChannelData(0).slice();return state.audio16k}
async function transcribeLocal(buffer){
  setProgress(27,'Sous-titres automatiques…','Premier lancement : téléchargement du modèle local.'); const audio=await resampleTo16k(buffer);
  const lib=await import('https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.3.0'); lib.env.allowLocalModels=false;lib.env.useBrowserCache=true;
  const progress_callback=item=>{if(item?.status==='progress'&&Number.isFinite(item.progress))setProgress(27+item.progress*.17,'Chargement du modèle…',`${Math.round(item.progress)}%`) };
  const model='onnx-community/whisper-tiny'; let pipe=null; if('gpu'in navigator){try{pipe=await lib.pipeline('automatic-speech-recognition',model,{device:'webgpu',dtype:'q4',progress_callback})}catch(e){console.warn('WebGPU fallback',e)}} if(!pipe)pipe=await lib.pipeline('automatic-speech-recognition',model,{device:'wasm',dtype:'q4',progress_callback});
  setProgress(45,'Transcription…','Reconnaissance vocale sur ton appareil.'); const lang=els.captionLanguage.value==='auto'?null:els.captionLanguage.value; const options={task:'transcribe',return_timestamps:'word',chunk_length_s:24,stride_length_s:4};if(lang)options.language=lang; const result=await pipe(audio,options); const chunks=Array.isArray(result?.chunks)?result.chunks:[]; return{text:String(result?.text||'').trim(),words:chunks.map(c=>({text:String(c.text||'').trim(),start:Number(c.timestamp?.[0]??0),end:Number(c.timestamp?.[1]??c.timestamp?.[0]??0)+.04})).filter(w=>w.text)}
}
function sourceTimeAtEditedOffset(offset,segments){let r=offset;for(const[a,b]of segments){const len=b-a;if(r<=len)return a+r;r-=len}return segments.at(-1)?.[1]||0}
function manualWords(text){const tokens=text.trim().split(/\s+/).filter(Boolean);if(!tokens.length)return[];const total=state.keepSegments.reduce((s,[a,b])=>s+b-a,0)||state.duration,step=total/tokens.length;return tokens.map((t,i)=>{const a=sourceTimeAtEditedOffset(i*step,state.keepSegments),b=sourceTimeAtEditedOffset(Math.min(total,(i+1)*step),state.keepSegments);return{text:t,start:a,end:Math.max(a+.08,b)}})}
function renderTimeline(){els.timelineTrack.innerHTML='';const d=state.duration||1,parts=[];let cursor=0;for(const[a,b]of state.cutRanges){if(a>cursor)parts.push({a:cursor,b:a,cut:false});parts.push({a,b,cut:true});cursor=b}if(cursor<d)parts.push({a:cursor,b:d,cut:false});if(!parts.length)parts.push({a:0,b:d,cut:false});parts.forEach(p=>{const n=document.createElement('i');n.className=`timeline-seg${p.cut?' cut':''}`;n.style.left=`${p.a/d*100}%`;n.style.width=`${(p.b-p.a)/d*100}%`;els.timelineTrack.appendChild(n)});state.punchTimes.forEach(t=>{const n=document.createElement('i');n.className='timeline-punch';n.style.left=`${t/d*100}%`;els.timelineTrack.appendChild(n)});els.sourceTimeline.hidden=false}
function buildBrollSuggestions(text){if(els.brollMode.value==='off'||!text.trim())return[];const rules=[[/argent|€|euro|revenu|vente|profit|business|chiffre/i,'Chiffres / dashboard / paiement'],[/téléphone|iphone|instagram|reel|réel|tiktok|youtube|réseau/i,'Téléphone / feed social'],[/client|prospect|appel|closing|message|dm/i,'Conversation / appel / CRM'],[/équipe|team|leader|collaborateur|réunion/i,'Équipe / réunion'],[/travail|bosser|discipline|temps|jour|semaine|calendrier/i,'Bureau / calendrier / travail'],[/restaurant|burger|menu|commande|produit/i,'Produit / cuisine / commande'],[/voyage|avion|israël|france|ville|pays/i,'Lieu / carte / déplacement']],out=[],lower=text.toLowerCase();for(const[re,label]of rules){const m=lower.match(re);if(m)out.push({time:state.duration*(m.index||0)/Math.max(1,lower.length),label})}return out.slice(0,5)}
function showAnalysis(removed,broll){els.statCuts.textContent=state.cutRanges.length;els.statPunches.textContent=state.punchTimes.length;els.statCaptions.textContent=state.words.length;els.savedTime.textContent=removed>.1?`−${removed.toFixed(1)} s`:'Rythme conservé';els.brollSuggestions.innerHTML='';if(broll.length)broll.forEach(x=>{const d=document.createElement('div');d.className='broll-item';d.innerHTML=`<time>${formatTime(x.time)}</time><span>${escapeHtml(x.label)}</span>`;els.brollSuggestions.appendChild(d)});else els.brollSuggestions.innerHTML='<div class="broll-item"><span>Facecam prioritaire : aucun B-roll forcé.</span></div>';els.analysisPanel.hidden=false}

function currentWordData(t){if(!state.words.length)return null;let idx=state.words.findIndex(w=>t>=w.start&&t<=w.end+.06);if(idx<0){const next=state.words.findIndex(w=>w.start>t);idx=next>0?next-1:-1}if(idx<0)return null;const style=els.captionStyle.value;const radius=style==='monoline'?1:style==='multiline'?4:2;const from=Math.max(0,idx-radius),to=Math.min(state.words.length,idx+radius+1);return{words:state.words.slice(from,to),current:idx-from}}
function punchScaleAt(t){const cfg=PRESETS[state.preset],target=1+(cfg.zoom-1)*state.overrides.zoomMultiplier;let best=0;for(const p of state.punchTimes){const dist=Math.abs(t-p);if(dist<.62){const phase=1-dist/.62;best=Math.max(best,Math.sin(phase*Math.PI/2))}}return 1+(target-1)*best}
function drawCover(ctx,video,w,h,zoom=1){const vw=video.videoWidth||1080,vh=video.videoHeight||1920,ta=w/h,sa=vw/vh;let sw,sh,sx,sy;if(sa>ta){sh=vh;sw=vh*ta;sx=(vw-sw)/2;sy=0}else{sw=vw;sh=vw/ta;sx=0;sy=(vh-sh)/2}const zw=sw/zoom,zh=sh/zoom;sx+=(sw-zw)/2;sy+=(sh-zh)/2;ctx.drawImage(video,sx,sy,zw,zh,0,0,w,h)}
function rr(ctx,x,y,w,h,r){r=Math.min(r,w/2,h/2);ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath()}
function captionY(h){return els.captionPosition.value==='middle'?h*.53:els.captionPosition.value==='midlow'?h*.69:h*.79}
function drawCaptions(ctx,w,h,t){const d=currentWordData(t);if(!d)return;const style=els.captionStyle.value,fc=els.fontStyle.value,family=fc==='impact'?'Arial Black,Arial,sans-serif':fc==='editorial'?'Georgia,serif':'Arial,Helvetica,sans-serif',base=(w/1080)*72*state.overrides.captionScale,size=style==='minimal'?base*.78:base;ctx.save();ctx.textAlign='center';ctx.textBaseline='middle';ctx.lineJoin='round';ctx.font=`900 ${size}px ${family}`;const tokens=d.words.map(x=>x.text.trim().toUpperCase()).filter(Boolean);const gap=size*.28,maxW=w*.84,lines=[];let line=[];for(const tok of tokens){const test=[...line,tok].join(' ');if(ctx.measureText(test).width>maxW&&line.length){lines.push(line);line=[tok]}else line.push(tok)}if(line.length)lines.push(line);const y0=captionY(h)-((lines.length-1)*(size*1.13))/2;let global=0;lines.forEach((arr,li)=>{const widths=arr.map(x=>ctx.measureText(x).width),total=widths.reduce((a,b)=>a+b,0)+gap*(arr.length-1);let x=(w-total)/2,y=y0+li*size*1.13;arr.forEach((tok,i)=>{const tw=widths[i],active=global===d.current;ctx.strokeStyle='rgba(0,0,0,.78)';ctx.lineWidth=Math.max(5,w*.008);if(style==='classic'||style==='monoline'||style==='multiline'){ctx.strokeText(tok,x+tw/2,y);ctx.fillStyle='#fff';ctx.fillText(tok,x+tw/2,y)}else if(style==='minimal'){ctx.fillStyle='#fff';ctx.shadowColor='rgba(0,0,0,.75)';ctx.shadowBlur=w*.012;ctx.fillText(tok,x+tw/2,y);ctx.shadowBlur=0}else if(style==='karaoke'){ctx.strokeText(tok,x+tw/2,y);ctx.fillStyle=active?state.overrides.accent:'#fff';ctx.fillText(tok,x+tw/2,y)}else{if(active){ctx.fillStyle=state.overrides.accent;rr(ctx,x-size*.10,y-size*.60,tw+size*.20,size*1.13,size*.11);ctx.fill();ctx.fillStyle='#101016'}else{ctx.strokeText(tok,x+tw/2,y);ctx.fillStyle='#fff'}ctx.fillText(tok,x+tw/2,y)}x+=tw+gap;global++})});ctx.restore()}
function transitionOverlay(ctx,w,h,segmentStart,t){const type=PRESETS[state.preset].transition,dt=t-segmentStart;if(dt<0||dt>.12||type==='none')return;const a=(1-dt/.12);ctx.save();if(type==='flash'){ctx.fillStyle=`rgba(255,255,255,${a*.22})`}else{ctx.fillStyle=`rgba(7,8,12,${a*.16})`}ctx.fillRect(0,0,w,h);ctx.restore()}
function supportedMime(){if(!window.MediaRecorder)return null;return ['video/mp4;codecs=avc1.42E01E,mp4a.40.2','video/mp4','video/webm;codecs=vp9,opus','video/webm;codecs=vp8,opus','video/webm'].find(x=>MediaRecorder.isTypeSupported(x))||''}
async function seekVideo(v,time){if(Math.abs(v.currentTime-time)<.04)return;const p=once(v,'seeked');v.currentTime=clamp(time,0,v.duration||time);await p}
async function ensureAudioGraph(){const Ctx=window.AudioContext||window.webkitAudioContext;if(!Ctx)return null;if(!state.audioContext)state.audioContext=new Ctx();if(state.audioContext.state==='suspended')await state.audioContext.resume();if(!state.mediaSourceNode){state.mediaSourceNode=state.audioContext.createMediaElementSource(els.sourceVideo);state.previewGain=state.audioContext.createGain();state.mediaSourceNode.connect(state.previewGain);state.previewGain.connect(state.audioContext.destination)}state.recordDest=state.audioContext.createMediaStreamDestination();state.mediaSourceNode.connect(state.recordDest);return state.recordDest}
function outputDims(){const q=els.quality.value;if(q==='2160')return[2160,3840,24000000];if(q==='720')return[720,1280,4500000];return[1080,1920,9000000]}
async function renderReel(){
  if(!els.renderCanvas.captureStream||!window.MediaRecorder)throw new Error('Le rendu local n’est pas supporté ici. Ouvre le site dans Safari 26+ ou Chrome récent.');
  const [w,h,bitrate]=outputDims();if(isIOS()&&w>=2160&&state.duration>90)showError('4K sur un long rush peut saturer la mémoire de l’iPhone. Le rendu continue, mais 1080p sera plus stable.');
  const canvas=els.renderCanvas,ctx=canvas.getContext('2d',{alpha:false,desynchronized:true});canvas.width=w;canvas.height=h;const mime=supportedMime();if(mime===null)throw new Error('MediaRecorder indisponible.');const ext=mime.includes('mp4')?'mp4':'webm';setProgress(61,'Préparation du rendu…',`${w}×${h} · ${mime||'format navigateur'}`);
  const dest=await ensureAudioGraph();if(state.previewGain)state.previewGain.gain.value=0;const cvs=canvas.captureStream(30),tracks=[...cvs.getVideoTracks()];if(dest?.stream?.getAudioTracks()?.length)tracks.push(dest.stream.getAudioTracks()[0]);const stream=new MediaStream(tracks),rec=new MediaRecorder(stream,mime?{mimeType:mime,videoBitsPerSecond:bitrate,audioBitsPerSecond:192000}:{videoBitsPerSecond:bitrate});const chunks=[];rec.ondataavailable=e=>{if(e.data?.size)chunks.push(e.data)};const stopped=new Promise((res,rej)=>{rec.onstop=res;rec.onerror=()=>rej(new Error('Encodage interrompu par le navigateur.'))});
  const v=els.sourceVideo,total=state.keepSegments.reduce((s,[a,b])=>s+b-a,0)||state.duration;let done=0,drawOn=false,raf=0,segStart=0;
  const draw=()=>{if(!drawOn)return;const t=v.currentTime||0;ctx.fillStyle='#07080c';ctx.fillRect(0,0,w,h);drawCover(ctx,v,w,h,punchScaleAt(t));drawCaptions(ctx,w,h,t);transitionOverlay(ctx,w,h,segStart,t);raf=requestAnimationFrame(draw)};
  v.controls=false;v.muted=false;els.previewMode.textContent='Rendu en cours';canvas.hidden=false;v.style.visibility='hidden';rec.start(700);if(rec.state==='recording')rec.pause();
  try{
    for(let i=0;i<state.keepSegments.length;i++){
      const [a,b]=state.keepSegments[i];v.pause();await seekVideo(v,a);segStart=a;ctx.fillStyle='#07080c';ctx.fillRect(0,0,w,h);drawCover(ctx,v,w,h,1);drawCaptions(ctx,w,h,a);drawOn=true;draw();if(rec.state==='paused')rec.resume();await v.play();
      await new Promise(resolve=>{const tick=()=>{if(v.currentTime>=b-.028||v.ended){v.pause();resolve();return}const within=Math.max(0,v.currentTime-a),pct=64+((done+within)/Math.max(.01,total))*31;setProgress(pct,'Montage du Reel…',`${i+1}/${state.keepSegments.length} · ${formatTime(done+within)} / ${formatTime(total)}`);requestAnimationFrame(tick)};tick()});
      done+=b-a;drawOn=false;if(raf)cancelAnimationFrame(raf);if(rec.state==='recording')rec.pause();
    }
  }finally{drawOn=false;if(raf)cancelAnimationFrame(raf);v.pause()}
  await wait(100);if(rec.state==='paused')rec.resume();await wait(40);rec.stop();await stopped;if(state.previewGain)state.previewGain.gain.value=1;v.controls=true;v.style.visibility='visible';canvas.hidden=true;if(!chunks.length)throw new Error('Aucun fichier vidéo n’a été produit.');
  const blob=new Blob(chunks,{type:mime||chunks[0].type||'video/webm'});if(state.outputUrl)URL.revokeObjectURL(state.outputUrl);state.outputUrl=URL.createObjectURL(blob);els.outputVideo.src=state.outputUrl;els.downloadBtn.href=state.outputUrl;els.downloadBtn.download=`edit-beta-${Date.now()}.${ext}`;els.downloadBtn.textContent=`Enregistrer le Reel · ${bytesLabel(blob.size)}`;els.outputMeta.textContent=`${w}×${h} · ${formatTime(total)} · ${ext.toUpperCase()}`;els.outputArea.hidden=false;els.previewMode.textContent='Reel généré';els.chatPanel.hidden=false;els.rerenderBtn.disabled=true;setProgress(100,'Reel terminé','Rendu réellement encodé sur ton appareil.');
  state.exportCount++;localStorage.setItem('editBetaExportCount',String(state.exportCount));saveHistory({id:state.currentProjectId||String(Date.now()),name:state.file?.name||'Reel',preset:state.preset,quality:w>=2160?'4K':`${w}p`,duration:formatTime(total),date:new Date().toISOString()});return blob
}

async function createPlan({reuseTranscript=false}={}){
  let buffer=state.audioBuffer,removed=0;if(!buffer){try{buffer=await decodeAudio()}catch(err){console.warn(err);state.keepSegments=[[0,state.duration]];state.cutRanges=[];state.punchTimes=state.preset==='minimal'?[]:[Math.min(1.2,state.duration*.25)].filter(x=>x>.1);showError(err.message)}}
  if(buffer){const p=analyzeAudioPlan(buffer);state.keepSegments=p.keepSegments;state.cutRanges=p.cutRanges;state.punchTimes=p.punchTimes;removed=p.removed}renderTimeline();setProgress(21,'Plan de montage créé',`${state.cutRanges.length} cuts · ${state.punchTimes.length} punch-ins`);
  if(!reuseTranscript){const manual=els.manualTranscript.value.trim();state.words=[];state.transcript=manual;if(els.autoTranscript.checked&&buffer){try{const r=await transcribeLocal(buffer);if(r.text){state.transcript=r.text;state.words=r.words;if(!manual)els.manualTranscript.value=r.text}}catch(err){console.warn('Whisper fallback',err);if(!manual)showError('La transcription locale n’a pas démarré sur cet appareil. Le montage continue ; tu peux coller ton texte manuellement.')}}if(!state.words.length&&els.manualTranscript.value.trim()){state.transcript=els.manualTranscript.value.trim();state.words=manualWords(state.transcript)}}
  state.planReady=true;setProgress(55,'Montage prêt',state.words.length?`${state.words.length} mots synchronisés`:'Sans captions pour cette version');showAnalysis(removed,buildBrollSuggestions(state.transcript));
}
async function createReel(){if(state.rendering||!state.file)return;state.rendering=true;els.createBtn.disabled=true;clearError();els.outputArea.hidden=true;try{setProgress(3,'Analyse du rush…','Préparation du montage automatique.');await createPlan();await renderReel();setTimeout(()=>els.outputArea.scrollIntoView({behavior:'smooth',block:'center'}),200)}catch(err){console.error(err);showError(err?.message||'Une erreur a interrompu le rendu.');setProgress(0,'Rendu interrompu','Le rush original n’a pas été modifié.')}finally{state.rendering=false;els.createBtn.disabled=!state.file;if(state.previewGain)state.previewGain.gain.value=1;els.sourceVideo.controls=true;els.sourceVideo.style.visibility='visible';els.renderCanvas.hidden=true}}
els.createBtn.addEventListener('click',createReel);

function addChat(text,kind='ai'){const d=document.createElement('div');d.className=kind==='user'?'user-msg':'ai-msg';d.textContent=text;els.chatMessages.appendChild(d);els.chatMessages.scrollTop=els.chatMessages.scrollHeight}
function applyChatCommand(raw){const t=raw.toLowerCase();const changes=[];let planChanged=false;
  if(/moins de zoom|moins.*punch|zoom.*moins/.test(t)){state.overrides.zoomMultiplier=clamp(state.overrides.zoomMultiplier*.72,.25,1.8);state.overrides.punchMultiplier=clamp(state.overrides.punchMultiplier*.78,.35,2);changes.push('zooms réduits');planChanged=true}
  if(/plus de zoom|plus.*punch|zoom.*plus/.test(t)){state.overrides.zoomMultiplier=clamp(state.overrides.zoomMultiplier*1.2,.25,1.8);state.overrides.punchMultiplier=clamp(state.overrides.punchMultiplier*1.22,.35,2);changes.push('zooms renforcés');planChanged=true}
  if(/plus naturel|naturel|moins d'effet|moins d’effet/.test(t)){state.overrides.zoomMultiplier=.65;state.overrides.punchMultiplier=.7;state.overrides.silenceMultiplier=1.2;changes.push('rythme rendu plus naturel');planChanged=true}
  if(/plus rapide|plus dynamique|plus nerveux/.test(t)){state.overrides.silenceMultiplier=.75;state.overrides.punchMultiplier=1.22;changes.push('rythme accéléré');planChanged=true}
  if(/plus lent|plus calme|plus respir/.test(t)){state.overrides.silenceMultiplier=1.3;state.overrides.punchMultiplier=.72;changes.push('davantage de respirations');planChanged=true}
  if(/sous.?titres?.*(plus haut|remonte|haut)/.test(t)){els.captionPosition.value='midlow';changes.push('sous-titres remontés')}
  if(/sous.?titres?.*(centre|milieu)/.test(t)){els.captionPosition.value='middle';changes.push('sous-titres centrés')}
  if(/sous.?titres?.*(plus bas|descend)/.test(t)){els.captionPosition.value='low';changes.push('sous-titres descendus')}
  if(/sous.?titres?.*(plus gros|agrand)/.test(t)){state.overrides.captionScale=clamp(state.overrides.captionScale*1.15,.7,1.5);changes.push('sous-titres agrandis')}
  if(/sous.?titres?.*(plus petit|rédu)/.test(t)){state.overrides.captionScale=clamp(state.overrides.captionScale*.88,.7,1.5);changes.push('sous-titres réduits')}
  if(/jaune/.test(t)){state.overrides.accent='#ffd45a';changes.push('accent jaune')}
  if(/rose/.test(t)){state.overrides.accent='#ff5fa7';changes.push('accent rose')}
  if(/violet/.test(t)){state.overrides.accent='#9b7cff';changes.push('accent violet')}
  if(/vert/.test(t)){state.overrides.accent='#5ae6a4';changes.push('accent vert')}
  if(/4k/.test(t)){els.quality.value='2160';els.quality.dispatchEvent(new Event('change'));changes.push('export 4K')}
  if(/1080/.test(t)){els.quality.value='1080';els.quality.dispatchEvent(new Event('change'));changes.push('export 1080p')}
  if(/sans b.?roll|retire.*b.?roll/.test(t)){els.brollMode.value='off';changes.push('B-roll désactivé')}
  if(/highlight|surlign/.test(t)){els.captionStyle.value='highlight';changes.push('captions Highlight')}
  if(/karaoke/.test(t)){els.captionStyle.value='karaoke';changes.push('captions Karaoke')}
  if(/minimal.*sous|sous.*minimal/.test(t)){els.captionStyle.value='minimal';changes.push('captions Minimal')}
  if(planChanged&&state.audioBuffer)recomputePlanFromBuffer();els.rerenderBtn.disabled=false;return changes
}
els.chatForm.addEventListener('submit',e=>{e.preventDefault();const t=els.chatInput.value.trim();if(!t)return;addChat(t,'user');els.chatInput.value='';const c=applyChatCommand(t);addChat(c.length?`Compris : ${c.join(', ')}. Appuie sur « Appliquer et régénérer ».`:'Je n’ai pas modifié de réglage. Essaie par exemple « moins de zooms », « plus naturel », « sous-titres plus haut » ou « passe en 4K ».')});
document.querySelectorAll('.quick-prompts button').forEach(b=>b.addEventListener('click',()=>{els.chatInput.value=b.textContent;els.chatForm.requestSubmit()}));
els.rerenderBtn.addEventListener('click',async()=>{if(state.rendering||!state.planReady)return;state.rendering=true;els.rerenderBtn.disabled=true;clearError();try{setProgress(58,'Application des modifications…','Réutilisation du plan existant.');await renderReel()}catch(err){showError(err.message)}finally{state.rendering=false}});

function scrollEditor(){document.getElementById('editor').scrollIntoView({behavior:'smooth',block:'start'});setTimeout(()=>{if(!state.file)els.videoInput.click()},520)}
['heroCreateBtn','navCreateBtn','bottomCreateBtn'].forEach(id=>$(id).addEventListener('click',scrollEditor));
$('projectsBtn').addEventListener('click',()=>{renderProjects();els.projectsDialog.showModal()});$('closeProjects').addEventListener('click',()=>els.projectsDialog.close());els.projectsDialog.addEventListener('click',e=>{if(e.target===els.projectsDialog)els.projectsDialog.close()});
window.addEventListener('beforeunload',()=>{if(state.objectUrl)URL.revokeObjectURL(state.objectUrl);if(state.outputUrl)URL.revokeObjectURL(state.outputUrl)});
if('serviceWorker'in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));renderProjects();
