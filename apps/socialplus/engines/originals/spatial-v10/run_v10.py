#!/usr/bin/env python3
"""Render V10 focus atop supplied V9 reference, then stream-copy V9 audio.
Read README first. Produces identical editorial logic; output bytes can vary by codec version.
"""
import os,sys,subprocess,shutil
from pathlib import Path
ROOT=Path(__file__).resolve().parent
os.environ['EDITPLUS_PROJECT_DIR']=str(ROOT)
for cmd in ['ffmpeg','ffprobe']:
 if not shutil.which(cmd): raise SystemExit('Missing: '+cmd)
try:
 import cv2,numpy,PIL
except ImportError as e:
 raise SystemExit('Missing Python dependency: '+str(e))
# Originals read ROOT/code/portable... and use V9 in ROOT/media.
v9=ROOT/'EDITPLUS_SPATIAL_UI_V9_MOTION_FLOW.mp4'
if not v9.exists():
 src=ROOT/'media'/'EDITPLUS_SPATIAL_UI_V9_MOTION_FLOW.mp4'
 if not src.is_file(): raise SystemExit('V9 reference video required')
 shutil.copyfile(src,v9)
subprocess.run([sys.executable,str(ROOT/'code/portable_editplus_spatial_ui_v10_focus.py')],check=True)
v=ROOT/'EDITPLUS_SPATIAL_UI_V10_FOCUS_VIDEO_ONLY.mp4';out=ROOT/'EDITPLUS_SPATIAL_UI_V10_FOCUS.mp4'
subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-i',str(v),'-i',str(v9),'-map','0:v:0','-map','1:a:0','-c:v','copy','-c:a','copy','-movflags','+faststart','-t','47.2',str(out)],check=True)
print('MP4 generated:',out)
