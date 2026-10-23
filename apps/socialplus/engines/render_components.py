"""New-rush preview of restored graphic components, never a master replay.

Only selected pure drawing functions from the immutable reference sources run.
Historical file paths, titles, cuts, voice and reference-video pixels never run.
"""
import ast, json, math, sys, subprocess
from pathlib import Path
from functools import lru_cache
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageOps
from reference_scenes import Bindings,cinematic_layers,spatial_scene,label

ROOT=Path(__file__).resolve().parent/'originals'
def functions(file,names,scope,transform=None):
    source=file.read_text(encoding='utf8')
    if names==['tile']:source=source[source.index('def tile('):source.index("assets={'clock'")]
    tree=ast.parse(source)
    selected=[n for n in tree.body if isinstance(n,ast.FunctionDef) and n.name in names]
    if {n.name for n in selected}!=set(names):raise RuntimeError('Original drawing functions changed')
    tree=ast.Module(body=selected,type_ignores=[])
    if transform:tree=transform.visit(tree)
    exec(compile(ast.fix_missing_locations(tree),str(file),'exec'),scope)

FONT_ROOT=Path(__file__).resolve().parent/'fonts'
FONT_MANIFEST=json.loads((FONT_ROOT/'manifest.json').read_text())
def font(name):
    file=FONT_ROOT/FONT_MANIFEST['aliases'][name]
    if not file.is_file():raise RuntimeError('Bundled licensed font absent: '+file.name)
    return str(file)

def main(config_path):
    c=json.loads(Path(config_path).read_text());W,H=c['width'],c['height'];fps=30
    scope=dict(Image=Image,ImageDraw=ImageDraw,ImageFont=ImageFont,ImageFilter=ImageFilter,np=np,math=math,lru_cache=lru_cache)
    model=c['model'];events=c['events']
    if model=='codie-omni-v60':
        scope.update(S=4,FONT=font('InterDisplay-SemiBold.otf'),COL_BG=(34,38,48,250),COL_OUT=(198,179,218,255),COL_W=(248,245,250,255))
        functions(ROOT/'codie-v60/build_v60.py',['tile'],scope)
        assets={kind:scope['tile'](kind) for kind in ['clock','euro']}
    elif model=='leila-hormozi-v53':
        scope.update(WALL_W=365,WALL_H=310,SERIF={n:ImageFont.truetype(font('EBGaramond08-Regular.ttf'),n) for n in [72,73,76]},SMALL=ImageFont.truetype(font('Lato-Medium.ttf'),16),ROW=ImageFont.truetype(font('Lato-Regular.ttf'),25),COL_TITLE=(34,38,35),COL_SAGE=(65,126,101),COL_MUTED=(101,99,91))
        functions(ROOT/'leila-v53/render_leila_v46.py',['clip','ease','easeout','draw_scene'],scope)
    elif model=='apple-premium-spatial':
        # Keep the original title compositor; font lookup is the portability seam.
        scope.update(STAGES=[dict(num=str(i+1).zfill(2),title=e['text'],sub=e.get('sub','')) for i,e in enumerate(events)])
        scope['fnt']=lambda n,w='medium':ImageFont.truetype(font({'regular':'Inter-Regular.otf','medium':'Inter-Medium.otf','semi':'Inter-SemiBold.otf'}[w]),n)
        functions(ROOT/'spatial-v10/code/portable_editplus_spatial_ui_v10_focus.py',['title_image'],scope,Bindings({'  /  03':f'  /  {len(events):02}'}))
        spatial=[]
        for i,e in enumerate(events):
            local=dict(scope,S2=2)
            local['font']=lambda n,w='medium':ImageFont.truetype(font({'regular':'Inter-Regular.otf','medium':'Inter-Medium.otf','semi':'Inter-SemiBold.otf'}[w]),n)
            spatial.append(spatial_scene(e,i,len(events),local,functions,ROOT))
    elif model=='alex-hormozi-v16':
        palette=c['palette']
    elif model=='cinematic-storytelling-v7':
        scope.update(W=960,H=540,NAVY=(3,17,32),WHITE=(247,250,255),MUTED=(170,193,211),GOLD=(228,189,113),CYAN=(153,194,217))
        scope['font']=lambda n,w='b':ImageFont.truetype(font({'b':'Inter-Bold.otf','s':'Inter-SemiBold.otf','e':'Inter-ExtraBold.otf','m':'Inter-Medium.otf','r':'Inter-Regular.otf'}[w]),n)
        functions(ROOT/'cinematic-v7/src/render_v6_historique.py',['textxy','ease','wave','ramp','fade_edge','make_bg','layer_from','mix_layer','under_rule'],scope)
        cinema_bg=scope['make_bg']()
        cinema_layers=[cinematic_layers(e,i,len(events),scope,functions,ROOT) for i,e in enumerate(events)]

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
                    scene=dict(start=a,end=b,label=label(e['text']),kicker=f'{i+1:02} / {len(events):02}',sz=73,rows=[(label(d['text']),d['startMs']/1000) for d in e.get('details',[])])
                    size=73
                    while size>16:
                        fitted=ImageFont.truetype(font('EBGaramond08-Regular.ttf'),size)
                        if fitted.getlength(e['text'])<=323:break
                        size-=1
                    scope['SERIF'][73]=fitted
                    rowfont=ImageFont.truetype(font('Lato-Regular.ttf'),25)
                    longest=max([1]+[rowfont.getlength(label(d['text'])) for d in e.get('details',[])])
                    scope['ROW']=ImageFont.truetype(font('Lato-Regular.ttf'),max(14,min(25,round(25*302/longest))))
                    im=ImageOps.contain(Image.fromarray(scope['draw_scene'](t,scene)),(w,h),Image.Resampling.LANCZOS)
                    x+=(w-im.width)//2;y+=(h-im.height)//2
                elif model=='alex-hormozi-v16':
                    im=Image.new('RGBA',(W,H),palette['surface']);d=ImageDraw.Draw(im)
                    factor=min(W/910,H/512)
                    titlefont=ImageFont.truetype(font('Inter-SemiBold.otf'),max(18,round(29*factor)))
                    labelfont=ImageFont.truetype(font('Inter-Medium.otf'),max(16,round(21*factor)))
                    nodefont=ImageFont.truetype(font('Inter-SemiBold.otf'),max(16,round(22*factor)))
                    loc=t-a;wave=lambda q:(lambda v:v*v*(3-2*v))(max(0,min(1,q)))
                    header=e['text'].upper();title_size=titlefont.size
                    while titlefont.getlength(header)>W*.84 and title_size>16:title_size-=1;titlefont=ImageFont.truetype(font('Inter-SemiBold.otf'),title_size)
                    d.arc((W*.73,-H*.24,W*1.1,H*.45),0,360,fill='#F0F3F9',width=max(1,round(12*factor)))
                    d.text((W*.07,H*.055),f'{i+1:02} / {len(events):02}',font=ImageFont.truetype(font('Inter-Medium.otf'),max(10,round(12*factor))),fill=palette['accent'])
                    d.text((W*.5,H*.16),header,font=titlefont,fill=palette['text'],anchor='mm')
                    d.line((W*.07,H*.25,W*.93,H*.25),fill=palette['border'],width=max(1,round(factor)))
                    radius=round(min(W*.075,H*.14));cy=round(H*.47)
                    groups=[{'text':e['text'],'startMs':e['startMs']}]+(e.get('details') or ([e['secondary']] if e.get('secondary') else []))
                    groups=groups[:3];chain=len(groups)>2
                    positions={1:[.5],2:[.28,.72],3:[.2,.5,.8]}[len(groups)]
                    def node(cx,group,accent):
                        text=label(group['text'])
                        if chain:
                            bw=W*.24;bh=H*.12
                            d.rounded_rectangle((cx-bw/2,cy-bh/2,cx+bw/2,cy+bh/2),radius=max(4,round(12*factor)),fill=palette['surface'],outline=accent,width=max(1,round(factor)))
                            nf=nodefont
                            if nf.getlength(text.upper())>bw*.9:nf=ImageFont.truetype(font('Inter-SemiBold.otf'),max(12,round(nf.size*bw*.9/nf.getlength(text.upper()))))
                            d.text((cx,cy),text.upper(),font=nf,fill=accent,anchor='mm')
                        else:
                            d.ellipse((cx-radius,cy-radius,cx+radius,cy+radius),fill=palette['surface'],outline=accent,width=max(1,round(2*factor)))
                            key=text.split()[-1].upper();nf=nodefont
                            if nf.getlength(key)>radius*1.7:nf=ImageFont.truetype(font('Inter-SemiBold.otf'),max(12,round(nf.size*radius*1.7/nf.getlength(key))))
                            d.text((cx,cy),key,font=nf,fill=accent,anchor='mm')
                            lf=labelfont
                            if lf.getlength(text)>W*.4:lf=ImageFont.truetype(font('Inter-Medium.otf'),max(12,round(lf.size*W*.4/lf.getlength(text))))
                            d.text((cx,H*.68),text,font=lf,fill=accent,anchor='mm')
                    for j,g in enumerate(groups):
                        if t<g['startMs']/1000:continue
                        cx=round(W*positions[j]);accent=palette['text'] if j==0 else palette['accent']
                        if j:
                            previous=W*positions[j-1];gap=W*.13 if chain else radius+W*.025
                            gain=wave((t-g['startMs']/1000)/.3);x0=previous+gap;x1=x0+(cx-gap-x0)*gain
                            d.line((x0,cy,x1,cy),fill=palette['accent'],width=max(1,round(2*factor)))
                            if gain>.9:d.polygon([(x1,cy),(x1-7*factor,cy-4*factor),(x1-7*factor,cy+4*factor)],fill=palette['accent'])
                        node(cx,g,accent)
                    if len(groups)>1 and t>=groups[-1]['startMs']/1000+.24:
                        footer=' → '.join(label(g['text']) for g in groups);ff=ImageFont.truetype(font('Inter-Medium.otf'),max(12,round(16*factor)))
                        if ff.getlength(footer)>W*.76:ff=ImageFont.truetype(font('Inter-Medium.otf'),max(10,round(ff.size*W*.76/ff.getlength(footer))))
                        d.rounded_rectangle((W*.1,H*.74,W*.9,H*.82),radius=max(3,round(9*factor)),outline=palette['accent'],width=max(1,round(factor)))
                        d.text((W*.5,H*.78),footer,font=ff,fill=palette['accent'],anchor='mm')
                    opacity=min(1,loc/.22,(b-t)/.22)
                    im.putalpha(im.getchannel('A').point(lambda p:round(p*opacity)))
                    x=y=0
                elif model=='cinematic-storytelling-v7':
                    im=ImageOps.fit(cinema_bg,(W,H),Image.Resampling.LANCZOS)
                    content=Image.new('RGBA',(960,540))
                    for layer,delay,duration,dy in cinema_layers[i]:scope['mix_layer'](content,layer,t-a,delay=delay,dur=duration,dy=dy)
                    d=ImageDraw.Draw(content)
                    d.line((52,505,908,505),fill=(185,204,215,38),width=1)
                    d.line((52,505,52+round(856*min(1,(t-a)/(b-a))),505),fill=scope['GOLD'],width=2)
                    content=ImageOps.contain(content,(round(W*.9),round(H*.8)),Image.Resampling.LANCZOS)
                    im.alpha_composite(content,((W-content.width)//2,(H-content.height)//2))
                    opacity=scope['fade_edge'](t-a,b-a,fin=.22,fout=.22)
                    im.putalpha(im.getchannel('A').point(lambda p:round(p*opacity)))
                    x=y=0
                else:
                    local,kind=spatial[i]
                    panel=Image.new('RGBA',(580,306));draw=ImageDraw.Draw(panel)
                    local[kind](draw,t)
                    if e.get('kind')=='focus':
                        ar=e['anchorRect'];ax,ay,aw,ah=round(ar[0]*W),round(ar[1]*H),round(ar[2]*W),round(ar[3]*H)
                        small=ImageOps.contain(panel,(aw,ah),Image.Resampling.LANCZOS)
                        smooth=lambda v:(lambda p:p*p*(3-2*p))(max(0,min(1,v)))
                        strength=min(smooth((t-a)/.58),smooth((b-t)/.55))
                        small=small.filter(ImageFilter.GaussianBlur(7*strength))
                        small.putalpha(small.getchannel('A').point(lambda p:round(p*(1-.62*strength))))
                        im=Image.new('RGBA',(W,H));im.alpha_composite(small,(ax,ay))
                        u=min(1-(1-max(0,min(1,(t-a)/.70)))**3,smooth((b-t)/.64))
                        factor=min(W/910,H/512);scale=.36+.64*u
                        title=Image.fromarray(scope['title_image'](i));title=title.resize((max(1,round(title.width*scale*factor)),max(1,round(title.height*scale*factor))),Image.Resampling.LANCZOS)
                        opacity=min(1,strength**1.85*1.18);title.putalpha(title.getchannel('A').point(lambda p:round(p*opacity)))
                        cx=ax+aw/2+(W/2-ax-aw/2)*u;cy=ay+ah/2+(H/2-29*factor-ay-ah/2)*u-7*factor*math.sin(math.pi*u)
                        im.alpha_composite(title,(round(cx-title.width/2),round(cy-title.height/2)));x=y=0
                    else:
                        im=ImageOps.contain(panel,(w,h),Image.Resampling.LANCZOS)
                        x+=(w-im.width)//2
                        opacity=min(1,(t-a)/.26,(b-t)/.22)
                        im.putalpha(im.getchannel('A').point(lambda p:round(p*opacity)))
                canvas.alpha_composite(im,(x,y))
            process.stdin.write(canvas.tobytes())
        process.stdin.close()
        if process.wait(timeout=120)!=0:raise RuntimeError('Overlay encoding failed')
    except BaseException:
        process.kill();process.wait();raise
    print(json.dumps({'model':model,'events':len(events),'release':'restored_components_preview','font':'bundled_SIL_OFL_Latin_alternatives'}))

if __name__=='__main__':main(sys.argv[1])
