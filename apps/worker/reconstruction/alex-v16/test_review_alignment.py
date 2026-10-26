import unittest
from review_alignment import propose


class AlignmentEvidence(unittest.TestCase):
    def fixtures(self):
        transcript = {'sourceSha256': 'source', 'reviewed': False, 'words': [
            {'text': 'bonjour vous', 'startMs': 100, 'endMs': 700},
            {'text': 'suite', 'startMs': 800, 'endMs': 1000},
        ], 'warnings': [{'wordIndex': 1, 'code': 'REVIEW'}]}
        evidence = {'sourceSha256': 'source', 'engine': 'vosk-0.3.45',
                    'model': 'vosk-model-small-fr-0.22', 'words': [
                        {'word': 'bonjour', 'start': .1, 'end': .22, 'conf': .9},
                        {'word': 'vous', 'start': .24, 'end': .7, 'conf': .9},
                    ]}
        return transcript, evidence

    def test_uses_measured_boundaries_and_retains_review(self):
        t, e = self.fixtures()
        r = propose(t, e)
        self.assertEqual([(w['startMs'], w['endMs']) for w in r['words'][:2]], [(100, 220), (240, 700)])
        self.assertTrue(all(w['alignmentReviewRequired'] for w in r['words'][:2]))
        self.assertFalse(r['reviewed'])
        self.assertFalse(r['independentAlignment']['humanVerified'])
        self.assertEqual(r['warnings'][0]['wordIndex'], 2)
        self.assertEqual(t['words'][0]['text'], 'bonjour vous')

    def test_source_mismatch_rejected(self):
        t, e = self.fixtures()
        e['sourceSha256'] = 'other'
        with self.assertRaisesRegex(ValueError, 'hash mismatch'):
            propose(t, e)

    def test_conflicting_words_not_replaced_or_uniformly_split(self):
        t, e = self.fixtures()
        e['words'][1]['word'] = 'nous'
        r = propose(t, e)
        self.assertEqual(r['words'], t['words'])
        self.assertEqual(len(r['independentAlignment']['heldGroups']), 1)

    def test_overlapping_recognizer_boundaries_rejected(self):
        t, e = self.fixtures()
        e['words'][1]['start'] = .15
        self.assertEqual(propose(t, e)['words'], t['words'])

    def test_unsafe_short_clamped_word_is_held(self):
        t, e = self.fixtures()
        t['words'][0]['endMs'] = 240
        t['words'][1]['startMs'] = 250
        self.assertEqual(propose(t, e)['words'], t['words'])

    def test_unexpected_recognizer_rejected(self):
        t, e = self.fixtures()
        e['model'] = 'unknown'
        with self.assertRaisesRegex(ValueError, 'Unexpected'):
            propose(t, e)


if __name__ == '__main__':
    unittest.main()
