"""Portable input seam for the original V60 animation. Historical main never runs."""
import ast,hashlib,math,json,sys,subprocess
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont,ImageFilter
SOURCE=Path(__file__).parent/'originals/codie-v60/build_v60.py'
EXPECTED='0127903c5b2a7674cf669730d0f1c73d466510572e034e2c4c3c80cf0b60a205'
def original_scope(font):
    raw=SOURCE.read_bytes()
    if hashlib.sha256(raw).hexdigest()!=EXPECTED:raise ValueError('Original V60 source changed')
    source=raw.decode();scope=dict(Image=Image,ImageDraw=ImageDraw,ImageFont=ImageFont,ImageFilter=ImageFilter,math=math,S=4,FONT=str(font),COL_BG=(34,38,48,250),COL_OUT=(198,179,218,255),COL_W=(248,245,250,255))
    code=source[source.index('def tile('):source.index("assets={'clock'")]
    exec(compile(code,str(SOURCE),'exec'),scope)
    scope['assets']={kind:scope['tile'](kind) for kind in ['clock','euro']}
    # Reuse the original complete rise/overshoot/ring/fade loop. Only its disk
    # save is removed: output is streamed losslessly instead of historical PNGs.
    code=source[source.index('def smoother('):source.index('# Assemble ALL frames')]
    tree=ast.parse(code)
    loop=next(n for n in tree.body if isinstance(n,ast.For))
    loop.body=[n for n in loop.body if not (isinstance(n,ast.Expr) and isinstance(n.value,ast.Call) and isinstance(n.value.func,ast.Attribute) and n.value.func.attr=='save')]
    scope['_frame_code']=compile(ast.fix_missing_locations(tree),str(SOURCE),'exec')
    return scope

def frame(scope,t,cues,width,height):
    scope.update(T0=t,N=1,fps=30,W=width,H=height,CUES=cues)
    exec(scope['_frame_code'],scope)
    return scope['canvas']

def main(config):
    c=json.loads(Path(config).read_text());scope=original_scope(c['font'])
    cmd=['ffmpeg','-v','error','-y','-f','rawvideo','-pix_fmt','rgba','-s',f"{c['width']}x{c['height']}",'-r','30','-i','pipe:0','-an','-c:v','qtrle',c['output']]
    p=subprocess.Popen(cmd,stdin=subprocess.PIPE)
    try:
        for i in range(math.ceil(c['durationMs']/1000*30)):
            p.stdin.write(frame(scope,i/30,c['cues'],c['width'],c['height']).tobytes())
        p.stdin.close()
        if p.wait()!=0:raise RuntimeError('Original Codie animation encoding failed')
    finally:
        if p.poll() is None:p.kill();p.wait()
if __name__=='__main__':main(sys.argv[1])
