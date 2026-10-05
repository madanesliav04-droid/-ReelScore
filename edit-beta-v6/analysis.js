async function decodeAudio(file){
  const C=window.AudioContext||window.webkitAudioContext;if(!C)throw new Error('Analyse audio indisponible sur ce navigateur.');const ctx=new C();try{return await ctx.decodeAudioData((await file.arrayBuffer()).slice(0))}finally{ctx.close().catch(()=>{})}
}
function analyseAudioBuffer(buffer){
  const rate=buffer.sampleRate,frameSec=.05,frame=Math.max(256,Math.floor(rate*frameSec)),rms=[];
  for(let s=0;s<buffer.length;s+=frame){let sum=0,n=0,en=Math.min(buffer.length,s+frame);for(let ch=0;ch<buffer.numberOfChannels;ch++){const d=buffer.getChannelData(ch);for(let i=s;i<en;i+=4){sum+=d[i]*d[i];n++}}rms.push(Math.sqrt(sum/Math.max(1,n)))}
  const sorted=[...rms].sort((a,b)=>a-b),p=(q)=>sorted[Math.floor((sorted.length-1)*q)]||0,ref=p(.75),thr=clamp(ref*.18,.0025,.035),silences=[];let start=null;
  for(let i=0;i<=rms.length;i++){const silent=i<rms.length?rms[i]<thr:false;if(silent&&start===null)start=i;if(!silent&&start!==null){const a=start*frameSec,b=i*frameSec;if(b-a>.32)silences.push({id:uid('sil'),start:a,end:b,duration:b-a,reason:'silence'});start=null}}
  const peak=p(.88),strong=[];for(let i=2;i<rms.length-2;i++){if(rms[i]>=peak&&rms[i]>=rms[i-1]&&rms[i]>=rms[i+1]){const t=i*frameSec;if(strong.every(x=>Math.abs(x.time-t)>1.2))strong.push({time:t,score:clamp(rms[i]/Math.max(.001,peak),1,2),reason:'energy'})}}
  return{silences,energy:rms,strong,strongMoments:strong,avgEnergy:rms.reduce((a,b)=>a+b,0)/Math.max(1,rms.length)};
}

async function transcribe(audioBuffer){
  if(!audioBuffer)return{text:'',words:[],language:'unknown'};
  setStatus('Transcription locale');
  const lib=await import('https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.3.0');lib.env.allowLocalModels=false;lib.env.useBrowserCache=true;
  const rate=16000,O=window.OfflineAudioContext||window.webkitOfflineAudioContext;if(!O)throw new Error('Transcription locale non supportée.');
  const off=new O(1,Math.ceil(audioBuffer.duration*rate),rate),mix=off.createBuffer(1,audioBuffer.length,audioBuffer.sampleRate),dst=mix.getChannelData(0);for(let ch=0;ch<audioBuffer.numberOfChannels;ch++){const src=audioBuffer.getChannelData(ch);for(let i=0;i<src.length;i++)dst[i]+=src[i]/audioBuffer.numberOfChannels}const node=off.createBufferSource();node.buffer=mix;node.connect(off.destination);node.start();const rendered=await off.startRendering();
  const pipe=await lib.pipeline('automatic-speech-recognition','onnx-community/whisper-tiny',{device:'wasm',dtype:'q4'});
  const out=await pipe(rendered.getChannelData(0),{task:'transcribe',return_timestamps:'word',chunk_length_s:24,stride_length_s:4});
  const words=(out.chunks||[]).map(x=>({text:String(x.text||'').trim(),start:Number(x.timestamp?.[0]||0),end:Number(x.timestamp?.[1]??x.timestamp?.[0]??0)+.03})).filter(x=>x.text&&Number.isFinite(x.start));
  return{text:String(out.text||'').trim(),words,language:out.language||detectLanguage(out.text)};
}
function detectLanguage(text=''){const s=text.toLowerCase();const fr=(s.match(/\b(le|la|les|des|une|est|avec|pour|que|dans|sur|pas|mais)\b/g)||[]).length;const en=(s.match(/\b(the|and|is|with|for|that|in|on|not|but|you)\b/g)||[]).length;return fr===en?'unknown':fr>en?'fr':'en'}

function enrichAnalysis(a){
  const words=a.words||[],text=(a.text||'').toLowerCase();a.numbers=[];a.fillers=[];a.cta=[];a.repetitions=[];a.overlayOpportunities=[];a.brollOpportunities=[];a.important=[...(a.strong||[])];
  words.forEach((w,i)=>{const clean=w.text.toLowerCase().replace(/[^\p{L}\p{N}%€$.,-]/gu,'');if(/\d/.test(clean)){a.numbers.push({...w,reason:'number'});a.overlayOpportunities.push({time:w.start,type:'number',text:w.text,score:1.4,reason:'chiffre important'})}if(FILLERS.has(clean)){a.fillers.push({...w,reason:'filler'})}if(CTA_WORDS.some(k=>clean.includes(k))){a.cta.push({...w,reason:'cta'});a.important.push({time:w.start,score:1.45,reason:'cta'})}if(i>0&&clean&&clean===words[i-1].text.toLowerCase().replace(/[^\p{L}\p{N}]/gu,'')){a.repetitions.push({start:words[i-1].start,end:w.end,reason:'repeat'})}});
  for(let i=0;i<words.length;i++){const phrase=words.slice(i,i+7).map(x=>x.text).join(' ').toLowerCase();const triggers=['parce que','le problème','la solution','voilà pourquoi','imagine','exemple','regarde','preuve','résultat','avant','après','application','site','produit'];if(triggers.some(t=>phrase.includes(t))){a.brollOpportunities.push({time:words[i].start,score:1.2,reason:'compréhension',query:phrase.slice(0,80)});i+=3}}
  a.hook={start:0,end:Math.min(3,state.source.duration),weak:false,reason:''};const intro=text.slice(0,90);const initialSilence=a.silences.find(s=>s.start<.12&&s.duration>.38);const greet=GREETINGS.find(g=>intro.includes(g));if(initialSilence||greet){a.hook.weak=true;a.hook.reason=initialSilence?'blanc au début':'introduction générique';a.hook.cutTo=initialSilence?.end||((words.find((w,i)=>i>2&&w.start<4)?.start)||0)}
  if(!a.brollOpportunities.length&&a.strong?.length){a.brollOpportunities=a.strong.filter((_,i)=>i%2===0).slice(0,5).map(x=>({time:x.time,score:x.score,reason:'rythme / moment fort',query:'visuel de respiration'}))}
  a.speechRate=words.length?words.length/Math.max(.1,state.source.duration)*60:0;a.type=inferContentType(text,a);a.topic=extractTopic(words);a.emotion=a.avgEnergy>.08?'énergique':a.avgEnergy>.035?'équilibrée':'posée';
  a.important.sort((x,y)=>y.score-x.score);const kept=[];for(const m of a.important){if(kept.every(k=>Math.abs(k.time-m.time)>1.35))kept.push(m);if(kept.length>=16)break}a.important=kept.sort((x,y)=>x.time-y.time);
}
function inferContentType(text,a){if(/produit|application|service|commande|acheter|prix|offre/.test(text))return'ugc';if(/étape|conseil|erreur|méthode|comment|pourquoi|astuce/.test(text)||a.numbers.length>=2)return'educational';if(/quand j|un jour|histoire|je me souviens|au début|finalement/.test(text))return'storytelling';if(/podcast|invité|question|interview/.test(text))return'podcast';return a.speechRate>155?'dynamic':'clean'}
function extractTopic(words){return words.filter(w=>w.text.length>4&&!FILLERS.has(w.text.toLowerCase())).slice(0,8).map(w=>w.text).join(' ')||'contenu facecam'}
function recommendStyle(a){if(a.type&&STYLE_PRESETS[a.type])return a.type;if(a.speechRate>165)return'dynamic';return'clean'}
function renderAnalysisSummary(){const a=state.analysis;els.analysisSummary.hidden=false;els.analysisSummary.innerHTML=[`Langue · ${a.language==='fr'?'Français':a.language==='en'?'Anglais':'Auto'}`,`Type · ${STYLE_PRESETS[a.type]?.name||a.type}`,`Rythme · ${a.speechRate?Math.round(a.speechRate)+' mots/min':'audio'}`,`${a.silences.length} blancs`,`${a.important.length} moments forts`,`${a.brollOpportunities.length} opportunités B-roll`,a.hook.weak?'Hook à optimiser':'Hook conservé'].map(x=>`<span>${escapeHtml(x)}</span>`).join('')}

function applyStyleSelection(key){state.selectedStyle=key;qsa('.styleCard').forEach(b=>b.classList.toggle('selected',b.dataset.style===key));const resolved=key==='auto'?(state.project?.resolvedStyle||recommendStyle(state.analysis||{})):key;const preset=STYLE_PRESETS[resolved];els.subtitlePreset.value=preset.subtitleStyle;state.project.style=key;state.project.resolvedStyle=resolved;applyCaptionPreset(preset.subtitleStyle,false);track('style_selected',{style:key,resolved})}
function applyCaptionPreset(key,trackIt=true){const cur=state.project?.captionSettings||{};state.project.captionSettings={...deepClone(SUBTITLE_PRESETS[key]),color:cur.color||SUBTITLE_PRESETS[key].color,accent:cur.accent||SUBTITLE_PRESETS[key].accent};syncCaptionControls();if(trackIt)track('subtitle_changed',{preset:key})}
function syncCaptionControls(){const c=state.project.captionSettings;els.captionFont.value=c.font;els.captionSize.value=c.size;els.captionWeight.value=String(c.weight);els.captionColor.value=c.color;els.captionAccent.value=c.accent;els.captionPosition.value=String(c.position);els.captionBg.checked=!!c.bg;els.captionOutline.checked=!!c.outline;els.captionShadow.checked=!!c.shadow;els.captionAnimation.value=c.animation;els.captionLines.value=String(c.maxLines)}
