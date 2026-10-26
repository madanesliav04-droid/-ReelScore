"""Reconstruction from the approved V16 picture, NOT recovered original code.

Only the three fullscreen infographic compositions. No ASR, editorial decisions,
stock footage, source images, or fallback to the historical ASS renderer.
Coordinates are measured in the 910x512 reference space.
"""
from functools import lru_cache
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).parent
BG = (244, 245, 250)
INK = (31, 41, 55)
MUTED = (117, 128, 142)
ACCENT = (124, 138, 202)
BORDER = (209, 215, 225)
PALE = (232, 240, 247)
WHITE = (251, 253, 253)


def ease(t):
    t = max(0., min(1., t))
    return t * t * (3 - 2 * t)


@lru_cache(maxsize=32)
def font(size, display=False):
    path = ROOT / 'fonts' / ('SocialPlusAlexDisplay-SemiBold.ttf' if display else 'SocialPlusSans-SemiBold.ttf')
    if not path.is_file():
        raise FileNotFoundError(f'Required licensed font absent: {path.name}')
    return ImageFont.truetype(str(path), size)


def text(im, value, x, top, size, color=INK, *, display=False, center=True, max_width=None):
    """Position visible ink, rather than font-dependent baseline offsets."""
    f = font(size, display)
    box = f.getbbox(value)
    if max_width is not None and box[2]-box[0]>max_width:
        raise ValueError('Infographic text exceeds its measured safe area; shorten explicit wording')
    left = x - (box[2] - box[0]) / 2 if center else x
    ImageDraw.Draw(im).text((round(left - box[0]), round(top - box[1])), value, font=f, fill=color)


@lru_cache(maxsize=24)
def background(chapter, title):
    im = Image.new('RGB', (910, 512), BG)
    d = ImageDraw.Draw(im)
    d.ellipse((674, -200, 1094, 208), outline=(237, 242, 248), width=14)
    d.ellipse((-190, 350, 166, 710), outline=(237, 242, 248), width=14)
    text(im, chapter, 53, 31, 16, MUTED, center=False, max_width=802)
    text(im, title, 455, 53 if any(c in title for c in 'ÉÈÀÊÎ') else 61, 36, display=True, max_width=802)
    d.line((54, 108, 855, 108), fill=(192, 201, 213), width=1)
    return im


def circle(im, cx, cy, radius, symbol, active):
    # Subpixel stroke measurement: the master uses a soft ~2.5 px circle.
    pad = radius+3
    layer = Image.new('RGBA', (pad*4,pad*4))
    d = ImageDraw.Draw(layer)
    d.ellipse((6,6,(2*radius+3)*2,(2*radius+3)*2), fill=(*PALE,255) if active else (*WHITE,255),
              outline=(*ACCENT,255) if active else (*BORDER,255), width=5)
    layer=layer.resize((pad*2,pad*2),Image.Resampling.LANCZOS)
    im.paste(layer,(cx-pad,cy-pad),layer)
    box = font(32).getbbox(symbol)
    text(im, symbol, cx, cy-(box[3]-box[1])/2, 32, ACCENT if active else INK)


def connector(im, x0, x1, y, progress, width=4, dot_radius=5):
    if progress <= 0:
        return
    d = ImageDraw.Draw(im)
    x = x0 + (x1-x0)*progress
    d.line((x0, y, x, y), fill=ACCENT, width=width)
    d.ellipse((x-dot_radius, y-dot_radius, x+dot_radius, y+dot_radius), fill=ACCENT)


def pill(im, box, value, progress, size=24, travel=16):
    if progress <= 0:
        return
    # Measured upward settling of the callout; no invented spring/bounce.
    layer = Image.new('RGBA', im.size)
    d = ImageDraw.Draw(layer)
    x0, y0, x1, y1 = box
    offset = round(travel * (1-progress))
    d.rounded_rectangle((x0, y0+offset, x1, y1+offset), radius=15, fill=(*PALE, 255),
                        outline=(*ACCENT, 255), width=2)
    f = font(size, True)
    bounds = f.getbbox(value)
    text(layer, value, (x0+x1)/2, y0+offset+(y1-y0-(bounds[3]-bounds[1]))/2-1, size, ACCENT, display=True, max_width=x1-x0-24)
    im.paste(layer, (0, 0), layer)


def block(im, box, value, active):
    d = ImageDraw.Draw(im)
    d.rounded_rectangle(box, radius=16, fill=PALE if active else WHITE,
                        outline=ACCENT if active else BORDER, width=2 if active else 1)
    x0, y0, x1, y1 = box
    if font(28,True).getlength(value)>x1-x0-24:
        wrapped(im,value,(x0+x1)/2,y0+10,24,x1-x0-24,ACCENT if active else INK,min_size=22)
    else:
        text(im, value, (x0+x1)/2, y0+(21 if any(c in value for c in 'ÉÈÀÊÎ') else 27), 28, ACCENT if active else INK, display=True, max_width=x1-x0-24)


def draw_scene(scene, elapsed):
    """Elapsed seconds on the OUTPUT timeline, relative to this scene's start.

    All wording and cue offsets come from the caller's explicit scene plan.
    No master video is read by this function.
    """
    kind = scene['kind']
    v = scene['text']
    cues = scene['cues']
    im = background(v['chapter'], v['title']).copy()
    if kind in ('question', 'value'):
        first = kind == 'question'
        cx1, cx2, cy, r = (240, 674, 245, 65) if first else (229, 679, 235, 64)
        active_right = elapsed >= cues['rightHighlight']
        circle(im, cx1, cy, r, v['symbols'][0], not active_right if first else True)
        circle(im, cx2, cy, r, v['symbols'][1], active_right)
        connector(im, 323 if first else 310, 590 if first else 598, cy+1,
                  ease((elapsed-cues['arrowStart'])/cues['arrowDuration']))
        label_y = 332 if first else 317
        text(im, v['labels'][0], cx1, label_y, 20 if first else 22, MUTED if first else INK, display=not first, max_width=400)
        text(im, v['labels'][1], cx2, label_y, 20 if first else 22, ACCENT if first else INK, display=not first, max_width=400)
        pill(im, (263, 358, 647, 412) if first else (174, 358, 736, 412), v['conclusion'],
             ease((elapsed-cues['calloutStart'])/cues['calloutDuration']), 28 if first else 23)
    elif kind == 'chain':
        for i, (box, label) in enumerate(zip([(36,198,277,273),(334,198,576,273),(633,198,874,273)], v['labels'])):
            if elapsed >= cues['nodeStarts'][i]:
                active = i == max(j for j, t in enumerate(cues['nodeStarts']) if elapsed >= t)
                block(im, box, label, active)
        for i, (x0,x1) in enumerate([(290,320),(589,619)]):
            connector(im,x0,x1,236,ease((elapsed-cues['arrowStarts'][i])/cues['arrowDuration']))
        pill(im, (117,343,793,404),v['conclusion'],ease((elapsed-cues['calloutStart'])/cues['calloutDuration']),22,travel=0)
    else:
        raise ValueError('Unknown Alex V16 infographic; generic substitution forbidden')
    return im


def native_scene(scene, elapsed, width, height):
    """Uniform scaling, no crop or orientation change. Portrait fidelity unvalidated."""
    if height>width:
        return portrait_scene(scene,elapsed,width,height)
    im = draw_scene(scene, elapsed)
    if (width, height) == (910, 512):
        return im
    scale = min(width/910, height/512)
    size = (max(1, round(910*scale)), max(1, round(512*scale)))
    canvas = Image.new('RGB', (width, height), BG)
    canvas.paste(im.resize(size, Image.Resampling.LANCZOS), ((width-size[0])//2, (height-size[1])//2))
    return canvas


def wrapped(im,value,x,top,size,max_width,color=INK,max_lines=2,min_size=16):
    f=font(size,True);d=ImageDraw.Draw(im);lines=[];line=''
    for word in value.split():
        candidate=(line+' '+word).strip()
        if d.textlength(candidate,font=f)>max_width:
            if not line:
                if size>min_size:return wrapped(im,value,x,top,size-1,max_width,color,max_lines,min_size)
                raise ValueError('Infographic word exceeds its safe area')
            lines.append(line);line=word
        else:line=candidate
    if line:lines.append(line)
    if len(lines)>max_lines:
        if size>min_size:return wrapped(im,value,x,top,size-1,max_width,color,max_lines,min_size)
        raise ValueError('Infographic text exceeds two readable lines')
    for i,line in enumerate(lines):text(im,line,x,top+i*(size+5),size,color,display=True,max_width=max_width)


def portrait_scene(scene,elapsed,width,height):
    """Responsive version of the same three compositions, no letterboxing.
    At native width 512: title 28px, labels 18-20px, separate 24px captions.
    The original landscape drawing remains unchanged.
    """
    w,h=512,round(height*512/width)
    im=Image.new('RGB',(w,h),BG);d=ImageDraw.Draw(im);v=scene['text'];c=scene['cues']
    d.ellipse((380,-90,700,230),outline=(237,242,248),width=10)
    text(im,v['chapter'],28,42,15,MUTED,center=False,max_width=456)
    wrapped(im,v['title'],256,94,28,456,min_size=24)
    d.line((28,165,484,165),fill=(192,201,213),width=1)
    cy=min(round(h*.43),420)
    if scene['kind'] in ('question','value'):
        active=elapsed>=c['rightHighlight'];is_q=scene['kind']=='question'
        for x,symbol,a in [(134,v['symbols'][0],not active if is_q else True),(378,v['symbols'][1],active)]:circle(im,x,cy,54,symbol,a)
        connector(im,200,312,cy,ease((elapsed-c['arrowStart'])/c['arrowDuration']),3)
        wrapped(im,v['labels'][0],134,cy+78,20,210,MUTED if is_q else INK)
        wrapped(im,v['labels'][1],378,cy+78,20,210,ACCENT if is_q else INK)
        pill(im,(32,cy+176,480,cy+236),v['conclusion'],ease((elapsed-c['calloutStart'])/c['calloutDuration']),20)
    else:
        for i,(x,label) in enumerate(zip([98,256,414],v['labels'])):
            if elapsed<c['nodeStarts'][i]:continue
            active=i==max(j for j,t in enumerate(c['nodeStarts']) if elapsed>=t)
            d.rounded_rectangle((x-65,cy-34,x+65,cy+34),radius=12,fill=PALE if active else WHITE,outline=ACCENT if active else BORDER,width=2)
            wrapped(im,label,x,cy-15,18,114,ACCENT if active else INK)
        for i,(a,b) in enumerate([(169,184),(327,342)]):connector(im,a,b,cy,ease((elapsed-c['arrowStarts'][i])/c['arrowDuration']),3,dot_radius=3)
        pill(im,(32,cy+176,480,cy+236),v['conclusion'],ease((elapsed-c['calloutStart'])/c['calloutDuration']),20,travel=0)
    return im if (width,height)==(w,h) else im.resize((width,height),Image.Resampling.LANCZOS)
