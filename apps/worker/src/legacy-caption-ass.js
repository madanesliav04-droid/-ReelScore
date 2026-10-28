// Verbatim legacy caption API from codex/oracle-arm64-free-preparation-20261025.
// Additive compatibility only; no existing renderer switches to this path.
export function captionEntranceTag(entrance){
  if(entrance==='fast-pop'){
    return String.raw`{\fad(30,60)\fscx113\fscy113\t(0,120,\fscx100\fscy100)}`;
  }
  if(entrance==='subtle-pop'){
    return String.raw`{\fad(55,90)\fscx105\fscy105\t(0,150,\fscx100\fscy100)}`;
  }
  if(entrance==='soft-fade'){
    return String.raw`{\fad(85,95)}`;
  }
  return '';
}

export function buildCaptionAss(timeline,width,height){
  return buildAss(timeline,width,height);
}

function buildAss(
  timeline,
  width,
  height
){
  const cfg=
    timeline?.captionConfig||
    {};

  const sizeScale=
    Math.max(
      .55,
      Math.min(
        1.15,
        height/1920
      )
    );

  const fontSize=Math.max(
    22,
    Math.min(
      110,
      Math.round(
        (Number(cfg.fontSize)||68)*
        sizeScale
      )
    )
  );
  const outline=Math.max(
    0,
    Math.min(
      10,
      Number(cfg.stroke)||4
    )
  );

  const baseMargin={
    lower_middle:280,
    lower_third:220,
    middle_low:380
  }[cfg.position]||280;

  // OMNI Codie: captions anchored at the bottom centre of the actual
  // output canvas. Portrait uses the social-app safe zone; landscape stays
  // above the frame edge. No overlap with lateral bubble positions.
  const marginV=cfg.safeCaptionPlacement==='omni_bottom_center_adaptive'
    ?Math.round(height*(height>width?.155:.083))
    :Math.max(70,Math.round(baseMargin*sizeScale));

  const activeColor=
    assOverrideColor(
      cfg.activeColor||
      '#ff6a00'
    );
  const primary=
    assColor(
      cfg.textColor||
      '#ffffff'
    );
  const back=
    cfg.background
      ?'&H66000000'
      :'&HFF000000';
  const borderStyle=
    cfg.background
      ?3
      :1;
  const shadow=
    cfg.shadow
      ?2
      :0;

  const header=[
    '[Script Info]',
    'ScriptType: v4.00+',
    `PlayResX: ${width}`,
    `PlayResY: ${height}`,
    'WrapStyle: 2',
    'ScaledBorderAndShadow: yes',
    '',
    '[V4+ Styles]',
    'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding',
    `Style: Default,${String(cfg.fontFamily||'Noto Sans').replace(/,/g,' ')},${fontSize},${primary},${primary},&H00000000,${back},${Number(cfg.fontWeight||700)>=700?-1:0},0,0,0,100,100,-2,0,${borderStyle},${outline},${shadow},2,60,60,${marginV},1`,
    '',
    '[Events]',
    'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text'
  ];

  const events=[];

  for(
    const caption of
    timeline?.captions||[]
  ){
    const words=
      Array.isArray(
        caption.words
      )
        ?caption.words.filter(
          w=>
            String(w.text||'')
              .trim()
        )
        :[];

    const captionEntrance=captionEntranceTag(cfg.entrance);

    if(
      cfg.activeWord&&
      words.length
    ){
      for(
        let i=0;
        i<words.length;
        i++
      ){
        const word=
          words[i];
        const next=
          words[i+1];

        const start=Math.max(
          Number(
            caption.startMs
          )||0,
          Number(
            word.startMs
          )||
          Number(
            caption.startMs
          )||
          0
        );

        const end=Math.max(
          start+60,
          Math.min(
            Number(
              caption.endMs
            )||
            start+500,
            next
              ?Math.max(
                Number(
                  word.endMs
                )||
                start+60,
                Number(
                  next.startMs
                )||
                start+60
              )
              :Number(
                caption.endMs
              )||
              Number(
                word.endMs
              )||
              start+300
          )
        );

        const text=
          words
            .map(
              (w,j)=>{
                const clean=
                  escapeAssText(
                    w.text
                  );

                return j===i
                  ?`{\\c${activeColor}\\fs${Math.round(fontSize*1.08)}}${clean}{\\c${primary}\\fs${fontSize}}`
                  :clean;
              }
            )
            .join(' ');

        events.push(
          dialogue(
            start,
            end,
            i===0?captionEntrance+text:text
          )
        );
      }
    }else{
      const text=
        escapeAssText(
          caption.text||
          words
            .map(w=>w.text)
            .join(' ')
        );

      events.push(
        dialogue(
          Number(
            caption.startMs
          )||0,
          Number(
            caption.endMs
          )||
          Number(
            caption.startMs||0
          )+
          500,
          captionEntrance+text
        )
      );
    }
  }

  return header
    .concat(events)
    .join('\n');
}

function dialogue(
  startMs,
  endMs,
  text
){
  return `Dialogue: 0,${assTime(startMs)},${assTime(endMs)},Default,,0,0,0,,${text}`;
}

function assTime(ms){
  const total=
    Math.max(
      0,
      Number(ms)||0
    )/1000;
  const h=
    Math.floor(
      total/3600
    );
  const m=
    Math.floor(
      (total%3600)/60
    );
  const s=
    Math.floor(
      total%60
    );
  const cs=
    Math.floor(
      (
        total-
        Math.floor(total)
      )*100
    );

  return `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}.${String(cs).padStart(2,'0')}`;
}

function escapeAssText(value){
  return String(value||'')
    .replace(/\\/g,'')
    .replace(/[{}]/g,'')
    .replace(/[\r\n]+/g,' ')
    .trim();
}

function assColor(hex){
  const m=
    String(hex||'')
      .match(
        /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i
      );

  if(!m){
    return '&H00FFFFFF';
  }

  return `&H00${m[3].toUpperCase()}${m[2].toUpperCase()}${m[1].toUpperCase()}`;
}

function assOverrideColor(hex){
  const m=
    String(hex||'')
      .match(
        /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i
      );

  if(!m){
    return '&HFFFFFF&';
  }

  return `&H${m[3].toUpperCase()}${m[2].toUpperCase()}${m[1].toUpperCase()}&`;
}

