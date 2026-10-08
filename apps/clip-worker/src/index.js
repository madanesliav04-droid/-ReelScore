import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import {mkdtemp,rm,readFile,writeFile,stat} from 'node:fs/promises';
import {createWriteStream} from 'node:fs';
import {Readable} from 'node:stream';
import {pipeline} from 'node:stream/promises';
import {spawn} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';
import {analyzeVideo,extractMeasurableSignals} from './viral.js';
import {rankHighlights,DEFAULT_MIN_HIGHLIGHT_SECONDS,DEFAULT_MAX_HIGHLIGHT_SECONDS} from './clip-highlights.js';

const required=['SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY','GEMINI_API_KEY'];
const missing=required.filter(k=>!process.env[k]);
const supabase=missing.length?null:createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const workerId=process.env.WORKER_ID||`clip-${os.hostname()}-${process.pid}`;
const port=Number(process.env.PORT||3000);
const pollMs=Math.max(1200,Number(process.env.POLL_MS||3000));
const bucket=process.env.VIDEO_BUCKET||'viralplus-videos';
// Keep encoded clips below the effective 50 MiB single-object upload ceiling.
const MAX_CLIP_UPLOAD_BYTES=45*1024*1024;
const minClipQuality=Math.max(50,Math.min(90,Number(process.env.CLIP_MIN_QUALITY||64)));
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
    if(!isUuid(projectId))throw tagged('INVALID_PROJECT','Projet Clip+ invalide');

    const {data:project,error:pe}=await supabase.from('clip_projects').select('*').eq('id',projectId).eq('user_id',job.user_id).maybeSingle();
    if(pe)throw pe;if(!project)throw tagged('PROJECT_NOT_FOUND','Projet Clip+ introuvable');

    const sourceVideoId=String(payload.source_video_id||project.source_video_id||'');
    const sourceUrl=String(payload.source_url||project.source_url||'');
    const hasUpload=isUuid(sourceVideoId);
    if(!hasUpload&&!allowedSource(sourceUrl)){
      throw tagged('UNSUPPORTED_SOURCE','Ajoute une vidéo uploadée ou un lien pris en charge');
    }

    await supabase.from('clip_projects').update({status:'importing',updated_at:new Date().toISOString()}).eq('id',projectId);
    await progress(job,'processing',6,hasUpload?'Téléchargement de la vidéo uploadée':'Import de la vidéo source');

    const requestedCount=clampInt(
      payload.clip_count??project.requested_clip_count,
      5,
      1,
      20
    );

    if(
      !hasUpload&&
      isYouTubeSource(sourceUrl)&&
      String(process.env.VIZARD_API_KEY||'').trim()
    ){
      await processVizardYouTube({
        job,
        project,
        sourceUrl,
        count:requestedCount,
        dir
      });
      return;
    }

    const imported=hasUpload
      ?await importUploadedSource({sourceVideoId,userId:job.user_id,dir})
      :{filePath:await importSource(sourceUrl,dir),mimeType:'video/mp4'};

    const sourcePath=imported.filePath;
    const sourceInfo=await stat(sourcePath);
    if(sourceInfo.size>500*1024*1024)throw tagged('SOURCE_TOO_LARGE','La vidéo dépasse 500 Mo');

    // Internal diagnostic path: validate source ingestion without spending Gemini/render compute.
    if(payload?.internal_test===true&&payload?.settings?.import_only===true){
      await supabase.from('clip_projects').update({
        status:'completed',
        updated_at:new Date().toISOString()
      }).eq('id',projectId);
      await complete(job,{
        import_ok:true,
        source_platform:project.source_platform||payload.source_platform||null,
        source_url:sourceUrl||null,
        bytes:sourceInfo.size,
        worker_id:workerId
      });
      return;
    }

    await progress(job,'transcribing',18,'Transcription et compréhension de la vidéo');

    let analysis=hasUpload
      ?await loadReusableViralAnalysis({
        sourceVideoId,
        userId:job.user_id
      })
      :null;

    if(analysis){
      await progress(job,'analyzing',44,'Analyse Viral+ existante réutilisée');
    }else{
      try{
        analysis=await analyzeVideo({
          filePath:sourcePath,
          mimeType:imported.mimeType||'video/mp4',
          fileName:path.basename(sourcePath),
          geminiKey:process.env.GEMINI_API_KEY,
          model:process.env.GEMINI_MODEL||'gemini-3.8-flash',
          fallbackModel:process.env.GEMINI_FALLBACK_MODEL||'gemini-3.5-flash-lite',
          transcribeModel:process.env.GEMINI_TRANSCRIBE_MODEL||'gemini-3.5-transcribe',
          onProgress:async(status,pct,stage)=>progress(
            job,
            status,
            Math.min(46,18+Math.round((Number(pct)||0)*.28)),
            stage
          )
        });
      }catch(error){
        console.warn(JSON.stringify({
          event:'clip_analysis_local_fallback',
          error:String(error?.message||error).slice(0,700)
        }));
        const measurable=await extractMeasurableSignals(sourcePath);
        analysis=buildLocalClipAnalysis(measurable,error);
        await progress(job,'analyzing',44,'Analyse locale de secours');
      }
    }

    await supabase.from('clip_projects').update({status:'analyzing',title:project.title||analysis.detected_title_text||null,updated_at:new Date().toISOString()}).eq('id',projectId);
    await progress(job,'analyzing',48,'Sélection IA des meilleurs moments');
    const count=requestedCount;
    const minSec=clampInt(payload.min_duration_sec??project.min_duration_sec,DEFAULT_MIN_HIGHLIGHT_SECONDS,10,15);
    const maxSec=clampInt(payload.max_duration_sec??project.max_duration_sec,DEFAULT_MAX_HIGHLIGHT_SECONDS,15,15);
    const selectedCandidates=await selectCandidates({
      analysis,
      count,
      minSec,
      maxSec,
      geminiKey:process.env.GEMINI_API_KEY,
      model:process.env.GEMINI_MODEL||'gemini-3.8-flash',
      fallbackModel:process.env.GEMINI_FALLBACK_MODEL||'gemini-3.5-flash-lite'
    });

    // Final quality gate: no code path is allowed to render a clip below
    // the product's advertised minimum quality threshold.
    const candidates=(selectedCandidates||[])
      .filter(x=>Number(x?.viral_score||0)>=minClipQuality)
      .sort((a,b)=>Number(b?.viral_score||0)-Number(a?.viral_score||0))
      .slice(0,count);

    if(!candidates.length)throw tagged(
      'NO_CLIPS_FOUND',
      `Aucun passage n’atteint le seuil qualité Clip+ (${minClipQuality}/100).`
    );

    await supabase.from('clip_projects').update({status:'rendering',updated_at:new Date().toISOString()}).eq('id',projectId);

    const {data:existingRows,error:existingError}=await supabase
      .from('clip_outputs')
      .select('id,rank')
      .eq('job_id',job.id)
      .eq('user_id',job.user_id)
      .order('rank');
    if(existingError)throw existingError;
    const existingByRank=new Map((existingRows||[]).map(x=>[Number(x.rank),x.id]));

    const outputIds=[];
    for(let i=0;i<candidates.length;i++){
      const rank=i+1;
      const existingId=existingByRank.get(rank);
      if(existingId){
        outputIds.push(existingId);
        continue;
      }

      const c=candidates[i];
      const basePct=52+Math.round(i/candidates.length*40);
      await progress(job,'rendering',basePct,`Rendu du clip ${rank}/${candidates.length}`);
      const clipPath=path.join(dir,`clip-${rank}.mp4`);
      const assPath=path.join(dir,`clip-${rank}.ass`);
      const words=(analysis.transcript?.words||[]).filter(w=>Number(w.endMs)>=c.start_sec*1000&&Number(w.startMs)<=c.end_sec*1000);
      const useCaptions=project.settings?.add_captions!==false&&words.length>0;
      if(useCaptions)await writeFile(assPath,buildAss(words,c.start_sec*1000,c.end_sec*1000,project.settings?.caption_preset||'modern_bold'),'utf8');
      await renderClip({sourcePath,outputPath:clipPath,startSec:c.start_sec,endSec:c.end_sec,assPath:useCaptions?assPath:null});
      const clipId=await persistClip({job,project,candidate:c,rank,filePath:clipPath,captionsRendered:useCaptions});
      outputIds.push(clipId);
    }

    await supabase.from('clip_projects').update({status:'completed',updated_at:new Date().toISOString()}).eq('id',projectId);
    await complete(job,{
      clip_project_id:projectId,
      requested_clip_count:count,
      clip_count:outputIds.length,
      quality_first:outputIds.length<count,
      min_quality:minClipQuality,
      clip_ids:outputIds
    });
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

function isYouTubeSource(value){
  try{
    const u=new URL(normalizeSourceUrl(value));
    const h=u.hostname.toLowerCase().replace(/^www\./,'');
    return h==='youtu.be'||(h==='youtube.com'||h.endsWith('.youtube.com'));
  }catch{
    return false;
  }
}

async function processVizardYouTube({
  job,
  project,
  sourceUrl,
  count,
  dir
}){
  const apiKey=String(process.env.VIZARD_API_KEY||'').trim();
  if(!apiKey)throw tagged('VIZARD_NOT_CONFIGURED','Fallback YouTube non configuré');

  await supabase
    .from('clip_projects')
    .update({status:'importing',updated_at:new Date().toISOString()})
    .eq('id',project.id);

  await progress(
    job,
    'processing',
    10,
    'Import YouTube sécurisé'
  );

  const submit=await fetch(
    'https://elb-api.vizard.ai/hvizard-server-front/open-api/v1/project/create',
    {
      method:'POST',
      signal:AbortSignal.timeout(30000),
      headers:{
        'content-type':'application/json',
        'VIZARDAI_API_KEY':apiKey
      },
      body:JSON.stringify({
        lang:'auto',
        preferLength:[2],
        videoUrl:normalizeSourceUrl(sourceUrl),
        videoType:2,
        ratioOfClip:1,
        removeSilenceSwitch:1,
        maxClipNumber:count,
        subtitleSwitch:1,
        headlineSwitch:1,
        emojiSwitch:0,
        highlightSwitch:1,
        autoBrollSwitch:1,
        clipModel:'clip_v2',
        projectName:`Viral Studio Clip+ ${project.id}`
      })
    }
  );

  const submitText=await submit.text();
  let submitBody={};
  try{submitBody=JSON.parse(submitText)}catch{}

  if(
    !submit.ok||
    Number(submitBody?.code)!==2000||
    !submitBody?.projectId
  ){
    throw tagged(
      'VIZARD_SUBMIT_FAILED',
      `Vizard submit failed: ${submit.status} ${submitText.slice(0,500)}`
    );
  }

  const providerProjectId=String(submitBody.projectId);

  await supabase
    .from('clip_projects')
    .update({
      status:'analyzing',
      settings:{
        ...(project.settings||{}),
        provider:'vizard',
        provider_project_id:providerProjectId
      },
      updated_at:new Date().toISOString()
    })
    .eq('id',project.id);

  let result=null;
  for(let attempt=0;attempt<40;attempt++){
    await progress(
      job,
      'analyzing',
      Math.min(70,18+attempt),
      'Analyse de la vidéo YouTube'
    );

    const response=await fetch(
      `https://elb-api.vizard.ai/hvizard-server-front/open-api/v1/project/query/${encodeURIComponent(providerProjectId)}`,
      {
        signal:AbortSignal.timeout(30000),
        headers:{'VIZARDAI_API_KEY':apiKey}
      }
    );
    const text=await response.text();
    let body={};
    try{body=JSON.parse(text)}catch{}

    if(!response.ok){
      throw tagged(
        'VIZARD_QUERY_FAILED',
        `Vizard query failed: ${response.status} ${text.slice(0,500)}`
      );
    }

    if(Number(body?.code)===2000&&Array.isArray(body?.videos)){
      result=body;
      break;
    }

    if(Number(body?.code)!==1000){
      throw tagged(
        'VIZARD_PROCESSING_FAILED',
        `Vizard processing failed: ${text.slice(0,700)}`
      );
    }

    await sleep(30000);
  }

  if(!result){
    throw tagged(
      'VIZARD_TIMEOUT',
      'Le traitement YouTube a dépassé le délai autorisé.'
    );
  }

  const providerVideos=(result.videos||[])
    .filter(x=>x?.videoUrl)
    .filter(x=>Number(x.videoMsDuration||0)>=10000&&Number(x.videoMsDuration||0)<=15000)
    .sort((a,b)=>Number(b?.viralScore||0)-Number(a?.viralScore||0))
    .slice(0,count);

  if(!providerVideos.length){
    throw tagged(
      'NO_CLIPS_FOUND',
      'Aucun passage suffisamment fort n’a été détecté.'
    );
  }

  await supabase
    .from('clip_projects')
    .update({status:'rendering',updated_at:new Date().toISOString()})
    .eq('id',project.id);

  const outputIds=[];

  for(let i=0;i<providerVideos.length;i++){
    const video=providerVideos[i];
    const rank=i+1;
    await progress(
      job,
      'rendering',
      72+Math.round((i/providerVideos.length)*24),
      `Finalisation du clip ${rank}/${providerVideos.length}`
    );

    const localPath=path.join(dir,`vizard-${rank}.mp4`);
    await downloadExternalVideo(
      String(video.videoUrl),
      localPath
    );

    const clipId=await persistExternalClip({
      job,
      project,
      rank,
      filePath:localPath,
      provider:'vizard',
      providerId:String(video.videoId||''),
      durationMs:Number(video.videoMsDuration||0),
      title:String(video.title||`Clip ${rank}`),
      transcript:String(video.transcript||''),
      viralScore:Math.max(
        0,
        Math.min(100,Math.round(Number(video.viralScore||0)*10))
      ),
      rationale:String(video.viralReason||'')
    });
    outputIds.push(clipId);
  }

  await supabase
    .from('clip_projects')
    .update({
      status:'completed',
      title:project.title||String(result.projectName||'YouTube clips'),
      updated_at:new Date().toISOString()
    })
    .eq('id',project.id);

  await complete(job,{
    clip_project_id:project.id,
    requested_clip_count:count,
    clip_count:outputIds.length,
    quality_first:outputIds.length<count,
    provider:'vizard',
    provider_project_id:providerProjectId,
    clip_ids:outputIds
  });
}

async function downloadExternalVideo(url,outputPath){
  const response=await fetch(url,{
    signal:AbortSignal.timeout(180000),
    redirect:'follow',
    headers:{'user-agent':'ViralStudio-ClipPlus/1.0'}
  });
  if(!response.ok||!response.body){
    throw tagged(
      'EXTERNAL_CLIP_DOWNLOAD_FAILED',
      `External clip download ${response.status}`
    );
  }
  await pipeline(
    Readable.fromWeb(response.body),
    createWriteStream(outputPath)
  );
  const info=await stat(outputPath);
  if(!info.size)throw tagged(
    'EXTERNAL_CLIP_DOWNLOAD_FAILED',
    'External clip is empty'
  );
}

async function persistExternalClip({
  job,
  project,
  rank,
  filePath,
  provider,
  providerId,
  durationMs,
  title,
  transcript,
  viralScore,
  rationale
}){
  const info=await stat(filePath);
  if(info.size>MAX_CLIP_UPLOAD_BYTES)throw tagged('OUTPUT_TOO_LARGE','Clip externe trop volumineux');
  const externalProbe=JSON.parse(await runStdout('ffprobe',['-v','error','-show_entries','format=duration:stream=codec_type','-of','json',filePath]));
  const actualExternalDuration=Number(externalProbe?.format?.duration);
  if(!externalProbe?.streams?.some(s=>s.codec_type==='video')||!Number.isFinite(actualExternalDuration)||actualExternalDuration<9.75||actualExternalDuration>15.25){
    throw tagged('INVALID_EXPORT','La source externe ne respecte pas la durée Clip+ de 10 à 15 secondes');
  }
  const safeDuration=Math.round(actualExternalDuration*1000);
  const storagePath=
    `${job.user_id}/clips/${project.id}/${String(rank).padStart(2,'0')}-${randomUUID()}.mp4`;

  const bytes=await readFile(filePath);
  const {error:uploadError}=await supabase.storage
    .from(bucket)
    .upload(storagePath,bytes,{
      contentType:'video/mp4',
      upsert:false,
      cacheControl:'3600'
    });
  if(uploadError)throw uploadError;

  const {data:media,error:mediaError}=await supabase
    .from('media_assets')
    .insert({
      user_id:job.user_id,
      module:'clipplus',
      kind:'clip',
      storage_bucket:bucket,
      storage_path:storagePath,
      original_name:`clip-${rank}.mp4`,
      mime_type:'video/mp4',
      size_bytes:info.size,
      duration_ms:safeDuration,
      width:1080,
      height:1920,
      status:'ready',
      metadata:{
        clip_project_id:project.id,
        source_url:project.source_url,
        rank,
        provider,
        provider_id:providerId
      }
    })
    .select('id')
    .single();
  if(mediaError)throw mediaError;

  const {data:clip,error:clipError}=await supabase
    .from('clip_outputs')
    .insert({
      project_id:project.id,
      job_id:job.id,
      user_id:job.user_id,
      output_video_id:media.id,
      rank,
      viral_score:viralScore||null,
      title:title||null,
      hook:title||null,
      rationale:rationale||null,
      start_ms:0,
      end_ms:safeDuration,
      status:'ready',
      metadata:{
        format:'9:16',
        captions:true,
        provider,
        provider_id:providerId,
        transcript:transcript.slice(0,12000)
      }
    })
    .select('id')
    .single();
  if(clipError)throw clipError;

  return clip.id;
}

async function importUploadedSource({sourceVideoId,userId,dir}){
  const {data:media,error}=await supabase
    .from('media_assets')
    .select('id,user_id,storage_bucket,storage_path,original_name,mime_type,size_bytes,status')
    .eq('id',sourceVideoId)
    .eq('user_id',userId)
    .maybeSingle();

  if(error)throw error;
  if(!media)throw tagged('SOURCE_MEDIA_NOT_FOUND','Vidéo uploadée introuvable');
  if(Number(media.size_bytes||0)>500*1024*1024){
    throw tagged('SOURCE_TOO_LARGE','La vidéo dépasse 500 Mo');
  }

  const ext=extensionFor(media.mime_type,media.original_name);
  const filePath=path.join(dir,`source-upload${ext}`);
  await downloadStorageObject({
    bucketName:media.storage_bucket||bucket,
    storagePath:media.storage_path,
    outputPath:filePath
  });

  return {
    filePath,
    mimeType:media.mime_type||'video/mp4'
  };
}

async function downloadStorageObject({bucketName,storagePath,outputPath}){
  const encoded=String(storagePath)
    .split('/')
    .map(x=>encodeURIComponent(x))
    .join('/');

  const url=
    `${process.env.SUPABASE_URL}/storage/v1/object/authenticated/${encodeURIComponent(bucketName)}/${encoded}`;

  const response=await fetch(url,{
    headers:{
      apikey:process.env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization:`Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`
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

function extensionFor(mime,name){
  const lower=String(name||'').toLowerCase();
  if(lower.endsWith('.mov')||mime==='video/quicktime')return '.mov';
  if(lower.endsWith('.webm')||mime==='video/webm')return '.webm';
  return '.mp4';
}

async function importSource(url,dir){
  const normalized=normalizeSourceUrl(url);
  const host=new URL(normalized).hostname.toLowerCase().replace(/^www\./,'');
  const youtube=host==='youtu.be'||host.endsWith('youtube.com');
  url=normalized;

  const proxy=String(process.env.YTDLP_PROXY_URL||'').trim();
  const common=[
    '--no-playlist',
    '--no-warnings',
    '--js-runtimes','node',
    '--restrict-filenames',
    '--max-filesize','500M',
    '--merge-output-format','mp4',
    '--remux-video','mp4',
    '--print','after_move:filepath',
    '--socket-timeout','25',
    '--retries','4',
    '--fragment-retries','4',
    '--retry-sleep','http:linear=1:5:2',
    '--impersonate','chrome',
    ...(proxy?['--proxy',proxy]:[])
  ];

  if(!youtube){
    const template=path.join(dir,'source.%(ext)s');
    const out=await runStdout('yt-dlp',[
      ...common,
      '-f','bv*[height<=1080]+ba/b[height<=1080]/b',
      '-o',template,
      url
    ]);
    const file=out.trim().split(/\r?\n/).filter(Boolean).at(-1);
    if(!file)throw tagged('SOURCE_IMPORT_FAILED','Impossible de récupérer la vidéo');
    return file;
  }

  const provider=[
    '--extractor-args',
    'youtubepot-bgutilhttp:base_url=http://127.0.0.1:4416'
  ];

  // YouTube changes formats/client requirements frequently.
  // Avoid legacy format ids (18/22/HLS) and let yt-dlp choose available A/V streams.
  const strategies=[
    ['-S','res:720'],
    ['--extractor-args','youtube:player_client=android','-S','res:720'],
    ['--extractor-args','youtube:player_client=tv_simply','-S','res:720'],
    ['--extractor-args','youtube:player_client=tv','-S','res:720'],
    [...provider,'--extractor-args','youtube:player_client=mweb','-S','res:720'],
    ['--extractor-args','youtube:player_client=web_embedded','-S','res:720'],
    ['--extractor-args','youtube:player_client=ios','-S','res:720']
  ];

  const failures=[];
  for(let i=0;i<strategies.length;i++){
    const template=path.join(dir,`source-${i}.%(ext)s`);
    try{
      const out=await runStdout('yt-dlp',[
        ...common,
        ...strategies[i],
        '-o',template,
        url
      ]);
      const file=out.trim().split(/\r?\n/).filter(Boolean).at(-1);
      if(file)return file;
    }catch(error){
      const detail=String(error?.message||error).slice(-700);
      if(/yt-dlp exited 2:|no such option|invalid .* expression/i.test(detail)){
        console.error(JSON.stringify({event:'youtube_import_configuration_error',error:detail}));
        throw tagged('IMPORT_CONFIGURATION_ERROR','L’import par lien est temporairement indisponible. Importe le fichier vidéo pour continuer.');
      }
      failures.push(detail);
      console.warn(JSON.stringify({
        event:'youtube_import_strategy_failed',
        strategy:i,
        error:detail
      }));
    }
  }

  try{
    const fallback=await importViaCobalt(url,dir);
    if(fallback)return fallback;
  }catch(error){
    failures.push('cobalt: '+String(error?.message||error).slice(-700));
  }

  const availability=await probeYouTubeAvailability(url);
  if(availability==='unavailable'){
    throw tagged(
      'YOUTUBE_UNAVAILABLE',
      'Cette vidéo YouTube est privée, supprimée, restreinte ou indisponible.'
    );
  }

  const last=String(failures.at(-1)||'');
  const blocked=
    /403|429|login|sign in|bot|po.?token/i.test(failures.join('\n'));

  throw tagged(
    blocked?'YOUTUBE_EGRESS_REQUIRED':'YOUTUBE_IMPORT_FAILED',
    blocked
      ?'YouTube n’a pas autorisé l’import de cette source. Importe le fichier vidéo pour continuer.'
      :'L’import YouTube a échoué après toutes les stratégies disponibles.'
  );
}

async function probeYouTubeAvailability(url){
  try{
    const endpoint=
      'https://www.youtube.com/oembed?format=json&url='+
      encodeURIComponent(url);
    const response=await fetch(endpoint,{
      signal:AbortSignal.timeout(8000),
      headers:{'user-agent':'Mozilla/5.0 ViralStudio/1.0'}
    });
    if(response.ok)return 'available';
    if(response.status===404)return 'unavailable';
    return 'unknown';
  }catch{
    return 'unknown';
  }
}

async function importViaCobalt(url,dir){
  const base=String(process.env.COBALT_URL||'').replace(/\/$/,'');
  if(!base)return null;

  const resolved=await fetch(base+'/',{
    method:'POST',
    signal:AbortSignal.timeout(45000),
    headers:{'accept':'application/json','content-type':'application/json'},
    body:JSON.stringify({
      url,
      videoQuality:'720',
      downloadMode:'auto',
      youtubeVideoCodec:'h264',
      youtubeVideoContainer:'mp4',
      alwaysProxy:true,
      disableMetadata:true
    })
  });
  const raw=await resolved.text();
  let body=null;
  try{body=JSON.parse(raw)}catch{}
  if(!resolved.ok||!body){
    throw new Error('resolver '+resolved.status+': '+raw.slice(0,500));
  }
  if(body.status==='error'){
    throw new Error('resolver error: '+String(body?.error?.code||body?.text||'unknown'));
  }

  let mediaUrl=body.url||null;
  if(!mediaUrl&&body.status==='picker'&&Array.isArray(body.picker)){
    mediaUrl=body.picker.find(x=>x?.type==='video'&&x?.url)?.url||body.picker.find(x=>x?.url)?.url||null;
  }
  if(!mediaUrl)throw new Error('resolver did not return a media URL');

  const absolute=new URL(mediaUrl,base+'/').toString();
  const response=await fetch(absolute,{
    signal:AbortSignal.timeout(120000),
    redirect:'follow',
    headers:{'user-agent':'ViralStudio-ClipPlus/1.0'}
  });
  if(!response.ok||!response.body){
    throw new Error('resolver media '+response.status+': '+(await response.text()).slice(0,300));
  }
  const declared=Number(response.headers.get('content-length')||0);
  if(declared>500*1024*1024)throw tagged('SOURCE_TOO_LARGE','La vidéo dépasse 500 Mo');

  const output=path.join(dir,'source-cobalt.mp4');
  await pipeline(Readable.fromWeb(response.body),createWriteStream(output));
  const info=await stat(output);
  if(!info.size)throw new Error('resolver returned an empty file');
  if(info.size>500*1024*1024)throw tagged('SOURCE_TOO_LARGE','La vidéo dépasse 500 Mo');
  return output;
}


function normalizeSourceUrl(value){
  try{
    const u=new URL(value);
    const h=u.hostname.toLowerCase().replace(/^www\./,'');
    if(h==='youtu.be'){
      const id=u.pathname.split('/').filter(Boolean)[0];
      if(id)return 'https://www.youtube.com/watch?v='+encodeURIComponent(id);
    }
    if((h==='youtube.com'||h.endsWith('.youtube.com'))){
      const id=u.searchParams.get('v');
      if(id)return 'https://www.youtube.com/watch?v='+encodeURIComponent(id);
      const parts=u.pathname.split('/').filter(Boolean);
      if(['shorts','live','embed'].includes(parts[0])&&parts[1]){
        return 'https://www.youtube.com/watch?v='+encodeURIComponent(parts[1]);
      }
    }
    return u.toString();
  }catch{
    return value;
  }
}

function allowedSource(value){
  try{
    const u=new URL(value);if(u.protocol!=='https:')return false;
    const h=u.hostname.toLowerCase().replace(/^www\./,'');
    return h==='youtu.be'||(h==='youtube.com'||h.endsWith('.youtube.com'))||(h==='tiktok.com'||h.endsWith('.tiktok.com'))||(h==='instagram.com'||h.endsWith('.instagram.com'))||(h==='vimeo.com'||h.endsWith('.vimeo.com'));
  }catch{return false}
}

async function loadReusableViralAnalysis({
  sourceVideoId,
  userId
}){
  if(!isUuid(sourceVideoId))return null;
  const {data,error}=await supabase
    .from('viralplus_analyses')
    .select('result_json,created_at')
    .eq('video_id',sourceVideoId)
    .eq('user_id',userId)
    .order('created_at',{ascending:false})
    .limit(1)
    .maybeSingle();

  if(error||!data?.result_json)return null;
  const result=data.result_json;
  if(!Number(result?.measurable?.durationSec||0))return null;
  return result;
}

function buildLocalClipAnalysis(measurable,error){
  const duration=Math.max(0,Number(measurable?.durationSec||0));
  const sceneCuts=Array.isArray(measurable?.sceneCutsSec)?measurable.sceneCutsSec:[];
  const silences=Array.isArray(measurable?.silenceWindows)?measurable.silenceWindows:[];
  const slots=Math.min(10,Math.max(3,Math.ceil(duration/30)));
  const timeline=[];

  for(let i=0;i<slots;i++){
    const start=duration*i/slots;
    const end=Math.min(duration,duration*(i+1)/slots);
    const cuts=sceneCuts.filter(x=>x>=start&&x<end).length;
    const silence=silences.reduce((sum,s)=>{
      const overlap=Math.max(
        0,
        Math.min(end,Number(s.end||0))-Math.max(start,Number(s.start||0))
      );
      return sum+overlap;
    },0);
    const span=Math.max(.001,end-start);
    const speechRatio=Math.max(0,1-silence/span);
    const score=Math.max(
      35,
      Math.min(78,Math.round(48+speechRatio*22+Math.min(10,cuts*2)))
    );

    timeline.push({
      start_sec:round(start,3),
      end_sec:round(end,3),
      severity:score>=64?'green':'orange',
      label:'Local activity window',
      problem:'',
      correction:'',
      broll_query:'',
      local_activity_score:score
    });
  }

  return {
    measurable,
    transcript:{
      text:'',
      words:[],
      captions:[],
      error:String(error?.message||error).slice(0,500),
      model:'local-fallback'
    },
    timeline,
    detected_title_text:null,
    analysis_basis:'local_audio_visual_fallback'
  };
}

async function selectCandidates({
  analysis,
  count,
  minSec,
  maxSec,
  geminiKey,
  model,
  fallbackModel
}){
  const words=analysis.transcript?.words||[];
  const duration=Math.max(0,Number(analysis.measurable?.durationSec||0));
  const transcriptWords=compactTranscript(words,220000);
  const transcriptText=String(analysis.transcript?.text||'').trim().slice(0,120000);
  const semanticAnchors=JSON.stringify({
    detected_spoken_hook:analysis?.detected_spoken_hook||'',
    detected_visual_hook:analysis?.detected_visual_hook||'',
    verdict:analysis?.verdict||'',
    main_problem:analysis?.main_problem||'',
    why:analysis?.why||'',
    timeline:Array.isArray(analysis?.timeline)?analysis.timeline.slice(0,10):[],
    action_items:Array.isArray(analysis?.action_items)?analysis.action_items.slice(0,8):[]
  });
  const selectionPoolSize=20;

  console.log(JSON.stringify({
    event:'clip_selection_context',
    word_count:words.length,
    transcript_chars:transcriptText.length,
    timeline_count:Array.isArray(analysis?.timeline)?analysis.timeline.length:0,
    analysis_basis:analysis?.analysis_basis||null,
    transcript_error:analysis?.transcript?.error||null
  }));

  const prompt=`Tu es Clip+, un directeur éditorial spécialisé short-form.

Sélectionne JUSQU'À ${selectionPoolSize} micro-extraits réellement autonomes, orientés rétention, de ${minSec} à ${maxSec} secondes. Un bon extrait démarre directement sur une phrase qui arrête le défilement (max 1,5 seconde), apporte UNE idée précise et se termine naturellement sur sa chute. Chaque découpe doit être vérifiable grâce à la transcription ou aux ancres multimodales. Pour chaque candidat, propose l'intervalle le plus court qui conserve le hook et le payoff.
Utilise en priorité les mots horodatés. S'ils sont absents ou incomplets, appuie-toi sur la transcription texte ET sur les ancres de l'analyse multimodale (timeline, hook, verdict) pour estimer les meilleurs intervalles. N'invente jamais un timestamp sans support dans les ancres disponibles. Le nombre demandé par l'utilisateur sera appliqué APRÈS ton classement, donc ne change jamais tes critères selon le quota utilisateur. Ne remplis jamais le quota avec des passages moyens: retourne moins de clips si la qualité n'est pas suffisante.
Durée de chaque clip: ${minSec} à ${maxSec} secondes.
Durée source: ${duration.toFixed(1)} secondes.

Classement qualitatif: priorité aux phrases choc autonomes, contradictions, révélations, conseils applicables, erreurs coûteuses, émotions et conclusions percutantes. Évalue l'impact des deux premières secondes, l'autonomie sans contexte, la densité d'information et une chute complète avant 15 secondes. Écarte salutations, intros, sponsors, blabla, phrases tronquées, contextes indispensables et répétitions. N'allonge JAMAIS pour atteindre un nombre de clips. Ne propose que des extraits de ${minSec} à ${maxSec} secondes avec timestamps réels. Les clips ne doivent pas se chevaucher fortement.
Classe les MEILLEURS passages disponibles et note-les honnêtement de 0 à 100, même si aucun n'atteint ${minClipQuality}. Retourne au moins le meilleur passage autonome dès qu'il existe réellement. Le code appliquera ensuite le seuil qualité et pourra ne garder qu'un seul "best available". N'invente jamais un score pour faire passer le seuil.

Retourne UNIQUEMENT un JSON valide: {"clips":[{"start_sec":0,"end_sec":12,"title":"","hook":"","rationale":"","viral_score":0,"hook_time_sec":0}]}. Le hook reprend les mots prononcés au début. viral_score est une heuristique éditoriale, pas une prédiction de vues. Si aucun extrait autonome de 10-15 secondes n’existe, retourne {"clips":[]}.

MOTS HORODATÉS:
${transcriptWords}

TRANSCRIPTION TEXTE:
${transcriptText||'AUCUNE TRANSCRIPTION TEXTE'}

ANCRES MULTIMODALES HORODATÉES:
${semanticAnchors}`;

  let parsed=null;
  const models=[model,fallbackModel].filter((v,i,a)=>v&&a.indexOf(v)===i);
  const errors=[];

  for(const candidateModel of models){
    for(let attempt=0;attempt<2;attempt++){
      try{
        const r=await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(candidateModel)}:generateContent`,
          {
            method:'POST',
            signal:AbortSignal.timeout(25000),
            headers:{
              'x-goog-api-key':geminiKey,
              'content-type':'application/json'
            },
            body:JSON.stringify({
              contents:[{role:'user',parts:[{text:prompt}]}],
              generationConfig:{
                responseMimeType:'application/json',
                temperature:0,
                seed:42
              }
            })
          }
        );

        if(!r.ok){
          const body=(await r.text()).slice(0,700);
          const error=new Error(`Gemini clips ${r.status}: ${body}`);
          error.status=r.status;
          throw error;
        }

        const body=await r.json();
        const rawText=(body.candidates||[])
          .flatMap(x=>x.content?.parts||[])
          .map(x=>x.text||'')
          .join('')
          .trim();

        parsed=JSON.parse(
          rawText
            .replace(/^\`\`\`(?:json)?\s*/i,'')
            .replace(/\`\`\`$/,'')
            .trim()
        );
        break;
      }catch(error){
        errors.push(String(error?.message||error).slice(-700));
        const status=Number(error?.status||0);
        const transient=status===429||status===500||status===502||status===503||status===504;
        if(!transient)break;
        if(attempt===0)await sleep(1200);
      }
    }
    if(parsed)break;
  }

  if(!parsed){
    console.warn(JSON.stringify({event:'clip_selection_unavailable',reason:errors.at(-1)||'gemini_unavailable'}));
    // Without semantic evidence we must never label evenly spaced footage "best moments".
    throw tagged('SELECTION_UNAVAILABLE','La sélection IA est momentanément indisponible. Aucun clip approximatif ne sera inventé.');
  }

  const raw=Array.isArray(parsed.clips)?parsed.clips:[];
  const selected=rankHighlights(raw,{
    duration,
    words,
    minSec,
    maxSec,
    minQuality:minClipQuality,
    count,
    poolSize:selectionPoolSize
  });
  console.log(JSON.stringify({
    event:'clip_micro_highlights_ranked',
    requested:count,
    proposed:raw.length,
    accepted:selected.length,
    bounds_sec:[minSec,maxSec],
    scores:selected.map(x=>x.viral_score),
    ranges:selected.map(x=>[x.start_sec,x.end_sec])
  }));
  return selected;
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
  const duration=Math.max(.1,endSec-startSec);
  const vf=[
    'scale=1080:1920:force_original_aspect_ratio=increase:flags=lanczos',
    'crop=1080:1920:(iw-1080)/2:(ih-1920)*0.42',
    'setsar=1',
    ...(assPath?[`ass='${filterEscape(assPath)}'`]:[])
  ].join(',');

  const maxVideoKbps=Math.max(850,Math.min(5000,Math.floor(MAX_CLIP_UPLOAD_BYTES*8/duration/1000*0.85)-160));
  await run('ffmpeg',[
    '-hide_banner','-loglevel','error','-y',
    '-ss',String(startSec),
    '-i',sourcePath,
    '-t',String(duration),
    '-map','0:v:0',
    '-map','0:a:0?',
    '-vf',vf,
    '-r','30',
    '-c:v','libx264',
    '-preset','veryfast',
    '-crf','21',
    '-maxrate',`${maxVideoKbps}k`,
    '-bufsize',`${maxVideoKbps*2}k`,
    '-pix_fmt','yuv420p',
    '-threads','1',
    '-c:a','aac',
    '-b:a','160k',
    '-af','loudnorm=I=-14:TP=-1.5:LRA=11',
    '-movflags','+faststart',
    outputPath
  ]);
}

async function persistClip({job,project,candidate,rank,filePath,captionsRendered=false}){
  const info=await stat(filePath);
  if(info.size>MAX_CLIP_UPLOAD_BYTES)throw tagged('OUTPUT_TOO_LARGE',`Clip ${rank} trop volumineux (${info.size} octets), export bloqué avant upload`);
  const probe=JSON.parse(await runStdout('ffprobe',['-v','error','-show_entries','format=duration:stream=codec_type','-of','json',filePath]));
  const durationSec=Number(probe?.format?.duration);
  const expectedSec=Number(candidate.end_sec)-Number(candidate.start_sec);
  if(!probe?.streams?.some(s=>s.codec_type==='video')||!Number.isFinite(durationSec)||durationSec<9.75||durationSec>15.25||Math.abs(durationSec-expectedSec)>.4){
    throw tagged('INVALID_EXPORT',`Clip ${rank}: MP4 invalide ou durée inattendue`);
  }
  console.log(JSON.stringify({event:'clip_export_verified',job:job.id,rank,bytes:info.size,duration_sec:durationSec}));
  const storagePath=`${job.user_id}/clips/${project.id}/${String(rank).padStart(2,'0')}-${randomUUID()}.mp4`;
  const data=await readFile(filePath);
  const {error:ue}=await supabase.storage.from(bucket).upload(storagePath,data,{contentType:'video/mp4',upsert:false,cacheControl:'3600'});if(ue)throw ue;
  const {data:verified,error:verifyError}=await supabase.storage.from(bucket).createSignedUrl(storagePath,120);
  if(verifyError||!verified?.signedUrl)throw tagged('STORAGE_VERIFY_FAILED',`Export ${rank} indisponible après upload`);
  const {data:media,error:me}=await supabase.from('media_assets').insert({user_id:job.user_id,module:'clipplus',kind:'clip',storage_bucket:bucket,storage_path:storagePath,original_name:`clip-${rank}.mp4`,mime_type:'video/mp4',size_bytes:info.size,duration_ms:Math.round((candidate.end_sec-candidate.start_sec)*1000),width:1080,height:1920,status:'ready',metadata:{clip_project_id:project.id,source_url:project.source_url,rank}}).select('id').single();if(me)throw me;
  const {data:clip,error:ce}=await supabase.from('clip_outputs').insert({project_id:project.id,job_id:job.id,user_id:job.user_id,output_video_id:media.id,rank,viral_score:candidate.viral_score,title:candidate.title,hook:candidate.hook,rationale:candidate.rationale,start_ms:Math.round(candidate.start_sec*1000),end_ms:Math.round(candidate.end_sec*1000),status:'ready',metadata:{format:'9:16',captions:Boolean(captionsRendered)}}).select('id').single();if(ce)throw ce;
  return clip.id;
}

async function progress(job,status,pct,stage){
  const value=Math.max(0,Math.min(99,Math.round(Number(pct)||0)));
  const now=new Date().toISOString();

  const {error}=await supabase
    .from('processing_jobs')
    .update({
      status,
      progress:value,
      stage,
      heartbeat_at:now,
      updated_at:now
    })
    .eq('id',job.id)
    .eq('user_id',job.user_id);

  if(error)throw error;

  await supabase.from('job_events').insert({
    job_id:job.id,
    user_id:job.user_id,
    status,
    progress:value,
    message:stage,
    details:{worker_id:workerId}
  });
}

async function heartbeat(id){
  await supabase
    .from('processing_jobs')
    .update({
      heartbeat_at:new Date().toISOString(),
      updated_at:new Date().toISOString()
    })
    .eq('id',id)
    .eq('locked_by',workerId);
}

async function complete(job,result){
  const now=new Date().toISOString();

  await supabase
    .from('processing_jobs')
    .update({
      status:'completed',
      progress:100,
      stage:'Terminé',
      result,
      completed_at:now,
      heartbeat_at:now,
      updated_at:now,
      locked_at:null,
      locked_by:null
    })
    .eq('id',job.id);

  await supabase.from('job_events').insert({
    job_id:job.id,
    user_id:job.user_id,
    status:'completed',
    progress:100,
    message:'Clip+ terminé',
    details:result
  });
}

async function fail(job,error){
  const message=String(error?.message||error).slice(0,1800);
  const code=String(error?.code||'CLIP_FAILED').slice(0,120);
  const retry=Number(job.retry_count||0)+1;
  const max=Number(job.max_retries??3);
  const permanentCodes=new Set([
    'YOUTUBE_UNAVAILABLE',
    'SOURCE_TOO_LARGE',
    'SOURCE_MEDIA_NOT_FOUND',
    'UNSUPPORTED_SOURCE',
    'NO_CLIPS_FOUND',
    'OUTPUT_TOO_LARGE',
    'INVALID_EXPORT'
  ]);
  const terminal=permanentCodes.has(code)||retry>max;
  const now=new Date();

  const update=terminal
    ?{
      status:'failed',
      progress:Number(job.progress||0),
      stage:'Échec',
      retry_count:retry,
      error_code:code,
      error:message,
      completed_at:now.toISOString(),
      updated_at:now.toISOString(),
      locked_at:null,
      locked_by:null,
      heartbeat_at:null
    }
    :{
      status:'queued',
      progress:Number(job.progress||0),
      stage:'Nouvelle tentative',
      retry_count:retry,
      error_code:code,
      error:message,
      next_attempt_at:new Date(
        now.getTime()+Math.min(60000,5000*Math.pow(2,retry-1))
      ).toISOString(),
      updated_at:now.toISOString(),
      locked_at:null,
      locked_by:null,
      heartbeat_at:null
    };

  await supabase
    .from('processing_jobs')
    .update(update)
    .eq('id',job.id);

  const pid=job.payload?.clip_project_id;
  if(pid){
    await supabase
      .from('clip_projects')
      .update({
        status:terminal?'failed':'queued',
        updated_at:now.toISOString()
      })
      .eq('id',pid);
  }

  await supabase.from('job_events').insert({
    job_id:job.id,
    user_id:job.user_id,
    status:update.status,
    progress:update.progress,
    message,
    details:{
      error_code:code,
      retry_count:retry,
      terminal
    }
  });

  if(terminal){
    console.error(JSON.stringify({
      event:'clip_job_failed',
      job:job.id,
      code,
      message
    }));
  }
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
function run(cmd,args){return new Promise((resolve,reject)=>{const p=spawn(cmd,args);let err='';p.stderr.on('data',d=>err+=d);p.on('error',reject);p.on('close',(code,signal)=>code===0?resolve():reject(new Error(`${cmd} exited ${code??'null'}${signal?` (signal ${signal})`:''}: ${err.slice(-2500)}`)))})}
function runStdout(cmd,args){return new Promise((resolve,reject)=>{const p=spawn(cmd,args);let out='',err='';p.stdout.on('data',d=>out+=d);p.stderr.on('data',d=>err+=d);p.on('error',reject);p.on('close',code=>code===0?resolve(out):reject(new Error(`${cmd} exited ${code}: ${err.slice(-2500)}`)))})}
