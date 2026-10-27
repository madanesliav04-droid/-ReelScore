// Deployment admission only; artistic engines and normal runtime stay unchanged.
export function alexOnly(env){return env.SOCIALPLUS_ALEX_ONLY==='true';}
export function acceptsAlexJob(job){
  return job?.kind==='edit_render'&&job?.payload?.style==='hormozi_omni';
}
export function requiredRuntime(env){
  const required=['SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY'];
  if(alexOnly(env))required.push('SOCIALPLUS_ASR_MODEL_DIR');
  else required.push('GEMINI_API_KEY');
  const missing=required.filter(key=>!env[key]);
  if(alexOnly(env))for(const key of ['ALEX_V16_RECONSTRUCTION_ENABLED','ALEX_V16_REVIEW_DRAFTS']){
    if(env[key]!=='true')missing.push(key);
  }
  if(alexOnly(env)&&String(env.SUPABASE_URL||'').includes('eiypztjpmxdiuaqxjuqx'))missing.push('ISOLATED_SUPABASE_REQUIRED');
  return missing;
}
