import test from 'node:test';
import assert from 'node:assert/strict';
import {mediaDuration,planUgcCutaways,composeUgcRushes} from '../src/ugc-rush-compositor.js';

test('UGC never invents shots when no valid secondary rushes exist',()=>{
  assert.deepEqual(planUgcCutaways(28,[]),[]);
  assert.deepEqual(planUgcCutaways(28,[0,0.2,NaN]),[]);
  assert.deepEqual(planUgcCutaways(3,[10,10]),[]);
});

test('UGC supports dozens of supplied rushes but keeps a readable 28s rhythm',()=>{
  const plan=planUgcCutaways(28,Array.from({length:40},()=>9));
  assert.equal(plan.length,8);
  for(let i=0;i<plan.length;i++){
    const shot=plan[i];
    assert.equal(shot.index,i);
    assert.ok(shot.durationSeconds>0.8&&shot.durationSeconds<=2.1);
    assert.ok(shot.startSeconds>=0.6);
    assert.ok(shot.startSeconds+shot.durationSeconds<=28);
    if(i>0)assert.ok(shot.startSeconds>=plan[i-1].startSeconds+plan[i-1].durationSeconds);
  }
});

test('UGC drops unplayable or very short cutaways',()=>{
  const plan=planUgcCutaways(20,[0.1,1.3,0.5,4.5]);
  assert.deepEqual(plan.map(x=>x.index),[1,3]);
});

test('UGC retains primary voice and never maps a secondary audio track',async()=>{
  const calls=[];
  const exec=async(binary,args)=>{
    calls.push({binary,args});
    if(binary==='ffprobe')return args.at(-1)==='narration.mp4'?'28':'5';
    return '';
  };
  const out=await composeUgcRushes({
    sourcePath:'narration.mp4',rushPaths:['detail.mov','produit.mov'],
    outputPath:'output.mp4',workDir:'/tmp',
    exec
  });
  assert.equal(out.placements.length,2);
  const render=calls.filter(x=>x.binary==='ffmpeg').at(-1).args;
  assert.ok(render.includes('0:a?'));
  assert.equal(render.filter(x=>x==='-map').length,2);
  assert.ok(render.join(' ').includes('overlay='));
});

test('FFprobe duration rejects invalid output',async()=>{
  await assert.rejects(mediaDuration('broken.mp4',async()=>'-1'),/UGC_INVALID_DURATION/);
});
