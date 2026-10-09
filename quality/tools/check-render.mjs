#!/usr/bin/env node
// Quality Lab only. This is an integrity check, not professional/editiorial certification.
import {spawn} from 'node:child_process';
import {existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

function run(program,args,timeout=90000){
  return new Promise((ok,fail)=>{
    const p=spawn(program,args,{stdio:['ignore','pipe','pipe']});
    let out='',err='';
    const timer=setTimeout(()=>{p.kill('SIGKILL');fail(Error(program+' timeout'));},timeout);
    p.stdout.on('data',v=>{out+=String(v)});
    p.stderr.on('data',v=>{err+=String(v)});
    p.on('error',e=>{clearTimeout(timer);fail(e)});
    p.on('close',code=>{clearTimeout(timer);code===0?ok({out,err}):fail(Error(program+' exited '+code+': '+err.slice(-400)))});
  });
}
function matches(log,regex){
  return [...log.matchAll(regex)].map(m=>({
    start:Number(m[1]),end:Number(m[2]),duration:Number(m[3])
  })).filter(x=>Number.isFinite(x.duration));
}
export async function checkRender(file,options={}){
  if(!existsSync(file))throw Error('Video not found: '+file);
  const {out}=await run('ffprobe',['-v','error','-show_format','-show_streams','-of','json',file]);
  const probe=JSON.parse(out);
  const v=probe.streams?.find(s=>s.codec_type==='video');
  const a=probe.streams?.find(s=>s.codec_type==='audio');
  const duration=Number(probe.format?.duration||0);
  const rate=String(v?.avg_frame_rate||'0/1').split('/').map(Number);
  const fps=rate[1]?rate[0]/rate[1]:0;
  const errors=[],warnings=[];
  if(!v)errors.push({code:'NO_VIDEO'});
  if(duration<Number(options.minSeconds??1))errors.push({code:'INVALID_DURATION',duration});
  if(options.requireAudio!==false&&!a)errors.push({code:'NO_AUDIO'});
  if(v&&fps<Number(options.minFps??23))errors.push({code:'LOW_FPS',fps});
  if(options.width!=null&&v?.width!==Number(options.width))errors.push({code:'BAD_WIDTH',actual:v?.width,expected:options.width});
  if(options.height!=null&&v?.height!==Number(options.height))errors.push({code:'BAD_HEIGHT',actual:v?.height,expected:options.height});
  let black=[],silences=[];
  if(v){
    const {err}=await run('ffmpeg',['-hide_banner','-nostdin','-v','info','-i',file,'-vf','blackdetect=d=0.4:pix_th=0.10:pic_th=0.98','-an','-f','null','-']);
    black=matches(err,/black_start:\s*([\d.]+)\s+black_end:\s*([\d.]+)\s+black_duration:\s*([\d.]+)/g);
    for(const x of black.filter(x=>x.duration>=Number(options.maxBlackSec??0.9)))errors.push({code:'LONG_BLACK',...x});
  }
  if(a){
    const {err}=await run('ffmpeg',['-hide_banner','-nostdin','-v','info','-i',file,'-vn','-af','silencedetect=noise=-42dB:d=1.2','-f','null','-']);
    silences=matches(err,/silence_start:\s*([\d.]+)[\s\S]*?silence_end:\s*([\d.]+)\s*\|\s*silence_duration:\s*([\d.]+)/g);
    for(const x of silences.filter(x=>x.duration>=2))warnings.push({code:'LONG_SILENCE',...x});
  }
  return {
    verdict:errors.length?'FAIL':'PASS',
    scope:'MEDIA_INTEGRITY_ONLY',
    media:{duration,width:v?.width??null,height:v?.height??null,fps,hasAudio:Boolean(a)},
    errors,warnings,evidence:{black,silences},
    limitation:'Does not prove editing quality. Human review is required for rhythm, typography, narration, B-roll, facial composition and sound mix.'
  };
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  try{
    if(!process.argv[2])throw Error('Usage: node quality/tools/check-render.mjs video.mp4');
    const result=await checkRender(process.argv[2]);
    console.log(JSON.stringify(result,null,2));
    if(result.verdict!=='PASS')process.exitCode=1;
  }catch(e){console.error(String(e));process.exitCode=2}
}
