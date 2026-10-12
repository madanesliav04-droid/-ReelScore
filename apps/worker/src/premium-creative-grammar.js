// Premium editorial grammar — opt-in, fail-closed and evidence-constrained.
// Only speech-aligned, visually protected events can become video graphics.
const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim().split(/\s+/).filter(Boolean);
function match(text,words){
 const target=norm(text),all=[];
 if(!target.length||target.length>18)return null;
 for(const w of words||[])for(const v of norm(w.text))all.push({v,start:Number(w.startMs),end:Number(w.endMs)});
 for(let i=0;i<=all.length-target.length;i++){
  if(target.every((x,k)=>all[i+k].v===x)&&Number.isFinite(all[i].start)&&Number.isFinite(all[i+target.length-1].end))
   return {startMs:all[i].start,endMs:all[i+target.length-1].end};
 }
 return null;
}
function headroom(proof,startMs,endMs){
 if(proof?.source!=='independent_frame_sampler'||proof?.verified!==true)return null;
 const frames=(proof.frames||[]).filter(f=>Number.isFinite(Number(f.ms))&&Number(f.ms)>=startMs&&Number(f.ms)<=endMs&&Number.isFinite(Number(f.clearTopNormalized)));
 if(frames.length<5||frames.some(f=>Number(f.confidence)<.90))return null;
 const times=frames.map(f=>Number(f.ms)).sort((a,b)=>a-b);
 if(times[0]>startMs+300||times.at(-1)<endMs-300||times.some((t,i)=>i>0&&t-times[i-1]>550))return null;
 const clear=Math.min(...frames.map(f=>Number(f.clearTopNormalized)))-.016;
 return clear>=.115?clear:null;
}
export function planPremiumStoryboards({suggestions=[],words=[],durationMs=0,alignment=null,visualProof=null}={}){
 const accepted=[],rejected=[];
 if(alignment?.method!=='forced_alignment'||alignment?.verified!==true||Number(alignment.confidence)<.92)
  return {accepted,rejected:[{reason:'UNVERIFIED_SPEECH_ALIGNMENT'}],policy:'premium-editorial-grammar-v1'};
 for(const [i,s] of (Array.isArray(suggestions)?suggestions:[]).slice(0,10).entries()){
  const type=String(s.type||''),anchor=match(s.spoken_anchor,words);
  if(!['statement','comparison','questions'].includes(type)||!anchor||Math.abs(anchor.startMs-Number(s.start_ms))>500){rejected.push({i,reason:'INVALID_TYPE_OR_SPEECH_ANCHOR'});continue}
  const startMs=anchor.startMs,endMs=Math.min(durationMs,startMs+Math.min(3500,Math.max(1200,Number(s.duration_ms)||2200)));
  if(endMs-startMs<700){rejected.push({i,reason:'INVALID_DURATION'});continue}
  const band=headroom(visualProof,startMs,endMs);
  if(band===null){rejected.push({i,reason:'UNVERIFIED_DYNAMIC_SUBJECT_SAFETY'});continue}
  const cue={mode:'premium_storyboard',type,startMs,endMs,safeTopNormalized:band,evidence:'verbatim_speech_plus_independent_frames'};
  if(type==='statement'){
   const where=match(s.text,words);
   if(!where||where.startMs<startMs-500||where.startMs>endMs){rejected.push({i,reason:'UNSPOKEN_OR_REMOTE_TEXT'});continue}
   cue.text=String(s.text).trim();
  }else if(type==='comparison'){
   const leftWord=match(s.left,words),rightWord=match(s.right,words);
   if(band<.19||!leftWord||!rightWord||[leftWord,rightWord].some(v=>v.startMs<startMs-800||v.startMs>endMs+500)){
     rejected.push({i,reason:'UNSAFE_OR_UNSPOKEN_COMPARISON'});continue;
   }
   cue.left=String(s.left).trim();cue.right=String(s.right).trim();cue.text=cue.left+' | '+cue.right;
  }else{
   const items=(Array.isArray(s.items)?s.items:[]).slice(0,3),occurrences=items.map(v=>match(v,words));
   if(band<.16||items.length<2||occurrences.some(x=>!x)||occurrences.some((x,j)=>j>0&&x.startMs<occurrences[j-1].startMs)||occurrences.some(x=>x&& (x.startMs<startMs-350||x.startMs>endMs+300))){rejected.push({i,reason:'UNSAFE_OR_UNSPOKEN_SEQUENCE'});continue}
   cue.items=items;cue.itemStarts=occurrences.map(x=>x.startMs);cue.text=items.join(' / ');
  }
  if(accepted.some(x=>x.startMs<endMs+1500&&x.endMs>startMs-1500)){rejected.push({i,reason:'DOMINANT_EFFECT_CONFLICT'});continue}
  accepted.push(cue);if(accepted.length>=Math.ceil(durationMs/30000*3))break;
 }
 return {accepted,rejected,policy:'premium-editorial-grammar-v1'};
}
const tm=ms=>{const z=Math.round(ms/10),s=Math.floor(z/100);return Math.floor(s/3600)+':'+String(Math.floor(s/60)%60).padStart(2,'0')+':'+String(s%60).padStart(2,'0')+'.'+String(z%100).padStart(2,'0')};
const safeText=s=>String(s||'').replace(/[{}\\\r\n]/g,'').trim();
export function renderPremiumStoryboardsAss(timeline,width,height){
 if(width<250||height<250)throw Error('INVALID_CANVAS');
 const cues=(timeline?.graphicCues||[]).filter(c=>c.mode==='premium_storyboard');
 const base=Math.round(Math.min(width,height)*.061),ink='&H0028221B',accent='&H003D6D9C';
 const lines=['[Script Info]','ScriptType: v4.00+','PlayResX: '+width,'PlayResY: '+height,'ScaledBorderAndShadow: yes','',
  '[V4+ Styles]','Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding',
  'Style: Serif,Noto Serif,'+base+','+ink+','+ink+',&H00FFFFFF,&H00000000,-1,0,0,0,100,100,0,0,1,0,0,5,12,12,10,1',
  'Style: Accent,Noto Sans,'+Math.round(base*.86)+','+accent+','+accent+',&H00FFFFFF,&H00000000,-1,0,0,0,100,100,0,0,1,0,0,5,12,12,10,1','',
  '[Events]','Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text'];
 const add=(s,e,text,x,y,style='Serif',sz=base)=>{
  if(e-s<250)return;
  lines.push('Dialogue: 1,'+tm(s)+','+tm(e)+','+style+',,0,0,0,,{\\an5\\move('+Math.round(x)+','+Math.round(y+7)+','+Math.round(x)+','+Math.round(y)+',0,280)\\fad(160,180)\\fs'+sz+'}'+safeText(text).toUpperCase());
 };
 for(const c of cues){
  const h=Math.floor(height*Math.min(.225,c.safeTopNormalized-.012)),x=width/2;
  if(c.type==='statement')add(c.startMs,c.endMs,c.text,x,h*.57,'Serif',Math.min(base+4,Math.floor(h*.36)));
  if(c.type==='comparison'){
   const y=h*.62,size=Math.min(base,Math.floor(width*.05));
   add(c.startMs,c.endMs,c.left,width*.29,y,'Serif',size);
   add(c.startMs+130,c.endMs,c.right,width*.72,y,'Accent',size);
  }
  if(c.type==='questions'){
   for(let i=0;i<c.items.length;i++)add(Math.max(c.startMs,c.itemStarts[i]),
     i+1<c.items.length?Math.min(c.endMs,c.itemStarts[i+1]-40):c.endMs,
     c.items[i],x,h*.57,i%2?'Accent':'Serif',Math.min(base,Math.floor(width*.048)));
  }
 }
 return lines.join('\n');
}