async function transcribe(buffer){
 if(!el.autoCaptions.checked||!buffer)return false;
 el.captionStatus.textContent='Chargement de Whisper local…';progress(18,'Captions automatiques','Chargement du modèle local.');
 try{
   const timeout=new Promise((_,rej)=>setTimeout(()=>rej(new Error('Transcription locale trop longue')),45000));
   const work=(async()=>{
     const lib=await import('https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.3.0');
     lib.env.allowLocalModels=false;lib.env.useBrowserCache=true;
     const Offline=window.OfflineAudioContext||window.webkitOfflineAudioContext;if(!Offline)throw new Error('Rééchantillonnage indisponible');
     const rate=16000,offline=new Offline(1,Math.ceil(buffer.duration*rate),rate),mono=offline.createBuffer(1,buffer.length,buffer.sampleRate),out=mono.getChannelData(0);
     for(let c=0;c<buffer.numberOfChannels;c++){const src=buffer.getChannelData(c);for(let i=0;i<src.length;i++)out[i]+=src[i]/buffer.numberOfChannels;}
     const s=offline.createBufferSource();s.buffer=mono;s.connect(offline.destination);s.start();const rendered=await offline.startRendering();
     let pipe=null;try{if('gpu' in navigator)pipe=await lib.pipeline('automatic-speech-recognition','onnx-community/whisper-tiny',{device:'webgpu',dtype:'q4'});}catch{}
     if(!pipe)pipe=await lib.pipeline('automatic-speech-recognition','onnx-community/whisper-tiny',{device:'wasm',dtype:'q4'});
     const opts={task:'transcribe',return_timestamps:'word',chunk_length_s:24,stride_length_s:4};if(el.language.value!=='auto')opts.language=el.language.value;
     const r=await pipe(rendered.getChannelData(0),opts);const chunks=Array.isArray(r?.chunks)?r.chunks:[];state.words=chunks.map(c=>({text:String(c.text||'').trim(),start:Number(c.timestamp?.[0]||0),end:Number(c.timestamp?.[1]??c.timestamp?.[0]??0)+.05})).filter(w=>w.text);if(r?.text&&!el.manual.value.trim())el.manual.value=String(r.text).trim();return state.words.length>0;
   })();
   const ok=await Promise.race([work,timeout]);el.captionStatus.textContent=ok?`✓ ${state.words.length} mots synchronisés`:'Aucun mot détecté';return ok;
 }catch(e){console.warn('transcription fallback',e);el.captionStatus.textContent='Transcription auto indisponible — le montage continue.';return false;}
}
