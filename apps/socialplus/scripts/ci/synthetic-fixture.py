"""Non-personal test input only: generated chart and clearly synthetic speech."""
import os, subprocess, json, hashlib, urllib.request, sys
from pathlib import Path
root=Path(os.environ['SOCIALPLUS_ACTIONS_WORK_DIR']);root.mkdir(parents=True,exist_ok=True)
manifest=json.loads(Path(__file__).with_name('synthetic-voice-manifest.json').read_text())
voice=Path(os.environ.get('SOCIALPLUS_TEST_VOICE_DIR',str(root/'voice')));voice.mkdir(parents=True,exist_ok=True)
for name,digest in manifest['files'].items():
 target=voice/name
 if not target.exists() or hashlib.sha256(target.read_bytes()).hexdigest()!=digest:
  data=urllib.request.urlopen('https://huggingface.co/'+manifest['repository']+'/resolve/'+manifest['revision']+'/'+manifest['path']+name,timeout=180).read()
  if hashlib.sha256(data).hexdigest()!=digest:raise RuntimeError('Voice model integrity failed')
  target.write_bytes(data)
parts=[
"La visibilité et la rentabilité, rien à voir. Cette différence est essentielle pour comprendre notre activité et prendre une décision.",
"Une formation permet de gagner de l'argent avec une méthode plus simple pour chaque entreprise. Il est utile de vérifier les résultats obtenus.",
"Ceux qui observent apprennent. Ceux qui pratiquent progressent. Ceux qui vérifient réussissent. Chaque étape mérite une attention particulière."
]
for i,text in enumerate(parts):
 subprocess.run([os.environ.get('SOCIALPLUS_PYTHON',sys.executable),'-m','piper','--model',str(voice/'fr_FR-siwis-medium.onnx'),'--output_file',str(root/f'voice-{i}.wav')],input=text.encode(),check=True)
subprocess.run(['ffmpeg','-v','error','-y',*[x for i in range(3) for x in ['-i',str(root/f'voice-{i}.wav')]],'-filter_complex','anullsrc=r=22050:cl=mono:d=1.2[p];[p]asplit=2[p1][p2];[0:a][p1][1:a][p2][2:a]concat=n=5:v=0:a=1[a]','-map','[a]',str(root/'speech.wav')],check=True)
subprocess.run(['ffmpeg','-v','error','-y','-f','lavfi','-i','testsrc2=size=1920x1080:rate=25','-i',str(root/'speech.wav'),'-shortest','-c:v','libx264','-preset','veryfast','-crf','24','-pix_fmt','yuv420p','-c:a','aac','-b:a','128k','-movflags','+faststart',str(root/'source.mov')],check=True)
print('Non-personal synthetic fixture generated; voice is synthetic, not a user recording.')
