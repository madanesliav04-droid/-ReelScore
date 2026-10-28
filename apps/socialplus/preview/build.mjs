// Package only the interface. No backend, user media, database or credentials.
import {readFile,writeFile,mkdir,copyFile,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';import {resolve,join} from 'node:path';
import {MODEL_CATALOG} from '../server/render.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const output=resolve(process.argv[2]||join(root,'.preview-build'));
if(output===root||root.startsWith(output+'/'))throw Error('Invalid build output');
await mkdir(output,{recursive:true});
const html=(await readFile(join(root,'public/index.html'),'utf8')).replace(/<!-- SOCIALPLUS_PWA_START -->[\s\S]*?<!-- SOCIALPLUS_PWA_END -->/,'').replace('src="/app.js"','src="/interface-preview.js"').replace('Espace privé','Aperçu privé').replace('<main id="main"','<main data-preview="interface-only" id="main"');
await writeFile(join(output,'index.html'),html);
await copyFile(join(root,'public/app.css'),join(output,'app.css'));
await copyFile(join(root,'preview/interface-preview.js'),join(output,'interface-preview.js'));
await writeFile(join(output,'catalog.json'),JSON.stringify(MODEL_CATALOG.map(m=>({id:m.id,label:m.label,version:m.version,connected:false,releaseApproved:false})),null,2));
console.log(JSON.stringify({output,mode:'interface_only',enginesConnected:false,staticFiles:4}));
