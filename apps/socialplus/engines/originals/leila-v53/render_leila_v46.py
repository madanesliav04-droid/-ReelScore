#!/usr/bin/env python3
"""Edit+ / Leila V46 — local reference render for IMG_0516.

Reconstructs wall graphics over ORIGINAL raw footage so timing, entrances,
checkmarks and framing are editable. Reuses V44 captions without retyping,
retiming, AI voice or additional audio tracks. Frame-level subtitle recovery
is based on original vs V44 pixel delta; where confidence is limited, review
visually (this is NOT certified word-level alignment).
"""
import os, sys, math, json, subprocess, time
import cv2, numpy as np
from PIL import Image, ImageDraw, ImageFont

OUT='/mnt/data/EDITPLUS_LEILA_IMG_0516_V46_MOTION_PREMIUM_FINAL.mp4'
RAW='/mnt/data/files/IMG_0516.mp4'
REF='/mnt/data/files/EDITPLUS_LEILA_IMG_0516_V44_MUR_ANCRE_PREMIUM.mp4'
W,H,FPS=1280,720,30
FONT_S='/usr/share/fonts/truetype/ebgaramond/EBGaramond08-Regular.ttf'
FONT_B='/usr/share/fonts/truetype/lato/Lato-Medium.ttf'
FONT_R='/usr/share/fonts/truetype/lato/Lato-Regular.ttf'
SERIF={s:ImageFont.truetype(FONT_S,s) for s in (72,73,76)}
SMALL=ImageFont.truetype(FONT_B,16)
ROW=ImageFont.truetype(FONT_R,25)
COL_TITLE=(34,38,35)
COL_SAGE=(65,126,101)
COL_MUTED=(101,99,91)
WALL_X,WALL_Y=728,27
WALL_W,WALL_H=525,310

SCENES=[
 dict(label='Compétence',kicker='01  /  COMPÉTENCE',start=8.95,end=21.68,zoom=10.74,sz=73,
      rows=[('Résoudre un problème',14.18),('Gagner du temps',17.14),('Gagner de l’argent',19.12)]),
 dict(label='Offre',kicker='02  /  OFFRE',start=21.68,end=38.40,zoom=21.95,sz=76,
      rows=[('Ce qui te différencie',24.25),('Tes avantages',27.52),('Résultats pour le client',34.08)]),
 dict(label='Prospection',kicker='03  /  PROSPECTION',start=38.40,end=47.21,zoom=39.16,sz=72,
      rows=[('Marché chaud',39.66),('Marché tiède',41.05),('Marché froid',42.86)])
]
SUB_ACCENTS=[14.18,17.14,19.12,24.25,27.52,34.08,39.66,41.05,42.86]


def clip(v,a=0,b=1):return max(a,min(b,v))
def ease(x):
 x=clip(x)
 return x*x*(3-2*x)
def easeout(x):
 x=clip(x)
 return 1-(1-x)**3

def pulse(t,at):
 # 5 frames up, 8 frames hold, 7 settle, 9 recover, punch focal composition
 d=(t-at)*FPS
 if d<0 or d>29:return 0
 if d<5:return .108*easeout(d/5)
 if d<13:return .108
 if d<20:return .055+(.108-.055)*(1-ease((d-13)/7))
 return .055*(1-ease((d-20)/9))

def subpulse(t):
 # A restrained secondary accent, never an additional full zoom.
 x=0.
 for a in SUB_ACCENTS:
  d=(t-a)*FPS
  if 0<=d<9:
   if d<4:x=max(x,.008*easeout(d/4))
   else:x=max(x,.008*(1-ease((d-4)/5)))
 return x

def draw_scene(t,sc):
 a,b=sc['start'],sc['end']
 if t<a or t>b:return None
 px=Image.new('RGBA',(WALL_W,WALL_H),(0,0,0,0))
 dr=ImageDraw.Draw(px,'RGBA')
 intro=ease((t-a)/.29)
 outro=ease((b-t)/.30)
 strength=intro*outro
 # A small 2px natural continuation, never a continuously bobbing frame.
 motion=1.5*math.sin((t-a)*1.6)*strength
 def withalpha(col,alpha):return (*col, int(clip(alpha)*255))
 # kicker then title: sequential arrival with no duplicate slides.
 k=ease((t-a)/.24)*outro
 dr.text((22,17+round((1-k)*5)),sc['kicker'],font=SMALL,fill=withalpha(COL_MUTED,.75*k))
 titlein=ease((t-a-.075)/.30)*outro
 ty=47+round((1-titlein)*9+motion)
 dr.text((21,ty),sc['label'],font=SERIF[sc['sz']],fill=withalpha(COL_TITLE,.98*titlein))
 # Draw the underline after title starts, so its movement cues the next item.
 line_start=a+.28
 lineprog=ease((t-line_start)/.29)*outro
 if lineprog>0:
  x0,y=22,137
  x1=x0+min(335,sc['sz']*4.6)*lineprog
  dr.line([(x0,y),(x1,y)],fill=withalpha(COL_SAGE,.6*strength),width=2)
  # Only a tiny glint along the existing line, no distracting ornament.
  if t>line_start+.32 and t<b-.40:
   g=.20+.65*((t-a)*.36%1)
   gx=x0+g*min(335,sc['sz']*4.6)
   dr.line([(gx-11,y),(gx+7,y)], fill=withalpha((126,170,145),.22*strength),width=2)
 # Subpoint rows appear once, after their verbal trigger, with an 8-frame stagger.
 for j,(label,at) in enumerate(sc['rows']):
  if t<at:continue
  p=ease((t-at)/(.267))
  fadeout=outro
  # Accent slightly brightens a point only when introduced.
  attention=max(.0,1-abs(t-at-.14)/.44)
  rowopacity=(.83+.17*attention)*p*fadeout
  ry=160+j*36+round((1-p)*5)
  rx=28+round((1-p)*10)
  # Animated tick has two strokes and is tied to this row only.
  tick=ease((t-at-.085)/.22)
  tx=rx+6
  if tick>0:
   mid=(tx+7,ry+21)
   st=(tx+2,ry+15)
   end=(tx+23,ry+5)
   if tick<=.42:
    f=tick/.42
    mid2=(st[0]+(mid[0]-st[0])*f,st[1]+(mid[1]-st[1])*f)
    dr.line([st,mid2],fill=withalpha(COL_SAGE,0.95*p*fadeout),width=3)
   else:
    dr.line([st,mid],fill=withalpha(COL_SAGE,0.95*p*fadeout),width=3)
    f=(tick-.42)/.58
    ep=(mid[0]+(end[0]-mid[0])*f,mid[1]+(end[1]-mid[1])*f)
    dr.line([mid,ep],fill=withalpha(COL_SAGE,0.95*p*fadeout),width=3)
  dr.text((rx+39,ry-3),label,font=ROW,fill=withalpha(COL_TITLE,rowopacity))
  # Micro undertrace for fresh subpoints; disappears when attention moves on.
  if attention>.02:
   d=dr.textbbox((0,0),label,font=ROW)
   width=min(265,d[2])
   dr.line([(rx+39,ry+27),(rx+39+width*attention,ry+27)], fill=withalpha(COL_SAGE,.20*attention*fadeout),width=1)
 return np.asarray(px)

def frame_overlay(frame,arr):
 if arr is None:return frame
 x,y=WALL_X,WALL_Y
 layer=arr[:,:,:3][:,:,::-1].astype(np.float32)
 alpha=arr[:,:,3:4].astype(np.float32)/255
 region=frame[y:y+WALL_H,x:x+WALL_W]
 frame[y:y+WALL_H,x:x+WALL_W]=(region*(1-alpha)+layer*alpha).astype(np.uint8)
 return frame

def stabilize_subtitles(base,v44,raw_resized):
 """Restore V44's exact caption pixels after camera zoom to keep text steady."""
 y0,y1=616,691
 delta=np.max(np.abs(v44[y0:y1].astype(np.int16)-raw_resized[y0:y1].astype(np.int16)),axis=2)
 # difference of compressed (but otherwise same) frames is 2–4; text >>28
 mask=((delta>27).astype(np.uint8)*255)
 mask=cv2.dilate(mask,np.ones((3,3),np.uint8),iterations=1)
 mask=cv2.GaussianBlur(mask,(3,3),.7).astype(np.float32)[...,None]/255
 base[y0:y1]=(base[y0:y1].astype(np.float32)*(1-mask)+v44[y0:y1].astype(np.float32)*mask).astype(np.uint8)
 return base


def main():
 c0=cv2.VideoCapture(RAW);c1=cv2.VideoCapture(REF)
 assert c0.isOpened() and c1.isOpened(),'Cannot read source'
 n=int(round(c1.get(cv2.CAP_PROP_FRAME_COUNT)))
 assert n==1416,('Unexpected frame count',n)
 audio='loudnorm=I=-16:TP=-1.2:LRA=7'
 cmd=['ffmpeg','-y','-hide_banner','-loglevel','error','-f','rawvideo','-vcodec','rawvideo','-pix_fmt','bgr24','-s',f'{W}x{H}','-r',str(FPS),'-i','pipe:0','-i',REF,
      '-map','0:v:0','-map','1:a:0','-c:v','libx264','-preset','veryfast','-crf','17','-pix_fmt','yuv420p',
      '-c:a','aac','-b:a','192k','-af',audio,'-ar','44100','-ac','2','-t','47.2','-movflags','+faststart',OUT]
 ff=subprocess.Popen(cmd,stdin=subprocess.PIPE,stderr=subprocess.PIPE,bufsize=1024*1024)
 st=time.time(); qa=[]
 try:
  for i in range(n):
   ok0,raw=c0.read();ok1,ref=c1.read()
   if not ok0 or not ok1:raise RuntimeError(f'frame missing {i}')
   t=i/FPS
   raw=cv2.resize(raw,(W,H),interpolation=cv2.INTER_CUBIC)
   if t<8.80:
    frame=ref.copy()
   else:
    frame=raw.copy()
    for sc in SCENES:
     scene=draw_scene(t,sc)
     if scene is not None:frame_overlay(frame,scene)
    # Intro handoff, fading first graphic into the recreated wall.
    if t<9.19:
     u=ease((t-8.80)/.39)
     frame=cv2.addWeighted(ref,1-u,frame,u,0)
    zoom=max(pulse(t,s['zoom']) for s in SCENES)+subpulse(t)
    if zoom>0.0003:
     z=1+zoom
     ax,ay=937,269
     mat=np.array([[z,0,ax*(1-z)],[0,z,ay*(1-z)]],dtype=np.float32)
     # zoom source plus wall composition; main face remains in frame.
     frame=cv2.warpAffine(frame,mat,(W,H),flags=cv2.INTER_CUBIC,borderMode=cv2.BORDER_REPLICATE)
    frame=stabilize_subtitles(frame,ref,raw)
   if i in [0,268,322,426,519,574,657,736,825,1022,1147,1175,1207,1250,1310,1410]:
    path=f'/mnt/data/leila_work/V46_frame_{t:05.2f}.jpg'
    cv2.imwrite(path,frame,[cv2.IMWRITE_JPEG_QUALITY,91])
    qa.append({'t':round(t,2),'file':path})
   ff.stdin.write(frame.tobytes())
   if (i+1)%300==0:
    print('render',i+1,'/',n,'secs',round(time.time()-st,1),flush=True)
 except Exception as e:
  print('render_error',repr(e),file=sys.stderr)
  raise
 finally:
  try: ff.stdin.close()
  except: pass
  c0.release();c1.release()
 try:
  err=ff.stderr.read().decode(errors='replace')
  rc=ff.wait(timeout=180)
 except Exception:ff.kill();raise
 if rc:raise RuntimeError(f'ffmpeg encoder failed {rc}: {err[-2000:]}')
 meta={'version':'V46','output':OUT,'source_raw':RAW,'source_typography_reference':REF,'num_frames':n,'fps':FPS,
       'duration_seconds':n/FPS,'principal_zooms':[{'t':s['zoom'],'name':s['label']} for s in SCENES],
       'secondary_accents':SUB_ACCENTS,'subtitle_source':'V44 static caption-mask transfer (no retiming)',
       'animation':'8-frame intro each row; 5f zoom ascent, 8f hold, 7f settle, 9f release',
       'audio':'single V44 source audio, AAC, loudness normalization; true peak measured separately',
       'limitations':'Word-level phonetic matching NOT certified; style is a calibrated reference for IMG_0516, NOT deployed to Edit+',
       'frames':qa, 'wall_graphics_once_per_scene':True}
 with open('/mnt/data/leila_work/EDITPLUS_LEILA_V46_QA.json','w',encoding='utf8') as f:json.dump(meta,f,indent=2,ensure_ascii=False)
 print('SUCCESS',OUT,os.stat(OUT).st_size,round(time.time()-st,1),flush=True)
if __name__=='__main__':main()
