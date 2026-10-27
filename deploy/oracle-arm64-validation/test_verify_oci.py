import hashlib
import importlib.util
import io
import json
from pathlib import Path
import tarfile
import tempfile
import unittest

spec = importlib.util.spec_from_file_location('verify_oci', Path(__file__).with_name('verify-oci.py'))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class ArchiveChecks(unittest.TestCase):
    def fixture(self, *, arch='arm64', user='node', corrupt=False, unsafe=False):
        files = {'oci-layout': json.dumps({'imageLayoutVersion': '1.0.0'}).encode()}

        def blob(data):
            digest = hashlib.sha256(data).hexdigest()
            files['blobs/sha256/' + digest] = data
            return {'digest': 'sha256:' + digest, 'size': len(data)}

        config = blob(json.dumps({'architecture': arch, 'os': 'linux', 'config': {'User': user}}).encode())
        layer = blob(b'synthetic test blob; no executable code')
        manifest = blob(json.dumps({'config': config, 'layers': [layer]}).encode())
        files['index.json'] = json.dumps({'manifests': [manifest]}).encode()
        if corrupt:
            files['blobs/sha256/' + layer['digest'].split(':')[1]] = b'X' * layer['size']
        if unsafe:
            files['../outside'] = b'never extract'
        return files

    def run_archive(self, **kwargs):
        with tempfile.TemporaryDirectory() as temp:
            file = Path(temp) / 'image.oci.tar'
            with tarfile.open(file, 'w') as archive:
                for name, data in self.fixture(**kwargs).items():
                    info = tarfile.TarInfo(name); info.size = len(data)
                    archive.addfile(info, io.BytesIO(data))
            return module.verify(file)

    def test_valid_metadata(self):
        self.assertTrue(self.run_archive()['ok'])

    def test_corrupted_blob_rejected(self):
        with self.assertRaisesRegex(ValueError, 'hash mismatch'):
            self.run_archive(corrupt=True)

    def test_wrong_architecture_rejected(self):
        with self.assertRaisesRegex(ValueError, 'ARM64'):
            self.run_archive(arch='amd64')

    def test_root_image_rejected(self):
        with self.assertRaisesRegex(ValueError, 'nonroot'):
            self.run_archive(user='root')

    def test_path_traversal_rejected(self):
        with self.assertRaisesRegex(ValueError, 'Unsafe'):
            self.run_archive(unsafe=True)


if __name__ == '__main__':
    unittest.main()
