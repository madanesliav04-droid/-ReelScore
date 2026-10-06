export const EDIT_STYLES={
  creator_clean:{pace:'medium_fast',broll:'selective',punchIns:'narrative',transitions:['cut'],soundDesign:'light'},
  codie:{pace:'narrative',broll:'reinforce_only',punchIns:'semantic_emphasis',transitions:['cut'],soundDesign:'minimal'},
  business_viral:{pace:'fast',broll:'contextual',punchIns:'frequent_but_meaningful',transitions:['cut','whip_if_justified'],soundDesign:'moderate'},
  podcast_authority:{pace:'calm_premium',broll:'contextual',punchIns:'measured',transitions:['cut'],soundDesign:'minimal'}
};

export const CAPTION_PRESETS={
  modern_bold:{weight:800,maxWordsPerLine:5,position:'lower_middle',activeWord:true,animation:'subtle_pop'},
  minimal:{weight:600,maxWordsPerLine:7,position:'lower_middle',activeWord:false,animation:'none'},
  creator:{weight:700,maxWordsPerLine:6,position:'middle_low',activeWord:true,animation:'fade_up'},
  karaoke:{weight:800,maxWordsPerLine:5,position:'lower_middle',activeWord:true,animation:'word_progress'},
  authority:{weight:700,maxWordsPerLine:7,position:'lower_third',activeWord:false,animation:'fade'},
  ugc:{weight:700,maxWordsPerLine:6,position:'middle_low',activeWord:true,animation:'light_pop'}
};

export function buildEditTimeline({durationMs,style='creator_clean',captionPreset='modern_bold',analysis=null,transcript=[]}){
  if(!EDIT_STYLES[style]) throw new Error(`Style inconnu: ${style}`);
  if(!CAPTION_PRESETS[captionPreset]) throw new Error(`Preset captions inconnu: ${captionPreset}`);
  const cuts=deriveCuts(durationMs,analysis);
  return {
    version:1,fps:30,width:1080,height:1920,style,captionPreset,
    styleConfig:EDIT_STYLES[style],captionConfig:CAPTION_PRESETS[captionPreset],
    segments:cuts.map((x,i)=>({
      id:`seg_${i+1}`,
      sourceStartMs:x.startMs,sourceEndMs:x.endMs,
      crop:x.emphasis?'close':'normal',
      captionPreset,
      broll:x.broll?{mode:'library',query:x.broll}:null,
      transition:'cut',reason:x.reason||'Maintain pacing'
    })),
    transcript
  };
}

function deriveCuts(durationMs,analysis){
  const end=Math.max(0,Number(durationMs)||0);
  const hotspots=Array.isArray(analysis?.timeline)?analysis.timeline:[];
  if(!hotspots.length) return [{startMs:0,endMs:end,emphasis:false,reason:'Base edit'}];
  const points=[0,...hotspots.flatMap(h=>[Number(h.start_sec)*1000,Number(h.end_sec)*1000]).filter(Number.isFinite),end]
    .map(x=>Math.max(0,Math.min(end,x))).sort((a,b)=>a-b);
  const uniq=[...new Set(points.map(Math.round))];
  const segs=[];
  for(let i=0;i<uniq.length-1;i++){
    if(uniq[i+1]-uniq[i]<120) continue;
    const hot=hotspots.find(h=>Number(h.start_sec)*1000<=uniq[i]&&Number(h.end_sec)*1000>=uniq[i+1]);
    segs.push({startMs:uniq[i],endMs:uniq[i+1],emphasis:hot?.severity==='red',reason:hot?.correction||hot?.problem||'Maintain pacing'});
  }
  return segs.length?segs:[{startMs:0,endMs:end,emphasis:false,reason:'Base edit'}];
}
