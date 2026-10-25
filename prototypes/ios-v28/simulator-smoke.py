"""App launch check only. Never claims a private-rush export succeeded."""
import json, subprocess, sys, os
from pathlib import Path

def run(*args):
    return subprocess.check_output(args, text=True)

devices = json.loads(run('xcrun', 'simctl', 'list', 'devices', 'available', '--json'))['devices']
phones = [d for runtime, ds in devices.items() if 'iOS' in runtime
          for d in ds if 'iPhone' in d['name'] and d.get('isAvailable')]
if not phones:
    raise SystemExit('No available iPhone simulator. No runtime download requested.')
device = phones[0]
udid = device['udid']
booted_here = device['state'] != 'Booted'
try:
    if booted_here:
        run('xcrun', 'simctl', 'boot', udid)
    run('xcrun', 'simctl', 'bootstatus', udid, '-b')
    # arm64 Simulator executables require a local ad-hoc signature; no Apple account.
    run('codesign', '--force', '--deep', '--sign', '-', sys.argv[1])
    run('xcrun', 'simctl', 'install', udid, sys.argv[1])
    run('xcrun', 'simctl', 'launch', udid, 'local.socialplus.v28lab')
    report = 'Simulator installed and launched the app. No private rush supplied; no MP4 export or fidelity validation.'
    print(report)
    if os.getenv('GITHUB_STEP_SUMMARY'):
        with open(os.environ['GITHUB_STEP_SUMMARY'], 'a') as f:
            f.write(report + '\n')
except Exception:
    reports = sorted((Path.home() / 'Library/Logs/DiagnosticReports').glob('SocialPlusV28Lab*'), key=lambda p: p.stat().st_mtime)
    for report in reports[-2:]:
        print(report.read_text(errors='replace')[-12000:])
    raise
finally:
    if booted_here:
        subprocess.run(['xcrun', 'simctl', 'shutdown', udid], check=False)
