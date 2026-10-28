"""Local targeted ASR evidence for Cinematic. Never confirms or rewrites words.
Usage: python review_cinematic_words.py SOURCE PLAN.json PRIVATE_REVIEW_DIR
Requires the existing offline faster-whisper environment, not a paid service.
"""
import os,sys,json,hashlib,subprocess,difflib,re
from pathlib import Path
os.environ['HF_HUB_OFFLINE']='1';os.environ['HF_HUB_DISABLE_TELEMETRY']='1'
if os.environ.get('SOCIALPLUS_ASR_MODULE_DIR'):sys.path.insert(0,os.environ['SOCIALPLUS_ASR_MODULE_DIR'])
def normalized(text):return re.sub(r'[^\w]', '',text.casefold(),flags=re.UNICODE)
def candidates_for(text,raw,start,end):
    wanted=[normalized(t) for t in text.split()];matches=[]
    for i in range(len(raw)-len(wanted)+1):
        group=raw[i:i+len(wanted)]
        if [normalized(w['text']) for w in group]!=wanted:continue
        if not all(w['endMs']>w['startMs'] for w in group):continue
        if any(group[j]['startMs']<group[j-1]['endMs'] for j in range(1,len(group))):continue
        if abs((group[0]['startMs']+group[-1]['endMs'])-(start+end))>400:continue
        if group[-1]['endMs']<start-80 or group[0]['startMs']>end+80:continue
        matches.append(group)
    return min(matches,key=lambda g:abs((g[0]['startMs']+g[-1]['endMs'])-(start+end))) if matches else None

def contextual_disagreements(words,windows,indices,duration_ms):
    result=[]
    for window in windows:
        old=[(i,w) for i,w in enumerate(words) if w['endMs']>window['startMs'] and w['startMs']<window['endMs']]
        # Compare lexical characters so apostrophe/token splitting alone never
        # creates a false word error. Crop-edge disagreements are held out.
        chars=[(ch,i) for i,w in old for ch in normalized(w['text'])]
        new=''.join(normalized(w['text']) for w in window['words'])
        matcher=difflib.SequenceMatcher(a=''.join(ch for ch,i in chars),b=new,autojunk=False)
        for op,a,b,c,d in matcher.get_opcodes():
            if op=='equal':continue
            ids=sorted(set(i for ch,i in chars[a:b]))
            anchors=ids or sorted(set(chars[j][1] for j in [a-1,a] if 0<=j<len(chars)))
            if not anchors:continue
            lo=min(words[i]['startMs'] for i in anchors);hi=max(words[i]['endMs'] for i in anchors)
            if window['startMs']>0 and lo<window['startMs']+500:continue
            if window['endMs']<duration_ms-100 and hi>window['endMs']-500:continue
            result.append({'initialIndices':ids,'anchorIndices':anchors,'originalText':' '.join(words[i]['text'] for i in ids),'changedCharactersHypothesis':new[c:d],'sourceStartMs':lo,'sourceEndMs':hi,'sourceWindow':[window['startMs'],window['endMs']],'outsideInitialFlags':[i for i in ids if i not in indices],'status':'unconfirmed_contextual_disagreement'})
    return result

def main(source,plan_file,destination):
    import numpy as np
    from faster_whisper import WhisperModel,__version__
    plan=json.loads(Path(plan_file).read_text());source=Path(source);out=Path(destination);out.mkdir(parents=True,exist_ok=True,mode=0o700)
    assert hashlib.sha256(source.read_bytes()).hexdigest()==plan['sourceSha256'],'Source hash mismatch'
    words=plan['transcript'];indices=[i for i,w in enumerate(words) if w.get('reviewRequired') and not w.get('confirmed')]
    windows=[]
    for i in indices:
        w=words[i];a=max(0,w['startMs']-1000);b=min(round(plan['keepRanges'][-1]['endMs']),w['endMs']+1000)
        if windows and a<=windows[-1]['endMs']+300:windows[-1]['endMs']=max(b,windows[-1]['endMs']);windows[-1]['indices'].append(i)
        else:windows.append({'startMs':a,'endMs':b,'indices':[i]})
    model=WhisperModel(os.environ['SOCIALPLUS_ASR_MODEL_DIR'],device='cpu',compute_type='int8',cpu_threads=4,local_files_only=True)
    for wi,window in enumerate(windows):
        data=subprocess.check_output(['ffmpeg','-v','error','-ss',str(window['startMs']/1000),'-t',str((window['endMs']-window['startMs'])/1000),'-i',str(source),'-map','0:a:0','-ac','1','-ar','16000','-f','f32le','pipe:1'])
        segments,info=model.transcribe(np.frombuffer(data,dtype='<f4'),language='fr',beam_size=5,word_timestamps=True,temperature=0,condition_on_previous_text=False,vad_filter=False)
        raw=[];texts=[]
        for s in segments:
            texts.append(s.text.strip())
            raw.extend({'text':w.word.strip(),'startMs':window['startMs']+round(w.start*1000),'endMs':window['startMs']+round(w.end*1000),'probability':w.probability} for w in s.words)
        window.update(hypothesis=' '.join(texts),words=raw)
        print('ASR_WINDOW',wi,window['startMs'],window['endMs'],flush=True)
    records=[]
    for i in indices:
        w=words[i];window=next(t for t in windows if i in t['indices']);mapped=plan['mappedWords'][i]
        rec={'initialWordIndex':i,'initialText':w['text'],'sourceStartMs':w['startMs'],'sourceEndMs':w['endMs'],'outputStartMs':mapped['outputStartMs'],'outputEndMs':mapped['outputEndMs'],'initialProbability':w.get('probability'),'context':' '.join(x['text'] for x in words[max(0,i-3):i+4]),'contextWindow':[window['startMs'],window['endMs']],'contextualHypothesis':window['hypothesis'],'timingCandidates':candidates_for(w['text'],window['words'],w['startMs'],w['endMs']),'resolution':'pending_human_listening','humanListeningVerified':False,'automaticallyConfirmed':False}
        clip=f'word-{i:03d}-{w["startMs"]}ms.mp3';a=max(0,w['startMs']-800);b=min(plan['keepRanges'][-1]['endMs'],w['endMs']+800)
        subprocess.run(['ffmpeg','-v','error','-y','-ss',str(a/1000),'-t',str((b-a)/1000),'-i',str(source),'-map','0:a:0','-c:a','libmp3lame','-b:a','128k',str(out/clip)],check=True)
        rec.update(clip=clip,clipSourceStartMs=a,targetOffsetInClipMs=w['startMs']-a);records.append(rec)
    discrepancies=contextual_disagreements(words,windows,indices,plan['keepRanges'][-1]['endMs'])
    report={'sourceSha256':plan['sourceSha256'],'engineVersion':'faster-whisper-'+__version__+'-targeted-context','independentRecognizer':False,'humanListeningAvailable':False,'automaticConfirmations':0,'initialFlagCount':len(indices),'records':records,'windows':windows,'additionalDisagreements':discrepancies,'notice':'Repeated recognition with the same local model is only a hypothesis, not human listening or independent phonetic validation. No original word or timing was rewritten.'}
    path=out/'word-review.json';path.write_text(json.dumps(report,ensure_ascii=False,indent=2));path.chmod(0o600)
    print('REVIEW_REPORT',path,flush=True)
if __name__=='__main__':main(*sys.argv[1:])
