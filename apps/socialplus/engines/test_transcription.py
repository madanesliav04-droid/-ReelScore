import unittest
from transcribe_local import normalize_words
class WordNormalization(unittest.TestCase):
 def test_contractions_and_zero_duration_fragments(self):
  words,warnings=normalize_words([{'text':t,'start':a,'end':b,'probability':.9} for t,a,b in [('c',.1,.2),("'est",.2,.4),('a',.4,.4),('une',.4,.6),('«',.6,.6),('idée',.6,.9),('.',.9,.9)]],1000)
  self.assertEqual([w['text'] for w in words],["c'est",'a une','idée.'])
  self.assertEqual([(w['startMs'],w['endMs']) for w in words],[(100,400),(400,600),(600,900)])
  self.assertIn('MERGED_ASR_PIECE',[w['code'] for w in warnings])
 def test_unresolved_word_is_reported_without_inventing_time(self):
  words,warnings=normalize_words([{'text':'mot','start':.5,'end':.5,'probability':.5}],1000)
  self.assertEqual(words,[]);self.assertEqual(warnings[0]['code'],'UNTIMED_WORD')
if __name__=='__main__':unittest.main()
