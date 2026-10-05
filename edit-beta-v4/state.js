export const $=id=>document.getElementById(id);
export const els={
 videoInput:$('videoInput'),brollInput:$('brollInput'),assetList:$('assetList'),fileState:$('fileState'),fileName:$('fileName'),fileMeta:$('fileMeta'),
 sourceVideo:$('sourceVideo'),previewPlaceholder:$('previewPlaceholder'),renderCanvas:$('renderCanvas'),createBtn:$('createBtn'),progressWrap:$('progressWrap'),progressLabel:$('progressLabel'),progressPct:$('progressPct'),progressBar:$('progressBar'),progressDetail:$('progressDetail'),errorBox:$('errorBox'),
 presetGrid:$('presetGrid'),presetSummary:$('presetSummary'),captionLanguage:$('captionLanguage'),captionStyle:$('captionStyle'),fontStyle:$('fontStyle'),captionPosition:$('captionPosition'),autoCaptions:$('autoCaptions'),captionStatus:$('captionStatus'),manualTranscript:$('manualTranscript'),visualMode:$('visualMode'),aspectRatio:$('aspectRatio'),quality:$('quality'),removeSilences:$('removeSilences'),
 formatPill:$('formatPill'),previewMode:$('previewMode'),outputArea:$('outputArea'),outputVideo:$('outputVideo'),outputMeta:$('outputMeta'),downloadBtn:$('downloadBtn'),phoneScreen:$('phoneScreen')
};
export const state={file:null,originalFile:null,objectUrl:null,outputUrl:null,duration:0,preset:'authority',audioBuffer:null,audio16k:null,cutRanges:[],keepSegments:[],punchTimes:[],words:[],transcript:'',visualPlan:[],assets:[],rendering:false,normalized:false,normalizing:false,audioContext:null,srcNode:null,gain:null};
export const PRESETS={
 authority:{silence:.48,threshold:.20,pad:.10,zoom:1.105,gap:2.6,visualGap:7.5,visualLen:1.15,caption:'highlight',transition:'clean',summary:['Highlight','Modérés','Dynamique humain']},
 punch:{silence:.30,threshold:.24,pad:.06,zoom:1.15,gap:1.55,visualGap:3.8,visualLen:.85,caption:'karaoke',transition:'flash',summary:['Karaoke','Élevés','Rapide']},
 story:{silence:.68,threshold:.16,pad:.14,zoom:1.07,gap:4.2,visualGap:5.8,visualLen:1.8,caption:'multiline',transition:'soft',summary:['Multi-line','B-roll fort','Respirant']},
 ugc:{silence:.78,threshold:.14,pad:.16,zoom:1.045,gap:5.0,visualGap:9.5,visualLen:.95,caption:'monoline',transition:'none',summary:['Monoline','Faibles','Naturel']},
 podcast:{silence:.44,threshold:.20,pad:.11,zoom:1.12,gap:2.3,visualGap:7.2,visualLen:1.2,caption:'classic',transition:'clean',summary:['Classic','Quote cards','Conversation']},
 minimal:{silence:.74,threshold:.15,pad:.15,zoom:1.035,gap:5.5,visualGap:999,visualLen:0,caption:'minimal',transition:'none',summary:['Minimal','Très faibles','Clean']}
};
export const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export const wait=ms=>new Promise(r=>setTimeout(r,ms));
export const fmt=s=>{const m=Math.floor(s/60),x=Math.floor(s%60).toString().padStart(2,'0');return `${m}:${x}`};
export const bytes=n=>n<1048576?`${(n/1024).toFixed(0)} KB`:`${(n/1048576).toFixed(1)} MB`;
export function setProgress(p,label,detail=''){p=clamp(Math.round(p),0,100);els.progressWrap.hidden=false;els.progressPct.textContent=`${p}%`;els.progressBar.style.width=`${p}%`;els.progressLabel.textContent=label;els.progressDetail.textContent=detail}
export function showError(m){els.errorBox.hidden=false;els.errorBox.textContent=m}
export function clearError(){els.errorBox.hidden=true;els.errorBox.textContent=''}
export function once(target,event,timeout=8000){return new Promise((resolve,reject)=>{let timer;const clean=()=>{clearTimeout(timer);target.removeEventListener(event,ok);target.removeEventListener('error',bad)};const ok=e=>{clean();resolve(e)};const bad=()=>{clean();reject(new Error(`Échec ${event}`))};target.addEventListener(event,ok,{once:true});target.addEventListener('error',bad,{once:true});timer=setTimeout(()=>{clean();reject(new Error(`Timeout ${event}`))},timeout)})}
export function applyAspectUI(){const r=els.aspectRatio.value;els.formatPill.textContent=`${r} · ${els.quality.value==='2160'?'4K':els.quality.value+'p'}`;const map={'9:16':'9/16','4:5':'4/5','1:1':'1/1','16:9':'16/9'};els.phoneScreen.style.aspectRatio=map[r];els.phoneScreen.style.height='auto';els.phoneScreen.style.maxHeight=r==='16:9'?'320px':'620px'}
export function updatePresetUI(){const p=PRESETS[state.preset];els.captionStyle.value=p.caption;const boxes=els.presetSummary.querySelectorAll('span');p.summary.forEach((x,i)=>{if(boxes[i])boxes[i].textContent=x})}
