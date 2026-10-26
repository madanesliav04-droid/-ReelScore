#!/usr/bin/env python3
"""Explicit-plan compositor, isolated from all six approved engines.

Reference QA can retain the reference's existing caption strip, ONLY for a
hash-bound reference plan. This is a reconstruction test, not new-rush proof.
Ordinary plans require independently verified captions and never read a master.
"""
import argparse
import hashlib
import json
import math
import os
from pathlib import Path
import subprocess
import tempfile
import time
from fractions import Fraction
from PIL import Image
from scenes import native_scene


def probe(path):
    return json.loads(subprocess.check_output(['ffprobe','-v','error','-show_streams','-show_format','-of','json',str(path)]))


def digest(path):
    h=hashlib.sha256()
    with open(path,'rb') as f:
        for chunk in iter(lambda:f.read(1024*1024),b''): h.update(chunk)
    return h.hexdigest()


def validate(plan, duration, reference_qa, source_sha, review_draft=False):
    if plan.get('schemaVersion') != 1 or not isinstance(plan.get('scenes'),list) or not plan['scenes']:
        raise ValueError('An explicit, nonempty scene plan is required')
    if reference_qa:
        if plan.get('purpose')!='reference-reconstruction-qa' or plan.get('referenceSha256')!=source_sha:
            raise ValueError('Reference QA requires the exact hash-bound master, never a new rush')
    elif plan.get('purpose')=='reference-reconstruction-qa':
        raise ValueError('Historical reference timings cannot be applied to a new rush')
    else:
        # This compositor does not claim to perform transcription/alignment itself.
        words=plan.get('words')
        verified=plan.get('wordVerification')=='human-confirmed'
        draft=review_draft and plan.get('wordVerification')=='automatic-needs-review' and plan.get('reviewRequired') is True
        if not (verified or draft) or not isinstance(words,list) or not words:
            raise ValueError('New-rush use requires confirmed timed words; no invented transcript')
        end=0.
        for w in words:
            a,b=w.get('start'),w.get('end')
            if not isinstance(a,(int,float)) or not isinstance(b,(int,float)) or not math.isfinite(a+b) or a<end or b<=a or b>duration or not str(w.get('text','')).strip():
                raise ValueError('Invalid or overlapping word boundaries')
            end=b
    end=0.
    for s in plan['scenes']:
        a,b=s.get('start'),s.get('end')
        if not isinstance(a,(int,float)) or not isinstance(b,(int,float)) or not math.isfinite(a+b) or a<end or b<=a or b>duration+0.001:
            raise ValueError('Invalid/overlapping scene intervals')
        if s.get('kind') not in ('question','value','chain'):
            raise ValueError('Only the three reconstructed infographics are supported')
        if not isinstance(s.get('text'),dict) or not isinstance(s.get('cues'),dict):
            raise ValueError('Scene text and measured cues required')
        text,cues=s['text'],s['cues']
        for field in ['chapter','title','conclusion']:
            if not isinstance(text.get(field),str) or not text[field].strip() or len(text[field])>100:
                raise ValueError('Scene wording must be explicit and bounded')
        size=3 if s['kind']=='chain' else 2
        if not isinstance(text.get('labels'),list) or len(text['labels'])!=size or any(not isinstance(t,str) or not t.strip() or len(t)>45 for t in text['labels']):
            raise ValueError('Explicit node labels required')
        if s['kind']!='chain' and (not isinstance(text.get('symbols'),list) or len(text['symbols'])!=2 or any(not isinstance(t,str) or not t or len(t)>3 for t in text['symbols'])):
            raise ValueError('Explicit paired symbols required')
        fields=['arrowDuration','calloutStart','calloutDuration']+([] if s['kind']=='chain' else ['rightHighlight','arrowStart'])
        for field in fields:
            value=cues.get(field)
            if not isinstance(value,(int,float)) or not math.isfinite(value) or value<0 or (field.endswith('Duration') and value<=0):
                raise ValueError('Finite, nonnegative cue times and positive durations required')
        if s['kind']=='chain':
            for field,size in [('nodeStarts',3),('arrowStarts',2)]:
                times=cues.get(field)
                if not isinstance(times,list) or len(times)!=size or any(not isinstance(t,(int,float)) or not math.isfinite(t) or t<0 for t in times) or times!=sorted(times) or (field=='nodeStarts' and times[0]!=0):
                    raise ValueError('Explicit ordered node/arrow starts required')
        end=b


def read_frame(stream, size):
    chunks=[]; left=size
    while left:
        chunk=stream.read(left)
        if not chunk: break
        chunks.append(chunk);left-=len(chunk)
    data=b''.join(chunks)
    if data and len(data)!=size: raise RuntimeError('Truncated video decoder frame')
    return data


def run(source, plan_path, output, reference_qa=False, review_draft=False):
    started=time.monotonic()
    source=Path(source).resolve(); output=Path(output).resolve()
    if source==output or output.exists(): raise ValueError('Output must be a new file; no existing video is overwritten')
    meta=probe(source); video=[s for s in meta['streams'] if s['codec_type']=='video']
    audio=[s for s in meta['streams'] if s['codec_type']=='audio']
    if len(video)!=1 or len(audio)>1: raise ValueError('Expected one video and at most one original audio track')
    v=video[0]; width,height=v['width'],v['height']
    rotations=[d.get('rotation',0) for d in v.get('side_data_list',[])]+[v.get('tags',{}).get('rotate',0)]
    if any(float(r)!=0 for r in rotations): raise ValueError('Normalize display rotation with the existing native-frame pipeline first')
    if width%2 or height%2: raise ValueError('H.264 yuv420p requires even native dimensions; no silent crop')
    fps=Fraction(v['avg_frame_rate']);duration=float(v.get('duration',meta['format']['duration']))
    if abs(float(fps)-float(Fraction(v['r_frame_rate'])))>0.001:
        raise ValueError('Variable-rate source must be normalized by the existing pipeline')
    plan=json.loads(Path(plan_path).read_text());sha=digest(source)
    validate(plan,duration,reference_qa,sha,review_draft)
    if reference_qa and (width,height,float(fps))!=(910,512,30.):
        raise ValueError('Reference measurement applies only to 910x512 at 30 fps')
    output.parent.mkdir(parents=True,exist_ok=True)
    fd,tmp=tempfile.mkstemp(prefix='.alex-reconstruction-',suffix='.mp4',dir=output.parent);os.close(fd)
    dec=enc=None
    try:
        with tempfile.TemporaryFile() as dec_log, tempfile.TemporaryFile() as enc_log:
            dec=subprocess.Popen(['ffmpeg','-v','error','-noautorotate','-i',str(source),'-map','0:v:0','-f','rawvideo','-pix_fmt','rgb24','-'],stdout=subprocess.PIPE,stderr=dec_log)
            command=['ffmpeg','-v','error','-y','-f','rawvideo','-pix_fmt','rgb24','-s',f'{width}x{height}','-r',str(fps),'-i','-','-i',str(source),'-map','0:v:0']
            if audio: command+=['-map','1:a:0']
            command+=['-c:v','libx264','-preset','fast','-crf','17','-pix_fmt','yuv420p','-threads','2']
            if audio: command+=['-c:a','copy' if audio[0]['codec_name']=='aac' else 'aac']
            command+=['-map_metadata','-1','-movflags','+faststart',tmp]
            enc=subprocess.Popen(command,stdin=subprocess.PIPE,stderr=enc_log)
            count=changed=0
            while True:
                data=read_frame(dec.stdout,width*height*3)
                if not data:break
                t=float(Fraction(count,1)/fps)
                scene=next((s for s in plan['scenes'] if s['start']-1e-8<=t<s['end']-1e-8),None)
                if scene:
                    im=native_scene(scene,t-scene['start'],width,height)
                    if reference_qa:
                        # Preserve pre-existing subtitles, not model-specific graphics.
                        original=Image.frombytes('RGB',(width,height),data)
                        im.paste(original.crop((0,440,width,height)),(0,440))
                    else:
                        from captions import draw_caption
                        draw_caption(im,plan['words'],t)
                    data=im.tobytes();changed+=1
                elif not reference_qa:
                    from captions import draw_caption
                    im=Image.frombytes('RGB',(width,height),data)
                    draw_caption(im,plan['words'],t,on_graphic=False)
                    data=im.tobytes()
                enc.stdin.write(data);count+=1
                if count%30==0:print(f'ALEX_PROGRESS {count}/{round(duration*float(fps))}',file=__import__('sys').stderr,flush=True)
            enc.stdin.close()
            if dec.wait()!=0 or enc.wait()!=0:
                raise RuntimeError('FFmpeg failed; no successful output published')
        final=probe(tmp);fv=next(s for s in final['streams'] if s['codec_type']=='video');fa=[s for s in final['streams'] if s['codec_type']=='audio']
        if fv['codec_name']!='h264' or (fv['width'],fv['height'])!=(width,height) or len(fa)!=len(audio) or (fa and fa[0]['codec_name']!='aac') or abs(float(final['format']['duration'])-duration)>.15 or int(fv.get('nb_frames',count))!=count:
            raise RuntimeError('Export metadata validation failed')
        subprocess.run(['ffmpeg','-v','error','-i',tmp,'-f','null','-'],check=True,stderr=subprocess.PIPE)
        os.replace(tmp,output)
        report={'status':'RECONSTRUCTION_REQUIRES_REVIEW','referenceQA':reference_qa,'newRushValidated':False,'originalEngineModified':False,'referencePixelsUsedForGraphics':False,'existingCaptionStripPreserved':reference_qa,'width':width,'height':height,'fps':str(fps),'frames':count,'regeneratedGraphicFrames':changed,'duration':float(final['format']['duration']),'audioStreams':len(fa),'fullDecode':True,'elapsedSeconds':round(time.monotonic()-started,3),'bytes':output.stat().st_size,'sha256':digest(output),'sourceSha256':sha}
        report.update(newRushTechnicalExport=not reference_qa,transcriptionReviewed=plan.get('wordVerification')=='human-confirmed',reviewDraft=review_draft,reviewRequired=True)
        output.with_suffix('.qa.json').write_text(json.dumps(report,indent=2)+'\n')
        return report
    finally:
        for p in [dec,enc]:
            if p and p.poll() is None:p.kill();p.wait()
        Path(tmp).unlink(missing_ok=True)


if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--input',required=True);p.add_argument('--plan',required=True);p.add_argument('--output',required=True)
    p.add_argument('--reference-qa',action='store_true')
    p.add_argument('--review-draft',action='store_true',help='Unreviewed ASR draft only; words never marked confirmed')
    a=p.parse_args();print(json.dumps(run(a.input,a.plan,a.output,a.reference_qa,a.review_draft),indent=2))
