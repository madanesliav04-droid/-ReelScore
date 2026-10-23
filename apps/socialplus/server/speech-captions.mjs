import {buildCaptionAss} from '../../worker/src/render.js';
const styles={
 'codie-omni-v60':{size:31,accent:'#C6B3DA',stroke:2},
 'alex-hormozi-v16':{size:28,accent:'#7D91DD',stroke:1},
 'leila-hormozi-v53':{size:25,accent:'#FFFFFF',stroke:1},
 'apple-premium-spatial':{size:26,accent:'#FFFFFF',stroke:1},
 'cinematic-storytelling-v7':{size:24,accent:'#E4BD71',stroke:1}
};
const color=hex=>'&H'+hex.slice(5,7)+hex.slice(3,5)+hex.slice(1,3)+'&';
const time=ms=>{const n=Math.max(0,Math.round(ms/10)),s=Math.floor(n/100);return `${Math.floor(s/3600)}:${String(Math.floor(s/60)%60).padStart(2,'0')}:${String(s%60).padStart(2,'0')}.${String(n%100).padStart(2,'0')}`;};
const clean=text=>String(text).replace(/[{}\\\r\n]/g,' ');

// Reuse the existing ASS header/style generator; replace only its legacy
// min-60ms active-word loop, which could overlap fast spoken tokens.
export function speechCaptionAss(base,model,meta,events=[]){
 const style=styles[model]||styles['leila-hormozi-v53'];
 const scale=Math.min(meta.width/910,meta.height/512),fontPx=Math.max(20,Math.round(style.size*scale));
 const sizeScale=Math.max(.55,Math.min(1.15,meta.height/1920));
 const config={...base.captionConfig,fontSize:fontPx/sizeScale,stroke:style.stroke,fontWeight:600};
 const header=buildCaptionAss({...base,captions:[],captionConfig:config},meta.width,meta.height);
 const lines=[];
 for(const caption of base.captions){
  for(let i=0;i<caption.words.length;i++){
   const word=caption.words[i],next=caption.words[i+1];
   let start=Math.max(caption.startMs,word.startMs);
   let end=Math.min(caption.endMs,word.endMs,next?.startMs??Infinity);
   if(next&&next.startMs-end<=60)end=next.startMs;
   if(model==='cinematic-storytelling-v7')for(const event of events){if(start>=event.startMs&&start<event.endMs)start=event.endMs;else if(start<event.startMs&&end>event.startMs)end=event.startMs;}
   if(Math.round(end/10)<=Math.round(start/10))continue;
   const fullscreen=model==='alex-hormozi-v16'&&events.some(e=>e.kind==='fullscreen'&&start<e.endMs&&end>e.startMs);
   const primary=fullscreen?'#202632':'#FFFFFF';
   const text=caption.words.map((w,j)=>`{\\c${color(j===i?style.accent:primary)}}${clean(w.text)}`).join(' ');
   lines.push(`Dialogue: 0,${time(start)},${time(end)},Default,,0,0,0,,${fullscreen?'{\\bord0\\shad0}':''}${text}`);
  }
 }
 return header+'\n'+lines.join('\n')+'\n';
}
