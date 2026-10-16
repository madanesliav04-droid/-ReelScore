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
