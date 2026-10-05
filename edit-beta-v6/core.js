const APP_VERSION = '6.0.0';
const $ = (id) => document.getElementById(id);
const qsa = (s, root=document) => [...root.querySelectorAll(s)];
const clamp = (v,a,b) => Math.max(a,Math.min(b,v));
const wait = (ms) => new Promise(r=>setTimeout(r,ms));
const uid = (p='e') => `${p}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,8)}`;
const fmt = (s=0) => `${Math.floor(s/60)}:${Math.floor(s%60).toString().padStart(2,'0')}`;
const bytes = (n=0) => n < 1048576 ? `${Math.round(n/1024)} KB` : `${(n/1048576).toFixed(1)} MB`;
const deepClone = (x) => JSON.parse(JSON.stringify(x));
function lsGet(key,fallback=null){try{return localStorage.getItem(key)??fallback}catch{return fallback}}
function lsSet(key,value){try{localStorage.setItem(key,value);return true}catch{return false}}

const els = {
  appStatus:$('appStatus'), modeToggle:$('modeToggle'), steps:qsa('.step'),
  uploadStage:$('uploadStage'), styleStage:$('styleStage'), editorStage:$('editorStage'), exportStage:$('exportStage'),
  dropZone:$('dropZone'), videoInput:$('videoInput'), dropIdle:$('dropIdle'), filePreview:$('filePreview'), thumb:$('thumb'), fileName:$('fileName'), fileMeta:$('fileMeta'), uploadBarFill:$('uploadBarFill'), uploadLabel:$('uploadLabel'),
  analysisCard:$('analysisCard'), analysisPct:$('analysisPct'), analysisBar:$('analysisBar'), analysisSteps:$('analysisSteps'), analysisSummary:$('analysisSummary'), analysisTitle:$('analysisTitle'),
  styleGrid:$('styleGrid'), transcriptFallbackBox:$('transcriptFallbackBox'), transcriptFallback:$('transcriptFallback'), applyTranscriptBtn:$('applyTranscriptBtn'), intensity:$('intensity'), subtitlePreset:$('subtitlePreset'), brollLevel:$('brollLevel'), generatePreviewBtn:$('generatePreviewBtn'), backToUpload:$('backToUpload'),
  projectTitle:$('projectTitle'), projectSummary:$('projectSummary'), styleSelect:$('styleSelect'), editorIntensity:$('editorIntensity'), intensityLabel:$('intensityLabel'), editorSubtitlePreset:$('editorSubtitlePreset'), editorBrollLevel:$('editorBrollLevel'), simplePanel:$('simplePanel'), advancedPanel:$('advancedPanel'),
  previewCanvas:$('previewCanvas'), sourceVideo:$('sourceVideo'), previewLoading:$('previewLoading'), playBtn:$('playBtn'), scrubber:$('scrubber'), currentTime:$('currentTime'), durationLabel:$('durationLabel'),
  versions:$('versions'), saveVersionBtn:$('saveVersionBtn'), exportBtn:$('exportBtn'), regenerateBtn:$('regenerateBtn'), timeline:$('timeline'), eventInspector:$('eventInspector'),
  captionFont:$('captionFont'), captionSize:$('captionSize'), captionWeight:$('captionWeight'), captionColor:$('captionColor'), captionAccent:$('captionAccent'), captionPosition:$('captionPosition'), captionBg:$('captionBg'), captionOutline:$('captionOutline'), captionShadow:$('captionShadow'), captionAnimation:$('captionAnimation'), captionLines:$('captionLines'),
  brollInput:$('brollInput'), assetList:$('assetList'), musicInput:$('musicInput'), musicVolume:$('musicVolume'), voiceEnhance:$('voiceEnhance'), brandFont:$('brandFont'), brandPrimary:$('brandPrimary'), brandSecondary:$('brandSecondary'), logoInput:$('logoInput'), useBrand:$('useBrand'), saveBrandBtn:$('saveBrandBtn'),
  exportQuality:$('exportQuality'), renderBtn:$('renderBtn'), renderProgress:$('renderProgress'), renderLabel:$('renderLabel'), renderDetail:$('renderDetail'), renderPct:$('renderPct'), renderBar:$('renderBar'), renderError:$('renderError'), renderResult:$('renderResult'), outputVideo:$('outputVideo'), outputMeta:$('outputMeta'), downloadBtn:$('downloadBtn'), backToEditor:$('backToEditor'), toast:$('toast')
};

const STYLE_PRESETS = {
  auto:{name:'Auto',desc:'Choisis le meilleur montage pour ma vidéo',energy:3,auto:true,cutIntensity:.62,subtitleStyle:'word-highlight',brollIntensity:.5,zoomIntensity:.45,motionIntensity:.28,musicIntensity:.15,soundIntensity:.15,keepBreath:.65},
  clean:{name:'Clean',desc:'Simple, moderne et professionnel.',energy:2,cutIntensity:.38,subtitleStyle:'clean',brollIntensity:.22,zoomIntensity:.25,motionIntensity:.12,musicIntensity:.08,soundIntensity:.06,keepBreath:.78},
  dynamic:{name:'Dynamic',desc:'Rapide et optimisé pour la rétention.',energy:4,cutIntensity:.82,subtitleStyle:'bold',brollIntensity:.68,zoomIntensity:.72,motionIntensity:.56,musicIntensity:.28,soundIntensity:.42,keepBreath:.40},
  storytelling:{name:'Storytelling',desc:'Pour raconter une histoire.',energy:2,cutIntensity:.36,subtitleStyle:'minimal',brollIntensity:.58,zoomIntensity:.28,motionIntensity:.18,musicIntensity:.34,soundIntensity:.16,keepBreath:.86},
  educational:{name:'Educational',desc:'Pour expliquer, enseigner ou donner des conseils.',energy:3,cutIntensity:.58,subtitleStyle:'headline',brollIntensity:.54,zoomIntensity:.42,motionIntensity:.36,musicIntensity:.10,soundIntensity:.18,keepBreath:.62},
  ugc:{name:'UGC',desc:'Pour présenter un produit, une application ou un service.',energy:3,cutIntensity:.67,subtitleStyle:'dynamic',brollIntensity:.72,zoomIntensity:.48,motionIntensity:.34,musicIntensity:.20,soundIntensity:.24,keepBreath:.52},
  podcast:{name:'Podcast',desc:'Transforme une discussion ou interview en Short.',energy:3,cutIntensity:.52,subtitleStyle:'headline',brollIntensity:.34,zoomIntensity:.58,motionIntensity:.20,musicIntensity:.07,soundIntensity:.08,keepBreath:.72},
  cinematic:{name:'Cinematic',desc:'Plus premium, esthétique et émotionnel.',energy:2,cutIntensity:.26,subtitleStyle:'minimal',brollIntensity:.46,zoomIntensity:.20,motionIntensity:.14,musicIntensity:.45,soundIntensity:.28,keepBreath:.90}
};

const SUBTITLE_PRESETS = {
  clean:{name:'Clean',font:'Inter',size:54,weight:700,color:'#ffffff',accent:'#ffffff',position:.77,bg:false,outline:true,shadow:true,animation:'fade',maxLines:2,words:5},
  bold:{name:'Bold',font:'Manrope',size:62,weight:900,color:'#ffffff',accent:'#ffd54a',position:.75,bg:false,outline:true,shadow:true,animation:'pop',maxLines:2,words:4},
  minimal:{name:'Minimal',font:'DM Sans',size:49,weight:600,color:'#ffffff',accent:'#ffffff',position:.79,bg:true,outline:false,shadow:false,animation:'fade',maxLines:2,words:6},
  dynamic:{name:'Dynamic',font:'Montserrat',size:58,weight:800,color:'#ffffff',accent:'#ff5fa7',position:.74,bg:false,outline:true,shadow:true,animation:'pop',maxLines:2,words:4},
  'word-highlight':{name:'Word Highlight',font:'Manrope',size:59,weight:900,color:'#ffffff',accent:'#ffd54a',position:.75,bg:false,outline:true,shadow:true,animation:'pop',maxLines:2,words:5,highlight:true},
  'word-by-word':{name:'Word by Word',font:'Archivo',size:64,weight:900,color:'#ffffff',accent:'#ffffff',position:.72,bg:false,outline:true,shadow:true,animation:'pop',maxLines:1,words:1,wordByWord:true},
  headline:{name:'Headline',font:'League Spartan',size:55,weight:800,color:'#ffffff',accent:'#9d8cff',position:.76,bg:false,outline:true,shadow:true,animation:'fade',maxLines:2,words:5,headline:true}
};

const FONTS = [
  ['Inter','Inter'],['Manrope','Manrope'],['DM Sans','DM Sans'],['Montserrat','Montserrat'],['Archivo','Archivo'],['League Spartan','League Spartan'],['Anton','Anton'],['Bebas Neue','Bebas Neue'],['Instrument Serif','Instrument Serif'],['Playfair Display','Playfair Display']
];
const INTENSITY_LABELS = ['Minimal','Balanced','Dynamic','High energy'];
const INTENSITY_FACTORS = [.55,1,1.28,1.58];
const BROLL_FACTORS = {none:0,light:.45,balanced:.75,important:1.15,auto:1};
const FILLERS = new Set(['euh','heu','hum','hmm','bah','ben','genre','enfin']);
const CTA_WORDS = ['abonne','abonne-toi','commente','commentaire','clique','lien','dm','envoie','partage','sauvegarde','réserve','achete','achète','commande','teste','essaye','essaie'];
const GREETINGS = ['salut tout le monde','bonjour tout le monde','hello tout le monde','salut les gars','coucou tout le monde'];

const state = {
  file:null,fileUrl:null,source:{duration:0,width:0,height:0,orientation:'unknown'},
  project:null,analysis:null,selectedStyle:'auto',assets:[],music:null,musicUrl:null,logoImage:null,versions:[],activeVersion:null,
  preview:{playing:false,raf:0,lastCutId:null},rendering:false,outputUrl:null,audioGraph:null
};

function baseProject(){
  return {
    id:uid('proj'),createdAt:new Date().toISOString(),source:null,transcript:{text:'',language:'unknown',words:[]},analysis:{},
    style:'auto',resolvedStyle:'clean',intensity:1,brollLevel:'auto',cleaning:'auto',hookOptimize:true,
    captionSettings:deepClone(SUBTITLE_PRESETS['word-highlight']),
    timeline:{cuts:[],captions:[],broll:[],overlays:[],crops:[],audio:[],music:[]},
    brandSettings:loadBrand(),renderSettings:{width:1080,height:1920,format:'mp4',videoCodec:'h264',audioCodec:'aac'},
    versions:[]
  };
}

function track(name,props={}){
  const event={name,ts:Date.now(),...props};
  let all=[];try{all=JSON.parse(lsGet('editplus_analytics','[]')||'[]')}catch{}all.push(event);lsSet('editplus_analytics',JSON.stringify(all.slice(-400)));
}
function toast(msg){els.toast.textContent=msg;els.toast.hidden=false;clearTimeout(toast.t);toast.t=setTimeout(()=>els.toast.hidden=true,2200)}
function setStatus(s){els.appStatus.textContent=s}
function setStep(name){const order=['upload','style','preview','export'];const idx=order.indexOf(name);els.steps.forEach((b,i)=>{b.classList.toggle('active',i===idx);b.classList.toggle('done',i<idx);b.disabled=i>idx});}
function showStage(name){['upload','style','editor','export'].forEach(n=>{const el=n==='upload'?els.uploadStage:n==='style'?els.styleStage:n==='editor'?els.editorStage:els.exportStage;el.hidden=n!==name});window.scrollTo({top:0,behavior:'smooth'});els.modeToggle.hidden=name!=='editor';setStep(name==='editor'?'preview':name)}
function setAnalysisProgress(p,key,detail){els.analysisCard.hidden=false;els.analysisPct.textContent=`${Math.round(p)}%`;els.analysisBar.style.width=`${p}%`;if(detail)els.analysisTitle.textContent=detail;const nodes=qsa('[data-k]',els.analysisSteps);const activeIndex=nodes.findIndex(n=>n.dataset.k===key);nodes.forEach((n,i)=>{n.classList.toggle('done',i<activeIndex);n.classList.toggle('active',i===activeIndex)});}
function setRenderProgress(p,label,detail=''){els.renderProgress.hidden=false;els.renderPct.textContent=`${Math.round(p)}%`;els.renderBar.style.width=`${p}%`;els.renderLabel.textContent=label;els.renderDetail.textContent=detail;}
function friendlyError(message, retry=true){els.renderError.hidden=false;els.renderError.innerHTML=`<strong>Le rendu s’est arrêté.</strong><span>${escapeHtml(message)}</span>${retry?'<button id="retryRender" type="button">Réessayer</button>':''}`;if(retry)$('retryRender')?.addEventListener('click',()=>renderProject());}
function escapeHtml(s=''){return String(s).replace(/[&<>"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m]))}

function buildSelects(){
  const styles=Object.entries(STYLE_PRESETS).map(([k,v])=>`<option value="${k}">${v.name}</option>`).join('');els.styleSelect.innerHTML=styles;
  const subs=Object.entries(SUBTITLE_PRESETS).map(([k,v])=>`<option value="${k}">${v.name}</option>`).join('');els.subtitlePreset.innerHTML=subs;els.editorSubtitlePreset.innerHTML=subs;
  const fonts=FONTS.map(([k,v])=>`<option value="${k}">${v}</option>`).join('');els.captionFont.innerHTML=fonts;els.brandFont.innerHTML=fonts;
  els.styleGrid.innerHTML=Object.entries(STYLE_PRESETS).map(([k,v])=>`<button class="styleCard${k==='auto'?' selected recommended':''}" data-style="${k}" type="button"><div class="styleMock"></div><b>${v.name}</b><p>${v.desc}</p><div class="energy">${[1,2,3,4,5].map(i=>`<i class="${i<=v.energy?'on':''}"></i>`).join('')}</div></button>`).join('');
}

function loadBrand(){try{return JSON.parse(lsGet('editplus_brand','null')||'null')||{font:'Inter',primary:'#8d6fff',secondary:'#ff5fa7',use:false,logoData:null}}catch{return{font:'Inter',primary:'#8d6fff',secondary:'#ff5fa7',use:false,logoData:null}}}
function saveBrand(){
  const brand={font:els.brandFont.value,primary:els.brandPrimary.value,secondary:els.brandSecondary.value,use:els.useBrand.checked,logoData:state.project?.brandSettings?.logoData||null};
  lsSet('editplus_brand',JSON.stringify(brand));if(state.project)state.project.brandSettings=brand;toast('Style enregistré');drawPreviewFrame(state.sourceVideo.currentTime||0);
}

async function init(){
  buildSelects();bindUpload();bindUI();setStatus(`V${APP_VERSION} · prêt`);track('app_opened',{version:APP_VERSION});
  const brand=loadBrand();els.brandFont.value=brand.font;els.brandPrimary.value=brand.primary;els.brandSecondary.value=brand.secondary;els.useBrand.checked=brand.use;
}

function bindUpload(){
  ['dragenter','dragover'].forEach(ev=>els.dropZone.addEventListener(ev,e=>{e.preventDefault();els.dropZone.classList.add('drag')}));
  ['dragleave','drop'].forEach(ev=>els.dropZone.addEventListener(ev,e=>{e.preventDefault();els.dropZone.classList.remove('drag')}));
  els.dropZone.addEventListener('drop',e=>{const f=e.dataTransfer?.files?.[0];if(f)acceptFile(f)});
  els.videoInput.addEventListener('change',e=>{const f=e.target.files?.[0];if(f)acceptFile(f)});
}

async function acceptFile(file){
  const ok=file.type.startsWith('video/')||/\.(mp4|mov|m4v|webm)$/i.test(file.name);if(!ok){toast('Format vidéo non supporté');return}
  track('upload_started',{size:file.size,type:file.type});
  resetRuntime();state.file=file;state.fileUrl=URL.createObjectURL(file);state.project=baseProject();
  els.dropIdle.hidden=true;els.filePreview.hidden=false;els.fileName.textContent=file.name;els.fileMeta.textContent=`${bytes(file.size)} · lecture des métadonnées…`;els.uploadBarFill.style.width='12%';els.uploadLabel.textContent='Import local sécurisé…';setStatus('Import du rush');
  const v=els.sourceVideo;v.pause();v.src=state.fileUrl;v.load();
  try{
    if(v.readyState<1)await once(v,'loadedmetadata',15000);if(!Number.isFinite(v.duration)||v.duration<=0)throw new Error('Durée vidéo illisible');if(v.duration>300)throw new Error('Cette bêta accepte les rushs jusqu’à 5 minutes.');
    state.source={duration:v.duration,width:v.videoWidth,height:v.videoHeight,orientation:v.videoHeight>v.videoWidth?'portrait':v.videoWidth>v.videoHeight?'paysage':'carré'};
    state.project.source={name:file.name,size:file.size,type:file.type,...state.source};els.fileMeta.textContent=`${bytes(file.size)} · ${fmt(v.duration)} · ${v.videoWidth}×${v.videoHeight} · ${state.source.orientation}`;
    els.uploadBarFill.style.width='100%';els.uploadLabel.textContent='Rush prêt';await makeThumbnail();track('upload_completed',{duration:v.duration,width:v.videoWidth,height:v.videoHeight});await saveProjectMeta();await startAnalysis();
  }catch(e){els.uploadLabel.textContent='Import interrompu';toast(humanizeError(e));setStatus('Erreur import')}
}

function resetRuntime(){
  if(state.fileUrl)URL.revokeObjectURL(state.fileUrl);if(state.outputUrl)URL.revokeObjectURL(state.outputUrl);state.assets.forEach(a=>URL.revokeObjectURL(a.url));state.assets=[];state.music=null;if(state.musicUrl)URL.revokeObjectURL(state.musicUrl);state.musicUrl=null;state.analysis=null;state.versions=[];state.activeVersion=null;stopPreview();
}
function once(target,event,timeout=10000){return new Promise((resolve,reject)=>{let timer;const clean=()=>{clearTimeout(timer);target.removeEventListener(event,ok);target.removeEventListener('error',bad)};const ok=e=>{clean();resolve(e)};const bad=()=>{clean();reject(new Error(`Impossible de lire la vidéo (${event}).`))};target.addEventListener(event,ok,{once:true});target.addEventListener('error',bad,{once:true});timer=setTimeout(()=>{clean();reject(new Error(`La vidéo met trop de temps à répondre (${event}).`))},timeout)})}
async function makeThumbnail(){const v=els.sourceVideo;const old=v.currentTime;try{v.currentTime=Math.min(.2,Math.max(.02,v.duration*.02));await Promise.race([once(v,'seeked',3000),wait(500)]);const c=document.createElement('canvas');c.width=270;c.height=480;const ctx=c.getContext('2d');drawCover(ctx,v,c.width,c.height,1);els.thumb.src=c.toDataURL('image/jpeg',.78)}catch{els.thumb.removeAttribute('src')}finally{try{v.currentTime=old||0}catch{}}}

async function startAnalysis(){
  setStatus('Analyse du contenu');setAnalysisProgress(4,'media','Analyse de la vidéo');let audio=null;
  try{audio=await decodeAudio(state.file)}catch(e){console.warn('audio decode',e)}
  const audioAnalysis=audio?analyseAudioBuffer(audio):{silences:[],energy:[],strong:[],avgEnergy:0};state.analysis={...audioAnalysis,words:[],text:'',language:'unknown'};
  await wait(120);setAnalysisProgress(22,'transcript','Transcription');
  const tx=await transcribe(audio).catch(e=>({text:'',words:[],language:'unknown',error:e.message}));state.analysis.text=tx.text||'';state.analysis.words=tx.words||[];state.analysis.language=tx.language||detectLanguage(tx.text)||'unknown';state.project.transcript={text:state.analysis.text,language:state.analysis.language,words:deepClone(state.analysis.words)};
  setAnalysisProgress(50,'moments','Détection des moments clés');enrichAnalysis(state.analysis);await wait(80);
  setAnalysisProgress(68,'captions','Création des sous-titres');await wait(80);
  setAnalysisProgress(78,'rhythm','Construction du rythme');await wait(80);
  setAnalysisProgress(90,'visuals','Opportunités visuelles');await wait(100);
  const suggested=recommendStyle(state.analysis);state.selectedStyle=suggested;state.project.resolvedStyle=suggested;state.project.style='auto';applyStyleSelection('auto');
  els.transcriptFallbackBox.hidden=!!state.analysis.words.length;
  setAnalysisProgress(100,'visuals','Analyse terminée');qsa('[data-k]',els.analysisSteps).forEach(n=>{n.classList.remove('active');n.classList.add('done')});renderAnalysisSummary();track('analysis_completed',{language:state.analysis.language,words:state.analysis.words.length,style:suggested,silences:state.analysis.silences.length});await saveProjectMeta();setTimeout(()=>showStage('style'),350);
}
