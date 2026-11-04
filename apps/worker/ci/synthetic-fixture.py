"""Non-personal test input only: generated chart and clearly synthetic speech."""
import os, subprocess
from pathlib import Path
root=Path(os.environ['SOCIALPLUS_ACTIONS_WORK_DIR']);root.mkdir(parents=True,exist_ok=True)
parts=[
"Au début, il faut expliquer une idée simple. Les clients vivent déjà le problème. Ils se plaignent déjà et cherchent une solution concrète.",
"Parce que vendre devient plus simple quand la personne sait déjà ce qui bloque son projet. Cette connaissance permet de mieux répondre à sa demande.",
"Ton boulot est de montrer pourquoi ta solution est la bonne. Il faut expliquer comment faire pour obtenir un résultat concret. Prenez le temps de vérifier chaque étape."
]
for i,text in enumerate(parts):
 subprocess.run(['espeak-ng','-v','fr-fr','-s','145','-w',str(root/f'voice-{i}.wav'),text],check=True)
subprocess.run(['ffmpeg','-v','error','-y',*[x for i in range(3) for x in ['-i',str(root/f'voice-{i}.wav')]],'-filter_complex','anullsrc=r=22050:cl=mono:d=1.2[p];[0:a][p][1:a][2:a]concat=n=4:v=0:a=1[a]','-map','[a]',str(root/'speech.wav')],check=True)
subprocess.run(['ffmpeg','-v','error','-y','-f','lavfi','-i','testsrc2=size=640x360:rate=25','-i',str(root/'speech.wav'),'-shortest','-c:v','libx264','-preset','veryfast','-crf','24','-pix_fmt','yuv420p','-c:a','aac','-b:a','128k','-movflags','+faststart',str(root/'source.mov')],check=True)
print('Non-personal synthetic fixture generated; voice is synthetic, not a user recording.')
