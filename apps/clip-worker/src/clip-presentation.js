// Vertical-safe Clip+ presentation. Never crop source subtitles or faces:
// fit the complete input into 9:16 with a soft blurred background instead.
export function buildClipVideoFilter(assPath=null){
  const source=[
    'split=2[bg][fg]',
    '[bg]scale=1080:1920:force_original_aspect_ratio=increase:flags=lanczos,crop=1080:1920,boxblur=28:5,eq=brightness=-0.20:saturation=0.78[back]',
    '[fg]scale=1080:1920:force_original_aspect_ratio=decrease:flags=lanczos,setsar=1[full]',
    '[back][full]overlay=(W-w)/2:(H-h)/2:shortest=1,setsar=1'
  ];
  if(assPath)source[3]+=",ass='"+String(assPath).replace(/\\/g,'\\\\').replace(/'/g,"\\'").replace(/:/g,'\\:')+"'";
  return source.join(';');
}

export function buildClipCaptionAss(words,clipStartMs,clipEndMs,preset='modern_bold'){
  const font=preset==='minimal'?{size:54,outline:3}:preset==='authority'?{size:58,outline:4}:{size:62,outline:4};
  const groups=[];
  let group=[];
  const emit=()=>{if(group.length){groups.push(group);group=[]}};
  for(const item of words||[]){
    const start=Math.max(clipStartMs,Number(item.startMs)||0);
    const end=Math.min(clipEndMs,Number(item.endMs)||0);
    const text=String(item.text||'').trim();
    if(!text||end<=start)continue;
    const previous=group.at(-1);
    const gap=previous?start-previous.endMs:0;
    const textLength=group.reduce((n,x)=>n+x.text.length+1,0)+text.length;
    if(group.length>=4||textLength>28||gap>380)emit();
    group.push({startMs:start,endMs:end,text});
    if(/[.!?]$/.test(text))emit();
  }
  emit();
  const header=[
    '[Script Info]','ScriptType: v4.00+','PlayResX: 1080','PlayResY: 1920',
    'WrapStyle: 0','ScaledBorderAndShadow: yes','','[V4+ Styles]',
    'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding',
    // 430px bottom offset and 95px side margins keep text out of mobile UI zones.
    `Style: Default,DejaVu Sans,${font.size},&H00FFFFFF,&H00FFFFFF,&H00101012,&H77000000,-1,0,0,0,100,100,0,0,1,${font.outline},2,2,95,95,430,1`,
    '','[Events]',
    'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text'
  ];
  const time=(ms)=>{
    const secs=Math.max(0,ms/1000),h=Math.floor(secs/3600),m=Math.floor(secs%3600/60);
    return `${h}:${String(m).padStart(2,'0')}:${(secs%60).toFixed(2).padStart(5,'0')}`;
  };
  const clean=(value)=>String(value).replace(/\\/g,'\\\\').replace(/[{}]/g,'').replace(/[\r\n]+/g,' ');
  const events=groups.map(items=>{
    const start=(items[0].startMs-clipStartMs);
    const end=(items.at(-1).endMs-clipStartMs);
    const joined=items.map(x=>clean(x.text)).join(' ');
    // Explicit two-line split for 1080x1920, avoiding edge clipping.
    const words=joined.split(/\s+/);
    let result=joined;
    if(joined.length>20&&words.length>2){
      const midpoint=Math.ceil(words.length/2);
      result=words.slice(0,midpoint).join(' ')+'\\N'+words.slice(midpoint).join(' ');
    }
    return `Dialogue: 0,${time(start)},${time(end)},Default,,0,0,0,,${result}`;
  });
  return header.concat(events).join('\n');
}
