import test from 'node:test';
import assert from 'node:assert/strict';
import {brollArtDirection,brollDirectionPrompt} from '../src/broll-art-direction.js';

test('nine editorial models have differentiated art directions',()=>{
  const ids=['codie','impact','clean','authority','explainer','data','ugc_native','cinematic_story','editorial_breakdown'];
  const styles=ids.map(id=>brollArtDirection(id).style);
  assert.equal(new Set(styles).size,ids.length);
  for(const id of ids){
    const prompt=brollDirectionPrompt(id);
    assert.ok(prompt.includes(brollArtDirection(id).composition));
    assert.ok(prompt.includes('Pinterest comme référence de style'));
    assert.ok(prompt.includes('PAS une source de téléchargement'));
  }
});
test('legacy model aliases preserve correct art direction',()=>{
  assert.deepEqual(brollArtDirection('creator_clean'),brollArtDirection('clean'));
  assert.deepEqual(brollArtDirection('business_viral'),brollArtDirection('impact'));
  assert.deepEqual(brollArtDirection('podcast_authority'),brollArtDirection('authority'));
});
test('unknown model defaults to conservative clean art direction',()=>{
  assert.deepEqual(brollArtDirection('missing'),brollArtDirection('clean'));
});
