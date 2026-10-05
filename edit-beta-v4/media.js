import {els,state,PRESETS,clamp,once,bytes,fmt,setProgress,showError,clearError,applyAspectUI} from './state.js?v=43';

function orientationOf(w,h){if(!w||!h)return'unknown';if(h>w*1.08)return'portrait';if(w>h*1.08)return'landscape';return'square'}

export async function handleFile(file){
 if(!file)return;clearError();
 if(!(file.type?.startsWith('video/')||/\.(mp4|mov|m4v|webm)$/i.test(file.name))){showError('Choisis une vidéo MP4, MOV, M4V ou WebM.');return}
 if(state.objectUrl)URL.revokeObjectURL(state.objectUrl);
 state.originalFile=file;state.file=file;state.normalized=false;state.audioBuffer=null;state.audio16k=null;state.words=[];state.transcript='';state.objectUrl=URL.createObjectURL(file);
 const v=els.sourceVideo;v.pause();v.src=state.objectUrl;v.playsInline=true;v.preload='auto';v.style.display='block';v.style.visibility='visible';els.previewPlaceholder.style.display='none';
 els.fileState.hidden=false;els.fileName.textContent=file.name;els.fileMeta.textContent=`${bytes(file.size)} · lecture…`;els.createBtn.disabled=true;
 try{
  v.load();if(v.readyState<1)await once(v,'loadedmetadata');state.duration=Number(v.duration)||0;if(!state.duration)throw new Error('Durée illisible');if(state.duration>300)throw new Error('Maximum 5 minutes pour cette bêta.');
  state.sourceOrientation=orientationOf(v.videoWidth,v.videoHeight);
  if(state.sourceOrientation==='portrait'){
   if(!state.userAspectLocked)els.aspectRatio.value='9:16';
   if(!state.userFramingLocked&&els.framingMode)els.framingMode.value='vertical';
   if(!state.userRotationLocked&&els.sourceRotation)els.sourceRotation.value='auto';
   applyAspectUI();
  }
  const label=state.sourceOrientation==='portrait'?'vertical portrait':state.sourceOrientation==='landscape'?'horizontal/paysage déclaré par Safari':state.sourceOrientation==='square'?'carré':'indéterminée';
  if(els.orientationState)els.orientationState.innerHTML=`Orientation lue : <strong>${label}</strong> · ${v.videoWidth||'?'}×${v.videoHeight||'?'}${state.sourceOrientation==='landscape'?' · si ton rush est visuellement vertical, utilise Vertical natif + rotation Auto':''}`;
  els.fileMeta.textContent=`${bytes(file.size)} · ${fmt(state.duration)} · ${v.videoWidth||'?'}×${v.videoHeight||'?'} · ${label}`;els.createBtn.disabled=false;els.previewMode.textContent='Rush original';
 }catch(e){showError(`Safari ne peut pas lire correctement ce rush : ${e.message}`)}
}

async function prepareAsset(file){
 const url=URL.createObjectURL(file);
 if(file.type.startsWith('image/')){const img=new Image();img.src=url;await once(img,'load',10000);return{type:'image',file,url,el:img,duration:Infinity,width:img.naturalWidth,height:img.naturalHeight,orientation:orientationOf(img.naturalWidth,img.naturalHeight)}}
 const v=document.createElement('video');v.src=url;v.muted=true;v.playsInline=true;v.preload='auto';v.load();await once(v,'loadedmetadata',10000);return{type:'video',file,url,el:v,duration:Number(v.duration)||1,width:v.videoWidth,height:v.videoHeight,orientation:orientationOf(v.videoWidth,v.videoHeight)}
}
export async function handleBroll(filesLike){const files=[...(filesLike||[])].slice(0,8);for(const a of state.assets)URL.revokeObjectURL(a.url);state.assets=[];els.assetList.innerHTML='';for(const f of files){try{const a=await prepareAsset(f);state.assets.push(a);const c=document.createElement('span');c.className='asset-chip';const ori=a.orientation==='portrait'?'↕ vertical':a.orientation==='landscape'?'↔ horizontal':'□ carré';c.textContent=`${a.type==='video'?'🎬':'🖼️'} ${f.name} · ${ori}`;els.assetList.appendChild(c)}catch(err){console.warn('asset failed',f.name,err)}}if(state.assets.length){const c=document.createElement('span');c.className='asset-chip';c.textContent=`${state.assets.length} média(s) prêt(s)`;els.assetList.appendChild(c)}}

function percentile(vals,p){if(!vals.length)return 0;const a=[...vals].sort((x,y)=>x-y);return a[Math.floor((a.length-1)*p)]||0}
export async function analyseAudio(){
 const Ctx=window.AudioContext||window.webkitAudioContext;if(!Ctx){state.keepSegments=[[0,state.duration]];state.cutRanges=[];state.punchTimes=[];return null}
 setProgress(7,'Analyse audio…','Silences, énergie et rythme.');const ctx=new Ctx();let buf;
 try{buf=await ctx.decodeAudioData((await state.file.arrayBuffer()).slice(0));state.audioBuffer=buf}finally{ctx.close().catch(()=>{})}
 if(!els.removeSilences.checked){state.keepSegments=[[0,state.duration]];state.cutRanges=[];state.punchTimes=[];return buf}
 const cfg=PRESETS[state.preset],rate=buf.sampleRate,frameSec=.05,frame=Math.max(256,Math.floor(rate*frameSec)),rms=[];
 for(let start=0;start<buf.length;start+=frame){let sum=0,count=0,end=Math.min(buf.length,start+frame);for(let c=0;c<buf.numberOfChannels;c++){const d=buf.getChannelData(c);for(let i=start;i<end;i+=3){sum+=d[i]*d[i];count++}}rms.push(Math.sqrt(sum/Math.max(1,count)))}
 const ref=percentile(rms,.78),thr=clamp(ref*cfg.threshold,.0035,.038),silent=rms.map(v=>v<thr),cuts=[];let begin=null;
 for(let i=0;i<=silent.length;i++){const q=i<silent.length?silent[i]:false;if(q&&begin===null)begin=i;if(!q&&begin!==null){const a0=begin*frameSec,b0=i*frameSec;if(b0-a0>=cfg.silence){const a=Math.max(0,a0+cfg.pad),b=Math.min(state.duration,b0-cfg.pad);if(b-a>.16)cuts.push([a,b])}begin=null}}
 if(cuts.reduce((s,[a,b])=>s+b-a,0)>state.duration*.42)cuts.length=0;
 const keep=[];let cur=0;for(const[a,b]of cuts){if(a>cur+.04)keep.push([cur,a]);cur=Math.max(cur,b)}if(cur<state.duration-.02)keep.push([cur,state.duration]);if(!keep.length)keep.push([0,state.duration]);
 const peak=percentile(rms,.86),cand=[];for(let i=2;i<rms.length-2;i++)if(rms[i]>=peak&&rms[i]>=rms[i-1]&&rms[i]>=rms[i+1])cand.push({t:i*frameSec,v:rms[i]});cand.sort((a,b)=>b.v-a.v);const punches=[];
 for(const p of cand){if(p.t<.4||p.t>state.duration-.3||cuts.some(([a,b])=>p.t>=a&&p.t<=b))continue;if(punches.every(t=>Math.abs(t-p.t)>=cfg.gap))punches.push(p.t);if(punches.length>=Math.ceil(state.duration/Math.max(1.2,cfg.gap)))break}
 punches.sort((a,b)=>a-b);state.keepSegments=keep;state.cutRanges=cuts;state.punchTimes=punches;return buf
}

async function resample16k(buffer){if(state.audio16k)return state.audio16k;const Offline=window.OfflineAudioContext||window.webkitOfflineAudioContext;if(!Offline)throw new Error('Rééchantillonnage audio indisponible');const rate=16000,offline=new Offline(1,Math.ceil(buffer.duration*rate),rate),mono=offline.createBuffer(1,buffer.length,buffer.sampleRate),out=mono.getChannelData(0);for(let c=0;c<buffer.numberOfChannels;c++){const src=buffer.getChannelData(c);for(let i=0;i<src.length;i++)out[i]+=src[i]/buffer.numberOfChannels}const s=offline.createBufferSource();s.buffer=mono;s.connect(offline.destination);s.start();const rendered=await offline.startRendering();state.audio16k=rendered.getChannelData(0).slice();return state.audio16k}
export async function transcribeLocal(buffer){
 if(!els.autoCaptions.checked)return null;setProgress(22,'Captions automatiques…','Chargement du modèle Whisper local.');els.captionStatus.textContent='Transcription en cours…';const audio=await resample16k(buffer);
 const lib=await import('https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.3.0');lib.env.allowLocalModels=false;lib.env.useBrowserCache=true;
 const progress_callback=item=>{if(item?.status==='progress'&&Number.isFinite(item.progress))setProgress(22+item.progress*.14,'Chargement Whisper…',`${Math.round(item.progress)}%`)};let pipe=null;const model='onnx-community/whisper-tiny';
 if('gpu'in navigator){try{pipe=await lib.pipeline('automatic-speech-recognition',model,{device:'webgpu',dtype:'q4',progress_callback})}catch(e){console.warn('webgpu fallback',e)}}
 if(!pipe)pipe=await lib.pipeline('automatic-speech-recognition',model,{device:'wasm',dtype:'q4',progress_callback});setProgress(38,'Transcription…','Création des captions mot par mot.');
 const opt={task:'transcribe',return_timestamps:'word',chunk_length_s:24,stride_length_s:4};if(els.captionLanguage.value!=='auto')opt.language=els.captionLanguage.value;const r=await pipe(audio,opt);const chunks=Array.isArray(r?.chunks)?r.chunks:[];
 const words=chunks.map(c=>({text:String(c.text||'').trim(),start:Number(c.timestamp?.[0]??0),end:Number(c.timestamp?.[1]??c.timestamp?.[0]??0)+.04})).filter(w=>w.text);const text=String(r?.text||'').trim();
 if(text&&!els.manualTranscript.value.trim())els.manualTranscript.value=text;state.transcript=text;state.words=words;els.captionStatus.textContent=words.length?`✓ ${words.length} mots synchronisés automatiquement`:'Aucun mot détecté';return{text,words}
}
function sourceAt(off){let r=off;for(const[a,b]of state.keepSegments){const len=b-a;if(r<=len)return a+r;r-=len}return state.keepSegments.at(-1)?.[1]||state.duration}
export function manualWords(){const text=els.manualTranscript.value.trim();if(!text)return;const toks=text.split(/\s+/).filter(Boolean),total=state.keepSegments.reduce((s,[a,b])=>s+b-a,0)||state.duration,step=total/toks.length;state.words=toks.map((t,i)=>({text:t,start:sourceAt(i*step),end:sourceAt((i+1)*step)}));state.transcript=text;els.captionStatus.textContent=`✓ ${state.words.length} mots synchronisés depuis le texte`}
export function buildVisualPlan(){state.visualPlan=[];if(els.visualMode.value==='off'||state.preset==='minimal')return;const cfg=PRESETS[state.preset];let n=0;for(let t=1.8;t<state.duration-1;t+=cfg.visualGap){if(state.cutRanges.some(([a,b])=>t>=a&&t<=b))continue;const assetAllowed=els.visualMode.value!=='graphics'&&state.assets.length;const forceAsset=els.visualMode.value==='footage';const type=(assetAllowed&&(forceAsset||n%2===0))?'asset':'graphic';state.visualPlan.push({start:t,end:Math.min(state.duration,t+cfg.visualLen),type,assetIndex:state.assets.length?n%state.assets.length:0});n++}}
