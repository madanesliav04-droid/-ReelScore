// Restore only a historical transport's missing final LF, never engine logic.
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const root=new URL('../',import.meta.url);
const release=JSON.parse(await readFile(new URL('engines/releases/social-kinetic-v28.json',root)));
for(const [name,expected] of Object.entries(release.files)){
 const url=new URL(name,root),bytes=await readFile(url);
 const hash=b=>createHash('sha256').update(b).digest('hex');
 if(hash(bytes)===expected)continue;
 const restored=Buffer.concat([bytes,Buffer.from('\n')]);
 if(hash(restored)!==expected)throw Error('Locked V28 runtime differs: '+name);
 if(!process.argv.includes('--restore-terminal-lf'))throw Error('Missing terminal LF: '+name);
 await writeFile(url,restored);
}
console.log('Locked V28 bytes verified.');
