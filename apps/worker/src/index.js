import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import {createReadStream,createWriteStream} from 'node:fs';
import {mkdtemp,rm,stat} from 'node:fs/promises';
import {Readable} from 'node:stream';
import {pipeline} from 'node:stream/promises';
import {randomUUID} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';
import {analyzeVideo} from './viral.js';
import {buildEditTimeline} from './edit.js';
import {
  preprocessVideo,
  renderWithRemotion,
  finalEncode,
  fileSize
} from './render.js';

const required=[
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'GEMINI_API_KEY'
];
const missing=required.filter(key=>!process.env[key]);

const supabase=missing.length
  ?null
  :createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth:{
        persistSession:false,
        autoRefreshToken:false
      }
    }
  );

const workerId=
  process.env.WORKER_ID||
  `${os.hostname()}-${process.pid}`;

const port=Number(process.env.PORT||3000);
const pollMs=Math.max(1000,Number(process.env.POLL_MS||2500));
let activeJob=null;
let lastError=null;
let stopping=false;

const server=http.createServer((req,res)=>{
  if(req.url==='/health'){
    return send(res,200,{
      ok:missing.length===0,
      service:'viral-edit-worker',
      version:'0.2.0',
      worker_id:workerId,
      configured:missing.length===0,
      missing,
      active_job:activeJob,
      last_error:lastError
    });
  }

  if(req.url==='/ready'){
    return send(
      res,
      missing.length?503:200,
      {ready:missing.length===0}
    );
  }

  return send(res,404,{error:'not_found'});
});

server.listen(port,'0.0.0.0',()=>{
  console.log(JSON.stringify({
    event:'worker_listening',
    port,
    workerId,
    missing
  }));
});

process.on('SIGTERM',()=>{stopping=true});
process.on('SIGINT',()=>{stopping=true});
process.on('unhandledRejection',error=>{
  lastError=String(error?.stack||error);
  console.error(lastError);
});

if(!missing.length){
  loop().catch(error=>{
    lastError=String(error?.stack||error);
    console.error(lastError);
  });
}

async function loop(){
  while(!stopping){
    try{
      const job=await claimJob();

      if(!job){
        await sleep(pollMs);
        continue;
      }

      activeJob=job.id;
      lastError=null;
      await processJob(job);
    }catch(error){
      lastError=String(error?.stack||error);
      console.error(lastError);
      await sleep(Math.min(10000,pollMs*2));
    }finally{
      activeJob=null;
    }
  }
}

async function claimJob(){
  const {data,error}=await supabase.rpc(
    'worker_claim_processing_job',
    {
      p_worker_id:workerId,
      p_kinds:['viral_analysis','edit_render']
    }
  );

  if(error){
    if(error.code==='PGRST202'){
      throw new Error(
        'Queue RPC worker_claim_processing_job absente.'
      );
    }
    throw error;
  }

  return Array.isArray(data)
    ?data[0]||null
    :data||null;
}

async function processJob(job){
  const heartbeatTimer=setInterval(()=>{
    void heartbeat(job.id);
  },30000);
  heartbeatTimer.unref?.();

  const dir=await mkdtemp(
    path.join(os.tmpdir(),'viral-edit-')
  );

  try{
    if(await recoverIdempotentResult(job))return;

    const media=await one(
      'media_assets',
      'id,user_id,storage_bucket,storage_path,original_name,mime_type,size_bytes,duration_ms,width,height,metadata,status',
      job.video_id
    );

    if(!media||media.user_id!==job.user_id){
      throw tagged(
        'VIDEO_ACCESS_DENIED',
        'Video/job ownership mismatch'
      );
    }

    await progress(
      job,
      'processing',
      6,
      'Téléchargement de la vidéo'
    );

    const ext=extensionFor(
      media.mime_type,
      media.original_name
    );
    const sourcePath=path.join(dir,`source${ext}`);

    await downloadStorageObject({
      bucket:media.storage_bucket,
      storagePath:media.storage_path,
      outputPath:sourcePath
    });

    if(job.kind==='viral_analysis'){
      await runViral(job,media,sourcePath);
    }else if(job.kind==='edit_render'){
      await runEdit(job,media,sourcePath,dir);
    }else{
      throw tagged(
        'UNSUPPORTED_JOB',
        `Unsupported job kind ${job.kind}`
      );
    }
  }catch(error){
    await failJob(job,error);
  }finally{
    clearInterval(heartbeatTimer);
    await rm(dir,{recursive:true,force:true}).catch(()=>{});
  }
}

async function recoverIdempotentResult(job){
  if(job.kind==='viral_analysis'){
    const {data}=await supabase
      .from('viralplus_analyses')
      .select('id,final_score,score_version')
      .eq('job_id',job.id)
      .eq('user_id',job.user_id)
      .maybeSingle();

    if(data?.id){
      await complete(job,{
        analysis_id:data.id,
        final_score:data.final_score,
        score_version:data.score_version,
        recovered:true
      });
      return true;
    }
  }

  if(job.kind==='edit_render'){
    const {data}=await supabase
      .from('edit_exports')
      .select('id,output_video_id,project_id')
      .eq('job_id',job.id)
      .eq('user_id',job.user_id)
      .maybeSingle();

    if(data?.id){
      await complete(
        job,
        {
          export_id:data.id,
          project_id:data.project_id,
          output_video_id:data.output_video_id,
          recovered:true
        },
        data.output_video_id
      );
      return true;
    }
  }

  return false;
}

async function runViral(job,media,filePath){
  const result=await analyzeVideo({
    filePath,
    mimeType:media.mime_type,
    fileName:media.original_name||'video',
    geminiKey:process.env.GEMINI_API_KEY,
    model:process.env.GEMINI_MODEL||'gemini-3.8-flash',
    fallbackModel:
      process.env.GEMINI_FALLBACK_MODEL||
      'gemini-3.5-flash-lite',
    transcribeModel:
      process.env.GEMINI_TRANSCRIBE_MODEL||
      'gemini-3.5-transcribe',
    onProgress:(status,pct,stage)=>
      progress(job,status,pct,stage)
  });

  await updateMediaFromAnalysis(media,result);

  const payload=job.payload||{};
  let baselineAnalysisId=null;

  if(payload.baseline_analysis_id){
    const {data:baseline}=await supabase
      .from('viralplus_analyses')
      .select('id')
      .eq('id',payload.baseline_analysis_id)
      .eq('user_id',job.user_id)
      .maybeSingle();

    baselineAnalysisId=baseline?.id||null;
  }

  const hot=(result.timeline||[])
    .find(x=>x.severity==='red'||x.severity==='orange')||
    result.timeline?.[0]||
    {};

  const row={
    user_id:job.user_id,
    video_id:job.video_id,
    job_id:job.id,
    video_name:media.original_name||'video',
    video_sha256:null,
    is_reanalysis:Boolean(payload.reanalysis),
    baseline_analysis_id:baselineAnalysisId,
    final_score:result.final_score,
    score_version:result.score_version,
    model_used:result.model_used,
    status:
      result.final_score>=78
        ?'ready'
        :result.final_score>=60
          ?'almost'
          :'rework',
    main_problem:result.main_problem||null,
    why:result.why||null,
    detected_spoken_hook:
      result.detected_spoken_hook||null,
    recommended_hook:
      result.recommended_hook||null,
    hotspot_time:
      hot.start_sec!=null
        ?`${hot.start_sec}s → ${hot.end_sec}s`
        :null,
    hotspot_reason:
      hot.problem||hot.label||null,
    scores:result.scores,
    action_items:result.action_items,
    result_json:result
  };

  const {data,error}=await supabase
    .from('viralplus_analyses')
    .insert(row)
    .select('id')
    .single();

  if(error){
    throw tagged(
      'ANALYSIS_PERSIST_FAILED',
      error.message
    );
  }

  await complete(job,{
    analysis_id:data.id,
    final_score:result.final_score,
    score_version:result.score_version
  });
}

async function runEdit(job,media,sourcePath,dir){
  const payload=job.payload||{};
  let project=await loadOrCreateEditProject(
    job,
    media,
    payload
  );

  let analysis=null;
  if(project.source_analysis_id){
    const {data}=await supabase
      .from('viralplus_analyses')
      .select('id,user_id,result_json')
      .eq('id',project.source_analysis_id)
      .eq('user_id',job.user_id)
      .maybeSingle();

    analysis=data?.result_json||null;
  }

  if(!analysis?.transcript?.words?.length){
    await progress(
      job,
      'transcribing',
      18,
      'Compréhension de la vidéo brute'
    );

    analysis=await analyzeVideo({
      filePath:sourcePath,
      mimeType:media.mime_type,
      fileName:media.original_name||'video',
      geminiKey:process.env.GEMINI_API_KEY,
      model:
        process.env.GEMINI_MODEL||
        'gemini-3.8-flash',
      fallbackModel:
        process.env.GEMINI_FALLBACK_MODEL||
        'gemini-3.5-flash-lite',
      transcribeModel:
        process.env.GEMINI_TRANSCRIBE_MODEL||
        'gemini-3.5-transcribe',
      onProgress:(status,pct,stage)=>{
        const mapped=Math.min(
          40,
          Math.max(18,Math.round(18+pct*0.22))
        );
        return progress(
          job,
          status==='generating_report'?'planning':status,
          mapped,
          stage
        );
      }
    });

    await updateMediaFromAnalysis(media,analysis);
  }

  await progress(
    job,
    'planning',
    42,
    'Construction de la timeline Edit+'
  );

  const timeline=buildEditTimeline({
    analysis,
    style:payload.style||project.style||'creator_clean',
    captionPreset:
      payload.caption_preset||
      project.caption_preset||
      null
  });

  const {error:timelineError}=await supabase
    .from('edit_timelines')
    .upsert({
      project_id:project.id,
      user_id:job.user_id,
      version:1,
      duration_ms:timeline.outputDurationMs,
      timeline_json:timeline,
      decision_model:'editplus-timeline-v1'
    },{
      onConflict:'project_id,version'
    });

  if(timelineError){
    throw tagged(
      'TIMELINE_PERSIST_FAILED',
      timelineError.message
    );
  }

  await supabase
    .from('edit_projects')
    .update({
      status:'rendering',
      style:timeline.style,
      caption_preset:timeline.captionPreset,
      updated_at:new Date().toISOString()
    })
    .eq('id',project.id)
    .eq('user_id',job.user_id);

  const preparedPath=path.join(
    dir,
    'prepared.mp4'
  );
  const renderedPath=path.join(
    dir,
    'remotion.mp4'
  );
  const finalPath=path.join(
    dir,
    'final.mp4'
  );

  await preprocessVideo({
    inputPath:sourcePath,
    outputPath:preparedPath,
    keepRanges:timeline.keepRanges,
    hasAudio:Boolean(analysis?.measurable?.audioCodec),
    onProgress:(pct,stage)=>
      progress(job,'processing',pct,stage)
  });

  await progress(
    job,
    'rendering',
    56,
    'Application du style Edit+'
  );

  await renderWithRemotion({
    sourcePath:preparedPath,
    outputPath:renderedPath,
    durationMs:timeline.outputDurationMs,
    timeline,
    onProgress:(pct,stage)=>
      progress(job,'rendering',pct,stage)
  });

  await finalEncode({
    inputPath:renderedPath,
    outputPath:finalPath,
    onProgress:(pct,stage)=>
      progress(job,'encoding',pct,stage)
  });

  const outputStoragePath=
    `${job.user_id}/exports/${project.id}/${job.id}.mp4`;

  await progress(
    job,
    'encoding',
    97,
    'Enregistrement de l’export'
  );

  await uploadStorageObject({
    bucket:'viralplus-videos',
    storagePath:outputStoragePath,
    inputPath:finalPath,
    mimeType:'video/mp4',
    upsert:true
  });

  const sizeBytes=await fileSize(finalPath);

  const {data:outputAsset,error:assetError}=await supabase
    .from('media_assets')
    .upsert({
      user_id:job.user_id,
      module:'editplus',
      kind:'render',
      storage_bucket:'viralplus-videos',
      storage_path:outputStoragePath,
      original_name:
        `editplus-${project.id}.mp4`,
      mime_type:'video/mp4',
      size_bytes:sizeBytes,
      duration_ms:timeline.outputDurationMs,
      width:1080,
      height:1920,
      status:'ready',
      metadata:{
        source_video_id:job.video_id,
        edit_project_id:project.id,
        job_id:job.id,
        style:timeline.style,
        caption_preset:timeline.captionPreset,
        engine:timeline.engine
      }
    },{
      onConflict:'storage_bucket,storage_path'
    })
    .select('id')
    .single();

  if(assetError){
    throw tagged(
      'OUTPUT_ASSET_PERSIST_FAILED',
      assetError.message
    );
  }

  const {data:exportRow,error:exportError}=await supabase
    .from('edit_exports')
    .upsert({
      project_id:project.id,
      job_id:job.id,
      user_id:job.user_id,
      output_video_id:outputAsset.id,
      preset:'1080x1920',
      status:'ready'
    },{
      onConflict:'job_id'
    })
    .select('id')
    .single();

  if(exportError){
    throw tagged(
      'EXPORT_PERSIST_FAILED',
      exportError.message
    );
  }

  await supabase
    .from('edit_projects')
    .update({
      status:'completed',
      updated_at:new Date().toISOString()
    })
    .eq('id',project.id)
    .eq('user_id',job.user_id);

  await complete(
    job,
    {
      project_id:project.id,
      export_id:exportRow.id,
      output_video_id:outputAsset.id,
      duration_ms:timeline.outputDurationMs,
      style:timeline.style,
      caption_preset:timeline.captionPreset
    },
    outputAsset.id
  );
}

async function loadOrCreateEditProject(
  job,
  media,
  payload
){
  if(payload.edit_project_id){
    const {data,error}=await supabase
      .from('edit_projects')
      .select(
        'id,user_id,source_video_id,source_analysis_id,style,caption_preset,status,settings'
      )
      .eq('id',payload.edit_project_id)
      .eq('user_id',job.user_id)
      .maybeSingle();

    if(error)throw error;
    if(!data){
      throw tagged(
        'EDIT_PROJECT_ACCESS_DENIED',
        'Projet Edit+ introuvable.'
      );
    }
    return data;
  }

  let analysisId=null;
  if(payload.source_analysis_id){
    const {data}=await supabase
      .from('viralplus_analyses')
      .select('id')
      .eq('id',payload.source_analysis_id)
      .eq('user_id',job.user_id)
      .maybeSingle();
    analysisId=data?.id||null;
  }

  const {data,error}=await supabase
    .from('edit_projects')
    .insert({
      user_id:job.user_id,
      source_video_id:media.id,
      source_analysis_id:analysisId,
      style:payload.style||'creator_clean',
      caption_preset:
        payload.caption_preset||'modern_bold',
      status:'planning',
      settings:payload.settings||{}
    })
    .select(
      'id,user_id,source_video_id,source_analysis_id,style,caption_preset,status,settings'
    )
    .single();

  if(error){
    throw tagged(
      'EDIT_PROJECT_FAILED',
      error.message
    );
  }

  return data;
}

async function updateMediaFromAnalysis(media,analysis){
  const measurable=analysis?.measurable||{};
  const metadata={
    ...(media.metadata||{}),
    measured:true,
    fps:measurable.fps??null,
    video_codec:measurable.videoCodec??null,
    audio_codec:measurable.audioCodec??null,
    silence_ratio:measurable.silenceRatio??null,
    scene_cuts_per_10s:
      measurable.sceneCutsPer10Sec??null
  };

  const {error}=await supabase
    .from('media_assets')
    .update({
      duration_ms:
        measurable.durationSec!=null
          ?Math.round(Number(measurable.durationSec)*1000)
          :media.duration_ms,
      width:
        Number(measurable.width)||media.width,
      height:
        Number(measurable.height)||media.height,
      status:'ready',
      metadata,
      updated_at:new Date().toISOString()
    })
    .eq('id',media.id)
    .eq('user_id',media.user_id);

  if(error)throw error;
}

async function downloadStorageObject({
  bucket,
  storagePath,
  outputPath
}){
  const encoded=encodeStoragePath(storagePath);
  const url=
    `${process.env.SUPABASE_URL}/storage/v1/object/authenticated/${encodeURIComponent(bucket)}/${encoded}`;

  const response=await fetch(url,{
    headers:{
      apikey:process.env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization:
        `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`
    }
  });

  if(!response.ok||!response.body){
    throw tagged(
      'STORAGE_READ_FAILED',
      `Storage read ${response.status}: ${(await response.text()).slice(0,500)}`
    );
  }

  await pipeline(
    Readable.fromWeb(response.body),
    createWriteStream(outputPath)
  );
}

async function uploadStorageObject({
  bucket,
  storagePath,
  inputPath,
  mimeType,
  upsert=false
}){
  const info=await stat(inputPath);
  const encoded=encodeStoragePath(storagePath);
  const url=
    `${process.env.SUPABASE_URL}/storage/v1/object/${encodeURIComponent(bucket)}/${encoded}`;

  const response=await fetch(url,{
    method:'POST',
    headers:{
      apikey:process.env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization:
        `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type':mimeType,
      'Content-Length':String(info.size),
      'x-upsert':upsert?'true':'false'
    },
    body:createReadStream(inputPath),
    duplex:'half'
  });

  if(!response.ok){
    throw tagged(
      'STORAGE_WRITE_FAILED',
      `Storage write ${response.status}: ${(await response.text()).slice(0,500)}`
    );
  }
}

function encodeStoragePath(value){
  return String(value)
    .split('/')
    .map(segment=>encodeURIComponent(segment))
    .join('/');
}

async function heartbeat(jobId){
  if(!supabase||!jobId)return;

  const now=new Date().toISOString();
  const {error}=await supabase
    .from('processing_jobs')
    .update({
      heartbeat_at:now,
      updated_at:now
    })
    .eq('id',jobId)
    .eq('locked_by',workerId);

  if(error){
    console.error(JSON.stringify({
      event:'heartbeat_failed',
      job_id:jobId,
      error:error.message
    }));
  }
}

async function progress(
  job,
  status,
  progressValue,
  stage
){
  const now=new Date().toISOString();
  const pct=Math.max(
    0,
    Math.min(99,Math.round(Number(progressValue)||0))
  );

  const {error}=await supabase
    .from('processing_jobs')
    .update({
      status,
      progress:pct,
      stage,
      heartbeat_at:now,
      updated_at:now
    })
    .eq('id',job.id)
    .eq('locked_by',workerId);

  if(error)throw error;

  await supabase
    .from('job_events')
    .insert({
      job_id:job.id,
      user_id:job.user_id,
      status,
      progress:pct,
      message:stage
    });
}

async function complete(
  job,
  result,
  outputVideoId=null
){
  const now=new Date().toISOString();

  const {error}=await supabase
    .from('processing_jobs')
    .update({
      status:'completed',
      progress:100,
      stage:'Terminé',
      result,
      output_video_id:outputVideoId,
      completed_at:now,
      heartbeat_at:now,
      updated_at:now,
      error_code:null,
      error:null
    })
    .eq('id',job.id)
    .eq('locked_by',workerId);

  if(error)throw error;

  await supabase
    .from('job_events')
    .insert({
      job_id:job.id,
      user_id:job.user_id,
      status:'completed',
      progress:100,
      message:'Traitement terminé',
      details:result
    });
}

async function failJob(job,error){
  if(!supabase||!job?.id)return;

  const retryCount=Number(job.retry_count||0)+1;
  const maxRetries=Number(job.max_retries||3);

  const nonRetryable=new Set([
    'VIDEO_ACCESS_DENIED',
    'EDIT_PROJECT_ACCESS_DENIED',
    'UNSUPPORTED_JOB',
    'GEMINI_NOT_CONFIGURED',
    'INVALID_VIDEO'
  ]);

  const retryable=!nonRetryable.has(error?.code);
  const status=
    retryable&&retryCount<=maxRetries
      ?'queued'
      :'failed';

  const delaySec=Math.min(
    3600,
    Math.pow(2,retryCount)*15
  );

  const message=
    String(error?.message||error).slice(0,1500);

  const {data:updated,error:updateError}=await supabase
    .from('processing_jobs')
    .update({
      status,
      progress:0,
      stage:
        status==='queued'
          ?'Nouvelle tentative planifiée'
          :'Échec',
      retry_count:retryCount,
      next_attempt_at:
        new Date(
          Date.now()+delaySec*1000
        ).toISOString(),
      locked_at:null,
      locked_by:null,
      heartbeat_at:null,
      error_code:error?.code||'WORKER_ERROR',
      error:message,
      updated_at:new Date().toISOString()
    })
    .eq('id',job.id)
    .eq('locked_by',workerId)
    .select('id')
    .maybeSingle();

  if(updateError){
    console.error(JSON.stringify({
      event:'job_failure_write_failed',
      job_id:job.id,
      error:updateError.message
    }));
    return;
  }

  if(!updated?.id)return;

  await supabase
    .from('job_events')
    .insert({
      job_id:job.id,
      user_id:job.user_id,
      status,
      progress:0,
      message,
      details:{
        error_code:error?.code||'WORKER_ERROR',
        retry_count:retryCount
      }
    });

  if(
    status==='failed'&&
    job.kind==='viral_analysis'
  ){
    const {error:refundError}=await supabase.rpc(
      'worker_refund_job_credit',
      {p_job_id:job.id}
    );

    if(refundError){
      console.error(JSON.stringify({
        event:'credit_refund_failed',
        job_id:job.id,
        error:refundError.message
      }));
    }
  }

  if(
    status==='failed'&&
    job.kind==='edit_render'
  ){
    const projectId=job.payload?.edit_project_id;
    if(projectId){
      await supabase
        .from('edit_projects')
        .update({
          status:'failed',
          updated_at:new Date().toISOString()
        })
        .eq('id',projectId)
        .eq('user_id',job.user_id);
    }
  }

  console.error(JSON.stringify({
    event:'job_failed',
    job_id:job.id,
    status,
    retry_count:retryCount,
    error_code:error?.code||'WORKER_ERROR',
    error:message
  }));
}

async function one(table,columns,id){
  const {data,error}=await supabase
    .from(table)
    .select(columns)
    .eq('id',id)
    .maybeSingle();

  if(error)throw error;
  return data;
}

function extensionFor(mime,name=''){
  if(
    mime==='video/quicktime'||
    /\.mov$/i.test(name)
  )return '.mov';

  if(
    mime==='video/webm'||
    /\.webm$/i.test(name)
  )return '.webm';

  return '.mp4';
}

function tagged(code,message){
  const error=new Error(message);
  error.code=code;
  return error;
}

function send(res,status,body){
  res.writeHead(status,{
    'content-type':'application/json',
    'cache-control':'no-store'
  });
  res.end(JSON.stringify(body));
}

const sleep=ms=>
  new Promise(resolve=>setTimeout(resolve,ms));
