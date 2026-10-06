import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import {mkdtemp,rm,writeFile} from 'node:fs/promises';
import {createClient} from '@supabase/supabase-js';
import {analyzeVideo} from './viral.js';
import {buildEditTimeline} from './edit.js';

const required=['SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY'];
const missing=required.filter(k=>!process.env[k]);
const supabase=missing.length?null:createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const workerId=process.env.WORKER_ID||`${os.hostname()}-${process.pid}`;
const port=Number(process.env.PORT||3000);
const pollMs=Math.max(1000,Number(process.env.POLL_MS||2500));
let activeJob=null,lastError=null,stopping=false;

http.createServer((req,res)=>{
  if(req.url==='/health') return send(res,200,{ok:missing.length===0,service:'viral-edit-worker',worker_id:workerId,configured:missing.length===0,missing,active_job:activeJob,last_error:lastError});
  if(req.url==='/ready') return send(res,missing.length?503:200,{ready:missing.length===0});
  return send(res,404,{error:'not_found'});
}).listen(port,'0.0.0.0',()=>console.log(JSON.stringify({event:'worker_listening',port,workerId,missing})));

process.on('SIGTERM',()=>{stopping=true});
process.on('SIGINT',()=>{stopping=true});
if(!missing.length) loop().catch(e=>{lastError=String(e?.stack||e);console.error(lastError)});

async function loop(){
  while(!stopping){
    try{
      const job=await claimJob();
      if(!job){await sleep(pollMs);continue;}
      activeJob=job.id;
      lastError=null;
      await processJob(job);
    }catch(e){
      lastError=String(e?.stack||e);
      console.error(lastError);
      await sleep(Math.min(10000,pollMs*2));
    }finally{
      activeJob=null;
    }
  }
}

async function claimJob(){
  const {data,error}=await supabase.rpc('worker_claim_processing_job',{p_worker_id:workerId,p_kinds:['viral_analysis','edit_render']});
  if(error){
    if(error.code==='PGRST202') throw new Error('Queue RPC worker_claim_processing_job absente: applique la migration worker_queue.');
    throw error;
  }
  return Array.isArray(data)?data[0]||null:data||null;
}

async function processJob(job){
  const dir=await mkdtemp(path.join(os.tmpdir(),'viral-edit-'));
  try{
    const media=await one('media_assets','id,user_id,storage_bucket,storage_path,original_name,mime_type,size_bytes,duration_ms',job.video_id);
    if(!media||media.user_id!==job.user_id) throw tagged('VIDEO_ACCESS_DENIED','Video/job ownership mismatch');

    await progress(job,'processing',8,'Téléchargement de la vidéo');
    const {data,error}=await supabase.storage.from(media.storage_bucket).download(media.storage_path);
    if(error||!data) throw tagged('STORAGE_READ_FAILED',error?.message||'Storage read failed');

    const ext=extFor(media.mime_type,media.original_name);
    const filePath=path.join(dir,`source${ext}`);
    await writeFile(filePath,Buffer.from(await data.arrayBuffer()));

    if(job.kind==='viral_analysis') await runViral(job,media,filePath);
    else if(job.kind==='edit_render') await runEdit(job,media,filePath);
    else throw tagged('UNSUPPORTED_JOB',`Unsupported job kind ${job.kind}`);
  }catch(e){
    await failJob(job,e);
  }finally{
    await rm(dir,{recursive:true,force:true}).catch(()=>{});
  }
}

async function runViral(job,media,filePath){
  if(!process.env.GEMINI_API_KEY) throw tagged('GEMINI_NOT_CONFIGURED','GEMINI_API_KEY is not configured');
  const result=await analyzeVideo({
    filePath,
    mimeType:media.mime_type,
    fileName:media.original_name||'video',
    geminiKey:process.env.GEMINI_API_KEY,
    model:process.env.GEMINI_MODEL||'gemini-2.5-flash',
    fallbackModel:process.env.GEMINI_FALLBACK_MODEL||'gemini-2.5-flash-lite',
    onProgress:(status,pct,stage)=>progress(job,status,pct,stage)
  });

  const hot=(result.timeline||[]).find(x=>x.severity==='red'||x.severity==='orange')||result.timeline?.[0]||{};
  const row={
    user_id:job.user_id,
    video_id:job.video_id,
    job_id:job.id,
    video_name:media.original_name||'video',
    final_score:result.final_score,
    score_version:result.score_version,
    model_used:result.model_used,
    status:result.final_score>=78?'ready':result.final_score>=60?'almost':'rework',
    main_problem:result.main_problem||null,
    why:result.why||null,
    detected_spoken_hook:result.detected_spoken_hook||null,
    recommended_hook:result.recommended_hook||null,
    hotspot_time:hot.start_sec!=null?`${hot.start_sec}s → ${hot.end_sec}s`:null,
    hotspot_reason:hot.problem||hot.label||null,
    scores:result.scores,
    action_items:result.action_items,
    result_json:result
  };

  const {data,error}=await supabase.from('viralplus_analyses').insert(row).select('id').single();
  if(error) throw tagged('ANALYSIS_PERSIST_FAILED',error.message);
  await complete(job,{analysis_id:data.id,final_score:result.final_score,score_version:result.score_version});
}

async function runEdit(job,media){
  const payload=job.payload||{};
  const analysisId=payload.analysis_id||null;
  let analysis=null;

  if(analysisId){
    const {data}=await supabase.from('viralplus_analyses')
      .select('id,result_json')
      .eq('id',analysisId)
      .eq('user_id',job.user_id)
      .maybeSingle();
    analysis=data?.result_json||null;
  }

  await progress(job,'planning',28,'Construction de la timeline Edit+');
  const timeline=buildEditTimeline({
    durationMs:media.duration_ms||Math.round((analysis?.measurable?.durationSec||0)*1000),
    style:payload.style||'creator_clean',
    captionPreset:payload.caption_preset||'modern_bold',
    analysis,
    transcript:payload.transcript||[]
  });

  const {data:project,error:projectErr}=await supabase.from('edit_projects').insert({
    user_id:job.user_id,
    source_video_id:job.video_id,
    source_analysis_id:analysisId,
    style:timeline.style,
    caption_preset:timeline.captionPreset,
    status:'ready',
    settings:payload.settings||{}
  }).select('id').single();
  if(projectErr) throw tagged('EDIT_PROJECT_FAILED',projectErr.message);

  const {error:timelineErr}=await supabase.from('edit_timelines').insert({
    project_id:project.id,
    user_id:job.user_id,
    version:1,
    duration_ms:timeline.segments.at(-1)?.sourceEndMs||0,
    timeline_json:timeline,
    decision_model:'editplus-planner-v1'
  });
  if(timelineErr) throw tagged('TIMELINE_PERSIST_FAILED',timelineErr.message);

  await progress(job,'rendering',55,'Timeline prête — renderer Remotion en attente');
  throw tagged('RENDERER_NOT_ENABLED','Edit+ timeline engine is ready; Remotion render runtime is the next deployment slice.');
}

async function progress(job,status,progressValue,stage){
  const now=new Date().toISOString();
  const patch={status,progress:progressValue,stage,heartbeat_at:now,updated_at:now};
  if(!job.started_at) patch.started_at=now;
  const {error}=await supabase.from('processing_jobs').update(patch).eq('id',job.id).eq('locked_by',workerId);
  if(error) throw error;
  await supabase.from('job_events').insert({job_id:job.id,user_id:job.user_id,status,progress:progressValue,message:stage});
}

async function complete(job,result){
  const now=new Date().toISOString();
  const {error}=await supabase.from('processing_jobs').update({
    status:'completed',
    progress:100,
    stage:'Terminé',
    result,
    completed_at:now,
    heartbeat_at:now,
    updated_at:now
  }).eq('id',job.id).eq('locked_by',workerId);
  if(error) throw error;
  await supabase.from('job_events').insert({
    job_id:job.id,user_id:job.user_id,status:'completed',progress:100,message:'Traitement terminé',details:result
  });
}

async function failJob(job,e){
  if(!supabase||!job?.id) return;
  const retryCount=Number(job.retry_count||0)+1;
  const max=Number(job.max_retries||3);
  const retryable=!['VIDEO_ACCESS_DENIED','UNSUPPORTED_JOB','GEMINI_NOT_CONFIGURED','RENDERER_NOT_ENABLED'].includes(e.code);
  const status=retryable&&retryCount<=max?'queued':'failed';
  const delay=Math.min(3600,Math.pow(2,retryCount)*15);
  const next=new Date(Date.now()+delay*1000).toISOString();
  const message=String(e?.message||e).slice(0,1200);

  await supabase.from('processing_jobs').update({
    status,
    progress:0,
    stage:status==='queued'?'Nouvelle tentative planifiée':'Échec',
    retry_count:retryCount,
    next_attempt_at:next,
    locked_at:null,
    locked_by:null,
    heartbeat_at:null,
    error_code:e.code||'WORKER_ERROR',
    error:message,
    updated_at:new Date().toISOString()
  }).eq('id',job.id);

  await supabase.from('job_events').insert({
    job_id:job.id,
    user_id:job.user_id,
    status,
    progress:0,
    message,
    details:{error_code:e.code||'WORKER_ERROR',retry_count:retryCount}
  });

  if(status==='failed' && job.kind==='viral_analysis'){
    const {error:refundError}=await supabase.rpc('worker_refund_job_credit',{p_job_id:job.id});
    if(refundError)console.error(JSON.stringify({event:'credit_refund_failed',job_id:job.id,error:refundError.message}));
  }
}

async function one(table,cols,id){
  const {data,error}=await supabase.from(table).select(cols).eq('id',id).maybeSingle();
  if(error) throw error;
  return data;
}
function tagged(code,message){const e=new Error(message);e.code=code;return e;}
function extFor(mime,name=''){if(mime==='video/quicktime'||/\.mov$/i.test(name))return '.mov';if(mime==='video/webm'||/\.webm$/i.test(name))return '.webm';return '.mp4';}
function send(res,status,body){res.writeHead(status,{'content-type':'application/json','cache-control':'no-store'});res.end(JSON.stringify(body));}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
