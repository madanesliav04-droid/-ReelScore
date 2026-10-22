import {spawn} from 'node:child_process';
// Samples actual video pixels under a proposed title. No AI or network call.
export function toneFromMeanLuma(v){return Number.isFinite(v)&&v>=142?'dark':'light'}
const areas={top:[.19,.115,.81,.25],left:[.095,.30,.43,.50],right:[.57,.30,.865,.50]};
function sampleMean(sourcePath,sec,width,height,lane){
 return new Promise(resolve=>{
  const r=areas[lane]||areas.top;
  const x=Math.floor(r[0]*width/2)*2,y=Math.floor(r[1]*height/2)*2;
  const w=Math.max(16,Math.floor((r[2]-r[0])*width/2)*2),h=Math.max(16,Math.floor((r[3]-r[1])*height/2)*2);
  const args=['-hide_banner','-v','error','-nostdin','-ss',String(Math.max(0,sec).toFixed(3)),'-i',sourcePath,
   '-frames:v','1','-vf','crop='+w+':'+h+':'+x+':'+y+',scale=16:16:flags=area,format=gray','-f','rawvideo','-'];
  const p=spawn('ffmpeg',args,{stdio:['ignore','pipe','ignore']});
  const bytes=[];let length=0,settled=false;
  const timeout=setTimeout(()=>{p.kill('SIGKILL');if(!settled){settled=true;resolve(null)}},6500);
  p.stdout.on('data',b=>{length+=b.length;if(length<=1024)bytes.push(b);else p.kill('SIGKILL')});
  p.on('error',()=>{clearTimeout(timeout);if(!settled){settled=true;resolve(null)}});
  p.on('close',code=>{clearTimeout(timeout);if(settled)return;settled=true;
   const b=Buffer.concat(bytes);resolve(code===0&&b.length===256?b.reduce((a,x)=>a+x,0)/256:null);
  });
 });
}
export async function applyAutomaticTextContrast({sourcePath,timeline,width,height}){
 if(!Array.isArray(timeline?.graphicCues))return;
 for(const cue of timeline.graphicCues.filter(c=>c.mode==='multimodal_organic').slice(0,6)){
  const t=Number(cue.startMs)/1000+.15;
  const luma=await sampleMean(sourcePath,t,width,height,cue.lane);
  cue.measuredBackgroundLuma=luma;
  cue.textTone=toneFromMeanLuma(luma);
 }
}
