import test from 'node:test';import assert from 'node:assert/strict';
import {alexOnly,acceptsAlexJob,requiredRuntime} from '../src/alex-beta-policy.js';
test('default runtime preserves Gemini requirement and exact opt-in',()=>{
  assert.equal(alexOnly({SOCIALPLUS_ALEX_ONLY:'false'}),false);
  assert.deepEqual(requiredRuntime({SUPABASE_URL:'local',SUPABASE_SERVICE_ROLE_KEY:'test'}),['GEMINI_API_KEY']);
});
test('offline Alex requires real ASR configuration and review gates, no paid key',()=>{
  const e={SOCIALPLUS_ALEX_ONLY:'true',SUPABASE_URL:'local',SUPABASE_SERVICE_ROLE_KEY:'test'};
  assert.deepEqual(requiredRuntime(e),['SOCIALPLUS_ASR_MODEL_DIR','ALEX_V16_RECONSTRUCTION_ENABLED','ALEX_V16_REVIEW_DRAFTS']);
  Object.assign(e,{SOCIALPLUS_ASR_MODEL_DIR:'/models',ALEX_V16_RECONSTRUCTION_ENABLED:'true',ALEX_V16_REVIEW_DRAFTS:'true'});
  assert.deepEqual(requiredRuntime(e),[]);
  e.SUPABASE_URL='https://eiypztjpmxdiuaqxjuqx.supabase.co';
  assert.ok(requiredRuntime(e).includes('ISOLATED_SUPABASE_REQUIRED'));
});
test('offline worker rejects analysis and every non-Alex job before any media work',()=>{
  assert.equal(acceptsAlexJob({kind:'edit_render',payload:{style:'hormozi_omni'}}),true);
  for(const job of [null,{}, {kind:'viral_analysis',payload:{style:'hormozi_omni'}},...['leila','codie','social_kinetic','cinematic_story','ugc_native'].map(style=>({kind:'edit_render',payload:{style}}))])assert.equal(acceptsAlexJob(job),false);
});
