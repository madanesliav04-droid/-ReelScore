/**
 * Edit+ V11: evidence-first visual + speech decisions.
 * AI bounding boxes require subsequent pixel QA; reject questionable edits.
 */
const tok=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim().split(/\s+/).filter(Boolean);
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const safeRects={top:[.19,.115,.81,.25],left:[.095,.30,.43,.50],right:[.57,.30,.865,.50]};
const intersect=(a,b)=>a[0]<b[2]&&a[2]>b[0]&&a[1]<b[3]&&a[3]>b[1];
function timedMatch(phrase,words){
 const target=tok(phrase),flat=[];
 if(!target.length||target.length>14)return null;
 for(const w of words||[])for(const t of tok(w.text))flat.push({t,s:Number(w.startMs),e:Number(w.endMs)});
 for(let i=0;i<=flat.length-target.length;i++){
  if(target.every((s,j)=>s===flat[i+j].t)){
   const startMs=flat[i].s,endMs=flat[i+target.length-1].e;
   if(Number.isFinite(startMs)&&Number.isFinite(endMs)&&endMs>startMs)return {startMs,endMs};
  }
 }
 return null;
}
function boxes(decision){
 const r=decision?.protected_regions;
 if(!Array.isArray(r)||!r.length)return null;
 const results=[];
 for(const item of r){
  if(!['face','hands','board','product','text'].includes(item?.type))continue;
  const b=[item.x,item.y,item.w,item.h].map(Number);
  if(b.some(n=>!Number.isFinite(n))||b.some(n=>n<0||n>1)||b[2]<.01||b[3]<.01||b[0]+b[2]>1.005||b[1]+b[3]>1.005)return null;
  results.push([b[0],b[1],b[0]+b[2],b[1]+b[3]]);
 }
 return results.length?results:null;
}
function chooseLane(request,protectedRects){
 const preference=String(request||'').toLowerCase();
 const order=['top','left','right'];
 if(order.includes(preference)){order.splice(order.indexOf(preference),1);order.unshift(preference);}
 return order.find(lane=>protectedRects.every(rect=>!intersect(safeRects[lane],rect)))||null;
}
export function buildVisualEditorialDecisions({analysis,mappedWords,outputDurationMs,maxPer30s=2}={}){
 const raw=analysis?.editorial_director?.decisions;
 const evidence=Array.isArray(raw)?raw:[],words=Array.isArray(mappedWords)?mappedWords:[];
 const rejected=[],accepted=[],duration=Math.max(0,Number(outputDurationMs)||0);
 const limit=Math.min(6,Math.ceil(duration/30000*clamp(maxPer30s,1,3)));
 if(!evidence.length||!words.length||duration<1000)return {cues:[],punchIns:[],rejected:[{reason:'no_multimodal_observations_or_timed_words'}],origin:'gemini_video_plus_timed_asr'};
 for(const d of evidence.slice(0,20)){
  const action=String(d?.action||'').toLowerCase(),text=String(d?.spoken_anchor||'').trim();
  if(!['graphic','soft_punch','hold'].includes(action)){rejected.push({reason:'unsupported_or_external_visual',action});continue;}
  if(action==='hold')continue;
  const visual=Number(d?.visual_confidence),audio=Number(d?.audio_confidence);
  if(!Number.isFinite(visual)||!Number.isFinite(audio)||visual<.83||audio<.85||!String(d?.visual_evidence||'').trim()){rejected.push({reason:'insufficient_multimodal_evidence',action});continue;}
  const match=timedMatch(text,words);
  if(!match||text.length>60){rejected.push({reason:'no_verbatim_timed_anchor',action});continue;}
  if(!Number.isFinite(Number(d.start_sec))||Math.abs(match.startMs/1000-Number(d.start_sec))>1.2){rejected.push({reason:'timestamp_disagreement',action});continue;}
  if(match.startMs<0||match.endMs>duration+250){rejected.push({reason:'out_of_timeline',action});continue;}
  const protectedRects=boxes(d);
  if(!protectedRects){rejected.push({reason:'no_valid_visual_boxes',action});continue;}
  const lane=action==='graphic'?chooseLane(d.safe_area,protectedRects):null;
  if(action==='graphic'&&!lane){rejected.push({reason:'no_safe_placement',action});continue;}
  if(action==='soft_punch'&&(protectedRects.some(r=>r[0]<.16||r[2]>.84||r[1]<.08||r[3]>.90)||d?.subject_centered!==true)){
   rejected.push({reason:'unsafe_center_crop',action});continue;
  }
  accepted.push({action,text,startMs:match.startMs,endMs:Math.min(duration,Math.max(match.endMs,match.startMs+1250)),lane,
   evidence:'gemini_visual_observation_plus_verbatim_timed_words',visualConfidence:visual,audioConfidence:audio,
   visualEvidence:String(d.visual_evidence).slice(0,200)});
 }
 accepted.sort((a,b)=>a.startMs-b.startMs);
 const selected=[];
 for(const c of accepted){
  if(selected.length>=limit)break;
  if(selected.some(p=>c.startMs<p.endMs+2300&&c.endMs>p.startMs-2300)){rejected.push({reason:'too_dense',action:c.action});continue;}
  selected.push(c);
 }
 return {
  cues:selected.filter(c=>c.action==='graphic').map(c=>({...c,mode:'multimodal_organic',kind:'evidence_based'})),
  punchIns:selected.filter(c=>c.action==='soft_punch').map(c=>({startMs:c.startMs,endMs:c.endMs,scale:1.045,reason:'visual_and_speech_evidence',evidence:c.evidence})),
  rejected,origin:'gemini_video_plus_timed_asr',limitations:'model_boxes_not_independently_verified'
 };
}
