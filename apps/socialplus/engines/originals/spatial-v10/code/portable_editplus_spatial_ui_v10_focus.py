#!/usr/bin/env python3
"""Edit+ Spatial UI V10. Preserve V9 video except three short numbered focus moments.
No claims of perfect phonetic alignment; uses original V9 subtitles and original audio.
"""
from pathlib import Path
import os,sys,math,time,subprocess
from functools import lru_cache
import cv2,numpy as np
from PIL import Image,ImageDraw,ImageFont,ImageFilter
B=os.path.abspath(os.environ.get('EDITPLUS_PROJECT_DIR',os.getcwd()));SRC=B+'/EDITPLUS_SPATIAL_UI_V9_MOTION_FLOW.mp4'; OUTVIDEO=B+'/EDITPLUS_SPATIAL_UI_V10_FOCUS_VIDEO_ONLY.mp4'
W,H,FPS,N=910,512,30,1416
OUT=OUTVIDEO
# Reuse the *exact same transcript/subtitle rendering as V9* when title focus fades in.
text=open(B+'/code/portable_editplus_spatial_ui_v8_pipeline.py',encoding='utf8').read()
ns={};exec(text[:text.index('# alpha blend with optional')],ns)
byframe=ns['byframe'];groups=ns['groups'];caption=ns['caption'];env=ns['env']
FONT=os.environ.get('EDITPLUS_FONT_DIR','/usr/share/fonts/opentype/inter') + '/'
@lru_cache(30)
def fnt(n,w='medium'):
 return ImageFont.truetype(FONT+{'regular':'Inter-Regular.otf','medium':'Inter-Medium.otf','semi':'Inter-SemiBold.otf'}[w],n)

def smooth(v):
 v=max(0,min(1,float(v)));return v*v*(3-2*v)

def easeOut(v):
 v=max(0,min(1,float(v)));return 1-(1-v)**3

# All three focus timings set on V9's actual section change; full V9 stays untouched elsewhere.
STAGES=[
 dict(a=9.12,b=11.82,num='01',title='COMPÉTENCE',sub='APPRENDRE',anchor=(735,88)),
 dict(a=21.25,b=23.80,num='02',title='OFFRE',sub='STRUCTURER',anchor=(744,88)),
 dict(a=37.22,b=39.78,num='03',title='PROSPECTION',sub='PASSER À L’ACTION',anchor=(730,87)),
]

@lru_cache(8)
def title_image(ix):
 st=STAGES[ix];S=3;w,h=690,230
 im=Image.new('RGBA',(w*S,h*S),(0,0,0,0));d=ImageDraw.Draw(im)
 def xy(x,y):return(int(x*S),int(y*S))
 neutral=(28,38,42,255);muted=(71,88,94,230)
 # Decorative hierarchy, no filled card. Apple-like editorial focus treatment.
 eyebrow='ÉTAPE '+st['num']+'  /  03'
 b=d.textbbox((0,0),eyebrow,font=fnt(14*S,'semi'));d.text(xy((w-(b[2]-b[0])/S)/2,21),eyebrow,font=fnt(14*S,'semi'),fill=(65,97,109,245))
 title=st['title'];size=(71 if len(title)<=8 else 61)*S
 font=fnt(size,'semi');bb=d.textbbox((0,0),title,font=font)
 while bb[2]-bb[0]>w*S-36*S:
  size-=3;font=fnt(size,'semi');bb=d.textbbox((0,0),title,font=font)
 tx=int((w*S-(bb[2]-bb[0]))/2-bb[0]);ty=int(62*S)
 # Subtle kerning offset + soft shadow, not glow/3D extrusion
 sh=Image.new('RGBA',im.size,(0,0,0,0));ds=ImageDraw.Draw(sh)
 ds.text((tx,ty+2*S),title,font=font,fill=(20,30,34,90))
 sh=sh.filter(ImageFilter.GaussianBlur(3*S));im.alpha_composite(sh)
 d=ImageDraw.Draw(im);d.text((tx,ty),title,font=font,fill=neutral)
 # Continuity device: single hairline and three tiny connected indicator markers.
 xx0=w/2-107
 d.line([xy(xx0,159),xy(w/2+107,159)],fill=(61,86,94,70),width=1*S)
 for j in range(3):
  cx=w/2+(j-1)*34
  c=(70,121,135,238) if int(st['num'])==j+1 else (117,133,133,95)
  r=(3.6 if int(st['num'])==j+1 else 2.4)
  d.ellipse([xy(cx-r,159-r),xy(cx+r,159+r)],fill=c)
 lab=st['sub'];ft=fnt(15*S,'medium');b=d.textbbox((0,0),lab,font=ft)
 d.text((int((w*S-(b[2]-b[0]))/2-b[0]),181*S),lab,font=ft,fill=muted)
 return np.asarray(im.resize((w,h),Image.Resampling.LANCZOS))

def alpha_overlay(fr,source,left,top,mult=1):
 h,w=source.shape[:2];ix0=max(0,left);iy0=max(0,top);ix1=min(W,left+w);iy1=min(H,top+h)
 if ix1<=ix0 or iy1<=iy0:return
 tile=source[iy0-top:iy1-top,ix0-left:ix1-left]
 aa=tile[:,:,3].astype('float32')/255*mult
 if np.max(aa)<.003:return
 tgt=fr[iy0:iy1,ix0:ix1]
 tgt[:]=np.uint8(np.clip(tgt.astype('float32')*(1-aa[:,:,None])+tile[:,:,:3][:,:,::-1].astype('float32')*aa[:,:,None],0,255))

def apply(fr,f):
 t=f/FPS
 found=None
 for i,st in enumerate(STAGES):
  if st['a'] <= t <= st['b']:
   found=(i,st);break
 if found is None:return fr
 idx,st=found;a,b=st['a'],st['b']
 p_in=smooth((t-a)/.58);p_out=smooth((b-t)/.55)
 strength=min(p_in,p_out)
 if strength<.003:return fr
 # Soft spatial background defocus—not an opaque rectangle. V9 remains visible throughout.
 blur=cv2.GaussianBlur(fr,(0,0),7.0)
 # 70% max background tint to make single main point legible on every mobile display
 alpha=.62*strength
 tinted=np.uint8(np.clip(blur.astype(np.float32)*.78+np.array([239,243,246],dtype=np.float32)[None,None,:]*.22,0,255))
 cv2.addWeighted(tinted,alpha,fr,1-alpha,0,fr)
 # Feathered lower region hides blurred underlying V9 captions; caption reconstructed on top below.
 y0=403
 if strength>.02:
  h=H-y0
  fade=np.linspace(.18,.52,h,dtype=np.float32)[:,None,None]*strength
  fr[y0:H]=np.uint8(np.clip(fr[y0:H].astype(np.float32)*(1-fade)+np.array([238,242,246],np.float32)[None,None,:]*fade,0,255))
 # Title genuinely expands from V9 upper-right spatial element to centered editorial emphasis and back.
 inn=easeOut((t-a)/.70);outs=smooth((b-t)/.64)
 u=min(inn,outs)
 scale=.36+.64*u
 fromx,fromy=st['anchor']; tox,toy=W/2, H/2-29
 cx=fromx+(tox-fromx)*u
 cy=fromy+(toy-fromy)*u - 7*math.sin(math.pi*u)
 # Tiny z drift never produces camera zoom on the original video.
 art=title_image(idx)
 neww=max(1,round(art.shape[1]*scale));newh=max(1,round(art.shape[0]*scale))
 tile=cv2.resize(art,(neww,newh),interpolation=cv2.INTER_AREA if scale<1 else cv2.INTER_LINEAR)
 alpha_overlay(fr,tile,round(cx-neww/2),round(cy-newh/2),min(1,(strength**1.85)*1.18))
 # Restore exact V9 caption rendering ON TOP of focus, never lose spoken words.
 if f in byframe:
  gid,active=byframe[f];g=groups[gid];op=env(t,g['start'],g['end'],.11,.09)
  if op>.01:alpha_overlay(fr,caption(gid,active),0,417,op*strength)
 return fr

PREVIEW='--preview' in sys.argv
# Critical sample frames including animation start/end and peak, + untouched part of film.
SAMPLES=[261,275,292,320,344,353,625,640,667,692,707,1097,1116,1140,1171,1186]
reader=cv2.VideoCapture(SRC);assert reader.isOpened()
if PREVIEW:
 os.makedirs(B+'/v10_work',exist_ok=True)
 for f in SAMPLES:
  reader.set(cv2.CAP_PROP_POS_FRAMES,f);ok,fr=reader.read();assert ok
  fr=apply(fr,f)
  cv2.imwrite(f'{B}/v10_work/V10_{f:04d}.jpg',fr,[cv2.IMWRITE_JPEG_QUALITY,94])
 print('preview complete')
else:
 p=subprocess.Popen(['ffmpeg','-nostdin','-hide_banner','-loglevel','error','-y','-f','rawvideo','-pixel_format','bgr24','-video_size','910x512','-framerate','30','-i','-','-c:v','libx264','-preset','fast','-crf','17','-pix_fmt','yuv420p','-movflags','+faststart',OUT],stdin=subprocess.PIPE,stderr=subprocess.PIPE)
 reader.set(cv2.CAP_PROP_POS_FRAMES,0)
 start=time.monotonic()
 for f in range(N):
  ok,fr=reader.read()
  if not ok:raise RuntimeError('Missing V9 frame '+str(f))
  fr=apply(fr,f)
  p.stdin.write(fr.tobytes())
  if f in (350,710,1160):print(f'{f+1}/{N}, {time.monotonic()-start:.1f}s',flush=True)
 p.stdin.close();r=p.wait()
 if r:raise RuntimeError('ffmpeg video encode failed '+p.stderr.read().decode()[:1000])
 print('video complete',round(time.monotonic()-start,1))
reader.release()
