import os, json, math, subprocess, bisect
import cv2, numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter
from pathlib import Path

ROOT=Path(__file__).resolve().parent.parent; WK=ROOT/'work'
WK.mkdir(parents=True,exist_ok=True)
(ROOT/'exports').mkdir(parents=True,exist_ok=True)
SRC=str(ROOT/'media'/'IMG_0506(2).mp4')
REF=str(ROOT/'media'/'IMG_0506_CINEMATIC_V6_APPLE_MINIMAL_IPHONE.mp4')
OUT=str(ROOT/'exports'/'IMG_0506_CINEMATIC_V7_PREMIUM_FINAL_IPHONE.mp4')
W,H,FPS=960,540,30
N=1165
SCENES=[(6.166667,8.066667),(19.15,22.4),(26.1,29.4),(33.15,38.43)]
# Polices installées sur l'ordinateur uniquement. Aucune police n'est redistribuée.
def resolve_font(name):
    candidates=[
      f'/usr/share/fonts/opentype/inter/{name}',
      f'/usr/share/fonts/truetype/inter/{name}',
      f'/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
      '/usr/share/fonts/truetype/liberation2/LiberationSans-Regular.ttf',
      'C:/Windows/Fonts/arial.ttf',
      '/System/Library/Fonts/Supplemental/Arial.ttf',
    ]
    for file in candidates:
        if Path(file).is_file():return file
    raise FileNotFoundError('Installez une police Inter ou DejaVu Sans sur le système.')
FONT=resolve_font('Inter-SemiBold.otf')
FONT_MED=resolve_font('Inter-Medium.otf')
WORD=json.load(open(ROOT/'config'/'IMG_0506_CINEMATIC_V6_TIMING.json',encoding='utf-8'))['words']

# Pour vérifier les fichiers sans relancer le rendu : python src/render_v7.py --check
if '--check' in __import__('sys').argv:
    assert Path(SRC).is_file(), f'Rush manquant : {SRC}'
    assert Path(REF).is_file(), f'V6 manquante : {REF}'
    assert len(WORD)>0, 'Timing des paroles manquant'
    cap=cv2.VideoCapture(SRC)
    ref=cv2.VideoCapture(REF)
    assert cap.isOpened() and ref.isOpened(), 'Impossible de lire les vidéos'
    assert ref.get(cv2.CAP_PROP_FRAME_COUNT)>=N, 'Vidéo V6 incomplète'
    assert ref.get(cv2.CAP_PROP_FPS)==FPS, 'FPS de référence inattendu'
    cap.release();ref.release()
    print('OK — rush, V6 et timing présents. Code prêt à exécuter.')
    raise SystemExit(0)

# Only camera words; slide copy remains uncluttered.
def in_cam(t):
    return all(not (a<=t<b) for a,b in SCENES)

def cam_offset(t):
    if t < 3.87: return 0.0
    if t < 6.16: return 1.533333
    if t < 12.067: return 2.633333
    if t < 13.28: return 3.7
    if t < 35.88: return 4.666667
    return 5.033333

# Word-synchronized caption groups, no invented transcript.
segments=[];cur=[];ch=0
for w in WORD:
    s=float(w['start']);e=float(w['end']);txt=w['word'].strip()
    if not txt or not in_cam((s+e)/2):
        if cur:segments.append(cur);cur=[];ch=0
        continue
    prev=cur[-1] if cur else None
    boundary=prev and (not in_cam((float(prev['end'])+s)/2) or s-float(prev['end'])>.28)
    duration=e-float(cur[0]['start']) if cur else 0
    if cur and (boundary or ch+len(txt)+1>37 or duration>1.58 or (prev['word'].endswith(('.', '?', '!')) and len(cur)>2)):
        segments.append(cur);cur=[];ch=0
    cur.append(w); ch+=len(txt)+1
if cur:segments.append(cur)

# Render captions per word as narrow overlays, reused across frames.
font=ImageFont.truetype(FONT,24)
normal=(251,249,243,255);gold=(235,198,111,255)
caption_cache={}
for j,grp in enumerate(segments):
    words=[z['word'] for z in grp]
    for active in range(len(grp)):
        im=Image.new('RGBA',(W,78),(0,0,0,0));d=ImageDraw.Draw(im)
        txt=' '.join(words); widths=[d.textlength(z,font=font) for z in words]
        space=d.textlength(' ',font=font)
        tw=sum(widths)+(len(words)-1)*space
        x=(W-tw)/2
        baseline_y=27
        for i,word in enumerate(words):
            # No background or frame: soft shadow + 1 px dark stroke protects contrast over white clothes.
            d.text((x,baseline_y+1),word,font=font,fill=(0,0,0,140),stroke_width=2,stroke_fill=(6,12,18,115))
            d.text((x,baseline_y),word,font=font,fill=gold if i==active else normal,stroke_width=1,stroke_fill=(18,25,30,220))
            x+=widths[i]+space
        caption_cache[j,active]=np.asarray(im,dtype=np.uint8)
starts=[float(z[0]['start']) for z in segments]

def caption_for(t):
    i=bisect.bisect_right(starts,t)-1
    if i<0:return None,0
    grp=segments[i]
    if t>float(grp[-1]['end'])+.08:return None,0
    z=next((j for j,q in enumerate(grp) if t<float(q['end'])),len(grp)-1)
    fade=min(1.0,max(0.,(t-float(grp[0]['start']))/.12),max(0.,(float(grp[-1]['end'])+.09-t)/.14))
    for a,b in SCENES:
        if a>t and a-t<.21: fade*=max(0.,(a-t)/.21)
        if t>b and t-b<.24: fade*=max(0.,(t-b)/.24)
    return caption_cache.get((i,z)),fade

# Reinforce only small secondary text of the three final panels; keep their labels and motion intact.
card_font=ImageFont.truetype(FONT_MED,16)
card_titles=[('Faire gagner du temps',(60,316),34.5),('Faire gagner de l’argent',(352,607),36.1),('Résoudre un problème',(645,900),37.1)]
CARD_PATCH=[]
for name,(x0,x1),t0 in card_titles:
    pw=x1-x0
    patch=Image.new('RGBA',(pw,36),(0,0,0,0));d=ImageDraw.Draw(patch)
    # Fill area with matching card navy, without covering the card outline.
    d.rectangle((8,2,pw-8,32),fill=(12,43,61,255))
    box=d.textbbox((0,0),name,font=card_font);tx=(pw-(box[2]-box[0]))/2
    d.text((tx,6),name,font=card_font,fill=(215,229,237,255))
    CARD_PATCH.append((x0,387,patch,np.asarray(patch,dtype=np.uint8),t0))

raw=cv2.VideoCapture(SRC);ref=cv2.VideoCapture(REF)
if not raw.isOpened() or not ref.isOpened():raise Exception('source missing')
cur_raw_idx=-1;raw_frame=None
# Temporary raw video. Audio is copied unchanged from the approved V6.
tmp=str(WK/'V7_VIDEO_H264_ONLY.mp4')
cmd=['ffmpeg','-nostdin','-y','-hide_banner','-loglevel','error','-f','rawvideo','-pix_fmt','bgr24','-s',f'{W}x{H}','-r',str(FPS),'-i','-','-an','-c:v','libx264','-preset','fast','-crf','17','-pix_fmt','yuv420p','-profile:v','high','-level','3.1','-movflags','+faststart',tmp]
p=subprocess.Popen(cmd,stdin=subprocess.PIPE)

def get_raw(t):
    global cur_raw_idx,raw_frame
    ix=round((t+cam_offset(t))*FPS)
    ix=max(0,min(ix,1334))
    if ix<cur_raw_idx:
        raw.set(cv2.CAP_PROP_POS_FRAMES,ix);cur_raw_idx=ix-1
    while cur_raw_idx<ix:
        ret,fr=raw.read()
        if not ret: return raw_frame
        cur_raw_idx+=1;raw_frame=fr
    if raw_frame is None:return np.zeros((H,W,3),dtype=np.uint8)
    if raw_frame.shape[1]!=W or raw_frame.shape[0]!=H:
        return cv2.resize(raw_frame,(W,H),interpolation=cv2.INTER_CUBIC)
    return raw_frame

# alpha blend an RGBA caption ROI at y=420.
def add_caption(base,im,weight):
    if im is None or weight<=0:return
    y0=420;bh=im.shape[0]
    al=(im[:,:,3].astype(np.float32)/255.*weight)[:,:,None]
    rgb=im[:,:,:3][:,:,::-1].astype(np.float32)
    area=base[y0:y0+bh,:]
    np.multiply(area.astype(np.float32),1-al,out=rgb) if False else None
    base[y0:y0+bh,:]=np.clip(area.astype(np.float32)*(1-al)+rgb*al,0,255).astype(np.uint8)

def apply_cards(fr,t):
    if t<33.15: return
    for x0,y0,_,patch,appear in CARD_PATCH:
        if t<appear: continue
        k=min(1.,(t-appear)/.24)
        if t>38.22:
            k*=max(0.,min(1.,(38.44-t)/.22))
        ht,wd=patch.shape[:2]
        a=(patch[:,:,3:4].astype(np.float32)/255)*k
        area=fr[y0:y0+ht,x0:x0+wd]
        fr[y0:y0+ht,x0:x0+wd]=np.clip(area.astype(np.float32)*(1-a)+patch[:,:,:3][:,:,::-1]*a,0,255).astype(np.uint8)

# Cue fades: all scene changes use one 0.22s smoothstep motion profile.
def smooth(v):
    v=np.clip(v,0,1);return v*v*(3-2*v)

saved={0.96,5.6,7.2,20.65,27.2,30.6,34.75,37.8}
for i in range(N):
    ok,sframe=ref.read()
    if not ok: raise Exception(f'V6 read stopped at {i}')
    t=i/FPS
    # camera source with exact edit-map; keep master full-screen graphics from V6
    is_scene=any(a<=t<b for a,b in SCENES)
    if is_scene:
        # Preserve the already approved fade built into V6: mixing twice caused ghost faces.
        frame=sframe
        # Strengthen secondary card titles only on the fully-visible final slide.
        if 33.55<t<38.43: apply_cards(frame,t)
    else:
        # During a fade OUT of a full-screen scene, the native V6 dissolve is retained.
        native_out=any(b<=t<b+.23 for a,b in SCENES)
        if native_out:
            frame=sframe
        else:
            frame=get_raw(t).copy()
            cap,k=caption_for(t)
            if cap is not None:add_caption(frame,cap,k)
        # Gentle end fade avoids an abrupt visual cut at the final sample.
        if t>=38.73:
            frame=np.clip(frame.astype(np.float32)*max(0.,(38.8333-t)/.1033),0,255).astype(np.uint8)
    try:
        p.stdin.write(frame.tobytes())
    except BrokenPipeError:
        raise Exception('Encoder closed unexpectedly')
    if i in [29,168,216,619,816,917,1042,1134]:
        cv2.imwrite(str(WK/f'V7_frame_{i}.jpg'),frame)
    if i%300==0: print('frame',i,'/',N,flush=True)
p.stdin.close();rc=p.wait()
raw.release();ref.release()
if rc!=0: raise Exception('encode failed '+str(rc))
subprocess.run(['ffmpeg','-nostdin','-y','-hide_banner','-loglevel','error','-i',tmp,'-i',REF,'-map','0:v:0','-map','1:a:0','-c:v','copy','-c:a','copy','-movflags','+faststart','-shortest',OUT],check=True)
print('OUTPUT',OUT,Path(OUT).stat().st_size,'segments',len(segments),flush=True)
json.dump({'version':'V7','source':'IMG_0506(2).mp4','video_ref':'V6','audio':'V6 AAC untouched','caption_alignment':'approximate based on existing V6 word timing','fullScreenSceneBounds':SCENES,'caption_groups':len(segments),'layout':'24px Inter SemiBold, no boxes; 16px card sublabels; uniform 0.22s transition'},open(WK/'V7_audit.json','w'),ensure_ascii=False,indent=2)
