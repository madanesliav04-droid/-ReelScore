// OMNI explanatory motion typography. Not a copy of Alex Hormozi's graphics.
// Safe top-band text only; no unverified revenue chart or fake evidence shot.
const esc=s=>String(s||'').replace(/[{}\\\r\n]/g,' ').slice(0,90).trim();
const slash=String.fromCharCode(92);
const assTime=ms=>{const c=Math.max(0,Math.round(ms/10)),s=Math.floor(c/100);return Math.floor(s/3600)+':'+String(Math.floor(s/60)%60).padStart(2,'0')+':'+String(s%60).padStart(2,'0')+'.'+String(c%100).padStart(2,'0')};
const xColor=hex=>'&H00'+hex.slice(5,7)+hex.slice(3,5)+hex.slice(1,3);
export function renderHormoziOmniAss(timeline,width,height){
 if(!Number.isFinite(width)||!Number.isFinite(height)||width<240||height<240)throw Error('invalid canvas');
 const size=Math.max(19,Math.round(Math.min(width,height)*.048)),y=Math.round(height*.12);
 const lineWidth=Math.round(width*.83),dark=xColor('#10151E'),ice=xColor('#F8FAFE'),cyan=xColor('#76D7FF');
 const h=['[Script Info]','ScriptType: v4.00+','PlayResX: '+width,'PlayResY: '+height,'WrapStyle: 2','ScaledBorderAndShadow: yes','',
 '[V4+ Styles]','Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding',
 'Style: Metric,URW Gothic,'+Math.round(size*1.28)+','+cyan+','+cyan+','+dark+',&HFF000000,-1,0,0,0,100,100,0,0,1,2,0,5,12,12,10,1',
 'Style: Step,URW Gothic,'+size+','+ice+','+ice+','+dark+',&HFF000000,-1,0,0,0,100,100,0,0,1,2,0,5,12,12,10,1',
 '','[Events]','Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text'];
 const cues=(timeline?.graphicCues||[]).filter(c=>c.mode==='hormozi_omni');
 function say(st,ed,text,style='Step',x=width/2,sy=y){
  if(!(ed-st>200)||!esc(text))return;
  const enter=slash+'an5'+slash+'move('+[Math.round(x),sy+6,Math.round(x),sy,0,190].join(',')+')'+slash+'fad(85,120)';
  h.push('Dialogue: 3,'+assTime(st)+','+assTime(ed)+','+style+',,0,0,0,,{'+enter+'}'+esc(text));
 }
 for(const c of cues){
  const st=Number(c.startMs),ed=Number(c.endMs);
  if(!Number.isFinite(st)||!Number.isFinite(ed)||ed<=st||st<0)continue;
  if(c.type==='metric'){
   say(st,ed,c.text,'Metric');
  }else if(c.type==='sequence'&&Array.isArray(c.items)&&Array.isArray(c.itemStarts)&&c.items.length===c.itemStarts.length){
   for(let i=0;i<c.items.length;i++){
    const a=Math.max(st,Number(c.itemStarts[i]));
    const next=Number(c.itemStarts[i+1]);
    const e=i===c.items.length-1?ed:Math.min(ed,next-55);
    say(a,e,String(i+1).padStart(2,'0')+'  '+String(c.items[i]).slice(0,35),'Step');
   }
  }else if(c.type==='comparison'){
   say(st,Math.min(ed,c.rightStartMs||ed),c.left,'Step');
   if(Number.isFinite(Number(c.rightStartMs)))say(c.rightStartMs,ed,c.right,'Metric');
  }
  // Chart deliberately remains absent until the renderer has measured pixel
  // safety and its data source has been independently verified.
 }
 return h.join(String.fromCharCode(10));
}
