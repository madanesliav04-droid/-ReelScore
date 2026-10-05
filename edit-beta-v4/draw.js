import {els,state,PRESETS} from './state.js';

export function wordIndexAt(t){let i=state.words.findIndex(w=>t>=w.start&&t<=w.end+.06);if(i<0){const n=state.words.findIndex(w=>w.start>t);i=n>0?n-1:-1}return i}
function wordAt(t){const i=wordIndexAt(t);if(i<0)return null;const style=els.captionStyle.value,rad=style==='monoline'?1:style==='multiline'?4:2,from=Math.max(0,i-rad),to=Math.min(state.words.length,i+rad+1);return{list:state.words.slice(from,to),current:i-from,index:i}}
export function punchScale(t){const z=PRESETS[state.preset].zoom;for(const p of state.punchTimes)if(Math.abs(t-p)<.55)return z;return 1}

function sourceSize(media){return[media.videoWidth||media.naturalWidth||1080,media.videoHeight||media.naturalHeight||1920]}
function orientation(media){const[vw,vh]=sourceSize(media);return vh>vw*1.08?'portrait':vw>vh*1.08?'landscape':'square'}
function drawFit(ctx,media,w,h,z=1){const[vw,vh]=sourceSize(media),scale=Math.min(w/vw,h/vh)*z,dw=vw*scale,dh=vh*scale,x=(w-dw)/2,y=(h-dh)/2;ctx.drawImage(media,0,0,vw,vh,x,y,dw,dh)}
function drawFill(ctx,media,w,h,z=1){const[vw,vh]=sourceSize(media),ta=w/h,sa=vw/vh;let sw,sh,sx,sy;if(sa>ta){sh=vh;sw=vh*ta;sx=(vw-sw)/2;sy=0}else{sw=vw;sh=vw/ta;sx=0;sy=(vh-sh)/2}sw/=z;sh/=z;sx=(vw-sw)/2;sy=(vh-sh)/2;ctx.drawImage(media,sx,sy,sw,sh,0,0,w,h)}
function drawFramed(ctx,media,w,h,z=1,isBroll=false){
 const mode=els.framingMode?.value||'auto',ori=orientation(media),targetPortrait=h>w;
 ctx.fillStyle='#07080c';ctx.fillRect(0,0,w,h);
 if(mode==='fit'){drawFit(ctx,media,w,h,z);return}
 if(mode==='fill'){drawFill(ctx,media,w,h,z);return}
 if(mode==='vertical'){
  if(ori==='portrait'&&targetPortrait){drawFit(ctx,media,w,h,z);return}
  drawFill(ctx,media,w,h,z);return
 }
 // Auto: portrait sources stay intact in portrait outputs; landscape sources fill unless the crop would be extreme.
 if(targetPortrait&&ori==='portrait'){drawFit(ctx,media,w,h,z);return}
 if(isBroll&&targetPortrait&&ori==='square'){drawFit(ctx,media,w,h,z);return}
 drawFill(ctx,media,w,h,z)
}

export function drawCover(ctx,v,w,h,z=1){drawFramed(ctx,v,w,h,z,false)}
function drawGenericCover(ctx,media,w,h){drawFramed(ctx,media,w,h,1,true)}
function roundRect(ctx,x,y,w,h,r){ctx.beginPath();if(ctx.roundRect)ctx.roundRect(x,y,w,h,r);else ctx.rect(x,y,w,h)}
function wrapText(ctx,text,cx,cy,maxW,lineH){const words=text.split(/\s+/),lines=[];let line='';for(const w of words){const test=line?line+' '+w:w;if(ctx.measureText(test).width>maxW&&line){lines.push(line);line=w}else line=test}if(line)lines.push(line);const y0=cy-(lines.length-1)*lineH/2;lines.slice(0,3).forEach((l,i)=>ctx.fillText(l,cx,y0+i*lineH))}
function nearestText(t){if(!state.words.length)return state.preset==='podcast'?'MOMENT CLÉ':state.preset==='punch'?'À RETENIR':'POINT IMPORTANT';const i=Math.max(0,wordIndexAt(t));return state.words.slice(i,Math.min(state.words.length,i+6)).map(w=>w.text.toUpperCase()).join(' ')}
function drawGraphic(ctx,w,h,t){const text=nearestText(t);ctx.save();ctx.fillStyle='rgba(4,5,10,.72)';ctx.fillRect(0,0,w,h);const cardW=w*.84,cardH=h*(state.preset==='podcast'?.24:.2),x=(w-cardW)/2,y=h*.35;ctx.shadowColor='rgba(0,0,0,.45)';ctx.shadowBlur=w*.03;ctx.fillStyle=state.preset==='punch'?'rgba(255,95,167,.96)':'rgba(20,22,32,.96)';roundRect(ctx,x,y,cardW,cardH,w*.035);ctx.fill();ctx.shadowBlur=0;ctx.fillStyle=state.preset==='punch'?'#0b0b0f':'#fff';ctx.textAlign='center';ctx.textBaseline='middle';ctx.font=`900 ${Math.max(28,w*.06)}px Arial,Helvetica,sans-serif`;wrapText(ctx,text,w/2,y+cardH/2,cardW*.82,Math.max(34,w*.075));ctx.fillStyle='#9b7cff';ctx.font=`800 ${Math.max(16,w*.026)}px Arial`;ctx.fillText(state.preset==='podcast'?'QUOTE':'VISUAL',w/2,y-cardH*.16);ctx.restore()}
function activeVisual(t){return state.visualPlan.find(x=>t>=x.start&&t<x.end)||null}
export function drawVisual(ctx,w,h,t){const item=activeVisual(t);if(!item)return false;if(item.type==='asset'&&state.assets.length){const a=state.assets[item.assetIndex%state.assets.length];if(a.type==='video'){const local=(t-item.start)%Math.max(.2,a.duration);if(Math.abs((a.el.currentTime||0)-local)>.35){try{a.el.currentTime=local}catch{}}if(a.el.paused)a.el.play().catch(()=>{});if(a.el.readyState>=2){drawGenericCover(ctx,a.el,w,h);return true}}else{drawGenericCover(ctx,a.el,w,h);return true}}drawGraphic(ctx,w,h,t);return true}
function captionY(h){return els.captionPosition.value==='middle'?h*.53:els.captionPosition.value==='midlow'?h*.69:h*.79}
export function drawCaptions(ctx,w,h,t){const d=wordAt(t);if(!d)return;const style=els.captionStyle.value,fc=els.fontStyle.value,family=fc==='impact'?'Arial Black,Arial,sans-serif':fc==='editorial'?'Georgia,serif':'Arial,Helvetica,sans-serif',base=Math.max(30,w*.064),size=style==='minimal'?base*.78:base;ctx.save();ctx.textAlign='center';ctx.textBaseline='middle';ctx.lineJoin='round';ctx.font=`900 ${size}px ${family}`;const tokens=d.list.map(x=>x.text.trim().toUpperCase()).filter(Boolean),gap=size*.24,maxW=w*.86,lines=[];let line=[];for(const tok of tokens){const test=[...line,tok].join(' ');if(ctx.measureText(test).width>maxW&&line.length){lines.push(line);line=[tok]}else line.push(tok)}if(line.length)lines.push(line);const y0=captionY(h)-((lines.length-1)*(size*1.12))/2;let global=0;lines.forEach((arr,li)=>{const widths=arr.map(x=>ctx.measureText(x).width),total=widths.reduce((a,b)=>a+b,0)+gap*(arr.length-1);let x=(w-total)/2,y=y0+li*size*1.12;arr.forEach((tok,i)=>{const tw=widths[i],active=global===d.current;ctx.strokeStyle='rgba(0,0,0,.82)';ctx.lineWidth=Math.max(4,w*.007);if(style==='highlight'&&active){ctx.fillStyle='#ffd45a';roundRect(ctx,x-size*.08,y-size*.58,tw+size*.16,size*1.08,size*.1);ctx.fill();ctx.fillStyle='#101016';ctx.fillText(tok,x+tw/2,y)}else{ctx.strokeText(tok,x+tw/2,y);ctx.fillStyle=style==='karaoke'&&active?'#ffd45a':'#fff';ctx.fillText(tok,x+tw/2,y)}x+=tw+gap;global++})});ctx.restore()}
export function transitionOverlay(ctx,w,h,t,segStart){const type=PRESETS[state.preset].transition,dt=t-segStart;if(type==='none'||dt<0||dt>.13)return;const a=1-dt/.13;ctx.save();ctx.fillStyle=type==='flash'?`rgba(255,255,255,${a*.22})`:`rgba(5,6,10,${a*.16})`;ctx.fillRect(0,0,w,h);ctx.restore()}
export function dims(){const q=els.quality.value,r=els.aspectRatio.value,base=q==='2160'?2160:q==='720'?720:1080;if(r==='9:16')return[base,Math.round(base*16/9)];if(r==='4:5')return[base,Math.round(base*5/4)];if(r==='1:1')return[base,base];return[Math.round(base*16/9),base]}
