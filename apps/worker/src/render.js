import {createReadStream,createWriteStream} from 'node:fs';
import {stat,copyFile} from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
import {bundle} from '@remotion/bundler';
import {renderMedia,selectComposition} from '@remotion/renderer';

const here=path.dirname(fileURLToPath(import.meta.url));
const entryPoint=path.resolve(here,'../remotion/index.jsx');
let bundlePromise=null;

export async function preprocessVideo({inputPath,outputPath,keepRanges,sourceDurationMs=null,hasAudio=true,onProgress=async()=>{}}){
  const ranges=(keepRanges||[]).filter(r=>r.endMs-r.startMs>=100).slice(0,80);
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

  const filters=[];
  const concatInputs=[];
  ranges.forEach((r,i)=>{
    const start=(r.startMs/1000).toFixed(3);
    const end=(r.endMs/1000).toFixed(3);
    filters.push(`[0:v]trim=start=${start}:end=${end},setpts=PTS-STARTPTS[v${i}]`);
    concatInputs.push(`[v${i}]`);
    if(hasAudio){
      filters.push(`[0:a]atrim=start=${start}:end=${end},asetpts=PTS-STARTPTS[a${i}]`);
      concatInputs.push(`[a${i}]`);
    }
  });

  filters.push(
    hasAudio
      ?`${concatInputs.join('')}concat=n=${ranges.length}:v=1:a=1[outv][outa]`
      :`${concatInputs.join('')}concat=n=${ranges.length}:v=1:a=0[outv]`
  );

  const args=[
    '-hide_banner','-loglevel','error','-y','-i',inputPath,
    '-filter_complex',filters.join(';'),
    '-map','[outv]'
  ];
  if(hasAudio)args.push('-map','[outa]');
  args.push(
    '-c:v','libx264','-preset','ultrafast','-crf','20','-pix_fmt','yuv420p','-threads','1',
    ...(hasAudio?['-c:a','aac','-b:a','160k']:[]),
    '-movflags','+faststart',outputPath
  );
  await run('ffmpeg',args);
}

export async function finalEncode({inputPath,outputPath,onProgress=async()=>{}}){
  await onProgress(94,'Encodage final');
  await run('ffmpeg',[
    '-hide_banner','-loglevel','error','-y','-i',inputPath,
    '-c:v','libx264','-preset','veryfast','-crf','19','-pix_fmt','yuv420p','-threads','1',
    '-c:a','aac','-b:a','192k','-movflags','+faststart',
    outputPath
  ]);
}

async function getBundle(){
  if(!bundlePromise){
    bundlePromise=bundle({
      entryPoint,
      onProgress:()=>{}
    }).catch(err=>{
      bundlePromise=null;
      throw err;
    });
  }
  return bundlePromise;
}

export async function renderWithRemotion({
  sourcePath,
  outputPath,
  durationMs,
  timeline,
  onProgress=async()=>{}
}){
  await onProgress(58,'Préparation du rendu Remotion');
  const media=await startRangeServer(sourcePath);
  try{
    const serveUrl=await getBundle();
    const inputProps={sourceUrl:media.url,durationMs,timeline};
    const composition=await selectComposition({
      serveUrl,
      id:'EditPlus',
      inputProps
    });

    await renderMedia({
      composition,
      serveUrl,
      codec:'h264',
      audioCodec:'aac',
      outputLocation:outputPath,
      inputProps,
      pixelFormat:'yuv420p',
      crf:20,
      concurrency:Math.max(1,Number(process.env.REMOTION_CONCURRENCY||2)),
      timeoutInMilliseconds:120000,
      onProgress:async({progress})=>{
        const pct=60+Math.round(Math.max(0,Math.min(1,Number(progress)||0))*32);
        await onProgress(pct,'Rendu Remotion');
      }
    });
  }finally{
    await media.close();
  }
}

async function startRangeServer(filePath){
  const info=await stat(filePath);
  const server=http.createServer((req,res)=>{
    res.setHeader('Access-Control-Allow-Origin','*');
    res.setHeader('Accept-Ranges','bytes');
    res.setHeader('Cache-Control','no-store');
    res.setHeader('Content-Type','video/mp4');

    if(req.method==='OPTIONS'){
      res.writeHead(204);
      return res.end();
    }

    const range=req.headers.range;
    if(range){
      const [startRaw,endRaw]=range.replace(/bytes=/,'').split('-');
      const start=Math.max(0,Number(startRaw)||0);
      const end=Math.min(info.size-1,endRaw?Number(endRaw):info.size-1);
      if(start>end||start>=info.size){
        res.writeHead(416,{'Content-Range':`bytes */${info.size}`});
        return res.end();
      }
      res.writeHead(206,{
        'Content-Range':`bytes ${start}-${end}/${info.size}`,
        'Content-Length':String(end-start+1)
      });
      if(req.method==='HEAD')return res.end();
      return createReadStream(filePath,{start,end}).pipe(res);
    }

    res.writeHead(200,{'Content-Length':String(info.size)});
    if(req.method==='HEAD')return res.end();
    createReadStream(filePath).pipe(res);
  });

  await new Promise((resolve,reject)=>{
    server.once('error',reject);
    server.listen(0,'127.0.0.1',resolve);
  });

  const address=server.address();
  const port=typeof address==='object'&&address?address.port:0;
  return {
    url:`http://127.0.0.1:${port}/source.mp4`,
    close:()=>new Promise(resolve=>server.close(()=>resolve()))
  };
}

function run(cmd,args){
  return new Promise((resolve,reject)=>{
    const p=spawn(cmd,args);
    let err='';
    p.stderr.on('data',d=>err+=d);
    p.on('error',reject);
    p.on('close',(code,signal)=>code===0?resolve():reject(new Error(`${cmd} exited ${code??'null'}${signal?` (signal ${signal})`:''}: ${err.slice(-2000)}`)));
  });
}

export async function fileSize(filePath){
  return (await stat(filePath)).size;
}
