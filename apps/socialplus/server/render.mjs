import {transcribeLocal,transcriptionKey} from './transcription.mjs';
export {transcriptionKey};
import {mapOriginalToOutput} from '../../worker/src/edit.js';
import {prepareRestoredOverlay,RESTORED_PREVIEWS} from './restored-models.mjs';
import {spawn} from 'node:child_process';
import {createReadStream} from 'node:fs';
import {createHash} from 'node:crypto';
import {acousticReport,buildLocalEdit} from './local-edit.mjs';
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
  {id:'codie-omni-v60',label:'Codie × OMNI',version:'V60',status:'component_preview',previewAvailable:true,sourceAvailable:true,available:false,
    reason:'Script V60 restauré. Les icônes originales sont testables sur vos mots alignés et vos zones validées. La recette complète V60 attend encore ses médias de référence.',
    missingSources:['EDITPLUS_V60_FINITION_OMNI.mp4','EDITPLUS_V60_FINITION_PACK_QA.zip : médias V57/V58/V59 et rush original']},
  {id:'alex-hormozi-v16',label:'Alex Hormozi',version:'V16',status:'beta',sourceAvailable:true,available:false,
    reason:'Code OMNI de référence retrouvé. Pack V16 et recette sur trois nouveaux rushs nécessaires avant activation.',
    sourceBranch:'editplus-alex-reference-lock-20261017',engineVersion:'hormozi-omni-explainer-v1',
    missingSources:['EDITPLUS_HORMOZI_V16_RETOUR_V11_PACK.zip']},
  {id:'leila-hormozi-v53',label:'Leila Hormozi',version:'V53',status:'component_preview',previewAvailable:true,sourceAvailable:true,available:false,
    reason:'Scripts V53/V51/V46 restaurés. Les titres muraux sont testables sur un nouveau rush ; le rendu V53 intégral dépend encore des médias V44/V49.',
    missingSources:['IMG_0516.mp4','EDITPLUS_LEILA_IMG_0516_V44_MUR_ANCRE_PREMIUM.mp4','EDITPLUS_LEILA_IMG_0516_V49_RETOUCHES_FINALES_IPHONE.mp4','EDITPLUS_LEILA_IMG_0516_V53_RACCORDS_AFFINES.mp4']},
  {id:'social-kinetic-v28',label:'Social Kinetic',version:'V28',status:'beta',sourceAvailable:true,available:false,
    reason:'Moteur V28 retrouvé. Nécessite Hyperframes local, mots alignés et preuve indépendante de placement ; recette réelle en attente.',
    sourceBranch:'editplus-integrate-social-kinetic-v28-20261018',engineVersion:'28',missingSources:[]},
  {id:'apple-premium-spatial',label:'Apple Premium / Spatial UI',version:'V10',status:'component_preview',previewAvailable:true,sourceAvailable:true,available:false,
    reason:'Scripts Spatial V8/V9/V10 restaurés. Le composant titre V10 est testable ; la chaîne historique complète nécessite encore les médias V8/V9 et le master V10.',
    missingSources:['MODELE05_V10_SAUVEGARDE_COMPLETE.zip : médias V8/V9, rush et master V10']},
  {id:'cinematic-storytelling-v7',label:'Cinematic Storytelling',version:'V7 finale',status:'reference_only',sourceAvailable:true,referenceMediaRequired:true,available:false,
    reason:'Le master approuvé utilise Python + FFmpeg. Le prototype Hyperframes V2 retrouvé ne le remplace pas.',
    missingSources:['CINEMATIC_STORYTELLING_V7_PROJET_COMPLET.zip : médias','IMG_0506(2).mp4','IMG_0506_CINEMATIC_V6_APPLE_MINIMAL_IPHONE.mp4','IMG_0506_CINEMATIC_V7_PREMIUM_FINAL_IPHONE.mp4']}
].map(m=>({...m,available:true,previewAvailable:true,status:'beta',sourceAvailable:true,referenceAvailable:true,releaseApproved:false,missingSources:[],reason:'Adaptation nouveau rush en bêta, avec mots alignés et zones relues. Fidélité au master et synchronisation à vérifier avant publication.'})));

export const TECHNICAL_EXPORT = Object.freeze({id:'technical-export',label:'Exporter la source en MP4',status:'available',available:true,
  reason:'Conversion H.264/AAC du rush original, sans montage artistique ni mots inventés.'});

export class RenderError extends Error {
  constructor(code,message,details={}) {super(message);this.name='RenderError';this.code=code;this.details=details;this.status=code==='TOOL_UNAVAILABLE'?503:code==='RENDER_TIMEOUT'?504:code==='LOCAL_RENDER_LIMIT'?413:422;}
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
    child.stderr.on('data',b=>{stderr=(stderr+b.toString()).slice(-maxOutput);});
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

export async function analyzeSource(sourcePath,{signal}={}) {
  const metadata=await probeVideo(sourcePath,{signal});
  if(metadata.durationMs>600_000||metadata.width*metadata.height>3840*2160)throw new RenderError('LOCAL_RENDER_LIMIT','L’analyse locale accepte jusqu’à 10 minutes en 4K.');
  const hash=createHash('sha256');for await(const chunk of createReadStream(sourcePath))hash.update(chunk);
  let log='';
  if(metadata.hasAudio)({stderr:log}=await run('ffmpeg',['-hide_banner','-nostdin','-protocol_whitelist','file,pipe','-format_whitelist','mov,matroska,webm,avi,mpegts,ogg','-i',sourcePath,'-map','0:a:0','-vn','-af','silencedetect=noise=-35dB:d=0.25,volumedetect','-f','null','-'],{signal,timeoutMs:120_000}));
  return acousticReport(log,metadata,hash.digest('hex'));
}

export async function transcribeSource(sourcePath,{signal}={}){
 const meta=await probeVideo(sourcePath,{signal});
 if(!meta.hasAudio)throw new RenderError('ORIGINAL_AUDIO_REQUIRED','Aucune piste audio à transcrire.');
 if(meta.durationMs>600_000)throw new RenderError('LOCAL_RENDER_LIMIT','La transcription locale accepte jusqu’à dix minutes.');
 return transcribeLocal(sourcePath,{run,signal});
}

function assertSafeTimeline(timeline,meta) {
  if(!timeline||timeline.audio?.hasAudio!==meta.hasAudio||Math.abs(timeline.outputDurationMs-meta.durationMs)>65||
    timeline.export?.width!==meta.width||timeline.export?.height!==meta.height||
    timeline.keepRanges?.length!==1||timeline.keepRanges[0].startMs!==0||Math.abs(timeline.keepRanges[0].endMs-meta.durationMs)>65)
    throw new RenderError('SOURCE_TIMELINE_REQUIRED','Ce raccord conserve le rush intégral et son format natif. Une table de coupes validée doit être intégrée séparément.');
}

/** Trusted server paths only: never pass a client-supplied path or shell text. */
export async function renderVideo({sourcePath,outputPath,modelId,analysis,timeline,frameProof,editorialEvents,localEdit,restoredInput,renderCaptions=true,onProgress=async()=>{},signal}={}) {
  const preview=typeof modelId==='string'&&modelId.startsWith('restored-preview:')?modelId.slice('restored-preview:'.length):restoredInput&&RESTORED_PREVIEWS.includes(modelId)?modelId:null;
  if(preview&&!RESTORED_PREVIEWS.includes(preview))throw new RenderError('UNKNOWN_MODEL','Port de composants inconnu.');
  const known=MODEL_CATALOG.find(m=>m.id===modelId);
  if(modelId!==TECHNICAL_EXPORT.id&&modelId!=='guided-edit'&&!preview&&!known)throw new RenderError('UNKNOWN_MODEL','Modèle inconnu.');
  if(known?.referenceMediaRequired&&!preview)throw new RenderError('MODEL_REFERENCE_MEDIA_REQUIRED','Le script V7 restauré nécessite encore le rush IMG_0506(2).mp4 et la vidéo V6 IMG_0506_CINEMATIC_V6_APPLE_MINIMAL_IPHONE.mp4.');
  if(known?.sourceAvailable===false)throw new RenderError('MODEL_SOURCE_MISSING',known.reason,{missingSources:known.missingSources});
  if(known&&!preview&&process.env.SOCIALPLUS_BETA_RENDER!=='staging')
    throw new RenderError('MODEL_QA_REQUIRED',known.reason,{modelId,status:known.status});
  let meta=await probeVideo(sourcePath,{signal});
  if(meta.durationMs>600_000||meta.width*meta.height>3840*2160)
    throw new RenderError('LOCAL_RENDER_LIMIT','Le rendu local accepte jusqu’à 10 minutes et une définition 4K.');
  if(known&&!meta.hasAudio)throw new RenderError('ORIGINAL_AUDIO_REQUIRED','Le moteur nécessite la piste de voix originale.');
  const work=await mkdtemp(path.join(tmpdir(),'socialplus-render-'));
  try {
    await onProgress(10,'Vérification du fichier source');
    const filters=['scale=trunc(iw/2)*2:trunc(ih/2)*2','setsar=1'];
    let expectedDurationMs=meta.durationMs;
    let inputLabels=null,complex=null,restoredOverlay=null;
    let audit={modelId,artisticModel:false,engine:'ffmpeg-native-export-v1',cuts:0,source:meta,originalAudioStreamsSelected:meta.hasAudio?1:0};
    if(preview){
      if(localEdit?.approvedPauseIds?.length){
        const edit=buildLocalEdit(localEdit),editedPath=path.join(work,'edited-source.mp4');
        const result=await renderVideo({sourcePath,outputPath:editedPath,modelId:'guided-edit',localEdit,renderCaptions:false,signal});
        sourcePath=editedPath;meta=result.metadata;expectedDurationMs=meta.durationMs;
        restoredInput={...restoredInput,transcript:restoredInput.transcript.map(w=>({...w,startMs:mapOriginalToOutput(typeof w.startMs==='number'?w.startMs:Math.round(w.start*1000),edit.keepRanges),endMs:mapOriginalToOutput(typeof w.endMs==='number'?w.endMs:Math.round(w.end*1000),edit.keepRanges)})),events:restoredInput.events.map(e=>({...e,...(typeof e.endMs==='number'?{endMs:mapOriginalToOutput(e.endMs,edit.keepRanges)??undefined}:{})}))};
        audit={...audit,cuts:edit.cuts.length,keepRanges:edit.keepRanges};
      }
      const {plan,overlayPath,graphicAss}=await prepareRestoredOverlay({model:preview,meta,input:restoredInput,work,run,signal});
      restoredOverlay=overlayPath;
      if(overlayPath){complex=['[0:v:0][1:v:0]overlay=0:0:format=auto:eof_action=pass:repeatlast=0[cutv]'];inputLabels=true;}
      if(graphicAss){const assPath=path.join(work,'graphics.ass');await writeFile(assPath,graphicAss);filters.push(`ass=filename='${assPath.replace(/\\/g,'/').replace(/:/g,'\\:')}'`);}
      if(plan.ass){const assPath=path.join(work,'captions.ass');await writeFile(assPath,plan.ass);filters.push(`ass=filename='${assPath.replace(/\\/g,'/').replace(/:/g,'\\:')}'`);}
      audit={...audit,engine:'socialplus-model-adapter-v2',release:'beta_not_master_certified',restoredModel:preview,eventCount:plan.events.length,placement:'user_reviewed',font:'Inter or system fallback'};
    }else if(modelId==='guided-edit') {
      const edit=buildLocalEdit(localEdit);
      if(edit.outputDurationMs<500)throw new RenderError('INVALID_EDIT','Le montage doit conserver au moins une demi-seconde.');
      expectedDurationMs=edit.outputDurationMs;
      if(edit.cuts.length){
        // Keep source frame timestamps mapped through the edit, instead of
        // paired A/V concat (which pads audio to every rounded video segment).
        const drop=edit.cuts.map(c=>`between(t,${c.startMs/1000},${c.endMs/1000})`).join('+');
        const removed=edit.cuts.map(c=>`gte(T,${c.endMs/1000})*${(c.endMs-c.startMs)/1000}`).join('+');
        const graphs=[`[0:v:0]setpts=PTS-STARTPTS,select='not(${drop})',setpts='PTS-(${removed})/TB'[cutv]`];
        if(meta.hasAudio){
          edit.keepRanges.forEach((r,i)=>graphs.push(`[0:a:0]atrim=start=${r.startMs/1000}:end=${r.endMs/1000},asetpts=PTS-STARTPTS[a${i}]`));
          graphs.push(edit.keepRanges.map((_,i)=>`[a${i}]`).join('')+`concat=n=${edit.keepRanges.length}:v=0:a=1[outa]`);
        }
        complex=graphs;inputLabels=true;
      }
      if(edit.ass&&renderCaptions){const assPath=path.join(work,'captions.ass');await writeFile(assPath,edit.ass,'utf8');filters.push(`ass=filename='${assPath.replace(/\\/g,'/').replace(/:/g,'\\:').replace(/'/g,"\\'")}'`);}
      audit={...audit,engine:'local-guided-edit-v1',cuts:edit.cuts.length,keepRanges:edit.keepRanges,captionCount:edit.captions.length,approval:'user_reviewed_acoustic_pauses',sourceFingerprint:localEdit.report.fingerprint};
    } else if(modelId==='alex-hormozi-v16') {
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
    const copyAudio=meta.audioCodec==='aac'&&(!complex||Boolean(restoredOverlay));
    audit={...audit,audioMode:copyAudio?'source_aac_passthrough':'source_aac_encode',captionReview:restoredInput?.captionsReviewed?'confirmed':restoredInput?.allowUnreviewedPreview?'asr_preview':'not_supplied'};
    await onProgress(30,known?'Rendu du moteur de référence en laboratoire':'Conversion MP4 du rush original');
    if(complex)complex.push('[cutv]'+filters.join(',')+'[outv]');
    await run('ffmpeg',['-hide_banner','-loglevel','error','-nostdin','-y','-protocol_whitelist','file,pipe','-format_whitelist','mov,matroska,webm,avi,mpegts,ogg','-i',sourcePath,...(restoredOverlay?['-i',restoredOverlay]:[]),
      ...(inputLabels?['-filter_complex',complex.join(';'),'-map','[outv]',...(meta.hasAudio?['-map',restoredOverlay?'0:a:0':'[outa]']:['-an'])]:['-map','0:v:0',...(meta.hasAudio?['-map','0:a:0']:['-an']),'-vf',filters.join(',')]),'-map_metadata','-1','-c:v','libx264','-preset','veryfast','-crf','19','-pix_fmt','yuv420p','-threads','2',
      ...(meta.hasAudio?(copyAudio?['-c:a','copy']:['-c:a','aac','-b:a','192k']):[]),'-fps_mode','vfr','-movflags','+faststart',outputPath],{signal});
    const output=await probeVideo(outputPath,{signal});
    if(output.videoCodec!=='h264'||(meta.hasAudio&&output.audioCodec!=='aac')||output.audioStreams>(meta.hasAudio?1:0)||Math.abs(output.durationMs-expectedDurationMs)>Math.max(150,(audit.cuts||0)*40))
      throw new RenderError('OUTPUT_QA_FAILED','La vérification des pistes ou de la durée du MP4 a échoué.');
    await onProgress(100,'MP4 vérifié');
    return {outputPath,bytes:(await stat(outputPath)).size,metadata:output,audit};
  } catch(error) {await rm(outputPath,{force:true}).catch(()=>{});throw error;}
  finally {await rm(work,{recursive:true,force:true}).catch(()=>{});}
}
