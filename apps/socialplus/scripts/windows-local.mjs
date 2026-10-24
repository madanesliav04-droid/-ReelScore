// Local HTTPS transport only. The existing app, security and engines stay unchanged.
import https from 'node:https';
import {readFileSync,existsSync} from 'node:fs';
import {resolve,dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {networkInterfaces} from 'node:os';
import {DatabaseSync} from 'node:sqlite';
import {createApp} from '../server/index.mjs';

export function privateIPv4(ip){
 const parts=String(ip).split('.');
 if(parts.length!==4||parts.some(p=>!/^\d{1,3}$/.test(p)||Number(p)>255))return false;
 const [a,b]=parts.map(Number);
 return a===10||a===192&&b===168||a===172&&b>=16&&b<=31;
}
export function validateLocalConfig(config,interfaces=networkInterfaces()){
 if(!privateIPv4(config.ip))throw Error('Adresse IPv4 privée du Wi-Fi requise (192.168.x.x, 10.x.x.x ou 172.16–31.x.x).');
 const assigned=Object.values(interfaces).flat().some(n=>!n.internal&&n.address===config.ip);
 if(!assigned)throw Error('L’adresse Wi-Fi a changé. Relancez INSTALLER-SOCIALPLUS.ps1 pour recréer le certificat.');
 if(config.port!==8443)throw Error('Le port local autorisé est 8443.');
 return `https://${config.ip}:${config.port}`;
}
const appDir=resolve(dirname(fileURLToPath(import.meta.url)),'..');
export async function startLocal(config){
 const origin=validateLocalConfig(config);
 try{process.loadEnvFile(join(appDir,'.env.local'));}catch(e){if(e.code!=='ENOENT')throw e;}
 const env=config.runtime||{};
 // Only dependency paths are accepted from the local setup file, never auth flags.
 for(const key of ['SOCIALPLUS_PYTHON','SOCIALPLUS_ASR_PYTHON','SOCIALPLUS_ASR_MODEL_DIR','SOCIALPLUS_CHROMIUM'])if(env[key])process.env[key]=env[key];
 process.env.SOCIALPLUS_ORIGIN=origin;
 if(!process.env.SOCIALPLUS_OWNER_ID||!process.env.SOCIALPLUS_OWNER_TOTP_SECRET)throw Error('Propriétaire absent : exécutez INSTALLER-SOCIALPLUS.ps1.');
 const app=await createApp({origin});
 const server=https.createServer({key:readFileSync(config.key),cert:readFileSync(config.cert),minVersion:'TLSv1.2'},(req,res)=>{
   // Reject connections outside RFC1918, even if a firewall is misconfigured.
   const address=req.socket.remoteAddress?.replace(/^::ffff:/,'');
   if(!privateIPv4(address)){res.writeHead(403);res.end('Accès réservé au réseau local.');return;}
   if(req.headers.host!==`${config.ip}:${config.port}`){res.writeHead(421);res.end('Adresse locale incorrecte.');return;}
   app.server.emit('request',req,res);
 });
 server.requestTimeout=10*60*1000;
 await new Promise((done,reject)=>{server.once('error',reject);server.listen(config.port,config.ip,done);});
 console.log(`\nSocial+ : ${origin}\nPC et iPhone : ouvrez cette même adresse.\nConnexion avec votre compte et code MFA. Arrêt : Ctrl+C.\n`);
 let stopping=false;
 const stop=()=>{if(stopping)return;stopping=true;server.close(()=>{app.db.close();process.exit(0);});setTimeout(()=>process.exit(0),5000).unref();};
 process.once('SIGINT',stop);process.once('SIGTERM',stop);
 return {server,app};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{
  if(process.argv.includes('--owner-status')){
   try{process.loadEnvFile(join(appDir,'.env.local'));}catch(e){if(e.code!=='ENOENT')throw e;}
   const dbPath=resolve(appDir,process.env.SOCIALPLUS_DATA_DIR||'.data','socialplus.sqlite');
   if(!existsSync(dbPath)){console.log('missing');process.exit(0);}
   const db=new DatabaseSync(dbPath,{readOnly:true});
   try{const table=db.prepare("SELECT name FROM sqlite_master WHERE name='security_users'").get();console.log(table&&db.prepare('SELECT id FROM security_users WHERE id=?').get(process.env.SOCIALPLUS_OWNER_ID||'')?'ready':'missing');}finally{db.close();}
  }else await startLocal(JSON.parse(readFileSync(join(appDir,'.local-windows','config.json'),'utf8')));
 }catch(e){console.error('Social+ : '+e.message);process.exitCode=1;}
}
