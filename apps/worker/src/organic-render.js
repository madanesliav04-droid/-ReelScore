// Render restrained typography without cards or invented statistics.
const tt=ms=>{const c=Math.round(Math.max(0,ms)/10),s=Math.floor(c/100);return Math.floor(s/3600)+':'+String(Math.floor(s/60)%60).padStart(2,'0')+':'+String(s%60).padStart(2,'0')+'.'+String(c%100).padStart(2,'0')};
const esc=s=>String(s||'').replace(/[{}\\]/g,'').replace(/\r?\n/g,' ');
export function buildOrganicAss(timeline,width,height){
 if(!Number.isFinite(width)||!Number.isFinite(height)||width<240||height<240)throw new Error('invalid output canvas');
 const portrait=height>width,x=Math.round(width*(portrait?.5:.78)),y=Math.round(height*.18);
 const fontsize=portrait?Math.round(width*.061):Math.round(height*.06);
 const lines=['[Script Info]','ScriptType: v4.00+','PlayResX: '+width,'PlayResY: '+height,'WrapStyle: 2','ScaledBorderAndShadow: yes','',
  '[V4+ Styles]','Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding',
  'Style: Organic,Noto Serif,'+fontsize+',&H00282725,&H00282725,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,0,0,5,14,14,10,1','',
  '[Events]','Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text'];
 for(const cue of timeline?.graphicCues||[]){
  const experimental=cue.mode==='multimodal_organic'&&cue.evidence==='gemini_visual_observation_plus_verbatim_timed_words';
  if(!experimental&&!(cue.mode==='organic'&&cue.evidence==='timed_transcript'))continue;
  const text=esc(cue.text).slice(0,62);if(!text)continue;
  const px=experimental?(cue.lane==='left'?Math.round(width*.26):cue.lane==='right'?Math.round(width*.72):Math.round(width*.5)):x;
  const py=experimental?(cue.lane==='left'||cue.lane==='right'?Math.round(height*.4):Math.round(height*.18)):y;
  const color=experimental?'\\c&HFFFFFF&\\3c&H111111&\\bord2':'';
  lines.push('Dialogue: 1,'+tt(cue.startMs)+','+tt(cue.endMs)+',Organic,,0,0,0,,{\\an5\\move('+px+','+(py+7)+','+px+','+py+',0,300)\\fad(175,180)'+color+'}'+text);
 }
 return lines.join('\n');
}