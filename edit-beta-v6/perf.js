'use strict';

// V6 performance layer: keeps the proven editor intact while removing the long blocking analysis state.
let __editplusTransformersPromise = null;
let __editplusWhisperPromise = null;
let __editplusWhisperDevice = null;

function __editplusGetTransformers(){
  if(!__editplusTransformersPromise){
    __editplusTransformersPromise = import('https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.3.0').then(lib=>{
      lib.env.allowLocalModels = false;
      lib.env.useBrowserCache = true;
      return lib;
    });
  }
  return __editplusTransformersPromise;
}

async function __editplusGetWhisper(){
  if(__editplusWhisperPromise) return __editplusWhisperPromise;
  __editplusWhisperPromise = (async()=>{
    const lib = await __editplusGetTransformers();
    const model = 'onnx-community/whisper-tiny';
    const progress = (p)=>{
      if(!p || !Number.isFinite(p.progress)) return;
      const pct = 24 + Math.min(16, Math.max(0, p.progress) * .16);
      setAnalysisProgress(pct,'transcript',`Préparation du moteur de transcription · ${Math.round(p.progress)}%`);
    };
    if(navigator.gpu){
      try{
        setStatus('Accélération transcription');
        const pipe = await lib.pipeline('automatic-speech-recognition',model,{device:'webgpu',dtype:'q4',progress_callback:progress});
        __editplusWhisperDevice = 'GPU';
        return pipe;
      }catch(e){console.warn('Whisper WebGPU fallback',e)}
    }
    const pipe = await lib.pipeline('automatic-speech-recognition',model,{device:'wasm',dtype:'q4',progress_callback:progress});
    __editplusWhisperDevice = 'WASM';
    return pipe;
  })().catch(e=>{__editplusWhisperPromise=null;throw e});
  return __editplusWhisperPromise;
}

transcribe = async function(audioBuffer){
  if(!audioBuffer)return{text:'',words:[],language:'unknown'};
  setStatus('Transcription locale');
  const rate=16000,O=window.OfflineAudioContext||window.webkitOfflineAudioContext;
  if(!O)throw new Error('Transcription locale non supportée.');
  setAnalysisProgress(22,'transcript',localStorage.getItem('editplus_whisper_ready')?'Transcription…':'Premier lancement · préparation du moteur de transcription');
  const off=new O(1,Math.ceil(audioBuffer.duration*rate),rate),mix=off.createBuffer(1,audioBuffer.length,audioBuffer.sampleRate),dst=mix.getChannelData(0);
  for(let ch=0;ch<audioBuffer.numberOfChannels;ch++){
    const src=audioBuffer.getChannelData(ch);
    for(let i=0;i<src.length;i++)dst[i]+=src[i]/audioBuffer.numberOfChannels;
  }
  const node=off.createBufferSource();node.buffer=mix;node.connect(off.destination);node.start();
  const rendered=await off.startRendering();
  const pipe=await __editplusGetWhisper();
  localStorage.setItem('editplus_whisper_ready','1');
  setAnalysisProgress(40,'transcript',`Transcription ${__editplusWhisperDevice||''}…`);
  const out=await pipe(rendered.getChannelData(0),{task:'transcribe',return_timestamps:'word',chunk_length_s:24,stride_length_s:4});
  const words=(out.chunks||[]).map(x=>({text:String(x.text||'').trim(),start:Number(x.timestamp?.[0]||0),end:Number(x.timestamp?.[1]??x.timestamp?.[0]??0)+.03})).filter(x=>x.text&&Number.isFinite(x.start));
  return{text:String(out.text||'').trim(),words,language:out.language||detectLanguage(out.text)};
};

startAnalysis = async function(){
  setStatus('Analyse du contenu');
  setAnalysisProgress(4,'media','Analyse de la vidéo');
  let audio=null;
  try{audio=await decodeAudio(state.file)}catch(e){console.warn('audio decode',e)}
  const audioAnalysis=audio?analyseAudioBuffer(audio):{silences:[],energy:[],strong:[],avgEnergy:0};
  state.analysis={...audioAnalysis,words:[],text:'',language:'unknown'};

  // Let the user access style choices immediately instead of staring at a blocking loader.
  state.project.resolvedStyle='clean';
  state.project.style='auto';
  state.selectedStyle='auto';
  applyStyleSelection('auto');
  els.generatePreviewBtn.disabled=true;
  els.generatePreviewBtn.innerHTML='Transcription en cours…';
  showStage('style');
  setAnalysisProgress(18,'transcript',localStorage.getItem('editplus_whisper_ready')?'Transcription…':'Premier lancement du moteur de transcription…');

  const tx=await transcribe(audio).catch(e=>({text:'',words:[],language:'unknown',error:e.message}));
  state.analysis.text=tx.text||'';
  state.analysis.words=tx.words||[];
  state.analysis.language=tx.language||detectLanguage(tx.text)||'unknown';
  state.project.transcript={text:state.analysis.text,language:state.analysis.language,words:deepClone(state.analysis.words)};

  setAnalysisProgress(55,'moments','Détection des moments clés');
  enrichAnalysis(state.analysis);
  setAnalysisProgress(70,'captions','Création des sous-titres');
  setAnalysisProgress(82,'rhythm','Construction du rythme');
  setAnalysisProgress(92,'visuals','Opportunités visuelles');

  const suggested=recommendStyle(state.analysis);
  state.project.resolvedStyle=suggested;
  state.project.style='auto';
  state.selectedStyle='auto';
  applyStyleSelection('auto');
  els.transcriptFallbackBox.hidden=!!state.analysis.words.length;
  setAnalysisProgress(100,'visuals','Analyse terminée');
  qsa('[data-k]',els.analysisSteps).forEach(n=>{n.classList.remove('active');n.classList.add('done')});
  renderAnalysisSummary();
  track('analysis_completed',{language:state.analysis.language,words:state.analysis.words.length,style:suggested,silences:state.analysis.silences.length,device:__editplusWhisperDevice||'none'});
  await saveProjectMeta();
  els.generatePreviewBtn.disabled=false;
  els.generatePreviewBtn.innerHTML='Générer mon montage <span>→</span>';
  setStatus(`Analyse prête${__editplusWhisperDevice?' · '+__editplusWhisperDevice:''}`);
};

// Warm only the JS runtime after the page is idle. The model itself remains lazy until the user uploads.
if('requestIdleCallback' in window){requestIdleCallback(()=>__editplusGetTransformers().catch(()=>{}),{timeout:2500})}
