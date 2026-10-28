import {createHash} from 'node:crypto';
import {createReadStream} from 'node:fs';
import {readFile} from 'node:fs/promises';

// Reuse persisted evidence for the same owner/content/engine/configuration.
// This does not claim an uncached external model is intrinsically deterministic.
export async function replayAnalysis({db,userId,filePath,configuration,analyze,onReplay=async()=>{}}){
 const content=createHash('sha256');for await(const chunk of createReadStream(filePath))content.update(chunk);
 const sourceSha256=content.digest('hex');
 const engine=createHash('sha256');
 for(const name of ['viral.js','word-timing.js','display-frame.js'])engine.update(await readFile(new URL('./'+name,import.meta.url)));
 const engineSha256=engine.digest('hex');
 const settings=Object.fromEntries(Object.entries(configuration).sort(([a],[b])=>a.localeCompare(b)));
 const fingerprint=createHash('sha256').update(JSON.stringify({version:1,sourceSha256,engineSha256,settings})).digest('hex');
 const {data,error}=await db.from('viralplus_analyses').select('result_json')
  .eq('user_id',userId).eq('video_sha256',sourceSha256)
  .eq('result_json->reproducibility->>fingerprint',fingerprint)
  .order('created_at',{ascending:true}).limit(1).maybeSingle();
 if(error)throw Object.assign(new Error('Analyse sauvegardée inaccessible ; aucun nouvel appel IA lancé.'),{code:'ANALYSIS_REPLAY_UNAVAILABLE'});
 const saved=data?.result_json;
 if(saved&&saved.reproducibility?.fingerprint===fingerprint&&Number.isFinite(saved.final_score)&&saved.scores){
  await onReplay();return saved;
 }
 const result=await analyze();
 return {...result,source_sha256:sourceSha256,reproducibility:{version:1,fingerprint,engineSha256,configuration:settings,method:'persisted-first-result-per-owner-content-engine-config'}};
}
