// OMNI minimal vector bubble artwork: one meaningful icon or two related parts.
// Decorative OS emoji forbidden. No audio mutation in this renderer.
const slash=String.fromCharCode(92);
const glyphs=new Set(['0','?','✓','↗','A','B','♥','◷']);
const t=ms=>{const c=Math.round(Math.max(0,ms)/10),s=Math.floor(c/100);return Math.floor(s/3600)+':'+String(Math.floor(s/60)%60).padStart(2,'0')+':'+String(s%60).padStart(2,'0')+'.'+String(c%100).padStart(2,'0')};
const esc=s=>String(s||'').replace(/[{},\\]/g,'').trim();
function disk(r){const pts=Array.from({length:44},(_,i)=>{const a=i*Math.PI/22;return [Math.round(r+r*Math.cos(a)),Math.round(r+r*Math.sin(a))]});return 'm '+pts.map(p=>p.join(' ')).join(' l ')}
function validMark(mark){return glyphs.has(mark)||/^\\d{1,5} €$/.test(String(mark))}
export function buildOmniBubblesAss(timeline,width,height){
 if(!Number.isFinite(width)||!Number.isFinite(height)||width<240||height<240)throw Error('invalid canvas');
 const r=Math.max(20,Math.min(40,Math.round(Math.min(width,height)*.059))),y=Math.round(height*.48);
 const safe=width/height>=1.25;
 const left=Math.round(width*.115),right=Math.round(width*.885);
 const header=['[Script Info]','ScriptType: v4.00+','PlayResX: '+width,'PlayResY: '+height,'WrapStyle: 2','ScaledBorderAndShadow: yes','',
  '[V4+ Styles]',
  'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding',
  'Style: Bubble,DejaVu Sans,10,&H002D2925,&H002D2925,&H00C9BBAD,&HFF000000,0,0,0,0,100,100,0,0,1,1,0,7,0,0,0,1',
  'Style: Icon,DejaVu Sans,'+Math.round(r*1.04)+',&H00FFFFFF,&H00FFFFFF,&H002D2925,&HFF000000,-1,0,0,0,100,100,0,0,1,0,0,5,0,0,0,1',
  '','[Events]','Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text'];
 const events=[],done=[];
 for(const cue of timeline?.graphicCues||[]){
  if(cue.mode!=='omni_bubbles'||!Array.isArray(cue.icons)||cue.icons.length<1||cue.icons.length>2||
     !cue.icons.every(validMark)||!safe)continue;
  if(cue.compositionProof?.lateralSafe!==true||cue.compositionProof?.basis!=='independent_frame_tracking'||Number(cue.compositionProof?.framesChecked)<8)continue;
  const st=Number(cue.startMs),ed=Number(cue.endMs);
  if(!Number.isFinite(st)||!Number.isFinite(ed)||st<0||ed-st<500||done.some(x=>st<x+2800))continue;
  done.push(ed);
  const xs=cue.icons.length===2?[left,right]:[cue.kind==='absence'||cue.kind==='emotion'?left:right];
  for(let i=0;i<xs.length;i++){
   const x=xs[i],initial=x+(x<width/2?-5:5),fade=slash+'fad(135,185)';
   const move=(xa,ya,xb,yb)=>slash+'move('+[xa,ya,xb,yb,0,235].join(',')+')';
   const mark=esc(cue.icons[i]);
   const sz=mark.length>2?Math.round(r*.62):Math.round(r*1.04);
   events.push('Dialogue: 1,'+t(st)+','+t(ed)+',Bubble,,0,0,0,,{'+slash+'an7'+move(initial-r,y-r,x-r,y-r)+slash+'p1'+fade+'}'+disk(r));
   events.push('Dialogue: 2,'+t(st)+','+t(ed)+',Icon,,0,0,0,,{'+slash+'an5'+move(initial,y,x,y)+slash+'fs'+sz+fade+'}'+mark);
  }
 }
 return [...header,...events].join(String.fromCharCode(10));
}
