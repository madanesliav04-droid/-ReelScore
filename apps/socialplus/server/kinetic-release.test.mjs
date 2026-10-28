import test from 'node:test';import assert from 'node:assert/strict';
import {assertKineticRelease,reviewedKineticDirection,transcriptFingerprint,KINETIC_RELEASE} from './kinetic-release.mjs';
test('owner-approved V28 renderer files remain locked, unrelated rushes cannot inherit its direction',()=>{
 assert.equal(assertKineticRelease(),KINETIC_RELEASE);
 assert.equal(reviewedKineticDirection({sourceSha256:'another-rush'},[{text:'Test',startMs:0,endMs:200}]).direction,null);
 assert.equal(reviewedKineticDirection({},null).direction,null);
 assert.equal(transcriptFingerprint([{text:'Test',start:.1,end:.2}]),transcriptFingerprint([{text:'Test',startMs:100,endMs:200,confirmed:true}]));
 assert.notEqual(transcriptFingerprint([{text:'Test',startMs:100,endMs:200}]),transcriptFingerprint([{text:'Autre',startMs:100,endMs:200}]));
});
