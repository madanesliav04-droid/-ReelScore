"""Verify an OCI archive without extracting its files or running any code."""
import hashlib
import json
import sys
import tarfile
from pathlib import PurePosixPath


def verify(path):
    with tarfile.open(path, 'r:*') as archive:
        members = {}
        for member in archive.getmembers():
            name = member.name.removeprefix('./')
            if name.startswith('/') or '..' in PurePosixPath(name).parts or name in members:
                raise ValueError('Unsafe or duplicate archive entry')
            if not (member.isfile() or member.isdir()):
                raise ValueError('Links/devices are not expected in an OCI archive')
            members[name] = member

        def read(name):
            return archive.extractfile(members[name]).read()

        layout = json.loads(read('oci-layout'))
        if layout.get('imageLayoutVersion') != '1.0.0':
            raise ValueError('Unsupported OCI layout')
        checked = set()

        def blob(descriptor):
            digest = descriptor['digest']
            if not digest.startswith('sha256:') or len(digest) != 71:
                raise ValueError('Unexpected digest')
            name = 'blobs/sha256/' + digest.split(':')[1]
            member = members[name]
            if member.size != descriptor['size']:
                raise ValueError('Descriptor size mismatch')
            if digest not in checked:
                h = hashlib.sha256()
                with archive.extractfile(member) as stream:
                    while data := stream.read(1024 * 1024):
                        h.update(data)
                if h.hexdigest() != digest.split(':')[1]:
                    raise ValueError('Blob hash mismatch')
                checked.add(digest)
            return name

        images = []

        def visit(descriptor):
            manifest = json.loads(read(blob(descriptor)))
            if 'manifests' in manifest:
                for child in manifest['manifests']:
                    visit(child)
                return
            config = json.loads(read(blob(manifest['config'])))
            if config.get('architecture') != 'arm64' or config.get('os') != 'linux':
                raise ValueError('Not a Linux ARM64 image')
            if config.get('config', {}).get('User') != 'node':
                raise ValueError('Image must use the nonroot node user')
            for layer in manifest['layers']:
                blob(layer)
            images.append({'digest': descriptor['digest'], 'architecture': 'arm64',
                           'os': 'linux', 'user': 'node', 'layers': len(manifest['layers'])})

        for descriptor in json.loads(read('index.json'))['manifests']:
            visit(descriptor)
        if len(images) != 1:
            raise ValueError('Expected exactly one image, without attestation manifests')
        return {'ok': True, 'verifiedBlobs': len(checked), 'images': images,
                'note': 'Archive integrity/metadata only, not a native runtime or render test'}


if __name__ == '__main__':
    print(json.dumps(verify(sys.argv[1]), indent=2))
