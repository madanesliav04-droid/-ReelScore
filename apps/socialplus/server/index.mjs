import {acquireRuntimeLock} from './runtime-lock.mjs';
import http from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { mkdir, readFile, stat } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { dirname, resolve, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { createSecurity } from './security.mjs';
import { createStrategy } from './strategy.mjs';
import { createProjects } from './projects.mjs';
import * as render from './render.mjs';
import { legalDocument } from './legal.mjs';
import { seedInitialFaq } from './bootstrap.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const publicDir = resolve(here,'../public');
const MIME = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon'};
const json = (res,status,value) => {res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(value));};
async function readJson(req) {
  let size=0; const chunks=[];
  for await (const chunk of req){size+=chunk.length;if(size>2*1024*1024)throw Object.assign(new Error('Requête trop volumineuse.'),{status:413,code:'BODY_TOO_LARGE'});chunks.push(chunk);}
  try{return JSON.parse(Buffer.concat(chunks).toString()||'{}');}catch{throw Object.assign(new Error('Le contenu JSON est invalide.'),{status:400,code:'INVALID_JSON'});}
}

export async function createApp(options={}) {
  const dataDir=resolve(here,'..',options.dataDir||process.env.SOCIALPLUS_DATA_DIR||'.data');
  await mkdir(dataDir,{recursive:true,mode:0o700});
  const db=options.db||new DatabaseSync(resolve(dataDir,'socialplus.sqlite'));
  db.exec('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;');
  let releaseRuntime;try{releaseRuntime=acquireRuntimeLock(db);}catch(error){if(!options.db)db.close();throw error;}
  const strategy=createStrategy({db});
  const maxRendersPerDay=Number(process.env.SOCIALPLUS_MAX_RENDERS_PER_DAY??10);
  const projects=createProjects({db,dataDir,render:options.render||render,maxRendersPerDay});
  const security=createSecurity({db,config:{
    origin:options.origin||process.env.SOCIALPLUS_ORIGIN||'http://localhost:4318',
    ownerId:process.env.SOCIALPLUS_OWNER_ID,
    ownerTotpSecret:process.env.SOCIALPLUS_OWNER_TOTP_SECRET,
    secureCookies:process.env.NODE_ENV==='production',
    ...options.securityConfig,
    exportUserData: async userId=>({...projects.exportData(userId),strategy:strategy.exportData(userId)}),
    deleteUserData: async userId=>{await projects.deleteUserData(userId);await strategy.deleteData(userId);}
  }});
  seedInitialFaq(db);
  await projects.recover();
  const server=http.createServer(async(req,res)=>{
    const traceId=randomUUID();
    res.setHeader('X-Content-Type-Options','nosniff');
    res.setHeader('Referrer-Policy','same-origin');
    res.setHeader('X-Frame-Options','DENY');
    res.setHeader('Permissions-Policy','camera=(), microphone=(), geolocation=()');
    res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' blob: data:; media-src 'self' blob:; connect-src 'self'; font-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");
    res.setHeader('X-Trace-Id',traceId);
    try {
      const url=new URL(req.url,'http://localhost');
      if(url.pathname==='/healthz'){json(res,200,{status:'ok',app:'Social+',version:'V18-private-v1'});return;}
      if(url.pathname.startsWith('/api/')){
        const legalMatch=/^\/api\/privacy\/(privacy|terms|legal|cookies)$/.exec(url.pathname);
        if(legalMatch&&req.method==='GET'){json(res,200,legalDocument(legalMatch[1]));return;}
        if(url.pathname==='/api/admin/usage'&&req.method==='GET'){
          security.requireOwner(req);
          const usage=db.prepare('SELECT count(*) projects, COALESCE(sum(source_bytes+output_bytes),0) storage_bytes FROM studio_projects').get();
          json(res,200,{...usage,render_jobs:db.prepare('SELECT state,count(*) count FROM studio_jobs GROUP BY state').all(),completed_render_seconds:db.prepare("SELECT COALESCE(sum((julianday(completed_at)-julianday(created_at))*86400),0) seconds FROM studio_jobs WHERE state='complete'").get().seconds,limits:{upload_bytes:209715200,user_storage_bytes:1073741824,renders_per_day:maxRendersPerDay},local_render_ms:db.prepare('SELECT COALESCE(sum(elapsed_ms),0) ms FROM studio_render_requests').get().ms,resumed_attempts:db.prepare('SELECT COALESCE(sum(attempts-1),0) n FROM studio_render_requests').get().n,external_paid_calls:0,cost_notice:'Aucun appel à un service facturé dans ce serveur local ; coûts de la machine et de l’hébergement non mesurés.'});return;
        }
        if(url.pathname.startsWith('/api/admin/method-versions')){
          const owner=security.requireOwner(req);
          if(!['GET','HEAD','OPTIONS'].includes(req.method))security.checkCsrf(req);
          if(await strategy.handleAdmin(req,res,url,owner))return;
        }
        if(await security.handle(req,res,url))return;
        const user=security.requireUser(req);
        if(!['GET','HEAD','OPTIONS'].includes(req.method))security.checkCsrf(req);
        if(await strategy.handle(req,res,url,user))return;
        if(url.pathname==='/api/studio/styles'&&req.method==='GET'){json(res,200,{styles:render.MODEL_CATALOG,transcription:{configured:Boolean(render.transcriptionKey())}});return;}
        if(url.pathname==='/api/projects'){
          if(req.method==='GET'){json(res,200,{projects:projects.list(user.id)});return;}
          if(req.method==='POST'){json(res,201,{project:projects.create(user.id,await readJson(req))});return;}
        }
        const projectMatch=/^\/api\/projects\/([^/]+)(?:\/(source|media|render|output|signals|transcript|editorial))?$/.exec(url.pathname);
        if(projectMatch){
          const [,id,action]=projectMatch;
          if(action==='editorial'&&req.method==='POST'){json(res,200,{editorial:await projects.editorial(user.id,id,await readJson(req))});return;}
          if(action==='transcript'&&req.method==='POST'){json(res,200,{transcript:await projects.transcribe(user.id,id)});return;}
          if(action==='transcript'&&req.method==='GET'){json(res,200,{transcript:projects.transcript(user.id,id)});return;}
          if(action==='signals'&&req.method==='POST'){json(res,200,{report:await projects.analyze(user.id,id)});return;}
          if(action==='signals'&&req.method==='GET'){json(res,200,{report:projects.signalReport(user.id,id)});return;}
          if(action==='source'&&req.method==='POST'){json(res,200,{project:await projects.upload(user.id,id,req)});return;}
          if(action==='media'&&req.method==='GET'){await projects.stream(user.id,id,req,res);return;}
          if(action==='output'&&req.method==='GET'){await projects.stream(user.id,id,req,res,{output:true,download:url.searchParams.has('download')});return;}
          if(action==='render'&&req.method==='POST'){json(res,202,{job:projects.startRender(user.id,id,await readJson(req))});return;}
          if(!action&&req.method==='GET'){json(res,200,{project:projects.get(user.id,id)});return;}
          if(!action&&req.method==='PATCH'){json(res,200,{project:projects.update(user.id,id,await readJson(req))});return;}
          if(!action&&req.method==='DELETE'){await projects.remove(user.id,id);json(res,200,{deleted:true});return;}
        }
        const jobMatch=/^\/api\/jobs\/([^/]+)$/.exec(url.pathname);
        if(jobMatch&&req.method==='GET'){json(res,200,{job:projects.job(user.id,jobMatch[1])});return;}
        json(res,404,{code:'NOT_FOUND',message:'Cette fonction est indisponible.',retryable:false,trace_id:traceId});return;
      }
      if(url.pathname==='/admin'||url.pathname.startsWith('/admin/'))security.requireOwner(req);
      if(req.method!=='GET'&&req.method!=='HEAD'){json(res,405,{code:'METHOD_NOT_ALLOWED',message:'Méthode non autorisée.'});return;}
      const pathname=decodeURIComponent(url.pathname);
      const filename=resolve(publicDir,pathname==='/'||pathname==='/admin'?'index.html':'.'+pathname);
      if(!filename.startsWith(publicDir+'/')||!MIME[extname(filename)]){json(res,404,{code:'NOT_FOUND',message:'Page introuvable.'});return;}
      const info=await stat(filename);
      if(!info.isFile())throw Object.assign(new Error('Page introuvable.'),{status:404});
      res.writeHead(200,{'Content-Type':MIME[extname(filename)],'Cache-Control':'no-cache','Content-Length':info.size});
      if(req.method==='HEAD')res.end();else createReadStream(filename).on('error',()=>res.destroy()).pipe(res);
    } catch(error) {
      if(res.headersSent){res.destroy();return;}
      const status=error.status||error.statusCode||(error.code==='ENOENT'?404:500);
      json(res,status,{code:status===500?'INTERNAL_ERROR':error.code||'REQUEST_FAILED',message:status===500?'Une erreur technique est survenue. Réessayez avec cet identifiant de suivi.':error.message,retryable:status>=500,trace_id:traceId});
      if(status>=500)process.stderr.write(JSON.stringify({event:'request_error',trace_id:traceId,code:error.code||error.name})+'\n');
    }
  });
  server.once('close',releaseRuntime);
  server.requestTimeout=10*60*1000;
  return {server,db,security,strategy,projects,releaseRuntime};
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const app=await createApp();
  const {server}=app;
  let stopping=false;
  const stop=()=>{if(stopping)return;stopping=true;server.close(async()=>{await app.projects.shutdown();app.releaseRuntime();app.db.close();process.exit(0);});setTimeout(()=>process.exit(0),10000).unref();};
  process.once('SIGINT',stop);process.once('SIGTERM',stop);
  const port=Number(process.env.PORT||4318),host=process.env.SOCIALPLUS_HOST||'127.0.0.1';
  server.listen(port,host,()=>process.stdout.write(`Social+ local : http://${host}:${port}\n`));
}
