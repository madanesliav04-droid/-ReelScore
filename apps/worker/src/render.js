import {copyFile,mkdir,rm,stat,writeFile} from 'node:fs/promises';
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
    .filter(r=>Number(r.endMs)-Number(r.startMs)>=100)
    .slice(0,80);

  if(!ranges.length)throw new Error('Aucun segment vidéo à conserver.');

  await onProgress(48,'Suppression des blancs et hésitations');

  const fullSpan=
    ranges.length===1&&
    Number(ranges[0].startMs||0)<=80&&
    Number(sourceDurationMs)>0&&
    Number(ranges[0].endMs||0)>=Number(sourceDurationMs)-150;

  if(fullSpan){
    await copyFile(inputPath,outputPath);
    await onProgress(54,'Vidéo déjà optimisée · copie directe');
    return;
  }

  const partsDir=outputPath+'.parts';
  await mkdir(partsDir,{recursive:true});
  const parts=[];

  try{
    for(let i=0;i<ranges.length;i++){
      const r=ranges[i];
      const start=Math.max(0,Number(r.startMs||0)/1000);
      const duration=Math.max(.1,(Number(r.endMs||0)-Number(r.startMs||0))/1000);
      const part=partsDir+'/part-'+String(i).padStart(3,'0')+'.mp4';
      const args=[
        '-hide_banner','-loglevel','error','-y',
        '-ss',start.toFixed(3),
        '-t',duration.toFixed(3),
        '-i',inputPath,
        '-map','0:v:0'
      ];
      if(hasAudio)args.push('-map','0:a:0?');
      args.push(
        '-c:v','libx264',
        '-preset','ultrafast',
        '-crf','20',
        '-pix_fmt','yuv420p',
        '-threads','1',
        ...(hasAudio?['-c:a','aac','-b:a','160k']:['-an']),
        '-movflags','+faststart',
        part
      );
      await run('ffmpeg',args);
      parts.push(part);
      await onProgress(
        48+Math.round(((i+1)/ranges.length)*6),
        'Découpe intelligente'
      );
    }

    const listPath=partsDir+'/concat.txt';
    await writeFile(
      listPath,
      parts.map(p=>"file '"+escapeConcatPath(p)+"'").join('\n'),
      'utf8'
    );

    await run('ffmpeg',[
      '-hide_banner','-loglevel','error','-y',
      '-f','concat','-safe','0','-i',listPath,
      '-c','copy','-movflags','+faststart',
      outputPath
    ]);
  }finally{
    await rm(partsDir,{recursive:true,force:true}).catch(()=>{});
  }
}

export async function renderNativeEdit({
  sourcePath,
  outputPath,
  durationMs,
  timeline,
  onProgress=async()=>{}
}){
  await onProgress(58,'Préparation du rendu Edit+');

  const width=Math.max(2,Number(timeline?.export?.width||timeline?.width||1080));
  const height=Math.max(2,Number(timeline?.export?.height||timeline?.height||1920));
  const totalMs=Math.max(1,Number(durationMs||timeline?.outputDurationMs||1000));
  const hasAudio=Boolean(timeline?.audio!==false);
  const punchIns=normalizePunchIns(timeline?.punchIns,totalMs);
  const segments=buildVisualSegments(totalMs,punchIns);
  const workDir=outputPath+'.native';
  await mkdir(workDir,{recursive:true});

  let visualSource=sourcePath;

  try{
    if(segments.some(s=>s.scale>1.001)){
      const parts=[];
      for(let i=0;i<segments.length;i++){
        const seg=segments[i];
        const part=workDir+'/visual-'+String(i).padStart(3,'0')+'.mp4';
        const duration=(seg.endMs-seg.startMs)/1000;
        const filter=visualFilter(width,height,seg.scale);

        const args=[
          '-hide_banner','-loglevel','error','-y',
          '-ss',(seg.startMs/1000).toFixed(3),
          '-t',duration.toFixed(3),
          '-i',sourcePath,
          '-map','0:v:0',
          '-vf',filter,
          '-c:v','libx264',
          '-preset','ultrafast',
          '-crf','19',
          '-pix_fmt','yuv420p',
          '-threads','1'
        ];

        if(hasAudio){
          args.push('-map','0:a:0?','-c:a','aac','-b:a','160k');
        }else{
          args.push('-an');
        }

        args.push('-movflags','+faststart',part);
        await run('ffmpeg',args);
        parts.push(part);

        await onProgress(
          60+Math.round(((i+1)/segments.length)*14),
          'Punch-ins et cadrage'
        );
      }

      const listPath=workDir+'/visual-concat.txt';
      await writeFile(
        listPath,
        parts.map(p=>"file '"+escapeConcatPath(p)+"'").join('\n'),
        'utf8'
      );

      visualSource=workDir+'/visual-concat.mp4';
      await run('ffmpeg',[
        '-hide_banner','-loglevel','error','-y',
        '-f','concat','-safe','0','-i',listPath,
        '-c','copy','-movflags','+faststart',
        visualSource
      ]);
    }

    const assPath=workDir+'/captions.ass';
    const hasCaptions=Array.isArray(timeline?.captions)&&timeline.captions.length>0;

    if(hasCaptions){
      await writeFile(
        assPath,
        buildAss(timeline,width,height),
        'utf8'
      );
    }

    await onProgress(78,'Sous-titres et finition');

    const args=[
      '-hide_banner','-loglevel','error','-y',
      '-i',visualSource
    ];

    if(hasCaptions){
      args.push('-vf',`ass=${escapeFilterPath(assPath)}`);
    }

    if(hasAudio){
      args.push('-af','loudnorm=I=-14:TP=-1:LRA=11');
    }

    args.push(
      '-c:v','libx264',
      '-preset','ultrafast',
      '-crf','19',
      '-pix_fmt','yuv420p',
      '-threads','1',
      ...(hasAudio?['-c:a','aac','-b:a','192k']:['-an']),
      '-movflags','+faststart',
      outputPath
    );

    await run('ffmpeg',args);
    await onProgress(92,'Rendu Edit+ terminé');
  }finally{
    await rm(workDir,{recursive:true,force:true}).catch(()=>{});
  }
}

export async function finalEncode({
  inputPath,
  outputPath,
  onProgress=async()=>{}
}){
  await onProgress(94,'Encodage final');
  await copyFile(inputPath,outputPath);
}

function normalizePunchIns(items,durationMs){
  return (Array.isArray(items)?items:[])
    .map(x=>({
      startMs:Math.max(0,Math.min(durationMs,Number(x.startMs)||0)),
      endMs:Math.max(0,Math.min(durationMs,Number(x.endMs)||0)),
      scale:Math.max(1,Math.min(1.2,Number(x.scale)||1.08))
    }))
    .filter(x=>x.endMs-x.startMs>=120)
    .sort((a,b)=>a.startMs-b.startMs);
}

function buildVisualSegments(durationMs,punchIns){
  const points=new Set([0,durationMs]);
  for(const p of punchIns){
    points.add(Math.round(p.startMs));
    points.add(Math.round(p.endMs));
  }

  const ordered=[...points]
    .filter(x=>Number.isFinite(x)&&x>=0&&x<=durationMs)
    .sort((a,b)=>a-b);

  const out=[];
  for(let i=0;i<ordered.length-1;i++){
    const startMs=ordered[i],endMs=ordered[i+1];
    if(endMs-startMs<40)continue;
    const mid=(startMs+endMs)/2;
    const active=punchIns
      .filter(p=>mid>=p.startMs&&mid<p.endMs)
      .sort((a,b)=>b.scale-a.scale)[0];
    out.push({startMs,endMs,scale:active?.scale||1});
  }

  return mergeSameScale(out);
}

function mergeSameScale(items){
  const out=[];
  for(const item of items){
    const last=out[out.length-1];
    if(last&&Math.abs(last.scale-item.scale)<.001&&Math.abs(last.endMs-item.startMs)<=2){
      last.endMs=item.endMs;
    }else{
      out.push({...item});
    }
  }
  return out;
}

function visualFilter(width,height,scale){
  const factor=Math.max(1,Number(scale)||1);
  const w=Math.ceil(width*factor/2)*2;
  const h=Math.ceil(height*factor/2)*2;
  const yFactor=.44;
  return [
    `scale=${w}:${h}:force_original_aspect_ratio=increase:flags=lanczos`,
    `crop=${width}:${height}:(iw-${width})/2:(ih-${height})*${yFactor}`,
    'setsar=1'
  ].join(',');
}

function buildAss(timeline,width,height){
  const cfg=timeline?.captionConfig||{};
  const fontSize=Math.max(24,Math.min(110,Number(cfg.fontSize)||68));
  const outline=Math.max(0,Math.min(10,Number(cfg.stroke)||4));
  const marginV={
    lower_middle:280,
    lower_third:220,
    middle_low:380
  }[cfg.position]||280;

  const activeColor=assOverrideColor(cfg.activeColor||'#ff6a00');
  const primary=assColor(cfg.textColor||'#ffffff');
  const back=cfg.background?'&H66000000':'&HFF000000';
  const borderStyle=cfg.background?3:1;
  const shadow=cfg.shadow?2:0;

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
    `Style: Default,Liberation Sans,${fontSize},${primary},${primary},&H00000000,${back},-1,0,0,0,100,100,-2,0,${borderStyle},${outline},${shadow},2,60,60,${marginV},1`,
    '',
    '[Events]',
    'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text'
  ];

  const events=[];

  for(const caption of timeline?.captions||[]){
    const words=Array.isArray(caption.words)?caption.words.filter(w=>String(w.text||'').trim()):[];

    if(cfg.activeWord&&words.length){
      for(let i=0;i<words.length;i++){
        const word=words[i];
        const next=words[i+1];
        const start=Math.max(
          Number(caption.startMs)||0,
          Number(word.startMs)||Number(caption.startMs)||0
        );
        const end=Math.max(
          start+60,
          Math.min(
            Number(caption.endMs)||start+500,
            next
              ?Math.max(Number(word.endMs)||start+60,Number(next.startMs)||start+60)
              :Number(caption.endMs)||Number(word.endMs)||start+300
          )
        );

        const text=words.map((w,j)=>{
          const clean=escapeAssText(w.text);
          return j===i
            ?`{\\c${activeColor}}${clean}{\\c${primary}}`
            :clean;
        }).join(' ');

        events.push(dialogue(start,end,text));
      }
    }else{
      const text=escapeAssText(caption.text||words.map(w=>w.text).join(' '));
      events.push(dialogue(
        Number(caption.startMs)||0,
        Number(caption.endMs)||Number(caption.startMs||0)+500,
        text
      ));
    }
  }

  return header.concat(events).join('\n');
}

function dialogue(startMs,endMs,text){
  return `Dialogue: 0,${assTime(startMs)},${assTime(endMs)},Default,,0,0,0,,${text}`;
}

function assTime(ms){
  const total=Math.max(0,Number(ms)||0)/1000;
  const h=Math.floor(total/3600);
  const m=Math.floor((total%3600)/60);
  const s=Math.floor(total%60);
  const cs=Math.floor((total-Math.floor(total))*100);
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
  const m=String(hex||'').match(/^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
  if(!m)return '&H00FFFFFF';
  return `&H00${m[3].toUpperCase()}${m[2].toUpperCase()}${m[1].toUpperCase()}`;
}

function assOverrideColor(hex){
  const m=String(hex||'').match(/^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
  if(!m)return '&HFFFFFF&';
  return `&H${m[3].toUpperCase()}${m[2].toUpperCase()}${m[1].toUpperCase()}&`;
}

function escapeFilterPath(value){
  return String(value).replace(/\\/g,'/').replace(/:/g,'\\:').replace(/'/g,"\\'");
}

function escapeConcatPath(value){
  return String(value).replace(/'/g,"'\\''");
}

function run(cmd,args){
  return new Promise((resolve,reject)=>{
    const p=spawn(cmd,args);
    let err='';
    p.stderr.on('data',d=>err+=d);
    p.on('error',reject);
    p.on('close',(code,signal)=>{
      if(code===0)return resolve();
      reject(new Error(
        `${cmd} exited ${code??'null'}${signal?` (signal ${signal})`:''}: ${err.slice(-4000)}`
      ));
    });
  });
}

export async function fileSize(filePath){
  return (await stat(filePath)).size;
}
