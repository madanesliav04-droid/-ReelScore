#!/usr/bin/env python3
"""Edit+ Spatial Motion V9: original footage + content-conditioned continuous UI choreography.
Reference provides transition grammar only; no copying its imagery/text.
2.5D anchored matte: not true metric 3D or perfect word alignment.
"""
import os,sys,time,math,subprocess,cv2,numpy as np
from PIL import Image,ImageDraw,ImageFont,ImageFilter
from functools import lru_cache
B='/mnt/data'; SRC=B+'/files/IMG_0516.mp4'; W,H,N,FPS=910,512,1416,30
OUT=B+'/EDITPLUS_SPATIAL_UI_V9_VIDEO_ONLY.mp4'
# Reuse established verbatim ASR transcript + word highlight, never invent captions.
old=open(B+'/editplus_spatial_ui_v8_pipeline.py',encoding='utf8').read()
exec(old[:old.index('# alpha blend with optional')],globals())
OUT=B+"/EDITPLUS_SPATIAL_UI_V9_VIDEO_ONLY.mp4"
# Overrides from V8: new UI and timeline
W,H,N,FPS=910,512,1416,30
S2=2; PANEL_W,PANEL_H=290,153
FONT_DIR='/usr/share/fonts/opentype/inter'
@lru_cache(100)
def font(size,weight='medium'):
    f={'regular':'Inter-Regular.otf','medium':'Inter-Medium.otf','semi':'Inter-SemiBold.otf'}[weight]
    return ImageFont.truetype(f'{FONT_DIR}/{f}',size)

def ease(v):
    v=max(0.,min(1.,v)); return v*v*(3-2*v)

def fade(t,a,b,r=.38):return ease((t-a)/r)*ease((b-t)/r)

def txt(d,pos,s,size=14,color=(31,43,46,245),wt='medium',anchor=None):
    d.text((int(pos[0]*S2),int(pos[1]*S2)),s,font=font(size*S2,wt),fill=color,anchor=anchor)

def path(d,pts,color=(37,58,64,210),width=1.3,joint='curve'):
    d.line([(int(x*S2),int(y*S2)) for x,y in pts],fill=color,width=max(1,int(width*S2)),joint=joint)

def pill(d,xy,radius=6,fill=(100,146,163,140),stroke=(255,255,255,60)):
    x,y=xy;bb=((x-radius)*S2,(y-radius)*S2,(x+radius)*S2,(y+radius)*S2)
    d.ellipse(bb,fill=fill,outline=stroke,width=S2)

def rr(d,rect,r=10,fill=None,outline=(62,84,87,85),stroke=1):
    d.rounded_rectangle(tuple(int(v*S2) for v in rect),radius=int(r*S2),fill=fill,outline=outline,width=int(stroke*S2))

# Use same fixed spatial skeleton throughout all scenes, so each phase transforms the same line and active node.
# Exact narrative cue times are approximate anchors to be corrected when word-level alignment exists.
parts=[(0.52,8.66),(8.51,20.86),(20.72,36.78),(36.57,45.65)]

def stage0(d,t):
    # Line graph gradually draws in: maps abstract growth into three numbered steps.
    p=ease((t-.75)/2.7)
    txt(d,(15,9),'OBJECTIF',10,(55,78,82,207),'semi')
    txt(d,(88,7),'90 JOURS',10,(70,89,93,180),'medium')
    txt(d,(15,31),'Une méthode, 3 étapes',21,(29,42,47,247),'semi')
    path(d,[(15,67),(274,67)],(88,112,121,72),.75)
    nodes=[(23,84),(141,84),(259,84)]
    labels=['COMPÉTENCE','OFFRE','PROSPECTION']
    for i,xy in enumerate(nodes):
        amount=ease((p*3-i)*1.4)
        if amount<.001:continue
        pill(d,xy,5.6,fill=(78,123,140,int(210*amount)))
        if i<2:
            x1=xy[0]+8;x2=nodes[i+1][0]-8
            path(d,[(x1,84),(x1+(x2-x1)*amount,84)],(76,121,135,int(166*amount)),1.8)
        txt(d,(max(4,xy[0]-17),100),f'0{i+1}',10,(65,91,99,int(235*amount)),'semi')
        if i==0:tx=3
        elif i==1:tx=123
        else:tx=217
        txt(d,(tx,118),labels[i],10,(51,68,72,int(230*amount)),'semi')
    # Gentle travelling spark along common line; creates anticipation rather than random ornament
    prog=ease((t-3.05)/4.35)
    if .01<prog<.99:
        pill(d,(23+236*prog,84),2.6,fill=(113,154,166,195))

def stage1(d,t):
    txt(d,(16,8),'01 / 03',10,(65,100,112,230),'semi')
    txt(d,(16,31),'Compétence',26,(29,42,47,248),'semi')
    txt(d,(17,66),'Créer une valeur concrète',11,(77,93,96,210),'regular')
    path(d,[(19,87),(271,87)],(61,98,106,100),1)
    labels=['PROBLÈME','TEMPS','ARGENT']
    # each value lights up exactly as corresponding sentence becomes current
    times=[(13.7,16.7),(16.55,18.47),(18.3,20.65)]
    for k,(a,b) in enumerate(times):
        x=23+k*93
        p=max(.02,fade(t,a-.3,b+.15,.4)) if t>13.4 else .08
        col=(67,121,137,int(200*(.35+.65*p)))
        pill(d,(x,87),4.3,fill=col)
        txt(d,(max(6,x-6),104),labels[k],10,(47,66,70,int(170+65*p)),'medium')
    # a continuous descending underline travels from central point to current value
    phase=ease((t-13.65)/6.0)
    x=20+250*phase
    path(d,[(x-14,132),(x,132)],(85,136,150,180),2.1)

def stage2(d,t):
    # Shared baseline expands seamlessly into document-style details (reference-inspired transformation, no copy)
    p=ease((t-20.66)/1.0)
    txt(d,(16,8),'02 / 03',10,(65,100,112,230),'semi')
    txt(d,(16,30),'Offre',26,(29,42,47,248),'semi')
    txt(d,(17,61),'Ce qui te différencie',11,(77,93,96,211),'regular')
    # Document outline traces rather than pops in: lightweight icon replaces white card
    X=232;Y=25
    seg=[[(X,Y+9),(X,Y+62)],[(X,Y+62),(X+37,Y+62)],[(X+37,Y+62),(X+37,Y+11)],[(X+37,Y+11),(X+26,Y)],[(X+26,Y),(X,Y)]]
    for j,s in enumerate(seg):
        pp=ease(p*4.8-j*.75)
        if pp>0:
            (x0,y0),(x1,y1)=s;path(d,[(x0,y0),(x0+(x1-x0)*pp,y0+(y1-y0)*pp)],(74,116,128,int(180*pp)),1.3)
    for y,ratio in [(47,.9),(57,.7),(67,.78)]:
        path(d,[(X+8,y),(X+8+20*ratio*ease((t-21.0)/.9),y)],(90,130,140,132),1.4)
    # 3 elements of an offer assemble sequentially as the actual explanation proceeds
    descriptors=[(24.7,'DIFFÉRENCE'),(28.6,'AVANTAGES'),(32.4,'BÉNÉFICE')]
    for j,(trigger,lab) in enumerate(descriptors):
        pr=ease((t-trigger)/.5)
        if pr<=.005:continue
        y=90+j*19; path(d,[(17,y),(28,y)],(87,141,153,int(210*pr)),2)
        txt(d,(36,y-8),lab,11,(45,65,70,int(227*pr)),'medium')
    # tiny checkpoint tracer hints at next phase
    step=(t-20.75)/(36.7-20.75)
    path(d,[(17,147),(17+250*max(0,min(1,step)),147)],(84,124,136,110),.8)

def stage3(d,t):
    txt(d,(16,8),'03 / 03',10,(65,100,112,228),'semi')
    txt(d,(16,29),'Prospection',25,(29,42,47,248),'semi')
    txt(d,(16,58),'Parler au bon client',11,(77,93,96,210),'regular')
    # Liquid thread arcs gradually become messages. Not literal messages, avoids fake customer statements.
    cues=[(38.2,'CHERCHER'),(40.0,'ÉCHANGER'),(42.0,'CHAUD · TIÈDE · FROID')]
    for j,(a,lab) in enumerate(cues):
        p=ease((t-a)/.50); y=79+j*22
        if p>.005:
            w=193 if j==2 else (158 if j==1 else 128)
            w*=p
            rr(d,(17,y,17+w,y+18),8,fill=(230,245,248,int(25*p)),outline=(82,125,138,int(116*p)))
            txt(d,(28,y+4),lab,10,(46,70,78,int(240*p)),'medium')
    dotpos=17+244*ease((t-36.68)/8.75)
    pill(d,(dotpos,149),2.4,fill=(81,128,144,159))

def stage_weights(t):
    # A constant-weight handoff is critical: the outgoing element never disappears before
    # the incoming one takes over. This is a true continuous cross-state composition.
    transitions=[(8.43,9.09),(20.55,21.22),(36.48,37.17)]
    if t<transitions[0][0]: v=[1.,0.,0.,0.]
    elif t<=transitions[0][1]:
        p=ease((t-transitions[0][0])/(transitions[0][1]-transitions[0][0]));v=[1-p,p,0.,0.]
    elif t<transitions[1][0]:v=[0.,1.,0.,0.]
    elif t<=transitions[1][1]:
        p=ease((t-transitions[1][0])/(transitions[1][1]-transitions[1][0]));v=[0.,1-p,p,0.]
    elif t<transitions[2][0]:v=[0.,0.,1.,0.]
    elif t<=transitions[2][1]:
        p=ease((t-transitions[2][0])/(transitions[2][1]-transitions[2][0]));v=[0.,0.,1-p,p]
    else:v=[0.,0.,0.,1.]
    lifetime=ease((t-.5)/.44)*ease((45.60-t)/.5)
    return [z*lifetime for z in v]

@lru_cache(maxsize=16)
def static_overlay(k,step):
    pass

def ui(t):
    global S2
    q=Image.new('RGBA',(PANEL_W*S2,PANEL_H*S2),(0,0,0,0))
    weights=stage_weights(t)
    # A hairline thread persists during morph, shared motion geometry across states
    dl=ImageDraw.Draw(q)
    path(dl,[(15,143),(268,143)],(59,89,99,30),.65)
    for k,weight in enumerate(weights):
        if weight<.003:continue
        layer=Image.new('RGBA',q.size,(0,0,0,0));d=ImageDraw.Draw(layer)
        [stage0,stage1,stage2,stage3][k](d,t)
        # Translate labels on their way out/in, never superimpose two headings.
        offset=0
        for old_ix,(a,b) in enumerate([(8.43,9.09),(20.55,21.22),(36.48,37.17)]):
            if a<=t<=b:
                u=ease((t-a)/(b-a))
                if k==old_ix:offset=round(-105*u)
                elif k==old_ix+1:offset=round(105*(1-u))
                break
        if offset:
            moved=Image.new('RGBA',q.size,(0,0,0,0))
            moved.alpha_composite(layer,(offset*S2,0))
            layer=moved
        layer.putalpha(layer.getchannel('A').point(lambda v:int(v*min(1,weight))))
        q.alpha_composite(layer)
    # Shared energy path animates across scene transitions: one UI element hands motion to the next.
    # Uses cubic smoothstep, preserving tangent direction and avoiding an abrupt new panel.
    for cut,src,dst in [
      (8.56,(256,84),(22,43)),
      (20.72,(253,91),(249,55)),
      (36.64,(249,57),(22,85))]:
        p=(t-(cut-.47))/.94
        if 0<=p<=1:
            u=ease(p); xx=src[0]+(dst[0]-src[0])*u; yy=src[1]+(dst[1]-src[1])*u
            r=5+2.5*math.sin(math.pi*u)
            pill(dl,(xx,yy),r,fill=(95,148,164,int(200*math.sin(math.pi*u))),stroke=(255,255,255,35))
            for i in range(1,7):
                pu=ease(max(0,p-i*.042));tx=src[0]+(dst[0]-src[0])*pu;ty=src[1]+(dst[1]-src[1])*pu
                pill(dl,(tx,ty),1.3,fill=(109,157,167,int(90*math.sin(math.pi*u)*(1-i/7))))
    return np.asarray(q.resize((PANEL_W,PANEL_H),Image.Resampling.LANCZOS))

def mix(frame,img,x,y,weight=1.0,mask=None):
    h,w=img.shape[:2];x=int(x);y=int(y)
    ax=max(0,x);ay=max(0,y);bx=min(W,x+w);by=min(H,y+h)
    if bx<=ax or by<=ay:return
    sub=img[ay-y:by-y,ax-x:bx-x]; a=sub[:,:,3].astype(np.float32)/255.0*weight
    if mask is not None:a*=1.0-mask[ay:by,ax:bx]
    if a.max()<.002:return
    region=frame[ay:by,ax:bx]
    region[:]=np.clip(region.astype(np.float32)*(1-a[:,:,None])+sub[:,:,:3][:,:,::-1].astype(np.float32)*a[:,:,None],0,255).astype(np.uint8)

# conservative occlusion: reference matte based on stable background, not true semantic depth
reader=cv2.VideoCapture(SRC);assert reader.isOpened()
refs=[]
for f in [18,54,105,135,160,195,215]:
    reader.set(cv2.CAP_PROP_POS_FRAMES,f);ok,frame=reader.read()
    if ok:refs.append(frame)
assert len(refs)>=5
wall=np.median(np.stack(refs).astype(np.float32),axis=0).astype(np.uint8)
labWall=cv2.cvtColor(wall,cv2.COLOR_BGR2LAB).astype(np.float32)

def matte(fr):
    # protect subject in the upper-right; avoid masking overlay by background light changes
    x0,y0,x1,y1=585,19,907,188
    cur=fr[y0:y1,x0:x1]; l=cv2.cvtColor(cur,cv2.COLOR_BGR2LAB).astype(np.float32)
    diff=np.linalg.norm(l-labWall[y0:y1,x0:x1],axis=2)
    lum=cv2.cvtColor(cur,cv2.COLOR_BGR2GRAY)
    obs=np.uint8((diff>32)&(lum<160))*255
    obs=cv2.morphologyEx(obs,cv2.MORPH_OPEN,np.ones((3,3),np.uint8))
    obs=cv2.dilate(obs,np.ones((5,5),np.uint8))
    obs=cv2.GaussianBlur(obs,(0,0),2.5)
    res=np.zeros((H,W),np.float32);res[y0:y1,x0:x1]=obs/255.
    return res

preview='--preview' in sys.argv
checkframes=[30,75,145,255,315,438,540,660,820,1015,1150,1260,1350]
if not preview:
    writer=subprocess.Popen(['ffmpeg','-nostdin','-hide_banner','-loglevel','error','-y','-f','rawvideo','-pix_fmt','bgr24','-s','910x512','-r','30','-i','-','-c:v','libx264','-preset','veryfast','-crf','17','-pix_fmt','yuv420p','-movflags','+faststart',OUT],stdin=subprocess.PIPE,stderr=subprocess.PIPE)
else:writer=None
start=time.time();images=[]
reader.set(cv2.CAP_PROP_POS_FRAMES,0)
for f in range(N):
    ok,frame=reader.read()
    if not ok:raise RuntimeError('missing source frame '+str(f))
    t=f/FPS
    if .45<=t<=45.69:
        pic=ui(t)
        # low-amplitude parallax and perspective drift: no hard camera jump
        dx=2.5*math.sin(t*.44);dy=1.5*math.sin(t*.31)
        yaw=2.2*math.sin(t*.25)
        x=599+dx;y=23+dy
        tl=np.float32([[0,0],[PANEL_W,0],[PANEL_W,PANEL_H],[0,PANEL_H]])
        dest=np.float32([[x+3,y+1],[x+PANEL_W-3,y-1],[x+PANEL_W-1+yaw,y+PANEL_H-5],[x-2+yaw,y+PANEL_H-2]])
        xx=int(np.floor(dest[:,0].min()))-2;yy=int(np.floor(dest[:,1].min()))-2
        M=cv2.getPerspectiveTransform(tl,dest-np.array([xx,yy],np.float32))
        proj=cv2.warpPerspective(pic,M,(PANEL_W+15,PANEL_H+10),flags=cv2.INTER_LINEAR,borderMode=cv2.BORDER_CONSTANT)
        mix(frame,proj,xx,yy,.97,matte(frame))
    if f in byframe:
        gid,active=byframe[f];group=groups[gid]
        blendalpha=env(t,group['start'],group['end'],.11,.09)
        if blendalpha>.005:mix(frame,caption(gid,active),0,417,blendalpha)
    if f in checkframes:
        imagepath=f'{B}/EDITPLUS_SPATIAL_UI_V9_FRAME_{f:04d}.jpg';cv2.imwrite(imagepath,frame,[cv2.IMWRITE_JPEG_QUALITY,92]);images.append((f,imagepath))
    if writer:writer.stdin.write(frame.tobytes())
    if preview and f>max(checkframes):break
    if f in [299,749,1199]:print('render',f+1,'elapsed',round(time.time()-start,1),flush=True)
reader.release()
if writer:
    writer.stdin.close();ret=writer.wait()
    if ret:raise RuntimeError(writer.stderr.read().decode()[:5000])
if images:
    c=4;w0,h0=455,256; board=Image.new('RGB',(4*455,math.ceil(len(images)/4)*278),'#161b1f');draw=ImageDraw.Draw(board)
    for j,(f,filename) in enumerate(images):
        x=(j%4)*455;y=(j//4)*278
        frame=Image.open(filename).resize((455,256));board.paste(frame,(x,y+22));draw.text((x+8,y+3),f'{f/30:.1f} s',font=font(13),fill='#e9edef')
    board.save(f'{B}/EDITPLUS_SPATIAL_UI_V9_STORYBOARD.jpg',quality=92)
print('complete',round(time.time()-start,1),'s','preview',preview,'caption_words',len(words),flush=True)
