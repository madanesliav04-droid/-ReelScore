import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {stat} from 'node:fs/promises';
const exec=promisify(execFile);
export async function verifyMp4(file,{width,height,durationMs,hasAudio}={}){
 const info=await stat(file);
 if(!info.isFile()||info.size===0)throw Object.assign(new Error('Le MP4 final est absent.'),{code:'EXPORT_FILE_MISSING'});
 const {stdout}=await exec('ffprobe',['-v','error','-show_streams','-show_format','-of','json',file],{timeout:30000,maxBuffer:2_000_000});
 const metadata=JSON.parse(stdout),video=metadata.streams.filter(s=>s.codec_type==='video'),audio=metadata.streams.filter(s=>s.codec_type==='audio');
 const valid=video.length===1&&video[0].codec_name==='h264'&&audio.length===(hasAudio?1:0)&&(!hasAudio||audio[0].codec_name==='aac')&&video[0].width===width&&video[0].height===height&&Math.abs(Number(metadata.format.duration)*1000-durationMs)<=150;
 if(!valid)throw Object.assign(new Error('Les pistes, dimensions ou la durée du MP4 sont incorrectes.'),{code:'EXPORT_QA_FAILED'});
 return {bytes:info.size,width:video[0].width,height:video[0].height,durationMs:Math.round(Number(metadata.format.duration)*1000),videoCodec:'h264',audioStreams:audio.length};
}
