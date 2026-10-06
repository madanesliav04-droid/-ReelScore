import {createReadStream} from 'node:fs';
import {stat} from 'node:fs/promises';
import {spawn} from 'node:child_process';

const GOOGLE_BASE='https://generativelanguage.googleapis.com';

const WEIGHTS={
  hook:20,
  scroll_stop:10,
  clarity:10,
  rhythm:10,
  retention:15,
  structure:10,
  text_captions:5,
  visual:5,
  audio:5,
  cta:5,
  originality:5
};

const clamp=n=>Math.max(0,Math.min(100,Math.round(Number(n)||0)));
const avg=(...xs)=>xs.reduce((a,b)=>a+b,0)/Math.max(1,xs.length);

export async function analyzeVideo({filePath,mimeType,fileName,geminiKey,model='gemini-3.8-flash',fallbackModel='gemini-3.5-flash-lite',onProgress=async()=>{}}){
  await onProgress('processing',12,'Extraction des signaux mesurables');
  const measurable=await extractMeasurableSignals(filePath);

  await onProgress('transcribing',35,'Lecture audio, parole et texte');
  const uploaded=await uploadGeminiFile({filePath,mimeType,fileName,geminiKey});
  let semantic;
  try{
    const active=await waitForGeminiFile(uploaded.name,geminiKey);
    await onProgress('analyzing',58,'Analyse multimodale');
    semantic=await generateSemanticAnalysis({
      fileUri:active.uri,
      mimeType:active.mimeType||mimeType,
      geminiKey,
      models:[model,fallbackModel],
      measurable
    });
  }finally{
    if(uploaded?.name) await deleteGeminiFile(uploaded.name,geminiKey).catch(()=>{});
  }

  await onProgress('generating_report',82,'Calcul du score et du rapport');
  const normalized=normalizeScores(semantic,measurable);
  const finalScore=scoreFinal(normalized);
  const timeline=normalizeTimeline(semantic.timeline, measurable.durationSec);

  return {
    final_score:finalScore,
    score_version:'vp-score-3-measured',
    score_weights:WEIGHTS,
    scores:normalized,
    measurable,
    verdict:String(semantic.verdict||''),
    main_problem:String(semantic.main_problem||''),
    why:String(semantic.why||''),
    detected_spoken_hook:String(semantic.detected_spoken_hook||'INDETECTABLE'),
    detected_visual_hook:String(semantic.detected_visual_hook||'INDETECTABLE'),
    detected_title_text:String(semantic.detected_title_text||'INDETECTABLE'),
    detected_cta:String(semantic.detected_cta||'INDETECTABLE'),
    recommended_hook:String(semantic.recommended_hook||''),
    alternative_hooks:Array.isArray(semantic.alternative_hooks)?semantic.alternative_hooks.slice(0,3):[],
    recommended_title:String(semantic.recommended_title||''),
    recommended_cta:String(semantic.recommended_cta||''),
    timeline,
    action_items:Array.isArray(semantic.action_items)?semantic.action_items.slice(0,6):[],
    score_evidence:semantic.score_evidence||{},
    model_used:semantic.model_used||model,
    confidence:semantic.confidence||{},
    analysis_basis:'measured_signals_plus_multimodal_reasoning'
  };
}

async function extractMeasurableSignals(filePath){
  const probe=JSON.parse(await run('ffprobe',['-v','quiet','-print_format','json','-show_format','-show_streams',filePath]));
  const video=(probe.streams||[]).find(s=>s.codec_type==='video')||{};
  const audio=(probe.streams||[]).find(s=>s.codec_type==='audio')||{};
  const durationSec=Number(probe.format?.duration||video.duration||audio.duration||0);
  const fps=parseRate(video.avg_frame_rate||video.r_frame_rate);

  const silenceRaw=await runCaptureStderr('ffmpeg',['-hide_banner','-i',filePath,'-af','silencedetect=noise=-35dB:d=0.25','-f','null','-']);
  const silences=parseSilences(silenceRaw,durationSec);
  const silenceSec=silences.reduce((s,x)=>s+Math.max(0,x.end-x.start),0);

  const sceneRaw=await runCaptureStderr('ffmpeg',['-hide_banner','-i',filePath,'-vf',"select='gt(scene,0.35)',showinfo",'-an','-f','null','-']);
  const sceneCuts=[...sceneRaw.matchAll(/pts_time:([0-9.]+)/g)].map(m=>Number(m[1])).filter(Number.isFinite);

  const volumeRaw=audio.codec_name?await runCaptureStderr('ffmpeg',['-hide_banner','-i',filePath,'-af','volumedetect','-f','null','-']):'';
  const meanVolume=matchNum(volumeRaw,/mean_volume:\s*(-?[0-9.]+) dB/);
  const maxVolume=matchNum(volumeRaw,/max_volume:\s*(-?[0-9.]+) dB/);

  return {
    durationSec:round(durationSec,3),
    width:Number(video.width||0),
    height:Number(video.height||0),
    fps:round(fps,2),
    videoCodec:video.codec_name||null,
    audioCodec:audio.codec_name||null,
    silenceWindows:silences.slice(0,80),
    silenceRatio:durationSec?round(silenceSec/durationSec,4):0,
    longestSilenceSec:round(Math.max(0,...silences.map(x=>x.end-x.start)),3),
    firstSilenceStartSec:silences[0]?.start??null,
    sceneCutsSec:sceneCuts.slice(0,120),
    sceneCutsPer10Sec:durationSec?round(sceneCuts.length/(durationSec/10),2):0,
    meanVolumeDb:meanVolume,
    maxVolumeDb:maxVolume,
    aspectRatio:video.width&&video.height?round(video.width/video.height,4):null
  };
}

function normalizeScores(semantic,m){
  const s=semantic?.scores||{};
  const hook=clamp(s.hook);
  const visual=clamp(s.visual);
  const structure=clamp(s.structure);
  const clarity=clamp(s.clarity);
  const originality=clamp(s.originality);
  const cta=clamp(s.cta);
  const text=clamp(s.text_captions);

  const silencePenalty=Math.min(26, Math.max(0,(m.silenceRatio-0.08)*90) + Math.max(0,(m.longestSilenceSec-0.7)*9));
  const cutDensity=m.sceneCutsPer10Sec;
  const densityScore=cutDensity<0.4?42:cutDensity<1?58:cutDensity<=4.5?78:cutDensity<=7?68:55;
  const rhythm=clamp(avg(clamp(s.rhythm),densityScore)-silencePenalty);
  const audioBase=m.audioCodec?78:20;
  const loudnessPenalty=m.meanVolumeDb!=null && m.meanVolumeDb<-28?12:0;
  const audio=clamp(avg(clamp(s.audio),audioBase)-silencePenalty*0.35-loudnessPenalty);
  const scrollStop=clamp(avg(clamp(s.scroll_stop),hook,visual));
  const retention=clamp(avg(clamp(s.retention),hook,rhythm,structure,scrollStop)-silencePenalty*0.25);

  return {hook,scroll_stop:scrollStop,clarity,rhythm,retention,structure,text_captions:text,visual,audio,cta,originality};
}

function scoreFinal(scores){
  const total=Object.entries(WEIGHTS).reduce((sum,[k,w])=>sum+clamp(scores[k])*w,0);
  return Math.round(total/100);
}

function normalizeTimeline(items,durationSec){
  const arr=Array.isArray(items)?items:[];
  return arr.slice(0,10).map(x=>({
    start_sec:round(Number(x.start_sec)||0,2),
    end_sec:round(Math.max(Number(x.end_sec)||0,Number(x.start_sec)||0),2),
    severity:['green','orange','red'].includes(x.severity)?x.severity:'orange',
    label:String(x.label||'Moment à vérifier'),
    problem:String(x.problem||''),
    correction:String(x.correction||'')
  })).filter(x=>x.start_sec<=durationSec+1);
}

async function generateSemanticAnalysis({fileUri,mimeType,geminiKey,models,measurable}){
  const prompt=`Tu es Viral+, moteur d'analyse éditoriale de vidéos courtes. Tu dois analyser uniquement cette vidéo réelle et les signaux techniques mesurés ci-dessous. Tu n'as pas accès aux poids privés de Meta et tu ne dois jamais promettre la viralité.

SIGNAUX MESURÉS:
${JSON.stringify(measurable)}

Retourne UNIQUEMENT un JSON valide. Scores 0-100, sévères, avec preuve observable. Schéma:
{
"scores":{"hook":0,"scroll_stop":0,"clarity":0,"rhythm":0,"retention":0,"structure":0,"text_captions":0,"visual":0,"audio":0,"cta":0,"originality":0},
"score_evidence":{"hook":"","scroll_stop":"","clarity":"","rhythm":"","retention":"","structure":"","text_captions":"","visual":"","audio":"","cta":"","originality":""},
"verdict":"","main_problem":"","why":"",
"detected_spoken_hook":"","detected_visual_hook":"","detected_title_text":"","detected_cta":"",
"recommended_hook":"","alternative_hooks":["","",""],"recommended_title":"","recommended_cta":"",
"timeline":[{"start_sec":0,"end_sec":2,"severity":"red","label":"","problem":"","correction":""}],
"action_items":["","",""],
"confidence":{"audio":0,"visual":0,"text":0}
}

Contraintes: timeline 5 à 8 points couvrant début/milieu/fin; chaque correction doit être exécutable; si un élément est indétectable écris INDETECTABLE; 80+ exige une preuve exceptionnelle et précise.`;
  let last;
  for(const model of [...new Set(models.filter(Boolean))]){
    try{
      const r=await fetch(`${GOOGLE_BASE}/v1beta/models/${encodeURIComponent(model)}:generateContent`,{
        method:'POST',
        headers:{'x-goog-api-key':geminiKey,'content-type':'application/json'},
        body:JSON.stringify({
          contents:[{role:'user',parts:[{file_data:{mime_type:mimeType,file_uri:fileUri}},{text:prompt}]}],
          generationConfig:{responseMimeType:'application/json',temperature:0.15}
        })
      });
      if(!r.ok) throw new Error(`Gemini ${model} ${r.status}: ${(await r.text()).slice(0,400)}`);
      const body=await r.json();
      const text=(body.candidates||[]).flatMap(c=>c.content?.parts||[]).map(p=>p.text||'').join('').trim();
      const parsed=parseJson(text); parsed.model_used=model; return parsed;
    }catch(e){last=e;}
  }
  throw last||new Error('Aucun modèle Gemini disponible');
}

async function uploadGeminiFile({filePath,mimeType,fileName,geminiKey}){
  const s=await stat(filePath);
  const start=await fetch(`${GOOGLE_BASE}/upload/v1beta/files`,{
    method:'POST',headers:{
      'x-goog-api-key':geminiKey,
      'X-Goog-Upload-Protocol':'resumable',
      'X-Goog-Upload-Command':'start',
      'X-Goog-Upload-Header-Content-Length':String(s.size),
      'X-Goog-Upload-Header-Content-Type':mimeType,
      'Content-Type':'application/json'
    },body:JSON.stringify({file:{display_name:fileName}})
  });
  if(!start.ok) throw new Error(`Gemini upload init ${start.status}: ${(await start.text()).slice(0,300)}`);
  const uploadUrl=start.headers.get('x-goog-upload-url');
  if(!uploadUrl) throw new Error('URL upload Gemini absente');
  const up=await fetch(uploadUrl,{method:'POST',headers:{'Content-Type':mimeType,'Content-Length':String(s.size),'X-Goog-Upload-Offset':'0','X-Goog-Upload-Command':'upload, finalize'},body:createReadStream(filePath),duplex:'half'});
  if(!up.ok) throw new Error(`Gemini upload ${up.status}: ${(await up.text()).slice(0,300)}`);
  const b=await up.json();
  if(!b.file?.name) throw new Error('Réponse Gemini Files invalide');
  return b.file;
}

async function waitForGeminiFile(name,key){
  for(let i=0;i<60;i++){
    const r=await fetch(`${GOOGLE_BASE}/v1beta/${name}`,{headers:{'x-goog-api-key':key}});
    if(!r.ok) throw new Error(`Gemini file status ${r.status}`);
    const f=await r.json(); const state=String(f.state||'').toUpperCase();
    if(state==='ACTIVE') return f;
    if(state==='FAILED') throw new Error('Gemini ne peut pas traiter cette vidéo');
    await new Promise(r=>setTimeout(r,2000));
  }
  throw new Error('Préparation Gemini trop longue');
}
async function deleteGeminiFile(name,key){await fetch(`${GOOGLE_BASE}/v1beta/${name}`,{method:'DELETE',headers:{'x-goog-api-key':key}});}
function parseJson(text){const t=text.replace(/^\`\`\`(?:json)?\\s*/i,'').replace(/\`\`\`$/,'').trim();const a=t.indexOf('{'),b=t.lastIndexOf('}');return JSON.parse(a>=0&&b>a?t.slice(a,b+1):t);}
function parseRate(v){const [a,b]=String(v||'0/1').split('/').map(Number);return b?a/b:0;}
function matchNum(s,re){const m=s.match(re);return m?Number(m[1]):null;}
function round(n,p=2){return Number.isFinite(Number(n))?Number(Number(n).toFixed(p)):0;}
function parseSilences(raw,duration){const starts=[...raw.matchAll(/silence_start:\\s*([0-9.]+)/g)].map(m=>Number(m[1]));const ends=[...raw.matchAll(/silence_end:\\s*([0-9.]+)/g)].map(m=>Number(m[1]));return starts.map((start,i)=>({start:round(start,3),end:round(ends[i]??duration,3)})).filter(x=>x.end>=x.start);}
function run(cmd,args){return new Promise((resolve,reject)=>{const p=spawn(cmd,args);let out='',err='';p.stdout.on('data',d=>out+=d);p.stderr.on('data',d=>err+=d);p.on('error',reject);p.on('close',c=>c===0?resolve(out):reject(new Error(`${cmd} ${c}: ${err.slice(-1200)}`)));});}
function runCaptureStderr(cmd,args){return new Promise((resolve,reject)=>{const p=spawn(cmd,args);let err='';p.stderr.on('data',d=>err+=d);p.on('error',reject);p.on('close',c=>c===0?resolve(err):reject(new Error(`${cmd} ${c}: ${err.slice(-1200)}`)));});}
