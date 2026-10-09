const FILLERS=new Set(['euh','heu','uh','um','erm','hmm','hum']);

export const MODEL_CONTRACT_VERSION='editplus-focus-five-v4';

export const EDIT_STYLES={
  codie:{label:'Codie',promise:'Business storytelling · facecam first',pace:'narrative',silenceThresholdMs:780,removeFillers:false,maxPunchInsPer30s:3,punchScale:1.10,punchSeverities:['red'],captions:'codie',broll:{maxPer30s:2,minDurationMs:1900,maxDurationMs:3400,minGapMs:5000},brollDirective:'Facecam dominante. B-roll uniquement lorsqu’il illustre précisément une phrase concrète. Pas de remplissage.',soundDesign:'minimal',visualSignature:{mode:'codie',contrast:1.02,saturation:1,accent:'#ff9b45',cadenceMs:0}},
  impact:{label:'Impact',promise:'High-energy business · retention first',pace:'fast',silenceThresholdMs:420,removeFillers:true,maxPunchInsPer30s:8,punchScale:1.13,punchSeverities:['red','orange'],captions:'impact',broll:{maxPer30s:5,minDurationMs:1300,maxDurationMs:2400,minGapMs:2200},brollDirective:'B-roll fréquent mais concret: produits, chiffres, lieux, marques, actions. Chaque insert doit accélérer la compréhension.',soundDesign:'moderate',visualSignature:{mode:'impact',contrast:1.12,saturation:1.16,accent:'#37e6ff',cadenceMs:3600}},
  clean:{label:'Clean',promise:'Modern creator · simple and polished',pace:'medium_fast',silenceThresholdMs:620,removeFillers:true,maxPunchInsPer30s:3,punchScale:1.07,punchSeverities:['red'],captions:'clean',broll:{maxPer30s:1,minDurationMs:1700,maxDurationMs:2900,minGapMs:4400},brollDirective:'Très peu de B-roll. Seulement quand une image clarifie mieux que la facecam.',soundDesign:'light',visualSignature:{mode:'clean',contrast:1.02,saturation:.98,accent:'#ffffff',cadenceMs:0}},
  authority:{label:'Authority',promise:'Podcast & expert · calm premium',pace:'calm_premium',silenceThresholdMs:920,removeFillers:false,maxPunchInsPer30s:2,punchScale:1.06,punchSeverities:['red'],captions:'authority',broll:{maxPer30s:2,minDurationMs:2500,maxDurationMs:4300,minGapMs:6000},brollDirective:'B-roll rare, long, crédible et documentaire moderne. Priorité au visage et à la parole.',soundDesign:'minimal',visualSignature:{mode:'authority',contrast:1.05,saturation:.88,accent:'#ff9b45',cadenceMs:0}},
  explainer:{label:'Explainer',promise:'Tutorial & SaaS · show what is being explained',pace:'medium_fast',silenceThresholdMs:560,removeFillers:true,maxPunchInsPer30s:5,punchScale:1.08,punchSeverities:['red','orange'],captions:'explainer',broll:{maxPer30s:5,minDurationMs:1700,maxDurationMs:3300,minGapMs:2600},brollDirective:'Cherche des interfaces, outils, objets ou étapes concrètes correspondant exactement à l’explication. Évite les images génériques.',soundDesign:'light',visualSignature:{mode:'explainer',contrast:1.04,saturation:1.03,accent:'#7ce8ff',cadenceMs:5200}},
  data:{label:'Data',promise:'Numbers & evidence · proof on screen',pace:'fast',silenceThresholdMs:500,removeFillers:true,maxPunchInsPer30s:5,punchScale:1.09,punchSeverities:['red','orange'],captions:'data',broll:{maxPer30s:4,minDurationMs:1800,maxDurationMs:3100,minGapMs:2800},brollDirective:'Priorité aux preuves visuelles: documents modernes, tableaux, dashboards, produits comparés, lieux ou éléments cités. Pas d’archives décoratives.',soundDesign:'light',visualSignature:{mode:'data',contrast:1.07,saturation:.96,accent:'#ffd166',cadenceMs:4700}},
  ugc_native:{label:'UGC Native',promise:'Native social · human and unpolished',pace:'natural',silenceThresholdMs:740,removeFillers:false,maxPunchInsPer30s:3,punchScale:1.05,punchSeverities:['red'],captions:'ugc',broll:{maxPer30s:1,minDurationMs:1500,maxDurationMs:2600,minGapMs:7000},brollDirective:'Très peu de B-roll. Favorise produit, geste, détail ou usage réel. Le rendu doit rester natif téléphone.',soundDesign:'light',visualSignature:{mode:'ugc_native',contrast:1.03,saturation:1.12,accent:'#ff3fbf',cadenceMs:7000}},
  cinematic_story:{label:'Cinematic Story',promise:'Personal story · emotion and breathing room',pace:'story',silenceThresholdMs:1100,removeFillers:false,maxPunchInsPer30s:2,punchScale:1.04,punchSeverities:['red'],captions:'cinematic',broll:{maxPer30s:3,minDurationMs:3200,maxDurationMs:6200,minGapMs:5600},brollDirective:'B-roll narratif et émotionnel, plus long. Cherche des lieux, objets, actions ou atmosphères directement reliés à l’histoire.',soundDesign:'cinematic',visualSignature:{mode:'cinematic_story',contrast:1.08,saturation:.72,accent:'#ffffff',cadenceMs:0}},
  // Editorial Breakdown: inspired by restrained business-math storytelling,
  // not a generic Data preset. Figures and comparisons are transcript-grounded.
  editorial_breakdown:{
    label:'Editorial Breakdown',promise:'Editorial numbers · illustrated reasoning',
    pace:'editorial',silenceThresholdMs:850,removeFillers:false,maxPunchInsPer30s:2,
    punchScale:1.055,punchSeverities:['red'],captions:'editorial',
    broll:{maxPer30s:0,minDurationMs:0,maxDurationMs:0,minGapMs:999999},
    brollDirective:'Aucun B-roll automatique: les chiffres et tableaux contextualisés restent sur la facecam.',
    soundDesign:'minimal',visualSignature:{mode:'editorial_breakdown',contrast:1.035,saturation:.87,accent:'#f5eee2',cadenceMs:0}
  },
  creator_clean:null,business_viral:null,podcast_authority:null
};
EDIT_STYLES.creator_clean=EDIT_STYLES.clean;
EDIT_STYLES.business_viral=EDIT_STYLES.impact;
EDIT_STYLES.podcast_authority=EDIT_STYLES.authority;

const GRAPHIC_TRIGGERS={
  codie:'none: authentic facecam and restrained text-only captions',
  impact:'emphasis: short spoken keywords, not invented claims',
  clean:'none: clean captions with no ornamental graphics',
  authority:'none: do not fabricate credentials or source citations',
  explainer:'steps: a spoken step marker is required',
  data:'numbers: only a number actually present in the transcript',
  ugc_native:'none: preserve natural phone-native video',
  cinematic_story:'none: rely on shots and timing, not auto-generated quote cards',
  editorial_breakdown:'editorial serif metrics, equations and comparison only when directly supported by spoken numbers; no fake data or decorative stock imagery'
};

export function describeEditActions(style){
  const canonical={creator_clean:'clean',business_viral:'impact',podcast_authority:'authority'}[style]||style;
  const cfg=EDIT_STYLES[canonical]||EDIT_STYLES.clean;
  return {
    version:MODEL_CONTRACT_VERSION,
    model:canonical,
    silenceCutThresholdMs:cfg.silenceThresholdMs,
    removeFillers:cfg.removeFillers,
    punchIns:{trigger:cfg.punchSeverities,maxPer30s:cfg.maxPunchInsPer30s,scale:cfg.punchScale},
    broll:{maxPer30s:cfg.broll.maxPer30s,minDurationMs:cfg.broll.minDurationMs,maxDurationMs:cfg.broll.maxDurationMs,trigger:cfg.brollDirective},
    graphicsTrigger:GRAPHIC_TRIGGERS[canonical],
    captions:cfg.captions,
    soundFinishing:cfg.soundDesign,
    videoFinishing:cfg.visualSignature.mode,
    limits:'Maximums are ceilings, not mandatory insertions; no invented proof or unsupported visual claims.'
  };
}



/**
 * Edit+ V4 production contracts.
 * Design tokens here are contractual: the render timeline, typography and QA
 * tests must agree with them. Pinterest is a visual reference only, not a media
 * licensing or downloading source.
 */
export const PREMIUM_MODEL_CONTRACT_VERSION='editplus-focus-five-v4';
export const PREMIUM_MODEL_CONTRACTS=Object.freeze({
  codie:{
    name:'Codie',
    intent:'Business storytelling documentaire, humain et premium',
    viewerEffect:'Le propos est crédible et narrativement marquant, sans artifices',
    hook:'Texte directement sur la vidéo, jamais un encadré blanc; conserver la facecam comme ancrage',
    typography:{font:'Noto Sans',weight:850,sizePx1080x1920:66,primary:'#FFFFFF',accent:'#FF9B45',position:'middle_low',maxWords:4,wordHighlight:false,entrance:'soft-fade'},
    framing:'Facecam dominante; 3 niveaux au maximum (normal, crop, close-up punchline); aucun crop gratuit',
    edits:'Couper seulement les longs silences >780ms; conserver les respirations utiles; 3 punch-ins maximum par 30s, déclenchés par la narration',
    broll:'0 à 2 inserts concrets de 1.9–3.4s par 30s; preuve, lieu, objet, action ou information nommée, jamais décoration',
    graphics:'Pas de cartes citation décoratives; texte de hook et chiffres justifiés par les paroles uniquement',
    transitions:'Cut net ou retour facecam; pas de transitions flashy',
    sound:'Voix naturelle équilibrée à -14 LUFS, compression légère; pas de SFX gratuits',
    color:'Contraste naturel, tons chauds neutres, conservation de la peau',
    forbidden:['cadres blancs','faux témoignages','B-roll abstrait','zoom métronomique']
  },
  impact:{
    name:'Impact',
    intent:'Opinion et argument fort, énergie maîtrisée et lisibilité immédiate',
    viewerEffect:'Chaque rupture révèle un argument, pas un effet gratuit',
    hook:'Punch-in bref et texte fort seulement si l’introduction justifie une rupture',
    typography:{font:'DejaVu Sans',weight:900,sizePx1080x1920:80,primary:'#FFFFFF',accent:'#37E6FF',position:'middle_low',maxWords:3,wordHighlight:true,entrance:'fast-pop'},
    framing:'Facecam expressive, 2 à 3 niveaux, 8 punch-ins maximum par 30s seulement aux pics du discours',
    edits:'Silences >420ms, hésitations inutiles et ruptures de sens conservées à bon escient',
    broll:'0 à 5 inserts très concrets de 1.3–2.4s par 30s, orientés démonstration et opposition',
    graphics:'Mots ou nombres prononcés, 4 mots maximum par impact; aucun fait inventé',
    transitions:'Hard cuts rapides; pas de flash ou glitch automatique',
    sound:'Voix claire -13.5 LUFS; SFX réservés aux accents éditoriaux, jamais ajoutés pour remplir',
    color:'Contraste soutenu, saturation légèrement rehaussée, accent cyan',
    forbidden:['surmontage aléatoire','effets agressifs continus','titres non prononcés','fake proof']
  },
  clean:{
    name:'Clean',
    intent:'Personal brand premium, simplicité professionnelle',
    viewerEffect:'L’attention reste sur la personne et la qualité de sa parole',
    hook:'Aucune animation décorative; première phrase lisible immédiatement',
    typography:{font:'Noto Sans',weight:750,sizePx1080x1920:60,primary:'#FFFFFF',accent:'#FFFFFF',position:'lower_third',maxWords:5,wordHighlight:false,entrance:'soft-fade'},
    framing:'Facecam fixe, 3 recadrages subtils maximum par 30s et seulement si nécessaires',
    edits:'Silences >620ms et hésitations inutiles, avec transitions invisibles',
    broll:'0 à 1 insert utile de 1.7–2.9s par 30s; sinon pas de B-roll',
    graphics:'Aucune carte graphique automatique',
    transitions:'Cuts invisibles, aucun effet',
    sound:'Voix naturelle normalisée à -14 LUFS, sans musique forcée',
    color:'Balance neutre, saturation naturelle, pas de filtre spectaculaire',
    forbidden:['word-by-word karaoke','cartouches inutiles','effets de transition','zoom décoratif']
  },
  explainer:{
    name:'Explainer',
    intent:'Tutoriel, produit ou méthode dont chaque étape devient compréhensible',
    viewerEffect:'Le spectateur voit l’objet ou l’étape exacts quand ils sont expliqués',
    hook:'Montrer le problème ou le résultat concret annoncé, pas une accroche décorative',
    typography:{font:'DejaVu Sans',weight:800,sizePx1080x1920:68,primary:'#FFFFFF',accent:'#7CE8FF',position:'middle_low',maxWords:4,wordHighlight:true,entrance:'soft-fade'},
    framing:'Facecam lisible; 5 recadrages au maximum par 30s au moment de démontrer',
    edits:'Silences >560ms et fillers inutiles, sans couper les consignes',
    broll:'0 à 5 inserts démonstratifs de 1.7–3.3s par 30s; interfaces réelles, outils et gestes cités',
    graphics:'Cartes étapes seulement si une étape est énoncée; jamais de faux écran ni de faux logiciel',
    transitions:'Cut vers preuve/démonstration et retour; aucun mouvement masquant l’information',
    sound:'Voix au premier plan, effets minimaux pour préserver les consignes',
    color:'Bleu cyan #7CE8FF pour guider le regard, contrastes utiles',
    forbidden:['interface fictive','étapes inventées','photos de laptop génériques','schémas illisibles']
  },
  ugc_native:{
    name:'UGC Native',
    intent:'Témoignage ou démonstration produit authentique filmée au téléphone',
    viewerEffect:'Le créateur paraît spontané, pas produit par une agence',
    hook:'Commencer sur geste, phrase ou produit réel; conserver le rythme naturel',
    typography:{font:'DejaVu Sans',weight:850,sizePx1080x1920:68,primary:'#FFFFFF',accent:'#FF3FBF',position:'middle_low',maxWords:4,wordHighlight:true,entrance:'subtle-pop'},
    framing:'Recadrages très légers, 3 maximum par 30s; gestuelle et produit toujours visibles',
    edits:'Silences >740ms, garder les hésitations humaines qui ajoutent de l’authenticité',
    broll:'0 à 1 insert produit authentique de 1.5–2.6s par 30s, jamais image de remplacement trompeuse',
    graphics:'Sous-titres lisibles et spontanés; ne pas afficher de badge commercial automatique',
    transitions:'Cuts natifs, pas de publicité flashy',
    sound:'Voix naturelle, réduction minimale du bruit, effets sonores généralement absents',
    color:'Couleur smartphone crédible, saturation légère, pas d’étalonnage cinématique',
    forbidden:['fausses démonstrations','surproduction','publicité artificielle','B-roll décoratif']
  }
});

export function premiumModelContract(style){
  const alias={creator_clean:'clean',business_viral:'impact'};
  return PREMIUM_MODEL_CONTRACTS[alias[style]||style]||null;
}

export const CAPTION_PRESETS={
  codie:{fontFamily:'Noto Sans',fontWeight:850,fontSize:66,lineHeight:1.02,maxWordsPerLine:4,maxChars:30,maxDurationMs:1900,position:'middle_low',activeWord:false,textColor:'#ffffff',activeColor:'#ff9b45',stroke:3,shadow:true,background:false,entrance:'soft-fade'},
  editorial:{fontFamily:'Noto Serif',fontWeight:500,fontSize:49,lineHeight:1.1,maxWordsPerLine:7,maxChars:42,maxDurationMs:2900,position:'lower_third',activeWord:false,textColor:'#f7f2e9',activeColor:'#f7f2e9',stroke:2,shadow:true,background:false},
  authority:{fontFamily:'Noto Sans',fontWeight:800,fontSize:64,lineHeight:1.02,maxWordsPerLine:5,maxChars:34,maxDurationMs:2100,position:'lower_third',activeWord:true,textColor:'#ffffff',activeColor:'#ff9b45',stroke:4,shadow:true,background:false},
  impact:{fontFamily:'DejaVu Sans',fontWeight:900,fontSize:80,lineHeight:.96,maxWordsPerLine:3,maxChars:23,maxDurationMs:1500,position:'middle_low',activeWord:true,textColor:'#ffffff',activeColor:'#37e6ff',stroke:6,shadow:true,background:false,entrance:'fast-pop'},
  clean:{fontFamily:'Noto Sans',fontWeight:750,fontSize:60,lineHeight:1.04,maxWordsPerLine:5,maxChars:34,maxDurationMs:2200,position:'lower_third',activeWord:false,textColor:'#ffffff',activeColor:'#ffffff',stroke:3,shadow:true,background:false,entrance:'soft-fade'},
  explainer:{fontFamily:'DejaVu Sans',fontWeight:800,fontSize:68,lineHeight:1,maxWordsPerLine:4,maxChars:28,maxDurationMs:1850,position:'middle_low',activeWord:true,textColor:'#ffffff',activeColor:'#7ce8ff',stroke:4,shadow:true,background:true,entrance:'soft-fade'},
  data:{fontFamily:'Noto Sans',fontWeight:900,fontSize:70,lineHeight:.98,maxWordsPerLine:4,maxChars:27,maxDurationMs:1750,position:'lower_middle',activeWord:true,textColor:'#ffffff',activeColor:'#ffd166',stroke:5,shadow:true,background:false},
  ugc:{fontFamily:'DejaVu Sans',fontWeight:850,fontSize:68,lineHeight:1,maxWordsPerLine:4,maxChars:29,maxDurationMs:1900,position:'middle_low',activeWord:true,textColor:'#ffffff',activeColor:'#ff3fbf',stroke:4,shadow:true,background:true,entrance:'subtle-pop'},
  cinematic:{fontFamily:'Noto Serif',fontWeight:700,fontSize:56,lineHeight:1.08,maxWordsPerLine:6,maxChars:42,maxDurationMs:2800,position:'lower_third',activeWord:false,textColor:'#ffffff',activeColor:'#ffffff',stroke:2,shadow:true,background:false},
  modern_bold:{fontFamily:'DejaVu Sans',fontWeight:900,fontSize:78,lineHeight:.98,maxWordsPerLine:4,maxChars:28,maxDurationMs:1750,position:'lower_middle',activeWord:true,textColor:'#ffffff',activeColor:'#ff6a00',stroke:6,shadow:true,background:false},
  minimal:{fontFamily:'Noto Sans',fontWeight:700,fontSize:60,lineHeight:1.04,maxWordsPerLine:5,maxChars:34,maxDurationMs:2200,position:'lower_third',activeWord:false,textColor:'#ffffff',activeColor:'#ffffff',stroke:3,shadow:true,background:false},
  creator:{fontFamily:'DejaVu Sans',fontWeight:900,fontSize:74,lineHeight:.98,maxWordsPerLine:4,maxChars:27,maxDurationMs:1750,position:'middle_low',activeWord:true,textColor:'#ffffff',activeColor:'#37e6ff',stroke:5,shadow:true,background:false},
  karaoke:{fontFamily:'DejaVu Sans',fontWeight:900,fontSize:72,lineHeight:1,maxWordsPerLine:4,maxChars:27,maxDurationMs:1750,position:'lower_middle',activeWord:true,textColor:'#8a8b98',activeColor:'#ffffff',stroke:4,shadow:true,background:true}
};

export function buildEditTimeline({
  analysis,
  style='creator_clean',
  captionPreset=null,
  format='native',
  sourceWidth=null,
  sourceHeight=null
}){
  const canonicalStyle={creator_clean:'clean',business_viral:'impact',podcast_authority:'authority'}[style]||style;
  const styleCfg=EDIT_STYLES[canonicalStyle]||EDIT_STYLES.clean;
  const preset=styleCfg.captions;
  const captionCfg=CAPTION_PRESETS[preset]||CAPTION_PRESETS.modern_bold;

  const durationMs=Math.max(
    1,
    Math.round(Number(analysis?.measurable?.durationSec||0)*1000)
  );
  const words=Array.isArray(analysis?.transcript?.words)
    ?analysis.transcript.words
    :[];
  const silences=Array.isArray(analysis?.measurable?.silenceWindows)
    ?analysis.measurable.silenceWindows
    :[];

  const removals=[
    ...silenceRemovalWindows(
      silences,
      styleCfg.silenceThresholdMs,
      durationMs
    ),
    ...(styleCfg.removeFillers
      ?fillerRemovalWindows(words,durationMs)
      :[])
  ];

  const mergedRemovals=mergeRanges(
    removals,
    canonicalStyle==='impact'?45:80,
    durationMs
  );
  const minKeepMs=canonicalStyle==='impact'?110:150;
  const keepRanges=invertRanges(
    mergedRemovals,
    durationMs,
    minKeepMs
  );
  const outputDurationMs=keepRanges.reduce(
    (sum,r)=>sum+(r.endMs-r.startMs),
    0
  );

  const mappedWords=words
    .map(w=>mapWord(w,keepRanges))
    .filter(Boolean);
  const captions=groupCaptions(
    mappedWords,
    captionCfg
  );

  const punchIns=buildPunchIns({
    editorialTimeline:Array.isArray(analysis?.timeline)
      ?analysis.timeline
      :[],
    keepRanges,
    outputDurationMs,
    style:canonicalStyle,
    styleCfg,
    mappedWords
  });
  const graphicCues=buildGraphicCues({
    style:canonicalStyle,
    captions,
    outputDurationMs,
    styleCfg
  });

  const sourceW=
    Number(sourceWidth)||
    Number(analysis?.measurable?.width)||
    1080;
  const sourceH=
    Number(sourceHeight)||
    Number(analysis?.measurable?.height)||
    1920;
  const target=targetDimensions(format,sourceW,sourceH);

  return {
    version:3,
    engine:'editplus-timeline-v3-premium',
    fps:30,
    width:target.width,
    height:target.height,
    format:target.format,
    sourceAspect:sourceW/sourceH,
    style:canonicalStyle,
    modelId:canonicalStyle,
    modelContractVersion:MODEL_CONTRACT_VERSION,
    actionContract:describeEditActions(canonicalStyle),
    styleLabel:styleCfg.label,
    styleConfig:styleCfg,
    captionPreset:preset,
    captionConfig:captionCfg,
    sourceDurationMs:durationMs,
    outputDurationMs,
    keepRanges,
    removedRanges:mergedRemovals,
    captions,
    punchIns,
    graphicCues,
    brollCues:[],
    audio:{
      hasAudio:Boolean(analysis?.measurable?.audioCodec),
      normalize:true,
      targetLufs:-14,
      limiterDb:-1
    },
    export:{
      width:target.width,
      height:target.height,
      fps:30,
      codec:'h264',
      pixelFormat:'yuv420p',
      format:target.format
    }
  };
}


function buildGraphicCues({style,captions,outputDurationMs,styleCfg}){
  if(style==='editorial_breakdown')return buildEditorialBreakdownCues(captions,outputDurationMs);
  if(['codie','clean','authority','ugc_native','cinematic_story'].includes(style))return [];
  const cadence={
    impact:3200,
    explainer:5200,
    data:4300,
    ugc_native:6500,
    authority:8500,
    cinematic_story:10500
  }[style]||5000;
  const duration={
    impact:1450,
    explainer:2300,
    data:2200,
    ugc_native:1800,
    authority:2500,
    cinematic_story:3400
  }[style]||1800;
  const cues=[];
  let next=style==='impact'?700:1300;

  for(const c of captions||[]){
    const start=Number(c.startMs)||0;
    if(start<next)continue;
    const raw=String(c.text||'').replace(/\s+/g,' ').trim();
    if(!raw)continue;
    let text=raw;
    if(style==='data'){
      // Numerical overlays must reproduce exactly what was spoken.
      // Never derive a comparison, growth rate or citation from unrelated stock imagery.
      const m=raw.match(/(?:[€$£]\s*\d+(?:[.,]\d+)*|\b\d+(?:[\s\u00a0]\d{3})*(?:[.,]\d+)?(?:\s?(?:%|€|\$|£|k|K|M|millions?|milliards?|euros?|dollars?|heures?|jours?|ans?|clients?|abonnés?|vues?|views?))?)(?=$|[\s.,;!?])/i);
      if(!m)continue;
      text=m[0].trim();
    }else if(style==='impact'){
      text=raw.split(' ').slice(0,4).join(' ').toUpperCase();
    }else if(style==='explainer'){
      // A step card only appears when a sequence is genuinely spoken.
      if(!/(?:^|\s)(?:étape\s*[1-9]|premi[eè]rement|deuxi[eè]mement|troisi[eè]mement|ensuite|puis|enfin|step\s*[1-9]|first|second|third|next|finally)(?:\b|$)/i.test(raw))continue;
      text=raw.split(' ').slice(0,7).join(' ');
    }
    cues.push({
      startMs:start,
      endMs:Math.min(outputDurationMs,start+duration),
      text:text.slice(0,54),
      mode:style,
      label:style==='data'
        ?'DATA'
        :style==='authority'
          ?'EXPERT'
          :style==='cinematic_story'
            ?'STORY'
            :null,
      accent:styleCfg?.visualSignature?.accent||'#ffffff'
    });
    next=start+cadence;
    if(cues.length>=Math.max(2,Math.ceil(outputDurationMs/7000)))break;
  }
  return cues;
}

// Metrics are extracted only from caption text backed by timestamped transcript words.
 // The reference's translucent side-by-side arithmetic is only permitted with
 // multiple actual spoken values; never infer revenue, retention or percentages.
function buildEditorialBreakdownCues(captions,outputDurationMs){
  const cues=[];
  const numeric=/(?:[$€£]\s*\d+(?:[.,]\d+)*(?:\s*\/\s*(?:h|hr|hour|heure))?|\b\d+(?:[.,]\d+)?\s*(?:%|[$€£]|hours?|hrs?|heures?|minutes?|days?|jours?|clients?|euros?|dollars?|fois|times)?)(?!\w)/gi;
  let availableAt=900;
  let lastStatement=-10000;
  for(const caption of captions||[]){
    const sentence=String(caption?.text||'').replace(/\s+/g,' ').trim();
    const at=Math.max(0,Math.round(Number(caption?.startMs)||0));
    if(at<availableAt||!sentence)continue;
    const tokens=[...sentence.matchAll(numeric)].map(m=>m[0].trim())
      .filter(v=>/\d/.test(v)&&!/^0+(?:[.,]0+)?$/.test(v)).slice(0,3);
    if(!tokens.length){
      // The reference also uses restrained serif editorial statements and
      // questions. Their wording must come directly from spoken captions.
      const editorialPhrase=/\b(?:why|because|without|but|however|actually|means|costs?|money|pourquoi|parce|mais|sans|signifie|coûte|perdre|économiser)\b|[?？]/i.test(sentence);
      if(editorialPhrase&&sentence.length>=9&&sentence.length<=76&&
        sentence.split(' ').length>=2&&at-lastStatement>=7500){
        cues.push({
          startMs:at,endMs:Math.min(outputDurationMs,at+2600),
          kind:'statement',mode:'editorial_breakdown',text:sentence,
          figures:[],sourceText:sentence,evidence:'timestamped_transcript',accent:'#f5eee2'
        });
        lastStatement=at;
        availableAt=at+2600;
      }
      continue;
    }
    const unique=[...new Set(tokens)];
    const explicitEquals=/[=×*]|(?:\b(?:equals?|égal(?:e|ent)?|x|multiplied|fois)\b)/i.test(sentence);
    const kind=unique.length>1?(explicitEquals?'equation':'comparison'):'stat';
    // Never invent the arithmetic result: display only the verbatim values.
    const text=kind==='stat'?unique[0]:unique.join('   ·   ');
    const dur=kind==='stat'?2700:3500;
    cues.push({
      startMs:at,
      endMs:Math.min(outputDurationMs,at+dur),
      kind,mode:'editorial_breakdown',
      text:text.slice(0,66),
      figures:unique,
      sourceText:sentence.slice(0,180),
      evidence:'timestamped_transcript',
      accent:'#f5eee2'
    });
    availableAt=at+(kind==='stat'?2250:3200);
    if(cues.length>=Math.max(2,Math.ceil(outputDurationMs/5200)))break;
  }
  return cues.filter(c=>c.endMs>c.startMs+300);
}

function targetDimensions(format,width,height){
  const f=['native','portrait','landscape'].includes(String(format))
    ?String(format)
    :'native';

  if(f==='portrait'){
    return {format:'portrait',width:1080,height:1920};
  }
  if(f==='landscape'){
    return {format:'landscape',width:1920,height:1080};
  }

  const w=Math.max(2,Number(width)||1080);
  const h=Math.max(2,Number(height)||1920);
  const long=Math.max(w,h);
  const short=Math.min(w,h);
  const scale=Math.min(1,1920/long,1080/short);
  return {
    format:'native',
    width:even(Math.max(2,Math.round(w*scale))),
    height:even(Math.max(2,Math.round(h*scale)))
  };
}

function even(n){
  const v=Math.max(2,Math.round(Number(n)||2));
  return v%2===0?v:v-1;
}

function silenceRemovalWindows(
  silences,
  thresholdMs,
  durationMs
){
  const out=[];
  for(const s of silences){
    const start=Math.max(
      0,
      Math.round(Number(s.start||0)*1000)
    );
    const end=Math.min(
      durationMs,
      Math.round(Number(s.end||0)*1000)
    );
    const d=end-start;
    if(d<thresholdMs)continue;
    const keepEdge=Math.min(
      140,
      Math.floor(d*.18)
    );
    if(end-start-keepEdge*2>=220){
      out.push({
        startMs:start+keepEdge,
        endMs:end-keepEdge,
        reason:'silence'
      });
    }
  }
  return out;
}

function fillerRemovalWindows(words,durationMs){
  const out=[];
  for(const w of words){
    const token=String(w.text||'')
      .toLowerCase()
      .replace(/[^a-zà-ÿ]/g,'');
    if(!FILLERS.has(token))continue;
    const start=Math.max(
      0,
      Number(w.startMs)||0
    );
    const end=Math.min(
      durationMs,
      Number(w.endMs)||start
    );
    if(end-start<=1200){
      out.push({
        startMs:Math.max(0,start-45),
        endMs:Math.min(durationMs,end+45),
        reason:'hesitation'
      });
    }
  }
  return out;
}

function mergeRanges(
  ranges,
  gap=0,
  durationMs=Infinity
){
  const sorted=ranges
    .map(r=>({
      startMs:Math.max(
        0,
        Math.round(Number(r.startMs)||0)
      ),
      endMs:Math.min(
        durationMs,
        Math.round(Number(r.endMs)||0)
      ),
      reason:r.reason||'cut'
    }))
    .filter(r=>r.endMs>r.startMs)
    .sort((a,b)=>a.startMs-b.startMs);

  const out=[];
  for(const r of sorted){
    const last=out[out.length-1];
    if(last&&r.startMs<=last.endMs+gap){
      last.endMs=Math.max(
        last.endMs,
        r.endMs
      );
      if(!last.reason.includes(r.reason)){
        last.reason+=`+${r.reason}`;
      }
    }else{
      out.push({...r});
    }
  }
  return out;
}

function invertRanges(
  removals,
  durationMs,
  minKeepMs=120
){
  const out=[];
  let cursor=0;

  for(const r of removals){
    if(r.startMs-cursor>=minKeepMs){
      out.push({
        startMs:cursor,
        endMs:r.startMs
      });
    }
    cursor=Math.max(cursor,r.endMs);
  }

  if(durationMs-cursor>=minKeepMs){
    out.push({
      startMs:cursor,
      endMs:durationMs
    });
  }

  return out.length
    ?out
    :[{startMs:0,endMs:durationMs}];
}

export function mapOriginalToOutput(
  ms,
  keepRanges
){
  let acc=0;
  for(const r of keepRanges){
    if(ms<r.startMs)return null;
    if(ms<=r.endMs){
      return acc+(ms-r.startMs);
    }
    acc+=r.endMs-r.startMs;
  }
  return null;
}

function mapWord(word,keepRanges){
  const start=mapOriginalToOutput(
    Number(word.startMs)||0,
    keepRanges
  );
  const end=mapOriginalToOutput(
    Number(word.endMs)||
    Number(word.startMs)||
    0,
    keepRanges
  );

  if(
    start==null||
    end==null||
    end<=start
  )return null;

  return {
    text:String(word.text||'').trim(),
    startMs:Math.round(start),
    endMs:Math.round(end),
    speaker:word.speaker||null
  };
}

function groupCaptions(words,cfg={}){
  const out=[];
  let group=[];
  const maxWords=Math.max(2,Number(cfg.maxWordsPerLine)||5);
  const maxChars=Math.max(18,Number(cfg.maxChars)||34);
  const maxDurationMs=Math.max(900,Number(cfg.maxDurationMs)||2200);

  const groupText=()=>group
    .map(w=>String(w.text||'').trim())
    .filter(Boolean)
    .join(' ')
    .replace(/\s+([,.;!?])/g,'$1');

  const flush=()=>{
    if(!group.length)return;
    const first=group[0];
    const last=group[group.length-1];
    out.push({
      startMs:first.startMs,
      endMs:Math.max(last.endMs,first.startMs+120),
      text:groupText(),
      words:group.map(w=>({...w}))
    });
    group=[];
  };

  for(const w of words){
    const prev=group[group.length-1];
    const pause=prev?w.startMs-prev.endMs:0;
    const nextText=group.length
      ?groupText()+' '+String(w.text||'').trim()
      :String(w.text||'').trim();
    const nextDuration=group.length
      ?Math.max(0,(Number(w.endMs)||0)-(Number(group[0].startMs)||0))
      :0;

    if(
      group.length&&(
        group.length>=maxWords||
        nextText.length>maxChars||
        nextDuration>maxDurationMs||
        pause>330
      )
    )flush();

    group.push(w);

    // Human caption phrasing: close on sentence boundaries and strong micro-pauses.
    if(/[.!?]$/.test(String(w.text||''))||(pause>240&&group.length>=2)){
      flush();
    }
  }

  flush();
  return out;
}

function buildPunchIns({
  editorialTimeline,
  keepRanges,
  outputDurationMs,
  style,
  styleCfg,
  mappedWords=[]
}){
  const windows=[];
  const firstEnd=Math.min(
    outputDurationMs,
    style==='codie'
      ?1600
      :style==='impact'
        ?1050
        :style==='authority'
          ?1350
          :1250
  );

  if(firstEnd>400&&style==='impact'){
    windows.push({
      startMs:0,
      endMs:firstEnd,
      scale:styleCfg.punchScale,
      reason:'hook_emphasis'
    });
  }

  for(const item of editorialTimeline){
    if(
      !styleCfg.punchSeverities.includes(
        item.severity
      )
    )continue;

    const startOriginal=Math.max(
      0,
      Math.round(
        Number(item.start_sec||0)*1000
      )
    );
    const endOriginal=Math.max(
      startOriginal+350,
      Math.round(
        Number(item.end_sec||0)*1000
      )
    );
    const start=mapOriginalToOutput(
      startOriginal,
      keepRanges
    );
    const end=mapOriginalToOutput(
      endOriginal,
      keepRanges
    );

    if(
      start==null||
      end==null||
      end-start<250
    )continue;

    const maxWindow=
      style==='impact'
        ?1700
        :style==='authority'
          ?2600
          :2200;

    windows.push({
      startMs:Math.max(0,start),
      endMs:Math.min(
        outputDurationMs,
        Math.min(end,start+maxWindow)
      ),
      scale:styleCfg.punchScale,
      reason:
        item.label||
        item.problem||
        'editorial_emphasis'
    });
  }


  // Narration-led emphasis: when multimodal analysis doesn't provide enough
  // timestamped high-impact events, use only actual spoken word anchors.
  // No arbitrary rhythmic zooms and no pseudo-retention effects.
  const spokenTrigger={
    impact:/^(mais|jamais|attention|erreur|pourquoi|non|stop|imagine|regarde|impossible|never|why|mistake|instead)[.!?,:]?$/i,
    explainer:/^(étape|ensuite|puis|enfin|premièrement|deuxièmement|step|next|finally)[.!?,:]?$/i,
    data:/^(?:[$€£]?\d+(?:[.,]\d+)?%?|prix|coût|chiffre|total|pourcentage|euros|dollars)[.!?,:]?$/i
  }[style];
  if(spokenTrigger&&Array.isArray(mappedWords)){
    const gap=style==='impact'?1900:2500;
    for(const word of mappedWords){
      const label=String(word?.text||'').trim();
      const start=Math.round(Number(word?.startMs)||0);
      if(!spokenTrigger.test(label)||start<700||start>outputDurationMs-450)continue;
      if(windows.some(v=>Math.abs(v.startMs-start)<gap))continue;
      windows.push({
        startMs:start,
        endMs:Math.min(outputDurationMs,start+(style==='impact'?1050:1350)),
        scale:styleCfg.punchScale,
        reason:'spoken_emphasis:'+label.slice(0,30)
      });
    }
  }


  const max=Math.max(
    1,
    Math.ceil(
      (outputDurationMs/30000)*
      styleCfg.maxPunchInsPer30s
    )
  );

  return windows
    .sort((a,b)=>a.startMs-b.startMs)
    .filter((item,index,arr)=>
      index===0||
      item.startMs-arr[index-1].startMs>300
    )
    .slice(0,max);
}
