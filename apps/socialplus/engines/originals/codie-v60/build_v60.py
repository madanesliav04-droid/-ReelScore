#!/usr/bin/env python3
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont,ImageFilter
import re,math,subprocess,hashlib,json,shlex
SRC=Path('/mnt/data/editplus-work/originals/IMG_0506.mp4')
B1=Path('/mnt/data/editplus-v57/clips/MX-18296.mp4')
B2=Path('/mnt/data/editplus-v58/MX-241.mp4')
AUDIO=Path('/mnt/data/EDITPLUS_V59_BULLES_TEMPS_ARGENT_OMNI.mp4')
OLD_CAP=Path('/mnt/data/editplus-v57/captions_v57.ass')
ROOT=Path('/mnt/data/editplus-v60'); OUT=Path('/mnt/data/EDITPLUS_V60_FINITION_OMNI.mp4')
W,H,FPS=910,512,30
for p in [SRC,B1,B2,AUDIO,OLD_CAP]:assert p.exists(),p
# Clean captions: adjacent entries never overlap. 10% legibility increase,
# preserving original wording, paired highlight and human grouping.
text=OLD_CAP.read_text();header,_,ev=text.partition('Dialogue: 3,')
raw=['Dialogue: 3,'+x for x in ev.split('Dialogue: 3,') if x.strip()]
def tsec(t):
 h,m,s=re.split('[:]',t);return int(h)*3600+int(m)*60+float(s)
def stime(v):
 c=int(round(v*100));sec=c//100;return f'{sec//3600}:{sec//60%60:02d}:{sec%60:02d}.{c%100:02d}'
items=[]
for e in raw:
 xs=e.strip().split(',',9)
 if len(xs)!=10:continue
 items.append({'fields':xs,'start':tsec(xs[1]),'end':tsec(xs[2])})
repaired=0
for a,b in zip(items,items[1:]):
 if a['end']>b['start']:
  boundary=(a['end']+b['start'])/2
  # A genuine final gap, never overlapping translucent captions.
  a['end']=max(a['start']+.12,boundary-.015)
  b['start']=min(b['end']-.12,boundary+.015)
  repaired+=1
assert all(a['end']<=b['start']+1e-5 for a,b in zip(items,items[1:])), 'ASS overlap remains'
header=header.replace('Inter Display,31,','Inter Display,34,').replace('1,2.3,.5,2,60,60,43,1','1,2.6,.8,2,60,60,45,1')
newtxt=header + '\n'.join(','.join([x['fields'][0],stime(x['start']),stime(x['end'])]+x['fields'][3:]) for x in items) +'\n'
CAP=ROOT/'captions_clean_v60.ass';CAP.write_text(newtxt,encoding='utf8')
# Image assets were redesigned already in V59, keep style, change centering/timing.
S=4;FONT='/usr/share/fonts/opentype/inter/InterDisplay-SemiBold.otf'
assert Path(FONT).exists()
COL_BG=(34,38,48,250);COL_OUT=(198,179,218,255);COL_W=(248,245,250,255)
def tile(kind):
 t=Image.new('RGBA',(196*S,196*S),(0,0,0,0));d=ImageDraw.Draw(t);x=y=98*S;r=52*S
 sh=Image.new('RGBA',t.size);sd=ImageDraw.Draw(sh)
 sd.ellipse((x-r+5*S,y-r+9*S,x+r+5*S,y+r+9*S),fill=(0,0,0,105));t.alpha_composite(sh.filter(ImageFilter.GaussianBlur(8*S)))
 d.ellipse((x-r,y-r,x+r,y+r),fill=COL_BG,outline=COL_OUT,width=3*S)
 d.arc((x-r+5*S,y-r+5*S,x+r-5*S,y+r-5*S),180,319,fill=(246,230,255,75),width=2*S)
 if kind=='clock':
  cr=27*S;d.ellipse((x-cr,y-cr,x+cr,y+cr),outline=COL_W,width=4*S)
  d.line((x,y,x,y-16*S),fill=COL_W,width=4*S)
  d.line((x,y,x+12*S,y+6*S),fill=COL_W,width=4*S)
  d.ellipse((x-4*S,y-4*S,x+4*S,y+4*S),fill=COL_W)
  for a in [-90,0,90,180]:
   q=a*math.pi/180
   d.line((round(x+21*S*math.cos(q)),round(y+21*S*math.sin(q)),round(x+24*S*math.cos(q)),round(y+24*S*math.sin(q))),fill=COL_W,width=2*S)
 else:
  f=ImageFont.truetype(FONT,64*S);bb=d.textbbox((0,0),'€',font=f)
  d.text((round(x-(bb[0]+bb[2])/2),round(y-(bb[1]+bb[3])/2-2*S)),'€',font=f,fill=COL_W)
 return t.resize((196,196),Image.Resampling.LANCZOS)
assets={'clock':tile('clock'),'euro':tile('euro')}
# Original word timings are estimates, corrected to spoken nouns after trimming.
# Time word source 39.07s - (1.2667+1.0333)=36.77; argent source 40.444 - 2.3=38.144.
CUES=[{'kind':'clock','x':176,'y':161,'start':36.77,'end':39.0,'spoken':'temps'},
      {'kind':'euro','x':852,'y':161,'start':38.14,'end':40.25,'spoken':'argent'}]
T0=36.62;T1=40.50;fps=30;N=math.ceil((T1-T0)*fps)
seq=ROOT/'png';seq.mkdir(exist_ok=True)
def smoother(v):v=max(0,min(1,v));return v*v*(3-2*v)
for i in range(N):
 tim=T0+i/fps;canvas=Image.new('RGBA',(W,H),(0,0,0,0))
 for c in CUES:
  loc=tim-c['start'];end=c['end']
  if not (c['start']<=tim<end):continue
  if loc<.15:sc=.35+.72*smoother(loc/.15)
  elif loc<.29:sc=1.07+.095*math.sin((loc-.15)/.14*math.pi)
  elif loc<.43:sc=1.07-.07*smoother((loc-.29)/.14)
  else:sc=1.0
  alpha=min(1,loc/.09,(end-tim)/.25);rise=35*smoother(loc/.58)
  cx,cy=c['x'],c['y']+round(25-rise)
  sz=max(1,round(196*sc))
  icon=assets[c['kind']].resize((sz,sz),Image.Resampling.LANCZOS)
  if alpha<.999:icon.putalpha(icon.getchannel('A').point(lambda a:int(a*alpha)))
  canvas.alpha_composite(icon,(round(cx-sz/2),round(cy-sz/2)))
  if .095<loc<.38:
   progress=smoother((loc-.095)/.285)
   rr=57+17*progress;opacity=round(98*(1-progress)*alpha)
   if opacity>0:
    ring=Image.new('RGBA',canvas.size);d=ImageDraw.Draw(ring)
    d.ellipse((round(cx-rr),round(cy-rr),round(cx+rr),round(cy+rr)),outline=(201,177,227,opacity),width=2)
    canvas.alpha_composite(ring)
 canvas.save(seq/f'bubble_{i:04d}.png',compress_level=2)
# Assemble ALL frames from source, new B-roll overlays, then burn subtitles ONCE.
# Audio pass-through bit-exact from V59 preserving previously approved narration/SFX.
fl=[];ranges=[(0,119),(157,436),(467,1335)]
for i,(a,b) in enumerate(ranges):fl.append(f'[0:v]trim=start_frame={a}:end_frame={b},setpts=PTS-STARTPTS[v{i}]')
fl.append('[v0][v1][v2]concat=n=3:v=1:a=0,format=yuv420p[face]')
for index,start,end,cut in [(1,6.9733,9.1833,1.05),(2,33.28,35.46,2.3)]:
 dt=end-start
 fl.append(f'[{index}:v]trim=start={cut:.3f}:duration={dt:.4f},setpts=PTS-STARTPTS+{start:.4f}/TB,fps=30,scale=910:512:force_original_aspect_ratio=increase,crop=910:512,setsar=1,format=yuv420p[b{index}]')
 fl.append(f'[{'face' if index==1 else 'o1'}][b{index}]overlay=x=0:y=0:eof_action=pass:repeatlast=0:enable=between(t\\,{start:.4f}\\,{end:.4f})[o{index}]')
fl.append(f'[o2]ass={CAP},fps=30,format=yuv420p[sub]')
fl.append(f'[4:v]format=rgba,setpts=PTS-STARTPTS+{T0}/TB[ani]')
fl.append('[sub][ani]overlay=x=0:y=0:eof_action=pass:repeatlast=0:format=auto,format=yuv420p[vout]')
cmd=['ffmpeg','-hide_banner','-loglevel','error','-y','-i',str(SRC),'-i',str(B1),'-i',str(B2),'-i',str(AUDIO),'-framerate','30','-start_number','0','-i',str(seq/'bubble_%04d.png'),'-filter_complex',';'.join(fl),'-map','[vout]','-map','3:a:0','-c:v','libx264','-preset','veryfast','-crf','18','-pix_fmt','yuv420p','-threads','2','-c:a','copy','-t','42.2','-movflags','+faststart',str(OUT)]
(ROOT/'render_command.txt').write_text(shlex.join(cmd))
print('RENDERING V60, caption overlap fixes:',repaired, 'frames:',N, flush=True)
subprocess.run(cmd,check=True,timeout=270)
print('V60 OUTPUT',OUT,OUT.stat().st_size,flush=True)
(ROOT/'V60_CHANGELOG.json').write_text(json.dumps({'source':'original IMG_0506.mp4 + old V58 B-roll clips + V59 AAC','human_supervised':True,'cut_ranges_frames':ranges,'broll':[B1.name,B2.name],'caption_overlaps_removed':repaired,'caption_font':'Inter Display SemiBold 34px (Avenir reference, not exact)','graphic_cues':CUES,'audio':'copied original encoded stream from V59; no audio changes','timing_caveat':'prior ASR estimates, not independent forced alignment'},ensure_ascii=False,indent=2))
