import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {planUsefulIOSBloopSounds,synthIOSLikeBloop,writeIOSBubbleSfxTrack,renderIOSAudioWithOriginalVoice} from '../src/social-kinetic-v15-ios-audio.js';
const events=[
 [27570,'point_1_explicit','1er des points'],
 [30170,'point_2_explicit','2e des points'],
 [36080,'benefit_1_enumeration','gagner du temps'],
 [37520,'benefit_2_enumeration',"gagner de l'argent"],
 [38910,'benefit_3_enumeration','résoudre un problème']
].map(([outputStartMs,semanticReason,sourcePhrase],i)=>({
 id:'bubble_'+i,outputStartMs,semanticReason,sourcePhrase,
 speechVerified:true,onScreenBubbleVerified:true
}));
test('Only five verified meaningful source-grounded SMS elements produce five sounds',()=>{
 const p=planUsefulIOSBloopSounds({durationMs:42030,events});
 assert.equal(p.status,'ready');
 assert.equal(p.cues.length,5);
 assert.deepEqual(p.cues.map(c=>c.timestampMs),[27570,30170,36080,37520,38910]);
 assert.equal(p.officialAppleAsset,false);
});
test('Decorative and unsourced bubbles cannot activate a pop',()=>{
 const p=planUsefulIOSBloopSounds({durationMs:42030,events:[
  {...events[0],speechVerified:false},
  {...events[1],sourcePhrase:''},
  {...events[2],onScreenBubbleVerified:false},
  {id:'random_message',outputStartMs:12300,sourcePhrase:'bonjour',semanticReason:'decoration',speechVerified:true,onScreenBubbleVerified:true},
 ]});
 assert.equal(p.cues.length,0);
 assert.equal(p.held.length,4);
});
test('No duplicated sound for same bubble or overlapping layout animation',()=>{
 const p=planUsefulIOSBloopSounds({durationMs:42030,events:[
  events[0],{...events[0]}, {...events[1],outputStartMs:27590}
 ]});
 assert.equal(p.cues.length,1);
});
test('iOS-like bloup is short, smooth and deterministic across repeats',()=>{
 const a=synthIOSLikeBloop(),b=synthIOSLikeBloop();
 assert.equal(a.length,11280);
 assert.deepEqual(a,b);
 assert.ok(Math.max(...a)<.09);
 assert.ok(Math.abs(a[0])<.005);
 assert.ok(Math.abs(a.at(-1))<.0001);
});
test('Five bubble cues yield a real stereo WAV with silence outside meaningful moments',async()=>{
 const p=planUsefulIOSBloopSounds({durationMs:42030,events});
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'ios-bloup-'));
 const file=path.join(dir,'sound.wav');
 try{
  const result=await writeIOSBubbleSfxTrack({filePath:file,plan:p,durationMs:42030});
  const raw=await fs.readFile(file);
  assert.equal(result.renderedCues,5);
  assert.equal(raw.subarray(0,4).toString('ascii'),'RIFF');
  assert.equal(raw.readUInt16LE(22),2);
  assert.equal(raw.readUInt32LE(24),48000);
  // PCM16 stereo, 10sec before first bubble should have no noise.
  const start=44+Math.round(10*48000)*4;
  assert.equal(raw.readInt16LE(start),0);
  // Event 27.57 sec must be non-silent and attached after intended onset.
  const onset=44+Math.round(27.625*48000)*4;
  assert.notEqual(raw.readInt16LE(onset),0);
 }finally{await fs.rm(dir,{recursive:true,force:true})}
});

test('Selected genuine-sound mode forbids silent fallback to rejected synthetic bloup',async()=>{
 const plan=planUsefulIOSBloopSounds({durationMs:42030,events});
 await assert.rejects(
  renderIOSAudioWithOriginalVoice({
   postCutsSourceVideo:'original.mp4',outputAudioFile:'test.aac',
   plan,durationMs:42030,privatePreviewOnly:true
  }),/IOS_SELECTED_SOUND_REQUIRED_NO_SYNTHETIC_FALLBACK/);
});
test('Unlicensed authentic sound cannot be included in paid exports',async()=>{
 const plan=planUsefulIOSBloopSounds({durationMs:42030,events});
 await assert.rejects(
  renderIOSAudioWithOriginalVoice({
   postCutsSourceVideo:'original.mp4',outputAudioFile:'test.aac',
   plan,durationMs:42030,approvedSoundAssetPath:'apple-system.m4a'
  }),/IOS_SFX_COMMERCIAL_RIGHTS_NOT_VERIFIED/);
});
