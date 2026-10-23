"""Offline CPU transcription. Model weights must already exist locally.
No video upload, model download, API key or speech synthesis takes place here.
"""
import os,sys,json,hashlib,subprocess
os.environ['HF_HUB_OFFLINE']='1'
os.environ['HF_HUB_DISABLE_TELEMETRY']='1'
from pathlib import Path
module_dir=os.environ.get('SOCIALPLUS_ASR_MODULE_DIR')
if module_dir:sys.path.insert(0,module_dir)

def normalize_words(raw,duration_ms):
    words=[];warnings=[];pending=None
    for word in raw:
        text=word['text'].strip()
        if not text:continue
        start=max(0,round(word['start']*1000));end=min(duration_ms,round(word['end']*1000))
        probability=float(word['probability'])
        if not any(c.isalnum() for c in text):
            if words and text in [',','.','!','?',':',';']:words[-1]['text']+=text
            continue
        if pending:
            text=pending['text']+('' if text.startswith(("'",'’')) else ' ')+text
            start=min(start,pending['startMs']);probability=min(probability,pending['probability']);pending=None
            warnings.append({'code':'MERGED_ASR_PIECE','wordIndex':len(words)})
        if end<=start:
            pending={'text':text,'startMs':start,'probability':probability};continue
        if words and text.startswith(("'",'’','-')):
            words[-1]['text']+=text;words[-1]['endMs']=max(words[-1]['endMs'],end)
            words[-1]['probability']=min(words[-1]['probability'],probability)
            continue
        if words:start=max(start,words[-1]['endMs'])
        if end<=start:
            warnings.append({'code':'UNTIMED_WORD','text':text});continue
        words.append({'text':text,'startMs':start,'endMs':end,'probability':probability})
        if probability<.75:warnings.append({'code':'LOW_CONFIDENCE','wordIndex':len(words)-1})
    if pending:warnings.append({'code':'UNTIMED_WORD','text':pending['text']})
    return words,warnings

def main(source):
    import numpy as np
    from faster_whisper import WhisperModel,__version__ as whisper_version
    model_dir=Path(os.environ['SOCIALPLUS_ASR_MODEL_DIR']).resolve()
    if not all((model_dir/name).is_file() for name in ['model.bin','config.json','tokenizer.json']):raise RuntimeError('Modèle ASR local absent ou incomplet.')
    digest=hashlib.sha256()
    with open(model_dir/'model.bin','rb') as f:
        for block in iter(lambda:f.read(1024*1024),b''):digest.update(block)
    # Decode with the same local FFmpeg used by the editor. This also avoids
    # the PyAV metadata_errors incompatibility affecting recent PyAV wheels.
    pcm=subprocess.run(['ffmpeg','-v','error','-nostdin','-protocol_whitelist','file,pipe','-format_whitelist','mov,matroska,webm,avi,mpegts,ogg','-i',source,'-map','0:a:0','-vn','-ac','1','-ar','16000','-t','600','-f','f32le','pipe:1'],check=True,stdout=subprocess.PIPE,stderr=subprocess.PIPE,timeout=60).stdout
    audio=np.frombuffer(pcm,dtype='<f4');duration_ms=round(len(audio)/16)
    model=WhisperModel(str(model_dir),device='cpu',compute_type='int8',cpu_threads=4,local_files_only=True)
    segments,info=model.transcribe(audio,language='fr',beam_size=5,word_timestamps=True,condition_on_previous_text=False,vad_filter=False,temperature=0)
    raw=[];text=[]
    for segment in segments:
        text.append(segment.text.strip())
        raw.extend({'text':w.word,'start':w.start,'end':w.end,'probability':w.probability} for w in segment.words)
    words,warnings=normalize_words(raw,duration_ms)
    print(json.dumps({'engineVersion':'faster-whisper-'+whisper_version+'-cpu-int8-beam5-fr-v1','modelSha256':digest.hexdigest(),'language':info.language,'text':' '.join(text),'words':words,'warnings':warnings,'reviewed':False,'timingMethod':'whisper_word_timestamps','notice':'Transcription automatique locale à relire et écouter. Les horaires Whisper ne constituent pas un alignement phonétique indépendant certifié.'},ensure_ascii=False))

if __name__=='__main__':main(sys.argv[1])
