import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import {mkdtemp,rm,readFile,writeFile,stat} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';
import {analyzeVideo} from './viral.js';

const required=['SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY','GEMINI_API_KEY'];
const missing=required.filter(k=>!process.env[k]);
const supabase=missing.length?null:createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const workerId=process.env.WORKER_ID||`clip-${os.hostname()}-${process.pid}`;
const port=Number(process.env.PORT||3000);
const pollMs=Math.max(1200,Number(process.env.POLL_MS||3000));
const bucket=process.env.VIDEO_BUCKET||'viralplus-videos';
let activeJob=null,lastError=null,stopping=false;

const server=http.createServer((req,res)=>{
  if(req.url==='/health')return send(res,missing.length?503:200,{ok:missing.length===0,service:'viralplus-clip-worker',version:'0.1.0',worker_id:workerId,configured:missing.length===0,missing,active_job:activeJob,last_error:lastError});
  if(req.url==='/ready')return send(res,missing.length?503:200,{ready:missing.length===0});
  return send(res,404,{error:'not_found'});
});
server.listen(port,'0.0.0.0',()=>console.log(JSON.stringify({event:'clip_worker_listening',port,workerId,missing})));
process.on('SIGTERM',()=>{stopping=true});
process.on('SIGINT',()=>{stopping=true});
process.on('unhandledRejection',e=>{lastError=String(e?.stack||e);console.error(lastError)});
if(!missing.length)loop().catch(e=>{lastError=String(e?.stack||e);console.error(lastError)});

async function loop(){
  while(!stopping){
    try{
      const job=await claimJob();
      if(!job){await sleep(pollMs);continue}
      activeJob=job.id;lastError=null;await processJob(job);
    }catch(e){lastError=String(e?.stack||e);console.error(lastError);await sleep(Math.min(10000,pollMs*2))}
    finally{activeJob=null}
  }
}

async function claimJob(){
  const {data,error}=await supabase.rpc('worker_claim_processing_job',{p_worker_id:workerId,p_kinds:['clip_generate']});
  if(error)throw error;
  return Array.isArray(data)?data[0]||null:data||null;
}

async function processJob(job){
  const heartbeatTimer=setInterval(()=>void heartbeat(job.id),30000);heartbeatTimer.unref?.();
  const dir=await mkdtemp(path.join(os.tmpdir(),'clipplus-'));
  try{
    if(await recover(job))return;
    const payload=job.payload||{};
    const projectId=String(payload.clip_project_id||'');
    const sourceUrl=String(payload.source_url||'');
    if(!isUuid(projectId))throw tagged('INVALID_PROJECT','Projet Clip+ invalide');
    if(!allowedSource(sourceUrl))throw tagged('UNSUPPORTED_SOURCE','Lien non pris en charge ou non sécurisé');

    const {data:project,error:pe}=await supabase.from('clip_projects').select('*').eq('id',projectId).eq('user_id',job.user_id).maybeSingle();
    if(pe)throw pe;if(!project)throw tagged('PROJECT_NOT_FOUND','Projet Clip+ introuvable');
    await supabase.from('clip_projects').update({status:'importing',updated_at:new Date().toISOString()}).eq('id',projectId);
    await progress(job,'processing',6,'Import de la vidéo source');

    const sourcePath=await importSource(sourceUrl,dir);
    const sourceInfo=await stat(sourcePath);
    if(sourceInfo.size>500*1024*1024)throw tagged('SOURCE_TOO_LARGE','La vidéo dépasse 500 Mo');

    await progress(job,'transcribing',18,'Transcription et compréhension de la vidéo');
    const analysis=await analyzeVideo({
      filePath:sourcePath,mimeType:'video/mp4',fileName:path.basename(sourcePath),geminiKey:process.env.GEMINI_API_KEY,
      model:process.env.GEMINI_MODEL||'gemini-3.8-flash',fallbackModel:process.env.GEMINI_FALLBACK_MODEL||'gemini-3.5-flash-lite',
      transcribeModel:process.env.GEMINI_TRANSCRIBE_MODEL||'gemini-3.5-transcribe',
      onProgress:async(status,pct,stage)=>progress(job,status,Math.min(46,18+Math.round((Number(pct)||0)*.28)),stage)
    });

    await supabase.from('clip_projects').update({status:'analyzing',title:project.title||analysis.detected_title_text||null,updated_at:new Date().toISOString()}).eq('id',projectId);
    await progress(job,'analyzing',48,'Sélection IA des meilleurs moments');
    const count=clampInt(payload.clip_count??project.requested_clip_count,5,1,10);
    const minSec=clampInt(payload.min_duration_sec??project.min_duration_sec,20,8,90);
    const maxSec=clampInt(payload.max_duration_sec??project.max_duration_sec,60,15,120);
    const candidates=await selectCandidates({analysis,count,minSec,maxSec,geminiKey:process.env.GEMINI_API_KEY,model:process.env.GEMINI_MODEL||'gemini-3.8-flash'});
    if(!candidates.length)throw tagged('NO_CLIPS_FOUND','Aucun passage exploitable détecté');

    await supabase.from('clip_projects').update({status:'rendering',updated_at:new Date().toISOString()}).eq('id',projectId);
    const outputIds=[];
    for(let i=0;i<candidates.length;i++){
      const c=candidates[i];
      const basePct=52+Math.round(i/candidates.length*40);
      await progress(job,'rendering',basePct,`Rendu du clip ${i+1}/${candidates.length}`);
      const clipPath=path.join(dir,`clip-${i+1}.mp4`);
      const assPath=path.join(dir,`clip-${i+1}.ass`);
      const words=(analysis.transcript?.words||[]).filter(w=>Number(w.endMs)>=c.start_sec*1000&&Number(w.startMs)<=c.end_sec*1000);
      const useCaptions=project.settings?.add_captions!==false&&words.length>0;
      if(useCaptions)await writeFile(assPath,buildAss(words,c.start_sec*1000,c.end_sec*1000,project.settings?.caption_preset||'modern_bold'),'utf8');
      await renderClip({sourcePath,outputPath:clipPath,startSec:c.start_sec,endSec:c.end_sec,assPath:useCaptions?assPath:null});
      const clipId=await persistClip({job,project,candidate:c,rank:i+1,filePath:clipPath});
      outputIds.push(clipId);
    }

    await supabase.from('clip_projects').update({status:'completed',updated_at:new Date().toISOString()}).eq('id',projectId);
    await complete(job,{clip_project_id:projectId,clip_count:outputIds.length,clip_ids:outputIds});
  }catch(e){await fail(job,e)}
  finally{clearInterval(heartbeatTimer);await rm(dir,{recursive:true,force:true}).catch(()=>{})}
}

async function recover(job){
  const {data}=await supabase.from('clip_outputs').select('id,project_id').eq('job_id',job.id).eq('user_id',job.user_id).order('rank');
  if(data?.length){
    const projectId=data[0].project_id;
    const {data:p}=await supabase.from('clip_projects').select('requested_clip_count,status').eq('id',projectId).maybeSingle();
    if(p?.status==='completed'||data.length>=Number(p?.requested_clip_count||1)){
      await complete(job,{clip_project_id:projectId,clip_count:data.length,clip_ids:data.map(x=>x.id),recovered:true});return true;
    }
  }
  return false;
}

async function importSource(url,dir){
  const template=path.join(dir,'source.%(ext)s');
  const out=await runStdout('yt-dlp',[
    '--no-playlist','--no-warnings','--restrict-filenames','--max-filesize','500M','--merge-output-format','mp4','--remux-video','mp4',
    '-f','bv*[height<=1080]+ba/b[height<=1080]/b','-o',template,'--print','after_move:filepath',url
  ]);
  const file=out.trim().split(/\r?\n/).filter(Boolean).at(-1);
  if(!file)throw tagged('SOURCE_IMPORT_FAILED','Impossible de récupérer la vidéo');
  return file;
}

function allowedSource(value){
  try{
    const u=new URL(value);if(u.protocol!=='https:')return false;
    const h=u.hostname.toLowerCase().replace(/^www\./,'');
    return h==='youtu.be'||h.endsWith('youtube.com')||h.endsWith('tiktok.com')||h.endsWith('instagram.com')||h.endsWith('vimeo.com');
  }catch{return false}
}

async function selectCandidates({analysis,count,minSec,maxSec,geminiKey,model}){
  const words=analysis.transcript?.words||[];
  const duration=Math.max(0,Number(analysis.measurable?.durationSec||0));
  const transcript=compactTranscript(words,320000);
  const prompt=`Tu es Clip+, un directeur éditorial spécialisé short-form.\n\nÀ partir de la transcription horodatée d'une vidéo longue, sélectionne les ${count} meilleurs passages autonomes à transformer en Reels/TikTok/Shorts.\nDurée de chaque clip: ${minSec} à ${maxSec} secondes.\nDurée source: ${duration.toFixed(1)} secondes.\n\nPriorités: hook immédiat, idée compréhensible sans contexte, tension/curiosité, valeur concrète, émotion ou opinion forte, fin naturelle, potentiel de partage. Évite les intros, sponsors, transitions molles, passages incomplets et doublons. Les clips ne doivent pas se chevaucher fortement.\n\nRetourne UNIQUEMENT un JSON valide: {"clips":[{"start_sec":0,"end_sec":35,"title":"","hook":"","rationale":"","viral_score":0}]}. viral_score est une heuristique 0-100, pas une promesse de vues.\n\nTRANSCRIPTION:\n${transcript}`;
  const r=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,{method:'POST',headers:{'x-goog-api-key':geminiKey,'content-type':'application/json'},body:JSON.stringify({contents:[{role:'user',parts:[{text:prompt}]}],generationConfig:{responseMimeType:'application/json',temperature:.15}})});
  if(!r.ok)throw new Error(`Gemini clips ${r.status}: ${(await r.text()).slice(0,500)}`);
  const body=await r.json();
  const text=(body.candidates||[]).flatMap(x=>x.content?.parts||[]).map(x=>x.text||'').join('').trim();
  let parsed;try{parsed=JSON.parse(text.replace(/^```(?:json)?\s*/i,'').replace(/```$/,'').trim())}catch{parsed={clips:[]}}
  const raw=Array.isArray(parsed.clips)?parsed.clips:[];
  const clean=[];
  for(const x of raw){
    let start=Math.max(0,Number(x.start_sec)||0),end=Math.min(duration,Number(x.end_sec)||0);
    if(end<=start)continue;
    if(end-start<minSec)end=Math.min(duration,start+minSec);
    if(end-start>maxSec)end=start+maxSec;
    if(end-start<Math.min(minSec,12))continue;
    const item={start_sec:round(start,3),end_sec:round(end,3),title:String(x.title||'Clip '+(clean.length+1)).slice(0,140),hook:String(x.hook||'').slice(0,220),rationale:String(x.rationale||'').slice(0,500),viral_score:clampInt(x.viral_score,65,0,100)};
    if(clean.some(y=>overlapRatio(item,y)>.5))continue;
    clean.push(item);if(clean.length>=count)break;
  }
  if(clean.length<count){
    for(const x of fallbackCandidates(words,duration,count,minSec,maxSec)){
      if(!clean.some(y=>overlapRatio(x,y)>.5)){clean.push(x);if(clean.length>=count)break}
    }
  }
  return clean.sort((a,b)=>b.viral_score-a.viral_score).slice(0,count);
}

function compactTranscript(words,maxChars){
  if(!words.length)return 'AUCUNE TRANSCRIPTION';
  const lines=[];
  for(let i=0;i<words.length;i+=10){
    const g=words.slice(i,i+10),t=(Number(g[0]?.startMs)||0)/1000;
    lines.push(`[${t.toFixed(1)}s] ${g.map(w=>w.text).join(' ')}`);
  }
  let joined=lines.join('\n');
  if(joined.length<=maxChars)return joined;
  const step=Math.ceil(joined.length/maxChars);
  joined=lines.filter((_,i)=>i%step===0).join('\n');
  return joined.slice(0,maxChars);
}

function fallbackCandidates(words,duration,count,minSec,maxSec){
  const out=[],target=Math.min(maxSec,Math.max(minSec,45));
  for(let i=0;i<count;i++){
    const center=duration*((i+1)/(count+1));
    let start=Math.max(0,center-target*.25),end=Math.min(duration,start+target);
    const near=words.find(w=>Math.abs((Number(w.startMs)||0)/1000-start)<2);if(near)start=Math.max(0,(Number(near.startMs)||0)/1000);
    end=Math.min(duration,start+target);
    if(end-start>=12)out.push({start_sec:round(start,3),end_sec:round(end,3),title:`Moment fort ${i+1}`,hook:'',rationale:'Sélection de secours répartie sur la vidéo.',viral_score:55-i});
  }
  return out;
}

function overlapRatio(a,b){const x=Math.max(0,Math.min(a.end_sec,b.end_sec)-Math.max(a.start_sec,b.start_sec));return x/Math.max(1,Math.min(a.end_sec-a.start_sec,b.end_sec-b.start_sec))}

function buildAss(words,clipStartMs,clipEndMs,preset){
  const style=preset==='minimal'?{size:52,margin:260,outline:3}:preset==='authority'?{size:58,margin:280,outline:4}:{size:64,margin:300,outline:5};
  const groups=[];let g=[];
  const flush=()=>{if(!g.length)return;groups.push(g);g=[]};
  for(const w of words){
    const s=Math.max(clipStartMs,Number(w.startMs)||0),e=Math.min(clipEndMs,Number(w.endMs)||0);if(e<=s)continue;
    const prev=g.at(-1),pause=prev?s-(Number(prev.endMs)||0):0;
    if(g.length>=5||pause>450)flush();g.push({...w,startMs:s,endMs:e});if(/[.!?]$/.test(String(w.text||'')))flush();
  }flush();
  const header=`[Script Info]\nScriptType: v4.00+\nPlayResX: 1080\nPlayResY: 1920\nWrapStyle: 2\n\n[V4+ Styles]\nFormat: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\nStyle: Default,Arial,${style.size},&H00FFFFFF,&H00FFFFFF,&H00101012,&H58000000,-1,0,0,0,100,100,0,0,1,${style.outline},1,2,70,70,${style.margin},1\n\n[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n`;
  return header+groups.map(group=>{
    const start=(Number(group[0].startMs)-clipStartMs)/1000,end=(Number(group.at(-1).endMs)-clipStartMs)/1000;
    const text=group.map(w=>assEscape(w.text)).join(' ');
    return `Dialogue: 0,${assTime(start)},${assTime(end)},Default,,0,0,0,,${text}`;
  }).join('\n');
}

async function renderClip({sourcePath,outputPath,startSec,endSec,assPath}){
  const duration=Math.max(.1,endSec-startSec),ass=assPath?`,ass='${filterEscape(assPath)}'`:'';
  const filter=`[0:v]split=2[bg][fg];[bg]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,boxblur=18:2[bgv];[fg]scale=1080:1920:force_original_aspect_ratio=decrease[fgv];[bgv][fgv]overlay=(W-w)/2:(H-h)/2${ass}[v]`;
  await run('ffmpeg',['-hide_banner','-loglevel','error','-y','-ss',String(startSec),'-i',sourcePath,'-t',String(duration),'-filter_complex',filter,'-map','[v]','-map','0:a?','-c:v','libx264','-preset','veryfast','-crf','20','-pix_fmt','yuv420p','-c:a','aac','-b:a','160k','-af','loudnorm=I=-14:TP=-1.5:LRA=11','-movflags','+faststart',outputPath]);
}

async function persistClip({job,project,candidate,rank,filePath}){
  const info=await stat(filePath),storagePath=`${job.user_id}/clips/${project.id}/${String(rank).padStart(2,'0')}-${randomUUID()}.mp4`;
  const data=await readFile(filePath);
  const {error:ue}=await supabase.storage.from(bucket).upload(storagePath,data,{contentType:'video/mp4',upsert:false,cacheControl:'3600'});if(ue)throw ue;
  const {data:media,error:me}=await supabase.from('media_assets').insert({user_id:job.user_id,module:'clipplus',kind:'clip',storage_bucket:bucket,storage_path:storagePath,original_name:`clip-${rank}.mp4`,mime_type:'video/mp4',size_bytes:info.size,duration_ms:Math.round((candidate.end_sec-candidate.start_sec)*1000),width:1080,height:1920,status:'ready',metadata:{clip_project_id:project.id,source_url:project.source_url,rank}}).select('id').single();if(me)throw me;
  const {data:clip,error:ce}=await supabase.from('clip_outputs').insert({project_id:project.id,job_id:job.id,user_id:job.user_id,output_video_id:media.id,rank,viral_score:candidate.viral_score,title:candidate.title,hook:candidate.hook,rationale:candidate.rationale,start_ms:Math.round(candidate.start_sec*1000),end_ms:Math.round(candidate.end_sec*1000),status:'ready',metadata:{format:'9:16',captions:project.settings?.add_captions!==false}}).select('id').single();if(ce)throw ce;
  return clip.id;
}

async function progress(job,status,pct,stage){
  const value=Math.max(0,Math.min(99,Math.round(Number(pct)||0))),now=new Date().toISOString();
  const {error}=await supabase.from('processing_jobs').update({status,progress:value,stage,heartbeat_at:now,updated_at:now}).eq('id',job.id).eq('user_id',job.user_id);if(error)throw error;
  await supabase.from('job_events').insert({job_id:job.id,user_id:job.user_id,status,progress:value,message:stage,details:{worker_id:workerId}}).catch(()=>{});
}
async function heartbeat(id){await supabase.from('processing_jobs').update({heartbeat_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq('id',id).eq('locked_by',workerId).catch(()=>{})}
async function complete(job,result){const now=new Date().toISOString();await supabase.from('processing_jobs').update({status:'completed',progress:100,stage:'Terminé',result,completed_at:now,heartbeat_at:now,updated_at:now,locked_at:null,locked_by:null}).eq('id',job.id);await supabase.from('job_events').insert({job_id:job.id,user_id:job.user_id,status:'completed',progress:100,message:'Clip+ terminé',details:result}).catch(()=>{})}
async function fail(job,error){
  const message=String(error?.message||error).slice(0,1800),code=String(error?.code||'CLIP_FAILED').slice(0,120),retry=Number(job.retry_count||0)+1,max=Number(job.max_retries??3),terminal=retry>max,now=new Date();
  const update=terminal?{status:'failed',progress:Number(job.progress||0),stage:'Échec',retry_count:retry,error_code:code,error:message,completed_at:now.toISOString(),updated_at:now.toISOString(),locked_at:null,locked_by:null,heartbeat_at:null}:{status:'queued',progress:Number(job.progress||0),stage:'Nouvelle tentative',retry_count:retry,error_code:code,error:message,next_attempt_at:new Date(now.getTime()+Math.min(60000,5000*Math.pow(2,retry-1))).toISOString(),updated_at:now.toISOString(),locked_at:null,locked_by:null,heartbeat_at:null};
  await supabase.from('processing_jobs').update(update).eq('id',job.id);const pid=job.payload?.clip_project_id;if(pid)await supabase.from('clip_projects').update({status:terminal?'failed':'queued',updated_at:now.toISOString()}).eq('id',pid);await supabase.from('job_events').insert({job_id:job.id,user_id:job.user_id,status:update.status,progress:update.progress,message,details:{error_code:code,retry_count:retry,terminal}}).catch(()=>{});if(terminal)console.error(JSON.stringify({event:'clip_job_failed',job:job.id,code,message}));
}

function tagged(code,message){const e=new Error(message);e.code=code;return e}
function send(res,status,body){res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store'});res.end(JSON.stringify(body))}
function sleep(ms){return new Promise(r=>setTimeout(r,ms))}
function isUuid(v){return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(v||''))}
function clampInt(v,fallback,min,max){const n=Math.round(Number(v));return Number.isFinite(n)?Math.max(min,Math.min(max,n)):fallback}
function round(n,p=2){return Number(Number(n||0).toFixed(p))}
function assEscape(v){return String(v||'').replace(/\\/g,'\\\\').replace(/[{}]/g,'').replace(/\n/g,' ')}
function assTime(sec){const s=Math.max(0,Number(sec)||0),h=Math.floor(s/3600),m=Math.floor(s%3600/60),x=(s%60).toFixed(2).padStart(5,'0');return `${h}:${String(m).padStart(2,'0')}:${x}`}
function filterEscape(v){return String(v).replace(/\\/g,'\\\\').replace(/'/g,"\\'").replace(/:/g,'\\:')}
function run(cmd,args){return new Promise((resolve,reject)=>{const p=spawn(cmd,args);let err='';p.stderr.on('data',d=>err+=d);p.on('error',reject);p.on('close',code=>code===0?resolve():reject(new Error(`${cmd} exited ${code}: ${err.slice(-2500)}`)))})}
function runStdout(cmd,args){return new Promise((resolve,reject)=>{const p=spawn(cmd,args);let out='',err='';p.stdout.on('data',d=>out+=d);p.stderr.on('data',d=>err+=d);p.on('error',reject);p.on('close',code=>code===0?resolve(out):reject(new Error(`${cmd} exited ${code}: ${err.slice(-2500)}`)))})}
