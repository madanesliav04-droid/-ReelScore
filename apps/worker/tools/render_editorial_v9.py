#!/usr/bin/env python3
"""Edit+ editorial rework of three real client rushes.
User source audio always retained. Video footage: source and verified Mixkit only.
This is a supervised benchmark; not the autonomous production engine.
"""
import argparse, math, wave, os, json, subprocess, sys, pathlib, hashlib, time
import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter

ROOT=pathlib.Path(__file__).resolve().parent
F_REG="/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
F_BOLD="/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
if not pathlib.Path(F_BOLD).exists(): raise RuntimeError("DejaVu fonts missing")
C={'ink':(8,19,29),'cream':(250,244,227),'green':(115,238,206),'gold':(244,203,126),'muted':(181,197,194),'red':(244,141,120),'white':(255,255,255)}
def font(n,bold=False):return ImageFont.truetype(F_BOLD if bold else F_REG,n)
def E(x):return max(0,min(1,x))**2*(3-2*max(0,min(1,x)))
def ramp(t,start,dur=.32):return E((t-start)/dur)
def cover(arr,w,h,zoom=1.,dx=0.,dy=0.):
    sh,sw=arr.shape[:2];scale=max(w/sw,h/sh)*zoom
    rw=max(w,int(sw*scale+.5));rh=max(h,int(sh*scale+.5))
    im=cv2.resize(arr,(rw,rh),interpolation=cv2.INTER_LINEAR)
    x=int((rw-w)/2+dx*(rw-w)*.35);y=int((rh-h)/2+dy*(rh-h)*.35)
    return im[max(0,min(rh-h,y)):max(0,min(rh-h,y))+h,max(0,min(rw-w,x)):max(0,min(rw-w,x))+w]
def centered(draw,xy,text,ft,fill,width=None):
    bx=draw.textbbox((0,0),text,font=ft);ww=bx[2]-bx[0];draw.text((xy[0]-(ww/2),xy[1]),text,font=ft,fill=fill)
def alpha(txt,start,end,t,soft=.19):
    return E((t-start)/soft)*E((end-t)/soft)
def rect(canvas,area,r=23,fill=(8,19,29,235),outline=None,line=2,shadow=0):
    x,y,w,h=map(int,area)
    if shadow:
        sh=Image.new("RGBA",canvas.size,(0,0,0,0));sd=ImageDraw.Draw(sh)
        sd.rounded_rectangle((x+1,y+8,x+w+1,y+h+8),r,fill=(0,0,0,80))
        canvas.alpha_composite(sh.filter(ImageFilter.GaussianBlur(13)))
    d=ImageDraw.Draw(canvas)
    d.rounded_rectangle((x,y,x+w,y+h),radius=r,fill=fill,outline=outline,width=line)
def overlay_src(base,art,a):
    if a<=0:return base
    if a<.998:art=art.copy();art.putalpha(art.getchannel('A').point(lambda x:int(x*a)))
    return Image.alpha_composite(base,art)
def text(draw,x,y,s,sz,color='cream',bold=True):
    draw.text((int(x),int(y)),s,font=font(sz,bold),fill=C[color]+(255,))
def txt_block(im,x,y,lines,sz,leading=1.23,color='cream'):
    d=ImageDraw.Draw(im)
    for i,line in enumerate(lines):text(d,x,y+i*sz*leading,line,sz,color)
def pill(im,x,y,label,on=True,scale=1.0,wide=None):
    sz=int(15*scale);ft=font(sz,True);d=ImageDraw.Draw(im)
    ww=wide or d.textlength(label,font=ft)+36*scale;hh=34*scale
    color=C['green'] if on else C['muted']
    rect(im,(x,y,ww,hh),r=int(11*scale),fill=color+(255,) if on else (35,51,57,240))
    d=ImageDraw.Draw(im);d.text((x+18*scale,y+7*scale),label,font=ft,fill=C['ink']+(255,) if on else C['cream']+(255,))
def crop_anim(src,t,intervals,w,h):
    for a,b,zoom in intervals:
        if a<=t<b:
            strength=E(min((t-a)/.45,(b-t)/.45))
            return cover(src,w,h,zoom=1+zoom*max(0,strength))
    return cover(src,w,h)
def drawA(arr,t,w,h,broll=None):
    arr=crop_anim(arr,t,[(4.48,8.0,.055),(14.95,17.7,.045),(23.35,26.02,.053)],w,h)
    if broll and 4.64<t<5.90:
        tick=t-4.64
        broll.set(cv2.CAP_PROP_POS_MSEC,1000*(tick+1.0))
        ok,bf=broll.read()
        if ok:
            arr=cover(bf,w,h,zoom=1.01)
    base=Image.fromarray(cv2.cvtColor(arr,cv2.COLOR_BGR2RGB)).convert('RGBA')
    art=Image.new('RGBA',(w,h),(0,0,0,0));d=ImageDraw.Draw(art)
    if 0.15<=t<4.25:
        q=ramp(t,.2)
        x=int(26-290*(1-q))
        rect(art,(x,84,w-52,122),24,(8,19,29,224),shadow=1)
        text(d,x+18,98,'UNE IDÉE',22,'muted')
        text(d,x+18,128,"ÇA INTÉRESSE ?",36,'cream')
        d.rectangle((x+19,186,x+150,190),fill=C['gold']+(255,))
    if 4.56<=t<8.03:
        x=24;y=h-360
        rect(art,(x,y,w-48,145),21,(8,19,29,242),shadow=1)
        d=ImageDraw.Draw(art)
        text(d,x+24,y+16,'VANITÉ',16,'muted')
        text(d,x+24,y+46,'LES LIKES',37,'red')
        text(d,x+24,y+102,'≠  INTÉRÊT',24,'cream')
        d.rounded_rectangle((x+24,y+91,x+130,y+95),4,fill=C['red']+(255,))
    if 8.10<=t<14.95:
        # Build actual chat-question hierarchy; never fake engagement metrics.
        y0=375
        rect(art,(22,y0,w-44,304),26,(8,19,29,240),shadow=1)
        d=ImageDraw.Draw(art)
        text(d,46,y0+18,'LA PREUVE : LES QUESTIONS',17,'green')
        cards=[('Ça marche comment ?',8.10),('Ça coûte combien ?',9.37),('Tu peux le faire pour moi ?',10.80)]
        for k,(s,start) in enumerate(cards):
            if t<start:continue
            slide=int(145*(1-ramp(t,start,.36)))
            yy=y0+65+k*70
            rect(art,(45+slide,yy,w-90,57),18,(33,57,67,240),outline=C['green']+(130,),line=1)
            d=ImageDraw.Draw(art);text(d,60+slide,yy+16,s,18,'cream')
            d.ellipse((w-90+slide,yy+21,w-78+slide,yy+33),fill=C['green']+(255,))
    if 15.1<=t<23.2:
        # Compare reaction and active intent; no fabricated social results.
        cy=h-286
        rect(art,(22,cy,w-44,196),24,(8,19,29,243),shadow=1)
        d=ImageDraw.Draw(art)
        left=(44,cy+31);right=(265,cy+31)
        text(d,*left,'RÉACTION',20,'muted')
        text(d,*right,'INTENTION',20,'green')
        d.line((w//2,cy+18,w//2,cy+158),fill=(124,150,151,105),width=2)
        text(d,44,cy+83,'UN LIKE',24,'red')
        text(d,265,cy+83,'UNE QUESTION',22,'cream')
        d.rounded_rectangle((264,cy+132,w-54,cy+137),3,fill=C['green']+(255,))
    if 23.35<=t<26.2:
        x=22; y=h-300
        rect(art,(x,y,w-44,124),22,(8,19,29,238),shadow=1)
        d=ImageDraw.Draw(art);text(d,43,y+16,'VOILÀ LE SIGNAL :',17,'muted');text(d,40,y+50,'INTÉRÊT RÉEL.',32,'green')
    if 26.15<=t<34.65:
        rect(art,(22,80,w-44,105),20,(8,19,29,218),shadow=1)
        d=ImageDraw.Draw(art);text(d,43,94,'CHERCHE LES BONNES',22,'cream');text(d,43,126,'QUESTIONS.',29,'green')
    base=overlay_src(base,art,1)
    return cv2.cvtColor(np.asarray(base.convert('RGB')),cv2.COLOR_RGB2BGR)
def drawB(arr,t,w,h):
    arr=crop_anim(arr,t,[(0.54,3.9,.055),(5.35,8.0,.035),(17.9,22.1,.045),(29.67,35.5,.052)],w,h)
    base=Image.fromarray(cv2.cvtColor(arr,cv2.COLOR_BGR2RGB)).convert('RGBA')
    art=Image.new('RGBA',(w,h),(0,0,0,0));d=ImageDraw.Draw(art)
    if .55<=t<4.10:
        x=int(25-330*(1-ramp(t,.57)))
        rect(art,(x,25,w*.56,114),21,(8,19,29,237),shadow=1)
        d=ImageDraw.Draw(art);text(d,x+22,43,'TU TE POSES',25,'cream');text(d,x+22,78,'LA MAUVAISE QUESTION.',24,'gold')
    if 5.35<=t<7.9:
        rect(art,(22,h-145,w*.60,110),21,(8,19,29,240),shadow=1)
        d=ImageDraw.Draw(art);text(d,43,h-130,'LE PROBLÈME :',22,'muted');text(d,42,h-91,'LA QUESTION.',34,'cream')
    if 8.24<=t<14.4:
        # Bold question scene but speaker remains visible (left panel only).
        x=18;ww=w*.60
        rect(art,(x,57,ww,185),24,(8,19,29,238),shadow=1)
        d=ImageDraw.Draw(art);text(d,40,76,'LA QUESTION',20,'muted')
        txt_block(art,40,113,['COMMENT GAGNER','DE L’ARGENT','EN LIGNE ?'],28,1.16,'gold')
    if 17.94<=t<29.3:
        # No generic cash stock: visual illustration of action/value exchange.
        ww=w*.54;x=17;y=h-198
        rect(art,(x,y,ww,156),22,(8,19,29,238),shadow=1)
        d=ImageDraw.Draw(art)
        text(d,x+24,y+17,'LE MÉCANISME',19,'muted')
        text(d,x+23,y+57,'AIDER QUELQU’UN',28,'cream')
        if t>=22.9:
            text(d,x+23,y+103,'= CRÉER DE LA VALEUR',20,'green')
        else:text(d,x+23,y+104,'AVANT DE VENDRE',19,'gold')
    if 29.67<=t<37.8:
        rect(art,(18,22,w*.58,120),22,(8,19,29,240),shadow=1)
        d=ImageDraw.Draw(art);text(d,39,38,'2. APPRENDRE',24,'green');text(d,39,79,'UNE COMPÉTENCE UTILE',21,'cream')
    if 37.83<=t<44.5:
        rect(art,(20,h-160,w*.68,127),22,(8,19,29,241),shadow=1)
        d=ImageDraw.Draw(art)
        text(d,43,h-148,'RÉSOUDRE UN PROBLÈME',25,'cream')
        text(d,43,h-104,'FAIRE GAGNER DU TEMPS',21,'green')
        text(d,43,h-71,'OU DE L’ARGENT',21,'gold')
    return cv2.cvtColor(np.asarray(overlay_src(base,art,1).convert('RGB')),cv2.COLOR_RGB2BGR)
def drawC(arr,t,w,h):
    # Board first: never cover its writing with stock photos / large cards.
    arr=crop_anim(arr,t,[(0,4.7,.018),(25.1,28.2,.022),(38.0,43.5,.017)],w,h)
    base=Image.fromarray(cv2.cvtColor(arr,cv2.COLOR_BGR2RGB)).convert('RGBA')
    art=Image.new('RGBA',(w,h),(0,0,0,0));d=ImageDraw.Draw(art)
    if t<4.75:
        rect(art,(22,89,w-44,77),20,(8,19,29,231),shadow=1)
        d=ImageDraw.Draw(art);text(d,46,103,'TON BUSINESS',20,'muted');text(d,46,132,'3 CASES. PAS 30 PROBLÈMES.',18,'cream')
    if t>=4.75:
        # Board safe zone: small translucent header above head/board, footer below hands.
        ribbon_y=88
        rect(art,(18,ribbon_y,w-36,57),17,(8,19,29,222))
        labels=['ATTIRER','CONVERTIR','LIVRER']
        which=0 if t<25 else (1 if t<33 else 2)
        if t>38.0:which=2
        for i,s in enumerate(labels):
            px=28+i*(w-54)/3; on=(i==which)
            pill(art,px,ribbon_y+10,s,on,scale=.74,wide=(w-72)/3)
        if 25.08<=t<32.7:
            rect(art,(23,h-207,w-46,71),17,(8,19,29,237),shadow=1)
            d=ImageDraw.Draw(art);text(d,42,h-193,'VISIBLE MAIS AUCUN ACHAT ?',17,'cream');text(d,42,h-164,'PROBLÈME DE CONVERSION.',17,'green')
        if 32.8<=t<38:
            rect(art,(23,h-207,w-46,71),17,(8,19,29,237),shadow=1)
            d=ImageDraw.Draw(art);text(d,42,h-193,'ACHATS MAIS INSATISFACTION ?',16,'cream');text(d,42,h-164,'PROBLÈME DE LIVRAISON.',17,'gold')
        if 38<=t<43.5:
            rect(art,(23,h-210,w-46,84),17,(8,19,29,238),shadow=1)
            d=ImageDraw.Draw(art);text(d,42,h-195,'NE CHANGE PAS TOUT.',18,'cream')
            text(d,42,h-165,'CORRIGE LA CASE FAIBLE.',18,'green')
    return cv2.cvtColor(np.asarray(overlay_src(base,art,1).convert('RGB')),cv2.COLOR_RGB2BGR)
def write_sfx(path,duration,events,sr=48000):
    n=int((duration+1)*sr); data=np.zeros(n,dtype=np.float32)
    for start,fr in events:
        k=int(start*sr);length=int(.10*sr)
        tt=np.arange(length)/sr
        sig=np.sin(2*math.pi*fr*tt)*(np.maximum(0,1-tt/.10)**3)*.016
        if k+length<n:data[k:k+length]+=sig
    with wave.open(str(path),'wb') as w:
        w.setnchannels(1);w.setsampwidth(2);w.setframerate(sr)
        w.writeframes((np.clip(data,-1,1)*32767).astype('<i2').tobytes())
def render(key,source,target,stock=None):
    cap=cv2.VideoCapture(str(source))
    if not cap.isOpened():raise RuntimeError('cannot open '+str(source))
    w=int(cap.get(cv2.CAP_PROP_FRAME_WIDTH));h=int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    fps=cap.get(cv2.CAP_PROP_FPS); count=int(cap.get(cv2.CAP_PROP_FRAME_COUNT)); duration=count/max(1,fps)
    if min(w,h)<240:raise RuntimeError('source raster too small')
    print('SOURCE',key,w,h,fps,count,duration,flush=True)
    sfx=target.with_suffix('.sfx.wav')
    events={'A':[(4.56,540),(8.16,690),(9.44,775),(10.80,820),(23.435,610)],
            'B':[(5.36,540),(8.24,690),(22.9,650),(29.67,745)],
            'C':[(4.75,650),(25.1,650),(32.9,650),(38.0,750)]}[key]
    write_sfx(sfx,duration,events)
    # Decode visuals in OpenCV, author graphics per actual source time and mux intact source voice.
    ff=['ffmpeg','-hide_banner','-loglevel','error','-y','-f','rawvideo','-pixel_format','bgr24','-video_size',f'{w}x{h}','-framerate','30','-i','pipe:0','-i',str(source),'-i',str(sfx),'-filter_complex',
        '[1:a:0]volume=1.0[voice];[2:a]volume=.9[sfx];[voice][sfx]amix=inputs=2:duration=first:dropout_transition=0,alimiter=limit=0.94[a]',
        '-map','0:v:0','-map','[a]','-c:v','libx264','-preset','veryfast','-crf','19','-pix_fmt','yuv420p','-r','30',
        '-c:a','aac','-b:a','160k','-movflags','+faststart','-shortest',str(target)]
    p=subprocess.Popen(ff,stdin=subprocess.PIPE,stderr=subprocess.PIPE)
    cut=None
    if key=='A' and stock and pathlib.Path(stock).exists():
        cut=cv2.VideoCapture(str(stock))
        if not cut.isOpened():cut=None
    n=0
    try:
        while True:
            ok,fr=cap.read()
            if not ok:break
            t=n/max(fps,1)
            if key=='A':out=drawA(fr,t,w,h,cut)
            elif key=='B':out=drawB(fr,t,w,h)
            else:out=drawC(fr,t,w,h)
            if out.shape[:2]!=(h,w):raise RuntimeError('invalid raster')
            p.stdin.write(out.tobytes())
            n+=1
            if n%500==0:print('FRAME',key,n,flush=True)
    except Exception:
        p.kill();p.wait();raise
    finally:
        cap.release()
        if cut is not None:cut.release()
    p.stdin.close()
    err=p.stderr.read().decode('utf-8','replace');ret=p.wait()
    if ret:raise RuntimeError('FFMPEG '+key+': '+err[-1500:])
    prob=json.loads(subprocess.check_output(['ffprobe','-v','error','-show_format','-show_streams','-of','json',str(target)]))
    vd=next(x for x in prob['streams'] if x['codec_type']=='video')
    aud=next((x for x in prob['streams'] if x['codec_type']=='audio'),None)
    if not aud or vd['codec_name']!='h264':raise RuntimeError('bad export streams')
    if abs(float(prob['format']['duration'])-duration)>1:raise RuntimeError('duration mismatch')
    check=subprocess.run(['ffmpeg','-v','error','-xerror','-i',str(target),'-f','null','-'],capture_output=True,text=True,timeout=180)
    if check.returncode:raise RuntimeError('full decode failed '+check.stderr[-400:])
    return {'version':'EDITORIAL_V9','video':target.name,'source':source.name,'duration_sec':round(duration,2),'fps':fps,'raster':f'{w}x{h}','frames':n,'audio':'original speech + low-level custom accents','decode_ok':True,'output_bytes':target.stat().st_size,'sha256':hashlib.sha256(target.read_bytes()).hexdigest(),'supervised':True}
def sheet(source,out,durations):
    cap=cv2.VideoCapture(str(source));shots=[]
    for sec in durations:
        cap.set(cv2.CAP_PROP_POS_MSEC,sec*1000);ok,fr=cap.read()
        if ok:
            hh=240; ww=int(fr.shape[1]*hh/fr.shape[0]);fr=cv2.resize(fr,(ww,hh))
            shots.append(Image.fromarray(cv2.cvtColor(fr,cv2.COLOR_BGR2RGB)))
    if not shots:return
    ww=max(s.width for s in shots);pan=Image.new('RGB',(ww*min(len(shots),4),240*math.ceil(len(shots)/4)),(9,18,27))
    for i,s in enumerate(shots):pan.paste(s,((i%4)*ww,(i//4)*240))
    pan.save(out,quality=83)
if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--input',required=True);p.add_argument('--output',default='out');p.add_argument('--stock',default='');args=p.parse_args()
    root=pathlib.Path(args.input);out=pathlib.Path(args.output);out.mkdir(parents=True,exist_ok=True)
    names={'A':'source_a.mp4','B':'source_b.mp4','C':'source_c.mp4'}
    results=[]
    for key,f in names.items():
        source=root/f
        if not source.exists():raise RuntimeError('missing '+str(source))
        target=out/f'EditPlus_PREMIUM_EDITORIAL_V9_{key}.mp4'
        result=render(key,source,target,stock=args.stock if key=='A' else None)
        sheet(target,out/f'CONTACT_{key}.jpg',[1.5,4.9,8.7,11.6,16.3,23.8,29.9,40.1] if key!='A' else [1,5,8.7,10.6,15.9,20.1,24.3,30])
        results.append(result);print('DONE',json.dumps(result),flush=True)
    (out/'QA.json').write_text(json.dumps(results,indent=2,ensure_ascii=False))
    (out/'README.txt').write_text('Actual re-edit exports using the V4 source assets (not raw rushes). These edits are supervised, not the final autonomous Edit+ engine. A: contrast, question cards, precise returns. B: visual argument about value without money cliches. C: board always primary, small stage indicators. Source media and audio preserved; no fake business metrics. QA.json documents full decode and hashes.\\n')
