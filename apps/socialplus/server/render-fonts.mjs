import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
export const FONT_DIR=fileURLToPath(new URL('../engines/fonts/',import.meta.url));
export const FONT_MANIFEST=JSON.parse(readFileSync(join(FONT_DIR,'manifest.json'),'utf8'));
export function renderFont(alias){const file=FONT_MANIFEST.aliases[alias];if(!file)throw Error('Unknown render font: '+alias);return {...FONT_MANIFEST.fonts[file],file,path:join(FONT_DIR,file)};}
