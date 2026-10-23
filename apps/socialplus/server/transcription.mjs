import {existsSync,statSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';

export function transcriptionKey(){
 const dir=process.env.SOCIALPLUS_ASR_MODEL_DIR;
 if(!dir||!['model.bin','config.json','tokenizer.json'].every(name=>existsSync(join(dir,name))))return null;
 const file=statSync(join(dir,'model.bin'));
 return createHash('sha256').update(JSON.stringify(['local-whisper-v2',dir,file.size,file.mtimeMs,process.env.SOCIALPLUS_ASR_PYTHON,process.env.SOCIALPLUS_ASR_MODULE_DIR])).digest('hex');
}
export async function transcribeLocal(sourcePath,{run,signal}={}){
 if(!transcriptionKey())throw Object.assign(new Error('Configurer un modèle Whisper local avant la transcription.'),{code:'ASR_NOT_CONFIGURED',status:503});
 const script=fileURLToPath(new URL('../engines/transcribe_local.py',import.meta.url));
 const {stdout}=await run(process.env.SOCIALPLUS_ASR_PYTHON||process.env.SOCIALPLUS_PYTHON||'python3',[script,sourcePath],{signal,timeoutMs:600_000,maxOutput:2_000_000});
 const result=JSON.parse(stdout);
 if(!Array.isArray(result.words)||!result.words.length||result.words.length>3000)throw Object.assign(new Error('Aucune transcription exploitable. Vérifiez la piste de voix.'),{code:'ASR_NO_WORDS',status:422});
 return result;
}
