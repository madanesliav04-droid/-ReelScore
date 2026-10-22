import { randomUUID } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, rm, stat, rename } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { Transform } from 'node:stream';

const fail = (status, code, message) => Object.assign(new Error(message), { status, code });
const now = () => new Date().toISOString();

export function createProjects({ db, dataDir, render, maxUploadBytes = 200 * 1024 * 1024, maxUserBytes = 1024 * 1024 * 1024 }) {
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
  ); CREATE INDEX IF NOT EXISTS studio_job_owner ON studio_jobs(user_id,created_at);`);
  if(!db.prepare('PRAGMA table_info(studio_projects)').all().some(x=>x.name==='output_bytes'))db.exec('ALTER TABLE studio_projects ADD COLUMN output_bytes INTEGER NOT NULL DEFAULT 0');
  db.prepare("UPDATE studio_jobs SET state='failed',error_code='PROCESS_INTERRUPTED',error_message='Le serveur a redémarré. Relancez le traitement.' WHERE state IN ('queued','rendering')").run();
  db.prepare("UPDATE studio_projects SET state='ready' WHERE state='rendering'").run();
  let running = false;
  const uploading = new Set();
  const uploadingUsers = new Set();
  const publicProject = p => ({ id: p.id, name: p.name, style_id: p.style_id, state: p.state, source_name: p.source_name, source_bytes: p.source_bytes, metadata: p.metadata ? JSON.parse(p.metadata) : null, has_source: Boolean(p.source_path), has_output: Boolean(p.output_path), created_at: p.created_at, updated_at: p.updated_at });
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
    if (input.style_id && !render.MODEL_CATALOG.some(m=>m.id===input.style_id) && input.style_id !== 'technical-export') throw fail(400,'UNKNOWN_MODEL','Modèle inconnu.');
    db.prepare('UPDATE studio_projects SET name=COALESCE(?,name),style_id=COALESCE(?,style_id),updated_at=? WHERE id=? AND user_id=?').run(input.name == null ? null : String(input.name).trim().slice(0,160),input.style_id||null,now(),id,userId);
    return publicProject(get(userId,id));
  };
  async function upload(userId,id,req) {
    const project = get(userId,id);
    if (project.state === 'rendering' || uploading.has(id) || uploadingUsers.has(userId)) throw fail(409,'PROJECT_BUSY','Un import ou traitement est déjà en cours.');
    if (!/^video\//i.test(req.headers['content-type']||'')) throw fail(415,'MEDIA_TYPE','Choisissez un fichier vidéo.');
    const used = db.prepare('SELECT COALESCE(sum(source_bytes+output_bytes),0) AS n FROM studio_projects WHERE user_id=?').get(userId).n;
    const available = Math.min(maxUploadBytes,maxUserBytes-used+project.source_bytes+project.output_bytes);
    if (Number(req.headers['content-length']||0)>available || available<=0) throw fail(413,'UPLOAD_QUOTA','La vidéo dépasse la limite de stockage disponible.');
    uploading.add(id);
    uploadingUsers.add(userId);
    const path = join(mediaDir, randomUUID()+'.source'), partial = path+'.part';
    let bytes = 0;
    try {
      await mkdir(mediaDir,{recursive:true,mode:0o700});
      await pipeline(req, new Transform({transform(chunk,encoding,callback) { bytes+=chunk.length; callback(bytes>available ? fail(413,'UPLOAD_QUOTA','Fichier trop volumineux (200 Mo maximum).') : null,chunk); }}),createWriteStream(partial,{flags:'wx',mode:0o600}));
      const metadata = await render.probeVideo(partial);
      await rename(partial,path);
      let name = 'Vidéo importée';
      try { name = decodeURIComponent(req.headers['x-filename']||name).slice(0,160); } catch {}
      const saved=db.prepare("UPDATE studio_projects SET source_path=?,source_name=?,source_bytes=?,metadata=?,output_path=NULL,output_bytes=0,state='ready',updated_at=? WHERE id=? AND user_id=?").run(path,name,bytes,JSON.stringify(metadata),now(),id,userId);
      if(saved.changes!==1)throw fail(410,'PROJECT_REMOVED','Le projet ou le compte a été supprimé pendant cet import.');
      await Promise.all([project.source_path,project.output_path].filter(Boolean).map(p=>rm(p,{force:true})));
      return publicProject(get(userId,id));
    } catch(error) { await rm(partial,{force:true}); await rm(path,{force:true}); throw error; }
    finally { uploading.delete(id); uploadingUsers.delete(userId); }
  }
  function startRender(userId,id,input) {
    const p = get(userId,id), modelId = input.modelId || input.style_id || p.style_id;
    if (!p.source_path) throw fail(409,'SOURCE_REQUIRED','Importez d’abord une vidéo.');
    if (running || uploading.has(id)) throw fail(409,'RENDER_BUSY','Un traitement est en cours. Réessayez après sa fin.');
    const model = render.MODEL_CATALOG.find(x=>x.id===modelId);
    if (modelId !== 'technical-export' && (!model || !model.available)) throw fail(422,'MODEL_UNAVAILABLE',model?.reason||'Le moteur de ce modèle est indisponible.');
    const jobId = randomUUID(), outputPath = join(mediaDir,randomUUID()+'.mp4');
    db.prepare("INSERT INTO studio_jobs(id,project_id,user_id,model_id,state,created_at) VALUES(?,?,?,?,'rendering',?)").run(jobId,id,userId,modelId,now());
    db.prepare("UPDATE studio_projects SET state='rendering',style_id=?,updated_at=? WHERE id=?").run(modelId,now(),id);
    running = true;
    Promise.resolve().then(()=>render.renderVideo({sourcePath:p.source_path,outputPath,modelId,captionCues:input.captionCues,analysis:input.analysis,timeline:input.timeline,frameProof:input.frameProof,editorialEvents:input.editorialEvents,onProgress: value => db.prepare('UPDATE studio_jobs SET progress=? WHERE id=?').run(Math.min(99,Math.max(0,Number(value)||0)),jobId)})).then(async result=>{
      // A deleted project must never leave a newly rendered private file behind.
      if (!db.prepare('SELECT id FROM studio_projects WHERE id=? AND user_id=?').get(id,userId)) { await rm(outputPath,{force:true}); return; }
      const bytes=(await stat(outputPath)).size;
      const used=db.prepare('SELECT COALESCE(sum(source_bytes+output_bytes),0) AS n FROM studio_projects WHERE user_id=?').get(userId).n;
      if(used-p.output_bytes+bytes>maxUserBytes)throw fail(413,'STORAGE_QUOTA','Le fichier exporté dépasse votre stockage disponible. Supprimez un ancien projet.');
      const updated=db.prepare("UPDATE studio_projects SET state='complete',output_path=?,output_bytes=?,updated_at=? WHERE id=? AND user_id=?").run(outputPath,bytes,now(),id,userId);
      // stat() above yields: deletion may have removed the account/project in
      // that interval. Never retain an output absent from the owner's records.
      if(updated.changes!==1){await rm(outputPath,{force:true});return;}
      db.prepare("UPDATE studio_jobs SET state='complete',progress=100,audit=?,completed_at=? WHERE id=?").run(JSON.stringify(result||{}),now(),jobId);
      if (p.output_path) await rm(p.output_path,{force:true});
    }).catch(async error=>{
      await rm(outputPath,{force:true});
      db.prepare("UPDATE studio_projects SET state='ready',updated_at=? WHERE id=? AND user_id=?").run(now(),id,userId);
      db.prepare("UPDATE studio_jobs SET state='failed',error_code=?,error_message=?,completed_at=? WHERE id=?").run(error.code||'RENDER_FAILED',String(error.publicMessage||error.message||'Échec du rendu.').slice(0,500),now(),jobId);
    }).finally(()=>{running=false;});
    return job(userId,jobId);
  }
  function job(userId,id) {
    const j=db.prepare('SELECT * FROM studio_jobs WHERE id=? AND user_id=?').get(id,userId);
    if(!j) throw fail(404,'JOB_NOT_FOUND','Traitement introuvable.');
    return {...j,audit:j.audit?JSON.parse(j.audit):null};
  }
  async function remove(userId,id) {
    const p=get(userId,id);
    if(p.state==='rendering'||uploading.has(id))throw fail(409,'PROJECT_BUSY','Attendez la fin du traitement avant de supprimer ce projet.');
    db.prepare('DELETE FROM studio_jobs WHERE project_id=? AND user_id=?').run(id,userId);
    db.prepare('DELETE FROM studio_projects WHERE id=? AND user_id=?').run(id,userId);
    await Promise.all([p.source_path,p.output_path].filter(Boolean).map(p=>rm(p,{force:true})));
  }
  async function deleteUserData(userId) {
    const rows=db.prepare('SELECT * FROM studio_projects WHERE user_id=?').all(userId);
    db.prepare('DELETE FROM studio_jobs WHERE user_id=?').run(userId);
    db.prepare('DELETE FROM studio_projects WHERE user_id=?').run(userId);
    await Promise.all(rows.flatMap(p=>[p.source_path,p.output_path]).filter(Boolean).map(p=>rm(p,{force:true})));
  }
  async function stream(userId,id,req,res,{output=false,download=false}={}) {
    const p=get(userId,id), path=output?p.output_path:p.source_path;
    if(!path)throw fail(404,'MEDIA_NOT_FOUND','Vidéo indisponible.');
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
  return {list,create,update,get:(u,id)=>publicProject(get(u,id)),upload,startRender,job,remove,stream,deleteUserData};
}
