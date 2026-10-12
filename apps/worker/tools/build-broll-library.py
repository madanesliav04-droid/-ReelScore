import json,os,re,html,urllib.request,urllib.parse,subprocess,hashlib,time
from pathlib import Path
out=Path('broll_library');clips=out/'clips';clips.mkdir(parents=True,exist_ok=True)
cats={'interaction':['mobile','working'],'execution':['laptop','writing'],'business':['business','office'],'finance':['money'],'ambience':['city','coffee'],'collaboration':['meeting']}
all_items={};ua={'User-Agent':'Mozilla/5.0'}
for intent,slugs in cats.items():
 for slug in slugs:
  page='https://mixkit.co/free-stock-video/'+slug+'/'
  try:
   req=urllib.request.Request(page,headers=ua)
   body=html.unescape(urllib.request.urlopen(req,timeout=40).read().decode('utf-8','replace')).replace('\\/','/')
   links=re.findall(r'(?:href=["\x27]|https://mixkit.co)(/?free-stock-video/[^"<> \x27]+-\d+/)',body)
   if not links: links=re.findall(r'(/free-stock-video/[^"<> ]+-\d+/)',body)
   print('found',slug,len(links))
   for uri in links[:34]:
    uri=uri if uri.startswith('/') else '/'+uri
    found=re.search(r'-([0-9]+)/$',uri)
    if not found:continue
    vid=found.group(1);title=re.sub(r'-[0-9]+/$','',uri.rsplit('/',1)[-1])
    title=uri.strip('/').split('/')[-1].rsplit('-',1)[0].replace('-',' ')
    if vid not in all_items:
     all_items[vid]={'id':'MX-'+vid,'provider':'Mixkit','source_url':'https://mixkit.co'+uri,'title':title,'intent':[intent],'categories':[slug],'keywords':list(dict.fromkeys(slug.replace('-',' ').split()+title.split())),'status':'reference_discovered','asset_path':None,'license_note':'Verify specific clip Mixkit license before production use','duration_sec':None,'width':None,'height':None,'sha256':None}
    else:
     it=all_items[vid]
     if intent not in it['intent']:it['intent'].append(intent)
     if slug not in it['categories']:it['categories'].append(slug)
  except Exception as e:print('PAGE_ERROR',slug,str(e)[:160])
# Known good, verified downloaded from the original user workflow.
for vid,intent in [('4908','interaction'),('41165','interaction')]:
 if vid not in all_items:
  slug='person-working-while-scrolling-on-social-networks' if vid=='4908' else 'man-answering-a-whatsapp'
  all_items[vid]={'id':'MX-'+vid,'provider':'Mixkit','source_url':'https://mixkit.co/free-stock-video/'+slug+'-'+vid+'/','title':slug.replace('-',' '),'intent':[intent],'categories':['mobile'],'keywords':slug.split('-'),'status':'reference_discovered','asset_path':None,'license_note':'Verify specific clip Mixkit license before production use','duration_sec':None,'width':None,'height':None,'sha256':None}
# Do not invent a hundred video records if the live page failed.
items=list(all_items.values())
if len(items)<100:raise RuntimeError('Less than 100 unique official page links were discovered: '+str(len(items)))
items=items[:120]
print('catalog_discovered',len(items))
# Full library is discoverable; only downloaded and probed clips become asset_ready.
quota={x:0 for x in cats};selected=[]
for intent in cats:
 for item in items:
  if intent in item['intent'] and quota[intent]<5 and item not in selected:
   selected.append(item);quota[intent]+=1
# Include two editorially relevant known assets in this new export.
for vid in ('4908','41165'):
 item=all_items[vid]
 if item not in selected:selected.append(item)
budget=105_000_000;total_bytes=0;success=0
for item in selected:
 vid=item['id'][3:]
 try:
  url=item['source_url'];body=html.unescape(urllib.request.urlopen(urllib.request.Request(url,headers=ua),timeout=40).read().decode('utf-8','replace')).replace('\\/','/')
  # URL must occur in the original provider page; do not guess a file from an item ID.
  options=re.findall(r'https?://assets\.mixkit\.co/videos/\d+/\d+-(?:720|1080)\.mp4',body)
  options=sorted(set(options),key=lambda z:(0 if '-720.mp4' in z else 1))
  if not options:
   print('NO_DOWNLOAD_LINK_IN_HTML',vid);continue
  data=None
  for direct in options:
   try:
    req=urllib.request.Request(direct,headers={**ua,'Referer':url})
    payload=urllib.request.urlopen(req,timeout=45).read()
    if payload[4:8]!=b'ftyp' or len(payload)<100000:continue
    if total_bytes+len(payload)>budget:print('BUDGET_LIMIT',vid);break
    data=payload;break
   except Exception as e:print('DOWNLOAD_FAIL',vid,str(e)[:90])
  if not data:continue
  filename='MX-'+vid+'.mp4';path=clips/filename;path.write_bytes(data)
  pr=subprocess.run(['ffprobe','-v','error','-print_format','json','-show_entries','format=duration:stream=width,height,codec_type',str(path)],capture_output=True,text=True,timeout=20)
  if pr.returncode:raise RuntimeError(pr.stderr[:120])
  meta=json.loads(pr.stdout)
  v=next((s for s in meta['streams'] if s['codec_type']=='video'),None)
  if not v or not float(meta['format']['duration']):raise RuntimeError('No video stream')
  item.update(status='asset_ready',asset_path='clips/'+filename,duration_sec=round(float(meta['format']['duration']),2),width=v['width'],height=v['height'],sha256=hashlib.sha256(data).hexdigest(),license_note='Mixkit Stock Video Free License — source page documented')
  total_bytes+=len(data);success+=1;print('READY',vid,len(data),item['duration_sec'],v['width'],v['height'])
 except Exception as e:print('FAILED',vid,str(e)[:120])
(out/'catalog.json').write_text(json.dumps({'version':1,'provider':'Mixkit','generated_utc':__import__('datetime').datetime.now(__import__('datetime').timezone.utc).isoformat(),'totals':{'references':len(items),'assets_ready':success,'bytes':total_bytes},'items':items},indent=2,ensure_ascii=False))
(out/'README.txt').write_text('Viral Studio Edit+ B-roll library. References are verified source page links, not downloaded clips. Only items status=asset_ready have FFprobe-verified mp4 bytes and SHA256. Pinterest is for visual inspiration, not an automatic asset source.\n')
print('FINAL',len(items),success,total_bytes)
