import path from 'node:path';
import {mkdir} from 'node:fs/promises';
import {renderAlexV16} from '../src/alex-v16-pipeline.js';
const args=process.argv.slice(2);
const get=k=>args[args.indexOf(k)+1];
if(!args.includes('--input')||!args.includes('--output'))throw Error('Usage: node scripts/alex-v16-raw.mjs --input RUSH --output NEW.mp4 [--transcript SOURCE_BOUND.json] [--review-draft]');
const outputPath=path.resolve(get('--output')),workDir=outputPath+'.work';await mkdir(workDir,{recursive:true,mode:0o700});
const result=await renderAlexV16({sourcePath:path.resolve(get('--input')),outputPath,workDir,transcriptPath:args.includes('--transcript')?path.resolve(get('--transcript')):null,reviewDraft:args.includes('--review-draft'),onProgress:async(status,pct,stage)=>process.stderr.write(JSON.stringify({status,pct,stage})+'\n')});
console.log(JSON.stringify({outputPath:result.outputPath,bytes:result.bytes,reviewRequired:result.reviewRequired,referenceUsed:result.referenceUsed,issues:result.review.issues.length,qa:result.qa},null,2));
