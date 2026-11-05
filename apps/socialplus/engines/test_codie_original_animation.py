import tempfile,unittest
from pathlib import Path
from PIL import Image,ImageChops
from codie_original_animation import original_scope,frame,SOURCE
FONT=Path(__file__).parent/'fonts/SocialPlusDisplay-SemiBold.ttf'
class OriginalAnimationTests(unittest.TestCase):
 def test_port_matches_original_frame_body_without_historical_media(self):
  code=SOURCE.read_text();code=code[code.index('def smoother('):code.index('# Assemble ALL frames')]
  cue={'kind':'clock','x':176,'y':161,'start':0,'end':2.23}
  with tempfile.TemporaryDirectory() as folder:
   for t in [0,.12,.25,.5,1,2.2,2.4]:
    original=original_scope(FONT);original.update(T0=t,N=1,fps=30,W=910,H=512,CUES=[cue],seq=Path(folder))
    exec(compile(code,str(SOURCE),'exec'),original)
    actual=frame(original_scope(FONT),t,[cue],910,512)
    expected=Image.open(Path(folder)/'bubble_0000.png')
    self.assertIsNone(ImageChops.difference(actual,expected).getbbox(),t)
 def test_complete_transparency_outside_spoken_cue(self):
  cue={'kind':'euro','x':780,'y':161,'start':1,'end':3}
  for t in [0,3,4]:self.assertIsNone(frame(original_scope(FONT),t,[cue],910,512).getbbox())
if __name__=='__main__':unittest.main()
