import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtempSync,writeFileSync,rmSync,statSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {buildEditorialGraphicsAss} from '../src/render.js';

function run(command,args){
  return execFileSync(command,args,{encoding:'utf8',timeout:90000,stdio:['ignore','pipe','pipe']});
}

test('Editorial Breakdown exports a decodable video with timed numbers and grid',()=>{
  const dir=mkdtempSync(join(tmpdir(),'editorial-release-gate-'));
  try{
    const ass=join(dir,'editorial.ass'), mp4=join(dir,'editorial.mp4');
    const timeline={modelId:'editorial_breakdown',graphicCues:[
      {mode:'editorial_breakdown',evidence:'timestamped_transcript',startMs:900,endMs:2650,figures:['100€/h','168 heures'],kind:'comparison'},
      {mode:'editorial_breakdown',evidence:'timestamped_transcript',startMs:2700,endMs:3650,figures:['25%'],kind:'stat'}
    ]};
    const subs=buildEditorialGraphicsAss(timeline,360,640);
    assert.match(subs,/100€/);
    assert.match(subs,/168 heures/);
    assert.doesNotMatch(subs,/500€/);
    assert.ok(subs.split('\n').filter(l=>l.startsWith('Dialogue: ')).length>=5);
    writeFileSync(ass,subs,'utf8');
    run('ffmpeg',['-hide_banner','-loglevel','error','-y','-f','lavfi','-i','color=c=0x202025:s=360x640:r=20:d=4','-vf','ass='+ass,'-c:v','libx264','-preset','ultrafast','-pix_fmt','yuv420p','-movflags','+faststart','-t','4',mp4]);
    const probe=JSON.parse(run('ffprobe',['-v','error','-of','json','-show_streams','-show_format',mp4]));
    assert.equal(probe.streams[0].codec_name,'h264');
    assert.equal(probe.streams[0].width,360);
    assert.equal(probe.streams[0].height,640);
    assert.ok(Number(probe.format.duration)>3.5);
    assert.ok(statSync(mp4).size>2500);
    const fingerprint=t=>run('ffmpeg',['-hide_banner','-loglevel','error','-ss',String(t),'-i',mp4,'-frames:v','1','-f','framemd5','-']).split('\n').find(l=>l&&!l.startsWith('#'))||'';
    assert.notEqual(fingerprint(.25),fingerprint(1.8),'Editorial overlays must actually affect output pixels');
  }finally{rmSync(dir,{recursive:true,force:true})}
});
