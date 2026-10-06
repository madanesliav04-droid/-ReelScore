const FILLERS=new Set(['euh','heu','uh','um','erm','hmm','hum']);

export const EDIT_STYLES={
  creator_clean:{
    label:'Creator Clean',
    pace:'medium_fast',
    silenceThresholdMs:620,
    removeFillers:true,
    maxPunchInsPer30s:5,
    punchScale:1.08,
    punchSeverities:['red'],
    captions:'modern_bold',
    broll:{maxPer30s:4,minDurationMs:1600,maxDurationMs:2800,minGapMs:2800},
    soundDesign:'light'
  },
  codie:{
    label:'Codie',
    pace:'narrative',
    silenceThresholdMs:780,
    removeFillers:false,
    maxPunchInsPer30s:4,
    punchScale:1.10,
    punchSeverities:['red'],
    captions:'authority',
    broll:{maxPer30s:3,minDurationMs:1800,maxDurationMs:3200,minGapMs:4200},
    soundDesign:'minimal'
  },
  business_viral:{
    label:'Business Viral',
    pace:'fast',
    silenceThresholdMs:440,
    removeFillers:true,
    maxPunchInsPer30s:8,
    punchScale:1.12,
    punchSeverities:['red','orange'],
    captions:'creator',
    broll:{maxPer30s:7,minDurationMs:1200,maxDurationMs:2300,minGapMs:1600},
    soundDesign:'moderate'
  },
  podcast_authority:{
    label:'Podcast Authority',
    pace:'calm_premium',
    silenceThresholdMs:920,
    removeFillers:false,
    maxPunchInsPer30s:3,
    punchScale:1.06,
    punchSeverities:['red'],
    captions:'authority',
    broll:{maxPer30s:3,minDurationMs:2400,maxDurationMs:4200,minGapMs:5200},
    soundDesign:'minimal'
  }
};

export const CAPTION_PRESETS={
  modern_bold:{
    fontFamily:'Liberation Sans',fontWeight:900,fontSize:76,lineHeight:0.98,
    maxWordsPerLine:5,position:'lower_middle',activeWord:true,
    textColor:'#ffffff',activeColor:'#ff6a00',stroke:6,shadow:true,background:false
  },
  minimal:{
    fontFamily:'Liberation Sans',fontWeight:700,fontSize:58,lineHeight:1.04,
    maxWordsPerLine:7,position:'lower_third',activeWord:false,
    textColor:'#ffffff',activeColor:'#ffffff',stroke:3,shadow:true,background:false
  },
  creator:{
    fontFamily:'Liberation Sans',fontWeight:900,fontSize:72,lineHeight:0.98,
    maxWordsPerLine:5,position:'middle_low',activeWord:true,
    textColor:'#ffffff',activeColor:'#37e6ff',stroke:5,shadow:true,background:false
  },
  karaoke:{
    fontFamily:'Liberation Sans',fontWeight:900,fontSize:70,lineHeight:1,
    maxWordsPerLine:5,position:'lower_middle',activeWord:true,
    textColor:'#8a8b98',activeColor:'#ffffff',stroke:4,shadow:true,background:true
  },
  authority:{
    fontFamily:'Liberation Sans',fontWeight:800,fontSize:62,lineHeight:1.02,
    maxWordsPerLine:7,position:'lower_third',activeWord:true,
    textColor:'#ffffff',activeColor:'#ff9b45',stroke:4,shadow:true,background:false
  },
  ugc:{
    fontFamily:'Liberation Sans',fontWeight:850,fontSize:66,lineHeight:1,
    maxWordsPerLine:6,position:'middle_low',activeWord:true,
    textColor:'#ffffff',activeColor:'#ff3fbf',stroke:4,shadow:true,background:true
  }
};

export function buildEditTimeline({
  analysis,
  style='creator_clean',
  captionPreset=null,
  format='native',
  sourceWidth=null,
  sourceHeight=null
}){
  const styleCfg=EDIT_STYLES[style]||EDIT_STYLES.creator_clean;
  const preset=captionPreset&&CAPTION_PRESETS[captionPreset]
    ?captionPreset
    :styleCfg.captions;
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
    style==='business_viral'?45:80,
    durationMs
  );
  const minKeepMs=style==='business_viral'?110:150;
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
    style,
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
    style,
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
      :style==='business_viral'
        ?1050
        :style==='podcast_authority'
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
      style==='business_viral'
        ?1700
        :style==='podcast_authority'
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
