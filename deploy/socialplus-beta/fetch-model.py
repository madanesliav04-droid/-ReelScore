"""Fetch only public pinned weights; never upload a rush or use an API token."""
from pathlib import Path
import hashlib,json,os,urllib.request
manifest=json.loads(Path(__file__).with_name('model-manifest.json').read_text())
dest=Path(os.environ.get('SOCIALPLUS_MODEL_OUTPUT','/opt/models/whisper-small'));dest.mkdir(parents=True,exist_ok=True)
for name,digest in manifest['files'].items():
    output=dest/name
    if output.exists() and hashlib.sha256(output.read_bytes()).hexdigest()==digest:continue
    url=f"https://huggingface.co/{manifest['repository']}/resolve/{manifest['revision']}/{name}"
    temporary=dest/(name+'.part');h=hashlib.sha256()
    with urllib.request.urlopen(url,timeout=180) as response,temporary.open('wb') as target:
        for chunk in iter(lambda:response.read(1024*1024),b''):target.write(chunk);h.update(chunk)
    if h.hexdigest()!=digest:raise RuntimeError('Public ASR model integrity mismatch: '+name)
    temporary.replace(output)
print('Pinned public Whisper weights verified')
