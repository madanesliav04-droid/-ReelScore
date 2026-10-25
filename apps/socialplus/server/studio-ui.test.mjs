import test from 'node:test';
import assert from 'node:assert/strict';
import {MODEL_ORDER,projectStatus,acousticScore,sourceMeta,transcriptRows} from '../public/studio-ui.js';
test('presentation preserves uncertainty and escapes user words before rendering',()=>{
 const html=transcriptRows([{text:'<img src=x onerror=alert(1)>',startMs:120,endMs:500,reviewRequired:true},{text:'y a',start:1,end:1.1}]);
 assert.ok(!html.includes('<img'));assert.ok(html.includes('&lt;img'));
 assert.equal((html.match(/class="word-flag"/g)||[]).length,2);assert.ok(html.includes('0.12 s'));
});
test('technical score remains unavailable without measured criteria and is reproducible',()=>{
 assert.equal(acousticScore({criteria:{}}),null);
 const report={criteria:{a:{score:70},b:{score:90},unavailable:{score:null}}};
 assert.equal(acousticScore(report),80);assert.equal(acousticScore(report),acousticScore(structuredClone(report)));
 assert.equal(MODEL_ORDER.length,6);assert.equal(new Set(MODEL_ORDER).size,6);
});
test('project states expose failed/recoverable work and bound only genuine progress',()=>{
 assert.equal(projectStatus({state:'rendering',latestJob:{progress:120}}).label,'Montage · 99 %');
 assert.equal(projectStatus({state:'ready',latestJob:{state:'failed'}}).label,'À reprendre');
 assert.equal(projectStatus({state:'complete',has_output:true}).label,'MP4 prêt');
 assert.ok(sourceMeta({metadata:{width:360,height:640,durationMs:2000}}).includes('vertical'));
});
