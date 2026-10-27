import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import {createReadStream,createWriteStream,existsSync} from 'node:fs';
import {mkdtemp,rm,stat} from 'node:fs/promises';
import {Readable} from 'node:stream';
import {pipeline} from 'node:stream/promises';
import {randomUUID} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';
import {analyzeVideo} from './viral.js';
import {buildEditTimeline} from './edit.js';
import {r2Settings,r2Presign} from './r2-sign.js';
import {retryableJobError} from './retry-policy.js';
import {verifyMp4} from './export-integrity.js';
import {receiveObject,verifySource,MAX_SOURCE_BYTES} from './media-integrity.js';
import {editContract} from './model-contract.js';
import {renderAlexV16} from './alex-v16-pipeline.js';
import {alexOnly,acceptsAlexJob,requiredRuntime} from './alex-beta-policy.js';
import {validateTimedWords} from './word-timing.js';
import {composeUgcRushes} from './ugc-rush-compositor.js';
import {
  preprocessVideo,
  renderWithRemotion,
  finalEncode,
  fileSize,
  sampleBackgroundLuma,
  captionColorForLuma
} from './render.js';

// Supabase/PostgREST errors can be plain objects; String(error) hides the cause.
function formatError(error){
  if(error instanceof Error)return error.stack||error.message;
  if(error&&typeof error==='object'){
    const parts=[error.code,error.message,error.details,error.hint]
      .filter(value=>value!=null&&String(value).trim());
    if(parts.length)return parts.map(String).join(' | ');
    try{return JSON.stringify(error)}catch{}
  }
  return String(error);
}

const betaAlexOnly=alexOnly(process.env);
const missing=requiredRuntime(process.env);
if(betaAlexOnly&&process.env.SOCIALPLUS_ASR_MODEL_DIR&&
  !['model.bin','config.json','tokenizer.json','vocabulary.txt'].every(name=>existsSync(path.join(process.env.SOCIALPLUS_ASR_MODEL_DIR,name))))missing.push('ASR_MODEL_FILES');

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
  lastError=formatError(error);
  console.error(lastError);
});

if(!missing.length){
  loop().catch(error=>{
    lastError=formatError(error);
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
      lastError=formatError(error);
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
      p_kinds:betaAlexOnly?['edit_render']:['viral_analysis','edit_render']
    }
  );

  if(error){
    if(error.code==='PGRST202'){
      throw new Error(
        'Queue RPC worker_claim_processing_job absente.'
      );
    }
    throw new Error(`QUEUE_CLAIM_FAILED: ${formatError(error)}`);
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
    if(betaAlexOnly&&!acceptsAlexJob(job))throw tagged('BETA_ALEX_ONLY','Cette préproduction accepte uniquement Alex V16.');
    if(await recoverIdempotentResult(job))return;

    const media=await one(
      'media_assets',
      'id,user_id,storage_bucket,storage_path,original_name,mime_type,size_bytes,sha256,duration_ms,width,height,metadata,status',
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

    await downloadMediaAsset({media,outputPath:sourcePath});
    await verifySource(sourcePath,{sizeBytes:media.size_bytes,sha256:media.sha256});

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
    is_reanalysis:Boolean(payload.reanalysis||payload.is_reanalysis),
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
  let editingSourcePath=sourcePath;
  let ugcComposition=null;
  if((payload.style||project.style)==='ugc_native'){
    const ids=payload.settings?.ugc_rush_video_ids??project.settings?.ugc_rush_video_ids??[];
    if(!Array.isArray(ids)||ids.length>40||new Set(ids).size!==ids.length){
      throw tagged('UGC_INVALID_RUSHES','Invalid UGC source count or duplicates');
    }
    const rushPaths=[];
    for(let index=0;index<ids.length;index++){
      const item=await one(
        'media_assets',
        'id,user_id,storage_bucket,storage_path,original_name,mime_type,size_bytes,metadata,status',
        ids[index]
      );
      if(!item||item.user_id!==job.user_id||!['viralplus-videos','socialplus-r2'].includes(item.storage_bucket)||!String(item.mime_type||'').startsWith('video/')){
        throw tagged('UGC_RUSH_ACCESS_DENIED','Secondary rush was not owned by the user');
      }
      const secondaryPath=path.join(dir,'ugc-raw-'+index+extensionFor(item.mime_type,item.original_name));
      await downloadMediaAsset({media:item,outputPath:secondaryPath});
      rushPaths.push(secondaryPath);
      await progress(job,'processing',8+Math.round(8*(index+1)/Math.max(1,ids.length)),'Import des plans UGC '+(index+1)+'/'+ids.length);
    }
    if(rushPaths.length){
      ugcComposition=await composeUgcRushes({
        sourcePath,rushPaths,outputPath:path.join(dir,'ugc-composite.mp4'),workDir:dir,
        onProgress:async(index,total,stage)=>progress(job,'processing',17+Math.round(2*(index+1)/total),stage)
      });
      editingSourcePath=ugcComposition.outputPath;
    }
  }

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

  const contract=editContract(payload.style||project.style,{alexReconstruction:process.env.ALEX_V16_RECONSTRUCTION_ENABLED==='true'});
  if(!contract.ok)throw tagged(contract.code,contract.message);
  const targetStyle=contract.workerStyle;
  const alexRender=targetStyle==='hormozi_omni'?await renderAlexV16({
    sourcePath:editingSourcePath,workDir:dir,outputPath:path.join(dir,'alex-final.mp4'),
    reviewDraft:process.env.ALEX_V16_REVIEW_DRAFTS==='true',
    onProgress:async(status,pct,stage)=>progress(job,status,pct,stage)
  }):null;
  const priorWords=analysis?.transcript?.words;
  const timingCheck=validateTimedWords(priorWords,
    Math.round(Number(analysis?.measurable?.durationSec||0)*1000));
  // A cached Viral+ transcript that merely contains words may still have
  // invalid timecodes. Reanalyze instead of exporting desynchronized captions.
  if(!alexRender&&(!priorWords?.length||(['leila','cinematic_story'].includes(targetStyle)&&!timingCheck.ok))){
    await progress(
      job,
      'transcribing',
      18,
      'Compréhension de la vidéo brute'
    );

    analysis=await analyzeVideo({
      filePath:editingSourcePath,
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

  if(!alexRender)await progress(
    job,
    'planning',
    42,
    'Construction de la timeline Edit+'
  );

  const timeline=alexRender?.timeline||buildEditTimeline({
    analysis,
    style:targetStyle,
    captionPreset:
      payload.caption_preset||
      project.caption_preset||
      null
  });

  if(timeline.style==='leila'||timeline.style==='cinematic_story'){
    const backdrop=await sampleBackgroundLuma(editingSourcePath,Math.min(3,Math.max(.2,timeline.sourceDurationMs/3000)));
    const left=captionColorForLuma(backdrop.left);
    const right=captionColorForLuma(backdrop.right);
    timeline.leilaTheme={left,right};
    // Caption contrast is handled separately: a bright side wall does not prove
    // that the centre over the speaker's clothing is bright.
  }

  if(ugcComposition)timeline.ugcMultirush={placements:ugcComposition.placements,unusedCount:ugcComposition.unusedCount,voiceSourceId:job.video_id};

  const {error:timelineError}=await supabase
    .from('edit_timelines')
    .upsert({
      project_id:project.id,
      user_id:job.user_id,
      version:1,
      duration_ms:timeline.outputDurationMs,
      timeline_json:timeline,
      decision_model:timeline.engine
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
  const finalPath=alexRender?.outputPath||path.join(
    dir,
    'final.mp4'
  );

  if(!alexRender){
  await preprocessVideo({
    inputPath:editingSourcePath,
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
    leilaAudio:timeline.style==='leila'||timeline.style==='cinematic_story',
    onProgress:(pct,stage)=>
      progress(job,'encoding',pct,stage)
  });
  }

  // Never persist a successful export before checking the actual final MP4.
  await verifyMp4(finalPath,{width:timeline.width,height:timeline.height,durationMs:timeline.outputDurationMs,hasAudio:alexRender?alexRender.hasAudio:Boolean(analysis?.measurable?.audioCodec)});

  const outputStoragePath=
    `${job.user_id}/exports/${project.id}/${job.id}.mp4`;

  await progress(
    job,
    'encoding',
    97,
    'Enregistrement de l’export'
  );

  const exportBucket=r2Settings(name=>process.env[name])?'socialplus-r2':'viralplus-videos';
  await uploadStorageObject({
    bucket:exportBucket,
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
      storage_bucket:exportBucket,
      storage_path:outputStoragePath,
      original_name:
        `editplus-${project.id}.mp4`,
      mime_type:'video/mp4',
      size_bytes:sizeBytes,
      duration_ms:timeline.outputDurationMs,
      width:timeline.export?.width||1080,
      height:timeline.export?.height||1920,
      status:'ready',
      metadata:{
        source_video_id:job.video_id,
        edit_project_id:project.id,
        job_id:job.id,
        style:timeline.style,
        caption_preset:timeline.captionPreset,
        engine:timeline.engine,
        ...(alexRender?{review_required:alexRender.reviewRequired,transcription_reviewed:alexRender.review.transcriptionReviewed,phonetic_alignment_certified:false}: {})
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
      preset:`${timeline.export?.width||1080}x${timeline.export?.height||1920}`,
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
      caption_preset:timeline.captionPreset,
      ...(alexRender?{review_required:alexRender.reviewRequired,transcription_reviewed:alexRender.review.transcriptionReviewed}: {})
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

async function downloadMediaAsset({media,outputPath}){
  const multipart=media?.metadata?.multipart;
  if(!multipart){
    return downloadStorageObject({
      bucket:media.storage_bucket,storagePath:media.storage_path,outputPath,expectedBytes:Number(media.size_bytes)||null
    });
  }
  const parts=multipart?.parts;
  if(multipart.version!==1||!Array.isArray(parts)||parts.length<2||parts.length>13){
    throw tagged('UGC_INVALID_MULTIPART','Invalid multipart source metadata');
  }
  let total=0;
  for(let index=0;index<parts.length;index++){
    const part=parts[index];
    const storagePath=String(part?.path||'');
    const expectedSuffix='-part'+String(index).padStart(3,'0');
    const base=String(parts[0].path||'').slice(0,-8);
    if(storagePath!==base+expectedSuffix||!storagePath.startsWith(media.user_id+'/')||!Number.isSafeInteger(Number(part.size))){
      throw tagged('UGC_INVALID_MULTIPART','Invalid chunk path or size');
    }
    total+=Number(part.size);
    await downloadStorageObject({
      bucket:media.storage_bucket,storagePath,outputPath,append:index>0,expectedBytes:Number(part.size)
    });
  }
  if(total!==Number(media.size_bytes))throw tagged('UGC_MULTIPART_SIZE_MISMATCH','Invalid assembled file size');
}

async function downloadStorageObject({
  bucket,
  storagePath,
  outputPath,
  append=false,
  expectedBytes=null
}){
  if(bucket==='socialplus-r2'){
    const config=r2Settings(name=>process.env[name]);
    if(!config)throw tagged('R2_NOT_CONFIGURED','R2 credentials missing');
    const url=await r2Presign(config,'GET',storagePath,600);
    const response=await fetch(url,{signal:AbortSignal.timeout(600_000)});
    if(!response.ok||!response.body)throw tagged('R2_READ_FAILED','R2 read status '+response.status);
    await receiveObject(response,outputPath,{append,expectedBytes,maxBytes:MAX_SOURCE_BYTES});
    return;
  }
  const encoded=encodeStoragePath(storagePath);
  const url=`${process.env.SUPABASE_URL}/storage/v1/object/authenticated/${encodeURIComponent(bucket)}/${encoded}`;

  const response=await fetch(url,{
    signal:AbortSignal.timeout(600_000),
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

  await receiveObject(response,outputPath,{append,expectedBytes,maxBytes:MAX_SOURCE_BYTES});
}

async function uploadStorageObject({
  bucket,
  storagePath,
  inputPath,
  mimeType,
  upsert=false
}){
  const info=await stat(inputPath);
  if(bucket==='socialplus-r2'){
    const config=r2Settings(name=>process.env[name]);
    if(!config)throw tagged('R2_NOT_CONFIGURED','R2 credentials missing');
    const url=await r2Presign(config,'PUT',storagePath,600);
    const response=await fetch(url,{
      method:'PUT',headers:{'Content-Type':mimeType,'Content-Length':String(info.size)},
      body:createReadStream(inputPath),duplex:'half'
    });
    if(!response.ok)throw tagged('R2_WRITE_FAILED',
      'R2 upload '+response.status+': '+(await response.text()).slice(0,350));
    return;
  }
  const encoded=encodeStoragePath(storagePath);
  const url=`${process.env.SUPABASE_URL}/storage/v1/object/${encodeURIComponent(bucket)}/${encoded}`;

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

  const retryable=retryableJobError(error);
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
