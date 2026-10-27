// Bounded checks of an explicitly isolated backend. No media upload, render or claim RPC.
import {readFile} from 'node:fs/promises';import {createRequire} from 'node:module';
import {validateCost} from './prepare.mjs';
const require=createRequire(new URL('../../apps/worker/package.json',import.meta.url));
const {createClient}=require('@supabase/supabase-js');
const plan=JSON.parse(await readFile(process.argv[2],'utf8'));
if(validateCost(plan).length)throw Error('Validated zero-extra-cost evidence is required first');
const url=process.env.BETA_SUPABASE_URL,key=process.env.BETA_SUPABASE_PUBLIC_KEY,service=process.env.BETA_SUPABASE_SERVICE_KEY;
if(!/^[a-z]{20}$/.test(plan.supabase?.projectRef||'')||plan.supabase.projectRef==='eiypztjpmxdiuaqxjuqx'||url!==`https://${plan.supabase.projectRef}.supabase.co`)throw Error('Refusing non-isolated or mismatched backend');
if(!key||!service||!process.env.BETA_TEST_CREDENTIALS)throw Error('Load isolated keys and private test-credentials path through a private environment file');
const credentials=JSON.parse(await readFile(process.env.BETA_TEST_CREDENTIALS,'utf8'));
const config={auth:{persistSession:false,autoRefreshToken:false}},admin=createClient(url,service,config),member=createClient(url,key,config),checks={};
try{
 const settings=await fetch(url+'/auth/v1/settings',{headers:{apikey:key}});if(!settings.ok||(await settings.json()).disable_signup!==true)throw Error('Public signup must be disabled');checks.signupDisabled=true;
 const bucket=await admin.storage.getBucket('viralplus-videos');if(bucket.error||!bucket.data||bucket.data.public!==false)throw Error('Private bucket missing');checks.privateBucket=true;
 for(const table of ['media_assets','processing_jobs','job_events','edit_projects','edit_timelines','edit_exports']){
  const {error}=await admin.from(table).select('id').limit(0);if(error)throw Error('Schema or access not ready: '+table);
 }checks.tablesReadable=true;
 const login=await member.auth.signInWithPassword({email:credentials.email,password:credentials.password});if(login.error||!login.data.session)throw Error('Real isolated test-account login failed');checks.realLogin=true;
 const token=login.data.session.access_token,headers={Authorization:'Bearer '+token,'Content-Type':'application/json'};
 const denied=await fetch(url+'/functions/v1/viral-edit-jobs/storage-config',{headers:{apikey:key}});if(denied.status!==401)throw Error('Anonymous function access is not denied');checks.anonymousDenied=true;
 const storage=await fetch(url+'/functions/v1/viral-edit-jobs/storage-config',{headers});if(storage.status!==200||(await storage.json()).provider!=='supabase')throw Error('Authenticated Edge/storage route not ready');checks.authenticatedEdge=true;
 const analysis=await fetch(url+'/functions/v1/viral-edit-jobs/analysis',{method:'POST',headers,body:'{}'});if(analysis.status!==403||(await analysis.json()).error!=='BETA_ALEX_ONLY')throw Error('Alex-only Edge admission is not active');checks.paidAnalysisDisabled=true;
 const owned=await member.from('media_assets').select('id').limit(0);if(owned.error)throw Error('Authenticated media policy access failed');checks.memberReadPermission=true;
 console.log(JSON.stringify({ok:true,checks,scope:'Isolated backend setup only; no upload/render/Safari/ownership-cross-account test performed'},null,2));
}finally{await member.auth.signOut().catch(()=>{});}
