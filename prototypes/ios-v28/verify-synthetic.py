"""Only artificial fixtures are permitted here; never print a private media payload."""
import base64, hashlib, json, os, subprocess
from pathlib import Path
root = Path(os.environ['RUNNER_TEMP'])
source = root / 'synthetic.mp4'
output = root / 'v28-proof/SocialPlus-synthetic-iOS.mp4'

def run(*args):
    return subprocess.check_output(args)

def probe(file):
    return json.loads(run('ffprobe', '-v', 'error', '-show_streams', '-show_format', '-of', 'json', str(file)))

p = probe(output)
v = [s for s in p['streams'] if s['codec_type'] == 'video']
a = [s for s in p['streams'] if s['codec_type'] == 'audio']
assert len(v) == len(a) == 1, 'Expected exactly one video/audio stream'
assert v[0]['codec_name'] == 'h264' and a[0]['codec_name'] == 'aac', 'Wrong codecs'
assert (v[0]['width'], v[0]['height']) == (320, 568), 'Native dimensions changed'
assert abs(float(p['format']['duration']) - 3) < .15, 'Incorrect duration'
run('ffmpeg', '-v', 'error', '-i', str(output), '-f', 'null', '-')
def pcm(file):
    return run('ffmpeg', '-v', 'error', '-i', str(file), '-map', '0:a:0', '-f', 's16le', '-')
assert pcm(source) == pcm(output), 'Decoded audio samples changed'

def frame(file, t):
    return run('ffmpeg', '-v', 'error', '-ss', str(t), '-i', str(file), '-frames:v', '1', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-')

def changed(t, rect):
    src, dst = frame(source, t), frame(output, t)
    assert len(src) == len(dst) == 320 * 568 * 3
    x, y, w, h = rect
    diffs = []
    for row in range(y, y+h):
        for col in range(x, x+w):
            i = (row*320+col)*3
            diffs.append(max(abs(src[i+c]-dst[i+c]) for c in range(3)))
    return sum(d > 35 for d in diffs) / len(diffs)
# Different codec/color conversion can cause small background differences. Demand
# a stronger visible change in the expected animated area than in its idle state.
hero_idle = changed(0, (25,45,269,110))
hero_active = changed(.7, (25,45,269,110))
bubble_idle = changed(.05, (44,181,230,60))
bubble_active = changed(1.7, (44,181,230,60))
assert hero_active > hero_idle + .005, f'Hero overlay absent: idle={hero_idle} active={hero_active}'
assert bubble_active > bubble_idle + .01, f'Bubble overlay absent: idle={bubble_idle} active={bubble_active}'
report = dict(duration=p['format']['duration'], width=320, height=568, fullDecode=True,
              audioPcmIdentical=True, heroChangedFraction=hero_active,
              bubbleChangedFraction=bubble_active, physicalIPhone=False,
              approvedMasterFidelityTested=False, sha256=hashlib.sha256(output.read_bytes()).hexdigest(),
              bytes=output.stat().st_size)
(root/'v28-proof/verification.json').write_text(json.dumps(report, indent=2))
print(json.dumps(report))
# No artifact/cache storage is used: account storage allowance cannot be checked.
# This is synthetic test data only, in an already-public repository. Logs are NOT private.
assert output.stat().st_size < 1_000_000, 'Proof too large for bounded log retrieval'
print('SYNTHETIC_MP4_BASE64_BEGIN')
print(base64.b64encode(output.read_bytes()).decode())
print('SYNTHETIC_MP4_BASE64_END')
