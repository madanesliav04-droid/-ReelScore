#!/usr/bin/env python3
"""Stop admission by stopping the app before disk exhaustion; manual recovery."""
import shutil, subprocess
minimum = 8 * 1024**3
if shutil.disk_usage('/var/lib/socialplus').free < minimum:
    subprocess.run(['systemctl','stop','socialplus.service'],check=True)
    subprocess.run(['docker','compose','stop','-t','60','app'],cwd='/opt/socialplus/apps/socialplus/deploy/oracle',check=True)
    print('Social+ stopped: less than 8 GiB free. Free space and restart manually.')
