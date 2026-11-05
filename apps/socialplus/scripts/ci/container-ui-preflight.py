import os,subprocess,time,json,re,sys
from pathlib import Path
case='ui-1080p';root=Path(os.environ['SOCIALPLUS_ACTIONS_WORK_DIR']).resolve();out=root/'ui';out.mkdir(exist_ok=True)
source=root/'source.mov'
name='socialplus-preflight-'+case
cmd=['docker','run','--name',name,'--user',str(os.getuid())+':'+str(os.getgid()),'--cpus','2','--memory','8g','--memory-swap','8g','--network','none','--shm-size','256m','--mount','type=bind,src='+str(source)+',dst=/test/source.mov,readonly','--mount','type=bind,src='+str(out)+',dst=/out','--label','socialplus.test=isolated-preflight']
for k,v in {'HOME':'/tmp/socialplus-test-home','XDG_CACHE_HOME':'/tmp/socialplus-test-home/cache','XDG_CONFIG_HOME':'/tmp/socialplus-test-home/config','SOCIALPLUS_TEST_RUSH':'/test/source.mov','SOCIALPLUS_BROWSER_ARTIFACT_DIR':'/out','SOCIALPLUS_CHROMIUM':'/usr/bin/chromium','SOCIALPLUS_ISOLATED_CONTAINER_BROWSER':'true','SOCIALPLUS_ALEX_V16_PIPELINE':'true','ALEX_V16_RECONSTRUCTION_ENABLED':'true','ALEX_V16_REVIEW_DRAFTS':'true','SOCIALPLUS_ORIGIN':'https://localhost:4343','SOCIALPLUS_OWNER_ID':'00000000-0000-4000-8000-000000000001','SOCIALPLUS_OWNER_TOTP_SECRET':'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP'}.items():cmd+=['-e',k+'='+v]
cmd+=['--entrypoint','sh','socialplus-preflight:20261104','-c','mkdir -p "$HOME" "$XDG_CACHE_HOME" "$XDG_CONFIG_HOME" && npm run preflight && exec node scripts/alex-ui-smoke.mjs']
start=time.monotonic();samples=[]
with (out/'container.log').open('wb') as log:
 p=subprocess.Popen(cmd,stdout=log,stderr=log)
 while p.poll() is None:
  try:
   data=json.loads(subprocess.check_output(['docker','stats','--no-stream','--format','{{json .}}',name],stderr=subprocess.DEVNULL,timeout=8));data['elapsedSeconds']=time.monotonic()-start;samples.append(data)
  except (subprocess.SubprocessError,json.JSONDecodeError):pass
  if time.monotonic()-start>900:
   subprocess.run(['docker','stop','-t','5',name],stdout=subprocess.DEVNULL);break
  time.sleep(1)
 code=p.wait()
inspection=subprocess.run(['docker','inspect',name],stdout=subprocess.PIPE,stderr=subprocess.DEVNULL)
info=json.loads(inspection.stdout)[0] if inspection.returncode==0 else {}
def mem(s):
 m=re.match(r'([\d.]+)([KMGT]?i?B)',s.strip());return float(m[1])*{'B':1,'kB':1000,'KB':1000,'KiB':1024,'MB':1e6,'MiB':1024**2,'GB':1e9,'GiB':1024**3}.get(m[2],1) if m else 0
metrics={'case':case,'exitCode':code,'elapsedIncludingBrowserSeconds':time.monotonic()-start,'cpuLimit':2,'memoryLimitBytes':8*1024**3,'network':'none','oomKilled':info.get('State',{}).get('OOMKilled',False),'sampledCpuPeakPercent':max([float(x['CPUPerc'].strip('%')) for x in samples] or [0]),'sampledCpuMeanPercent':sum(float(x['CPUPerc'].strip('%')) for x in samples)/max(1,len(samples)),'sampledMemoryPeakBytes':max([mem(x['MemUsage'].split('/')[0]) for x in samples] or [0]),'sampleCount':len(samples),'note':'Docker stats sampled; total includes login, import, two preparation stages, playback, download and restart. Not an OVH benchmark; 100% CPU equals one core.'}
(out/'resources.json').write_text(json.dumps(metrics,indent=2));(out/'resource-samples.json').write_text(json.dumps(samples,indent=2));print(json.dumps(metrics));subprocess.run(['docker','rm',name],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL) if info else None;sys.exit(code)
