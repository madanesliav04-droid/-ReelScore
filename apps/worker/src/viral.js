import {createReadStream} from 'node:fs';
import {stat} from 'node:fs/promises';
import {spawn} from 'node:child_process';

const GOOGLE_BASE='https://generativelanguage.googleapis.com';

export const SCORE_WEIGHTS={
  hook:20,
  scroll_stop:10,
  clarity:10,
  rhythm:5,
  retention:20,
  structure:10,
  text_captions:5,
  visual:5,
  audio:5,
  cta:0,
  originality:10
};

const clamp=n=>Math.max(0,Math.min(100,Math.round(Number(n)||0)));
const avg=(...xs)=>xs.reduce((a,b)=>a+b,0)/Math.max(1,xs.length);

export async function analyzeVideo({
  filePath,
  mimeType,
  fileName,
  geminiKey,
  model='gemini-3.8-flash',
  fallbackModel='gemini-3.5-flash-lite',
  transcribeModel='gemini-3.5-transcribe',
  onProgress=async()=>{}
}){
  await onProgress('processing',12,'Extraction des signaux mesurables');
  const measurable=await extractMeasurableSignals(filePath);

  let transcript={text:'',words:[],captions:[],error:null,model:null};
  if(measurable.audioCodec){
    await onProgress('transcribing',28,'Transcription horodatée');
    try{
      transcript=await transcribeFromVideo({
        filePath,fileName,geminiKey,model:transcribeModel
      });
    }catch(error){
      try{
        transcript=await transcribeFallbackFromVideo({
          filePath,
          fileName,
          geminiKey,
          models:[model,fallbackModel],
          durationSec:measurable.durationSec
        });
        transcript.error=`Primary transcription failed: ${String(error?.message||error).slice(0,260)}`;
      }catch(fallbackError){
        transcript={
          text:'',
          words:[],
          captions:[],
          error:[
            String(error?.message||error).slice(0,260),
            String(fallbackError?.message||fallbackError).slice(0,220)
          ].join(' | '),
          model:transcribeModel
        };
      }
    }
  }

  measurable.wordCount=transcript.words.length;
  measurable.wordsPerMinute=measurable.durationSec
    ?round(transcript.words.length/(measurable.durationSec/60),1)
    :0;

  await onProgress('analyzing',45,'Préparation de l’analyse multimodale');
  const uploaded=await uploadGeminiFile({
    filePath,mimeType,fileName,geminiKey
  });

  let semantic;
  try{
    const active=await waitForGeminiFile(uploaded.name,geminiKey);
    await onProgress('analyzing',60,'Analyse multimodale');
    semantic=await generateSemanticAnalysis({
      fileUri:active.uri,
      mimeType:active.mimeType||mimeType,
      geminiKey,
      models:[model,fallbackModel],
      measurable,
      transcript
    });
  }finally{
    if(uploaded?.name)await deleteGeminiFile(uploaded.name,geminiKey).catch(()=>{});
  }

  await onProgress('generating_report',84,'Calcul du Viral Score');
  const normalized=normalizeScores(semantic,measurable);
  const finalScore=scoreFinal(normalized);
  const timeline=normalizeTimeline(semantic.timeline,measurable.durationSec);

  return {
    final_score:finalScore,
    score_version:'vp-score-4-scale-safe',
    score_weights:SCORE_WEIGHTS,
    scores:normalized,
    measurable,
    transcript,
    verdict:String(semantic.verdict||''),
    main_problem:String(semantic.main_problem||''),
    why:String(semantic.why||''),
    detected_spoken_hook:String(semantic.detected_spoken_hook||'INDETECTABLE'),
    detected_visual_hook:String(semantic.detected_visual_hook||'INDETECTABLE'),
    detected_title_text:String(semantic.detected_title_text||'INDETECTABLE'),
    detected_cta:String(semantic.detected_cta||'INDETECTABLE'),
    recommended_hook:String(semantic.recommended_hook||''),
    alternative_hooks:Array.isArray(semantic.alternative_hooks)
      ?semantic.alternative_hooks.slice(0,3)
      :[],
    recommended_title:String(semantic.recommended_title||''),
    recommended_cta:String(semantic.recommended_cta||''),
    timeline,
    action_items:Array.isArray(semantic.action_items)
      ?semantic.action_items.slice(0,8)
      :[],
    score_evidence:semantic.score_evidence||{},
    confidence:semantic.confidence||{},
    safe_zone:normalizeSafeZone(semantic.safe_zone,measurable),
    model_used:semantic.model_used||model,
    transcription_model:transcript.model,
    analysis_basis:'measured_signals_plus_word_timestamps_plus_multimodal_reasoning'
  };
}

export async function extractMeasurableSignals(filePath){
  const probe=JSON.parse(await runStdout('ffprobe',[
    '-v','quiet',
    '-print_format','json',
    '-show_format','-show_streams',
    filePath
  ]));
  const video=(probe.streams||[]).find(s=>s.codec_type==='video')||{};
  const audio=(probe.streams||[]).find(s=>s.codec_type==='audio')||{};
  const durationSec=Number(
    probe.format?.duration||video.duration||audio.duration||0
  );
  const fps=parseRate(video.avg_frame_rate||video.r_frame_rate);

  let silences=[];
  let sceneCuts=[];
  let meanVolume=null;
  let maxVolume=null;

  if(audio.codec_name){
    const silenceRaw=await runStderr('ffmpeg',[
      '-hide_banner','-i',filePath,
      '-af','silencedetect=noise=-35dB:d=0.25',
      '-f','null','-'
    ]);
    silences=parseSilences(silenceRaw,durationSec);

    const volumeRaw=await runStderr('ffmpeg',[
      '-hide_banner','-i',filePath,
      '-af','volumedetect',
      '-f','null','-'
    ]);
    meanVolume=matchNum(volumeRaw,/mean_volume:\s*(-?[0-9.]+) dB/);
    maxVolume=matchNum(volumeRaw,/max_volume:\s*(-?[0-9.]+) dB/);
  }

  if(video.codec_name){
    const sceneRaw=await runStderr('ffmpeg',[
      '-hide_banner','-i',filePath,
      '-vf',"select='gt(scene,0.35)',showinfo",
      '-an','-f','null','-'
    ]);
    sceneCuts=[...sceneRaw.matchAll(/pts_time:([0-9.]+)/g)]
      .map(m=>Number(m[1]))
      .filter(Number.isFinite);
  }

  const silenceSec=silences.reduce(
    (s,x)=>s+Math.max(0,x.end-x.start),0
  );

  return {
    durationSec:round(durationSec,3),
    width:Number(video.width||0),
    height:Number(video.height||0),
    fps:round(fps,2),
    videoCodec:video.codec_name||null,
    audioCodec:audio.codec_name||null,
    silenceWindows:silences.slice(0,100),
    silenceRatio:durationSec?round(silenceSec/durationSec,4):0,
    longestSilenceSec:round(
      Math.max(0,...silences.map(x=>x.end-x.start)),3
    ),
    firstSilenceStartSec:silences[0]?.start??null,
    sceneCutsSec:sceneCuts.slice(0,160),
    sceneCutsPer10Sec:durationSec
      ?round(sceneCuts.length/(durationSec/10),2)
      :0,
    meanVolumeDb:meanVolume,
    maxVolumeDb:maxVolume,
    aspectRatio:video.width&&video.height
      ?round(video.width/video.height,4)
      :null
  };
}

async function transcribeFromVideo({
  filePath,fileName,geminiKey,model
}){
  const audioPath=`${filePath}.audio.mp3`;
  await run('ffmpeg',[
    '-hide_banner','-loglevel','error','-y',
    '-i',filePath,
    '-vn','-ac','1','-ar','16000','-b:a','64k',
    audioPath
  ]);

  const uploaded=await uploadGeminiFile({
    filePath:audioPath,
    mimeType:'audio/mpeg',
    fileName:`${fileName||'video'}.audio.mp3`,
    geminiKey
  });

  try{
    const active=await waitForGeminiFile(uploaded.name,geminiKey);
    const r=await fetch(`${GOOGLE_BASE}/v1beta/interactions`,{
      method:'POST',
      headers:{
        'x-goog-api-key':geminiKey,
        'content-type':'application/json'
      },
      body:JSON.stringify({
        model,
        input:[{
          type:'audio',
          uri:active.uri,
          mime_type:'audio/mpeg'
        }],
        generation_config:{
          transcription_config:{
            mode:{
              type:'verbatim',
              timestamp_granularities:['word']
            }
          }
        }
      })
    });

    if(!r.ok){
      throw new Error(
        `Gemini transcribe ${r.status}: ${(await r.text()).slice(0,500)}`
      );
    }

    const body=await r.json();
    const contents=(body.steps||[])
      .flatMap(step=>step.content||[])
      .filter(x=>x?.type==='text');

    const text=String(
      body.output_text||
      contents.map(x=>x.text||'').join(' ')
    ).trim();

    const words=contents
      .flatMap(x=>x.annotations||[])
      .filter(x=>x?.type==='word_info'&&x.text)
      .map(x=>({
        text:String(x.text),
        startMs:offsetToMs(x.start_offset),
        endMs:offsetToMs(x.end_offset),
        speaker:x.speaker||null
      }))
      .filter(x=>
        Number.isFinite(x.startMs)&&
        Number.isFinite(x.endMs)&&
        x.endMs>=x.startMs
      );

    return {
      text,
      words,
      captions:wordsToCaptions(words),
      error:null,
      model
    };
  }finally{
    if(uploaded?.name){
      await deleteGeminiFile(uploaded.name,geminiKey).catch(()=>{});
    }
  }
}

async function transcribeFallbackFromVideo({
  filePath,
  fileName,
  geminiKey,
  models,
  durationSec
}){
  const audioPath=`${filePath}.audio-fallback.mp3`;
  await run('ffmpeg',[
    '-hide_banner','-loglevel','error','-y',
    '-i',filePath,
    '-vn','-ac','1','-ar','16000','-b:a','64k',
    audioPath
  ]);

  const uploaded=await uploadGeminiFile({
    filePath:audioPath,
    mimeType:'audio/mpeg',
    fileName:`${fileName||'video'}.fallback.mp3`,
    geminiKey
  });

  try{
    const active=await waitForGeminiFile(uploaded.name,geminiKey);
    const prompt=`Transcris fidèlement cet audio.
Retourne uniquement du JSON valide:
{"text":"","segments":[{"start_sec":0,"end_sec":4.2,"text":""}]}

Règles:
- langue d'origine;
- aucun résumé;
- timestamps couvrant toute la parole;
- segments courts de 2 à 8 secondes;
- garde les hésitations utiles;
- n'invente aucun mot.`;

    let lastError=null;
    for(const activeModel of [...new Set((models||[]).filter(Boolean))]){
      try{
        const r=await fetch(
          `${GOOGLE_BASE}/v1beta/models/${encodeURIComponent(activeModel)}:generateContent`,
          {
            method:'POST',
            signal:AbortSignal.timeout(30000),
            headers:{
              'x-goog-api-key':geminiKey,
              'content-type':'application/json'
            },
            body:JSON.stringify({
              contents:[{
                role:'user',
                parts:[
                  {file_data:{mime_type:'audio/mpeg',file_uri:active.uri}},
                  {text:prompt}
                ]
              }],
              generationConfig:{
                responseMimeType:'application/json',
                temperature:0,
                seed:37
              }
            })
          }
        );
        if(!r.ok){
          throw new Error(`Gemini fallback transcript ${activeModel} ${r.status}: ${(await r.text()).slice(0,400)}`);
        }
        const body=await r.json();
        const raw=(body.candidates||[])
          .flatMap(c=>c.content?.parts||[])
          .map(p=>p.text||'')
          .join('')
          .trim();
        const parsed=parseJson(raw);
        const segments=Array.isArray(parsed?.segments)?parsed.segments:[];
        const words=[];

        for(const seg of segments){
          const text=String(seg?.text||'').trim();
          if(!text)continue;
          const tokens=text.split(/\s+/).filter(Boolean);
          if(!tokens.length)continue;
          const start=Math.max(0,Number(seg?.start_sec)||0)*1000;
          const end=Math.max(start+120,Number(seg?.end_sec||0)*1000||start+tokens.length*260);
          const step=Math.max(80,(end-start)/tokens.length);
          tokens.forEach((token,index)=>{
            words.push({
              text:token,
              startMs:Math.round(start+index*step),
              endMs:Math.round(Math.min(end,start+(index+1)*step)),
              speaker:null
            });
          });
        }

        const fallbackText=String(parsed?.text||segments.map(x=>x?.text||'').join(' ')).trim();
        if(!words.length&&fallbackText){
          const tokens=fallbackText.split(/\s+/).filter(Boolean);
          const totalMs=Math.max(1000,Number(durationSec||0)*1000);
          const step=totalMs/Math.max(1,tokens.length);
          tokens.forEach((token,index)=>{
            words.push({
              text:token,
              startMs:Math.round(index*step),
              endMs:Math.round(Math.min(totalMs,(index+1)*step)),
              speaker:null
            });
          });
        }

        if(!words.length)throw new Error('Fallback transcription returned no words');

        return {
          text:fallbackText||words.map(x=>x.text).join(' '),
          words,
          captions:wordsToCaptions(words),
          error:null,
          model:`${activeModel}:timestamp-fallback`
        };
      }catch(error){
        lastError=error;
      }
    }
    throw lastError||new Error('Fallback transcription unavailable');
  }finally{
    if(uploaded?.name){
      await deleteGeminiFile(uploaded.name,geminiKey).catch(()=>{});
    }
  }
}

function offsetToMs(value){
  const m=String(value||'').match(/^([0-9.]+)s$/);
  return m?Math.round(Number(m[1])*1000):NaN;
}

function wordsToCaptions(words){
  const out=[];let group=[];
  const flush=()=>{
    if(!group.length)return;
    const first=group[0],last=group[group.length-1];
    out.push({
      text:group.map(x=>x.text).join(' ').replace(/\s+([,.;!?])/g,'$1'),
      startMs:first.startMs,
      endMs:last.endMs,
      timestampMs:first.startMs,
      confidence:null,
      words:group.map(x=>({...x}))
    });
    group=[];
  };

  for(const word of words){
    const prev=group[group.length-1];
    if(group.length>=5||(prev&&word.startMs-prev.endMs>450))flush();
    group.push(word);
    if(/[.!?]$/.test(word.text))flush();
  }
  flush();
  return out;
}

async function generateSemanticAnalysis({
  fileUri,
  mimeType,
  geminiKey,
  models,
  measurable,
  transcript
}){
  const prompt=`Tu es Viral+, moteur d'analyse éditoriale de vidéos courtes.

Analyse UNIQUEMENT la vidéo réelle fournie, sa transcription horodatée et les signaux techniques mesurés. Tu ne connais pas les poids privés des algorithmes Instagram/TikTok/YouTube et tu ne dois jamais promettre la viralité.

SIGNAUX MESURÉS:
${JSON.stringify(measurable)}

TRANSCRIPTION HORODATÉE ASR:
${JSON.stringify({
  text:transcript?.text||'',
  words:(transcript?.words||[]).slice(0,650)
})}

Retourne UNIQUEMENT un JSON valide, sans markdown.

Schéma:
{
  "scores":{
    "hook":0,
    "scroll_stop":0,
    "clarity":0,
    "rhythm":0,
    "retention":0,
    "structure":0,
    "text_captions":0,
    "visual":0,
    "audio":0,
    "cta":0,
    "originality":0
  },
  "score_evidence":{
    "hook":"",
    "scroll_stop":"",
    "clarity":"",
    "rhythm":"",
    "retention":"",
    "structure":"",
    "text_captions":"",
    "visual":"",
    "audio":"",
    "cta":"",
    "originality":""
  },
  "verdict":"",
  "main_problem":"",
  "why":"",
  "detected_spoken_hook":"",
  "detected_visual_hook":"",
  "detected_title_text":"",
  "detected_cta":"",
  "recommended_hook":"",
  "alternative_hooks":["","",""],
  "recommended_title":"",
  "recommended_cta":"",
  "timeline":[
    {
      "start_sec":0,
      "end_sec":2,
      "severity":"red",
      "label":"",
      "problem":"",
      "correction":"",
      "broll_query":""
    }
  ],
  "action_items":["","",""],
  "confidence":{"audio":0,"visual":0,"text":0},
  "safe_zone":{"score":0,"framing":0,"text_safety":0,"caption_safety":0,"platform_fit":0,"summary":"","issues":[{"severity":"green","element":"face","problem":"","correction":"","x":0.5,"y":0.4}]}
}

Règles:
- TOUS les scores doivent être des entiers sur 100, jamais sur 10;
- utilise exclusivement l'échelle 0 à 100 : 7/10 doit être renvoyé 70, 8/10 doit être renvoyé 80;
- chaque score doit être justifié par une preuve observable dans la vidéo;
- 80+ exige une exécution réellement excellente;
- le CTA est diagnostiqué séparément mais ne pèse PAS dans le Viral Score;
- la timeline doit contenir 5 à 8 observations couvrant début, milieu et fin;
- chaque correction doit être directement exécutable;
- distingue ce qui est réellement visible/audible de ce qui est une estimation;
- si un élément est absent ou impossible à lire, écris INDETECTABLE;
- pour les hooks proposés, conserve le sens réel du contenu mais rends-les plus spécifiques;
- broll_query doit être vide si aucun B-roll n'est utile.
- SAFE ZONE: évalue la composition pour une vidéo verticale short-form. Vérifie visage/sujet, hook texte, captions et CTA par rapport aux bords et aux zones d'interface usuelles Reels/TikTok/Shorts.
- safe_zone est un diagnostic Universal Safe, pas une garantie pixel-perfect propre à une plateforme.
- x et y sont des coordonnées normalisées 0..1 du centre de l'élément observé.
- pénalise fortement tout visage, hook, caption ou CTA critique collé aux bords, tout texte très bas, toute information importante dans la colonne droite, et tout ratio non adapté au short-form.
- si aucun texte/caption n'est visible, ne prétends pas en voir: indique-le clairement dans issues.`;

  let lastError;
  for(const model of [...new Set(models.filter(Boolean))]){
    try{
      const r=await fetch(
        `${GOOGLE_BASE}/v1beta/models/${encodeURIComponent(model)}:generateContent`,
        {
          method:'POST',
          headers:{
            'x-goog-api-key':geminiKey,
            'content-type':'application/json'
          },
          body:JSON.stringify({
            contents:[{
              role:'user',
              parts:[
                {
                  file_data:{
                    mime_type:mimeType,
                    file_uri:fileUri
                  }
                },
                {text:prompt}
              ]
            }],
            generationConfig:{
              responseMimeType:'application/json',
              temperature:0.12
            }
          })
        }
      );

      if(!r.ok){
        throw new Error(
          `Gemini ${model} ${r.status}: ${(await r.text()).slice(0,500)}`
        );
      }

      const body=await r.json();
      const text=(body.candidates||[])
        .flatMap(c=>c.content?.parts||[])
        .map(p=>p.text||'')
        .join('')
        .trim();

      const parsed=parseJson(text);
      parsed.model_used=model;
      return parsed;
    }catch(error){
      lastError=error;
    }
  }

  throw lastError||new Error('Aucun modèle Gemini disponible');
}

function normalizeScores(semantic,m){
  const s=semantic?.scores||{};
  const rawScoreValues=[
    s.hook,s.scroll_stop,s.clarity,s.rhythm,s.retention,s.structure,
    s.text_captions,s.visual,s.audio,s.cta,s.originality
  ].map(Number).filter(Number.isFinite);
  const semanticScale=rawScoreValues.length&&Math.max(...rawScoreValues)<=10?10:1;
  const semanticScore=value=>clamp(Number(value)*semanticScale);

  const hook=semanticScore(s.hook);
  const visual=semanticScore(s.visual);
  const structure=semanticScore(s.structure);
  const clarity=semanticScore(s.clarity);
  const originality=semanticScore(s.originality);
  const cta=semanticScore(s.cta);
  const text=semanticScore(s.text_captions);

  const silencePenalty=Math.min(
    28,
    Math.max(0,(Number(m.silenceRatio||0)-0.08)*90)+
    Math.max(0,(Number(m.longestSilenceSec||0)-0.7)*9)
  );

  const cutDensity=Number(m.sceneCutsPer10Sec||0);
  const densityScore=cutDensity<0.4
    ?42
    :cutDensity<1
      ?58
      :cutDensity<=4.5
        ?80
        :cutDensity<=7
          ?68
          :54;

  const wpm=Number(m.wordsPerMinute||0);
  const paceScore=wpm===0
    ?50
    :wpm<80
      ?38
      :wpm<120
        ?60
        :wpm<=210
          ?82
          :wpm<=250
            ?68
            :50;

  const rhythm=clamp(
    avg(semanticScore(s.rhythm),densityScore,paceScore)-silencePenalty
  );

  const audioBase=m.audioCodec?78:20;
  const loudnessPenalty=
    m.meanVolumeDb!=null&&Number(m.meanVolumeDb)<-28?12:0;

  const audio=clamp(
    avg(semanticScore(s.audio),audioBase)-
    silencePenalty*0.35-
    loudnessPenalty
  );

  const scrollStop=clamp(
    avg(semanticScore(s.scroll_stop),hook,visual)
  );

  const retention=clamp(
    avg(
      semanticScore(s.retention),
      hook,
      rhythm,
      structure,
      scrollStop
    )-silencePenalty*0.25
  );

  return {
    hook,
    scroll_stop:scrollStop,
    clarity,
    rhythm,
    retention,
    structure,
    text_captions:text,
    visual,
    audio,
    cta,
    originality
  };
}

function normalizeSafeZone(raw,m){
  const z=raw&&typeof raw==='object'?raw:{};
  const ratio=Number(m?.aspectRatio||0),target=9/16;
  const ratioDistance=ratio>0?Math.abs(ratio-target)/target:1;
  const technicalFit=clamp(100-Math.min(70,ratioDistance*120));
  const framing=clamp(z.framing??60),textSafety=clamp(z.text_safety??65),captionSafety=clamp(z.caption_safety??65);
  const platformFit=clamp(avg(z.platform_fit??technicalFit,technicalFit));
  const score=clamp(avg(framing,textSafety,captionSafety,platformFit));
  const issues=(Array.isArray(z.issues)?z.issues:[]).slice(0,8).map(x=>({severity:['green','orange','red'].includes(x?.severity)?x.severity:'orange',element:String(x?.element||'frame').slice(0,40),problem:String(x?.problem||'').slice(0,240),correction:String(x?.correction||'').slice(0,240),x:Math.max(0,Math.min(1,Number(x?.x)||0.5)),y:Math.max(0,Math.min(1,Number(x?.y)||0.5))}));
  return {score,framing,text_safety:textSafety,caption_safety:captionSafety,platform_fit:platformFit,summary:String(z.summary||'').slice(0,500),issues,mode:'universal_safe',basis:'multimodal_composition_plus_aspect_ratio'};
}

function scoreFinal(scores){
  const total=Object.entries(SCORE_WEIGHTS)
    .reduce((sum,[key,weight])=>{
      return sum+clamp(scores[key])*weight;
    },0);
  return Math.round(total/100);
}

function normalizeTimeline(items,durationSec){
  const arr=Array.isArray(items)?items:[];
  return arr
    .slice(0,10)
    .map(x=>({
      start_sec:round(Number(x.start_sec)||0,2),
      end_sec:round(
        Math.max(
          Number(x.end_sec)||0,
          Number(x.start_sec)||0
        ),2
      ),
      severity:['green','orange','red'].includes(x.severity)
        ?x.severity
        :'orange',
      label:String(x.label||'Moment à vérifier'),
      problem:String(x.problem||''),
      correction:String(x.correction||''),
      broll_query:String(x.broll_query||'')
    }))
    .filter(x=>x.start_sec<=durationSec+1);
}

async function uploadGeminiFile({
  filePath,mimeType,fileName,geminiKey
}){
  const info=await stat(filePath);

  const start=await fetch(`${GOOGLE_BASE}/upload/v1beta/files`,{
    method:'POST',
    headers:{
      'x-goog-api-key':geminiKey,
      'X-Goog-Upload-Protocol':'resumable',
      'X-Goog-Upload-Command':'start',
      'X-Goog-Upload-Header-Content-Length':String(info.size),
      'X-Goog-Upload-Header-Content-Type':mimeType,
      'Content-Type':'application/json'
    },
    body:JSON.stringify({
      file:{display_name:fileName||'video'}
    })
  });

  if(!start.ok){
    throw new Error(
      `Gemini upload init ${start.status}: ${(await start.text()).slice(0,400)}`
    );
  }

  const uploadUrl=start.headers.get('x-goog-upload-url');
  if(!uploadUrl)throw new Error('URL upload Gemini absente');

  const up=await fetch(uploadUrl,{
    method:'POST',
    headers:{
      'Content-Type':mimeType,
      'Content-Length':String(info.size),
      'X-Goog-Upload-Offset':'0',
      'X-Goog-Upload-Command':'upload, finalize'
    },
    body:createReadStream(filePath),
    duplex:'half'
  });

  if(!up.ok){
    throw new Error(
      `Gemini upload ${up.status}: ${(await up.text()).slice(0,400)}`
    );
  }

  const body=await up.json();
  if(!body.file?.name){
    throw new Error('Réponse Gemini Files invalide');
  }
  return body.file;
}

async function waitForGeminiFile(name,key){
  for(let i=0;i<90;i++){
    const r=await fetch(
      `${GOOGLE_BASE}/v1beta/${name}`,
      {headers:{'x-goog-api-key':key}}
    );

    if(!r.ok){
      throw new Error(`Gemini file status ${r.status}`);
    }

    const file=await r.json();
    const state=String(file.state||'').toUpperCase();

    if(state==='ACTIVE')return file;
    if(state==='FAILED'){
      throw new Error('Gemini ne peut pas traiter cette vidéo');
    }

    await new Promise(resolve=>setTimeout(resolve,2000));
  }

  throw new Error('Préparation Gemini trop longue');
}

async function deleteGeminiFile(name,key){
  await fetch(
    `${GOOGLE_BASE}/v1beta/${name}`,
    {
      method:'DELETE',
      headers:{'x-goog-api-key':key}
    }
  );
}

function parseJson(text){
  const clean=String(text||'')
    .replace(/^\`\`\`(?:json)?\s*/i,'')
    .replace(/\`\`\`$/,'')
    .trim();

  const start=clean.indexOf('{');
  const end=clean.lastIndexOf('}');
  const candidate=
    start>=0&&end>start
      ?clean.slice(start,end+1)
      :clean;

  const attempts=[candidate];

  // Some Gemini responses occasionally escape every JSON quote
  // (e.g. {\"key\":\"value\"}) even with responseMimeType=json.
  if(candidate.includes('\\\"')){
    attempts.push(candidate.replace(/\\\"/g,'"'));
  }

  // Also handle a fully JSON-stringified JSON object.
  try{
    const outer=JSON.parse(clean);
    if(typeof outer==='string')attempts.push(outer);
    else if(outer&&typeof outer==='object')return outer;
  }catch{}

  let lastError=null;
  for(const value of attempts){
    try{
      return JSON.parse(value);
    }catch(error){
      lastError=error;
    }
  }

  throw lastError||new Error('Gemini JSON invalide');
}

function parseRate(value){
  const [a,b]=String(value||'0/1').split('/').map(Number);
  return b?a/b:0;
}

function matchNum(text,re){
  const m=String(text||'').match(re);
  return m?Number(m[1]):null;
}

function round(n,p=2){
  return Number.isFinite(Number(n))
    ?Number(Number(n).toFixed(p))
    :0;
}

function parseSilences(raw,duration){
  const starts=[...String(raw).matchAll(/silence_start:\s*([0-9.]+)/g)]
    .map(m=>Number(m[1]));
  const ends=[...String(raw).matchAll(/silence_end:\s*([0-9.]+)/g)]
    .map(m=>Number(m[1]));

  return starts
    .map((start,i)=>({
      start:round(start,3),
      end:round(ends[i]??duration,3)
    }))
    .filter(x=>x.end>=x.start);
}

function run(cmd,args){
  return new Promise((resolve,reject)=>{
    const p=spawn(cmd,args);
    let stderr='';
    p.stderr.on('data',d=>stderr+=d);
    p.on('error',reject);
    p.on('close',code=>{
      if(code===0)resolve();
      else reject(
        new Error(`${cmd} exited ${code}: ${stderr.slice(-2000)}`)
      );
    });
  });
}

function runStdout(cmd,args){
  return new Promise((resolve,reject)=>{
    const p=spawn(cmd,args);
    let stdout='',stderr='';
    p.stdout.on('data',d=>stdout+=d);
    p.stderr.on('data',d=>stderr+=d);
    p.on('error',reject);
    p.on('close',code=>{
      if(code===0)resolve(stdout);
      else reject(
        new Error(`${cmd} exited ${code}: ${stderr.slice(-2000)}`)
      );
    });
  });
}

function runStderr(cmd,args){
  return new Promise((resolve,reject)=>{
    const p=spawn(cmd,args);
    let stderr='';
    p.stderr.on('data',d=>stderr+=d);
    p.on('error',reject);
    p.on('close',code=>{
      if(code===0)resolve(stderr);
      else reject(
        new Error(`${cmd} exited ${code}: ${stderr.slice(-2000)}`)
      );
    });
  });
}
