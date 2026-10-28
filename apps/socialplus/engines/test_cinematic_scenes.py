import unittest,math,ast
from functools import lru_cache
from unittest.mock import patch
from pathlib import Path
import numpy as np
from PIL import Image,ImageDraw,ImageFont
from render_components import functions,ROOT,font
from cinematic_scenes import autonomous_layers
class CinematicScenes(unittest.TestCase):
 def test_four_original_grammars_render_new_copy_without_any_historical_media(self):
  scope=dict(Image=Image,ImageDraw=ImageDraw,ImageFont=ImageFont,np=np,math=math,lru_cache=lru_cache,W=960,H=540,NAVY=(3,17,32),WHITE=(247,250,255),MUTED=(170,193,211),GOLD=(228,189,113),CYAN=(153,194,217))
  scope['font']=lambda n,w='b':ImageFont.truetype(font({'b':'Inter-Bold.otf','s':'Inter-SemiBold.otf','e':'Inter-ExtraBold.otf','m':'Inter-Medium.otf','r':'Inter-Regular.otf'}[w]),n)
  functions(ROOT/'cinematic-v7/src/render_v6_historique.py',['textxy','ease','wave','ramp','fade_edge','make_bg','layer_from','mix_layer','under_rule'],scope)
  open_original=Path.open
  def code_only(path,*args,**kwargs):
   if path.suffix.lower() in ('.mp4','.mov','.wav') or 'TIMING' in path.name:raise AssertionError('Historical media access')
   return open_original(path,*args,**kwargs)
  for kind in ['cinematic-question','cinematic-chain','cinematic-key','cinematic-cards']:
   groups=[{'text':t,'startMs':1000+i*800} for i,t in enumerate(['résoudre ce problème','aider les personnes','une compétence utile'])]
   e={'text':'Comment résoudre un problème concret sans perdre de temps','startMs':300,'endMs':4000,'kind':kind,'details':groups}
   with patch.object(Path,'open',code_only):layers=autonomous_layers(e,0,4,scope,functions,ROOT)
   canvas=Image.new('RGBA',(960,540))
   for layer,delay,duration,dy in layers:scope['mix_layer'](canvas,layer,3.5,delay,duration,dy)
   self.assertIsNotNone(canvas.getbbox(),kind)
   self.assertGreater(np.count_nonzero(np.asarray(canvas)[:,:,3]),3000,kind)
if __name__=='__main__':unittest.main()
