#!/usr/bin/env python3
"""Edit+ Spatial UI Model 05 / V8: deliberate editorial typography + depth in composition.
Geometric 2.5D projection on stationary scene; does not claim volumetric 3D.
Word boundaries estimated from source ASR segment anchors, not forced phonetic alignment.
"""
from pathlib import Path
import os, cv2, math, re, time, json, subprocess, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter
from functools import lru_cache
BASE=os.path.abspath(os.environ.get('EDITPLUS_PROJECT_DIR',os.getcwd())); SRC=f'{BASE}/files/IMG_0516.mp4'; OUT=f'{BASE}/EDITPLUS_SPATIAL_UI_V8_VIDEO_ONLY.mp4'
W,H,FPS,N=910,512,30,1416
FONTS={
 'regular':os.environ.get('EDITPLUS_FONT_REGULAR','/usr/share/fonts/opentype/inter/Inter-Regular.otf'),
 'medium':os.environ.get('EDITPLUS_FONT_MEDIUM','/usr/share/fonts/opentype/inter/Inter-Medium.otf'),
 'semi':os.environ.get('EDITPLUS_FONT_SEMI','/usr/share/fonts/opentype/inter/Inter-SemiBold.otf')
}
assert os.path.isfile(SRC)
@lru_cache(100)
def ft(sz,wt='medium'):
 return ImageFont.truetype(FONTS[wt],size=sz)
def smooth(x):
 x=np.clip(x,0.,1.); return float(x*x*(3-2*x))
def env(t,a,b,enter=.45,leave=.35):
 return smooth((t-a)/enter)*smooth((b-t)/leave)
def taper(t,a,b,enter=.28,leave=.22):
 return env(t,a,b,enter,leave)

segments=[
(.40,3.28,'Si tu pars de 0 et que tu veux absolument'),
(3.28,6.96,"commencer à gagner de l'argent dans les 90 prochains jours, applique"),
(6.96,8.48,'absolument ces 3 points.'),
(8.8,12.72,'Tu pars de 0, donc tu dois apprendre une compétence que les personnes seraient prêtes à te payer.'),
(13.765,32.05,"Des compétences qui vont résoudre soit un problème chez eux, soit leur faire gagner du temps, soit leur faire gagner de l'argent. C'est tout. Une fois que tu es compétente, tu vas construire ton offre. Donc ton offre, ça va être tout un package de se dire qu'est-ce que tu as de plus que le concurrent en face? Qu'est-ce que tu as de mieux? Et quels avantages tu as en plus? Et concrètement, comment"),
(32.53,36.29,"avec ton offre, il va comme ça gagner de l'argent, gagner du temps, résoudre un problème."),
(36.69,45.2596,"Et une fois que tu as ton offre, tu tu vas commencer à prospecter. Tu vas chercher ton 1er client. Donc, marché chaud, marché tiède, marché froid, on s'en fout. Il faut juste que tu ailles en parler haut."),
]
scenes=[
 dict(start=.52,end=8.55,num='INTRO',eyebrow='LE PLAN',title='3 étapes',hint='COMPÉTENCE · OFFRE · PROSPECTION',step=0,x=631,y=36,w=244),
 dict(start=8.78,end=20.69,num='01 / 03',eyebrow='APPRENDRE',title='Compétence',hint='RÉSOUDRE UN PROBLÈME',step=1,x=618,y=38,w=265),
 dict(start=20.72,end=36.56,num='02 / 03',eyebrow='STRUCTURER',title='Offre',hint='CRÉER DE LA VALEUR',step=2,x=648,y=34,w=235),
 dict(start=36.70,end=45.60,num='03 / 03',eyebrow='AGIR',title='Prospection',hint='TROUVER SON PREMIER CLIENT',step=3,x=622,y=38,w=260),
]
# Highlight replaces or extends the hint only during the corresponding spoken idea; never produces unsupported numbers.
annotations=[
 (13.85,16.55,1,'RÉSOUDRE UN PROBLÈME'),
 (16.7,18.45,1,'FAIRE GAGNER DU TEMPS'),
 (18.50,20.50,1,"FAIRE GAGNER DE L’ARGENT"),
 (25.70,29.45,2,'SE DIFFÉRENCIER'),
 (32.65,35.96,2,'BÉNÉFICE CONCRET'),
 (38.70,41.65,3,'CHERCHER UN CLIENT'),
]
# ASR anchor words, interpolation is explicit; slight acoustic phase correction from grouping vowels only.
words=[]; groups=[]
for s,e,txt in segments:
 ws=txt.split(); weights=[max(.8,len(re.sub('[^a-zA-ZÀ-ÿ0-9]','',v))**.72) for v in ws]; den=sum(weights)
 idx=len(words);p=s
 for v,k in zip(ws,weights):
  q=p+(e-s)*(k/den);words.append({'word':v,'start':p,'end':q});p=q
 while idx < len(words):
  j=min(idx+4,len(words));
  if len(words)-j==1:j=len(words)
  groups.append({'a':idx,'b':j,'start':words[idx]['start'],'end':words[j-1]['end']});idx=j
byframe={}
for g,G in enumerate(groups):
 a,b=G['a'],G['b']
 for f in range(max(0,int(G['start']*FPS)),min(N,int(G['end']*FPS)+1)):
  t=f/FPS;active=max((i-a for i in range(a,b) if words[i]['start']<=t),default=0)
  byframe[f]=(g,active)

S=3
INK=(45,49,47); MUTE=(91,95,94)
@lru_cache(32)
def title_layer(scene_idx,annotation_idx):
 """Only text, hairline, status marks and subtle spatial edge; no white filled card."""
 sc=scenes[scene_idx];ww=sc['w'];hh=132
 im=Image.new('RGBA',(ww*S,hh*S)); d=ImageDraw.Draw(im)
 def p(x,y):return int(x*S),int(y*S)
 # Spatial glass is deliberately close to invisible: a tapered 3px edge, not a white UI card.
 # Warm wall and glass refract a fine contour rather than adding a filled white rectangle.
 d.polygon([p(10,8),p(ww-5,2),p(ww-1,115),p(7,119)],fill=(250,250,247,24))
 d.line([p(10,8),p(ww-5,2)],fill=(255,255,255,86),width=S)
 d.line([p(ww-5,2),p(ww-1,115)],fill=(255,255,255,47),width=S)
 d.line([p(7,119),p(ww-1,115)],fill=(37,39,36,29),width=S)
 # Depth edge: offset microlines suggest thickness without an extruded block.
 d.line([p(ww-1,115),p(ww-4,120)],fill=(83,95,87,45),width=S)
 d.line([p(10,8),p(7,12)],fill=(255,255,255,95),width=S)
 d.line([p(0,20),p(0,89)],fill=(48,51,50,102),width=S)
 d.ellipse([p(-2,16),p(3,21)],fill=(65,79,78,204))
 d.line([p(0,21),p(26,21)],fill=(58,68,66,72),width=S)
 d.text(p(17,0),sc['num'],font=ft(10*S,'semi'),fill=(57,61,60,229))
 tw=d.textbbox((0,0),sc['eyebrow'],font=ft(10*S,'medium'))[2]
 d.text(p(ww-2-tw/S,0),sc['eyebrow'],font=ft(10*S,'medium'),fill=(105,109,105,210))
 d.text(p(17,25),sc['title'],font=ft((28 if len(sc['title'])<=10 else 26)*S,'semi'),fill=(32,36,34,255))
 text=sc['hint'] if annotation_idx<0 else annotations[annotation_idx][3]
 sz=10*S
 # hint never overflows view; fade words not big panels
 while d.textbbox((0,0),text,font=ft(sz,'medium'))[2]>(ww-23)*S and sz>24:sz-=1
 d.text(p(17,70),text,font=ft(sz,'medium'),fill=(88,95,91,230))
 # accent straight small ticks, with stepped progress and deliberate spacing
 d.line([p(17,96),p(ww-1,96)],fill=(51,55,54,50),width=S)
 for i in range(3):
  xx=18+i*31
  d.rounded_rectangle((*p(xx,108),*p(xx+22,109)),radius=S,fill=(55,78,73,210) if sc['step']>=i+1 else (95,110,106,75))
 # tiny reference coordinate marker reinforces designed spatial calibration without noise
 d.ellipse([*p(ww-7,104),*p(ww-4,107)],fill=(77,94,88,125))
 return np.asarray(im.resize((ww,hh),Image.Resampling.LANCZOS))

@lru_cache(350)
def caption(gid,active):
 g=groups[gid];tokens=[words[i]['word'] for i in range(g['a'],g['b'])]
 # 30px compared to V7's 26px, subpixel constant spacing for stable active animation
 L=Image.new('RGBA',(W*S,77*S),(0,0,0,0));d=ImageDraw.Draw(L)
 f=ft(30*S,'medium');fa=ft(30*S,'semi')
 ws=[max(d.textbbox((0,0),t,font=f)[2],d.textbbox((0,0),t,font=fa)[2]) for t in tokens]
 gap=10*S; tot=sum(ws)+gap*(len(ws)-1)
 if tot > (W-75)*S:
  f=ft(27*S,'medium');fa=ft(27*S,'semi')
  ws=[max(d.textbbox((0,0),t,font=f)[2],d.textbbox((0,0),t,font=fa)[2]) for t in tokens]
  tot=sum(ws)+gap*(len(ws)-1)
 xs=[];x=(W*S-tot)//2
 for w in ws: xs.append(x);x+=w+gap
 # text-only double-layer fine outline produces readable captions over both shirt and wall
 shadow=Image.new('RGBA',L.size,(0,0,0,0));ds=ImageDraw.Draw(shadow)
 for i,t in enumerate(tokens):
  ds.text((xs[i],21*S),t,font=fa if i==active else f,fill=(0,0,0,210),stroke_width=3*S,stroke_fill=(0,0,0,155))
 shadow=shadow.filter(ImageFilter.GaussianBlur(3*S));L.alpha_composite(shadow)
 d=ImageDraw.Draw(L)
 for i,t in enumerate(tokens):
  active_i=i==active
  d.text((xs[i],(18.8 if active_i else 21)*S),t,font=fa if active_i else f,
    fill=(250,224,178,255) if active_i else (252,252,250,251) if i<active else (246,248,248,225),
    stroke_width=S,stroke_fill=(21,26,27,200))
 return np.asarray(L.resize((W,77),Image.Resampling.LANCZOS))

# alpha blend with optional background exclusion based on difference from background median in registered wall region.
def blend(frame,rgba,left,top,alpha=1,fgmask=None):
 h,w=rgba.shape[:2];x0=max(0,left);y0=max(0,top);x1=min(W,left+w);y1=min(H,top+h)
 if x0>=x1 or y0>=y1:return
 src=rgba[y0-top:y1-top,x0-left:x1-left]
 a=(src[:,:,3].astype(np.float32)/255.)*alpha
 if fgmask is not None:
  a*=1.-fgmask[y0:y1,x0:x1]
 if np.max(a)<.002:return
 tar=frame[y0:y1,x0:x1]
 tar[:]=np.clip(tar.astype('float32')*(1-a[:,:,None])+src[:,:,:3][:,:,::-1].astype('float32')*a[:,:,None],0,255).astype('uint8')

def render_scene_ui(frame,idx,t,occ=None):
 sc=scenes[idx];strength=env(t,sc['start'],sc['end'],.46,.45)
 if strength<.003:return
 annotation=-1;asmooth=0
 for k,(s,e,ix,txt) in enumerate(annotations):
  if ix==idx and s<=t<=e:
   annotation=k;asmooth=env(t,s,e,.25,.25);break
 layer=title_layer(idx,-1)
 if annotation>=0 and asmooth>.01:
  alt=title_layer(idx,annotation)
  # dissolve text-only layer; no pop, no spatial discontinuity
  layer=cv2.addWeighted(layer,1-asmooth,alt,asmooth,0)
 # Animated tracking microline travels across the scene, making time legible.
 layer=layer.copy()
 phase_progress=float(np.clip((t-sc['start'])/(sc['end']-sc['start']),0,1))
 xx=int(18+(sc['w']-36)*phase_progress)
 cv2.line(layer,(xx,95),(min(xx+13,sc['w']-17),95),(80,98,91,135),1,cv2.LINE_AA)
 hh,ww=layer.shape[:2];left=sc['x'];top=sc['y']
 # small depth easing, faster only during entry / exit
 enter=smooth((t-sc['start'])/.48);departure=smooth((sc['end']-t)/.39)
 xdelta=(1-enter)*19-(1-departure)*9
 ydelta=(1-enter)*5-(1-departure)*2
 z=1.006+0.004*math.sin(t*.55+idx) # barely perceptible parallax
 a=ww*z;b=hh*z
 # perform slight projective yaw; anchored visual with soft depth edge
 tl=np.float32([[0,0],[ww,0],[ww,hh],[0,hh]])
 warped=np.float32([[left+xdelta+1,top+ydelta+1],[left+xdelta+a-5,top+ydelta-1],
  [left+xdelta+a-2,top+ydelta+b-3],[left+xdelta-1,top+ydelta+b]])
 boxx=int(np.floor(np.min(warped[:,0])))-4;boxy=int(np.floor(np.min(warped[:,1])))-4
 mat=cv2.getPerspectiveTransform(tl,warped-np.array([boxx,boxy],np.float32))
 output=cv2.warpPerspective(layer,mat,(ww+30,hh+17),flags=cv2.INTER_LINEAR,borderMode=cv2.BORDER_CONSTANT)
 # pass foreground matte only over stationary upper wall: no canvas-like panel occupies screen
 blend(frame,output,boxx,boxy,strength,occ)

# Reconstruct a local wall reference for foreground occlusion, using frames before hands enter.
# Static camera; NOT a depth estimation. Mask differences conservatively to avoid noisy flicker.
C=cv2.VideoCapture(SRC)
assert C.isOpened()
references=[]
for f in [18,54,105,135,160,195,215]:
 C.set(cv2.CAP_PROP_POS_FRAMES,f);ok,p=C.read()
 if ok:references.append(p)
C.release()
assert references
wall=np.median(np.stack(references).astype(np.float32),axis=0).astype(np.uint8)
wall_lab=cv2.cvtColor(wall,cv2.COLOR_BGR2LAB).astype(np.float32)
# Occlusion detection only for an upper wall ROI; safety margin is outside the face path.
wallroi=(28,149,598,900)

def foreground_mask(frame,f):
 # periodic mask, expensive color-distance mask is sparse; protect region with strong detected moving object colors
 y0,y1,x0,x1=wallroi
 diff=np.linalg.norm(cv2.cvtColor(frame[y0:y1,x0:x1],cv2.COLOR_BGR2LAB).astype(np.float32)-wall_lab[y0:y1,x0:x1],axis=2)
 # moving hands/hair dark compared to pale wall; darker + sufficiently different
 lum=cv2.cvtColor(frame[y0:y1,x0:x1],cv2.COLOR_BGR2GRAY)
 mask=np.uint8((diff>27)&(lum<177))*255
 # prevent flicker small pixel artifacts
 mask=cv2.morphologyEx(mask,cv2.MORPH_OPEN,np.ones((3,3),np.uint8))
 mask=cv2.dilate(mask,np.ones((5,5),np.uint8))
 mask=cv2.GaussianBlur(mask,(0,0),2.3)
 result=np.zeros((H,W),dtype=np.float32)
 result[y0:y1,x0:x1]=mask.astype('float32')/255
 return result

preview='--preview' in sys.argv
wanted=[75,180,300,465,645,850,1080,1250,1380]
reader=cv2.VideoCapture(SRC);assert reader.isOpened()
writer=None
if not preview:
 cmd=['ffmpeg','-hide_banner','-loglevel','error','-y','-f','rawvideo','-pix_fmt','bgr24','-s',f'{W}x{H}','-r',str(FPS),'-i','-',
 '-c:v','libx264','-preset','veryfast','-crf','17','-pix_fmt','yuv420p','-movflags','+faststart',OUT]
 writer=subprocess.Popen(cmd,stdin=subprocess.PIPE,stderr=subprocess.PIPE)
st=time.monotonic();saved=[]
try:
 for f in range(N):
  ok,frame=reader.read()
  if not ok:raise RuntimeError(f'Missing frame {f}')
  t=f/FPS
  occ=foreground_mask(frame,f) if any(sc['start']<=t<=sc['end'] for sc in scenes) else None
  for idx,sc in enumerate(scenes):
   if sc['start']-.1<=t<=sc['end']+.1:render_scene_ui(frame,idx,t,occ)
  if f in byframe:
   gid,active=byframe[f]; g=groups[gid]
   opacity=env(t,g['start'],g['end'],.11,.09)
   if opacity>.005:
    r=caption(gid,active)
    blend(frame,r,0,417,opacity)
  if f in wanted:
   path=f'{BASE}/EDITPLUS_SPATIAL_UI_V8_FRAME_{f:04d}.jpg' if not preview else f'{BASE}/SPATIAL_UI_V8_PREVIEW_{f:04d}.jpg'
   cv2.imwrite(path,frame,[cv2.IMWRITE_JPEG_QUALITY,92]);saved.append(path)
  if writer:writer.stdin.write(frame.tobytes())
  if f in [299,749,1199]:print('processed',f+1,'/',N,'elapsed',round(time.monotonic()-st,1),flush=True)
finally:
 reader.release()
 if writer:
  writer.stdin.close();rc=writer.wait()
  if rc:raise RuntimeError(writer.stderr.read().decode()[:1500])
if len(saved)==len(wanted):
 cols=3;tw,th=455,256;cw,ch=455,278
 board=Image.new('RGB',(3*cw,3*ch),'#111715');d=ImageDraw.Draw(board)
 for j,p in enumerate(saved):
  x=j%3*cw;y=j//3*ch
  im=Image.open(p).convert('RGB').resize((tw,th));board.paste(im,(x,y+22))
  d.text((x+12,y+3),f'{wanted[j]/FPS:.1f}s',font=ft(13,'semi'),fill=(244,246,245))
 board.save(f'{BASE}/EDITPLUS_SPATIAL_UI_V8_{"PREVIEW" if preview else "STORYBOARD"}.jpg',quality=92)
qa={'source':SRC,'frames':N,'fps':FPS,'video_seconds':N/FPS,'dimensions':[W,H],
 'new_ui':'typography-first, no opaque card background, 2.5D geometric projection, wall-region foreground exclusion',
 'subtitle_word_count':len(words),'subtitle_groups':len(groups),
 'word_sync_certified':False,'alignment':'ASR speech-segment text interpolated by weighted character duration',
 'spatial_calibration':'static scene upper-wall mapping; not 3D mesh / metric depth'}
if not preview:
 with open(f'{BASE}/EDITPLUS_SPATIAL_UI_V8_RENDER_QA.json','w') as fp:json.dump(qa,fp,ensure_ascii=False,indent=2)
print('FINISHED',('PREVIEW' if preview else 'RENDER'),round(time.monotonic()-st,2),'sec',flush=True)
