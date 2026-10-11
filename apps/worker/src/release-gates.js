import {spawn} from "node:child_process";
import {stat} from "node:fs/promises";
// Edit+ commercial beta safety gate: deterministic technical checks, not a human editing score.
export class ReleaseGateError extends Error {
 constructor(code,message){super(message);this.name="ReleaseGateError";this.code=code;}
}
function reject(code,message){throw new ReleaseGateError(code,message)}
const finite=x=>x!==null&&x!==undefined&&x!==""&&Number.isFinite(Number(x));
export function validateTimedTranscript(analysis,durationMs){
 const words=analysis?.transcript?.words;
 if(!Array.isArray(words)||words.length<3)reject("ASR_NOT_READY","Timed transcription missing; do not invent captions.");
 let last=-1;
 for(const w of words){
  const s=Number(w.startMs), e=Number(w.endMs);
  if(!String(w.text||"").trim()||!finite(w.startMs)||!finite(w.endMs)||s<0||e<=s||s<last-5||e>durationMs+400)
   reject("ASR_TIMING_INVALID","Inconsistent word timecodes.");
  last=s;
 }
 return {wordCount:words.length,precision:"model_word_timestamps_not_forced_alignment"};
}
export function validateEditTimeline(t){
 const durationMs=Number(t?.outputDurationMs), keep=t?.keepRanges, captions=t?.captions;
 if(!finite(t?.outputDurationMs)||durationMs<500||durationMs>600000)reject("INVALID_EDIT_DURATION","Unsupported edit duration.");
 if(!Array.isArray(keep)||!keep.length||keep.length>120)reject("INVALID_EDIT_RANGES","Invalid keep ranges.");
 let prev=-1,total=0;
 for(const r of keep){
  const s=Number(r.startMs),e=Number(r.endMs);
  if(!finite(r.startMs)||!finite(r.endMs)||s<0||e-s<120||s<prev)reject("INVALID_EDIT_RANGES","Overlapping or short segments.");
  total+=e-s;prev=e;
 }
 if(Math.abs(total-durationMs)>120)reject("EDIT_DURATION_MISMATCH","Timeline durations disagree.");
 if(!Array.isArray(captions)||!captions.length)reject("CAPTIONS_NOT_READY","No usable captions.");
 for(const c of captions){
  const s=Number(c.startMs),e=Number(c.endMs);
  if(!String(c.text||"").trim()||!finite(c.startMs)||!finite(c.endMs)||s<0||e<=s||e>durationMs+500)
   reject("CAPTION_TIMING_INVALID","Caption outside timeline.");
 }
 const width=Number(t.export?.width),height=Number(t.export?.height);
 if(!Number.isInteger(width)||!Number.isInteger(height)||width<240||height<240||width>4096||height>4096||width%2||height%2)
  reject("EXPORT_DIMENSIONS_INVALID","Unsupported output dimensions.");
 return {durationMs,width,height,captionCount:captions.length};
}
const licenses=new Set(["cc0","pdm","cc-by","cc-by-sa","by","by-sa"]);
export function filterLicensedBroll(cues){
 const accepted=[],rejected=[];
 for(const c of Array.isArray(cues)?cues:[]){
  const l=String(c.license||"").toLowerCase().trim(),p=String(c.sourcePage||c.source_page||""),src=String(c.assetUrl||"");
  const credit=String(c.attribution||c.artist||"").trim();
  const ok=licenses.has(l)&&p.startsWith("https://")&&src.startsWith("https://")&&(["cc0","pdm"].includes(l)||!!credit);
  if(ok)accepted.push(c);else rejected.push({query:String(c.query||"").slice(0,100),reason:"unverified_rights"});
 }
 return {accepted,rejected};
}
function exec(exe,args,timeoutMs){
 return new Promise((resolve,fail)=>{
  const p=spawn(exe,args,{stdio:["ignore","pipe","pipe"]});let stdout="",stderr="";
  const timeout=setTimeout(()=>p.kill("SIGKILL"),timeoutMs);
  p.stdout.on("data",d=>{stdout+=d;if(stdout.length>4000000)p.kill("SIGKILL")});
  p.stderr.on("data",d=>{stderr+=d;if(stderr.length>40000)stderr=stderr.slice(-40000)});
  p.on("error",e=>{clearTimeout(timeout);fail(e)});
  p.on("close",code=>{clearTimeout(timeout);if(code===0)resolve(stdout);else fail(new Error(exe+" returned "+code+": "+stderr.slice(-350)))});
 });
}
export function validateProbe(data,expect){
 const v=(data.streams||[]).find(x=>x.codec_type==="video"),a=(data.streams||[]).find(x=>x.codec_type==="audio");
 if(!v||v.codec_name!=="h264")reject("BAD_VIDEO_CODEC","Invalid MP4 video.");
 if(v.width!==expect.width||v.height!==expect.height)reject("EXPORT_DIMENSIONS_MISMATCH","Wrong export raster.");
 if(expect.expectAudio!==false&&!a)reject("MISSING_AUDIO","Missing audio stream.");
 const seconds=Number(data.format?.duration);
 if(!Number.isFinite(seconds)||seconds<=0||Math.abs(seconds*1000-expect.durationMs)>Math.max(650,expect.durationMs*0.02))
  reject("EXPORT_DURATION_MISMATCH","Export duration incorrect.");
 const [n,d]=String(v.avg_frame_rate||"0/1").split("/").map(Number),fps=n/d;
 if(!Number.isFinite(fps)||fps<23||fps>61)reject("BAD_FRAME_RATE","Unexpected frame rate.");
 return {codec:v.codec_name,width:v.width,height:v.height,fps,durationMs:Math.round(seconds*1000),audioCodec:a?.codec_name||null};
}
export async function verifyExport({filePath,timeline}){
 const expected=validateEditTimeline(timeline),file=await stat(filePath);
 if(file.size<100000)reject("EXPORT_TOO_SMALL","Output missing or abnormally small.");
 const data=JSON.parse(await exec("ffprobe",["-v","error","-show_streams","-show_format","-of","json",filePath],60000));
 const inspected=validateProbe(data,{...expected,expectAudio:timeline.audio?.hasAudio!==false});
 await exec("ffmpeg",["-nostdin","-v","error","-xerror","-i",filePath,"-map","0:v:0","-map","0:a:0?","-f","null","-"],Math.max(60000,expected.durationMs*5));
 return {passed:true,bytes:file.size,inspected,captionCount:expected.captionCount,policy:"editplus-beta-gates-v1"};
}