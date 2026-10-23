import {transcriptionKey} from '../server/transcription.mjs';
import {createRequire} from 'node:module';
import {spawnSync} from 'node:child_process';
import {DatabaseSync} from 'node:sqlite';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

const failures=[];const require=createRequire(import.meta.url);
for(const pkg of ['playwright-core','gsap'])try{require.resolve(pkg);}catch{failures.push('Exécutez npm ci : dépendance manquante '+pkg);}
if(process.env.SOCIALPLUS_CHROMIUM||process.platform==='linux')output(process.env.SOCIALPLUS_CHROMIUM||'/usr/bin/chromium',['--version']);
if(Number(process.versions.node.split('.')[0])<24)failures.push('Node.js 24 ou plus récent requis.');
function output(tool,args){const r=spawnSync(tool,args,{encoding:'utf8',timeout:10000,maxBuffer:2_000_000});if(r.error||r.status!==0){failures.push(`${tool} indisponible ou en échec.`);return '';}return r.stdout+r.stderr;}
const encoders=output('ffmpeg',['-hide_banner','-encoders']);
for(const codec of ['libx264','aac'])if(!new RegExp('\\b'+codec+'\\b').test(encoders))failures.push(`Encodeur ${codec} requis.`);
if(!/\bass\s/.test(output('ffmpeg',['-hide_banner','-filters'])))failures.push('Filtre ASS/libass requis pour les sous-titres.');
output('ffprobe',['-version']);
output(process.env.SOCIALPLUS_PYTHON||'python3',['-c','import numpy; import PIL; print("Restored model drawing dependencies ready")']);
if(process.env.SOCIALPLUS_ASR_MODEL_DIR){
 if(!transcriptionKey())failures.push('Modèle ASR incomplet : model.bin, config.json et tokenizer.json requis.');
 output(process.env.SOCIALPLUS_ASR_PYTHON||process.env.SOCIALPLUS_PYTHON||'python3',['-c','import sys; sys.path.insert(0,sys.argv[1]); import numpy; import faster_whisper; print("Offline ASR dependencies ready")',process.env.SOCIALPLUS_ASR_MODULE_DIR||'']);
}
const folder=await mkdtemp(join(tmpdir(),'socialplus-runtime-'));
try{const db=new DatabaseSync(join(folder,'check.sqlite'));try{db.exec('CREATE TABLE check_runtime(id INTEGER); INSERT INTO check_runtime VALUES(1)');if(db.prepare('SELECT count(*) n FROM check_runtime').get().n!==1)failures.push('SQLite non fonctionnel.');}finally{db.close();}await writeFile(join(folder,'write-check'),'ok');}
finally{await rm(folder,{recursive:true,force:true});}
if(process.env.NODE_ENV==='production'&&!/^https:\/\//.test(process.env.SOCIALPLUS_ORIGIN||''))failures.push('SOCIALPLUS_ORIGIN HTTPS requis avant un démarrage en production.');
if(process.env.NODE_ENV==='production')for(const name of ['SOCIALPLUS_OWNER_ID','SOCIALPLUS_OWNER_TOTP_SECRET'])if(!process.env[name])failures.push(`${name} doit être configuré dans l’environnement privé.`);
for(const failure of failures)console.error(failure);
console.log(failures.length?'Préparation incomplète.':'Runtime prêt : Node, SQLite, FFmpeg H.264/AAC et sous-titres ASS. Aucun déploiement effectué.');
process.exitCode=failures.length?1:0;
