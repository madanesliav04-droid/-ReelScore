#!/usr/bin/env node
import { DatabaseSync } from 'node:sqlite';
import { randomBytes, randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createInterface } from 'node:readline/promises';
import { createSecurity, totpCode } from '../server/security.mjs';

const appDir=resolve(dirname(fileURLToPath(import.meta.url)),'..');
if(process.argv.includes('--help')){
  console.log('Provisionnement local du propriétaire Social+\n\nnode scripts/provision-owner.mjs --init\n\n--init : crée les paramètres manquants dans .env.local, sans écraser les valeurs existantes.\nLe mot de passe est saisi sans écho. Le MFA TOTP doit être confirmé.\nPuis : node --env-file=.env.local server/index.mjs\n\nPour les tests automatisés uniquement : --non-interactive avec SOCIALPLUS_OWNER_EMAIL,\nSOCIALPLUS_OWNER_PASSWORD et SOCIALPLUS_OWNER_TOTP_CODE déjà définis.');
  process.exit(0);
}
const envPath=resolve(appDir,'.env.local');
try { process.loadEnvFile(envPath); } catch(e) {if(e.code!=='ENOENT')throw e;}
function base32(bytes){const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';let bits='',result='';for(const b of bytes)bits+=b.toString(2).padStart(8,'0');for(let i=0;i<bits.length;i+=5)result+=alphabet[parseInt(bits.slice(i,i+5).padEnd(5,'0'),2)];return result;}
if(process.argv.includes('--init')){
  let existing='';try{existing=await readFile(envPath,'utf8');}catch(e){if(e.code!=='ENOENT')throw e;}
  const missing={};if(!process.env.SOCIALPLUS_OWNER_ID)missing.SOCIALPLUS_OWNER_ID=randomUUID();if(!process.env.SOCIALPLUS_OWNER_TOTP_SECRET)missing.SOCIALPLUS_OWNER_TOTP_SECRET=base32(randomBytes(20));if(!process.env.SOCIALPLUS_ORIGIN)missing.SOCIALPLUS_ORIGIN='http://localhost:4318';
  if(Object.keys(missing).length){await writeFile(envPath,existing+(existing.endsWith('\n')?'':'\n')+Object.entries(missing).map(([k,v])=>`${k}=${v}`).join('\n')+'\n',{mode:0o600});Object.assign(process.env,missing);console.log('Paramètres privés enregistrés dans .env.local (à conserver hors Git).');}
}
if(!process.env.SOCIALPLUS_OWNER_ID||!process.env.SOCIALPLUS_OWNER_TOTP_SECRET)throw new Error('Propriétaire non configuré. Exécutez avec --init ou fournissez SOCIALPLUS_OWNER_ID et SOCIALPLUS_OWNER_TOTP_SECRET.');
const nonInteractive=process.argv.includes('--non-interactive');
if(nonInteractive&&(!process.env.SOCIALPLUS_OWNER_EMAIL||!process.env.SOCIALPLUS_OWNER_PASSWORD||!process.env.SOCIALPLUS_OWNER_TOTP_CODE))throw new Error('Mode automatisé : SOCIALPLUS_OWNER_EMAIL, SOCIALPLUS_OWNER_PASSWORD et SOCIALPLUS_OWNER_TOTP_CODE sont requis.');
if(!nonInteractive&&(!process.stdin.isTTY||!process.stdout.isTTY))throw new Error('Terminal interactif requis. Pour un test automatisé explicite, utilisez --non-interactive et les variables dédiées.');
async function hiddenQuestion(prompt){
  process.stdout.write(prompt);process.stdin.setRawMode(true);process.stdin.resume();let text='';
  try{return await new Promise((resolveAnswer,reject)=>{
    const listener=data=>{for(const char of data.toString('utf8')){
      if(char==='\u0003'){process.stdin.off('data',listener);reject(new Error('Annulé.'));return;}
      if(char==='\r'||char==='\n'){process.stdin.off('data',listener);resolveAnswer(text);return;}
      if(char==='\u007f'||char==='\b'){text=text.slice(0,-1);continue;}if(char>=' '&&text.length<256)text+=char;
    }};process.stdin.on('data',listener);
  });}finally{process.stdin.setRawMode(false);process.stdin.pause();process.stdout.write('\n');}
}
const rl=nonInteractive?null:createInterface({input:process.stdin,output:process.stdout});
let email,password,code;
try{
  email=process.env.SOCIALPLUS_OWNER_EMAIL||(await rl.question('Votre adresse e-mail vérifiée : '));
  if(!nonInteractive){
    console.log('Ajoutez ce compte à votre application d’authentification, dans votre terminal privé :');
    console.log(`otpauth://totp/${encodeURIComponent('Social+:'+email)}?secret=${process.env.SOCIALPLUS_OWNER_TOTP_SECRET}&issuer=Social%2B&algorithm=SHA1&digits=6&period=30`);
    console.log(`Clé manuelle : ${process.env.SOCIALPLUS_OWNER_TOTP_SECRET}`);
  }
  code=process.env.SOCIALPLUS_OWNER_TOTP_CODE||(await rl.question('Code MFA à 6 chiffres : '));
  const step=Math.floor(Date.now()/30_000);if(![step-1,step,step+1].some(counter=>totpCode(process.env.SOCIALPLUS_OWNER_TOTP_SECRET,counter)===code))throw new Error('Code MFA invalide. Aucun compte créé.');
  rl?.close();
  password=process.env.SOCIALPLUS_OWNER_PASSWORD||await hiddenQuestion('Mot de passe propriétaire (12 caractères minimum) : ');
  if(!nonInteractive){const confirm=await hiddenQuestion('Confirmez le mot de passe : ');if(password!==confirm)throw new Error('Les mots de passe diffèrent.');}
}finally{rl?.close();}
const dataDir=resolve(appDir,process.env.SOCIALPLUS_DATA_DIR||'.data');await mkdir(dataDir,{recursive:true,mode:0o700});
const db=new DatabaseSync(resolve(dataDir,'socialplus.sqlite'));
try{
  const security=createSecurity({db,config:{origin:process.env.SOCIALPLUS_ORIGIN||'http://localhost:4318',ownerId:process.env.SOCIALPLUS_OWNER_ID,ownerTotpSecret:process.env.SOCIALPLUS_OWNER_TOTP_SECRET}});
  await security.provisionOwner({id:process.env.SOCIALPLUS_OWNER_ID,email,password,displayName:'Propriétaire'});
  console.log('Propriétaire créé. MFA obligatoire à chaque connexion. Aucun membre ne peut recevoir ce rôle.');
}finally{db.close();password=undefined;delete process.env.SOCIALPLUS_OWNER_PASSWORD;delete process.env.SOCIALPLUS_OWNER_TOTP_CODE;}
