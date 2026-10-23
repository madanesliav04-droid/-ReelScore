import unittest
from transcribe_local import normalize_words,bound_onsets
class WordNormalization(unittest.TestCase):
 def test_contractions_and_zero_duration_fragments(self):
  words,warnings=normalize_words([{'text':t,'start':a,'end':b,'probability':.9} for t,a,b in [('c',.1,.2),("'est",.2,.4),('a',.4,.4),('une',.4,.6),('«',.6,.6),('idée',.6,.9),('.',.9,.9)]],1000)
  self.assertEqual([w['text'] for w in words],["c'est",'a une','idée.'])
  self.assertEqual([(w['startMs'],w['endMs']) for w in words],[(100,400),(400,600),(600,900)])
  self.assertIn('MERGED_ASR_PIECE',[w['code'] for w in warnings])
 def test_unresolved_word_is_reported_without_inventing_time(self):
  words,warnings=normalize_words([{'text':'mot','start':.5,'end':.5,'probability':.5}],1000)
  self.assertEqual(words,[]);self.assertEqual(warnings[0]['code'],'UNTIMED_WORD')
 def test_measured_onsets_bound_only_words_starting_inside_silence(self):
  words=[{'text':'Il','startMs':0,'endMs':700},{'text':'voix','startMs':710,'endMs':950}]
  warnings=bound_onsets(words,'silence_start: 0\nsilence_end: 0.645')
  self.assertEqual(words[0]['startMs'],605)
  self.assertEqual(words[1]['startMs'],710);self.assertEqual(warnings[0]['code'],'ACOUSTIC_ONSET_BOUND')

class AcousticRelease(unittest.TestCase):
 def test_release_does_not_highlight_a_word_inside_the_following_pause(self):
  words=[{'text':'mot','startMs':1700,'endMs':2580},{'text':'suivant','startMs':2580,'endMs':2940}]
  warnings=bound_onsets(words,'silence_start: 2.298\nsilence_end: 2.722')
  self.assertEqual(words[0]['endMs'],2338);self.assertEqual(words[1]['startMs'],2682)
  self.assertEqual([w['code'] for w in warnings],['ACOUSTIC_OFFSET_BOUND','ACOUSTIC_ONSET_BOUND'])
 def test_internal_quiet_syllable_is_not_deleted(self):
  words=[{'text':'mot','startMs':1000,'endMs':1800}]
  self.assertEqual(bound_onsets(words,'silence_start: 1.2\nsilence_end: 1.5'),[])
  self.assertEqual(words[0]['endMs'],1800)

if __name__=='__main__':unittest.main()
