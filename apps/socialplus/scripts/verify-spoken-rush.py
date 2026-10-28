import subprocess,json,pathlib,hashlib,numpy as np
from PIL import Image,ImageDraw
import sys
if len(sys.argv)!=3:raise SystemExit('Usage: python scripts/verify-spoken-rush.py SOURCE PRIVATE_EXPORT_DIR')
source=sys.argv[1];out=pathlib.Path(sys.argv[2])
source_meta=json.loads(subprocess.check_output(['ffprobe','-v','error','-show_streams','-of','json',source]));sv=next(s for s in source_meta['streams'] if s['codec_type']=='video');native=(sv['width'],sv['height']);rotation=next((d.get('rotation',0) for d in sv.get('side_data_list',[]) if 'rotation' in d),0)
if abs(rotation)%180==90:native=native[::-1]
def upper_frame(p,t):
 data=subprocess.check_output(['ffmpeg','-v','error','-ss',str(max(0,t)),'-i',str(p),'-map','0:v:0','-frames:v','1','-vf','scale=256:144,crop=256:96:0:0,format=gray','-f','rawvideo','pipe:1'])
 return np.frombuffer(data,dtype=np.uint8).astype(np.float32)
def audio(p):return np.frombuffer(subprocess.check_output(['ffmpeg','-v','error','-i',str(p),'-map','0:a:0','-ac','1','-ar','8000','-f','f32le','pipe:1']),dtype='<f4')
src=audio(source);report=[];rows=[]
models=['codie-omni-v60','alex-hormozi-v16','leila-hormozi-v53','social-kinetic-v28','apple-premium-spatial','cinematic-storytelling-v7']
for model in models:
 p=out/(model+'.mp4');meta=json.loads(subprocess.check_output(['ffprobe','-v','error','-show_streams','-show_format','-of','json',str(p)]));video=next(s for s in meta['streams'] if s['codec_type']=='video');aud=[s for s in meta['streams'] if s['codec_type']=='audio'];assert (video['width'],video['height'])==native and video['codec_name']=='h264' and len(aud)==1 and aud[0]['codec_name']=='aac'
 subprocess.run(['ffmpeg','-v','error','-i',str(p),'-f','null','-'],check=True,stdout=subprocess.DEVNULL)
 encoded=subprocess.check_output(['ffmpeg','-v','error','-i',str(p),'-map','0:a:0','-c:a','copy','-f','adts','pipe:1'])
 entry={'model':model,'width':native[0],'height':native[1],'durationMs':round(float(meta['format']['duration'])*1000),'codecs':['h264','aac'],'audioStreams':1,'fullDecode':'pass','aacSha256':hashlib.sha256(encoded).hexdigest(),'bytes':p.stat().st_size};report.append(entry)
 # Each retained interval is checked against the original voice by correlation.
 if model==models[0]:
  dst=audio(p);keeps=json.loads((out/'edit-map.json').read_text())['keepRanges'];cumulative=0;checks=[]
  for keep in keeps:
   a,b=keep['startMs']/1000,keep['endMs']/1000;offset=min(.6,(b-a)/4);length=min(1.,(b-a)/2);ss=round((a+offset)*8000);n=round(length*8000);target=src[ss:ss+n];expected=round((cumulative+offset)*8000);lo=max(0,expected-1200);hi=min(len(dst),expected+1200+n);window=dst[lo:hi];corr=np.correlate(window,target,'valid');energy=np.convolve(window*window,np.ones(n),'valid');scores=corr/np.sqrt(np.maximum(energy*float(target@target),1e-20));best=int(np.argmax(scores));assert abs((lo+best-expected)/8)<5, 'Voice drift exceeds 5 ms after an edit'
   assert scores[best]>.95, 'Voice does not correlate with the retained original interval'
   checks.append({'sourceStartMs':round((a+offset)*1000),'outputMapStartMs':round((cumulative+offset)*1000),'audioLagMs':round((lo+best-expected)/8,3),'correlation':round(float(scores[best]),6)});cumulative+=b-a
  entry['voiceCorrelation']=checks
  # Codie has no graphic event on this rush. Compare its upper picture to the
  # source at each retained interval, excluding the caption band. One frame
  # of seek/quantization tolerance is reported, never phonetic certification.
  picture=[];cumulative=0
  for keep in keeps:
   a,b=keep['startMs']/1000,keep['endMs']/1000;offset=min(.6,(b-a)/4);expected=cumulative+offset
   reference=upper_frame(source,a+offset)
   matches=[(float(np.mean(np.abs(reference-upper_frame(p,expected+delta)))),delta) for delta in [-1/30,0,1/30]]
   error,delta=min(matches)
   assert error<8,'Retained video frame does not match native source picture'
   picture.append({'sourceTimeMs':round((a+offset)*1000),'outputTimeMs':round(expected*1000),'bestSeekOffsetMs':round(delta*1000,3),'meanAbsoluteLumaError':round(error,4),'threshold':8})
   cumulative+=b-a
  entry['retainedPictureChecks']=picture
 row=Image.new('RGB',(1092,235),'#181b21');d=ImageDraw.Draw(row);d.text((5,5),model,fill='white')
 times={'codie-omni-v60':[1.4,6.9,13.8],'alex-hormozi-v16':[5.2,7.2,20.7],'leila-hormozi-v53':[9.4,18.9,20.6],'social-kinetic-v28':[11.9,15.2,22.6],'apple-premium-spatial':[5.2,18.8,20.7],'cinematic-storytelling-v7':[7.2,18.9,20.7]}[model]
 if float(meta['format']['duration'])<24:times=[min(t,float(meta['format']['duration'])-.3) for t in times]
 for k,t in enumerate(times):
  fp=out/(model+'-'+str(t)+'.png');subprocess.run(['ffmpeg','-v','error','-y','-ss',str(t),'-i',str(p),'-frames:v','1',str(fp)],check=True);im=Image.open(fp);im.thumbnail((364,205));row.paste(im,(k*364,28))
 rows.append(row)
assert len({r['aacSha256'] for r in report})==1,'All six exports must preserve identical voice audio'
(out/'media-qa.json').write_text(json.dumps({'results':report,'captionStatus':'asr_preview_not_phonetically_certified','allSixAudioIdentical':True},indent=2))
contact=Image.new('RGB',(1092,len(rows)*235));
for i,row in enumerate(rows):contact.paste(row,(0,i*235))
contact.save(out/'six-contact.png');print(json.dumps(report,indent=2))
