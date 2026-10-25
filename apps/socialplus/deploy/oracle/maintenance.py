#!/usr/bin/env python3
"""Offline maintenance: compose app MUST be stopped; never delete saved media."""
import os, sqlite3, subprocess, tarfile, time, shutil
from pathlib import Path
os.umask(0o077)
compose=Path('/opt/socialplus/apps/socialplus/deploy/oracle')
base=Path('/var/lib/socialplus'); backups=base/'backups'
backups.mkdir(parents=True,exist_ok=True,mode=0o700)
subprocess.run(['docker','compose','stop','-t','60','app'],cwd=compose,check=True)
try:
    # Stop if the engine is still running: no inconsistent file/database copy.
    running=subprocess.check_output(['docker','compose','ps','--status','running','--services'],cwd=compose,text=True).splitlines()
    if 'app' in running:raise RuntimeError('App must be stopped for offline maintenance')
    tmp=base/'tmp'
    if tmp.exists():
        for p in tmp.iterdir():
            if p.is_dir() and p.name.startswith('socialplus-render-') and time.time()-p.stat().st_mtime>86400:
                shutil.rmtree(p)
    stamp=time.strftime('%Y%m%dT%H%M%SZ',time.gmtime())
    dbfile=base/'data/socialplus.sqlite'
    if not dbfile.is_file():raise RuntimeError('No SQLite database to back up')
    snapshot=backups/(stamp+'.sqlite')
    with sqlite3.connect('file:'+str(dbfile)+'?mode=ro',uri=True) as src, sqlite3.connect(snapshot) as dst:src.backup(dst)
    archive=backups/(stamp+'.tar.gz')
    with tarfile.open(archive,'w:gz') as out:
        out.add(snapshot,arcname='data/socialplus.sqlite')
        media=base/'data/media'
        if media.exists():out.add(media,arcname='data/media')
    snapshot.unlink()
    for old in sorted(backups.glob('*.tar.gz'))[:-3]:old.unlink()
finally:
    if shutil.disk_usage(base).free >= 8 * 1024**3:
        subprocess.run(['docker','compose','up','-d','app'],cwd=compose,check=True)
    else:
        print('App left stopped: insufficient disk space; manual recovery required.')
