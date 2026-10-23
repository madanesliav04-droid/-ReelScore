// Private local validation: no uploads, no APIs and no model downloads.
// Plan words/cuts/zones must refer to the supplied rush, never a reference master.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {analyzeSource,renderVideo} from '../server/render.mjs';
import {buildLocalEdit} from '../server/local-edit.mjs';
const [source,planFile,destination]=process.argv.slice(2);
if(!source||!planFile||!destination)throw Error('Usage: node scripts/render-real-rush.mjs SOURCE PLAN.json PRIVATE_OUTPUT_DIR');
const sourcePath=resolve(source),out=resolve(destination),plan=JSON.parse(await readFile(planFile));
await mkdir(out,{recursive:true,mode:0o700});
const report=await analyzeSource(sourcePath);
if(plan.sourceSha256!==report.fingerprint)throw Error('Le plan ne correspond pas à ce rush.');
const ids=plan.approvedPauseIds??report.suggestions.map(p=>p.id);
// A rejected pause is held rather than forced. ASR words add a 120ms guard.
const approvedPauseIds=ids.filter(id=>{try{buildLocalEdit({report,approvedPauseIds:[id],transcript:plan.transcript,captionsReviewed:plan.captionsReviewed,previewOnly:plan.allowUnreviewedPreview});return true;}catch{return false;}});
const localEdit={report,approvedPauseIds,transcript:plan.transcript,captionsReviewed:plan.captionsReviewed,previewOnly:plan.allowUnreviewedPreview};
const edit=buildLocalEdit(localEdit);
await writeFile(join(out,'edit-map.json'),JSON.stringify({fingerprint:report.fingerprint,cuts:edit.cuts,keepRanges:edit.keepRanges,outputDurationMs:edit.outputDurationMs,captionReview:plan.captionsReviewed?'confirmed':'asr_preview'},null,2),{mode:0o600});
const results=[];
for(const [modelId,events] of Object.entries(plan.modelEvents)){
 if(process.env.SOCIALPLUS_TEST_MODELS&&!process.env.SOCIALPLUS_TEST_MODELS.split(',').includes(modelId))continue;
 console.log('START',modelId);
 const result=await renderVideo({sourcePath,outputPath:join(out,modelId+'.mp4'),modelId,localEdit,restoredInput:{...plan,events},onProgress:async(progress,message)=>console.log(modelId,progress,message)});
 results.push(result);
 await writeFile(join(out,modelId+'.result.json'),JSON.stringify(result,null,2),{mode:0o600});
 console.log('PASS',modelId,JSON.stringify(result.metadata));
}
await writeFile(join(out,'results.json'),JSON.stringify(results,null,2),{mode:0o600});
