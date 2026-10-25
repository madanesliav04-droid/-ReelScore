// Build-time only: reuses the locked compositor; never runs on the phone.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {referenceKineticHtml} from '../../apps/socialplus/server/kinetic-reference.mjs';
import {renderFont} from '../../apps/socialplus/server/render-fonts.mjs';
const require=createRequire(new URL('../../apps/socialplus/package.json',import.meta.url));
const [planFile,sourceFile]=process.argv.slice(2);
if(!planFile||!sourceFile)throw Error('Usage: node prototypes/ios-v28/prepare.mjs plan.json rush.mov');
const release=JSON.parse(await readFile(new URL('../../apps/socialplus/engines/releases/social-kinetic-v28.json',import.meta.url)));
for(const [file,sha] of Object.entries(release.files)){
 const bytes=await readFile(new URL('../../apps/socialplus/'+file,import.meta.url));
 const hash=value=>createHash('sha256').update(value).digest('hex');
 // Historical GitHub upload omitted one final LF. Accept only the exact
 // locked bytes after adding that LF, never arbitrary whitespace/content changes.
 if(hash(bytes)!==sha && hash(Buffer.concat([bytes,Buffer.from('\n')]))!==sha)throw Error('Locked source changed: '+file);
}
const plan=JSON.parse(await readFile(planFile));
if(!plan.referenceDirection||!plan.referenceWords)throw Error('Reviewed referenceDirection and referenceWords required. No generic fallback.');
if(plan.cuts?.length||plan.keepRanges?.length)throw Error('Cut mapping is outside this first compatibility experiment.');
let html=await referenceKineticHtml(plan);
const gsap=await readFile(require.resolve('gsap/dist/gsap.min.js'),'utf8');
html=html.replace(/<script src="https:[^"]+"><\/script>/,()=>'<script>'+gsap.replace(/<\/script/gi,'<\\/script')+'</script>');
const aliases=['Inter-SemiBold.otf','Inter-Medium.otf','Inter-ExtraBold.otf'];
const fonts=await Promise.all(aliases.map(async alias=>{const f=renderFont(alias);return `@font-face{font-family:"${f.family}";src:url(data:font/ttf;base64,${(await readFile(f.path)).toString('base64')})}`;}));
html=html.replace('</style>',fonts.join('')+`.caption .inner{font-family:"${renderFont(aliases[0]).family}"}.bubble .inner{font-family:"${renderFont(aliases[1]).family}"}.hero .inner{font-family:"${renderFont(aliases[2]).family}"}</style>`);
// Viewport and snapshot bridge only; no change to the animation timeline.
html=html.replace('<head>','<head><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">');
html=html.replace('</head>',`<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; font-src data:; img-src data:"></head>`);
const out=new URL('./Resources/',import.meta.url);await mkdir(out,{recursive:true});
await writeFile(new URL('composition.html',out),html);
await writeFile(new URL('fixture.json',out),JSON.stringify({width:plan.width,height:plan.height,durationMs:plan.durationMs,sourceSha256:createHash('sha256').update(await readFile(sourceFile)).digest('hex'),release:release.id},null,2));
console.log('Private composition prepared. No media copied, no rendering, no upload.');
