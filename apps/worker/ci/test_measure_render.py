import importlib.util
from pathlib import Path
import sys
import tempfile
import unittest

spec = importlib.util.spec_from_file_location('measure', Path(__file__).with_name('measure-render.py'))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class Measurement(unittest.TestCase):
    def test_actual_child_and_metrics(self):
        with tempfile.TemporaryDirectory() as directory:
            result = module.measure([sys.executable, '-c', 'import time; data=bytearray(4000000); time.sleep(.5)'], directory)
            self.assertEqual(result['exitCode'], 0)
            self.assertGreater(result['elapsedSeconds'], .4)
            self.assertGreater(result['peakSampledProcessGroupRssBytes'], 4000000)
            self.assertGreaterEqual(result['cpuSeconds'], 0)

    def test_failure_is_not_success(self):
        with tempfile.TemporaryDirectory() as directory:
            result = module.measure([sys.executable, '-c', 'raise SystemExit(7)'], directory)
            self.assertEqual(result['exitCode'], 7)


if __name__ == '__main__':
    unittest.main()
