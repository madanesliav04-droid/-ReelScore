const FILLERS=new Set(['euh','heu','uh','um','erm','hmm','hum']);

export const MODEL_CONTRACT_VERSION='editplus-models-v1';

export const EDIT_STYLES={
  codie:{label:'Codie',promise:'Business storytelling · facecam first',pace:'narrative',silenceThresholdMs:780,removeFillers:false,maxPunchInsPer30s:4,punchScale:1.10,punchSeverities:['red'],captions:'authority',broll:{maxPer30s:3,minDurationMs:1800,maxDurationMs:3200,minGapMs:4200},brollDirective:'Facecam dominante. B-roll uniquement lorsqu’il illustre précisément une phrase concrète. Pas de remplissage.',soundDesign:'minimal'},
  impact:{label:'Impact',promise:'High-energy business · retention first',pace:'fast',silenceThresholdMs:420,removeFillers:true,maxPunchInsPer30s:8,punchScale:1.13,punchSeverities:['red','orange'],captions:'impact',broll:{maxPer30s:7,minDurationMs:1200,maxDurationMs:2300,minGapMs:1600},brollDirective:'B-roll fréquent mais concret: produits, chiffres, lieux, marques, actions. Chaque insert doit accélérer la compréhension.',soundDesign:'moderate'},
  clean:{label:'Clean',promise:'Modern creator · simple and polished',pace:'medium_fast',silenceThresholdMs:620,removeFillers:true,maxPunchInsPer30s:4,punchScale:1.07,punchSeverities:['red'],captions:'clean',broll:{maxPer30s:3,minDurationMs:1600,maxDurationMs:2800,minGapMs:3600},brollDirective:'Très peu de B-roll. Seulement quand une image clarifie mieux que la facecam.',soundDesign:'light'},
  authority:{label:'Authority',promise:'Podcast & expert · calm premium',pace:'calm_premium',silenceThresholdMs:920,removeFillers:false,maxPunchInsPer30s:3,punchScale:1.06,punchSeverities:['red'],captions:'authority',broll:{maxPer30s:3,minDurationMs:2400,maxDurationMs:4200,minGapMs:5200},brollDirective:'B-roll rare, long, crédible et documentaire moderne. Priorité au visage et à la parole.',soundDesign:'minimal'},
  explainer:{label:'Explainer',promise:'Tutorial & SaaS · show what is being explained',pace:'medium_fast',silenceThresholdMs:560,removeFillers:true,maxPunchInsPer30s:5,punchScale:1.08,punchSeverities:['red','orange'],captions:'explainer',broll:{maxPer30s:6,minDurationMs:1600,maxDurationMs:3200,minGapMs:2100},brollDirective:'Cherche des interfaces, outils, objets ou étapes concrètes correspondant exactement à l’explication. Évite les images génériques.',soundDesign:'light'},
  data:{label:'Data',promise:'Numbers & evidence · proof on screen',pace:'fast',silenceThresholdMs:500,removeFillers:true,maxPunchInsPer30s:5,punchScale:1.09,punchSeverities:['red','orange'],captions:'data',broll:{maxPer30s:5,minDurationMs:1700,maxDurationMs:3000,minGapMs:2300},brollDirective:'Priorité aux preuves visuelles: documents modernes, tableaux, dashboards, produits comparés, lieux ou éléments cités. Pas d’archives décoratives.',soundDesign:'light'},
  ugc_native:{label:'UGC Native',promise:'Native social · human and unpolished',pace:'natural',silenceThresholdMs:740,removeFillers:false,maxPunchInsPer30s:4,punchScale:1.05,punchSeverities:['red'],captions:'ugc',broll:{maxPer30s:2,minDurationMs:1400,maxDurationMs:2600,minGapMs:5000},brollDirective:'Très peu de B-roll. Favorise produit, geste, détail ou usage réel. Le rendu doit rester natif téléphone.',soundDesign:'light'},
  cinematic_story:{label:'Cinematic Story',promise:'Personal story · emotion and breathing room',pace:'story',silenceThresholdMs:1100,removeFillers:false,maxPunchInsPer30s:2,punchScale:1.04,punchSeverities:['red'],captions:'cinematic',broll:{maxPer30s:4,minDurationMs:3000,maxDurationMs:6000,minGapMs:4800},brollDirective:'B-roll narratif et émotionnel, plus long. Cherche des lieux, objets, actions ou atmosphères directement reliés à l’histoire.',soundDesign:'cinematic'},
  creator_clean:null,business_viral:null,podcast_authority:null
};
EDIT_STYLES.creator_clean=EDIT_STYLES.clean;
EDIT_STYLES.business_viral=EDIT_STYLES.impact;
EDIT_STYLES.podcast_authority=EDIT_STYLES.authority;

export const CAPTION_PRESETS={
  authority:{fontFamily:'Noto Sans',fontWeight:800,fontSize:62,lineHeight:1.02,maxWordsPerLine:7,position:'lower_third',activeWord:true,textColor:'#ffffff',activeColor:'#ff9b45',stroke:4,shadow:true,background:false},
  impact:{fontFamily:'DejaVu Sans',fontWeight:900,fontSize:78,lineHeight:.96,maxWordsPerLine:4,position:'middle_low',activeWord:true,textColor:'#ffffff',activeColor:'#37e6ff',stroke:6,shadow:true,background:false},
  clean:{fontFamily:'Noto Sans',fontWeight:700,fontSize:58,lineHeight:1.04,maxWordsPerLine:7,position:'lower_third',activeWord:false,textColor:'#ffffff',activeColor:'#ffffff',stroke:3,shadow:true,background:false},
  explainer:{fontFamily:'DejaVu Sans',fontWeight:800,fontSize:66,lineHeight:1,maxWordsPerLine:6,position:'middle_low',activeWord:true,textColor:'#ffffff',activeColor:'#7ce8ff',stroke:4,shadow:true,background:true},
  data:{fontFamily:'Noto Sans',fontWeight:900,fontSize:68,lineHeight:.98,maxWordsPerLine:5,position:'lower_middle',activeWord:true,textColor:'#ffffff',activeColor:'#ffd166',stroke:5,shadow:true,background:false},
  ugc:{fontFamily:'DejaVu Sans',fontWeight:850,fontSize:66,lineHeight:1,maxWordsPerLine:6,position:'middle_low',activeWord:true,textColor:'#ffffff',activeColor:'#ff3fbf',stroke:4,shadow:true,background:true},
  cinematic:{fontFamily:'Noto Serif',fontWeight:700,fontSize:54,lineHeight:1.08,maxWordsPerLine:8,position:'lower_third',activeWord:false,textColor:'#ffffff',activeColor:'#ffffff',stroke:2,shadow:true,background:false},
  modern_bold:{fontFamily:'DejaVu Sans',fontWeight:900,fontSize:76,lineHeight:.98,maxWordsPerLine:5,position:'lower_middle',activeWord:true,textColor:'#ffffff',activeColor:'#ff6a00',stroke:6,shadow:true,background:false},
  minimal:{fontFamily:'Noto Sans',fontWeight:700,fontSize:58,lineHeight:1.04,maxWordsPerLine:7,position:'lower_third',activeWord:false,textColor:'#ffffff',activeColor:'#ffffff',stroke:3,shadow:true,background:false},
  creator:{fontFamily:'DejaVu Sans',fontWeight:900,fontSize:72,lineHeight:.98,maxWordsPerLine:5,position:'middle_low',activeWord:true,textColor:'#ffffff',activeColor:'#37e6ff',stroke:5,shadow:true,background:false},
  karaoke:{fontFamily:'DejaVu Sans',fontWeight:900,fontSize:70,lineHeight:1,maxWordsPerLine:5,position:'lower_middle',activeWord:true,textColor:'#8a8b98',activeColor:'#ffffff',stroke:4,shadow:true,background:true}
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
    style==='impact'?45:80,
    durationMs
  );
  const minKeepMs=style==='impact'?110:150;
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
    captionCfg.maxWordsPerLine
  );

  const punchIns=buildPunchIns({
    editorialTimeline:Array.isArray(analysis?.timeline)
      ?analysis.timeline
      :[],
    keepRanges,
    outputDurationMs,
    style:canonicalStyle,
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
    version:2,
    engine:'editplus-timeline-v2-contextual',
    fps:30,
    width:target.width,
    height:target.height,
    format:target.format,
    sourceAspect:sourceW/sourceH,
    style:canonicalStyle,
    modelId:canonicalStyle,
    modelContractVersion:MODEL_CONTRACT_VERSION,
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

function groupCaptions(words,maxWords){
  const out=[];
  let group=[];

  const flush=()=>{
    if(!group.length)return;
    const first=group[0];
    const last=group[group.length-1];

    out.push({
      startMs:first.startMs,
      endMs:last.endMs,
      text:group
        .map(w=>w.text)
        .join(' ')
        .replace(/\s+([,.;!?])/g,'$1'),
      words:group.map(w=>({...w}))
    });
    group=[];
  };

  for(const w of words){
    const prev=group[group.length-1];
    const pause=prev
      ?w.startMs-prev.endMs
      :0;

    if(
      group.length>=maxWords||
      pause>480
    )flush();

    group.push(w);

    if(/[.!?]$/.test(w.text)){
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
  styleCfg
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

  if(firstEnd>400){
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
