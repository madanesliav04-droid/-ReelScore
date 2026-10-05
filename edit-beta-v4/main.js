import {els,state,applyAspectUI,updatePresetUI,setProgress,showError,clearError} from './state.js';
import {handleFile,handleBroll,analyseAudio,transcribeLocal,manualWords,buildVisualPlan} from './media.js';
import {runRenderWithCompatibility} from './render.js';

els.aspectRatio.addEventListener('change',applyAspectUI);els.quality.addEventListener('change',applyAspectUI);applyAspectUI();
els.presetGrid.addEventListener('click',e=>{const b=e.target.closest('.preset');if(!b)return;document.querySelectorAll('.preset').forEach(x=>x.classList.remove('active'));b.classList.add('active');state.preset=b.dataset.preset;updatePresetUI()});updatePresetUI();
els.videoInput.addEventListener('change',e=>handleFile(e.target.files?.[0]));
els.brollInput.addEventListener('change',e=>handleBroll(e.target.files));

els.createBtn.addEventListener('click',async()=>{
 if(state.rendering||!state.file)return;state.rendering=true;els.createBtn.disabled=true;clearError();els.outputArea.hidden=true;
 try{
  setProgress(2,'Analyse du rush…','Création du plan de montage V4.');const buffer=await analyseAudio();
  if(els.autoCaptions.checked&&buffer){try{await transcribeLocal(buffer)}catch(e){console.warn('captions auto failed',e);els.captionStatus.textContent='Captions auto indisponibles sur cet appareil — fallback texte manuel.';if(els.manualTranscript.value.trim())manualWords()}}
  else if(els.manualTranscript.value.trim())manualWords();
  if(!state.words.length&&els.manualTranscript.value.trim())manualWords();
  buildVisualPlan();setProgress(52,'Plan V4 prêt',`${state.cutRanges.length} cuts · ${state.punchTimes.length} punch-ins · ${state.visualPlan.length} visuels · ${state.words.length} mots`);
  await runRenderWithCompatibility();
 }catch(e){console.error(e);showError(e.message||'Erreur de rendu');setProgress(0,'Rendu interrompu','Le rush original reste intact.')}
 finally{state.rendering=false;els.createBtn.disabled=!state.file;if(state.gain)state.gain.gain.value=1;els.sourceVideo.style.visibility='visible';els.sourceVideo.controls=true;els.renderCanvas.hidden=true}
});
window.addEventListener('beforeunload',()=>{if(state.objectUrl)URL.revokeObjectURL(state.objectUrl);if(state.outputUrl)URL.revokeObjectURL(state.outputUrl);for(const a of state.assets)URL.revokeObjectURL(a.url)});
