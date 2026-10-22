#!/usr/bin/env python3
"""V51 — single requested correction: checkmark vertical alignment to text's optical centre.

Source: original raw and V44 caption reference; retain V49 wall labels and V50 cut-frame mapping.
Source video frames and audio chronology identical to V50.  No new cut, no retime.
"""
import os,sys,inspect,subprocess,time,json
import cv2, numpy as np
from PIL import ImageFont
sys.path.insert(0,'/mnt/data/leila_work')
import render_leila_v46 as m

SRC_V50='/mnt/data/EDITPLUS_LEILA_IMG_0516_V50_CUTS_INTELLIGENTS_FINAL.mp4'
OUT='/mnt/data/EDITPLUS_LEILA_IMG_0516_V51_COCHES_TEXTE_ALIGNES.mp4'
QA='/mnt/data/leila_work/V51_ALIGNEMENT_QA.json'
W,H,FPS=1280,720,30

# V49's approved typography, triggers, positions and occlusion-fade (unchanged).
m.ROW=ImageFont.truetype('/usr/share/fonts/truetype/lato/Lato-Medium.ttf',44)
m.SMALL=ImageFont.truetype('/usr/share/fonts/truetype/lato/Lato-Medium.ttf',21)
m.SCENES[0]['rows']=[('Résoudre un problème',14.18),('Gagner du temps',16.32),('Gagner de l’argent',18.41)]
m.SCENES[1]['rows']=[('Ce qui te différencie',24.25),('Tes avantages',27.52),('Résultats pour le client',33.10)]
m.SUB_ACCENTS=[at for sc in m.SCENES for _,at in sc['rows']]

src=inspect.getsource(m.draw_scene)
assert 'ry=160+j*36+round((1-p)*5)' in src
src=src.replace('ry=160+j*36+round((1-p)*5)','ry=143+j*52+round((1-p)*5)')
src=src.replace('fadeout=outro', '''fadeout=outro
  if sc['label']=='Compétence':
   fadeout*=1-ease((t-19.20)/.38)
  elif sc['label']=='Offre':
   fadeout*=1-ease((t-35.16)/.38)''')
assert 'mid=(tx+7,ry+21)' in src
# Align tick optical centre to each row's actually rendered font glyphs,
# not to a generic row top. Retain uniform 8px horizontal visual gap.
src=src.replace('''mid=(tx+7,ry+21)
   st=(tx+2,ry+15)
   end=(tx+23,ry+5)''', '''text_bounds=ROW.getbbox(label)
   glyph_cy=ry-3+(text_bounds[1]+text_bounds[3])/2
   mid=(tx+9,glyph_cy+7)
   st=(tx+2,glyph_cy-1)
   end=(tx+25,glyph_cy-11)''')
ns={};exec(src,m.__dict__,ns)
draw_scene_v51=ns['draw_scene']

# Original frame 12..1361 -> V49's 1350 frames. V50 removed six internal ranges.
CUTS=[(80,89),(231,252),(373,403),(747,755),(947,956),(1293,1300)]
removed={f for a,b in CUTS for f in range(a,b)}
KEEP=[f+12 for f in range(1350) if f not in removed]
assert len(KEEP)==1266 and sum(b-a for a,b in CUTS)==84
assert len(set(KEEP))==len(KEEP)


def get_frame(t,fr,rv):
 original=cv2.resize(fr,(W,H),interpolation=cv2.INTER_CUBIC)
 if t<8.80:return rv.copy()
 im=original.copy()
 for sc in m.SCENES:
  layer=draw_scene_v51(t,sc)
  if layer is not None:m.frame_overlay(im,layer)
 if t<9.19:
  u=m.ease((t-8.80)/.39)
  im=cv2.addWeighted(rv,1-u,im,u,0)
 zz=max(m.pulse(t,s['zoom']) for s in m.SCENES)+m.subpulse(t)
 if zz>.0003:
  z=1+zz;ax,ay=937,269
  mat=np.array([[z,0,ax*(1-z)],[0,z,ay*(1-z)]],dtype=np.float32)
  im=cv2.warpAffine(im,mat,(W,H),flags=cv2.INTER_CUBIC,borderMode=cv2.BORDER_REPLICATE)
 im=m.stabilize_subtitles(im,rv,original)
 return im


def preview():
 raw=cv2.VideoCapture(m.RAW);ref=cv2.VideoCapture(m.REF)
 locs=[400,497,602,884,990,1195,1245]
 orig_v50=cv2.VideoCapture(SRC_V50)
 for num in locs:
  srcfr=KEEP[num];t=srcfr/FPS
  raw.set(cv2.CAP_PROP_POS_FRAMES,srcfr);ref.set(cv2.CAP_PROP_POS_FRAMES,srcfr)
  orig_v50.set(cv2.CAP_PROP_POS_FRAMES,num)
  ok,fr=raw.read();ok2,rv=ref.read();ok3,prev=orig_v50.read()
  assert ok and ok2 and ok3,(num,srcfr)
  ours=get_frame(t,fr,rv)
  path=f'/mnt/data/leila_work/V51_check_frame_{num:04d}.jpg'
  cv2.imwrite(path,ours,[cv2.IMWRITE_JPEG_QUALITY,93])
  if num in (400,497,884,1195):
   comparison=np.hstack([prev[55:370,752:1245],ours[55:370,752:1245]])
   cv2.imwrite(f'/mnt/data/leila_work/V51_comparison_{num:04d}.jpg',comparison)
  print('preview',num,srcfr,t,path,flush=True)
 raw.release();ref.release();orig_v50.release()


def render():
 cmd=['ffmpeg','-y','-hide_banner','-loglevel','error','-f','rawvideo','-vcodec','rawvideo',
      '-pix_fmt','bgr24','-s','1280x720','-r','30','-i','pipe:0','-i',SRC_V50,
      '-map','0:v:0','-map','1:a:0','-c:v','libx264','-preset','veryfast','-crf','17',
      '-pix_fmt','yuv420p','-c:a','copy','-movflags','+faststart',OUT]
 raw=cv2.VideoCapture(m.RAW);ref=cv2.VideoCapture(m.REF)
 assert raw.isOpened() and ref.isOpened()
 subprocess_run=subprocess.Popen(cmd,stdin=subprocess.PIPE,stderr=subprocess.PIPE,bufsize=1024*1024)
 st=time.time();count=0
 try:
  for src_i in range(1362):
   ok,fr=raw.read();ok2,rv=ref.read()
   if not ok or not ok2:raise RuntimeError('missing video source frame '+str(src_i))
   if count>=len(KEEP):break
   if src_i!=KEEP[count]:continue
   im=get_frame(src_i/FPS,fr,rv)
   subprocess_run.stdin.write(im.tobytes());count+=1
   if count%250==0:print('V51 rendered',count,'/',len(KEEP),'seconds elapsed',round(time.time()-st),flush=True)
 except:
  subprocess_run.kill();raise
 finally:
  try:subprocess_run.stdin.close()
  except:pass
  raw.release();ref.release()
 err=subprocess_run.stderr.read().decode(errors='replace')
 rc=subprocess_run.wait(timeout=150)
 if rc:raise RuntimeError('ffmpeg encoder failed '+err[-3000:])
 assert count==1266
 probe=json.loads(subprocess.check_output(['ffprobe','-v','error','-count_frames','-show_entries','stream=codec_name,nb_read_frames,width,height:format=duration','-of','json',OUT]).decode())
 assert int(probe['streams'][0]['nb_read_frames'])==1266,probe
 audio_cmp=subprocess.run(['ffmpeg','-v','error','-i',OUT,'-map','0:a:0','-c','copy','-f','adts','-'],stdout=subprocess.PIPE).stdout
 orig_audio=subprocess.run(['ffmpeg','-v','error','-i',SRC_V50,'-map','0:a:0','-c','copy','-f','adts','-'],stdout=subprocess.PIPE).stdout
 assert audio_cmp==orig_audio,('audio packets differ',len(audio_cmp),len(orig_audio))
 qa={'version':'V51','source_video':'V50 cuts preserved','frames':1266,'duration_s':1266/30,
     'video_resolution':[1280,720],'fps':30,'cut_ranges_V50':CUTS,'source_frames_hash_note':'same unmodified selection of original frames as V50',
     'change_only':'checkmarks repositioned vertically to true glyph optical centre using font text bbox, with consistent horizontal gap',
     'audio':'AAC packet stream byte-identical to V50, verified',
     'limitation':'subtitle transcription/phoneme accuracy was not independently audited and remains unchanged',
     'probe':probe}
 with open(QA,'w',encoding='utf8') as fh:json.dump(qa,fh,ensure_ascii=False,indent=2)
 print('SUCCESS',OUT,'bytes',os.stat(OUT).st_size,'elapsed',round(time.time()-st),flush=True)

if __name__=='__main__':
 if '--preview' in sys.argv: preview()
 else:render()
