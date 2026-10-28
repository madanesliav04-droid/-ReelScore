import unittest,json,hashlib
from pathlib import Path
from PIL import ImageFont
ROOT=Path(__file__).parent/'fonts'
class BundledFontTests(unittest.TestCase):
 def test_all_historical_roles_resolve_to_licensed_portable_fonts(self):
  manifest=json.loads((ROOT/'manifest.json').read_text())
  for alias,file in manifest['aliases'].items():
   self.assertTrue((ROOT/file).is_file(),alias)
   meta=manifest['fonts'][file];self.assertEqual(hashlib.sha256((ROOT/file).read_bytes()).hexdigest(),meta['sha256'])
   self.assertIn('SIL OPEN FONT LICENSE',(ROOT/meta['license']).read_text().upper())
   f=ImageFont.truetype(str(ROOT/file),30);self.assertGreater(f.getlength('Élève, à zéro : 25 € →'),0)
 def test_serif_and_semibold_roles_do_not_silently_use_the_same_sans_face(self):
  m=json.loads((ROOT/'manifest.json').read_text());self.assertNotEqual(m['aliases']['EBGaramond08-Regular.ttf'],m['aliases']['Inter-Regular.otf']);self.assertNotEqual(m['aliases']['Inter-SemiBold.otf'],m['aliases']['Inter-Regular.otf'])
if __name__=='__main__':unittest.main()
