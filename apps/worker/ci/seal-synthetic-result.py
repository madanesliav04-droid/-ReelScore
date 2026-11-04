"""Encrypted log delivery: no artifact storage, no clear MP4 or private key in logs."""
import os,json,subprocess,base64,hashlib,zipfile
from pathlib import Path
root=Path(os.environ['SOCIALPLUS_ACTIONS_WORK_DIR'])
report=root/'report.json'
if not report.is_file():report.write_text(json.dumps({'technicalSuccess':False,'code':'RENDER_DID_NOT_PRODUCE_REPORT'}))
archive=root/'result.zip'
with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED) as z:
 for name in ['alex.mp4','report.json','metrics.json','compute.log','alex-plan.json','alex-transcript.json','alex.qa.json']:
  p=root/name
  if p.is_file():z.write(p,name)
sealed=root/'result.cms'
subprocess.run(['openssl','cms','-encrypt','-binary','-aes-256-cbc','-in',str(archive),'-outform','DER','-out',str(sealed),'ci/synthetic-delivery-public.pem'],check=True)
b=sealed.read_bytes()
if len(b)>16_000_000:raise RuntimeError('Encrypted log delivery exceeds bounded test limit')
print('SOCIALPLUS_ENCRYPTED_BEGIN '+hashlib.sha256(b).hexdigest(),flush=True)
data=base64.b64encode(b).decode()
for i in range(0,len(data),2048):print('SOCIALPLUS_ENCRYPTED_CHUNK '+data[i:i+2048],flush=True)
print('SOCIALPLUS_ENCRYPTED_END',flush=True)
print('Technical result: '+str(json.loads(report.read_text()).get('technicalSuccess') is True),flush=True)
