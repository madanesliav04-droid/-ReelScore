// Parameterize the historical V28 composition. Its source remains unchanged.
// Direction references actual transcript words; it cannot supply invented copy.
import {readFile} from 'node:fs/promises';
const reference=new URL('../../worker/hyperframes/social-kinetic-v28-speech-timed/index.html',import.meta.url);
const fail=message=>Object.assign(new Error(message),{status:422,code:'KINETIC_REFERENCE_INPUT'});
const escapeJson=value=>JSON.stringify(value).replace(/</g,'\\u003c');
export function referenceDirection(plan){
 const d=plan.referenceDirection,words=plan.referenceWords;
 if(!d||!Array.isArray(words)||!words.length)throw fail('KINETIC_REFERENCE_DIRECTION_REQUIRED');
 for(const [key,limit] of [['impacts',8],['bubbles',8],['captionRuns',40]])if(d[key]!==undefined&&(!Array.isArray(d[key])||d[key].length>limit||d[key].some(p=>!p||typeof p!=='object')))throw fail('KINETIC_REFERENCE_DIRECTION_SHAPE');
 const span=(first,last)=>{
  if(!Number.isInteger(first)||!Number.isInteger(last)||first<0||last<first||last>=words.length)throw fail('KINETIC_REFERENCE_WORD_RANGE');
  return words.slice(first,last+1).map((w,i)=>({index:first+i,text:w.text.toUpperCase(),t:w.startMs/1000,end:w.endMs/1000}));
 };
 const rect=r=>{
  if(!Array.isArray(r)||r.length!==4||r.some(x=>!Number.isFinite(x))||r[0]<.04||r[1]<.04||r[2]<.15||r[3]<.04||r[0]+r[2]>.96||r[1]+r[3]>.92)throw fail('KINETIC_REFERENCE_SAFE_RECT');
  return r;
 };
 const layout=Object.fromEntries(['hero','chat','captionLeft','captionRight'].map(k=>[k,rect(d.layout?.[k])]));
 const impacts=(d.impacts||[]).map(p=>{
  const hint=span(p.firstWord,p.accentWord-1),accent=span(p.accentWord,p.lastWord);
  const hold=p.holdUntilWord===undefined?accent.at(-1).end:span(p.lastWord,p.holdUntilWord).at(-1).end;
  return {a:hint[0].t,b:hold,hint,accent,pre:hint.map(w=>w.text).join(' '),word:accent.map(w=>w.text).join(' '),cls:'directed',firstWord:p.firstWord,lastWord:p.lastWord};
 });
 for(let i=1;i<impacts.length;i++)if(impacts[i].a<impacts[i-1].b)throw fail('KINETIC_REFERENCE_HERO_OVERLAP');
 const bubbles=(d.bubbles||[]).map((p,i)=>{
  const tokens=span(p.firstWord,p.lastWord);
  if(!Number.isInteger(p.stack)||p.stack<0||p.stack>1)throw fail('KINETIC_REFERENCE_STACK_DEPTH');
  return {a:tokens[0].t,b:tokens.at(-1).end+.18,label:tokens.map(w=>w.text).join(' '),tokens,stack:p.stack,id:i+1};
 });
 for(let i=0;i<bubbles.length;i++){
  if(bubbles[i].stack===1&&(!i||bubbles[i-1].stack!==0))throw fail('KINETIC_REFERENCE_STACK_ORDER');
  if(i&&bubbles[i].a<=bubbles[i-1].a)throw fail('KINETIC_REFERENCE_BUBBLE_ORDER');
 }
 const groups=bubbles.map((p,i)=>p.stack===0&&bubbles[i+1]?.stack===1?{...p,b:bubbles[i+1].b}:p);
 for(let i=1;i<groups.length;i++)if(groups[i].stack===0&&groups[i].a<groups[i-1].b)throw fail('KINETIC_REFERENCE_BUBBLE_GROUP_OVERLAP');
 for(const b of groups)if(impacts.some(h=>h.a<b.b&&h.b>b.a))throw fail('KINETIC_REFERENCE_GRAPHIC_OVERLAP');
 const captionRuns=(d.captionRuns||[]).map(p=>{const selected=span(p.firstWord,p.lastWord);if(!['left','right'].includes(p.side))throw fail('KINETIC_REFERENCE_CAPTION_SIDE');return {a:selected[0].t,b:selected.at(-1).end,side:p.side};});
 return {impacts,bubbles:groups,layout,captionRuns};
}
export async function referenceKineticHtml(plan){
 const {impacts,bubbles,layout,captionRuns}=referenceDirection(plan);
 const words=plan.referenceWords,portrait=plan.height>plan.width;
 const captions=words.map((w,index)=>({...w,index})).filter((w,i)=>!impacts.some(p=>i>=p.firstWord&&i<=p.lastWord)).map(w=>({index:w.index,text:w.text.toUpperCase(),t:w.startMs/1000,end:w.endMs/1000}));
 let html=await readFile(reference,'utf8');
 html=html.replace(/const SOURCE_MANIFEST=.*?;\n/,'const SOURCE_MANIFEST='+escapeJson({captions:[{words:captions}]})+';\n');
 html=html.replace('const FPS=30,DURATION=41.1;',`const FPS=30,DURATION=${plan.durationMs/1000};`);
 html=html.replace(/const OLD_EDL=[\s\S]*?const root=/,'function rt(t){return t;}\nconst root=');
 html=html.replace(/const manifest=\{.*?\};/,`const manifest=${escapeJson({version:'28-reference-directed',source:'historical_v28_composition_parameterized',nativeFormat:[plan.width,plan.height],transcriptionHumanConfirmed:false,releaseApproved:false})};`);
 html=html.replace(/const IMPACTS=\[[\s\S]*?\];/,'const IMPACTS='+escapeJson(impacts)+';');
 html=html.replace("pre.textContent=p.pre;", "pre.textContent='';for(const [j,w] of p.hint.entries()){const s=document.createElement('span');s.dataset.wordIndex=w.index;s.textContent=w.text+' ';pre.appendChild(s);tl.fromTo(s,{opacity:0},{opacity:1,duration:Math.min(.10,(w.end-w.t)/3),immediateRender:false},w.t);}");
 html=html.replace(/\s+if\(p.cls==='opening'\)\{[\s\S]*?\}else\{big.textContent=p.word\}/,"  for(const w of p.accent){const s=document.createElement('span');s.dataset.wordIndex=w.index;s.textContent=w.text+' ';big.appendChild(s);tl.fromTo(s,{opacity:0,y:12},{opacity:1,y:0,duration:Math.min(.20,(w.end-w.t)/3),ease:'power3.out',immediateRender:false},w.t);}");
 html=html.replace('span.textContent=w.text;e.appendChild(span);','span.dataset.wordIndex=w.index;span.textContent=w.text;e.appendChild(span);');
 // Keep the original entrance easing, but reveal the accented words on speech.
 html=html.replace("},p.a+.10);", "},p.accent[0].t);");
 html=html.replace('y:20,scale:.86', 'y:12,scale:.92');
 html=html.replace("text:w.text,t:rt(w.t)","text:w.text,t:rt(w.t),end:w.end,index:w.index");
 html=html.replace('words[words.length-1].t+.20','words[words.length-1].end+.03');
 html=html.replace('buf.length>=5','buf.length>=4').replace('>37',portrait?'>23':'>32');
 html=html.replace("if(b-c.a<.28||overlap(c.a,b,IMPACTS.map(h=>[h.a,h.b])))continue;", "if(b-c.a<.02)continue;");
 html=html.replace(/const chatPhase=c.a>=rt\(28.05\)[^;]+;/,"const chatPhase=C.some(p=>c.a>=p.a&&c.a<=p.b),right=!chatPhase&&CAPTION_RUNS.find(p=>c.a>=p.a&&c.a<p.b)?.side==='right';");
 html=html.replace("duration:.17,ease:'power2.out',immediateRender:false},Math.max(c.a,w.t)","duration:Math.min(.10,(w.end-w.t)/3),ease:'power2.out',immediateRender:false},Math.max(c.a,w.t)");
 html=html.replace("duration:.15,ease:'power2.out',immediateRender:false},c.a", "duration:.03,ease:'power2.out',immediateRender:false},c.a");
 html=html.replace("duration:.12,ease:'power2.in'},Math.max(c.a+.23,b-.12)","duration:.03,ease:'power2.in'},Math.max(c.a,b-.03)");
 // Declare C before caption layout refers to it; replace the historical fixed chat/checklist section.
 html=html.replace('let captions=0;', 'const C='+escapeJson(bubbles)+';const CAPTION_RUNS='+escapeJson(captionRuns)+';\nlet captions=0;');
 const chatCode=`
const box=${escapeJson(layout.chat)};const baseY=box[1]*${plan.height};const gap=box[3]*${plan.height}+12;
const els=C.map((c,i)=>{const e=stage('chat','bubble'+i,c.a,c.b,'spoken-semantic-bubble',c.label);e.style.left=(box[0]*100)+'%';e.style.top=(box[1]*100)+'%';e.style.width=(box[2]*100)+'%';
const end=c.stack===0&&C[i+1]?.stack===1?C[i+1].b:c.b;
tl.fromTo(e,{opacity:0,x:11,y:9,scale:.965,filter:'blur(1px)'},{opacity:1,x:0,y:0,scale:1,filter:'blur(0px)',duration:.23,ease:'power2.out',immediateRender:false},c.a);
if(c.stack===1)tl.to('#bubble'+(i-1),{y:-gap,duration:.22,ease:'power2.inOut'},Math.max(C[i-1].a+.23,c.a-.22));
tl.to(e,{opacity:0,duration:.15,ease:'power2.in'},end-.15);return e;});
manifest.bubbleOnsets=C.map(c=>({seconds:c.a,text:c.label}));
`;
 html=html.replace(/\/\/ Spatial no-overlap contract:[\s\S]*?\/\/ Guard against future generated/,chatCode+'\n// Guard against future generated');
 html=html.replace("window.__timelines['editplus-sk-v28-speech-timed']=tl;", "window.__timelines['editplus-social-kinetic-v28-native']=tl;");
 const cssRect=(selector,r)=>`${selector}{left:${r[0]*100}%;top:${r[1]*100}%;width:${r[2]*100}%;}`;
 const s=plan.width/910,main=Math.round(portrait?plan.width*.115:66*s),caption=Math.round(portrait?plan.width*.044:27*s);
 const css=`html,body,#root{width:${plan.width}px;height:${plan.height}px}#shade{display:none}
${cssRect('.hero',layout.hero)}${cssRect('.micro,.micro.during-chat',layout.captionLeft)}${cssRect('.micro.right',layout.captionRight)}
.hero .word{font-size:${main}px;line-height:.98;font-weight:400;letter-spacing:-.045em;overflow-wrap:normal}.hero .hint{font-size:${Math.round(main*.37)}px;font-weight:400}.hero .word span{display:inline-block;white-space:pre}
.micro,.micro.right,.micro.during-chat{font-size:${caption}px;font-weight:400;line-height:1.15}
.chat{min-height:0;height:${Math.round(layout.chat[3]*plan.height)}px;padding:7px 12px;font-size:${Math.round(portrait?plan.width*.038:19*s)}px;font-weight:650;border-radius:19px 19px 7px 19px}
`;
 html=html.replace('</style>',css+'</style>');
 html=html.replace('data-duration="41.100000"',`data-duration="${plan.durationMs/1000}"`).replace('data-width="910"',`data-width="${plan.width}"`).replace('data-height="512"',`data-height="${plan.height}"`);
 if(html.includes('OLD_EDL')||html.includes("PAS D'ARGENT")||html.includes('IMG_0506'))throw fail('KINETIC_REFERENCE_FIXED_MEDIA_REMAIN');
 return html;
}
