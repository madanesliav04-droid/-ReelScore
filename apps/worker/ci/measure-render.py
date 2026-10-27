"""Measure one isolated process group; no credentials or media in stdout."""
import json
import os
from pathlib import Path
import signal
import subprocess
import sys
import time


def sample_group(group):
    ticks = rss = 0
    identities = {}
    for directory in Path('/proc').iterdir():
        if not directory.name.isdigit():
            continue
        try:
            fields = (directory / 'stat').read_text().rsplit(') ', 1)[1].split()
            if int(fields[2]) != group:
                continue
            identity = (int(directory.name), int(fields[19]))
            identities[identity] = int(fields[11]) + int(fields[12])
            rss += int(fields[21]) * os.sysconf('SC_PAGE_SIZE')
        except (OSError, ValueError, IndexError):
            continue
    return identities, rss


def measure(command, directory, timeout_seconds=1200):
    directory = Path(directory)
    start = time.monotonic()
    seen, samples = {}, []
    peak_rss = 0
    timed_out = False
    with (directory / 'compute.log').open('wb') as log:
        process = subprocess.Popen(command, stdout=log, stderr=log, start_new_session=True)
        try:
            while True:
                current, rss = sample_group(process.pid)
                seen.update(current)
                peak_rss = max(peak_rss, rss)
                samples.append((time.monotonic() - start, sum(seen.values())))
                pid, status, usage = os.wait4(process.pid, os.WNOHANG)
                if pid:
                    process.returncode = os.waitstatus_to_exitcode(status)
                    break
                if time.monotonic() - start > timeout_seconds:
                    timed_out = True
                    os.killpg(process.pid, signal.SIGKILL)
                    _, status, usage = os.wait4(process.pid, 0)
                    process.returncode = os.waitstatus_to_exitcode(status)
                    break
                time.sleep(.2)
        finally:
            try:
                os.killpg(process.pid, signal.SIGKILL)
            except ProcessLookupError:
                pass
    elapsed = time.monotonic() - start
    cpu_seconds = usage.ru_utime + usage.ru_stime
    hz = os.sysconf('SC_CLK_TCK')
    peaks = [(b[1] - a[1]) / hz / (b[0] - a[0]) * 100
             for a, b in zip(samples, samples[1:]) if b[0] > a[0]]
    metrics = {
        'exitCode': process.returncode, 'timedOut': timed_out,
        'elapsedSeconds': elapsed, 'cpuSeconds': cpu_seconds,
        'averageCpuCorePercent': cpu_seconds / elapsed * 100,
        'peakSampledCpuCorePercent': max(peaks, default=None),
        'maxSingleProcessRssBytes': usage.ru_maxrss * 1024,
        'peakSampledProcessGroupRssBytes': peak_rss,
        'sampleIntervalSeconds': .2,
        'note': '100% CPU means one CPU. CPU average uses wait4 including waited descendants; peak CPU/RSS are sampled. Summed RSS can count shared pages more than once; this is not exact cgroup peak RAM.'
    }
    (directory / 'metrics.json').write_text(json.dumps(metrics, indent=2) + '\n')
    return metrics


if __name__ == '__main__':
    directory = os.environ['SOCIALPLUS_ACTIONS_WORK_DIR']
    result = measure(['node', 'ci/alex-render.mjs'], directory)
    print('Offline render completed' if result['exitCode'] == 0 else 'Offline render failed; details remain private')
    sys.exit(0 if result['exitCode'] == 0 else 1)
