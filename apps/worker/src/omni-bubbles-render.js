// Face-safe, speech-grounded two-sided bubbles. ASS vector + centred glyph.
const slash=String.fromCharCode(92);
const time=ms=>{const centis=Math.round(Math.max(0,ms)/10),sec=Math.floor(centis/100);return Math.floor(sec/3600)+':'+String(Math.floor(sec/60)%60).padStart(2,'0')+':'+String(sec%60).padStart(2,'0')+'.'+String(centis%100).padStart(2,'0')};
const icons={spark:'✦',zero:'0',question:'?',check:'✓',heart_outline:'♡',heart_solid:'♥'};
function disk(r){const pts=Array.from({length:36},(_,i)=>{const a=i*Math.PI/18;return [Math.round(r+r*Math.cos(a)),Math.round(r+r*Math.sin(a))]});return 'm '+pts.map(p=>p.join(' ')).join(' l ')}
export function buildOmniBubblesAss(timeline,width,height){
 if(width<240||height<240)throw Error('invalid canvas');
 if(width/height<1.25)return '';
 const r=Math.max(20,Math.min(42,Math.round(height*.063))),y=Math.round(height*.51);
 const head=['[Script Info]','ScriptType: v4.00+','PlayResX: '+width,'PlayResY: '+height,'ScaledBorderAndShadow: yes','',
 '[V4+ Styles]','Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding',
 'Style: Bubble,DejaVu Sans,16,&H00F7E6DF,&H00F7E6DF,&H00BDB9E1,&HFF000000,0,0,0,0,100,100,0,0,1,2,1,7,0,0,0,1',
 'Style: Icon,DejaVu Sans,'+Math.round(r*1.1)+',&H00F4F5FB,&H00F4F5FB,&H0020243A,&HFF000000,-1,0,0,0,100,100,0,0,1,0,0,5,0,0,0,1',
 '','[Events]','Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text'];
 const pairs={zero:['spark','zero'],solution:['question','check'],heart:['heart_outline','heart_solid']},endTimes=[];
 for(const c of timeline?.graphicCues||[]){
  if(c.mode!=='omni_bubbles'||!pairs[c.kind]||JSON.stringify(c.icons)!==JSON.stringify(pairs[c.kind]))continue;
  const st=Number(c.startMs),ed=Number(c.endMs);
  if(!Number.isFinite(st)||!Number.isFinite(ed)||st<0||ed-st<500||endTimes.some(e=>st<e+3000))continue;
  endTimes.push(ed);
  for(const [i,x] of [Math.round(width*.09),Math.round(width*.91)].entries()){
   const from=x+(i===0?-5:5),fade=slash+'fad(140,180)';
   head.push('Dialogue: 1,'+time(st)+','+time(ed)+',Bubble,,0,0,0,,{'+slash+'an7'+slash+'move('+[from-r,y-r,x-r,y-r,0,220].join(',')+')'+slash+'p1'+fade+'}'+disk(r));
   head.push('Dialogue: 2,'+time(st)+','+time(ed)+',Icon,,0,0,0,,{'+slash+'an5'+slash+'move('+[from,y,x,y,0,220].join(',')+')'+fade+'}'+icons[c.icons[i]]);
  }
 }
 return head.join(String.fromCharCode(10));
}
