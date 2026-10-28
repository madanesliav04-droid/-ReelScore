import os, math, subprocess, sys
import numpy as np, cv2
from PIL import Image, ImageDraw, ImageFont

ROOT='/mnt/data'
SOURCE=f'{ROOT}/HYPERFRAMES_CINEMATIC_IMG0506/assets/facecam_originale_cuts.mp4'
SILENT=f'{ROOT}/IMG_0506_CINEMATIC_V6_VIDEO_TEMP.mp4'
OUT=f'{ROOT}/IMG_0506_CINEMATIC_V6_APPLE_MINIMAL_IPHONE.mp4'
W,H,FPS=960,540,30
FONT='/usr/share/fonts/opentype/inter'
REG=FONT+'/Inter-Regular.otf'
MED=FONT+'/Inter-Medium.otf'
BOLD=FONT+'/Inter-Bold.otf'
SEM=FONT+'/Inter-SemiBold.otf'
EXT=FONT+'/Inter-ExtraBold.otf'
NAVY=(3,17,32); WHITE=(247,250,255); MUTED=(170,193,211); GOLD=(228,189,113); CYAN=(153,194,217)
F={}
def font(sz,w='b'):
 k=(sz,w)
 if k not in F:F[k]=ImageFont.truetype({'b':BOLD,'s':SEM,'e':EXT,'m':MED,'r':REG}[w],sz)
 return F[k]

def textxy(d,xy,msg,sz=24,color=WHITE,anchor='lt',wt='b'):
 d.text(xy,msg,font=font(sz,wt),fill=color,anchor=anchor,stroke_width=0)

def ease(x):
 x=max(0.,min(1.,x));return 1-(1-x)**3

def wave(x):
 x=max(0.,min(1.,x));return x*x*(3-2*x)

def ramp(t,delay,duration=.34):return ease((t-delay)/duration)

def fade_edge(t,d,fin=.16,fout=.18):return min(1.,wave(t/max(.0001,fin)),wave((d-t)/max(.0001,fout)))

def make_bg():
 yy,xx=np.mgrid[0:H,0:W].astype('float32')
 glow=np.exp(-((xx-800)**2/230000+(yy-120)**2/140000))
 glow2=np.exp(-((xx-100)**2/210000+(yy-500)**2/150000))
 grid=np.stack([7+glow*14+glow2*3,21+glow*19+glow2*10,36+glow*25+glow2*12],axis=-1)
 img=Image.fromarray(np.uint8(np.clip(grid,0,255)),'RGB').convert('RGBA')
 over=Image.new('RGBA',(W,H),(0,0,0,0))
 d=ImageDraw.Draw(over,'RGBA')
 for x in range(0,W+10,70):d.line((x,0,x,H),fill=(165,194,214,14),width=1)
 for y in range(0,H+10,70):d.line((0,y,W,y),fill=(165,194,214,14),width=1)
 for r in (130,195,267,352):
  d.arc((740-r,275-r,740+r,275+r),start=0,end=360,fill=(140,190,209,25),width=1)
 d.ellipse((695,220,785,310),outline=(238,193,112,25),width=1)
 img.alpha_composite(over)
 return img
BG=make_bg()

# Animated layer: composited at its native size with vertical entrance and alpha.
def layer_from(cb):
 im=Image.new('RGBA',(W,H),(0,0,0,0)); d=ImageDraw.Draw(im,'RGBA');cb(d)
 box=im.getbbox(); return (im.crop(box),box[0],box[1]) if box else None

def mix_layer(bg,layer,local,delay=0,dur=.42,dy=27):
 if local <delay or layer is None:return
 gain=wave((local-delay)/(dur*1.12))
 a=int(255*gain)
 if a==0:return
 cropped,x,y=layer
 temp=cropped.copy()
 if a<255:
  alpha=temp.getchannel('A').point(lambda v:(v*a)//255)
  temp.putalpha(alpha)
 bg.alpha_composite(temp,(x,y+int((1-gain)*min(dy,24))))

def base_header(scene_idx,eyebrow):
 def draw(d):
  d.rounded_rectangle((52,38,91,78),radius=11,fill=(221,180,106,28),outline=(221,183,103,225),width=2)
  textxy(d,(71,59),f'{scene_idx:02}',17,GOLD,'mm','b')
  textxy(d,(109,48),'CINEMATIC STORYTELLING',12,CYAN,'lt','s')
  textxy(d,(109,65),eyebrow,11,GOLD,'lt','s')
  d.line((52,100,906,100),fill=(185,204,215,37),width=1)
  d.rounded_rectangle((866,45,908,48),radius=2,fill=GOLD)
 return layer_from(draw)

def under_rule(y=395):
 def draw(d):
  d.rounded_rectangle((310,y,650,y+3),radius=2,fill=GOLD)
 return layer_from(draw)

def scene_layers(s):
 if s==0:
  return [
   (base_header(1,'LE DÉCLIC'),0,.25,17),
   (layer_from(lambda d:textxy(d,(480,162),'LA MAUVAISE QUESTION',23,MUTED,'mm','s')), .15,.35,21),
   (layer_from(lambda d:textxy(d,(480,237),'COMMENT GAGNER',54,WHITE,'mm','e')),.36,.46,42),
   (layer_from(lambda d:textxy(d,(480,311),'DE L’ARGENT EN LIGNE ?',49,GOLD,'mm','e')),.57,.48,38),
   (under_rule(384),.84,.55,0),
   (layer_from(lambda d:textxy(d,(480,422),'ET SI CE N’ÉTAIT PAS LA BONNE QUESTION ?',15,CYAN,'mm','m')),1.02,.35,17),
  ]
 if s==1:
  def card_one(d):
   d.rounded_rectangle((65,347,303,425),radius=12,fill=(17,43,66,236),outline=(116,149,170,147),width=1)
   d.ellipse((85,367,128,410),outline=GOLD,width=2)
   textxy(d,(106,388),'1',18,GOLD,'mm','b');textxy(d,(208,387),'AIDER',27,WHITE,'mm','e')
  def card_two(d):
   d.rounded_rectangle((365,337,655,435),radius=13,fill=(34,56,69,249),outline=GOLD,width=2)
   textxy(d,(510,370),'CRÉER DE LA',23,WHITE,'mm','s')
   textxy(d,(510,403),'VALEUR',30,GOLD,'mm','e')
  def card_three(d):
   d.rounded_rectangle((718,347,901,425),radius=12,fill=(17,43,66,236),outline=(116,149,170,147),width=1)
   textxy(d,(810,387),'GAGNER',28,WHITE,'mm','e')
  return [
   (base_header(2,'LA VRAIE LOGIQUE'),0,.25,17),
   (layer_from(lambda d:textxy(d,(480,172),'TU GAGNES QUAND TU',44,WHITE,'mm','e')),.13,.43,25),
   (layer_from(lambda d:textxy(d,(480,243),'AIDES LES AUTRES',64,GOLD,'mm','e')),.33,.43,32),
   (layer_from(card_one),.57,.42,38),
   (layer_from(lambda d:textxy(d,(333,392),'→',34,GOLD,'mm','s')),.72,.3,0),
   (layer_from(card_two),.87,.42,35),
   (layer_from(lambda d:textxy(d,(685,392),'→',34,GOLD,'mm','s')),1.06,.30,0),
   (layer_from(card_three),1.23,.42,33),
  ]
 if s==2:
  def info(d):
   d.rounded_rectangle((168,370,794,443),radius=15,fill=(19,49,69,229),outline=(156,188,204,95),width=2)
   d.ellipse((201,391,232,422),outline=GOLD,width=2)
   d.line((208,406,215,413,226,399),fill=GOLD,width=3)
   textxy(d,(255,393),'RÉSOUDRE UN VRAI PROBLÈME',26,WHITE,'lt','s')
  return [
   (base_header(3,'LE DEUXIÈME POINT'),0,.25,17),
   (layer_from(lambda d:textxy(d,(480,181),'APPRENDS UNE',55,WHITE,'mm','e')),.65,.45,35),
   (layer_from(lambda d:textxy(d,(480,275),'COMPÉTENCE',75,GOLD,'mm','e')),.90,.48,37),
   (under_rule(330),1.13,.50,0),
   (layer_from(info),1.90,.49,29),
  ]
 if s==3:
  def benefit(x,number,title,sub):
   def body(d):
    d.rounded_rectangle((x,258,x+255,439),radius=18,fill=(14,43,65,244),outline=(114,157,182,131),width=2)
    d.rounded_rectangle((x+15,274,x+65,323),radius=10,fill=(231,188,115,27),outline=(230,193,123,192),width=2)
    textxy(d,(x+40,298),number,18,GOLD,'mm','e')
    textxy(d,(x+127,362),title,24,WHITE,'mm','e')
    textxy(d,(x+127,397),sub,13,CYAN,'mm','m')
   return layer_from(body)
  return [
   (base_header(4,'LA VALEUR CONCRÈTE'),0,.24,17),
   (layer_from(lambda d:textxy(d,(480,177),'POURQUOI ON TE PAIE ?',47,WHITE,'mm','e')),.2,.48,28),
   (layer_from(lambda d:textxy(d,(480,222),'UNE COMPÉTENCE DOIT ÊTRE UTILE',16,GOLD,'mm','s')),.42,.40,22),
   (benefit(60,'01','DU TEMPS','Faire gagner du temps'),.53,.43,42),
   (benefit(352,'02','DE L’ARGENT','Faire gagner de l’argent'),1.60,.43,42),
   (benefit(644,'03','UNE SOLUTION','Résoudre un problème'),2.99,.43,42),
  ]

LAYERS=[scene_layers(j) for j in range(4)]
SCENES=[(6.166667,8.066667),(19.15,22.4),(26.1,29.4),(33.15,38.64)]

# Labels appear on facecam, not on fullscreen.
LABELS=[(.45,3.02,'LE POINT DE DÉPART','01'),(8.43,10.54,'POSER LA BONNE QUESTION','02'),(13.53,15.62,'CHANGER DE LOGIQUE','03'),(22.65,24.72,'APPORTER DE LA VALEUR','04'),(30.39,31.70,'LA COMPÉTENCE','05')]

def make_label(label,index):
 def cb(d):
  d.rounded_rectangle((41,443,512,504),radius=11,fill=(3,17,34,230),outline=(185,200,212,106),width=1)
  d.rounded_rectangle((41,443,48,504),radius=3,fill=GOLD)
  d.ellipse((65,459,99,493),outline=GOLD,width=2)
  textxy(d,(82,476),index,13,GOLD,'mm','s')
  textxy(d,(116,477),label,22,WHITE,'lm','b')
 return layer_from(cb)
LABEL_LAYERS=[make_label(label,index) for _,_,label,index in LABELS]

# Avoid any dynamic wall masking: only a *uniform* global slight white balance adjustment.
def balance(im):
 lab=cv2.cvtColor(im,cv2.COLOR_BGR2LAB)
 a=lab[:,:,1].astype('int16'); b=lab[:,:,2].astype('int16')
 lab[:,:,1]=np.uint8(np.clip((a-128)*.98+128,0,255))
 lab[:,:,2]=np.uint8(np.clip((b-128)*.96+128-.5,0,255))
 return cv2.cvtColor(lab,cv2.COLOR_LAB2BGR)

def zoom_at(t):
 z=0
 for start,end,scale in [(4.1,4.65,.035),(10.7,11.36,.043),(16.9,17.5,.030),(24.1,24.7,.04),(30.6,31.4,.04)]:
  if start<t<end:z=max(z,scale*math.sin(math.pi*(t-start)/(end-start))**2)
 return z


# Word-level timeline derived from nine recognized speech segments, manually mapped
# through the verified source cut list. Within each segment the word boundary
# estimates use duration-weighted allocation (not an acoustic forced aligner).
import unicodedata, re
TRIMS=[(0.0,3.9),(5.43333,7.7),(8.16667,10.06667),(10.7,14.7),(15.76667,16.93333),(17.9,40.56667),(40.93333,43.86667)]
SEGMENTS=[
 (.56,3.92,"Tu ne fais pas d'argent et tu n'en feras probablement pas parce que"),
 (5.36,7.92,"Tu te poses la mauvaise question dès le départ"),
 (8.24,10.32,"Comment faire pour gagner de l'argent en ligne ?"),
 (10.72,14.4,"Tout le monde veut gagner de l'argent, mais est-ce que tu sais comment on fait pour gagner de l'argent concrètement ?"),
 (15.695,17.055,"Est-ce que tu sais ?"),
 (17.935,29.295,"Non, je ne sais pas. Parce qu'en fait, ta question de départ n'est pas bonne. Comment on fait pour gagner de l'argent ? Je vais te le dire. On aide d'autres personnes à gagner de l'argent. Quand tu aides les gens autour de toi à gagner de l'argent, tu vas forcément gagner."),
 (29.67,37.83,"OK ? Ça, c'est le premier des points. Deuxième des points, tu dois apprendre quelque chose que les personnes seraient prêtes à te payer pour que tu résolves,"),
 (37.83,40.79,"pour leur faire gagner du temps, pour leur faire gagner de l'argent,"),
 (41.11,43.75,"pour résoudre un problème qui réside chez eux.")]

def phonetic_weight(w):
 u=unicodedata.normalize('NFD', w.lower());u=''.join(c for c in u if not unicodedata.combining(c))
 u=u.replace('œ','oe')
 count=len(re.findall(r'[aeiouy]+',u))
 return max(0.70, min(2.1, .65+.30*count+.032*len(u)))

def raw_to_output(a,b):
 offset=0.0; results=[]
 for s,e in TRIMS:
  i,j=max(s,a),min(e,b)
  if j>i+0.015:results.append((offset+i-s,offset+j-s))
  offset+=e-s
 return results

WORDS=[]
for a,b,line in SEGMENTS:
 tokens=line.split()
 weights=[phonetic_weight(w) for w in tokens]
 # Allocate recognized speech evenly by phonetic load over each aligned segment.
 durations=raw_to_output(a,b)
 if not durations:continue
 cum=0.0;total=sum(weights)
 for wd,weight in zip(tokens,weights):
  first=a+(b-a)*cum/total;cum+=weight
  last=a+(b-a)*cum/total
  mapped=raw_to_output(first,last)
  for start,end in mapped:
   if end-start<.038:continue
   WORDS.append({'word':wd,'start':round(start,3),'end':round(end,3)})

# Group into short legible phrases; always highlight the active spoken word.
CAPTIONS=[]; group=[]
for tok in WORDS:
 if group and (len(group)>=4 or sum(len(w['word'])+1 for w in group)+len(tok['word'])>29 or tok['start']-group[-1]['end']>.30):
  CAPTIONS.append(group);group=[]
 group.append(tok)
 if tok['word'].endswith(('.', '?', '!')) or (tok['word'].endswith(',') and len(group)>=3):
  CAPTIONS.append(group);group=[]
if group:CAPTIONS.append(group)

# V6 text-only subtitles: no background panels, borders, pills or rectangles.
# Pre-render an individual phrase for each active word. The whole phrase remains stable.
CACHED={}
TEXT_FONT='/usr/share/fonts/opentype/inter/Inter-SemiBold.otf'
FONT_SIZES=[24,23,22,21,20]
Y_SUB=449

def cache_subs():
 for p_index,words in enumerate(CAPTIONS):
  tokens=[w['word'] for w in words]
  measure=ImageDraw.Draw(Image.new('RGB',(1,1)))
  for size in FONT_SIZES:
   ff=ImageFont.truetype(TEXT_FONT,size)
   widths=[measure.textbbox((0,0),v,font=ff,stroke_width=0)[2] for v in tokens]
   gap=9 if size>=23 else 8
   total=sum(widths)+(len(tokens)-1)*gap
   if total<=735:break
  for active in range(len(tokens)):
   # Small fully transparent tile: just words, with 1px diffuse shadow for contrast.
   tile=Image.new('RGBA',(total+18,size+20),(0,0,0,0))
   d=ImageDraw.Draw(tile,'RGBA'); xx=9
   for j,(tok,ww) in enumerate(zip(tokens,widths)):
    col=(232,190,117,255) if j==active else (247,249,253,245)
    d.text((xx+1,7),tok,font=ff,fill=(0,0,0,145),stroke_width=1,stroke_fill=(0,0,0,85))
    d.text((xx,6),tok,font=ff,fill=col)
    xx+=ww+gap
   arr=np.array(tile)
   CACHED[(p_index,active)]=(int((W-tile.width)/2),Y_SUB,cv2.cvtColor(arr[:,:,:3],cv2.COLOR_RGB2BGR).astype(np.float32),arr[:,:,3:4].astype(np.float32)/255.)
cache_subs()

_pidx=0
def subtitle_on_frame(frame,time,fullscreen):
 global _pidx
 # No captions on or fading into fullscreen scenes.
 if fullscreen: return frame
 while _pidx<len(CAPTIONS)-1 and CAPTIONS[_pidx][-1]['end']+.02<time:_pidx+=1
 if _pidx>=len(CAPTIONS):return frame
 words=CAPTIONS[_pidx]; a=words[0]['start']; b=words[-1]['end']
 if not (a-.025<=time<=b+.025):return frame
 active=next((j for j,w in enumerate(words) if w['start']-.055<=time<w['end']+.015), None)
 if active is None:active=(0 if time<a else len(words)-1)
 x,y,fg,alpha=CACHED[(_pidx,active)]
 h,w=fg.shape[:2]
 # A simple 120 ms alpha fade on captions, not motion or popping effects.
 fade=max(0.0,min(1.0,(time-a+.025)/.12,(b+.025-time)/.12))
 fade=wave(fade)
 if fade<.001:return frame
 crop=frame[y:y+h,x:x+w]
 am=alpha*fade
 crop[:]=np.uint8(np.clip(crop.astype(np.float32)*(1-am)+fg*am,0,255))
 return frame

from pathlib import Path
import json
Path('/mnt/data/IMG_0506_CINEMATIC_V6_TIMING.json').write_text(json.dumps({'alignmentMethod':'recognized speech segments mapped to source cuts; estimated intra-segment word timing','sourceAudio':'original speech, not re-voiced','words':WORDS,'fullScreenSceneBounds':SCENES},ensure_ascii=False,indent=2),encoding='utf-8')

# Render a true 30fps video with four full-screen animated visual explanations.
proc=subprocess.Popen(['ffmpeg','-hide_banner','-loglevel','error','-y','-f','rawvideo','-pixel_format','bgr24','-video_size',f'{W}x{H}','-framerate',str(FPS),'-i','pipe:0','-an','-c:v','libx264','-preset','veryfast','-crf','16','-pix_fmt','yuv420p','-profile:v','high','-level','4.0','-movflags','+faststart',SILENT],stdin=subprocess.PIPE)
cap=cv2.VideoCapture(SOURCE)
assert cap.isOpened(), 'Source inaccessible'
frame_count=1165
for i in range(frame_count):
 ok,fr=cap.read()
 if not ok:raise RuntimeError(f'Missing source frame {i}')
 t=i/FPS
 fr=cv2.resize(fr,(W,H),interpolation=cv2.INTER_LANCZOS4)
 fr=balance(fr)
 z=zoom_at(t)
 if z>0.0001:
  cw=int(W/(1+z));ch=int(H/(1+z));x0=(W-cw)//2;y0=(H-ch)//2
  fr=cv2.resize(fr[y0:y0+ch,x0:x0+cw],(W,H),interpolation=cv2.INTER_LINEAR)
 # Compose facecam overlays using alpha - zero overlap with scene fullscreen visuals.
 scene_id=next((j for j,(a,b) in enumerate(SCENES) if a<=t<b),None)
 if scene_id is None:
  # No lower left boxes, labels, shapes or other decorations on face camera.
  f=fr.copy()
 else:
  a,b=SCENES[scene_id]; local=t-a;dur=b-a
  slide=BG.copy()
  # Slowly expanding understated radial accent + thin gold progress line.
  fx=Image.new('RGBA',(W,H),(0,0,0,0))
  d=ImageDraw.Draw(fx,'RGBA')
  radius=int(95+local*20)
  d.arc((741-radius,270-radius,741+radius,270+radius),-36,160,fill=(230,188,110,48),width=2)
  d.rounded_rectangle((52,510,908,512),radius=1,fill=(122,157,182,52))
  d.rounded_rectangle((52,510,52+int(856*local/dur),512),radius=1,fill=(220,179,108,190))
  slide.alpha_composite(fx)
  for layer,delay,speed,dy in LAYERS[scene_id]:mix_layer(slide,layer,local,delay,speed,dy)
  # Whole-frame nonlocal transition; no mask edges, no selective color artefacts.
  amt=fade_edge(local,dur,.34,.36)
  slide_bgr=cv2.cvtColor(np.asarray(slide.convert('RGB')),cv2.COLOR_RGB2BGR)
  f=cv2.addWeighted(slide_bgr,amt,fr,1-amt,0)
 f=subtitle_on_frame(f,t,scene_id is not None)
 # 0.13 second terminal fade; voice remains intact.
 if t>frame_count/FPS-.13:
  f=np.uint8(np.clip(f.astype(np.float32)*((frame_count/FPS-t)/.13),0,255))
 proc.stdin.write(f.tobytes())
 if i%220==0:print('rendered',i,'/',frame_count,flush=True)
proc.stdin.close();rc=proc.wait();cap.release()
if rc!=0:raise RuntimeError(f'Encoder failed {rc}')
subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-i',SILENT,'-i',f'{ROOT}/IMG_0506_CINEMATIC_V5_TRANSITIONS_NATURELLES_SOUSTITRES_FINS_IPHONE.mp4','-map','0:v:0','-map','1:a:0','-c:v','copy','-c:a','copy','-t',f'{frame_count/FPS:.6f}','-movflags','+faststart',OUT],check=True)
print('FILE',OUT,'SIZE',os.path.getsize(OUT),flush=True)
