"""Decoded-pixel + original-audio QA. Not independent phonetic alignment."""
import argparse,json,subprocess,sys,hashlib,math
from pathlib import Path
import numpy as np
from PIL import Image,ImageDraw
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'reconstruction/alex-v16'))
from captions import caption_layout
from render import probe,read_frame


def audio_hash(path):
    p=subprocess.Popen(['ffmpeg','-v','error','-i',str(path),'-map','0:a:0','-c:a','copy','-f','adts','-'],stdout=subprocess.PIPE)
    h=hashlib.sha256()
    for b in iter(lambda:p.stdout.read(1024*1024),b''):h.update(b)
    if p.wait():raise RuntimeError('Audio extraction failed')
    return h.hexdigest()


def main(workdir,source=None):
    root=Path(workdir);plan=json.loads((root/'alex-plan.json').read_text());result=json.loads((root/'alex-result.json').read_text());transcript=json.loads((root/'alex-transcript.json').read_text())
    assert [w['text'] for w in plan['words']]==[w['text'] for w in transcript['words']]
    video=Path(result['outputPath']);meta=probe(video);vs=[s for s in meta['streams'] if s['codec_type']=='video'];audio=[s for s in meta['streams'] if s['codec_type']=='audio'];assert len(vs)==len(audio)==1
    original=Path(source) if source else root/'imported.mov'
    source_meta=probe(original);source_v=next(s for s in source_meta['streams'] if s['codec_type']=='video')
    v=vs[0];width,height=v['width'],v['height'];assert (width,height)==(source_v['width'],source_v['height']) and v['codec_name']=='h264' and audio[0]['codec_name']=='aac'
    words=plan['words'];targets={};coverage=[0]*len(words);first=[None]*len(words)
    unrepresentable=[]
    for i,w in enumerate(words):
        first_frame=math.ceil(w['start']*30-1e-8);last_frame=math.ceil(w['end']*30-1e-8)-1
        if first_frame>last_frame:unrepresentable.append(i)
        else:targets.setdefault((first_frame+last_frame)//2,[]).append(i)
    p=subprocess.Popen(['ffmpeg','-v','error','-i',str(video),'-f','rawvideo','-pix_fmt','rgb24','-'],stdout=subprocess.PIPE)
    blue=[];frame=0;pngs=[]
    while True:
        data=read_frame(p.stdout,width*height*3)
        if not data:break
        t=frame/30;im=Image.frombytes('RGB',(width,height),data);layout=caption_layout(im,words,t)
        if layout and layout['active'] is not None:
            i=layout['active'];coverage[i]+=1
            if first[i] is None:first[i]=t
        for index in targets.get(frame,[]):
            assert layout and layout['active']==index
            mask=Image.new('L',(width,height));d=ImageDraw.Draw(mask);f=layout['font'];i=index
            row,line=next((row,line) for row,line in enumerate(layout['lines']) if i in line)
            full=' '.join(words[k]['text'] for k in line);prefix=' '.join(words[k]['text'] for k in line[:line.index(i)])
            x=(width-d.textlength(full,font=f))/2+(d.textlength(prefix+' ',font=f) if prefix else 0);y=layout['top']+row*(layout['size']+6)
            d.text((x,y),words[i]['text'],font=f,fill=255,anchor='lt')
            a=np.array(im).astype(int);m=np.array(mask)>200
            ratio=float(np.mean((a[:,:,2]-a[:,:,0]>25)[m]));blue.append({'wordIndex':i,'frame':frame,'blueGlyphFraction':ratio})
        if frame in [30,90,210,330,516,744,783,900,1170]:
            name=f'raw-render-{frame}.png';im.save(root/name);pngs.append(name)
        frame+=1
    assert p.wait()==0 and frame==int(v['nb_frames'])
    low_blue=[x for x in blue if x['blueGlyphFraction']<=.6]
    late=max(first[i]-w['start'] for i,w in enumerate(words) if first[i] is not None);assert -.00001<=late<1/30+.0001
    src=audio_hash(original);dst=audio_hash(video)
    retained=audio_hash(root/'alex-prepared.mp4') if plan['removedRanges'] else src
    assert retained==dst
    report={'scope':'Real decoded MP4 word highlights versus ASR plan, not phonetic truth','framesDecoded':frame,'wordCount':len(words),'wordsActuallyHighlighted':sum(n>0 for n in coverage),'unrepresentableIntervals':unrepresentable,'multiTokenGroups':[i for i,w in enumerate(words) if ' ' in w['text']],'allGlyphChecksPassed':not low_blue and not unrepresentable,'lowBlueGlyphs':low_blue,'glyphPixelChecks':len(blue),'minimumBlueGlyphFraction':min(x['blueGlyphFraction'] for x in blue),'maximumFrameQuantizationSeconds':late,'originalAACBitstreamIdentical':src==dst,'retainedOriginalAudioIdentical':retained==dst,'audioSha256':dst,'audioTracks':len(audio),'sourceDuration':source_meta['format']['duration'],'outputDuration':meta['format']['duration'],'cuts':len(plan['removedRanges']),'cutsReason':'No measured long inter-sentence pause justified deletion' if not plan['removedRanges'] else 'Measured inter-sentence gaps only','transcriptionReviewed':transcript['reviewed'],'uncertainWords':plan['issues'],'phoneticAlignmentCertified':False,'referenceUsed':False,'screenshots':pngs}
    (root/'raw-video-qa.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps({k:v for k,v in report.items() if k!='uncertainWords'},indent=2))


if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('workdir');p.add_argument('--source');a=p.parse_args();main(a.workdir,a.source)
