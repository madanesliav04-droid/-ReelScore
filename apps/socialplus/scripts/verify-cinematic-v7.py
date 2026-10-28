"""Verify one real Cinematic export against its own source and generated plan."""
import sys,json,subprocess,hashlib
from pathlib import Path
import numpy as np
from PIL import Image,ImageDraw
if len(sys.argv)!=3:raise SystemExit('python verify-cinematic-v7.py SOURCE OUTPUT.mp4')
source=Path(sys.argv[1]);output=Path(sys.argv[2]);plan=json.loads(Path(str(output)+'.plan.json').read_text());result=json.loads(Path(str(output)+'.result.json').read_text());folder=output.parent
check=lambda args:subprocess.check_output(args)
def probe(p):return json.loads(check(['ffprobe','-v','error','-show_streams','-show_format','-of','json',str(p)]))
a,b=probe(source),probe(output);av=next(s for s in a['streams'] if s['codec_type']=='video');bv=next(s for s in b['streams'] if s['codec_type']=='video');aud=[s for s in b['streams'] if s['codec_type']=='audio']
assert (bv['width'],bv['height'])==(av['width'],av['height'])
assert bv['codec_name']=='h264' and len(aud)==1 and aud[0]['codec_name']=='aac'
assert aud[0]['channels']==next(s for s in a['streams'] if s['codec_type']=='audio')['channels']
assert abs(float(b['format']['duration'])*1000-plan['outputDurationMs'])<100
subprocess.run(['ffmpeg','-nostdin','-v','error','-xerror','-threads','1','-i',str(output),'-f','null','-'],capture_output=True,check=True)
assert hashlib.sha256(source.read_bytes()).hexdigest()==plan['sourceSha256']
def audio(p):return np.frombuffer(check(['ffmpeg','-v','error','-i',str(p),'-map','0:a:0','-ac','1','-ar','8000','-f','f32le','pipe:1']),dtype='<f4')
src,dst=audio(source),audio(output)
def frame(p,t):return np.frombuffer(check(['ffmpeg','-v','error','-ss',str(max(0,t)),'-i',str(p),'-map','0:v:0','-frames:v','1','-vf','scale=256:144,crop=256:96:0:0,format=gray','-f','rawvideo','pipe:1']),dtype='u1').astype(float)
voice=[];pictures=[];offset=0
words=plan['transcript']
for keep in plan['keepRanges']:
 lo,hi=keep['startMs']/1000,keep['endMs']/1000;length=hi-lo
 for position in sorted(set([min(.6,length/5),length/2,max(.1,length-1.8)])):
  n=min(8000,round((length-position)*8000));ref=src[round((lo+position)*8000):round((lo+position)*8000)+n]
  expected=round((offset+position)*8000);start=max(0,expected-1000);window=dst[start:min(len(dst),expected+1000+n)]
  score=np.correlate(window,ref,'valid')/np.sqrt(np.maximum(np.convolve(window*window,np.ones(n),'valid')*float(ref@ref),1e-20));best=int(np.argmax(score));lag=(start+best-expected)/8
  assert abs(lag)<5 and score[best]>.95,(lag,score[best])
  voice.append({'sourceMs':round((lo+position)*1000),'outputMs':round((offset+position)*1000),'lagMs':lag,'correlation':round(float(score[best]),6)})
  # Only camera spans: fullscreen V7 artwork intentionally differs from camera.
  camera=not any(words[e['wordIndex']]['startMs']-500<(lo+position)*1000<e['endMs']+500 for e in plan['events'])
  if camera:
   original=frame(source,lo+position);matches=[(float(np.mean(abs(original-frame(output,offset+position+delta)))),delta) for delta in [-1/30,0,1/30]];error,delta=min(matches)
   assert error<8,error
   pictures.append({'sourceMs':round((lo+position)*1000),'outputMs':round((offset+position)*1000),'bestFrameOffsetMs':round(delta*1000,3),'meanLumaError':round(error,5)})
 offset+=length
# Trace records actual runtime file reads. Original Python drawing code is allowed;
# the old camera, V6/V7 video and historical word-timing file are forbidden.
trace=(folder/'io-trace.log').read_text() if (folder/'io-trace.log').exists() else None
historical_check=None
if trace is not None:
 forbidden=['IMG_0506(2).mp4','IMG_0506_CINEMATIC_V6_APPLE_MINIMAL_IPHONE.mp4','IMG_0506_CINEMATIC_V7_PREMIUM_FINAL_IPHONE.mp4','IMG_0506_CINEMATIC_V6_TIMING.json','facecam_originale_cuts.mp4']
 assert not any(name in trace for name in forbidden)
 historical_check={'method':'strace openat during complete render','historicalMediaOrTimingRead':False}
report={'sourceSha256':plan['sourceSha256'],'mp4Sha256':hashlib.sha256(output.read_bytes()).hexdigest(),'nativeSize':[bv['width'],bv['height']],'durationMs':round(float(b['format']['duration'])*1000),'fullDecode':'pass','audioStreams':len(aud),'audioChannels':aud[0]['channels'],'codecs':['h264','aac'],'voiceCorrelation':voice,'retainedPictureChecks':pictures,'cuts':plan['cuts'],'graphicSceneCount':len(plan['events']),'uncertainWords':sum(w['code']=='WORD_REVIEW_REQUIRED' for w in plan['warnings']),'multiwordTokens':sum(w['code']=='MULTIWORD_ASR_TOKEN' for w in plan['warnings']),'historicalIO':historical_check,'phoneticCertification':False,'releaseApproved':False}
Path(str(output)+'.qa.json').write_text(json.dumps(report,indent=2))
# Sample native camera captions and each actual scene, plus transition phases.
# Contact sheets are inspection evidence, not a continuous playback approval.
shots=[('camera',.9)]
for i,e in enumerate(plan['events']):
 start=words[e['wordIndex']]['outputStartMs']/1000 if 'outputStartMs' in words[e['wordIndex']] else plan['mappedWords'][e['wordIndex']]['outputStartMs']/1000
 end=sum(max(0,min(e['endMs'],r['endMs'])-r['startMs']) for r in plan['keepRanges'])/1000
 for label,t in [('enter',start+.06),('middle',min(end-.3,start+1)),('leave',end-.06)]:shots.append((str(i+1)+' '+label,t))
contact=Image.new('RGB',(960,210*((len(shots)+2)//3)),'#111827');d=ImageDraw.Draw(contact)
for i,(label,t) in enumerate(shots):
 f=folder/f'cinematic-proof-{i:02}.png';subprocess.run(['ffmpeg','-v','error','-y','-ss',str(t),'-i',str(output),'-frames:v','1',str(f)],check=True)
 im=Image.open(f);im.thumbnail((320,180));x=i%3*320;y=i//3*210;contact.paste(im,(x,y+24));d.text((x+5,y+5),label+' '+str(round(t,2))+'s',fill='white')
contact.save(folder/'cinematic-contact.png')
print(json.dumps(report,indent=2))
