import {
  copyFile,
  mkdir,
  rm,
  stat,
  writeFile
} from 'node:fs/promises';
import {spawn} from 'node:child_process';

export async function preprocessVideo({
  inputPath,
  outputPath,
  keepRanges,
  sourceDurationMs=null,
  hasAudio=true,
  onProgress=async()=>{}
}){
  const ranges=(keepRanges||[])
    .filter(
      r=>
        Number(r.endMs)-
        Number(r.startMs)>=100
    )
    .slice(0,80);

  if(!ranges.length){
    throw new Error(
      'Aucun segment vidéo à conserver.'
    );
  }

  await onProgress(
    48,
    'Suppression des blancs et hésitations'
  );

  const fullSpan=
    ranges.length===1&&
    Number(ranges[0].startMs||0)<=80&&
    Number(sourceDurationMs)>0&&
    Number(ranges[0].endMs||0)>=
      Number(sourceDurationMs)-150;

  if(fullSpan){
    await copyFile(
      inputPath,
      outputPath
    );
    await onProgress(
      54,
      'Vidéo déjà optimisée · copie directe'
    );
    return;
  }

  const partsDir=outputPath+'.parts';
  await mkdir(partsDir,{recursive:true});
  const parts=[];

  try{
    for(
      let i=0;
      i<ranges.length;
      i++
    ){
      const r=ranges[i];
      const start=Math.max(
        0,
        Number(r.startMs||0)/1000
      );
      const duration=Math.max(
        .1,
        (
          Number(r.endMs||0)-
          Number(r.startMs||0)
        )/1000
      );
      const part=
        partsDir+
        '/part-'+
        String(i).padStart(3,'0')+
        '.mp4';

      const args=[
        '-hide_banner',
        '-loglevel','error',
        '-y',
        '-ss',start.toFixed(3),
        '-t',duration.toFixed(3),
        '-i',inputPath,
        '-map','0:v:0'
      ];

      if(hasAudio){
        args.push('-map','0:a:0?');
      }

      args.push(
        '-c:v','libx264',
        '-preset','veryfast',
        '-crf','17',
        '-pix_fmt','yuv420p',
        '-threads','1',
        ...(hasAudio
          ?[
            '-c:a','aac',
            '-b:a','160k'
          ]
          :['-an']),
        '-movflags','+faststart',
        part
      );

      await run('ffmpeg',args);
      parts.push(part);

      await onProgress(
        48+
        Math.round(
          ((i+1)/ranges.length)*6
        ),
        'Découpe intelligente'
      );
    }

    const listPath=
      partsDir+'/concat.txt';

    await writeFile(
      listPath,
      parts
        .map(
          p=>
            "file '"+
            escapeConcatPath(p)+
            "'"
        )
        .join('\n'),
      'utf8'
    );

    await run(
      'ffmpeg',
      [
        '-hide_banner',
        '-loglevel','error',
        '-y',
        '-f','concat',
        '-safe','0',
        '-i',listPath,
        '-c','copy',
        '-movflags','+faststart',
        outputPath
      ]
    );
  }finally{
    await rm(
      partsDir,
      {
        recursive:true,
        force:true
      }
    ).catch(()=>{});
  }
}

export async function renderNativeEdit({
  sourcePath,
  outputPath,
  durationMs,
  timeline,
  onProgress=async()=>{}
}){
  await onProgress(
    58,
    'Préparation du rendu Edit+'
  );

  const width=Math.max(
    2,
    Number(
      timeline?.export?.width||
      timeline?.width||
      1080
    )
  );
  const height=Math.max(
    2,
    Number(
      timeline?.export?.height||
      timeline?.height||
      1920
    )
  );
  const totalMs=Math.max(
    1,
    Number(
      durationMs||
      timeline?.outputDurationMs||
      1000
    )
  );
  const hasAudio=Boolean(
    timeline?.audio?.hasAudio
  );
  const sourceAspect=
    Number(timeline?.sourceAspect)||
    (width/height);

  const punchIns=normalizePunchIns(
    timeline?.punchIns,
    totalMs
  );
  const brollCues=
    normalizeBrollCues(
      timeline?.brollCues,
      totalMs
    );

  const workDir=
    outputPath+'.native';

  await mkdir(
    workDir,
    {recursive:true}
  );

  try{
    const localBroll=
      await materializeBroll(
        brollCues,
        workDir
      );

    const segments=
      buildVisualSegments(
        totalMs,
        punchIns,
        localBroll
      );

    const parts=[];

    for(
      let i=0;
      i<segments.length;
      i++
    ){
      const seg=segments[i];
      const part=
        workDir+
        '/visual-'+
        String(i).padStart(3,'0')+
        '.mp4';

      if(seg.broll?.localPath){
        await renderBrollSegment({
          sourcePath,
          imagePath:
            seg.broll.localPath,
          outputPath:part,
          startMs:seg.startMs,
          endMs:seg.endMs,
          width,
          height,
          hasAudio,
          mode:String(timeline?.modelId||timeline?.style||'clean')
        });
      }else{
        await renderSourceSegment({
          sourcePath,
          outputPath:part,
          startMs:seg.startMs,
          endMs:seg.endMs,
          width,
          height,
          scale:seg.scale,
          hasAudio,
          sourceAspect
        });
      }

      parts.push(part);

      await onProgress(
        60+
        Math.round(
          ((i+1)/
          Math.max(1,segments.length))*
          16
        ),
        seg.broll
          ?'B-roll contextuel'
          :'Cadrage et punch-ins'
      );
    }

    const listPath=
      workDir+
      '/visual-concat.txt';

    await writeFile(
      listPath,
      parts
        .map(
          p=>
            "file '"+
            escapeConcatPath(p)+
            "'"
        )
        .join('\n'),
      'utf8'
    );

    const visualSource=
      workDir+
      '/visual-concat.mp4';

    await run(
      'ffmpeg',
      [
        '-hide_banner',
        '-loglevel','error',
        '-y',
        '-f','concat',
        '-safe','0',
        '-i',listPath,
        '-c','copy',
        '-movflags','+faststart',
        visualSource
      ]
    );

    const assPath=
      workDir+
      '/captions.ass';
    const graphicsAssPath=
      workDir+
      '/graphics.ass';

    const hasCaptions=
      Array.isArray(
        timeline?.captions
      )&&
      timeline.captions.length>0;

    if(hasCaptions){
      await writeFile(
        assPath,
        buildAss(
          timeline,
          width,
          height
        ),
        'utf8'
      );
    }

    const hasGraphics=Array.isArray(timeline?.graphicCues)&&timeline.graphicCues.length>0;
    if(hasGraphics){
      await writeFile(
        graphicsAssPath,
        buildGraphicsAss(timeline,width,height),
        'utf8'
      );
    }

    await onProgress(
      78,
      'Sous-titres et finition'
    );

    const args=[
      '-hide_banner',
      '-loglevel','error',
      '-y',
      '-i',visualSource
    ];

    const finishingFilters=
      modelFinishingFilters(
        timeline,
        width,
        height
      );

    if(hasGraphics){
      finishingFilters.push(
        `ass=${escapeFilterPath(graphicsAssPath)}`
      );
    }
    if(hasCaptions){
      finishingFilters.push(
        `ass=${escapeFilterPath(assPath)}`
      );
    }

    if(finishingFilters.length){
      args.push(
        '-vf',
        finishingFilters.join(',')
      );
    }

    if(hasAudio){
      args.push(
        '-af',
        audioFinishingFilter(timeline)
      );
    }

    args.push(
      '-c:v','libx264',
      '-preset','veryfast',
      '-crf','17',
      '-pix_fmt','yuv420p',
      '-threads','1',
      ...(hasAudio
        ?[
          '-c:a','aac',
          '-b:a','192k'
        ]
        :['-an']),
      '-movflags','+faststart',
      outputPath
    );

    await run('ffmpeg',args);

    await onProgress(
      92,
      'Rendu Edit+ terminé'
    );
  }finally{
    await rm(
      workDir,
      {
        recursive:true,
        force:true
      }
    ).catch(()=>{});
  }
}

async function renderSourceSegment({
  sourcePath,
  outputPath,
  startMs,
  endMs,
  width,
  height,
  scale=1,
  hasAudio,
  sourceAspect=null
}){
  const startSec=
    Math.max(0,startMs/1000);
  const duration=
    Math.max(.05,(endMs-startMs)/1000);

  const args=[
    '-hide_banner',
    '-loglevel','error',
    '-y',
    '-ss',startSec.toFixed(3),
    '-t',duration.toFixed(3),
    '-i',sourcePath,
    '-map','0:v:0'
  ];

  if(hasAudio){
    args.push('-map','0:a:0?');
  }

  args.push(
    '-vf',
    sourceDisplayFilter(
      width,
      height,
      scale,
      sourceAspect
    ),
    '-r','30',
    '-c:v','libx264',
    '-preset','veryfast',
    '-crf','17',
    '-pix_fmt','yuv420p',
    '-threads','1',
    ...(hasAudio
      ?[
        '-c:a','aac',
        '-b:a','160k'
      ]
      :['-an']),
    '-movflags','+faststart',
    outputPath
  );

  await run('ffmpeg',args);
}

async function renderBrollSegment({
  sourcePath,
  imagePath,
  outputPath,
  startMs,
  endMs,
  width,
  height,
  hasAudio,
  mode='clean'
}){
  const startSec=
    Math.max(0,startMs/1000);
  const duration=
    Math.max(.05,(endMs-startMs)/1000);

  const args=[
    '-hide_banner',
    '-loglevel','error',
    '-y',
    '-loop','1',
    '-framerate','30',
    '-i',imagePath,
    '-ss',startSec.toFixed(3),
    '-i',sourcePath,
    '-map','0:v:0'
  ];

  if(hasAudio){
    args.push('-map','1:a:0?');
  }

  args.push(
    '-t',duration.toFixed(3),
    '-vf',
    brollMotionFilter(
      width,
      height,
      duration,
      mode
    ),
    '-r','30',
    '-c:v','libx264',
    '-preset','veryfast',
    '-crf','16',
    '-pix_fmt','yuv420p',
    '-threads','1',
    ...(hasAudio
      ?[
        '-c:a','aac',
        '-b:a','160k'
      ]
      :['-an']),
    '-movflags','+faststart',
    outputPath
  );

  await run('ffmpeg',args);
}

async function materializeBroll(
  cues,
  workDir
){
  const out=[];

  for(
    let i=0;
    i<cues.length;
    i++
  ){
    const cue=cues[i];
    try{
      const u=
        new URL(cue.assetUrl);

      if(u.protocol!=='https:')continue;
      const allowedHosts=new Set([
        'upload.wikimedia.org',
        'api.openverse.org'
      ]);
      if(!allowedHosts.has(u.hostname))continue;

      const r=await fetch(
        u.toString(),
        {
          headers:{
            'User-Agent':
              'ViralStudio-EditPlus/1.0'
          }
        }
      );

      if(!r.ok)continue;

      const length=Number(
        r.headers.get(
          'content-length'
        )||0
      );
      if(length>20*1024*1024){
        continue;
      }

      const bytes=
        Buffer.from(
          await r.arrayBuffer()
        );

      if(
        bytes.length<1000||
        bytes.length>
          20*1024*1024
      )continue;

      const ext=
        cue.mimeType===
          'image/png'
          ?'.png'
          :cue.mimeType===
            'image/webp'
            ?'.webp'
            :'.jpg';

      const localPath=
        workDir+
        '/broll-'+
        i+
        ext;

      await writeFile(
        localPath,
        bytes
      );

      out.push({
        ...cue,
        localPath
      });
    }catch{}
  }

  return out;
}

function normalizePunchIns(
  items,
  durationMs
){
  return (
    Array.isArray(items)
      ?items
      :[]
  )
    .map(x=>({
      startMs:Math.max(
        0,
        Math.min(
          durationMs,
          Number(x.startMs)||0
        )
      ),
      endMs:Math.max(
        0,
        Math.min(
          durationMs,
          Number(x.endMs)||0
        )
      ),
      scale:Math.max(
        1,
        Math.min(
          1.2,
          Number(x.scale)||1.08
        )
      )
    }))
    .filter(
      x=>
        x.endMs-
        x.startMs>=120
    )
    .sort(
      (a,b)=>
        a.startMs-b.startMs
    );
}

function normalizeBrollCues(
  items,
  durationMs
){
  return (
    Array.isArray(items)
      ?items
      :[]
  )
    .map((x,index)=>({
      ...x,
      id:
        x.id||
        `broll-${index}`,
      startMs:Math.max(
        0,
        Math.min(
          durationMs,
          Number(x.startMs)||0
        )
      ),
      endMs:Math.max(
        0,
        Math.min(
          durationMs,
          Number(x.endMs)||0
        )
      )
    }))
    .filter(
      x=>
        x.assetUrl&&
        x.endMs-
        x.startMs>=500
    )
    .sort(
      (a,b)=>
        a.startMs-b.startMs
    );
}

function buildVisualSegments(
  durationMs,
  punchIns,
  brollCues
){
  const points=
    new Set([0,durationMs]);

  for(const p of punchIns){
    points.add(
      Math.round(p.startMs)
    );
    points.add(
      Math.round(p.endMs)
    );
  }

  for(const b of brollCues){
    points.add(
      Math.round(b.startMs)
    );
    points.add(
      Math.round(b.endMs)
    );
  }

  const ordered=[
    ...points
  ]
    .filter(
      x=>
        Number.isFinite(x)&&
        x>=0&&
        x<=durationMs
    )
    .sort((a,b)=>a-b);

  const out=[];

  for(
    let i=0;
    i<ordered.length-1;
    i++
  ){
    const startMs=ordered[i];
    const endMs=ordered[i+1];

    if(
      endMs-startMs<40
    )continue;

    const mid=
      (startMs+endMs)/2;

    const activePunch=
      punchIns
        .filter(
          p=>
            mid>=p.startMs&&
            mid<p.endMs
        )
        .sort(
          (a,b)=>
            b.scale-a.scale
        )[0];

    const activeBroll=
      brollCues.find(
        b=>
          mid>=b.startMs&&
          mid<b.endMs
      )||
      null;

    out.push({
      startMs,
      endMs,
      scale:
        activePunch?.scale||
        1,
      broll:activeBroll
    });
  }

  return mergeSameVisual(out);
}

function mergeSameVisual(items){
  const out=[];

  for(const item of items){
    const last=
      out[out.length-1];

    const sameBroll=
      (
        last?.broll?.assetUrl||
        null
      )===
      (
        item.broll?.assetUrl||
        null
      );

    if(
      last&&
      sameBroll&&
      Math.abs(
        last.scale-
        item.scale
      )<.001&&
      Math.abs(
        last.endMs-
        item.startMs
      )<=2
    ){
      last.endMs=
        item.endMs;
    }else{
      out.push({...item});
    }
  }

  return out;
}

function sourceDisplayFilter(
  width,
  height,
  scale=1,
  sourceAspect=null
){
  const targetAspect=width/height;
  const srcAspect=Number(sourceAspect)||targetAspect;
  const mismatch=Math.max(
    targetAspect/srcAspect,
    srcAspect/targetAspect
  );

  if(mismatch<1.28){
    return coverFilter(width,height,scale);
  }

  const foregroundW=
    srcAspect>=targetAspect
      ?width
      :Math.max(2,Math.round(height*srcAspect/2)*2);
  const foregroundH=
    srcAspect>=targetAspect
      ?Math.max(2,Math.round(width/srcAspect/2)*2)
      :height;

  const zoom=Math.max(1,Number(scale)||1);
  const fgW=Math.min(width,Math.max(2,Math.round(foregroundW*zoom/2)*2));
  const fgH=Math.min(height,Math.max(2,Math.round(foregroundH*zoom/2)*2));

  return [
    'split=2[bg][fg]',
    `[bg]scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height},boxblur=28:8,eq=brightness=-0.12:saturation=0.72[bg2]`,
    `[fg]scale=${fgW}:${fgH}:force_original_aspect_ratio=decrease[fg2]`,
    '[bg2][fg2]overlay=(W-w)/2:(H-h)/2,setsar=1'
  ].join(';');
}

function coverFilter(
  width,
  height,
  scale=1
){
  const factor=
    Math.max(
      1,
      Number(scale)||1
    );

  const targetW=
    Math.ceil(
      width*factor/2
    )*2;
  const targetH=
    Math.ceil(
      height*factor/2
    )*2;

  return [
    `scale=${targetW}:${targetH}:force_original_aspect_ratio=increase:flags=lanczos`,
    `crop=${width}:${height}:(iw-${width})/2:(ih-${height})*.44`,
    'setsar=1'
  ].join(',');
}

function modelFinishingFilters(
  timeline,
  width,
  height
){
  const mode=String(
    timeline?.styleConfig?.visualSignature?.mode||
    timeline?.modelId||
    timeline?.style||
    'clean'
  );

  const filters=['unsharp=5:5:0.22:5:5:0'];

  if(mode==='codie'){
    filters.push('eq=contrast=1.025:saturation=1.0:brightness=0.002');
  }else if(mode==='impact'){
    filters.push('eq=contrast=1.09:saturation=1.10:brightness=0.008');
  }else if(mode==='clean'){
    filters.push('eq=contrast=1.02:saturation=0.99:brightness=0.003');
  }else if(mode==='authority'){
    filters.push('eq=contrast=1.045:saturation=0.92:brightness=-0.004');
    filters.push('vignette=PI/7');
  }else if(mode==='explainer'){
    filters.push('eq=contrast=1.035:saturation=1.02:brightness=0.004');
  }else if(mode==='editorial_breakdown'){
    filters.push('eq=contrast=1.035:saturation=0.87:brightness=0.002');
  }else if(mode==='data'){
    filters.push('eq=contrast=1.06:saturation=0.97:brightness=0.002');
  }else if(mode==='ugc_native'){
    filters.push('eq=contrast=1.025:saturation=1.06:brightness=0.006');
  }else if(mode==='cinematic_story'){
    filters.push('eq=contrast=1.075:saturation=0.82:brightness=-0.01');
    filters.push('vignette=PI/5');
  }

  return filters;
}

function audioFinishingFilter(timeline){
  const mode=String(timeline?.styleConfig?.soundDesign||'light');
  const common='highpass=f=70,lowpass=f=15500';

  if(mode==='minimal'){
    return common+',acompressor=threshold=-20dB:ratio=1.6:attack=18:release=160,loudnorm=I=-14:TP=-1:LRA=9';
  }
  if(mode==='moderate'){
    return common+',acompressor=threshold=-18dB:ratio=2.5:attack=12:release=120,equalizer=f=3200:t=q:w=1.2:g=1.2,loudnorm=I=-13.5:TP=-1:LRA=8';
  }
  if(mode==='cinematic'){
    return common+',acompressor=threshold=-21dB:ratio=1.8:attack=25:release=220,equalizer=f=180:t=q:w=1:g=0.8,loudnorm=I=-14.5:TP=-1:LRA=10';
  }
  return common+',acompressor=threshold=-19dB:ratio=2:attack=15:release=140,loudnorm=I=-14:TP=-1:LRA=9';
}

function brollMotionFilter(width,height,duration,mode='clean'){
  const zoomStep={
    impact:0.0010,
    explainer:0.00065,
    data:0.00055,
    cinematic_story:0.00032,
    authority:0.00038,
    ugc_native:0.00070,
    codie:0.00042,
    clean:0.00038
  }[mode]||0.0004;
  const maxZoom={
    impact:1.075,
    explainer:1.055,
    data:1.05,
    cinematic_story:1.04,
    authority:1.04,
    ugc_native:1.06,
    codie:1.045,
    clean:1.04
  }[mode]||1.045;

  return [
    `scale=${Math.ceil(width*1.12/2)*2}:${Math.ceil(height*1.12/2)*2}:force_original_aspect_ratio=increase:flags=lanczos`,
    `crop=${width}:${height}:(iw-${width})/2:(ih-${height})/2`,
    `zoompan=z='min(zoom+${zoomStep.toFixed(5)},${maxZoom})':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=${width}x${height}:fps=30`,
    'setsar=1'
  ].join(',');
}

export async function finalEncode({
  inputPath,
  outputPath,
  onProgress=async()=>{}
}){
  await onProgress(
    94,
    'Encodage final'
  );
  await copyFile(
    inputPath,
    outputPath
  );
}


function buildGraphicsAss(timeline,width,height){
  if(String(timeline?.modelId||timeline?.style)==='editorial_breakdown')return buildEditorialGraphicsAss(timeline,width,height);
  const mode=String(timeline?.modelId||timeline?.style||'clean');
  const accent={
    impact:'&H00FFE637',
    explainer:'&H00FFE87C',
    data:'&H0066D1FF',
    ugc_native:'&H00BF3FFF',
    authority:'&H00459BFF',
    cinematic_story:'&H00FFFFFF'
  }[mode]||'&H00FFFFFF';
  const size={
    impact:72,
    explainer:54,
    data:82,
    ugc_native:58,
    authority:48,
    cinematic_story:52
  }[mode]||58;
  const align=mode==='ugc_native'?8:mode==='explainer'?7:mode==='data'?8:8;
  const marginV=mode==='ugc_native'?120:mode==='explainer'?180:110;
  const back=mode==='explainer'?'&H55000000':mode==='ugc_native'?'&H44000000':'&H77000000';
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
    `Style: Graphic,Noto Sans,${size},${accent},${accent},&H00101010,${back},-1,0,0,0,100,100,0,0,3,3,1,${align},70,70,${marginV},1`,
    '',
    '[Events]',
    'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text'
  ];
  const events=(timeline?.graphicCues||[]).map((g,index)=>{
    let prefix='';
    if(mode==='explainer')prefix=`STEP ${String(index+1).padStart(2,'0')}  ·  `;
    if(mode==='data')prefix=`${String(g.label||'CLAIM')}  ·  `;
    if(mode==='ugc_native')prefix='✦  ';
    if(mode==='authority')prefix='EXPERT TAKE  ·  ';
    if(mode==='cinematic_story')prefix='“ ';
    const suffix=mode==='cinematic_story'?' ”':'';
    const text=escapeAssText(prefix+String(g.text||'')+suffix);
    return `Dialogue: 1,${assTime(g.startMs)},${assTime(g.endMs)},Graphic,,0,0,0,,${text}`;
  });
  return header.concat(events).join('\n');
}

// Dedicated typography/diagram renderer for the Editorial Breakdown model.
 // All numbers come from the timeline's transcript-evidenced graphic cues.
export function buildEditorialGraphicsAss(timeline,width,height){
  const fontsize=Math.max(24,Math.round(73*Math.min(1,height/1920)));
  const x=Math.round(width*.5),y=Math.round(height*.198);
  const header=[
    '[Script Info]','ScriptType: v4.00+',`PlayResX: ${width}`,`PlayResY: ${height}`,
    'WrapStyle: 2','ScaledBorderAndShadow: yes','',
    '[V4+ Styles]',
    'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding',
    `Style: Editorial,Noto Serif,${fontsize},&H00E9F2F7,&H00E9F2F7,&H44111111,&HFF000000,0,0,0,0,100,100,-1,0,1,1,1,8,64,64,150,1`,
    'Style: Panel,Noto Serif,20,&H00E9F2F7,&H00E9F2F7,&H00FFFFFF,&HFF000000,0,0,0,0,100,100,0,0,1,0,0,7,0,0,0,1',
    '',
    '[Events]','Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text'
  ];
  const ev=[];
  const drawRect=(left,top,right,bottom)=>
    `{\\an7\\pos(0,0)\\p1\\bord0\\shad0\\1c&H1A1512&\\1a&HA7&}m ${left} ${top} l ${right} ${top} ${right} ${bottom} ${left} ${bottom}{\\p0}`;
  const drawLine=(left,top,right,bottom)=>
    `{\\an7\\pos(0,0)\\p1\\bord0\\shad0\\1c&HE8E5E1&\\1a&H9A&}m ${left} ${top} l ${right} ${top} ${right} ${bottom} ${left} ${bottom}{\\p0}`;
  for(const cue of timeline?.graphicCues||[]){
    if(cue.mode!=='editorial_breakdown'||cue.evidence!=='timestamped_transcript')continue;
    const start=assTime(cue.startMs),end=assTime(cue.endMs);
    const figures=(Array.isArray(cue.figures)?cue.figures:[]).map(v=>String(v||'').trim()).filter(Boolean);
    if(!figures.length)continue;
    const size=figures.some(v=>v.length>11)?Math.round(fontsize*.66):fontsize;
    const animation=`{\\fad(190,260)\\fscx105\\fscy105\\t(0,380,\\fscx100\\fscy100)\\fs${size}}`;
    if(figures.length===1){
      const text=escapeAssText(figures[0].slice(0,30));
      ev.push(`Dialogue: 2,${start},${end},Editorial,,0,0,0,,{\\an8\\pos(${x},${y})}${animation}${text}`);
      continue;
    }
    const top=Math.round(height*.15),bottom=Math.round(height*.264);
    const left=Math.round(width*.10),right=Math.round(width*.90);
    const middle=Math.round(width*.5);
    const panel=drawRect(left,top,right,bottom);
    ev.push(`Dialogue: 0,${start},${end},Panel,,0,0,0,,{\\fad(180,280)}${panel}`);
    // A fine grid like the reference is only displayed when at least
    // two independent figures are genuinely present in the speech.
    ev.push(`Dialogue: 1,${start},${end},Panel,,0,0,0,,{\\fad(180,280)}${drawLine(middle,top,middle+2,bottom)}`);
    const isWide=figures.length>2;
    const leftValue=escapeAssText(figures[0].slice(0,22));
    const rightValue=escapeAssText((isWide?figures.slice(1).join(' · '):figures[1]).slice(0,24));
    ev.push(`Dialogue: 2,${start},${end},Editorial,,0,0,0,,{\\an8\\pos(${Math.round(width*.30)},${y})}${animation}${leftValue}`);
    ev.push(`Dialogue: 2,${start},${end},Editorial,,0,0,0,,{\\an8\\pos(${Math.round(width*.70)},${y})}${animation}${rightValue}`);
  }
  return header.concat(ev).join('\n');
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

  const marginV=
    Math.max(
      70,
      Math.round(
        baseMargin*
        sizeScale
      )
    );

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
            text
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
          text
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

function escapeFilterPath(value){
  return String(value)
    .replace(/\\/g,'/')
    .replace(/:/g,'\\:')
    .replace(/'/g,"\\'");
}

function escapeConcatPath(value){
  return String(value)
    .replace(
      /'/g,
      "'\\''"
    );
}

function run(cmd,args){
  return new Promise(
    (resolve,reject)=>{
      const p=
        spawn(
          cmd,
          args
        );
      let err='';

      p.stderr.on(
        'data',
        d=>err+=d
      );
      p.on(
        'error',
        reject
      );
      p.on(
        'close',
        (code,signal)=>{
          if(code===0){
            return resolve();
          }

          reject(
            new Error(
              `${cmd} exited ${code??'null'}${signal?` (signal ${signal})`:''}: ${err.slice(-4000)}`
            )
          );
        }
      );
    }
  );
}

export async function fileSize(
  filePath
){
  return (
    await stat(filePath)
  ).size;
}
