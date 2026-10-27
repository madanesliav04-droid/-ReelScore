#!/usr/bin/env python3
"""Actual same-timeline frame comparison. Metrics are NOT a quality score."""
import argparse
import hashlib
import json
from pathlib import Path
import subprocess
import numpy as np
from PIL import Image
from render import probe, read_frame


def audio_hash(path):
    p=subprocess.Popen(['ffmpeg','-v','error','-i',str(path),'-map','0:a:0','-c:a','copy','-f','adts','-'],stdout=subprocess.PIPE,stderr=subprocess.PIPE)
    h=hashlib.sha256()
    for b in iter(lambda:p.stdout.read(1024*1024),b''):h.update(b)
    if p.wait()!=0:raise RuntimeError('Audio extraction failed')
    return h.hexdigest()


def compare(reference, result, plan_path, directory):
    directory=Path(directory);directory.mkdir(parents=True,exist_ok=True)
    plan=json.loads(Path(plan_path).read_text())
    metas=[probe(path) for path in [reference,result]]
    vs=[next(s for s in m['streams'] if s['codec_type']=='video') for m in metas]
    if any((v['width'],v['height'])!=(910,512) for v in vs):raise ValueError('Reference comparator is 910x512 only')
    decoders=[subprocess.Popen(['ffmpeg','-v','error','-i',str(p),'-map','0:v:0','-f','rawvideo','-pix_fmt','rgb24','-'],stdout=subprocess.PIPE) for p in [reference,result]]
    samples=[];outside=[];i=0
    snapshot_times=[10,22,32]
    try:
        while True:
            frames=[read_frame(p.stdout,910*512*3) for p in decoders]
            if not any(frames):break
            if not all(frames):raise RuntimeError('Frame counts differ')
            a,b=[np.frombuffer(f,np.uint8).reshape(512,910,3).astype(np.int16) for f in frames]
            t=i/30;scene=next((s for s in plan['scenes'] if s['start']-1e-8<=t<s['end']-1e-8),None)
            if scene:
                aa,bb=a[:440],b[:440];mae=float(np.mean(np.abs(aa-bb)))
                # foreground-only masks expose misplaced text rather than hiding
                # differences behind the large, almost identical background.
                dark=[im.max(2)<140 for im in [aa,bb]]
                blue=[(im[:,:,2]-im[:,:,0]>25)&(im[:,:,0]<190)&(im[:,:,1]<195) for im in [aa,bb]]
                def iou(m):return float(np.sum(m[0]&m[1])/max(1,np.sum(m[0]|m[1])))
                samples.append({'frame':i,'scene':scene['kind'],'rgbMAE':mae,'darkInkIoU':iou(dark),'blueInkIoU':iou(blue)})
            else:outside.append(float(np.mean(np.abs(a-b))))
            if any(abs(t-st)<.001 for st in snapshot_times):
                Image.fromarray(np.concatenate([a,b],axis=1).astype(np.uint8)).save(directory/f'comparison-{round(t)}s.png')
            i+=1
        if any(p.wait()!=0 for p in decoders):raise RuntimeError('Comparison decoding failed')
    finally:
        for p in decoders:
            if p.poll() is None:p.kill();p.wait()
    result_audio=audio_hash(result);ref_audio=audio_hash(reference)
    report={'scope':'Same-reference reconstruction; not new-rush or phonetic validation','framesCompared':i,'graphicFramesCompared':len(samples),'graphicsCrop':[0,0,910,440],'audioAACBitstreamIdentical':result_audio==ref_audio,'audioSha256':result_audio,'outsideScenesMeanRGBError':float(np.mean(outside)),'scenes':[]}
    for kind in ['question','value','chain']:
        s=[x for x in samples if x['scene']==kind]
        report['scenes'].append({'kind':kind,'frames':len(s),'meanRGBError':float(np.mean([x['rgbMAE'] for x in s])),'meanDarkInkIoU':float(np.mean([x['darkInkIoU'] for x in s])),'meanBlueInkIoU':float(np.mean([x['blueInkIoU'] for x in s])),'worstRGBError':max(x['rgbMAE'] for x in s)})
    (directory/'comparison.json').write_text(json.dumps(report,indent=2)+'\n')
    (directory/'frame-measurements.json').write_text(json.dumps(samples,indent=2)+'\n')
    return report


if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--reference',required=True);p.add_argument('--result',required=True);p.add_argument('--plan',required=True);p.add_argument('--directory',required=True)
    a=p.parse_args();print(json.dumps(compare(a.reference,a.result,a.plan,a.directory),indent=2))
