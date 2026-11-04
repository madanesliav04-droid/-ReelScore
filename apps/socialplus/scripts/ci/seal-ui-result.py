"""Encrypt the non-personal CI result before any log delivery; no artifacts."""
import os,subprocess,base64,hashlib,zipfile
from pathlib import Path
root=Path(os.environ['SOCIALPLUS_ACTIONS_WORK_DIR']);out=root/'ui'
archive=root/'result.zip'
with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED) as z:
 for name in ['SocialPlus_Alex_V16_standalone_UI.mp4','RESULTATS.json','resources.json','resource-samples.json','container.log','failure.txt']:
  p=out/name
  if p.is_file():z.write(p,name)
sealed=root/'result.cms'
subprocess.run(['openssl','cms','-encrypt','-binary','-aes-256-cbc','-in',str(archive),'-outform','DER','-out',str(sealed),str(Path(__file__).with_name('delivery-public.pem'))],check=True)
b=sealed.read_bytes()
if len(b)>24_000_000:raise RuntimeError('Bounded encrypted test log delivery exceeded')
print('SOCIALPLUS_ENCRYPTED_BEGIN '+hashlib.sha256(b).hexdigest(),flush=True)
data=base64.b64encode(b).decode()
for i in range(0,len(data),2048):print('SOCIALPLUS_ENCRYPTED_CHUNK '+data[i:i+2048],flush=True)
print('SOCIALPLUS_ENCRYPTED_END',flush=True)
