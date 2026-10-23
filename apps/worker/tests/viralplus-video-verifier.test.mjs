import test from 'node:test';
import assert from 'node:assert/strict';
import {verifyWithVideo,applyVideoReview} from '../src/viral-verifier.js';
const semantic={
  hook_candidates:[{proposed_hook:'UGC restaurant spécifique',source_quote:'UGC restaurant'}],
  fix_plan:[{area:'hook',exact_change:'Réécrire l’accroche'},{area:'audio',exact_change:'Augmenter le volume'}],
  recommended_title:'Les bases de la collaboration UGC restaurant',
  recommended_cta:'Commente UGC pour le restaurant'
};
const opts={
  fileUri:'files/test',mimeType:'video/mp4',apiKey:'test-key',
  primaryModel:'primary',fallbackModel:'reviewer',
  semantic,transcript:{text:'Je parle de collaboration UGC restaurant'},measurable:{durationSec:20}
};
test('challenge pass only allows independently approved video-grounded items',async()=>{
  const mock=async(url,init)=>{
    assert.match(url,/models\/reviewer/);
    const payload=JSON.parse(init.body);
    assert.equal(payload.contents[0].parts[0].file_data.file_uri,'files/test');
    return {ok:true,json:async()=>({candidates:[{content:{parts:[{text:JSON.stringify({
      approved_hook_indices:[0,100,-1],approved_fix_indices:[0],
      approve_title:true,approve_cta:false,brief_reason:'Les autres éléments ne sont pas prouvés.'
    })}]}}]})};
  };
  const report=await verifyWithVideo({...opts,fetcher:mock});
  assert.equal(report.status,'video_review_completed');
  assert.deepEqual(report.approved_hook_indices,[0]);
  assert.deepEqual(report.approved_fix_indices,[0]);
  const clean=applyVideoReview(semantic,report);
  assert.equal(clean.hook_candidates.length,1);
  assert.equal(clean.fix_plan.length,1);
  assert.equal(clean.recommended_title,semantic.recommended_title);
  assert.equal(clean.recommended_cta,'');
});
test('review failure suppresses all unsupported advice, preserving original source',async()=>{
  const fail=async()=>{throw Error('provider down')};
  const review=await verifyWithVideo({...opts,fetcher:fail});
  assert.equal(review.status,'verification_unavailable');
  const result=applyVideoReview(semantic,review);
  assert.equal(result.hook_candidates.length,0);
  assert.equal(result.fix_plan.length,0);
  assert.equal(result.recommended_title,'');
  assert.equal(result.recommended_cta,'');
  assert.equal(semantic.fix_plan.length,2);
});
test('invalid reviewer schema cannot approve advice',async()=>{
  const mock=async()=>({ok:true,json:async()=>({candidates:[{content:{parts:[{text:'{"approved_hook_indices":[0]}'}]}}]})});
  const reviewed=await verifyWithVideo({...opts,fetcher:mock});
  assert.equal(reviewed.status,'verification_unavailable');
});

test('independent reviewer flags implausible score rationale without fabricating a corrected score',async()=>{
 const scored={...opts,semantic:{...semantic,
  scores:{hook:90,visual:20,rhythm:30,retention:45},
  score_evidence:{visual:'A native 16:9 frame was penalized for not being portrait.'}
 }};
 const mock=async()=>({ok:true,json:async()=>({candidates:[{content:{parts:[{text:JSON.stringify({
  approved_hook_indices:[],approved_fix_indices:[],approve_title:false,approve_cta:false,
  score_review:{disputed_keys:['visual','rhythm','unknown'],brief_reason:'Le plan fixe est intentionnel et le critère visuel est injustifié.'}
 })}]}}]})});
 const review=await verifyWithVideo({...scored,fetcher:mock});
 assert.equal(review.score_review.status,'completed');
 assert.deepEqual(review.score_review.disputed_keys,['visual','rhythm']);
 const applied=applyVideoReview(scored.semantic,review);
 assert.equal(applied.score_review.disputed_keys.length,2);
 assert.equal(applied.scores.visual,20); // disagreement is disclosed, never silently overwritten
});

test('transient 429 is retried on independent reviewer and recovers without using primary',async()=>{
 let calls=[];
 const fetcher=async(url)=>{
  calls.push(url);
  if(calls.length===1)return {ok:false,status:429};
  return {ok:true,json:async()=>({candidates:[{content:{parts:[{text:JSON.stringify({
   approved_hook_indices:[0],approved_fix_indices:[0],approve_title:false,approve_cta:false,
   score_review:{disputed_keys:[],brief_reason:'Evidence reviewed against source video.'}
  })}]}}]})};
 };
 const report=await verifyWithVideo({...opts,fetcher});
 assert.equal(report.status,'video_review_completed');
 assert.equal(report.attempts,2);
 assert.equal(calls.length,2);
 assert.ok(calls.every(x=>x.includes('/models/reviewer:')));
 assert.deepEqual(report.approved_fix_indices,[0]);
});
test('permanent invalid schema moves to next model without retrying defective model',async()=>{
 let calls=[];
 const fetcher=async(url)=>{
  calls.push(url);
  if(url.includes('/models/reviewer:'))return {ok:true,json:async()=>({candidates:[{content:{parts:[{text:'{}'}]}}]})};
  return {ok:true,json:async()=>({candidates:[{content:{parts:[{text:JSON.stringify({
   approved_hook_indices:[],approved_fix_indices:[],approve_title:false,approve_cta:false,
   score_review:{disputed_keys:[],brief_reason:'None verified.'}
  })}]}}]})};
 };
 const result=await verifyWithVideo({...opts,fetcher});
 assert.equal(result.status,'video_review_completed');
 assert.equal(result.attempts,2);
 assert.equal(calls.filter(x=>x.includes('/models/reviewer:')).length,1);
 assert.equal(calls.filter(x=>x.includes('/models/primary:')).length,1);
});
test('repeated server errors fail closed after bounded retries, recording provider errors',async()=>{
 let attempts=0;
 const always503=async()=>{attempts++;return {ok:false,status:503};};
 const result=await verifyWithVideo({...opts,fetcher:always503});
 assert.equal(result.status,'verification_unavailable');
 assert.equal(result.attempts,4);
 assert.equal(attempts,4);
 assert.equal(result.failures.length,4);
 assert.deepEqual(result.approved_fix_indices,[]);
 assert.deepEqual(applyVideoReview(semantic,result).fix_plan,[]);
});
