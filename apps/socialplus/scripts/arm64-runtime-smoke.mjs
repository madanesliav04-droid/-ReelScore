// Synthetic technical test only. No real speech, owner data or model QA claim.
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {renderVideo,run} from '../server/render.mjs';
import {assertKineticRelease} from '../server/kinetic-release.mjs';
import {createApp} from '../server/index.mjs';
assert.equal(process.arch,'arm64','Native ARM64 required; an x86 pass is not an ARM pass');
assert.equal(process.platform,'linux');
assert.equal(Number(process.versions.node.split('.')[0]),24);
const root=await mkdtemp(join(tmpdir(),'socialplus-arm-test-'));
let app;
try{
 assertKineticRelease();
 const source=join(root,'synthetic.mp4'),output=join(root,'output.mp4');
 await run('ffmpeg',['-v','error','-f','lavfi','-i','testsrc2=size=320x568:rate=30','-f','lavfi','-i','sine=frequency=440:sample_rate=48000','-t','2','-c:v','libx264','-c:a','aac','-pix_fmt','yuv420p',source]);
 const started=performance.now();
 const result=await renderVideo({sourcePath:source,outputPath:output,modelId:'social-kinetic-v28',restoredInput:{transcript:[{text:'TEST',startMs:100,endMs:400},{text:'ARM64',startMs:400,endMs:900},{text:'LOCAL',startMs:1200,endMs:1700}],events:[],placementReviewed:true,captionsReviewed:false,allowUnreviewedPreview:true,kineticDirection:{layout:{hero:[.08,.08,.84,.18],chat:[.14,.32,.72,.07],captionLeft:[.08,.67,.8,.12],captionRight:[.12,.67,.8,.12]},impacts:[{firstWord:0,accentWord:1,lastWord:1}],bubbles:[],captionRuns:[]}}});
 const renderSeconds=(performance.now()-started)/1000;
 assert.equal(result.metadata.width,320);assert.equal(result.metadata.height,568);assert.equal(result.metadata.audioStreams,1);
 await run('ffmpeg',['-v','error','-i',output,'-f','null','-']);
 // Verify audio by decoded samples, never merely by presence of a track.
 for(const [path,name] of [[source,'source'],[output,'output']])await run('ffmpeg',['-v','error','-i',path,'-map','0:a:0','-f','s16le',join(root,name+'.pcm')]);
 assert.deepEqual(await readFile(join(root,'source.pcm')),await readFile(join(root,'output.pcm')));
 const asr=await run(process.env.SOCIALPLUS_ASR_PYTHON,['-c',`import json,platform,numpy as np,ctranslate2,faster_whisper,av,onnxruntime,os
from faster_whisper import WhisperModel
assert platform.machine() in ('aarch64','arm64')
assert 'int8' in ctranslate2.get_supported_compute_types('cpu')
m=WhisperModel(os.environ['SOCIALPLUS_ASR_MODEL_DIR'],device='cpu',compute_type='int8',cpu_threads=2,local_files_only=True)
segments,info=m.transcribe(np.zeros(16000,dtype=np.float32),language='fr',beam_size=5,word_timestamps=True,temperature=0,vad_filter=False)
list(segments)
print(json.dumps({'platform':platform.machine(),'fasterWhisper':faster_whisper.__version__,'ctranslate2':ctranslate2.__version__,'av':av.__version__,'onnxruntime':onnxruntime.__version__,'localInt8Inference':True,'realSpeechAccuracyTested':False}))`],{timeoutMs:600_000});
 app=await createApp({dataDir:join(root,'db'),origin:'https://example.invalid'});
 await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));
 const url='http://127.0.0.1:'+app.server.address().port;
 assert.equal((await fetch(url+'/healthz')).status,200);
 assert.equal((await fetch(url+'/api/projects')).status,401);
 assert.equal((await fetch(url+'/manifest.webmanifest')).status,200);
 console.log(JSON.stringify({synthetic:true,architecture:process.arch,node:process.version,renderSeconds,metadata:result.metadata,fullDecode:true,audioPcmIdentical:true,lockedReleaseVerified:true,sqliteAndUnauthorizedAccessChecked:true,asr:JSON.parse(asr.stdout),outputSha256:createHash('sha256').update(await readFile(output)).digest('hex'),realRushOrSafariTested:false}));
}finally{
 if(app){await new Promise(resolve=>app.server.close(resolve));await app.projects.shutdown();app.releaseRuntime();app.db.close();}
 await rm(root,{recursive:true,force:true});
}
