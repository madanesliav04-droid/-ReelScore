import {createReadStream} from 'node:fs';
import {stat} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {reviewHookSuggestions,reviewEditorialFixes,reviewSupplementalCopy,reviewedTimelineMoments} from './viral-personalization.js';
import {verifyWithVideo,applyVideoReview} from './viral-verifier.js';
import {
  SCORE_VERSION,SCORE_WEIGHTS,validateSemanticAnalysis,
  priorityDiagnostics,editorialRiskMap,calculateScore,
  editorialScoreAudit,SCORE_CRITERION_BASIS,SCORE_RUBRIC,detectUnsupportedFormatPenalty
} from './viral-quality.js';
export {SCORE_VERSION,SCORE_WEIGHTS} from './viral-quality.js';

const GOOGLE_BASE='https://generativelanguage.googleapis.com';

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
      transcript,
      onReviewProgress:()=>onProgress('analyzing',74,'Vérification des recommandations')
    });
  }finally{
    if(uploaded?.name)await deleteGeminiFile(uploaded.name,geminiKey).catch(()=>{});
  }

  await onProgress('generating_report',84,'Calcul du Viral Score');
  const editorialScoring=editorialScoreAudit(semantic,measurable);
  editorialScoring.audit.independent_video_review={
    status:semantic.score_review?.status||'unavailable',
    disputed_criteria:semantic.score_review?.disputed_keys||[],
    caveat:semantic.score_review?.reason||'Un désaccord entre deux IA ne prouve pas un défaut, mais exige une vérification humaine.'
  };
  const normalized=editorialScoring.scores;
  const finalScore=scoreFinal(normalized);
  const timeline=normalizeTimeline(semantic.timeline,measurable.durationSec);
  const hookExperiments=reviewHookSuggestions(
    semantic.hook_candidates,transcript,semantic.video_context||{}
  );
  const editorialReview=reviewEditorialFixes(
    normalizeFixPlan(semantic.fix_plan,timeline),transcript,measurable.durationSec
  );
  // Rejected suggestions are omitted, not replaced with generic claims.
  const fixPlan=editorialReview.fixes;
  const verifiedTimeline=reviewedTimelineMoments(timeline,fixPlan);
  const priorities=priorityDiagnostics(
    normalized,semantic.score_evidence||{},fixPlan,verifiedTimeline,measurable.durationSec
  );
  const supportedPriorities=priorities.filter(x=>x.exact_change&&x.evidence);
  const titleReview=reviewSupplementalCopy(semantic.recommended_title,transcript,'title');
  const ctaReview=reviewSupplementalCopy(semantic.recommended_cta,transcript,'cta');

  return {
    final_score:finalScore,
    score_version:SCORE_VERSION,
    score_weights:SCORE_WEIGHTS,
    score_audit:editorialScoring.audit,
    criterion_basis:SCORE_CRITERION_BASIS,
    scores:normalized,
    measurable,
    transcript,
    verdict:fixPlan.length?String(semantic.verdict||'Diagnostic éditorial estimé'):'Analyse terminée : aucune correction vérifiée à recommander automatiquement.',
    main_problem:fixPlan[0]?.problem||'Aucune faiblesse précise suffisamment étayée pour proposer une correction.',
    why:fixPlan.length?String(fixPlan[0]?.why_it_matters||semantic.why||'Hypothèse à vérifier sur le passage indiqué.'):'Les scores restent des estimations éditoriales. L’absence de correction fiable ne signifie pas que la vidéo sera virale.',
    video_context:semantic.video_context||{},
    detected_spoken_hook:String(semantic.detected_spoken_hook||'INDETECTABLE'),
    detected_visual_hook:String(semantic.detected_visual_hook||'INDETECTABLE'),
    detected_title_text:String(semantic.detected_title_text||'INDETECTABLE'),
    detected_cta:String(semantic.detected_cta||'INDETECTABLE'),
    recommended_hook:hookExperiments.candidates[0]?.proposed_hook||'',
    alternative_hooks:hookExperiments.candidates.slice(1).map(x=>x.proposed_hook),
    hook_experiments:hookExperiments,
    recommendation_video_review:semantic.recommendation_video_review||null,
    editorial_review:{
      review_status:editorialReview.review_status,
      reviewed_fixes:fixPlan.length,
      rejected_fixes:editorialReview.rejected.length,
      note:'Une suggestion absente vaut mieux qu’une recommandation sans preuve.'
    },
    recommended_title:titleReview.text,
    recommended_cta:ctaReview.text,
    supplemental_copy_review:{title:titleReview.status,cta:ctaReview.status},
    editorial_director:semantic?.editorial_director||null,
    premium_storyboards:Array.isArray(semantic?.premium_storyboards)?semantic.premium_storyboards.slice(0,8):[],
    timeline:verifiedTimeline,
    rejected_timeline_moments:timeline.length-verifiedTimeline.length,
    action_items:fixPlan.map(x=>x.exact_change).filter(Boolean),
    fix_plan:fixPlan,
    priority_diagnostics:priorities.slice(0,5),
    top_priority:supportedPriorities[0]||null,
    editorial_risk_map:editorialRiskMap(verifiedTimeline,measurable.durationSec),
    analysis_validation:semantic.validation||null,
    score_breakdown:buildScoreBreakdown(normalized),
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
    let primaryError=null;

    try{
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
          `Gemini transcribe interactions ${r.status}: ${(await r.text()).slice(0,500)}`
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

      if(words.length){
        return {
          text,
          words,
          captions:wordsToCaptions(words),
          error:null,
          model
        };
      }

      primaryError=new Error('Gemini interactions transcription returned no timed words');
    }catch(error){
      primaryError=error;
    }

    console.warn(JSON.stringify({
      event:'transcription_generate_content_fallback',
      reason:String(primaryError?.message||primaryError).slice(0,500)
    }));

    const fallback=await transcribeViaGenerateContent({
      fileUri:active.uri,
      mimeType:'audio/mpeg',
      geminiKey,
      model
    });

    return {
      ...fallback,
      error:`Interactions fallback: ${String(primaryError?.message||primaryError).slice(0,260)}`
    };
  }finally{
    if(uploaded?.name){
      await deleteGeminiFile(uploaded.name,geminiKey).catch(()=>{});
    }
  }
}

async function transcribeViaGenerateContent({
  fileUri,
  mimeType,
  geminiKey,
  model
}){
  const r=await fetch(
    `${GOOGLE_BASE}/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    {
      method:'POST',
      signal:AbortSignal.timeout(45000),
      headers:{
        'x-goog-api-key':geminiKey,
        'content-type':'application/json'
      },
      body:JSON.stringify({
        contents:[{
          role:'user',
          parts:[{
            fileData:{
              fileUri,
              mimeType
            }
          }]
        }],
        generationConfig:{
          audioTranscriptionConfig:{
            wordTimestamp:true
          }
        }
      })
    }
  );

  if(!r.ok){
    throw new Error(
      `Gemini transcribe generateContent ${r.status}: ${(await r.text()).slice(0,500)}`
    );
  }

  const body=await r.json();
  const parts=(body.candidates||[])
    .flatMap(candidate=>candidate?.content?.parts||[]);

  const transcriptions=parts
    .map(part=>part?.audioTranscription)
    .filter(Boolean);

  const words=transcriptions
    .flatMap(t=>{
      const speaker=t?.speakerLabel||null;
      return (t?.words||[]).map(w=>({
        text:String(w?.word||'').trim(),
        startMs:offsetToMs(w?.startOffset),
        endMs:offsetToMs(w?.endOffset),
        speaker
      }));
    })
    .filter(x=>
      x.text&&
      Number.isFinite(x.startMs)&&
      Number.isFinite(x.endMs)&&
      x.endMs>=x.startMs
    );

  const text=transcriptions
    .map(t=>String(t?.text||'').trim())
    .filter(Boolean)
    .join(' ')
    .trim()||
    parts.map(part=>String(part?.text||'').trim()).filter(Boolean).join(' ').trim();

  if(!words.length){
    throw new Error('Gemini generateContent transcription returned no timed words');
  }

  return {
    text:text||words.map(x=>x.text).join(' '),
    words,
    captions:wordsToCaptions(words),
    error:null,
    model:`${model}:generateContent`
  };
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
  transcript,
  onReviewProgress=async()=>{}
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
  "video_context":{"topic":"","audience_hypothesis":"","central_claim":"","observable_proof":"","primary_intent":""},
  "hook_candidates":[
    {"proposed_hook":"","source_quote":"","why_test":"","test_hypothesis":"","variable_changed":""}
  ],
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
  "fix_plan":[
    {
      "priority":1,
      "area":"hook",
      "start_sec":0,
      "end_sec":2,
      "problem":"",
      "why_it_matters":"",
      "exact_change":"",
      "example":"",
      "expected_effect":"",
      "evidence_type":"transcript",
      "source_quote":"",
      "observable_evidence":""
    }
  ],
  "confidence":{"audio":0,"visual":0,"text":0},
  "safe_zone":{"score":0,"framing":0,"text_safety":0,"caption_safety":0,"platform_fit":0,"summary":"","issues":[{"severity":"green","element":"face","problem":"","correction":"","x":0.5,"y":0.4}]}
}

CALIBRATION DU SCORE : TA RESPONSABILITÉ EST D'ÉVALUER LA QUALITÉ ÉDITORIALE VISIBLE, PAS DE PRÉDIRE LE NOMBRE DE VUES.
ÉCHELLE FIXE pour chaque critère : 0-19 = défaillant/incompréhensible, 20-39 = obstacles majeurs observables, 40-59 = exécution inégale, 60-74 = correct avec limites concrètes, 75-89 = solide et convaincant, 90-100 = exceptionnel avec preuves claires.
90+ ne se donne pas sur une simple impression. 40- ne se donne pas pour un style de montage inhabituel mais intentionnel.
Pour chaque score, justifie TOUJOURS la fourchette par un fait OBSERVABLE propre à cette vidéo, et mentionne au moins un point positif quand tu réduis la note. L'absence de défaut constaté n'est pas une garantie de 100.
Critères distincts sans double comptage :
${JSON.stringify(SCORE_CRITERION_BASIS)}
- HOOK : qualité de la promesse dans les premières secondes ; pas un décompte automatique de mots.
- SCROLL_STOP : aspect/perception de l'entrée uniquement, distinct de la formulation du hook ; tu ne mesures pas de scroll-stop sur Instagram.
- RETENTION : progression et curiosité éditoriales dans le MILIEU de la vidéo, pas la répétition du hook ou du scroll-stop ; tu ne mesures PAS la rétention.
- RYTHME : observe l'intention derrière les pauses et les changements de plans. Un nombre de cuts faible, un seul plan, un débit rapide ou un silence n'est JAMAIS automatiquement mauvais ; n'affirme pas qu'il manque des cuts sans le voir.
- AUDIO : ne présume pas qu'une piste audible vaut 78/100, ni qu'une vidéo sans piste est mauvaise si elle est clairement destinée à une lecture muette.
- FORMAT : un 16:9 natif est parfaitement normal ; le contrôle de safe-zone verticale est distinct et ne doit PAS pénaliser le score créatif.
- Si un défaut est mentionné, explique où il s'entend/se voit et le mécanisme éditorial précis ; sinon abstiens-toi d'inventer un défaut.
- Ne corrèle pas une note à des résultats de plateforme absents. Ne cite pas les poids de l'algorithme Instagram : ils sont inconnus.

Règles:
- TOUS les scores doivent être des entiers sur 100, jamais sur 10;
- utilise exclusivement l'échelle 0 à 100 : 7/10 doit être renvoyé 70, 8/10 doit être renvoyé 80;
- chaque score doit être justifié par une preuve observable dans la vidéo;
- 80+ exige une exécution réellement excellente;
- le CTA est diagnostiqué séparément mais ne pèse PAS dans le Viral Score;
- la timeline doit décrire uniquement les passages observés utiles, sans inventer des moments faibles pour remplir;
- chaque correction doit être directement exécutable;
- fix_plan doit contenir 0 à 5 corrections justifiées, classées par priorité ; zéro est préférable à une fausse amélioration;
- chaque fix_plan doit dire exactement: OÙ intervenir, QUOI changer, COMMENT le faire, et donner un EXEMPLE concret issu de cette vidéo;
- start_sec/end_sec doivent pointer vers le passage réel quand la correction est temporelle; sinon utilise 0;
- exact_change doit être formulé comme une instruction de montage ou réécriture immédiatement exécutable;
- expected_effect décrit le problème éditorial corrigé, pas une promesse de vues;
- n'utilise AUCUNE statistique externe, aucun pourcentage de comportement utilisateur et aucun fait non mesuré dans la vidéo; explique uniquement le mécanisme éditorial observable;
- distingue ce qui est réellement visible/audible de ce qui est une estimation;
- si un élément est absent ou impossible à lire, écris INDETECTABLE;
- PERSONNALISATION OBLIGATOIRE : commence par identifier le sujet précis, ce que la vidéo promet réellement, et l'intention de ce créateur. N'invente ni audience certaine ni statistiques;
- hook_candidates : propose entre 0 et 3 accroches uniquement si tu disposes d'éléments spécifiques de CETTE vidéo. Zéro est autorisé et préférable à une suggestion vide ou générique;
- pour chaque hook candidat, source_quote doit citer EXACTEMENT une phrase vraiment prononcée et présente dans la transcription (orthographe ASR conservée), permettant de vérifier l'ancrage;
- proposed_hook doit rester fidèle au contenu, citer le thème concret et NE PAS ajouter de chiffres, de résultats, de témoignages, d'exagérations, de revenus ou de promesses qui n'existent pas dans le discours;
- why_test doit décrire le problème de l'accroche actuelle avec une raison OBSERVABLE, pas "plus engageant" ou "plus viral" sans explication;
- test_hypothesis doit formuler un mécanisme précis à tester (ex. faire apparaître l'enjeu concret dès 0–2 s), sans garantir un résultat;
- variable_changed doit nommer UNE variable distincte (spécificité / ordre de l'information / contraste), évite de tout modifier à la fois;
- ne répète jamais une formule passe-partout telle que "Tu veux savoir...", "Le secret de...", "Personne ne te dit...", ou une accroche réutilisable hors contexte;
- chaque fix_plan doit inclure evidence_type parmi transcript/visual/audio/technical, observable_evidence spécifique et source_quote exacte si transcript; timestamp valable dans la durée vidéo;
- si la vidéo ne fournit pas assez de preuve d'un problème, évite de le signaler. Une vidéo réussie n'a pas besoin de 3 corrections artificielles;
- ces hooks sont des hypothèses à comparer à partir des performances réelles après publication;
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
              temperature:0,
              seed:73
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

      const parsed=validateSemanticAnalysis(parseJson(text));
      await onReviewProgress();
      const challenged=await verifyWithVideo({
        fileUri,mimeType,apiKey:geminiKey,
        primaryModel:model,fallbackModel:models.find(x=>x!==model),
        semantic:parsed,transcript,measurable
      });
      const verified=applyVideoReview(parsed,challenged);
      const disputed=verified.score_review?.disputed_keys||[];
      const formatBias=detectUnsupportedFormatPenalty({
        evidence:verified.score_evidence,measurable,review:verified.score_review
      });
      // Materially wrong criteria are a model failure, not an opportunity to
      // add arbitrary compensating points. Retry with the alternate model.
      if(formatBias.length){
        throw new Error('VIRAL_SCORE_FORMAT_BIAS: '+formatBias.map(x=>x.criterion).join(','));
      }
      if(verified.score_review?.status==='completed'&&disputed.length>=6){
        throw new Error('VIRAL_SCORE_REVIEW_CONFLICT: plusieurs critères non étayés, nouvelle analyse requise');
      }
      verified.model_used=model;
      return verified;
    }catch(error){
      lastError=error;
    }
  }

  throw lastError||new Error('Aucun modèle Gemini disponible');
}

function normalizeSafeZone(raw,m){
  const z=raw&&typeof raw==='object'?raw:{};
  const ratio=Number(m?.aspectRatio||0),target=9/16;
  const landscape=ratio>=1;
  const ratioDistance=ratio>0?Math.abs(ratio-target)/target:1;
  // A horizontal production is not a broken Reel. Do not silently treat native
  // landscape as a failed 9:16 short-form video; platform overlay is N/A.
  const technicalFit=clamp(100-Math.min(70,ratioDistance*120));
  const framing=clamp(z.framing??60),textSafety=clamp(z.text_safety??65),captionSafety=clamp(z.caption_safety??65);
  const platformFit=landscape?null:clamp(avg(z.platform_fit??technicalFit,technicalFit));
  const score=landscape?clamp(avg(framing,textSafety,captionSafety)):clamp(avg(framing,textSafety,captionSafety,platformFit));
  const issues=(Array.isArray(z.issues)?z.issues:[]).slice(0,8).map(x=>({severity:['green','orange','red'].includes(x?.severity)?x.severity:'orange',element:String(x?.element||'frame').slice(0,40),problem:String(x?.problem||'').slice(0,240),correction:String(x?.correction||'').slice(0,240),x:Math.max(0,Math.min(1,Number(x?.x??0.5))),y:Math.max(0,Math.min(1,Number(x?.y??0.5)))}));
  return {score,framing,text_safety:textSafety,caption_safety:captionSafety,platform_fit:platformFit,
    summary:String(z.summary||'').slice(0,500),issues,
    mode:landscape?'native_landscape_composition':'universal_vertical_safe',
    platform_overlay_applicable:!landscape,
    caution:landscape?'Format natif horizontal. Aucun score de compatibilité aux overlays 9:16 n’est inféré.':'Risque de recouvrement estimé. Vérifier le rendu dans la plateforme cible.',
    basis:'multimodal_composition_and_native_orientation'};
}


function normalizeFixPlan(items,timeline){
  const arr=Array.isArray(items)?items:[];
  const clean=arr.slice(0,8).map((x,index)=>({
    priority:Math.max(1,Math.min(9,Number(x?.priority)||index+1)),
    area:String(x?.area||'editing').slice(0,40),
    start_sec:round(Number(x?.start_sec)||0,2),
    end_sec:round(Math.max(Number(x?.end_sec)||0,Number(x?.start_sec)||0),2),
    problem:String(x?.problem||'').slice(0,500),
    why_it_matters:String(x?.why_it_matters||'').slice(0,500),
    exact_change:String(x?.exact_change||'').slice(0,700),
    example:String(x?.example||'').slice(0,700),
    expected_effect:String(x?.expected_effect||'').slice(0,500),
    evidence_type:String(x?.evidence_type||'').slice(0,40),
    source_quote:String(x?.source_quote||'').slice(0,400),
    observable_evidence:String(x?.observable_evidence||'').slice(0,600)
  })).filter(x=>x.problem||x.exact_change||x.example);

  if(clean.length)return clean.sort((a,b)=>a.priority-b.priority);

  return (Array.isArray(timeline)?timeline:[])
    .filter(x=>x.problem||x.correction)
    .slice(0,6)
    .map((x,index)=>({
      priority:index+1,
      area:String(x.label||'editing').slice(0,40),
      start_sec:round(Number(x.start_sec)||0,2),
      end_sec:round(Number(x.end_sec)||0,2),
      problem:String(x.problem||''),
      why_it_matters:'',
      exact_change:String(x.correction||''),
      example:String(x.broll_query?('B-roll: '+x.broll_query):''),
      expected_effect:'Corriger le point faible identifié sur ce passage.'
    }));
}

function buildScoreBreakdown(scores){
  return Object.entries(SCORE_WEIGHTS).map(([key,weight])=>({
    key,
    score:clamp(scores[key]),
    weight,
    contribution:round(clamp(scores[key])*weight/100,2)
  }));
}

function scoreFinal(scores){
  return calculateScore(scores);
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
