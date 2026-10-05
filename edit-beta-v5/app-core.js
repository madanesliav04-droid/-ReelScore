'use strict';
const $ = id => document.getElementById(id);
const el = {
 boot:$('bootStatus'), videoInput:$('videoInput'), brollInput:$('brollInput'), fileInfo:$('fileInfo'), source:$('sourceVideo'), placeholder:$('placeholder'), canvas:$('renderCanvas'), screen:$('screen'),
 presetGrid:$('presetGrid'), create:$('createBtn'), language:$('language'), captionStyle:$('captionStyle'), captionPosition:$('captionPosition'), fontStyle:$('fontStyle'), autoCaptions:$('autoCaptions'), manual:$('manualTranscript'), captionStatus:$('captionStatus'), visualMode:$('visualMode'), aspect:$('aspectRatio'), framing:$('framing'), rotation:$('rotation'), quality:$('quality'), removeSilences:$('removeSilences'), assetList:$('assetList'), progress:$('progress'), progressLabel:$('progressLabel'), progressPct:$('progressPct'), progressBar:$('progressBar'), progressDetail:$('progressDetail'), error:$('errorBox'), result:$('result'), output:$('outputVideo'), outputMeta:$('outputMeta'), download:$('downloadBtn')
};
const state={file:null,url:null,duration:0,preset:'authority',cuts:[],punches:[],words:[],assets:[],outputUrl:null,rendering:false,audioCtx:null,sourceNode:null,gain:null};
const preset={
 authority:{silence:.48,thr:.20,pad:.10,zoom:1.10,gap:2.6,visualGap:7.0,visualLen:1.15,caption:'highlight'},
 punch:{silence:.30,thr:.24,pad:.06,zoom:1.15,gap:1.55,visualGap:3.7,visualLen:.9,caption:'karaoke'},
 story:{silence:.68,thr:.16,pad:.14,zoom:1.07,gap:4.2,visualGap:5.5,visualLen:1.7,caption:'multiline'},
 ugc:{silence:.78,thr:.14,pad:.16,zoom:1.045,gap:5,visualGap:9,visualLen:.9,caption:'monoline'},
 podcast:{silence:.44,thr:.20,pad:.11,zoom:1.12,gap:2.3,visualGap:6.8,visualLen:1.2,caption:'classic'},
 minimal:{silence:.74,thr:.15,pad:.15,zoom:1.03,gap:5.5,visualGap:999,visualLen:0,caption:'minimal'}
};
const isIOS=()=>/iPhone|iPad|iPod/.test(navigator.userAgent)||(/Mac/.test(navigator.userAgent)&&navigator.maxTouchPoints>1);
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const fmt=s=>`${Math.floor(s/60)}:${Math.floor(s%60).toString().padStart(2,'0')}`;
const bytes=n=>n<1048576?`${Math.round(n/1024)} KB`:`${(n/1048576).toFixed(1)} MB`;
function progress(p,label,detail=''){p=Math.max(0,Math.min(100,Math.round(p)));el.progress.classList.add('show');el.progressPct.textContent=p+'%';el.progressBar.style.width=p+'%';el.progressLabel.textContent=label;el.progressDetail.textContent=detail;}
function error(msg){el.error.textContent=String(msg||'Erreur inconnue');el.error.classList.add('show');}
function clearError(){el.error.classList.remove('show');el.error.textContent='';}
function once(target,event,timeout=10000){return new Promise((resolve,reject)=>{let timer;const ok=e=>{cleanup();resolve(e)};const bad=()=>{cleanup();reject(new Error(`Échec ${event}`))};const cleanup=()=>{clearTimeout(timer);target.removeEventListener(event,ok);target.removeEventListener('error',bad)};target.addEventListener(event,ok,{once:true});target.addEventListener('error',bad,{once:true});timer=setTimeout(()=>{cleanup();reject(new Error(`Timeout ${event}`))},timeout);});}
window.addEventListener('error',e=>{error(`Erreur JavaScript : ${e.message}`)});
window.addEventListener('unhandledrejection',e=>{error(`Erreur : ${e.reason?.message||e.reason||'promesse rejetée'}`)});

function updateScreen(){const map={'9:16':'9/16','4:5':'4/5','1:1':'1/1','16:9':'16/9'};el.screen.style.aspectRatio=map[el.aspect.value]||'9/16';}
el.aspect.addEventListener('change',updateScreen);updateScreen();
el.presetGrid.addEventListener('click',e=>{const b=e.target.closest('.preset');if(!b)return;document.querySelectorAll('.preset').forEach(x=>x.classList.remove('active'));b.classList.add('active');state.preset=b.dataset.preset;el.captionStyle.value=preset[state.preset].caption;});

el.videoInput.addEventListener('change',async e=>{
 clearError();const file=e.target.files?.[0];if(!file)return;
 if(state.url)URL.revokeObjectURL(state.url);state.file=file;state.url=URL.createObjectURL(file);state.words=[];state.cuts=[];state.punches=[];
 el.source.src=state.url;el.source.style.display='block';el.placeholder.style.display='none';el.source.load();el.create.disabled=true;el.fileInfo.classList.add('show');el.fileInfo.textContent='Lecture des métadonnées…';
 try{if(el.source.readyState<1)await once(el.source,'loadedmetadata',12000);state.duration=Number(el.source.duration)||0;if(!state.duration)throw new Error('Durée illisible');if(state.duration>300)throw new Error('Cette bêta est limitée à 5 minutes');el.fileInfo.textContent=`${file.name} · ${bytes(file.size)} · ${fmt(state.duration)} · ${el.source.videoWidth}×${el.source.videoHeight}`;el.create.disabled=false;progress(0,'Prêt','Le moteur est branché.');}
 catch(err){error(err.message);}
});

async function loadAsset(file){const url=URL.createObjectURL(file);if(file.type.startsWith('image/')){const img=new Image();img.src=url;await once(img,'load',12000);return{type:'image',url,el:img,duration:Infinity}}const v=document.createElement('video');v.src=url;v.muted=true;v.playsInline=true;v.preload='auto';v.load();await once(v,'loadedmetadata',12000);return{type:'video',url,el:v,duration:Number(v.duration)||1};}
el.brollInput.addEventListener('change',async e=>{for(const a of state.assets)URL.revokeObjectURL(a.url);state.assets=[];el.assetList.innerHTML='';for(const f of [...(e.target.files||[])].slice(0,8)){try{const a=await loadAsset(f);state.assets.push(a);const c=document.createElement('span');c.className='chip';c.textContent=(a.type==='video'?'🎬 ':'🖼️ ')+f.name;el.assetList.appendChild(c);}catch(err){console.warn('asset',err)}}});

function pct(vals,p){if(!vals.length)return 0;const a=[...vals].sort((x,y)=>x-y);return a[Math.floor((a.length-1)*p)]||0;}
async function analyseAudio(){
 progress(6,'Analyse audio','Détection des silences et des moments d’énergie.');
 if(!el.removeSilences.checked){state.cuts=[];state.punches=[];return null;}
 const Ctx=window.AudioContext||window.webkitAudioContext;if(!Ctx){state.cuts=[];state.punches=[];return null;}
 const ctx=new Ctx();let buf;try{buf=await ctx.decodeAudioData((await state.file.arrayBuffer()).slice(0));}catch(e){console.warn('audio decode fallback',e);state.cuts=[];state.punches=[];return null;}finally{ctx.close().catch(()=>{})}
 const cfg=preset[state.preset],frameSec=.05,frame=Math.max(256,Math.floor(buf.sampleRate*frameSec)),rms=[];
 for(let start=0;start<buf.length;start+=frame){let sum=0,count=0,end=Math.min(buf.length,start+frame);for(let c=0;c<buf.numberOfChannels;c++){const d=buf.getChannelData(c);for(let i=start;i<end;i+=3){sum+=d[i]*d[i];count++;}}rms.push(Math.sqrt(sum/Math.max(1,count)));}
 const ref=pct(rms,.78),thr=Math.max(.0035,Math.min(.038,ref*cfg.thr)),silent=rms.map(x=>x<thr),cuts=[];let begin=null;
 for(let i=0;i<=silent.length;i++){const s=i<silent.length?silent[i]:false;if(s&&begin===null)begin=i;if(!s&&begin!==null){const a0=begin*frameSec,b0=i*frameSec;if(b0-a0>=cfg.silence){const a=Math.max(0,a0+cfg.pad),b=Math.min(state.duration,b0-cfg.pad);if(b-a>.18)cuts.push([a,b]);}begin=null;}}
 if(cuts.reduce((s,[a,b])=>s+b-a,0)>state.duration*.42)cuts.length=0;state.cuts=cuts;
 const peak=pct(rms,.86),cand=[];for(let i=2;i<rms.length-2;i++){if(rms[i]>=peak&&rms[i]>=rms[i-1]&&rms[i]>=rms[i+1])cand.push({t:i*frameSec,v:rms[i]});}cand.sort((a,b)=>b.v-a.v);const punches=[];for(const c of cand){if(c.t<.4||c.t>state.duration-.3||cuts.some(([a,b])=>c.t>=a&&c.t<=b))continue;if(punches.every(t=>Math.abs(t-c.t)>=cfg.gap))punches.push(c.t);if(punches.length>=12)break;}state.punches=punches.sort((a,b)=>a-b);return buf;
}
