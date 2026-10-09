import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {buildClipVideoFilter,buildClipCaptionAss} from '../src/clip-presentation.js';

test('FFmpeg renders uncropped portrait and landscape with mobile captions',()=>{
  for(const input of ['360x640','640x360']){
    const folder=mkdtempSync(join(tmpdir(),'clip-frame-smoke-'));
    try{
      const ass=join(folder,'caption.ass');
      const out=join(folder,'result.mp4');
      writeFileSync(ass,buildClipCaptionAss([
        {startMs:0,endMs:80,text:'Phrase'},{startMs:90,endMs:160,text:'importante.'}
      ],0,400,'modern_bold'),'utf8');
      const run=spawnSync('ffmpeg',[
        '-hide_banner','-loglevel','error','-y',
        '-f','lavfi','-i',`testsrc2=size=${input}:rate=30:duration=0.2`,
        '-vf',buildClipVideoFilter(ass),
        '-frames:v','3','-c:v','libx264','-preset','ultrafast','-pix_fmt','yuv420p',out
      ],{encoding:'utf8',timeout:45000});
      assert.equal(run.status,0,run.stderr);
      const probe=spawnSync('ffprobe',['-v','error','-select_streams','v:0','-show_entries','stream=width,height','-of','csv=p=0',out],{encoding:'utf8'});
      assert.equal(probe.status,0,probe.stderr);
      assert.equal(probe.stdout.trim(),'1080,1920');
    }finally{rmSync(folder,{force:true,recursive:true})}
  }
});
