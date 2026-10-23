"""New-rush preview of restored graphic components, never a master replay.

Only selected pure drawing functions from the immutable reference sources run.
Historical file paths, titles, cuts, voice and reference-video pixels never run.
"""
import ast, json, math, sys, subprocess
from pathlib import Path
from functools import lru_cache
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageOps

ROOT=Path(__file__).resolve().parent/'originals'
def functions(file,names,scope):
    source=file.read_text(encoding='utf8')
    if names==['tile']:source=source[source.index('def tile('):source.index("assets={'clock'")]
    tree=ast.parse(source)
    selected=[n for n in tree.body if isinstance(n,ast.FunctionDef) and n.name in names]
    if {n.name for n in selected}!=set(names):raise RuntimeError('Original drawing functions changed')
    exec(compile(ast.Module(body=selected,type_ignores=[]),str(file),'exec'),scope)

def font(name):
    for p in [Path('/usr/share/fonts/opentype/inter')/name,Path('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'),Path('C:/Windows/Fonts/arial.ttf')]:
        if p.is_file():return str(p)
    raise RuntimeError('Inter or DejaVu Sans/Arial font required')

def main(config_path):
    c=json.loads(Path(config_path).read_text());W,H=c['width'],c['height'];fps=30
    scope=dict(Image=Image,ImageDraw=ImageDraw,ImageFont=ImageFont,ImageFilter=ImageFilter,np=np,math=math,lru_cache=lru_cache)
    model=c['model'];events=c['events']
    if model=='codie-omni-v60':
        scope.update(S=4,FONT=font('InterDisplay-SemiBold.otf'),COL_BG=(34,38,48,250),COL_OUT=(198,179,218,255),COL_W=(248,245,250,255))
        functions(ROOT/'codie-v60/build_v60.py',['tile'],scope)
        assets={kind:scope['tile'](kind) for kind in ['clock','euro']}
    elif model=='leila-hormozi-v53':
        scope.update(WALL_W=525,WALL_H=310,SERIF={n:ImageFont.truetype(font('Inter-Regular.otf'),n) for n in [72,73,76]},SMALL=ImageFont.truetype(font('Inter-Medium.otf'),16),ROW=ImageFont.truetype(font('Inter-Regular.otf'),25),COL_TITLE=(34,38,35),COL_SAGE=(65,126,101),COL_MUTED=(101,99,91))
        functions(ROOT/'leila-v53/render_leila_v46.py',['clip','ease','easeout','draw_scene'],scope)
    elif model=='apple-premium-spatial':
        # Keep the original title compositor; font lookup is the portability seam.
        scope.update(STAGES=[dict(num=str(i+1).zfill(2),title=e['text'],sub=e.get('sub','')) for i,e in enumerate(events)])
        scope['fnt']=lambda n,w='medium':ImageFont.truetype(font({'regular':'Inter-Regular.otf','medium':'Inter-Medium.otf','semi':'Inter-SemiBold.otf'}[w]),n)
        functions(ROOT/'spatial-v10/code/portable_editplus_spatial_ui_v10_focus.py',['title_image'],scope)
    elif model=='cinematic-storytelling-v7':
        scope.update(W=960,H=540,NAVY=(3,17,32),WHITE=(247,250,255),MUTED=(170,193,211),GOLD=(228,189,113),CYAN=(153,194,217))
        scope['font']=lambda n,w='b':ImageFont.truetype(font('Inter-SemiBold.otf'),n)
        functions(ROOT/'cinematic-v7/src/render_v6_historique.py',['textxy','ease','wave','ramp','fade_edge','make_bg','layer_from','mix_layer','under_rule'],scope)
        cinema_bg=scope['make_bg']()
        cinema_layers=[]
        for e in events:
            title=e['text'];size=65
            while scope['font'](size).getlength(title)>820 and size>18:size-=1
            cinema_layers.append(scope['layer_from'](lambda d,title=title,size=size:scope['textxy'](d,(480,260),title,size,scope['GOLD'],'mm','s')))
    else:raise RuntimeError('Restored component renderer unavailable')
    cmd=['ffmpeg','-hide_banner','-loglevel','error','-nostdin','-y','-f','rawvideo','-pix_fmt','rgba','-s',f'{W}x{H}','-r',str(fps),'-i','pipe:0','-an','-c:v','qtrle',c['output']]
    process=subprocess.Popen(cmd,stdin=subprocess.PIPE)
    try:
        for frame in range(math.ceil(c['durationMs']/1000*fps)):
            t=frame/fps;canvas=Image.new('RGBA',(W,H))
            for i,e in enumerate(events):
                a,b=e['startMs']/1000,e['endMs']/1000
                if not a<=t<b:continue
                x,y,w,h=e['rect'];x,y,w,h=round(x*W),round(y*H),max(1,round(w*W)),max(1,round(h*H))
                if model=='codie-omni-v60':
                    loc=t-a
                    smooth=lambda v:(lambda q:q*q*(3-2*q))(max(0,min(1,v)))
                    if loc<.15:scale=.35+.72*smooth(loc/.15)
                    elif loc<.29:scale=1.07+.095*math.sin((loc-.15)/.14*math.pi)
                    elif loc<.43:scale=1.07-.07*smooth((loc-.29)/.14)
                    else:scale=1
                    # Reserve space for the original overshoot inside the approved zone.
                    size=max(1,round(min(w,h)*scale/1.165));im=assets[e['kind']].resize((size,size),Image.Resampling.LANCZOS)
                    opacity=min(1,loc/.09,(b-t)/.25)
                    im.putalpha(im.getchannel('A').point(lambda p:round(p*opacity)))
                    x+=round((w-size)/2);y+=round((h-size)/2)
                elif model=='leila-hormozi-v53':
                    scene=dict(start=a,end=b,label=e['text'],kicker=str(i+1).zfill(2),sz=73,rows=[])
                    size=73
                    while size>16:
                        fitted=ImageFont.truetype(font('Inter-Regular.otf'),size)
                        if fitted.getlength(e['text'])<=483:break
                        size-=1
                    scope['SERIF'][73]=fitted
                    im=ImageOps.contain(Image.fromarray(scope['draw_scene'](t,scene)),(w,h),Image.Resampling.LANCZOS)
                    x+=(w-im.width)//2;y+=(h-im.height)//2
                elif model=='cinematic-storytelling-v7':
                    im=cinema_bg.copy()
                    scope['mix_layer'](im,cinema_layers[i],t-a,delay=.12,dur=.36,dy=24)
                    scope['mix_layer'](im,scope['under_rule'](340),t-a,delay=.34,dur=.4,dy=0)
                    im=ImageOps.fit(im,(W,H),Image.Resampling.LANCZOS)
                    opacity=scope['fade_edge'](t-a,b-a,fin=.22,fout=.28)
                    im.putalpha(im.getchannel('A').point(lambda p:round(p*opacity)))
                    x=y=0
                else:
                    im=ImageOps.contain(Image.fromarray(scope['title_image'](i)),(w,h),Image.Resampling.LANCZOS)
                    x+=(w-im.width)//2;y+=(h-im.height)//2
                    opacity=min(1,(t-a)/.26,(b-t)/.22)
                    im.putalpha(im.getchannel('A').point(lambda p:round(p*opacity)))
                canvas.alpha_composite(im,(x,y))
            process.stdin.write(canvas.tobytes())
        process.stdin.close()
        if process.wait(timeout=120)!=0:raise RuntimeError('Overlay encoding failed')
    except BaseException:
        process.kill();process.wait();raise
    print(json.dumps({'model':model,'events':len(events),'release':'restored_components_preview','font':'Inter if installed, system fallback otherwise'}))

if __name__=='__main__':main(sys.argv[1])
