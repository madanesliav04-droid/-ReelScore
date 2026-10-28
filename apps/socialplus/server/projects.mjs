import {assertKineticRelease,reviewedKineticDirection,transcriptFingerprint,KINETIC_RELEASE} from './kinetic-release.mjs';
import {editorialIndicators} from './editorial-analysis.mjs';
import {planCinematic,cinematicReviewItems} from './cinematic-plan.mjs';
import {RESTORED_PREVIEWS,restoredPlan} from './restored-models.mjs';
import {buildLocalEdit,SIGNAL_VERSION} from './local-edit.mjs';
import { randomUUID, createHash } from 'node:crypto';
import { createReadStream, createWriteStream, statSync } from 'node:fs';
import { mkdir, rm, stat, rename, readdir } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { Transform } from 'node:stream';

const fail = (status, code, message) => Object.assign(new Error(message), { status, code });
const now = () => new Date().toISOString();

export function createProjects({ db, dataDir, render, maxUploadBytes = 200 * 1024 * 1024, maxUserBytes = 1024 * 1024 * 1024, maxRendersPerDay = 10 }) {
  if(!Number.isSafeInteger(maxRendersPerDay)||maxRendersPerDay<0||maxRendersPerDay>1000)throw new Error('SOCIALPLUS_MAX_RENDERS_PER_DAY doit être un entier entre 0 et 1000.');
  const mediaDir = resolve(dataDir, 'media');
  db.exec(`CREATE TABLE IF NOT EXISTS studio_projects (
    id TEXT PRIMARY KEY, user_id TEXT NOT NULL, name TEXT NOT NULL, style_id TEXT,
    state TEXT NOT NULL DEFAULT 'draft', source_name TEXT, source_path TEXT, source_bytes INTEGER DEFAULT 0,
    metadata TEXT, output_path TEXT, output_bytes INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS studio_project_owner ON studio_projects(user_id,updated_at);
  CREATE TABLE IF NOT EXISTS studio_jobs (
    id TEXT PRIMARY KEY, project_id TEXT NOT NULL, user_id TEXT NOT NULL, model_id TEXT NOT NULL,
    state TEXT NOT NULL, progress REAL NOT NULL DEFAULT 0, error_code TEXT, error_message TEXT,
    audit TEXT, created_at TEXT NOT NULL, completed_at TEXT
  ); CREATE INDEX IF NOT EXISTS studio_job_owner ON studio_jobs(user_id,created_at);
  CREATE TABLE IF NOT EXISTS studio_transcripts(project_id TEXT PRIMARY KEY,user_id TEXT NOT NULL,source_path TEXT NOT NULL,engine_key TEXT NOT NULL,result TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS studio_signal_reports(project_id TEXT PRIMARY KEY,user_id TEXT NOT NULL,source_path TEXT NOT NULL,engine_version TEXT NOT NULL,report TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS studio_render_usage(user_id TEXT NOT NULL,day TEXT NOT NULL,started_count INTEGER NOT NULL,PRIMARY KEY(user_id,day));`);
  if(!db.prepare('PRAGMA table_info(studio_projects)').all().some(x=>x.name==='output_bytes'))db.exec('ALTER TABLE studio_projects ADD COLUMN output_bytes INTEGER NOT NULL DEFAULT 0');
  db.exec(`CREATE TABLE IF NOT EXISTS studio_render_requests(
    job_id TEXT PRIMARY KEY,user_id TEXT NOT NULL,project_id TEXT NOT NULL,source_path TEXT NOT NULL,
    output_path TEXT NOT NULL,payload TEXT NOT NULL,request_key TEXT,payload_hash TEXT NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 1,engine_version TEXT NOT NULL,elapsed_ms INTEGER NOT NULL DEFAULT 0);
    CREATE UNIQUE INDEX IF NOT EXISTS studio_request_key ON studio_render_requests(user_id,request_key) WHERE request_key IS NOT NULL;`);
  const PIPELINE_VERSION='socialplus-render-orchestrator-v2';
  db.prepare("UPDATE studio_jobs SET state='failed',error_code='PROCESS_INTERRUPTED',error_message='Ancienne tâche interrompue sans paramètres récupérables. Relancez ce montage.' WHERE state IN ('queued','rendering') AND id NOT IN(SELECT job_id FROM studio_render_requests)").run();
  db.prepare("UPDATE studio_projects SET state='ready' WHERE state='rendering' AND id NOT IN(SELECT project_id FROM studio_jobs WHERE state IN ('queued','rendering'))").run();
  db.exec('CREATE TABLE IF NOT EXISTS studio_media_cleanup(path TEXT PRIMARY KEY,user_id TEXT NOT NULL,queued_at TEXT NOT NULL)');
  const fileAvailable=path=>{try{const f=statSync(path);return f.isFile()&&f.size>0;}catch{return false;}};
  async function retireMedia(paths,userId,{strict=false}={}){
    const pending=[...new Set(paths.filter(Boolean))];
    for(const path of pending){
      db.prepare('INSERT OR IGNORE INTO studio_media_cleanup VALUES(?,?,?)').run(path,userId,now());
      try{await rm(path,{force:true});db.prepare('DELETE FROM studio_media_cleanup WHERE path=?').run(path);}catch{/* Never roll back a valid replacement because old-file cleanup failed. */}
    }
    if(strict&&db.prepare('SELECT count(*) n FROM studio_media_cleanup WHERE user_id=?').get(userId).n)throw fail(503,'CLEANUP_PENDING','Suppression physique en attente. Réessayez avant de considérer vos données supprimées.');
  }
  let stopping=false;
  const activeJobs=new Map();
  let running = false;
  const uploading = new Set();
  const uploadingUsers = new Set();
  const publicProject = p => ({ latestJob:latestPublicJob(p), id: p.id, name: p.name, style_id: p.style_id, state: p.state==='complete'&&!fileAvailable(p.output_path)?'ready':p.state, source_name: p.source_name, source_bytes: p.source_bytes, metadata: p.metadata ? JSON.parse(p.metadata) : null, has_source: fileAvailable(p.source_path), has_output: fileAvailable(p.output_path), created_at: p.created_at, updated_at: p.updated_at });
  function latestPublicJob(p){
    const j=db.prepare('SELECT id,state,progress,error_message FROM studio_jobs WHERE project_id=? AND user_id=? ORDER BY created_at DESC,rowid DESC LIMIT 1').get(p.id,p.user_id);
    return j?.state==='complete'&&!fileAvailable(p.output_path)?{...j,state:'failed',progress:0,error_message:'Le MP4 final est absent. Reprenez ce projet.'}:j||null;
  }
  const get = (userId, id) => { const p = db.prepare('SELECT * FROM studio_projects WHERE id=? AND user_id=?').get(id,userId); if (!p) throw fail(404,'PROJECT_NOT_FOUND','Projet introuvable.'); return p; };
  const list = userId => db.prepare('SELECT * FROM studio_projects WHERE user_id=? ORDER BY updated_at DESC LIMIT 100').all(userId).map(publicProject);
  const create = (userId, input = {}) => {
    if (db.prepare('SELECT count(*) AS n FROM studio_projects WHERE user_id=?').get(userId).n >= 100) throw fail(429,'PROJECT_QUOTA','La limite de 100 projets est atteinte.');
    const id = randomUUID(), time = now(), name = String(input.name || 'Nouveau montage').trim().slice(0,160);
    db.prepare('INSERT INTO studio_projects(id,user_id,name,created_at,updated_at) VALUES(?,?,?,?,?)').run(id,userId,name,time,time);
    return publicProject(get(userId,id));
  };
  const update = (userId,id,input) => {
    get(userId,id);
    if (input.style_id && !render.MODEL_CATALOG.some(m=>m.id===input.style_id) && !['technical-export','guided-edit'].includes(input.style_id)) throw fail(400,'UNKNOWN_MODEL','Modèle inconnu.');
    db.prepare('UPDATE studio_projects SET name=COALESCE(?,name),style_id=COALESCE(?,style_id),updated_at=? WHERE id=? AND user_id=?').run(input.name == null ? null : String(input.name).trim().slice(0,160),input.style_id||null,now(),id,userId);
    return publicProject(get(userId,id));
  };
  async function upload(userId,id,req) {
    const project = get(userId,id);
    if (project.state === 'rendering' || uploading.has(id) || uploadingUsers.has(userId)) throw fail(409,'PROJECT_BUSY','Un import ou traitement est déjà en cours.');
    if (!/^video\//i.test(req.headers['content-type']||'') && req.headers['content-type']!=='application/octet-stream') throw fail(415,'MEDIA_TYPE','Choisissez un fichier vidéo.');
    const used = db.prepare('SELECT COALESCE(sum(source_bytes+output_bytes),0) AS n FROM studio_projects WHERE user_id=?').get(userId).n;
    const available = Math.min(maxUploadBytes,maxUserBytes-used+project.source_bytes+project.output_bytes);
    if (Number(req.headers['content-length']||0)>available || available<=0) throw fail(413,'UPLOAD_QUOTA','La vidéo dépasse la limite de stockage disponible.');
    uploading.add(id);
    uploadingUsers.add(userId);
    const path = join(mediaDir, randomUUID()+'.source'), partial = path+'.part';
    const sourceHash=createHash('sha256');
    let bytes = 0,committed=false;
    try {
      await mkdir(mediaDir,{recursive:true,mode:0o700});
      await pipeline(req, new Transform({transform(chunk,encoding,callback) { bytes+=chunk.length; sourceHash.update(chunk); callback(bytes>available ? fail(413,'UPLOAD_QUOTA','Fichier trop volumineux (200 Mo maximum).') : null,chunk); }}),createWriteStream(partial,{flags:'wx',mode:0o600}));
      const metadata = {...await render.probeVideo(partial),sourceSha256:sourceHash.digest('hex')};
      await rename(partial,path);
      let name = 'Vidéo importée';
      try { name = decodeURIComponent(req.headers['x-filename']||name).slice(0,160); } catch {}
      const saved=db.prepare("UPDATE studio_projects SET source_path=?,source_name=?,source_bytes=?,metadata=?,output_path=NULL,output_bytes=0,state='ready',updated_at=? WHERE id=? AND user_id=?").run(path,name,bytes,JSON.stringify(metadata),now(),id,userId);
      if(saved.changes!==1)throw fail(410,'PROJECT_REMOVED','Le projet ou le compte a été supprimé pendant cet import.');
      committed=true;
      db.prepare('DELETE FROM studio_transcripts WHERE project_id=? AND user_id=?').run(id,userId);
      db.prepare('DELETE FROM studio_signal_reports WHERE project_id=? AND user_id=?').run(id,userId);
      await retireMedia([project.source_path,project.output_path],userId);
      return publicProject(get(userId,id));
    } catch(error) { await rm(partial,{force:true}).catch(()=>{}); if(!committed)await rm(path,{force:true}).catch(()=>{}); throw error; }
    finally { uploading.delete(id); uploadingUsers.delete(userId); }
  }
  function signalReport(userId,id){
    const p=get(userId,id);
    const row=db.prepare('SELECT report FROM studio_signal_reports WHERE project_id=? AND user_id=? AND source_path=? AND engine_version=?').get(id,userId,p.source_path,SIGNAL_VERSION);
    return row?JSON.parse(row.report):null;
  }
  async function analyze(userId,id){
    const p=get(userId,id);if(!p.source_path)throw fail(409,'SOURCE_REQUIRED','Importez d’abord une vidéo.');
    const cached=signalReport(userId,id);if(cached)return cached;
    if(running||uploading.has(id)||uploadingUsers.has(userId))throw fail(409,'RENDER_BUSY','Un traitement est déjà en cours.');
    const day=now().slice(0,10);
    const used=db.prepare('SELECT started_count FROM studio_render_usage WHERE user_id=? AND day=?').get(userId,day)?.started_count||0;
    if(used>=maxRendersPerDay)throw fail(429,'DAILY_RENDER_QUOTA',`La limite de ${maxRendersPerDay} traitement(s) par jour est atteinte.`);
    db.prepare('INSERT INTO studio_render_usage VALUES(?,?,1) ON CONFLICT(user_id,day) DO UPDATE SET started_count=started_count+1').run(userId,day);
    running=true;uploading.add(id);
    try{
      const report=await render.analyzeSource(p.source_path);
      if(!db.prepare('SELECT id FROM studio_projects WHERE id=? AND user_id=? AND source_path=?').get(id,userId,p.source_path))throw fail(410,'PROJECT_REMOVED','Ce projet a été supprimé.');
      db.prepare('INSERT OR REPLACE INTO studio_signal_reports VALUES(?,?,?,?,?)').run(id,userId,p.source_path,SIGNAL_VERSION,JSON.stringify(report));
      return report;
    }finally{running=false;uploading.delete(id);}
  }
  function transcript(userId,id){
    const p=get(userId,id),row=db.prepare('SELECT result FROM studio_transcripts WHERE project_id=? AND user_id=? AND source_path=?').get(id,userId,p.source_path);
    return row?JSON.parse(row.result):null;
  }
  function kineticDirection(userId,id,input={}){
    const p=get(userId,id);if(!p.source_path)throw fail(409,'SOURCE_REQUIRED','Importez d’abord une vidéo.');
    const words=input.transcript??transcript(userId,id)?.words;
    const reviewed=reviewedKineticDirection(JSON.parse(p.metadata),words);
    if(reviewed.direction)return reviewed;
    const saved=db.prepare('SELECT payload FROM studio_render_requests WHERE user_id=? AND project_id=? AND source_path=? ORDER BY rowid DESC').all(userId,id,p.source_path);
    for(const row of saved){const execution=JSON.parse(row.payload),prior=execution.restoredInput;if(execution.kineticRelease===KINETIC_RELEASE&&prior?.kineticDirection&&(prior.transcriptFingerprint??transcriptFingerprint(prior.transcript))===transcriptFingerprint(words))return {release:KINETIC_RELEASE,direction:prior.kineticDirection,notice:'Direction préparée précédemment pour ce projet. Vérifiez les placements et les paroles avant un nouvel export.'};}
    return reviewed;
  }
  async function transcribe(userId,id){
    const p=get(userId,id);if(!p.source_path)throw fail(409,'SOURCE_REQUIRED','Importez d’abord une vidéo.');
    const key=render.transcriptionKey?.();
    if(!key)throw fail(503,'ASR_NOT_CONFIGURED','La transcription locale nécessite un modèle Whisper installé sur cette machine.');
    const row=db.prepare('SELECT result FROM studio_transcripts WHERE project_id=? AND user_id=? AND source_path=? AND engine_key=?').get(id,userId,p.source_path,key);
    if(row)return JSON.parse(row.result);
    if(running||uploading.has(id)||uploadingUsers.has(userId))throw fail(409,'RENDER_BUSY','Un traitement est déjà en cours.');
    const day=now().slice(0,10),used=db.prepare('SELECT started_count FROM studio_render_usage WHERE user_id=? AND day=?').get(userId,day)?.started_count||0;
    if(used>=maxRendersPerDay)throw fail(429,'DAILY_RENDER_QUOTA','La limite quotidienne de traitements est atteinte.');
    db.prepare('INSERT INTO studio_render_usage VALUES(?,?,1) ON CONFLICT(user_id,day) DO UPDATE SET started_count=started_count+1').run(userId,day);
    running=true;uploading.add(id);
    try{
      const result=await render.transcribeSource(p.source_path);
      if(!db.prepare('SELECT id FROM studio_projects WHERE id=? AND user_id=? AND source_path=?').get(id,userId,p.source_path))throw fail(410,'PROJECT_REMOVED','Ce projet a été supprimé.');
      db.prepare('INSERT OR REPLACE INTO studio_transcripts VALUES(?,?,?,?,?)').run(id,userId,p.source_path,key,JSON.stringify(result));
      return result;
    }finally{running=false;uploading.delete(id);}
  }
  async function editorial(userId,id,input={}){
    const report=await analyze(userId,id);
    let speech=transcript(userId,id);
    if(!speech&&render.transcriptionKey?.())speech=await transcribe(userId,id);
    return editorialIndicators(report,speech,{goal:['awareness','community','leads'].includes(input.goal)?input.goal:'awareness'});
  }
  function startRender(userId,id,input) {
    const p = get(userId,id), modelId = input.modelId || input.style_id || p.style_id;
    render.assertModelAllowed?.(modelId);
    if (!p.source_path||!fileAvailable(p.source_path)) throw fail(409,'SOURCE_REQUIRED','La source est absente. Importez une vidéo avant de continuer.');
    const requestKey=input.requestId??null;
    if(requestKey!==null&&(typeof requestKey!=='string'||!/^[-_a-zA-Z0-9]{16,128}$/.test(requestKey)))throw fail(422,'INVALID_REQUEST_ID','Identifiant de tentative invalide.');
    const stable=value=>Array.isArray(value)?value.map(stable):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(k=>[k,stable(value[k])])):value;
    const {requestId:ignoredRequestId,...hashInput}=input;
    const payloadHash=createHash('sha256').update(JSON.stringify(stable(hashInput))).digest('hex');
    if(requestKey){const existing=db.prepare('SELECT * FROM studio_render_requests WHERE user_id=? AND request_key=?').get(userId,requestKey);
      if(existing){if(existing.project_id!==id||existing.source_path!==p.source_path||existing.payload_hash!==payloadHash)throw fail(409,'REQUEST_CONFLICT','Cette tentative appartient à un autre fichier ou à des réglages différents.');return job(userId,existing.job_id);}}
    if (stopping||running || uploading.has(id)) throw fail(409,'RENDER_BUSY','Un traitement est en cours. Réessayez après sa fin.');
    const model = render.MODEL_CATALOG.find(x=>x.id===modelId);
    const preview=typeof modelId==='string'&&modelId.startsWith('restored-preview:')?modelId.slice('restored-preview:'.length):null;
    const isPreview=RESTORED_PREVIEWS.includes(preview)||RESTORED_PREVIEWS.includes(modelId);
    const restoredModel=preview||modelId;
    if (!['technical-export','guided-edit'].includes(modelId) && !isPreview && (!model || !model.available)) throw fail(422,'MODEL_UNAVAILABLE',model?.reason||'Le moteur de ce modèle est indisponible.');
    if(restoredModel==='social-kinetic-v28'){
      assertKineticRelease();
      if(!input.kineticDirection||Array.isArray(input.kineticDirection))throw fail(422,'KINETIC_DIRECTION_REQUIRED','La V28 verrouillée exige une direction contextuelle. Préparez le montage et vérifiez Animations avancées. Aucun preset générique ne sera lancé.');
    }
    let localEdit,restoredInput;
    if(isPreview&&restoredModel==='cinematic-storytelling-v7'){
      if(input.placementReviewed!==true)throw fail(422,'PLACEMENT_REVIEW_REQUIRED','Confirmez les séquences graphiques plein écran avant de lancer Cinematic.');
      const report=signalReport(userId,id);
      if(!report)throw fail(409,'SOURCE_ANALYSIS_REQUIRED','Préparez automatiquement ce modèle ou analysez ce rush avant de lancer Cinematic.');
      restoredInput=planCinematic(report,{words:input.transcript,captionsReviewed:input.captionsReviewed===true},{preview:input.allowUnreviewedPreview===true});
      localEdit={report,approvedPauseIds:restoredInput.approvedPauseIds,transcript:restoredInput.transcript,captionsReviewed:restoredInput.captionsReviewed,previewOnly:restoredInput.allowUnreviewedPreview};
    }
    if(isPreview&&restoredModel!=='cinematic-storytelling-v7'){restoredInput={transcript:input.transcript,captionsReviewed:input.captionsReviewed===true,allowUnreviewedPreview:input.allowUnreviewedPreview===true,events:input.events,captionZones:input.captionZones,...(restoredModel==='social-kinetic-v28'&&input.kineticDirection?{kineticDirection:input.kineticDirection}:{}),placementReviewed:input.placementReviewed===true};restoredPlan(restoredModel,JSON.parse(p.metadata),restoredInput);
      if(input.approvedPauseIds?.length){const report=signalReport(userId,id);if(!report)throw fail(409,'SOURCE_ANALYSIS_REQUIRED','Analysez cette source avant de couper ses pauses.');localEdit={report,approvedPauseIds:input.approvedPauseIds,transcript:input.transcript,captionsReviewed:input.captionsReviewed===true,previewOnly:input.allowUnreviewedPreview===true};buildLocalEdit(localEdit);}}
    if(modelId==='guided-edit'){
      const report=signalReport(userId,id);
      if(!report)throw fail(409,'SOURCE_ANALYSIS_REQUIRED','Analysez cette source avant de lancer le montage.');
      localEdit={report,approvedPauseIds:input.approvedPauseIds,transcript:input.transcript,captionsReviewed:input.captionsReviewed===true,previewOnly:input.allowUnreviewedPreview===true};
      buildLocalEdit(localEdit);
    }
    const jobId = randomUUID(), outputPath = join(mediaDir,randomUUID()+'.mp4');
    const execution={modelId,...(restoredModel==='social-kinetic-v28'?{kineticRelease:KINETIC_RELEASE}:{}),localEdit,restoredInput,captionCues:input.captionCues,analysis:input.analysis,timeline:input.timeline,frameProof:input.frameProof,editorialEvents:input.editorialEvents};
    db.exec('BEGIN IMMEDIATE');
    try {
      const day=now().slice(0,10);
      const used=db.prepare('SELECT started_count FROM studio_render_usage WHERE user_id=? AND day=?').get(userId,day)?.started_count||0;
      if(used>=maxRendersPerDay)throw fail(429,'DAILY_RENDER_QUOTA',`La limite de ${maxRendersPerDay} traitement(s) par jour est atteinte. Réessayez après minuit UTC.`);
      db.prepare('INSERT INTO studio_render_usage VALUES(?,?,1) ON CONFLICT(user_id,day) DO UPDATE SET started_count=started_count+1').run(userId,day);
      db.prepare("INSERT INTO studio_jobs(id,project_id,user_id,model_id,state,created_at) VALUES(?,?,?,?,'rendering',?)").run(jobId,id,userId,modelId,now());
      db.prepare("UPDATE studio_projects SET state='rendering',style_id=?,updated_at=? WHERE id=?").run(modelId,now(),id);
      db.prepare('INSERT INTO studio_render_requests(job_id,user_id,project_id,source_path,output_path,payload,request_key,payload_hash,engine_version) VALUES(?,?,?,?,?,?,?,?,?)').run(jobId,userId,id,p.source_path,outputPath,JSON.stringify(execution),requestKey,payloadHash,PIPELINE_VERSION);
      db.exec('COMMIT');
    } catch(error){db.exec('ROLLBACK');throw error;}
    launch([{jobId,userId,id,sourcePath:p.source_path,outputPath,execution}]);
    return job(userId,jobId);
  }
  function launch(items){
    running=true;
    // Single local worker: persisted descriptors survive process termination.
    (async()=>{for(const item of items){if(stopping)break;const controller=new AbortController();const promise=execute({...item,signal:controller.signal});activeJobs.set(item.jobId,{userId:item.userId,controller,promise});try{await promise;}finally{activeJobs.delete(item.jobId);}}})().catch(error=>process.stderr.write(JSON.stringify({event:'local_worker_error',code:error.code||'WORKER_FAILED'})+'\n')).finally(()=>{running=false;});
  }
  async function execute({jobId,userId,id,sourcePath,outputPath,execution,signal,recovered=false}){
    const started=performance.now();
    let p,committed=false;
    try{
      p=get(userId,id);
      if(p.source_path!==sourcePath||!fileAvailable(sourcePath))throw fail(409,'SOURCE_CHANGED','Le rush d’origine de cette tâche est indisponible.');
      if(recovered)db.prepare('UPDATE studio_render_requests SET attempts=attempts+1 WHERE job_id=?').run(jobId);
      db.prepare("UPDATE studio_jobs SET state='rendering',progress=0,error_code=NULL,error_message=NULL WHERE id=?").run(jobId);
      db.prepare("UPDATE studio_projects SET state='rendering' WHERE id=? AND user_id=?").run(id,userId);
      if(execution.modelId?.replace('restored-preview:','')==='social-kinetic-v28'){assertKineticRelease();if(execution.kineticRelease!==KINETIC_RELEASE)throw fail(409,'KINETIC_RELEASE_CHANGED','La version de cette tâche n’est plus disponible.');}
      const result=await render.renderVideo({sourcePath,outputPath,...execution,signal,onProgress:value=>db.prepare('UPDATE studio_jobs SET progress=? WHERE id=?').run(Math.min(99,Math.max(0,Number(value)||0)),jobId)});
      const restoredModel=execution.modelId.startsWith('restored-preview:')?execution.modelId.slice(17):execution.modelId;
      const restoredInput=execution.restoredInput;

      // A deleted project must never leave a newly rendered private file behind.
      if (!db.prepare('SELECT id FROM studio_projects WHERE id=? AND user_id=?').get(id,userId)) { await rm(outputPath,{force:true}); return; }
      const info=await stat(outputPath);
      if(!info.isFile()||info.size===0)throw fail(422,'OUTPUT_MISSING','Le moteur n’a pas produit de fichier MP4 exploitable.');
      const bytes=info.size;
      const used=db.prepare('SELECT COALESCE(sum(source_bytes+output_bytes),0) AS n FROM studio_projects WHERE user_id=?').get(userId).n;
      if(used-p.output_bytes+bytes>maxUserBytes)throw fail(413,'STORAGE_QUOTA','Le fichier exporté dépasse votre stockage disponible. Supprimez un ancien projet.');
      const audit=JSON.stringify(restoredModel==='cinematic-storytelling-v7'?{...result,review:cinematicReviewItems(restoredInput),captionStatus:restoredInput.captionStatus,releaseApproved:false}:result||{});
      db.exec('BEGIN IMMEDIATE');
      try{
        const updated=db.prepare("UPDATE studio_projects SET state='complete',output_path=?,output_bytes=?,updated_at=? WHERE id=? AND user_id=?").run(outputPath,bytes,now(),id,userId);
        if(updated.changes!==1){db.exec('ROLLBACK');await retireMedia([outputPath],userId);return;}
        db.prepare("UPDATE studio_jobs SET state='complete',progress=100,audit=?,completed_at=? WHERE id=?").run(audit,now(),jobId);
        db.exec('COMMIT');committed=true;
      }catch(error){if(db.isTransaction)db.exec('ROLLBACK');throw error;}
      if (p.output_path) await retireMedia([p.output_path],userId);
    }catch(error){
      if(committed)return;
      await retireMedia([outputPath],userId);
      db.prepare("UPDATE studio_projects SET state='ready',updated_at=? WHERE id=? AND user_id=?").run(now(),id,userId);
      if(stopping&&signal?.aborted){db.prepare("UPDATE studio_jobs SET state='queued',progress=0,error_code='PROCESS_STOPPED',error_message='Traitement suspendu pour arrêt du serveur ; reprise au prochain lancement.' WHERE id=?").run(jobId);db.prepare("UPDATE studio_projects SET state='rendering' WHERE id=? AND user_id=?").run(id,userId);}
      else db.prepare("UPDATE studio_jobs SET state='failed',error_code=?,error_message=?,completed_at=? WHERE id=?").run(error.code||'RENDER_FAILED',String(error.publicMessage||error.message||'Échec du rendu.').slice(0,500),now(),jobId);
    }finally{
      const state=db.prepare('SELECT state FROM studio_jobs WHERE id=?').get(jobId)?.state;
      if(state&&!['queued','rendering'].includes(state)){
        const retained=state==='complete'&&execution.kineticRelease?{modelId:execution.modelId,kineticRelease:execution.kineticRelease,restoredInput:{kineticDirection:execution.restoredInput.kineticDirection,transcriptFingerprint:transcriptFingerprint(execution.restoredInput.transcript)}}:{};
        db.prepare('UPDATE studio_render_requests SET payload=? WHERE job_id=?').run(JSON.stringify(retained),jobId);
      }
      db.prepare('UPDATE studio_render_requests SET elapsed_ms=elapsed_ms+? WHERE job_id=?').run(Math.max(0,Math.round(performance.now()-started)),jobId);
    }
  }
  async function shutdown(){stopping=true;const jobs=[...activeJobs.values()];for(const j of jobs)j.controller.abort();await Promise.all(jobs.map(j=>j.promise.catch(()=>{})));}
  async function recover(){
    if(running)return;
    for(const row of db.prepare('SELECT path,user_id FROM studio_media_cleanup').all())await retireMedia([row.path],row.user_id);
    // Reclaim only filenames generated by this application, never arbitrary files.
    const retained=new Set(db.prepare('SELECT source_path path FROM studio_projects UNION SELECT output_path path FROM studio_projects UNION SELECT output_path path FROM studio_render_requests').all().map(r=>r.path));
    let entries=[];try{entries=await readdir(mediaDir);}catch(e){if(e.code!=='ENOENT')throw e;}
    for(const name of entries)if(/^[0-9a-f-]{36}\.(?:source(?:\.part)?|mp4)$/.test(name)&&!retained.has(join(mediaDir,name)))await retireMedia([join(mediaDir,name)],'orphan-cleanup');
    const pending=db.prepare("SELECT r.* FROM studio_render_requests r JOIN studio_jobs j ON j.id=r.job_id WHERE j.state IN ('queued','rendering') ORDER BY j.created_at,j.rowid").all();
    const items=[];
    for(const row of pending){
      const p=db.prepare('SELECT * FROM studio_projects WHERE id=? AND user_id=?').get(row.project_id,row.user_id);
      if(!p||p.source_path!==row.source_path||!fileAvailable(row.source_path)||row.engine_version!==PIPELINE_VERSION||row.attempts>=2){
        db.prepare("UPDATE studio_jobs SET state='failed',error_code='RECOVERY_UNAVAILABLE',error_message='Reprise impossible ou limite de reprise atteinte. Le rush conservé peut être relancé manuellement.' WHERE id=?").run(row.job_id);
        if(p)db.prepare("UPDATE studio_projects SET state='ready' WHERE id=?").run(p.id);
        continue;
      }
      const expected=JSON.parse(p.metadata||'{}').sourceSha256;
      if(expected){const hash=createHash('sha256');for await(const chunk of createReadStream(row.source_path))hash.update(chunk);
        if(hash.digest('hex')!==expected){db.prepare("UPDATE studio_jobs SET state='failed',error_code='SOURCE_CHANGED',error_message='Le fichier source a changé depuis la demande.' WHERE id=?").run(row.job_id);db.prepare("UPDATE studio_projects SET state='ready' WHERE id=?").run(p.id);continue;}}
      const outputPath=join(mediaDir,randomUUID()+'.mp4');
      await retireMedia([row.output_path],row.user_id);
      db.prepare('UPDATE studio_render_requests SET output_path=? WHERE job_id=?').run(outputPath,row.job_id);
      db.prepare("UPDATE studio_jobs SET state='queued',progress=0 WHERE id=?").run(row.job_id);
      items.push({jobId:row.job_id,userId:row.user_id,id:row.project_id,sourcePath:row.source_path,outputPath,execution:JSON.parse(row.payload),recovered:true});
    }
    if(items.length)launch(items);
  }

  function job(userId,id) {
    const j=db.prepare('SELECT * FROM studio_jobs WHERE id=? AND user_id=?').get(id,userId);
    if(!j) throw fail(404,'JOB_NOT_FOUND','Traitement introuvable.');
    if(j.state==='complete'){
      const project=get(userId,j.project_id);
      const latest=db.prepare('SELECT id FROM studio_jobs WHERE project_id=? AND user_id=? ORDER BY created_at DESC,rowid DESC LIMIT 1').get(j.project_id,userId);
      if(latest?.id!==j.id)return {...j,state:'superseded',error_code:'OUTPUT_SUPERSEDED',error_message:'Un rendu plus récent existe. Ouvrez le dernier résultat du projet.',audit:null};
      if(!fileAvailable(project.output_path))return {...j,state:'failed',progress:0,error_code:'OUTPUT_MISSING',error_message:'Le MP4 final est absent. Le projet doit être repris.',audit:null};
    }
    return {...j,audit:j.audit?JSON.parse(j.audit):null};
  }
  async function remove(userId,id) {
    const p=get(userId,id);
    if(p.state==='rendering'||uploading.has(id))throw fail(409,'PROJECT_BUSY','Attendez la fin du traitement avant de supprimer ce projet.');
    db.prepare('DELETE FROM studio_transcripts WHERE project_id=? AND user_id=?').run(id,userId);
    db.prepare('DELETE FROM studio_signal_reports WHERE project_id=? AND user_id=?').run(id,userId);
    db.prepare('DELETE FROM studio_render_requests WHERE project_id=? AND user_id=?').run(id,userId);
    db.prepare('DELETE FROM studio_jobs WHERE project_id=? AND user_id=?').run(id,userId);
    db.prepare('DELETE FROM studio_projects WHERE id=? AND user_id=?').run(id,userId);
    await retireMedia([p.source_path,p.output_path],userId,{strict:true});
  }
  async function deleteUserData(userId) {
    const rows=db.prepare('SELECT * FROM studio_projects WHERE user_id=?').all(userId);
    db.prepare('DELETE FROM studio_transcripts WHERE user_id=?').run(userId);
    db.prepare('DELETE FROM studio_signal_reports WHERE user_id=?').run(userId);
    db.prepare('DELETE FROM studio_render_requests WHERE user_id=?').run(userId);
    db.prepare('DELETE FROM studio_jobs WHERE user_id=?').run(userId);
    db.prepare('DELETE FROM studio_projects WHERE user_id=?').run(userId);
    db.prepare('DELETE FROM studio_render_usage WHERE user_id=?').run(userId);
    const active=[...activeJobs.values()].filter(j=>j.userId===userId);
    for(const j of active)j.controller.abort();
    await Promise.all(active.map(j=>j.promise.catch(()=>{})));
    const queued=db.prepare('SELECT path FROM studio_media_cleanup WHERE user_id=?').all(userId).map(r=>r.path);
    await retireMedia([...rows.flatMap(p=>[p.source_path,p.output_path]),...queued],userId,{strict:true});
  }
  async function stream(userId,id,req,res,{output=false,download=false}={}) {
    const p=get(userId,id), path=output?p.output_path:p.source_path;
    if(!path||!fileAvailable(path))throw fail(404,'MEDIA_NOT_FOUND','Vidéo indisponible.');
    const info=await stat(path), range=req.headers.range;
    res.setHeader('Content-Type',output?'video/mp4':(JSON.parse(p.metadata||'{}').mime_type||'application/octet-stream'));
    res.setHeader('Accept-Ranges','bytes'); res.setHeader('Cache-Control','private, no-store');
    if(download) res.setHeader('Content-Disposition','attachment; filename="SocialPlus-export.mp4"');
    if(range){
      const match=/^bytes=(\d*)-(\d*)$/.exec(range);
      let start=match?.[1]?Number(match[1]):0,end=match?.[2]?Number(match[2]):info.size-1;
      if(match&&!match[1]&&match[2]){start=Math.max(0,info.size-Number(match[2]));end=info.size-1;}
      if(!match||!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start>end||start>=info.size){res.writeHead(416,{'Content-Range':`bytes */${info.size}`});res.end();return;}
      end=Math.min(end,info.size-1);
      res.writeHead(206,{'Content-Range':`bytes ${start}-${end}/${info.size}`,'Content-Length':end-start+1});
      createReadStream(path,{start,end}).on('error',()=>res.destroy()).pipe(res);
    }else{res.writeHead(200,{'Content-Length':info.size});createReadStream(path).on('error',()=>res.destroy()).pipe(res);}
  }
  function exportData(userId){
    return {projects:list(userId),model_directions:db.prepare('SELECT project_id,payload FROM studio_render_requests WHERE user_id=?').all(userId).map(r=>({project_id:r.project_id,...JSON.parse(r.payload)})).filter(r=>r.kineticRelease),transcripts:db.prepare('SELECT project_id,result FROM studio_transcripts WHERE user_id=?').all(userId).map(row=>({project_id:row.project_id,...JSON.parse(row.result)})),source_analyses:db.prepare('SELECT project_id,report FROM studio_signal_reports WHERE user_id=?').all(userId).map(row=>({project_id:row.project_id,...JSON.parse(row.report)})),render_jobs:db.prepare('SELECT id,project_id,model_id,state,progress,error_code,error_message,created_at,completed_at FROM studio_jobs WHERE user_id=? ORDER BY created_at').all(userId),render_usage:db.prepare('SELECT day,started_count FROM studio_render_usage WHERE user_id=? ORDER BY day').all(userId),media_downloads:list(userId).filter(p=>p.has_source).map(p=>({project_id:p.id,source_url:`/api/projects/${p.id}/media`,output_url:p.has_output?`/api/projects/${p.id}/output?download=1`:null}))};
  }
  return {recover,shutdown,list,create,update,analyze,editorial,signalReport,transcribe,transcript,kineticDirection,get:(u,id)=>publicProject(get(u,id)),upload,startRender,job,remove,stream,deleteUserData,exportData};
}
