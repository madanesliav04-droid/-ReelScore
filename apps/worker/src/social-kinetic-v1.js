// Edit+ third model: Social Kinetic. Independent frame safety & forced alignment required.
// Reference: user-supplied social business coach video (55.17s). No screenshots/engagement fabricated.
function skNorm(s) {
  return String(s||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9€%]+/g," ").trim();
}

function skProofSafe(p,start,end) {
  if(p?.source!=="independent_frame_sampler"||p?.verified!==true) return false;
  const frames=(p.frames||[]).filter(f=>Number.isFinite(+f.ms)&&f.ms>=start-350&&f.ms<=end+350&&Number.isFinite(+f.clearTopNormalized)&&Number.isFinite(+f.confidence)).sort((a,b)=>a.ms-b.ms);
  if(frames.length<5||frames[0].ms>start+300||frames.at(-1).ms<end-250) return false;
  if(frames.some(f=>f.confidence<.9||f.clearTopNormalized<.24)) return false;
  return !frames.some((f,i)=>i&&f.ms-frames[i-1].ms>650);
}

export function buildSocialKineticCues({words=[],durationMs=0,alignment=null,visualProof=null,maxPer30s=4}={}) {
  if(alignment?.method!=="forced_alignment"||alignment?.verified!==true||Number(alignment?.confidence)<.92) return [];
  if(!Array.isArray(words)||words.length<3||!Number.isFinite(durationMs)||durationMs<1500)return [];
  const ws=words.filter(w=>w?.text&&Number.isFinite(+w.startMs)&&Number.isFinite(+w.endMs)&&w.endMs>w.startMs).sort((a,b)=>a.startMs-b.startMs);
  const candidates=[];
  const noDecor=new Set(["je","tu","il","elle","de","le","les","des","une","un","et","en","à","a","on","vous","ils","est","que","qui","pour","dans","mais","donc","alors"]);
  for(let i=0;i<ws.length;i++){
    const w=ws[i], clean=skNorm(w.text);
    let kind="", text="", dur=1800, priority=0;
    const next=ws[i+1], second=ws[i+2];
    const digit=String(w.text).match(/(?:\d[\d .,\u00a0]*)(?:\s*(?:€|%|euros?|dollars?))?/i);
    if(digit&&/\d/.test(digit[0])){
      const unit=next&&/^(?:euros?|€|%|dollars?|clients?|jours?)$/i.test(skNorm(next.text))?" "+next.text:"";
      text=(digit[0]+unit).trim(); kind="metric"; dur=2200; priority=4;
    } else if(/^(premiere?|deuxieme?|troisieme?|first|second|third)$/i.test(clean)){
      kind="step";text=w.text;dur=1600;priority=3;
    } else if(/^(pourquoi|comment|combien|how|why|what)$/i.test(clean)&&next&&second){
      kind="message";text=[w.text,next.text,second.text].join(" ").trim();dur=2400;priority=2;
    } else if(clean.length>=7&&!noDecor.has(clean)&&/(?:solution|resultat|confiance|objectif|methode|strategie|clients|accompagnement|business|vendre|competence|important|essentiel|valeur|probleme|question)/.test(clean)){
      kind="keyword";text=w.text;dur=1600;priority=1;
    }
    if(!kind||!text||text.length>46)continue;
    const start=Math.round(w.startMs), end=Math.min(durationMs,start+dur);
    if(end-start<850||!skProofSafe(visualProof,start,end))continue;
    candidates.push({mode:"social_kinetic",kind,startMs:start,endMs:end,text,evidence:"forced_alignment_plus_independent_frame_safety",priority,lane:"top",accent:kind==="message"?"blue":kind==="metric"?"white":"mint"});
  }
  candidates.sort((a,b)=>b.priority-a.priority||a.startMs-b.startMs);
  const limit=Math.max(1,Math.ceil(durationMs/30000*Math.max(1,Math.min(5,maxPer30s))));
  const accepted=[];
  for(const c of candidates){
    if(accepted.length>=limit) break;
    if(accepted.some(x=>Math.max(x.startMs,c.startMs)<Math.min(x.endMs+800,c.endMs+800)))continue;
    accepted.push(c);
  }
  return accepted.sort((a,b)=>a.startMs-b.startMs).map(({priority,...c})=>c);
}

function skAssTime(ms) {
  const c=Math.round(Math.max(0,ms)/10),s=Math.floor(c/100);
  return Math.floor(s/3600)+":"+String(Math.floor(s/60)%60).padStart(2,"0")+":"+String(s%60).padStart(2,"0")+"."+String(c%100).padStart(2,"0");
}

function skEscape(s) {
  return String(s||"").replace(/[{}\\\r\n]/g," ").replace(/\s+/g," ").trim().slice(0,50);
}

export function renderSocialKineticAss(timeline,width,height) {
  if(width<300||height<300) throw Error("CANVAS_TOO_SMALL");
  const portrait=height>width,fontsize=Math.round(Math.min(width,height)*(.052));
  const x=Math.round(width*.5),y=Math.round(height*(portrait?.22:.18));
  const margin=Math.round(width*.06);
  const base=[
    "[Script Info]","ScriptType: v4.00+","PlayResX: "+width,"PlayResY: "+height,"WrapStyle: 2","ScaledBorderAndShadow: yes","",
    "[V4+ Styles]","Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding",
    "Style: Headline,Noto Sans,"+fontsize+",&H00F2FFFF,&H00F2FFFF,&H00101214,&HFF000000,-1,0,0,0,100,100,0,0,1,2,0,5,"+margin+","+margin+",10,1",
    "Style: Metric,Noto Sans,"+Math.round(fontsize*1.40)+",&H00FFFFFF,&H00FFFFFF,&H00101214,&HFF000000,-1,0,0,0,100,100,0,0,1,2,0,5,"+margin+","+margin+",10,1",
    "Style: Message,Noto Sans,"+Math.round(fontsize*.76)+",&H00FFFFFF,&H00FFFFFF,&H00FFFFFF,&HBB3F9DE6,-1,0,0,0,100,100,0,0,3,12,0,5,"+margin+","+margin+",10,1","",
    "[Events]","Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text"
  ];
  for(const c of timeline?.graphicCues||[]){
    if(c.mode!=="social_kinetic"||c.evidence!=="forced_alignment_plus_independent_frame_safety")continue;
    if(!["keyword","metric","message","step"].includes(c.kind))continue;
    if(c.endMs<=c.startMs+350)continue;
    const line=skEscape(c.text);if(!line)continue;
    const style=c.kind==="metric"?"Metric":c.kind==="message"?"Message":"Headline";
    const xpos=c.kind==="message"?Math.round(width*.50):x;
    const ypos=c.kind==="message"?Math.round(y+height*.036):y;
    const animation=c.kind==="message"?"{\\an5\\move("+xpos+","+(ypos+9)+","+xpos+","+ypos+",0,260)\\fad(150,250)}":
      "{\\an5\\pos("+xpos+","+ypos+")\\fscx112\\fscy112\\t(0,220,\\fscx100\\fscy100)\\fad(120,220)}";
    base.push("Dialogue: 4,"+skAssTime(c.startMs)+","+skAssTime(c.endMs)+","+style+",,0,0,0,,"+animation+line);
  }
  return base.join("\n");
}
