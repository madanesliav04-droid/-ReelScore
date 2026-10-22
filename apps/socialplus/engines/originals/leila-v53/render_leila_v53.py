#!/usr/bin/env python3
"""Leila modèle 3 V53: 6 silence cuts chosen by RMS and visual seam quality; realigned visual punch cues.

Subtitles are ORIGINAL V44 graphic pixels restored over the original video footage;
phrase-level subtitle QA is possible, but phoneme-level transcription cannot be
certified without an independent ASR/forced-alignment check. Never fake 100/100.
"""
import os,sys,time,json,subprocess
import cv2,numpy as np
sys.path.insert(0, '/mnt/data/leila_v52')
sys.path.insert(0, '/mnt/data/leila_work')
# The prior V51 model requires this module at /mnt/data/leila_work.
import render_leila_v51_ticks_aligned as b
m=b.m
OUT='/mnt/data/EDITPLUS_LEILA_IMG_0516_V53_RACCORDS_AFFINES.mp4'
AUD='/mnt/data/EDITPLUS_LEILA_IMG_0516_V49_RETOUCHES_FINALES_IPHONE.mp4'
FPS=30;W=1280;H=720
# Six precisely framed clips, ends exclusive, chosen from measured low-RMS
# intervals using visual distance on actual pre/post cut frames.
CUTS=[(245,253),(377,385),(562,567),(947,955),(1080,1088),(1123,1129)]
FRAMES=1350
assert len(CUTS)==6
assert all(a<b for a,b in CUTS)
assert all(CUTS[i][1]<CUTS[i+1][0] for i in range(5))
SKIP={f for a,b0 in CUTS for f in range(a,b0)}
KEEP=[i+12 for i in range(FRAMES) if i not in SKIP]
N=len(KEEP)
assert N==1307, (N,sum(x[1]-x[0] for x in CUTS))
# Punch starts refined to the last word of the relevant spoken caption phrase.
# Word onsets estimated from spoken-phrase caption windows; not an ASR assertion.
m.SCENES[0]['zoom']=10.74  # COMPÉTENCE
m.SCENES[1]['zoom']=22.25  # OFFRE
m.SCENES[2]['zoom']=39.51  # PROSPECTION

segments=[];prev=0
for a,end in CUTS:
 if a>prev:segments.append((prev,a))
 prev=end
if prev<FRAMES:segments.append((prev,FRAMES))
asplit=f'[1:a]asplit={len(segments)}'+''.join(f'[a{i}]' for i in range(len(segments)))
af=[f'[a{i}]atrim=start={a/FPS:.9f}:end={end/FPS:.9f},asetpts=PTS-STARTPTS[t{i}]' for i,(a,end) in enumerate(segments)]
concat=''.join(f'[t{i}]' for i in range(len(segments)))+f'concat=n={len(segments)}:v=0:a=1[aud]'
fc=';'.join([asplit,*af,concat])
cmd=['ffmpeg','-y','-hide_banner','-loglevel','error','-f','rawvideo','-pix_fmt','bgr24','-s',f'{W}x{H}','-r',str(FPS),'-i','pipe:0',
     '-i',AUD,'-filter_complex',fc,'-map','0:v:0','-map','[aud]',
     '-c:v','libx264','-preset','veryfast','-crf','17','-pix_fmt','yuv420p',
     '-c:a','aac','-b:a','192k','-ar','44100','-ac','2','-movflags','+faststart','-shortest',OUT]


def main():
 raw=cv2.VideoCapture(m.RAW);ref=cv2.VideoCapture(m.REF)
 assert raw.isOpened() and ref.isOpened()
 ff=subprocess.Popen(cmd,stdin=subprocess.PIPE,stderr=subprocess.PIPE,bufsize=1024*1024)
 count=0;st=time.time()
 try:
  for source in range(1362):
   ok,fr=raw.read();ok2,rv=ref.read()
   if not ok or not ok2:raise RuntimeError('Missing original video or reference frame '+str(source))
   if count>=N:break
   if source!=KEEP[count]:continue
   result=b.get_frame(source/FPS,fr,rv)
   ff.stdin.write(result.tobytes())
   count+=1
   if count%250==0:print('Rendered',count,'of',N,'in',round(time.time()-st,1),'sec',flush=True)
 finally:
  ff.stdin.close();raw.release();ref.release()
 stderr=ff.stderr.read().decode(errors='replace')
 rc=ff.wait(timeout=180)
 if rc:raise RuntimeError(stderr[-5000:])
 probe=json.loads(subprocess.check_output(['ffprobe','-v','error','-count_frames','-show_entries','stream=codec_name,width,height,nb_read_frames,sample_rate,channels:format=duration','-of','json',OUT]))
 assert int(probe['streams'][0]['nb_read_frames'])==N,probe
 assert probe['streams'][1]['codec_name']=='aac'
 # Report precise audio and video timeline: the audio was trimmed from same V49
 # intervals as the image, with 30 fps exact frame boundaries and no time warp.
 removed=sum(end-a for a,end in CUTS)
 cuts=[]
 for i,(a,end) in enumerate(CUTS):
  prior=sum(y-x for x,y in CUTS[:i])
  cuts.append(dict(number=i+1,source_start_s=round(a/FPS,3),source_end_s=round(end/FPS,3),
                   output_join_s=round((a-prior)/FPS,3),frames_removed=end-a))
 def output_time_for_original_source(t):
  s=int(round(t*FPS))-12
  return round((s-sum(max(0,min(end,s)-a) for a,end in CUTS))/FPS,3)
 qa={'version':'V53','source_base':'V51 code, V49 audio, IMG_0516 raw video, V44 subtitles',
     'framerate':FPS,'size':[W,H],'frames':N,'duration_expected':N/FPS,
     'real_internal_cuts':len(CUTS),'removed_frames':removed,'removed_seconds':round(removed/FPS,3),
     'cuts':cuts,'zoom_word_cues_source_s':{s['label']:s['zoom'] for s in m.SCENES},
     'zoom_cues_output_s':{s['label']:output_time_for_original_source(s['zoom']) for s in m.SCENES},
     'captions':'V44 original subtitle pixels, no new invented or altered words; audio and visual edits identical intervals',
     'audio':'Source V49 single natural-voice audio stream, sample-exact cuts, AAC output. Loudness separately tested.',
     'honesty':'Phonetic word-level matching remains uncertified: source captions retained without editing; no ASR installed and no human-audio check was performed.',
     'probe':probe}
 with open('/mnt/data/leila_v52/V53_AUDIT_TECHNIQUE.json','w',encoding='utf8') as f:json.dump(qa,f,ensure_ascii=False,indent=2)
 print('SUCCESS',OUT,os.path.getsize(OUT),'bytes','elapsed',round(time.time()-st,1),'s',flush=True)

if __name__=='__main__':main()
