import test from 'node:test';
import assert from 'node:assert/strict';
import {renderWithHyperframes} from '../src/hyperframes-renderer.js';

test('HyperFrames is disabled until explicitly activated',async()=>{
  const old=process.env.ENABLE_HYPERFRAMES_RENDER;
  delete process.env.ENABLE_HYPERFRAMES_RENDER;
  try{
    await assert.rejects(renderWithHyperframes({compositionDir:'/tmp/demo',outputPath:'/tmp/demo.mp4'}),/HYPERFRAMES_DISABLED/);
  }finally{
    if(old===undefined) delete process.env.ENABLE_HYPERFRAMES_RENDER;
    else process.env.ENABLE_HYPERFRAMES_RENDER=old;
  }
});
test('Missing local composition/output is rejected before spawning',async()=>{
  const old=process.env.ENABLE_HYPERFRAMES_RENDER;
  process.env.ENABLE_HYPERFRAMES_RENDER='true';
  try{
    await assert.rejects(renderWithHyperframes({compositionDir:'',outputPath:'/tmp/demo.mp4'}),/compositionDir/);
  }finally{
    if(old===undefined) delete process.env.ENABLE_HYPERFRAMES_RENDER;
    else process.env.ENABLE_HYPERFRAMES_RENDER=old;
  }
});
