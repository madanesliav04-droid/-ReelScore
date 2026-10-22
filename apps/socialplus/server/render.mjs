import {spawn} from 'node:child_process';
import {mkdtemp, writeFile, rm, stat} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {planHormoziOmniStoryboard} from '../../worker/src/hormozi-omni-director.js';
import {renderHormoziOmniAss} from '../../worker/src/hormozi-omni-render.js';
import {buildSocialKineticV28Plan} from '../../worker/src/social-kinetic-v28-engine.js';
import {renderSocialKineticV28Staging} from '../../worker/src/social-kinetic-v28-runtime.js';

// A visual approval never enables an autonomous engine. Keep the catalogue
// explicit about its sources; technical export is intentionally separate.
export const MODEL_CATALOG = Object.freeze([
  {id:'codie-omni-v60',label:'Codie × OMNI',version:'V60',status:'reference_only',sourceAvailable:false,available:false,
    reason:'Le pack V60 et son script de référence ne sont pas présents dans les branches inspectées.',
    missingSources:['EDITPLUS_V60_FINITION_OMNI.mp4','EDITPLUS_V60_FINITION_PACK_QA.zip','build_v60.py']},
  {id:'alex-hormozi-v16',label:'Alex Hormozi',version:'V16',status:'beta',sourceAvailable:true,available:false,
    reason:'Code OMNI de référence retrouvé. Pack V16 et recette sur trois nouveaux rushs nécessaires avant activation.',
    sourceBranch:'editplus-alex-reference-lock-20261017',engineVersion:'hormozi-omni-explainer-v1',
    missingSources:['EDITPLUS_HORMOZI_V16_RETOUR_V11_PACK.zip']},
  {id:'leila-hormozi-v53',label:'Leila Hormozi',version:'V53',status:'reference_only',sourceAvailable:false,available:false,
    reason:'Le master et le moteur Python V53 ne sont pas présents dans les branches inspectées.',
    missingSources:['EDITPLUS_LEILA_MODELE_3_V53_SOURCE_ET_AUDIT.zip','render_leila_v53.py']},
  {id:'social-kinetic-v28',label:'Social Kinetic',version:'V28',status:'beta',sourceAvailable:true,available:false,
    reason:'Moteur V28 retrouvé. Nécessite Hyperframes local, mots alignés et preuve indépendante de placement ; recette réelle en attente.',
    sourceBranch:'editplus-integrate-social-kinetic-v28-20261018',engineVersion:'28',missingSources:[]},
  {id:'apple-premium-spatial',label:'Apple Premium / Spatial UI',version:'Master à confirmer',status:'reference_only',sourceAvailable:false,available:false,
    reason:'Le master approuvé et les packages Apple V4/V5/V10 restent à fournir.',
    missingSources:['EDITPLUS_MODELE05_V10_CODE.zip','packages Apple Premium V4/V5','identification du master approuvé']},
  {id:'cinematic-storytelling-v7',label:'Cinematic Storytelling',version:'V7 finale',status:'reference_only',sourceAvailable:false,available:false,
    reason:'Le master approuvé utilise Python + FFmpeg. Le prototype Hyperframes V2 retrouvé ne le remplace pas.',
    missingSources:['archive V7 finale de 38 Mo','script V7 Python de 25 Ko','rush original V7','timings et réglages V7']}
]);

export const TECHNICAL_EXPORT = Object.freeze({id:'technical-export',label:'Exporter la source en MP4',status:'available',available:true,
  reason:'Conversion H.264/AAC du rush original, sans montage artistique ni mots inventés.'});

export class RenderError extends Error {
  constructor(code,message,details={}) {super(message);this.name='RenderError';this.code=code;this.details=details;}
}

function run(command,args,{timeoutMs=600_000,signal,maxOutput=512_000}={}) {
  return new Promise((resolve,reject)=>{
    if(signal?.aborted){reject(new RenderError('RENDER_CANCELLED','Traitement annulé.'));return;}
    const child=spawn(command,args,{shell:false,stdio:['ignore','pipe','pipe']});
    let stdout='',stderr='',settled=false;
    const done=(error,result)=>{if(settled)return;settled=true;clearTimeout(timer);signal?.removeEventListener('abort',cancel);error?reject(error):resolve(result);};
    const cancel=()=>{child.kill('SIGKILL');done(new RenderError('RENDER_CANCELLED','Traitement annulé.'));};
    const timer=setTimeout(()=>{child.kill('SIGKILL');done(new RenderError('RENDER_TIMEOUT','Le délai de traitement local est dépassé.'));},timeoutMs);
    signal?.addEventListener('abort',cancel,{once:true});
    child.stdout.on('data',b=>{stdout+=b.toString();if(stdout.length>maxOutput){child.kill('SIGKILL');done(new RenderError('PROCESS_OUTPUT_LIMIT','La sortie du traitement est trop volumineuse.'));}});
    child.stderr.on('data',b=>{stderr=(stderr+b.toString()).slice(-8000);});
    child.on('error',e=>done(new RenderError('TOOL_UNAVAILABLE',`${command} est nécessaire sur cette machine.`,{cause:e.code})));
    child.on('close',code=>code===0?done(null,{stdout,stderr}):done(new RenderError('RENDER_FAILED','Le traitement vidéo a échoué.',{tool:command,exitCode:code,log:stderr})));
  });
}

export async function probeVideo(sourcePath,{signal}={}) {
  const {stdout}=await run('ffprobe',['-v','error','-protocol_whitelist','file,pipe','-format_whitelist','mov,matroska,webm,avi,mpegts,ogg','-show_streams','-show_format','-of','json',sourcePath],{signal,timeoutMs:30_000});
  let data;try{data=JSON.parse(stdout);}catch{throw new RenderError('INVALID_VIDEO','Les métadonnées vidéo sont illisibles.');}
  const video=data.streams?.find(s=>s.codec_type==='video');
  const audio=data.streams?.filter(s=>s.codec_type==='audio')||[];
  const duration=Number(data.format?.duration||video?.duration);
  if(!video||!Number.isInteger(video.width)||!Number.isInteger(video.height)||video.width<2||video.height<2||!Number.isFinite(duration)||duration<=0)
    throw new RenderError('INVALID_VIDEO','Aucune piste vidéo exploitable dans ce fichier.');
  const rotation=Number(video.side_data_list?.find(s=>Number.isFinite(s.rotation))?.rotation||video.tags?.rotate||0);
  const rotated=Math.abs(rotation)%180===90;
  return {width:rotated?video.height:video.width,height:rotated?video.width:video.height,durationMs:Math.round(duration*1000),
    videoCodec:video.codec_name,audioCodec:audio[0]?.codec_name||null,hasAudio:audio.length>0,audioStreams:audio.length,audioChannels:audio[0]?.channels||null,
    container:data.format?.format_name||null,mime_type:/mov|mp4/.test(data.format?.format_name||'')?'video/mp4':/matroska|webm/.test(data.format?.format_name||'')?'video/webm':'application/octet-stream',
    bytes:Number(data.format?.size)||null,rotation,rawFrameRate:video.avg_frame_rate};
}

function assertSafeTimeline(timeline,meta) {
  if(!timeline||timeline.audio?.hasAudio!==meta.hasAudio||Math.abs(timeline.outputDurationMs-meta.durationMs)>65||
    timeline.export?.width!==meta.width||timeline.export?.height!==meta.height||
    timeline.keepRanges?.length!==1||timeline.keepRanges[0].startMs!==0||Math.abs(timeline.keepRanges[0].endMs-meta.durationMs)>65)
    throw new RenderError('SOURCE_TIMELINE_REQUIRED','Ce raccord conserve le rush intégral et son format natif. Une table de coupes validée doit être intégrée séparément.');
}

/** Trusted server paths only: never pass a client-supplied path or shell text. */
export async function renderVideo({sourcePath,outputPath,modelId,analysis,timeline,frameProof,editorialEvents,onProgress=async()=>{},signal}={}) {
  const known=MODEL_CATALOG.find(m=>m.id===modelId);
  if(modelId!==TECHNICAL_EXPORT.id&&!known)throw new RenderError('UNKNOWN_MODEL','Modèle inconnu.');
  if(known?.sourceAvailable===false)throw new RenderError('MODEL_SOURCE_MISSING',known.reason,{missingSources:known.missingSources});
  if(known&&process.env.SOCIALPLUS_BETA_RENDER!=='staging')
    throw new RenderError('MODEL_QA_REQUIRED',known.reason,{modelId,status:known.status});
  const meta=await probeVideo(sourcePath,{signal});
  if(meta.durationMs>600_000||meta.width*meta.height>3840*2160)
    throw new RenderError('LOCAL_RENDER_LIMIT','Le rendu local accepte jusqu’à 10 minutes et une définition 4K.');
  if(known&&!meta.hasAudio)throw new RenderError('ORIGINAL_AUDIO_REQUIRED','Le moteur nécessite la piste de voix originale.');
  const work=await mkdtemp(path.join(tmpdir(),'socialplus-render-'));
  try {
    await onProgress(10,'Vérification du fichier source');
    const filters=['scale=trunc(iw/2)*2:trunc(ih/2)*2','setsar=1'];
    let audit={modelId,artisticModel:false,engine:'ffmpeg-native-export-v1',cuts:0,source:meta,originalAudioStreamsSelected:meta.hasAudio?1:0};
    if(modelId==='alex-hormozi-v16') {
      assertSafeTimeline(timeline,meta);
      const plan=planHormoziOmniStoryboard({analysis,words:analysis?.transcript?.words,durationMs:meta.durationMs,enabled:true});
      if(!plan.cues.length)throw new RenderError('VERIFIED_EVIDENCE_REQUIRED','Le moteur Alex exige des mots alignés et une preuve indépendante de placement.',{held:plan.held});
      const ass=renderHormoziOmniAss({graphicCues:plan.cues},meta.width,meta.height);
      const assPath=path.join(work,'alex.ass');await writeFile(assPath,ass,'utf8');
      // Temporary paths are generated here and contain no user text.
      filters.push(`ass=${assPath.replace(/\\/g,'/').replace(/:/g,'\\:').replace(/'/g,"\\'")}`);
      audit={...audit,artisticModel:true,engine:plan.policy,release:'beta_reference_grammar_not_V16_certified',acceptedCues:plan.cues.length,held:plan.held};
    } else if(modelId==='social-kinetic-v28') {
      assertSafeTimeline(timeline,meta);
      const plan=buildSocialKineticV28Plan({analysis,timeline,frameProof,editorialEvents});
      if(plan.status!=='staging_renderable')throw new RenderError('VERIFIED_EVIDENCE_REQUIRED','V28 attend des mots réels alignés et une preuve indépendante de placement.',{reason:plan.reason,held:plan.held});
      const result=await renderSocialKineticV28Staging({inputPath:sourcePath,outputPath,timeline,plan,workDir:work,onProgress});
      return {outputPath,audit:{...audit,...result,artisticModel:true,engine:'social-kinetic-v28',release:'staging_qa_required'},metadata:await probeVideo(outputPath,{signal})};
    }
    await onProgress(30,known?'Rendu du moteur de référence en laboratoire':'Conversion MP4 du rush original');
    await run('ffmpeg',['-hide_banner','-loglevel','error','-nostdin','-y','-protocol_whitelist','file,pipe','-format_whitelist','mov,matroska,webm,avi,mpegts,ogg','-i',sourcePath,
      '-map','0:v:0',...(meta.hasAudio?['-map','0:a:0']:['-an']),'-map_metadata','-1',
      '-vf',filters.join(','),'-c:v','libx264','-preset','veryfast','-crf','19','-pix_fmt','yuv420p','-threads','2',
      ...(meta.hasAudio?['-c:a','aac','-b:a','192k']:[]),'-movflags','+faststart',outputPath],{signal});
    const output=await probeVideo(outputPath,{signal});
    if(output.videoCodec!=='h264'||(meta.hasAudio&&output.audioCodec!=='aac')||output.audioStreams>(meta.hasAudio?1:0)||Math.abs(output.durationMs-meta.durationMs)>150)
      throw new RenderError('OUTPUT_QA_FAILED','La vérification des pistes ou de la durée du MP4 a échoué.');
    await onProgress(100,'MP4 vérifié');
    return {outputPath,bytes:(await stat(outputPath)).size,metadata:output,audit};
  } catch(error) {await rm(outputPath,{force:true}).catch(()=>{});throw error;}
  finally {await rm(work,{recursive:true,force:true}).catch(()=>{});}
}
