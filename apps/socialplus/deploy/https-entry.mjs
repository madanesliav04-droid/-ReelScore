// Generate only after an isolated HTTPS backend and its cost are approved.
// Vercel is an authenticated entry point; the unchanged app runs on the backend
// origin so Safari does not depend on third-party cookies or upload proxies.
import {writeFile} from 'node:fs/promises';import {pathToFileURL} from 'node:url';
export function httpsEntry(origin){
 let url;try{url=new URL(origin);}catch{throw Error('Une origine HTTPS Railway isolée est requise.');}
 if(url.protocol!=='https:'||url.username||url.password||url.port||url.pathname!=='/'||url.search||url.hash||!url.hostname.endsWith('.up.railway.app'))throw Error('Utilisez uniquement l’origine HTTPS de l’instance Railway de test, sans secret ni chemin.');
 return {version:2,redirects:[{source:'/:path*',destination:url.origin+'/:path*',permanent:false}],headers:[{source:'/(.*)',headers:[{key:'X-Robots-Tag',value:'noindex, nofollow'},{key:'Cache-Control',value:'no-store'}]}]};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const [, ,origin,output]=process.argv;if(!output)throw Error('Commande : node deploy/https-entry.mjs https://INSTANCE-DE-TEST.up.railway.app /DOSSIER-DE-TEST/vercel.json');
 await writeFile(output,JSON.stringify(httpsEntry(origin),null,2)+'\n');console.log('Configuration créée uniquement. Aucun déploiement ni activation.');
}
