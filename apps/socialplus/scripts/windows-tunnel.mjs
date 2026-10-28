// Temporary transport only. Existing interface, auth, data and engines stay intact.
import {once} from 'node:events';
import http from 'node:http';import {spawn} from 'node:child_process';
import {readFile,writeFile,mkdtemp,rm,mkdir} from 'node:fs/promises';import {createWriteStream} from 'node:fs';
import {tmpdir} from 'node:os';import {join,resolve,dirname} from 'node:path';import {fileURLToPath} from 'node:url';
import {createApp} from '../server/index.mjs';import {assertKineticRelease} from '../server/kinetic-release.mjs';
const appDir=resolve(dirname(fileURLToPath(import.meta.url)),'..');
export const TUNNEL_HOST='socialplus-test.local';
export const MAX_TUNNEL_UPLOAD=90*1024*1024;
export function quickTunnelUrl(log){return String(log).match(/https:\/\/[a-z0-9]+(?:-[a-z0-9]+)*\.trycloudflare\.com(?![a-z0-9.-])/i)?.[0]||null;}
export function cloudflaredArguments(port,config){
 if(!Number.isInteger(port)||port<1||port>65535)throw Error('Port local invalide.');
 return ['tunnel','--config',config,'--no-autoupdate','--protocol','http2','--metrics','127.0.0.1:0','--http-host-header',TUNNEL_HOST,'--url',`http://127.0.0.1:${port}`];
}
export function tunnelHandler(getApp){return (req,res)=>{
 const ip=req.socket.remoteAddress?.replace(/^::ffff:/,'');
 if(!['127.0.0.1','::1'].includes(ip)){res.writeHead(403);res.end('Accès origine refusé.');return;}
 if(req.headers.host!==TUNNEL_HOST){res.writeHead(421);res.end('Hôte origine incorrect.');return;}
 res.setHeader('Cache-Control','no-store');
 if(!getApp()){res.writeHead(503);res.end('Initialisation Social+.');return;}
 if(req.method==='POST'&&/\/source(?:\?|$)/.test(req.url)&&Number(req.headers['content-length'])>MAX_TUNNEL_UPLOAD){res.writeHead(413,{'Content-Type':'application/json'});res.end(JSON.stringify({code:'TUNNEL_UPLOAD_LIMIT',message:'Pour ce tunnel temporaire, choisissez un fichier inférieur à 90 Mo.'}));return;}
 getApp().server.emit('request',req,res);
};}
export function waitForTunnel(child,{timeoutMs=60000}={}){
 return new Promise((resolveReady,reject)=>{
  let log='',registered=false,origin;
  const finish=(error)=>{clearTimeout(timer);child.stdout?.off('data',chunk);child.stderr?.off('data',chunk);child.off('error',failed);child.off('close',closed);error?reject(error):resolveReady(origin);};
  const chunk=b=>{log=(log+b.toString()).slice(-20000);origin=quickTunnelUrl(log)||origin;registered=registered||log.includes('Registered tunnel connection');if(origin&&registered)finish();};
  const failed=()=>finish(Error('cloudflared est indisponible. Installez Cloudflare.cloudflared puis rouvrez le terminal.'));
  const closed=code=>finish(Error(`Cloudflare s’est arrêté avant la connexion (code ${code}). Consultez le journal local privé.`));
  const timer=setTimeout(()=>finish(Error('Cloudflare ne se connecte pas. Vérifiez la sortie TCP 7844, le Wi-Fi et le journal local privé.')),timeoutMs);
  child.stdout?.on('data',chunk);child.stderr?.on('data',chunk);child.once('error',failed);child.once('close',closed);
 });
}
export async function verifyPublicOrigin(origin,{fetchImpl=fetch,attempts=4,pause=()=>new Promise(done=>setTimeout(done,1000))}={}){
 for(let i=0;i<attempts;i++){
  try{
   const health=await fetchImpl(origin+'/healthz',{signal:AbortSignal.timeout(10000)});
   if(!health.ok||(await health.json()).app!=='Social+')throw Error('Santé HTTPS indisponible.');
   const access=await fetchImpl(origin+'/api/projects',{signal:AbortSignal.timeout(10000)});
   if(access.status!==401)throw Object.assign(Error('Accès anonyme non refusé : tunnel arrêté.'),{unsafe:true});
   return {health:200,anonymousProjects:401};
  }catch(error){if(error.unsafe)throw error;if(i===attempts-1)throw Error('Le lien HTTPS ne répond pas depuis ce PC. Vérifiez Cloudflare, le DNS et le journal local privé, puis relancez.');await pause();}
 }
}
export async function startQuickTunnel(){
 try{process.loadEnvFile(join(appDir,'.env.local'));}catch(e){if(e.code!=='ENOENT')throw e;}
 if(!process.env.SOCIALPLUS_OWNER_ID||!process.env.SOCIALPLUS_OWNER_TOTP_SECRET)throw Error('Installez le compte propriétaire avant le tunnel : INSTALLER-SOCIALPLUS.ps1 -PourTunnel.');
 const runtime=JSON.parse(await readFile(join(appDir,'.local-windows','runtime-tunnel.json'),'utf8'));
 for(const key of ['SOCIALPLUS_PYTHON','SOCIALPLUS_ASR_PYTHON','SOCIALPLUS_ASR_MODEL_DIR','SOCIALPLUS_ASR_MODULE_DIR','SOCIALPLUS_CHROMIUM'])if(runtime[key])process.env[key]=runtime[key];
 assertKineticRelease();
 const privateDir=join(appDir,'.local-windows');await mkdir(privateDir,{recursive:true,mode:0o700});
 const temp=await mkdtemp(join(tmpdir(),'socialplus-quick-'));const config=join(temp,'empty.yml');await writeFile(config,'{}\n',{mode:0o600});
 let app,child,log,gateway,stopping=false,closed=false;
 const close=async()=>{
  if(stopping)return;stopping=true;
  child?.kill('SIGTERM');
  if(gateway?.listening){gateway.closeAllConnections();await new Promise(done=>gateway.close(done));}
  if(app){await app.projects.shutdown();app.releaseRuntime();app.db.close();}
  log?.end();await rm(temp,{recursive:true,force:true});closed=true;console.log('Tunnel et serveur arrêtés. Les projets sont conservés.');
 };
 const interrupt=()=>{console.log('\nArrêt du tunnel et du serveur. Les projets restent sur ce PC.');const timer=setTimeout(()=>process.exit(1),15000);timer.unref();close().then(()=>clearTimeout(timer)).catch(()=>{process.exitCode=1;});};
 process.once('SIGINT',interrupt);process.once('SIGTERM',interrupt);process.once('SIGHUP',interrupt);
 try{
  gateway=http.createServer(tunnelHandler(()=>app));gateway.requestTimeout=600000;
  await new Promise((done,reject)=>{gateway.once('error',reject);gateway.listen(0,'127.0.0.1',done);});
  log=createWriteStream(join(privateDir,'cloudflared-last.log'),{flags:'w',mode:0o600});await once(log,'open');log.on('error',()=>{console.error('Journal local inaccessible : fermeture du tunnel.');process.exitCode=1;close().catch(()=>{});});
  // No login/token/account required. Ignore inherited named-tunnel credentials.
  const env={...process.env};for(const key of ['TUNNEL_TOKEN','TUNNEL_TOKEN_FILE','TUNNEL_CRED_FILE','TUNNEL_ORIGIN_CERT'])delete env[key];
  child=spawn('cloudflared',cloudflaredArguments(gateway.address().port,config),{shell:false,stdio:['ignore','pipe','pipe'],windowsHide:true,env});
  child.stdout.pipe(log,{end:false});child.stderr.pipe(log,{end:false});
  const origin=await waitForTunnel(child);if(stopping)throw Error('Lancement annulé.');
  app=await createApp({origin,securityConfig:{secureCookies:true}});
  const owner=app.db.prepare('SELECT id FROM security_users WHERE id=?').get(process.env.SOCIALPLUS_OWNER_ID);if(!owner)throw Error('Compte propriétaire absent. Terminez INSTALLER-SOCIALPLUS.ps1 -PourTunnel.');
  child.once('close',()=>{if(!stopping){console.error('Le tunnel Cloudflare est fermé. Relancez DEMARRER-TEST-IPHONE.cmd pour obtenir une nouvelle URL.');process.exitCode=1;close().catch(()=>{});}});
  // The callback is loopback HTTP; the external browser must use the exact HTTPS origin.
  console.log('Vérification HTTPS externe et refus des accès anonymes…');
  await verifyPublicOrigin(origin);
  console.log(`\nSOCIAL+ — TEST TEMPORAIRE\n\nVotre lien HTTPS : ${origin}\n\nOuvrez ce lien sur le PC et dans Safari iPhone.\nConnexion Social+ obligatoire : compte, mot de passe et MFA propriétaire.\nAucun certificat à installer sur l’iPhone. Aucun compte Cloudflare ni abonnement.\nLimite recommandée : rush de moins de 90 Mo et de 60 secondes.\nGardez le PC allumé et cette fenêtre ouverte. Arrêt : Ctrl+C.\nNe partagez ni vos identifiants ni le journal privé.\n`);
  await writeFile(join(privateDir,'last-tunnel-url.txt'),origin+'\n',{mode:0o600});
  return {origin,close,get closed(){return closed;}};
 }catch(error){await close();throw error;}
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))startQuickTunnel().catch(e=>{console.error('Social+ : '+e.message);process.exitCode=1;});
