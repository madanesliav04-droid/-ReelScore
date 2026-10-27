"""Apply source-bound independent ASR timing proposals, never certify text.

Only identical lexical sequences may split a merged Whisper group. Word
boundaries come from recognizer evidence, never uniform division. Unknown or
contradictory words remain unchanged. All edits keep human review required.
"""
import argparse,copy,hashlib,json,unicodedata,re
from pathlib import Path


def canonical(s):
    return re.sub('[^a-z0-9]','',unicodedata.normalize('NFD',s).encode('ascii','ignore').decode().lower())


def propose(transcript,evidence):
    if not transcript.get('sourceSha256') or transcript['sourceSha256']!=evidence.get('sourceSha256'):
        raise ValueError('Independent alignment source hash mismatch')
    if evidence.get('engine')!='vosk-0.3.45' or evidence.get('model')!='vosk-model-small-fr-0.22':
        raise ValueError('Unexpected independent recognizer evidence')
    original=transcript['words'];v=evidence['words'];out=[];changes=[];held=[];mapping={}
    for index,w in enumerate(original):
        mapping[index]=len(out);tokens=w['text'].split();count=len(tokens)
        prev=original[index-1]['endMs'] if index else 0
        nxt=original[index+1]['startMs'] if index+1<len(original) else 10**9
        matches=[]
        for j in range(len(v)-count+1):
            part=v[j:j+count]
            if [canonical(p['word']) for p in part]!=[canonical(t) for t in tokens]:continue
            if any(not isinstance(p.get('start'),(int,float)) or not isinstance(p.get('end'),(int,float)) or p['end']<=p['start'] for p in part):continue
            if any(part[k]['start']<part[k-1]['end']-.002 for k in range(1,len(part))):continue
            if abs(part[0]['start']*1000-w['startMs'])>450:continue
            if part[-1]['end']*1000<w['startMs'] or part[0]['start']*1000>w['endMs']:continue
            matches.append(part)
        if not matches or (count==1 and w.get('probability',1)>=.75):
            out.append(copy.deepcopy(w))
            if count>1:held.append({'originalWordIndex':index,'text':w['text'],'reason':'NO_IDENTICAL_INDEPENDENT_SEQUENCE'})
            continue
        part=min(matches,key=lambda p:abs(p[0]['start']*1000-w['startMs']))
        if count==1 and part[0].get('conf',0)<.85:
            out.append(copy.deepcopy(w));continue
        proposed=[]
        for k,(token,p) in enumerate(zip(tokens,part)):
            a=max(prev,round(p['start']*1000));b=min(nxt,round(p['end']*1000))
            if k:a=max(a,proposed[-1]['endMs'])
            if b-a<40:proposed=[];break
            if count==1 and round(p['end']*1000)-b>40:proposed=[];break
            row=copy.deepcopy(w);row.update(text=token,startMs=a,endMs=b,originalWordIndex=index,originalAsrText=w['text'],originalAsrStartMs=w['startMs'],originalAsrEndMs=w['endMs'],alignmentReviewRequired=True,timingEvidence={'method':'independent-local-asr-proposal','engine':evidence['engine'],'model':evidence['model'],'startMs':round(p['start']*1000),'endMs':round(p['end']*1000),'uncalibratedConfidence':p.get('conf'),'neighborClamped':a!=round(p['start']*1000) or b!=round(p['end']*1000),'phoneticCertification':False})
            proposed.append(row)
        if not proposed:
            out.append(copy.deepcopy(w))
            if count>1:held.append({'originalWordIndex':index,'text':w['text'],'reason':'UNSAFE_OR_CONTRADICTORY_BOUNDARIES'})
        elif count==1 and proposed[0]['startMs']==w['startMs'] and proposed[0]['endMs']==w['endMs']:
            out.append(copy.deepcopy(w))
        else:
            out.extend(proposed);changes.append({'originalWordIndex':index,'text':w['text'],'before':[w['startMs'],w['endMs']],'proposed':[{'text':p['text'],'startMs':p['startMs'],'endMs':p['endMs']} for p in proposed],'humanVerified':False})
    for a,b in zip(out,out[1:]):
        if a['endMs']>b['startMs']:raise ValueError('Independent proposals overlap a neighboring word')
    result=copy.deepcopy(transcript);warnings=[]
    for warning in result.get('warnings',[]):
        warning=copy.deepcopy(warning)
        if 'wordIndex' in warning:warning['originalWordIndex']=warning['wordIndex'];warning['wordIndex']=mapping[warning['wordIndex']]
        warnings.append(warning)
    result.update(words=out,text=' '.join(w['text'] for w in out),reviewed=False,warnings=warnings,independentAlignment={'method':'source-bound-local-Vosk-proposals-v1','engine':evidence['engine'],'model':evidence['model'],'changes':changes,'heldGroups':held,'humanVerified':False,'notice':'Recognizer agreement is evidence, not proof of exact speech or phonetic boundaries.'})
    return result


if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--source',required=True);p.add_argument('--transcript',required=True);p.add_argument('--evidence',required=True);p.add_argument('--output',required=True);a=p.parse_args()
    t=json.loads(Path(a.transcript).read_text());e=json.loads(Path(a.evidence).read_text())
    h=hashlib.sha256()
    with open(a.source,'rb') as f:
        for b in iter(lambda:f.read(1024*1024),b''):h.update(b)
    if t.get('sourceSha256')!=h.hexdigest():raise ValueError('Transcript does not belong to this actual raw source')
    result=propose(t,e);Path(a.output).write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n');Path(a.output).chmod(0o600)
    print(json.dumps({'proposals':len(result['independentAlignment']['changes']),'heldGroups':len(result['independentAlignment']['heldGroups']),'humanVerified':False}))
