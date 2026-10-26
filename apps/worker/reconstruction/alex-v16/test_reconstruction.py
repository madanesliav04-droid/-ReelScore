import hashlib
import json
from pathlib import Path
import unittest
from render import validate
from scenes import draw_scene, native_scene, ease
from captions import draw_caption


def scene():
    return {'kind':'question','start':0,'end':4,'text':{'chapter':'TEST','title':'TEST','symbols':['?','+'],'labels':['A','B'],'conclusion':'TEST'},'cues':{'rightHighlight':1,'arrowStart':1.2,'arrowDuration':.5,'calloutStart':2,'calloutDuration':.3}}


def plan():
    return {'schemaVersion':1,'purpose':'new-rush','wordVerification':'human-confirmed','words':[{'text':'Test','start':0,'end':1}],'scenes':[scene()]}


class Reconstruction(unittest.TestCase):
    def test_reject_uncertain_words(self):
        p=plan();p['wordVerification']='automatic-unreviewed'
        with self.assertRaisesRegex(ValueError,'confirmed timed words'):validate(p,4,False,'abc')

    def test_reference_cannot_be_applied_to_new_rush(self):
        p=plan();p.update(purpose='reference-reconstruction-qa',referenceSha256='abc')
        with self.assertRaisesRegex(ValueError,'Historical reference timings'):validate(p,4,False,'abc')
        with self.assertRaisesRegex(ValueError,'hash-bound master'):validate(p,4,True,'other')
        validate(p,4,True,'abc')

    def test_overlapping_words_rejected(self):
        p=plan();p['words'].append({'text':'Again','start':.5,'end':1.2})
        with self.assertRaisesRegex(ValueError,'word boundaries'):validate(p,4,False,'abc')

    def test_overlapping_scenes_rejected(self):
        p=plan();p['scenes'].append(scene())
        with self.assertRaisesRegex(ValueError,'scene intervals'):validate(p,4,False,'abc')

    def test_malformed_animation_not_silently_rendered(self):
        for value in [0,-1,float('nan')]:
            p=plan();p['scenes'][0]['cues']['arrowDuration']=value
            with self.assertRaises(ValueError):validate(p,4,False,'abc')

    def test_only_three_grammars(self):
        p=plan();p['scenes'][0]['kind']='generic-preset'
        with self.assertRaisesRegex(ValueError,'three reconstructed'):validate(p,4,False,'abc')

    def test_pixels_reproducible_and_animation_changes(self):
        s=scene();self.assertEqual(draw_scene(s,2).tobytes(),draw_scene(s,2).tobytes())
        self.assertNotEqual(draw_scene(s,0).tobytes(),draw_scene(s,3).tobytes())
        self.assertEqual(ease(-1),0);self.assertEqual(ease(2),1)

    def test_native_dimensions(self):
        self.assertEqual(native_scene(scene(),2,512,910).size,(512,910))
        self.assertEqual(native_scene(scene(),2,910,512).size,(910,512))

    def test_unfit_caption_rejected(self):
        with self.assertRaisesRegex(ValueError,'safe width'):
            draw_caption(draw_scene(scene(),1),[{'text':'W'*200,'start':0,'end':2}],1)

    def test_unfit_graphic_fails_instead_of_overlapping(self):
        s=scene();s['text']['title']='W'*80
        with self.assertRaisesRegex(ValueError,'safe area'):draw_scene(s,1)

    def test_font_provenance(self):
        root=Path(__file__).parent/'fonts';m=json.loads((root/'manifest.json').read_text())
        for name,expected in m['fonts'].items():self.assertEqual(hashlib.sha256((root/name).read_bytes()).hexdigest(),expected)


if __name__=='__main__':unittest.main()
