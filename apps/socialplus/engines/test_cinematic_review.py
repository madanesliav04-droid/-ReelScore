import unittest
from review_cinematic_words import candidates_for,contextual_disagreements
class CinematicReview(unittest.TestCase):
 def test_contextual_alignment_preserves_acoustic_times_but_rejects_zero_and_overlapping_boundaries(self):
  raw=[{'text':'y','startMs':700,'endMs':740},{'text':'a','startMs':740,'endMs':800}]
  self.assertEqual(candidates_for('y a',raw,700,780),raw)
  self.assertIsNone(candidates_for('y a',[{**raw[0],'endMs':700},raw[1]],700,780))
  self.assertIsNone(candidates_for('y a',[{**raw[0],'endMs':760},raw[1]],700,780))
  self.assertIsNone(candidates_for('y a',raw,4000,4200))
 def test_matching_never_fabricates_a_missing_or_different_word(self):
  raw=[{'text':'autre','startMs':100,'endMs':200}]
  self.assertIsNone(candidates_for('mot',raw,100,200))
 def test_common_word_match_cannot_steal_the_previous_occurrence(self):
  raw=[{'text':'de','startMs':40720,'endMs':40880}]
  self.assertIsNone(candidates_for('de',raw,41120,41240))
 def test_apostrophe_splitting_and_crop_edges_are_not_reported_as_word_errors(self):
  words=[{'text':"n'a",'startMs':1000,'endMs':1200}]
  windows=[{'startMs':0,'endMs':2000,'words':[{'text':"n'"},{'text':'a'}]}]
  self.assertEqual(contextual_disagreements(words,windows,[],2000),[])
  windows=[{'startMs':950,'endMs':2000,'words':[]}]
  self.assertEqual(contextual_disagreements(words,windows,[],3000),[])
if __name__=='__main__' :unittest.main()
