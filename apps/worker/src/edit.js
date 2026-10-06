const FILLERS=new Set(['euh','heu','uh','um','erm','hmm','hum']);

export const EDIT_STYLES={
  creator_clean:{
    pace:'medium_fast',silenceThresholdMs:650,maxPunchInsPer30s:5,punchScale:1.08,
    captions:'modern_bold',broll:'selective',soundDesign:'light'
  },
  codie:{
    pace:'narrative',silenceThresholdMs:780,maxPunchInsPer30s:4,punchScale:1.10,
    captions:'authority',broll:'reinforce_only',soundDesign:'minimal'
  },
  business_viral:{
    pace:'fast',silenceThresholdMs:520,maxPunchInsPer30s:8,punchScale:1.12,
    captions:'creator',broll:'contextual',soundDesign:'moderate'
  },
  podcast_authority:{
    pace:'calm_premium',silenceThresholdMs:850,maxPunchInsPer30s:3,punchScale:1.07,
    captions:'authority',broll:'contextual',soundDesign:'minimal'
  }
};

export const CAPTION_PRESETS={
  modern_bold:{
    fontFamily:'Inter, Arial, sans-serif',fontWeight:900,fontSize:76,lineHeight:0.98,
    maxWordsPerLine:5,position:'lower_middle',activeWord:true,
    textColor:'#ffffff',activeColor:'#ff6a00',stroke:6,shadow:true,background:false
  },
  minimal:{
    fontFamily:'Inter, Arial, sans-serif',fontWeight:700,fontSize:58,lineHeight:1.04,
    maxWordsPerLine:7,position:'lower_third',activeWord:false,
    textColor:'#ffffff',activeColor:'#ffffff',stroke:3,shadow:true,background:false
  },
  creator:{
    fontFamily:'Inter, Arial, sans-serif',fontWeight:900,fontSize:72,lineHeight:0.98,
    maxWordsPerLine:5,position:'middle_low',activeWord:true,
    textColor:'#ffffff',activeColor:'#37e6ff',stroke:5,shadow:true,background:false
  },
  karaoke:{
    fontFamily:'Inter, Arial, sans-serif',fontWeight:900,fontSize:70,lineHeight:1,
    maxWordsPerLine:5,position:'lower_middle',activeWord:true,
    textColor:'#8a8b98',activeColor:'#ffffff',stroke:4,shadow:true,background:true
  },
  authority:{
    fontFamily:'Inter, Arial, sans-serif',fontWeight:800,fontSize:62,lineHeight:1.02,
    maxWordsPerLine:7,position:'lower_third',activeWord:true,
    textColor:'#ffffff',activeColor:'#ff9b45',stroke:4,shadow:true,background:false
  },
  ugc:{
    fontFamily:'Inter, Arial, sans-serif',fontWeight:850,fontSize:66,lineHeight:1,
    maxWordsPerLine:6,position:'middle_low',activeWord:true,
    textColor:'#ffffff',activeColor:'#ff3fbf',stroke:4,shadow:true,background:true
  }
};

export function buildEditTimeline({
  analysis,
  style='creator_clean',
  captionPreset=null
}){
  const styleCfg=EDIT_STYLES[style]||EDIT_STYLES.creator_clean;
  const preset=captionPreset&&CAPTION_PRESETS[captionPreset]
    ?captionPreset
    :styleCfg.captions;
  const captionCfg=CAPTION_PRESETS[preset]||CAPTION_PRESETS.modern_bold;

  const durationMs=Math.max(1,Math.round(Number(analysis?.measurable?.durationSec||0)*1000));
  const words=Array.isArray(analysis?.transcript?.words)?analysis.transcript.words:[];
  const silences=Array.isArray(analysis?.measurable?.silenceWindows)?analysis.measurable.silenceWindows:[];

  const removals=[
    ...silenceRemovalWindows(silences,styleCfg.silenceThresholdMs,durationMs),
    ...fillerRemovalWindows(words,durationMs)
  ];
  const mergedRemovals=mergeRanges(removals,80,durationMs);
  const keepRanges=invertRanges(mergedRemovals,durationMs,150);
  const outputDurationMs=keepRanges.reduce((s,r)=>s+(r.endMs-r.startMs),0);

  const mappedWords=words
    .map(w=>mapWord(w,keepRanges))
    .filter(Boolean);
  const captions=groupCaptions(mappedWords,captionCfg.maxWordsPerLine);

  const punchIns=buildPunchIns({
    editorialTimeline:Array.isArray(analysis?.timeline)?analysis.timeline:[],
    keepRanges,
    outputDurationMs,
    style,
    styleCfg
  });

  const brollCues=buildBrollCues({
    editorialTimeline:Array.isArray(analysis?.timeline)?analysis.timeline:[],
    keepRanges,
    style
  });

  return {
    version:1,
    engine:'editplus-timeline-v1',
    fps:30,
    width:1080,
    height:1920,
    style,
    styleConfig:styleCfg,
    captionPreset:preset,
    captionConfig:captionCfg,
    sourceDurationMs:durationMs,
    outputDurationMs,
    keepRanges,
    removedRanges:mergedRemovals,
    captions,
    punchIns,
    brollCues,
    audio:{
      normalize:true,
      targetLufs:-14,
      limiterDb:-1
    },
    export:{
      width:1080,height:1920,fps:30,codec:'h264',pixelFormat:'yuv420p'
    }
  };
}

function silenceRemovalWindows(silences,thresholdMs,durationMs){
  const out=[];
  for(const s of silences){
    const start=Math.max(0,Math.round(Number(s.start||0)*1000));
    const end=Math.min(durationMs,Math.round(Number(s.end||0)*1000));
    const d=end-start;
    if(d<thresholdMs)continue;
    const keepEdge=Math.min(130,Math.floor(d*0.18));
    if(end-start-keepEdge*2>=220){
      out.push({startMs:start+keepEdge,endMs:end-keepEdge,reason:'silence'});
    }
  }
  return out;
}

function fillerRemovalWindows(words,durationMs){
  const out=[];
  for(const w of words){
    const token=String(w.text||'').toLowerCase().replace(/[^a-zà-ÿ]/g,'');
    if(!FILLERS.has(token))continue;
    const start=Math.max(0,Number(w.startMs)||0);
    const end=Math.min(durationMs,Number(w.endMs)||start);
    if(end-start<=1200)out.push({
      startMs:Math.max(0,start-45),
      endMs:Math.min(durationMs,end+45),
      reason:'hesitation'
    });
  }
  return out;
}

function mergeRanges(ranges,gap=0,durationMs=Infinity){
  const sorted=ranges
    .map(r=>({
      startMs:Math.max(0,Math.round(Number(r.startMs)||0)),
      endMs:Math.min(durationMs,Math.round(Number(r.endMs)||0)),
      reason:r.reason||'cut'
    }))
    .filter(r=>r.endMs>r.startMs)
    .sort((a,b)=>a.startMs-b.startMs);

  const out=[];
  for(const r of sorted){
    const last=out[out.length-1];
    if(last&&r.startMs<=last.endMs+gap){
      last.endMs=Math.max(last.endMs,r.endMs);
      if(!last.reason.includes(r.reason))last.reason+=`+${r.reason}`;
    }else out.push({...r});
  }
  return out;
}

function invertRanges(removals,durationMs,minKeepMs=120){
  const out=[];let cursor=0;
  for(const r of removals){
    if(r.startMs-cursor>=minKeepMs)out.push({startMs:cursor,endMs:r.startMs});
    cursor=Math.max(cursor,r.endMs);
  }
  if(durationMs-cursor>=minKeepMs)out.push({startMs:cursor,endMs:durationMs});
  return out.length?out:[{startMs:0,endMs:durationMs}];
}

export function mapOriginalToOutput(ms,keepRanges){
  let acc=0;
  for(const r of keepRanges){
    if(ms<r.startMs)return null;
    if(ms<=r.endMs)return acc+(ms-r.startMs);
    acc+=r.endMs-r.startMs;
  }
  return null;
}

function mapWord(word,keepRanges){
  const start=mapOriginalToOutput(Number(word.startMs)||0,keepRanges);
  const end=mapOriginalToOutput(Number(word.endMs)||Number(word.startMs)||0,keepRanges);
  if(start==null||end==null||end<=start)return null;
  return {
    text:String(word.text||'').trim(),
    startMs:Math.round(start),
    endMs:Math.round(end),
    speaker:word.speaker||null
  };
}

function groupCaptions(words,maxWords){
  const out=[];let group=[];
  const flush=()=>{
    if(!group.length)return;
    const first=group[0],last=group[group.length-1];
    out.push({
      startMs:first.startMs,
      endMs:last.endMs,
      text:group.map(w=>w.text).join(' ').replace(/\s+([,.;!?])/g,'$1'),
      words:group.map(w=>({...w}))
    });
    group=[];
  };

  for(const w of words){
    const prev=group[group.length-1];
    const pause=prev?w.startMs-prev.endMs:0;
    if(group.length>=maxWords||pause>480)flush();
    group.push(w);
    if(/[.!?]$/.test(w.text))flush();
  }
  flush();
  return out;
}

function buildPunchIns({editorialTimeline,keepRanges,outputDurationMs,style,styleCfg}){
  const windows=[];
  const firstEnd=Math.min(outputDurationMs,style==='codie'?1600:1200);
  if(firstEnd>400)windows.push({startMs:0,endMs:firstEnd,scale:styleCfg.punchScale,reason:'hook_emphasis'});

  for(const item of editorialTimeline){
    if(item.severity!=='red')continue;
    const startOriginal=Math.max(0,Math.round(Number(item.start_sec||0)*1000));
    const endOriginal=Math.max(startOriginal+350,Math.round(Number(item.end_sec||0)*1000));
    const start=mapOriginalToOutput(startOriginal,keepRanges);
    const end=mapOriginalToOutput(endOriginal,keepRanges);
    if(start==null||end==null||end-start<250)continue;
    windows.push({
      startMs:Math.max(0,start),
      endMs:Math.min(outputDurationMs,end),
      scale:styleCfg.punchScale,
      reason:item.label||item.problem||'editorial_emphasis'
    });
  }

  const max=Math.max(1,Math.ceil((outputDurationMs/30000)*styleCfg.maxPunchInsPer30s));
  return mergeRanges(windows.map(w=>({...w,reason:w.reason})),120,outputDurationMs)
    .slice(0,max)
    .map((w,i)=>({...w,scale:windows[Math.min(i,windows.length-1)]?.scale||styleCfg.punchScale}));
}

function buildBrollCues({editorialTimeline,keepRanges,style}){
  if(style==='codie'||style==='creator_clean')return editorialTimeline
    .filter(x=>x.severity==='red'&&String(x.correction||'').toLowerCase().includes('b-roll'))
    .slice(0,3)
    .map(x=>cue(x,keepRanges))
    .filter(Boolean);

  return editorialTimeline
    .filter(x=>x.severity==='red'||x.severity==='orange')
    .slice(0,5)
    .map(x=>cue(x,keepRanges))
    .filter(Boolean);
}

function cue(x,keepRanges){
  const start=mapOriginalToOutput(Math.round(Number(x.start_sec||0)*1000),keepRanges);
  const end=mapOriginalToOutput(Math.round(Number(x.end_sec||0)*1000),keepRanges);
  if(start==null||end==null)return null;
  return {
    startMs:start,endMs:end,
    query:String(x.broll_query||x.label||x.problem||'contextual visual').slice(0,120),
    source:'library',
    assetUrl:null
  };
}
