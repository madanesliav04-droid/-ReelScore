// Original V60 graphics on a new rush; partial beta, never full master approval.
import {parseArgs} from 'node:util';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {readFile,writeFile,mkdir,mkdtemp,rm,stat,rename} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {tmpdir} from 'node:os';
import {analyzeSource,transcribeSource} from '../server/render.mjs';
import {normalizeCinematicTranscript} from '../server/cinematic-plan.mjs';
import {buildLocalEdit} from '../server/local-edit.mjs';
import {mapOriginalToOutput} from '../../worker/src/edit.js';
import {preprocessVideo,normalizeNativeVideo} from '../../worker/src/render.js';
const app=fileURLToPath(new URL('../',import.meta.url));
const fail=message=>{throw Error(message)};
export function codiePlan(report,transcription,{events=null,placementReviewed=false}={}){
 const {words,warnings}=normalizeCinematicTranscript(transcription,report,{preview:true});
 const meta=report.metadata;if(meta.width<meta.height)fail('Ce port Codie est limité au format horizontal en bêta.');if(!meta.hasAudio||meta.durationMs>60000||meta.width*meta.height>1920*1080||meta.width%2||meta.height%2)fail('Voix originale, dimensions paires natives, 60 secondes/1080p maximum requis.');
 const approvedPauseIds=[];
 for(const pause of report.suggestions){
  const left=words.findLast(w=>w.endMs<=pause.startMs),right=words.find(w=>w.startMs>=pause.endMs);
  if(!left||!right||left.reviewRequired||right.reviewRequired||!/[.!?]$/.test(left.text))continue;
  try{buildLocalEdit({report,transcript:words,approvedPauseIds:[pause.id],previewOnly:true});approvedPauseIds.push(pause.id);}catch{}
 }
 const edit=buildLocalEdit({report,transcript:words,approvedPauseIds,previewOnly:true});
 const mapped=words.map(w=>({...w,start:mapOriginalToOutput(w.startMs,edit.keepRanges)/1000,end:mapOriginalToOutput(w.endMs,edit.keepRanges)/1000}));
 if(mapped.some(w=>!(w.end>w.start)))fail('La coupe traverse un mot.');
 const cues=[];
 for(const [index,w] of mapped.entries()){
  const text=w.text.toLocaleLowerCase('fr').normalize('NFD').replace(/\p{M}/gu,'').replace(/[^a-z]/g,'');
  const kind=/^(temps|secondes?|minutes?|heures?|quotidien)$/.test(text)?'clock':/^(largent|argent|euros?|revenus?)$/.test(text)?'euro':null;
  if(!kind||w.reviewRequired||/\s/.test(w.text)||Number(w.probability??0)<.75)continue;
  if(cues.some(c=>c.kind===kind&&c.end>w.start))continue;
  // Keep original relative anchors, clamped for the original entrance ring.
  const radius=78,margin=.05*meta.width;
  const x=Math.round(Math.max(margin+radius,Math.min(meta.width-margin-radius,meta.width*(kind==='clock'?176/910:852/910))));
  const y=Math.round(Math.max(.05*meta.height+radius,Math.min(meta.height*.55,161/512*meta.height)));
  cues.push({kind,x,y,start:w.start,end:Math.min(edit.outputDurationMs/1000,w.start+(kind==='clock'?2.23:2.11)),sourceWordIndex:index,spoken:w.text});
 }

 if(events!==null){
  if(!placementReviewed||!Array.isArray(events)||events.length>8)fail('Les directions Codie doivent être relues et limitées à huit événements.');
  cues.length=0;
  const boundary=ms=>edit.keepRanges.reduce((sum,r)=>sum+Math.max(0,Math.min(ms,r.endMs)-r.startMs),0)/1000;
  for(const e of events){
   if(!Number.isInteger(e.wordIndex)||e.wordCount!==1||!words[e.wordIndex]||!['clock','euro'].includes(e.kind))fail('Chaque icône doit référencer un mot réel unique.');
   const w=mapped[e.wordIndex],token=w.text.toLowerCase().normalize('NFD').replace(/\p{M}/gu,'').replace(/[^a-z]/g,'');
   const expected=/^(temps|secondes?|minutes?|heures?|quotidien)$/.test(token)?'clock':/^(largent|argent|euros?|revenus?)$/.test(token)?'euro':null;
   if(expected!==e.kind||w.reviewRequired||/\s/.test(w.text)||Number(w.probability??0)<.75)fail('Icône non justifiée par un mot fiable : relisez la direction.');
   const r=e.rect;
   if(!Array.isArray(r)||r.length!==4||r.some(v=>!Number.isFinite(v))||r[0]<.05||r[1]<.05||r[2]<.08||r[3]<.08||r[0]+r[2]>.95||r[1]+r[3]>.65)fail('Direction Codie hors des zones graphiques autorisées.');
   if(!Number.isFinite(e.endMs)||e.endMs>w.endMs+4000||e.endMs>meta.durationMs||e.endMs-w.startMs<500)fail('Fin de direction invalide.');
   const x=Math.round(Math.max(meta.width*.05+78,Math.min(meta.width*.95-78,(r[0]+r[2]/2)*meta.width)));
   const y=Math.round(Math.max(meta.height*.05+90,Math.min(meta.height*.65-90,(r[1]+r[3]/2)*meta.height)));
   const end=boundary(e.endMs);if(end-w.start<.5)fail('La direction ne dispose pas du temps de lecture nécessaire après les cuts.');
   if(cues.some(c=>c.end>w.start&&c.start<end))fail('Les directions Codie se chevauchent.');
   cues.push({kind:e.kind,x,y,start:w.start,end,sourceWordIndex:e.wordIndex,spoken:w.text});
  }
 }
 if(!cues.length)fail('Aucun mot temps/argent suffisamment fiable : direction Codie à relire, aucun insert inventé.');
 return {engine:'codie-v60-original-animation-port-beta-1',sourceSha256:report.fingerprint,width:meta.width,height:meta.height,sourceDurationMs:meta.durationMs,outputDurationMs:edit.outputDurationMs,keepRanges:edit.keepRanges,cuts:edit.cuts,words:mapped,cues,warnings,captionStatus:'unreviewed_preview',releaseApproved:false,fullModelRestored:false,missingHistoricalInserts:['MX-18296.mp4','MX-241.mp4'],notice:'Original animation and caption grammar; no historical B-roll, voice, captions or cuts reused. Not the full approved V60 master.'};
}
const assTime=s=>{let c=Math.round(s*100);return `${Math.floor(c/360000)}:${String(Math.floor(c/6000)%60).padStart(2,'0')}:${String(Math.floor(c/100)%60).padStart(2,'0')}.${String(c%100).padStart(2,'0')}`};
export function captionAss(header,plan){
 let text=header.split('[Events]')[0].replace(/PlayResX: \d+/,`PlayResX: ${plan.width}`).replace(/PlayResY: \d+/,`PlayResY: ${plan.height}`).replace('Inter Display','SocialPlus Display SemiBold');
 const scale=plan.height/512;
 text=text.replace(',34,',`,${Math.round(34*scale)},`).replace(',60,60,45,1',`,${Math.round(60*scale)},${Math.round(60*scale)},${Math.round(45*scale)},1`);
 text+='[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n';
 const maxChars=Math.floor((plan.width-120*scale)/(34*scale*.7));
 const groups=[];let current=[];
 for(const w of plan.words){if(current.length&&(current.length>=4||[...current,w].map(x=>x.text).join(' ').length>maxChars||w.start-current.at(-1).end>.35)){groups.push(current);current=[];}current.push(w);if(/[.!?]$/.test(w.text)){groups.push(current);current=[];}}
 if(current.length)groups.push(current);
 let previous=0;
 for(const group of groups)for(let i=0;i<group.length;i++){
  const w=group[i];if(/[{}\\\r\n]/.test(w.text))fail('Texte ASS non autorisé.');
  const start=assTime(w.start),end=assTime(w.end);if(w.start<previous||start===end)fail('Horodatage des mots à relire.');previous=w.end;
  const content=group.map((q,j)=>j===i?`{\\c&H00E6CDF5&}${q.text}{\\c&H00FFFFFF&}`:q.text).join(' ');
  text+=`Dialogue: 3,${start},${end},Captions,,0,0,0,,{\\fad(${i===0?62:0},${i===group.length-1?72:0})}${content}\n`;
 }
 return text;
}
async function run(tool,args,{signal}={}){return new Promise((resolve,reject)=>{const p=spawn(tool,args,{stdio:['ignore','pipe','pipe'],signal,env:{...process.env,HF_HUB_OFFLINE:'1'}});let err='';p.stdout.resume();p.stderr.on('data',d=>err=(err+d).slice(-4000));p.on('error',reject);p.on('close',n=>n===0?resolve():reject(Error(tool+' failed: '+err)));});}
// Concat audio independently: combined A/V concat pads to video-frame boundaries.
// Packet-copy the generated video so a timing correction never changes artwork.
export async function alignOriginalAudio(source,output,ranges,{signal}={}){
 if(path.resolve(source)===path.resolve(output))fail('La source originale ne doit jamais être écrasée.');
 if(!Array.isArray(ranges)||!ranges.length||ranges.length>80||ranges.some((r,i)=>!Number.isFinite(r.startMs)||!Number.isFinite(r.endMs)||r.startMs<0||r.endMs<=r.startMs||(i&&r.startMs<ranges[i-1].endMs)))fail('Plages audio invalides.');
 const temporary=output+'.audio-fixed.mp4';
 const parts=ranges.map((r,i)=>`[1:a:0]atrim=start=${r.startMs/1000}:end=${r.endMs/1000},asetpts=PTS-STARTPTS[a${i}]`);
 parts.push(ranges.map((_,i)=>`[a${i}]`).join('')+`concat=n=${ranges.length}:v=0:a=1[a]`);
 try{await run('ffmpeg',['-v','error','-nostdin','-y','-i',output,'-i',source,'-filter_complex',parts.join(';'),'-map','0:v:0','-map','[a]','-c:v','copy','-c:a','aac','-b:a','192k','-movflags','+faststart',temporary],{signal});await rename(temporary,output);}
 finally{await rm(temporary,{force:true});}
}
export async function renderCodieV60({sourcePath,outputPath,transcript=null,direction=null,onProgress=async()=>{},signal,writePlan=false}){
 const source=path.resolve(sourcePath),output=path.resolve(outputPath);if(source===output)fail('Sortie distincte requise.');
 try{await stat(output);fail('La sortie existe déjà.');}catch(e){if(e.code!=='ENOENT')throw e;}
 await onProgress(10);const report=await analyzeSource(source,{signal});await onProgress(25);
 const transcription=transcript?{words:transcript,sourceSha256:report.fingerprint}:await transcribeSource(source,{signal});
 const plan=codiePlan(report,transcription,{events:direction?.events,placementReviewed:direction?.placementReviewed});await onProgress(40);
 const stageRun=(tool,args)=>run(tool,args,{signal});
 const work=await mkdtemp(path.join(tmpdir(),'codie-v60-'));
 try{
  await mkdir(path.dirname(output),{recursive:true});let prepared=source;
  if(plan.cuts.length){prepared=path.join(work,'cut.mp4');await preprocessVideo({inputPath:source,outputPath:prepared,keepRanges:plan.keepRanges,hasAudio:true});}
  const normalized=path.join(work,'native.mp4');await normalizeNativeVideo({inputPath:prepared,outputPath:normalized,fps:30,audioCodec:report.metadata.audioCodec});
  const overlay=path.join(work,'original.mov'),config=path.join(work,'config.json'),captions=path.join(work,'captions.ass');
  const font=path.join(app,'engines/fonts/SocialPlusDisplay-SemiBold.ttf');
  await writeFile(config,JSON.stringify({...plan,durationMs:plan.outputDurationMs,font,output:overlay}));
  await onProgress(55);await stageRun(process.env.SOCIALPLUS_PYTHON||'python3',[path.join(app,'engines/codie_original_animation.py'),config]);
  // Original V60 header only; historical dialogue text/timing is never loaded.
  const header=await readFile(path.join(app,'engines/codie-v60-caption-header.ass'),'utf8');
  await writeFile(captions,captionAss(header,plan));
  await onProgress(80);const fontdir=path.join(app,'engines/fonts');
  await stageRun('ffmpeg',['-v','error','-nostdin','-y','-i',normalized,'-i',overlay,'-filter_complex',`[0:v]ass=${captions}:fontsdir=${fontdir}[sub];[sub][1:v]overlay=0:0:eof_action=pass:repeatlast=0:format=auto,format=yuv420p[v]`,'-map','[v]','-map','0:a:0','-c:v','libx264','-crf','18','-preset','veryfast','-threads','2','-c:a','copy','-movflags','+faststart',output]);
  await onProgress(92);await alignOriginalAudio(source,output,plan.keepRanges,{signal});
  await stageRun('ffmpeg',['-v','error','-xerror','-i',output,'-f','null','-']);
  if(writePlan)await writeFile(output+'.plan.json',JSON.stringify(plan,null,2),{mode:0o600});await onProgress(100);return {outputPath:output,bytes:(await stat(output)).size,plan};
 }catch(error){await rm(output,{force:true});throw error;}finally{await rm(work,{recursive:true,force:true});}
}
async function main(){
 const {values}=parseArgs({options:{input:{type:'string'},output:{type:'string'}}});if(!values.input||!values.output)fail('--input rush.mov --output rendu.mp4 requis');
 const result=await renderCodieV60({sourcePath:values.input,outputPath:values.output,writePlan:true});
 console.log(JSON.stringify({output:result.outputPath,bytes:result.bytes,cues:result.plan.cues.length,cuts:result.plan.cuts.length,captionStatus:result.plan.captionStatus,fullModelRestored:false}));
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(e=>{console.error(e.message);process.exitCode=1;});
