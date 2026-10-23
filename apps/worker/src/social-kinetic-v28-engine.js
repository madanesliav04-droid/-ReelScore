/**
 * Edit+ Social Kinetic V28 – general-purpose implementation of the approved
 * visual language. The 41.1s user demo is NOT used as a reusable time template.
 * Speech text, triggers and locations are taken from validated job evidence.
 */
import {buildSocialKineticV10WordPlan} from './social-kinetic-v10-word-plan.js';

const finite=n=>typeof n==='number'&&Number.isFinite(n);
const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'')
  .replace(/[’']/g,' ').toLowerCase().replace(/[^a-z0-9€%]+/g,' ').trim();
const escape=s=>String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;')
  .replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
const intersects=(a,b,pad=0)=>{
 const x=Math.max(0,Math.min(a.x+a.w+pad,b.x+b.w+pad)-Math.max(a.x-pad,b.x-pad));
 const y=Math.max(0,Math.min(a.y+a.h+pad,b.y+b.h+pad)-Math.max(a.y-pad,b.y-pad));
 return x*y>0;
};
const simult=(a,b)=>a.startMs<b.endMs-25&&b.startMs<a.endMs-25;
export const SOCIAL_KINETIC_V28_STYLE=Object.freeze({
 model:'social_kinetic_v28',label:'Social Kinetic V28',
 reference:'reference-video-style-not-hardcoded-timeline',
 white:'#FFFFFF',green:'#2E5F34',blue:'#0C63BC',
 captions:'V16 white condensed, word appearing progressively',
 bubbles:'iOS-like blue; only verified spoken phrases, no invented chats',
 metrics:'only verified spoken amounts',
 export:'original source aspect, one original speech track',
 release:'staging_until_3_independent_e2e_and_word_audio_review'
});
export function buildSocialKineticV28Plan(args={}){
 const v10=buildSocialKineticV10WordPlan(args);
 if(v10.status!=='staging_renderable')return {...v10,model:'social_kinetic_v28',version:'28',releaseApproved:false};
 const events=v10.events.map(e=>({...e,kind:e.kind==='keyword'?'hero':e.kind})).sort((a,b)=>a.startMs-b.startMs);
 const accepted=[],held=[...(v10.held||[])];
 // Never silently conceal spoken captions behind a second graphic.
 for(const e of events.filter(e=>e.kind==='caption')){
  if(!e.words?.length){held.push({id:e.id,reason:'EMPTY_VERIFIED_CAPTION'});continue;}
  accepted.push(e);
 }
 for(const e of events.filter(e=>e.kind!=='caption')){
  if(e.kind==='bubble'&&!norm(e.sourceEvidence||e.text)){
   held.push({id:e.id,reason:'BUBBLE_WITHOUT_SPOKEN_ANCHOR'});continue;
  }
  // Visual safeRect proof is already demanded by V10. Also check graphics against
  // verified caption rectangles, not only face/hand rectangles.
  if(accepted.some(prev=>simult(prev,e)&&intersects(prev.rect,e.rect,.012))){
   held.push({id:e.id,reason:'TEXT_OR_GRAPHIC_COLLISION'});continue;
  }
  accepted.push(e);
 }
 accepted.sort((a,b)=>a.startMs-b.startMs);
 return {...v10,model:'social_kinetic_v28',version:'28',
  status:accepted.length?'staging_renderable':'blocked',
  reason:accepted.length?null:'NO_PROVEN_FACE_SAFE_EVENTS',
  events:accepted,held,releaseApproved:false,
  previewOnly:true,style:SOCIAL_KINETIC_V28_STYLE};
}
export function socialKineticV28Html(plan,{width,height,fps=30}={}){
 if(plan?.model!=='social_kinetic_v28'||plan.status!=='staging_renderable'||!plan.events?.length)
   throw new Error('V28_VERIFIED_SCENE_REQUIRED');
 if(!Number.isInteger(width)||!Number.isInteger(height)||width<320||height<240)
   throw new Error('V28_INVALID_NATIVE_FRAME');
 if(!finite(plan.durationMs)||plan.durationMs<=0)throw new Error('V28_INVALID_DURATION');
 const sec=n=>(n/1000).toFixed(3);
 const scale=Math.min(width/910,height/512),captionFont=Math.round(29*scale),
   heroFont=Math.round(74*scale),bubbleFont=Math.round(19*scale);
 const divs=plan.events.map((e,i)=>{
  const r=e.rect;
  if(!r||![r.x,r.y,r.w,r.h].every(finite))throw new Error('V28_MISSING_SAFE_RECT:'+i);
  const css='left:'+Math.round(width*r.x)+'px;top:'+Math.round(height*r.y)+'px;'+
    'width:'+Math.round(width*r.w)+'px;height:'+Math.round(height*r.h)+'px;';
  const kind=['caption','bubble','hero','metric'].includes(e.kind)?e.kind:'caption';
  const content=kind==='caption'
    ?e.words.map((w,k)=>'<span class="word" id="w'+i+'_'+k+'">'+escape(w.text.toUpperCase())+'</span>').join(' ')
    :escape(e.text.toUpperCase());
  return '<div class="event '+kind+'" id="e'+i+'" data-track-index="2"'+
   ' data-start="'+sec(e.startMs)+'" data-duration="'+sec(e.endMs-e.startMs)+'" style="'+css+'">'+
   '<div class="inner" id="i'+i+'">'+content+'</div></div>';
 }).join('');
 const cues=[];
 for(let i=0;i<plan.events.length;i++){
  const e=plan.events[i],a=sec(e.startMs),caption=e.kind==='caption';
  const first=e.words?.[0],last=e.words?.at(-1);
  const wordDuration=w=>Math.max(1,w.outputEndMs-w.outputStartMs);
  // Speech captions must remain readable through their last word and leave
  // before the next group. Keep the original timing for non-speech graphics.
  const fadeMs=caption?Math.min(140,wordDuration(last)/4):140;
  const exit=sec(caption?e.endMs-fadeMs:Math.max(e.startMs+200,Math.min(e.endMs-155,plan.durationMs-130)));
  const speechFade=(ms,maximum)=>ms<1000/fps?0:Math.min(maximum,ms/1000);
  const dy=e.kind==='hero'?18:9,dur=caption?speechFade(wordDuration(first),.19):e.kind==='hero'?.26:.19;
  cues.push('tl.fromTo("#i'+i+'",{opacity:0,y:'+dy+',scale:'+(e.kind==='hero'?.87:.97)+
    '},{opacity:1,y:0,scale:1,duration:'+dur+',ease:"power2.out",immediateRender:false},'+a+');');
  if(e.kind==='caption'){
    for(let k=0;k<e.words.length;k++){
     const wordFade=speechFade(wordDuration(e.words[k]),.17);
     cues.push('tl.fromTo("#w'+i+'_'+k+'",{opacity:0,y:5},{opacity:1,y:0,duration:'+wordFade+',ease:"power2.out",immediateRender:false},'+sec(e.words[k].outputStartMs)+');');
    }
  }
  cues.push('tl.to("#i'+i+'",{opacity:0,y:-4,duration:'+fadeMs/1000+',ease:"power2.in"},'+exit+');');
 }
 const info={model:'social_kinetic_v28',durationMs:plan.durationMs,
   approvedEvents:plan.events.length,withheld:plan.held?.length||0,source:'verified_words_and_independent_safe_rects'};
 // Keep exact source aspect, no third-party video or original iOS notification audio.
 return '<!doctype html><html lang="fr"><head><meta charset="utf-8"><style>'+
 '@font-face{font-family:"DejaVu Sans Condensed";src:local("DejaVu Sans Condensed");font-weight:100 900}'+
 '@font-face{font-family:"Arial";src:local("Arial");font-weight:100 900}'+
 '*{box-sizing:border-box}html,body{margin:0;padding:0;background:transparent!important;width:'+width+'px;height:'+height+'px;overflow:hidden}'+
 '#root{width:100%;height:100%;position:relative;isolation:isolate;font-family:"DejaVu Sans Condensed",Arial,sans-serif}'+
 '.event{position:absolute;pointer-events:none;overflow:visible}.inner{opacity:0;position:relative;color:#fff;'+
 'text-shadow:0 2px 8px #000c;font-size:'+captionFont+'px;letter-spacing:-.025em;font-weight:900;line-height:1.12}'+
 '.word{display:inline-block;white-space:nowrap;opacity:0;margin-right:.19em}'+
 '.hero .inner{font-size:'+heroFont+'px;letter-spacing:-.052em;line-height:.95;color:#2E5F34;'+
 'text-shadow:0 1px 2px #ffffff85;font-weight:900}'+
 '.bubble .inner{font-family:Arial,sans-serif;font-size:'+bubbleFont+'px;line-height:1.14;letter-spacing:-.015em;'+
 'color:#FFFFFF;background:#0C63BC;border-radius:'+Math.round(19*scale)+'px '+Math.round(19*scale)+'px '+Math.round(7*scale)+'px '+Math.round(19*scale)+'px;'+
 'padding:'+Math.round(11*scale)+'px '+Math.round(14*scale)+'px;text-align:center;font-weight:700;box-shadow:0 5px 13px #081e3e40}'+
 '.bubble .inner::after{content:"";position:absolute;right:-'+Math.round(4*scale)+'px;bottom:0;width:'+Math.round(14*scale)+'px;height:'+Math.round(15*scale)+'px;'+
 'background:#0C63BC;transform:skewX(-17deg);border-radius:0 0 12px 1px;z-index:-1}'+
 '.metric .inner{font-size:'+Math.round(captionFont*1.4)+'px;color:#fff}'+
 '</style></head><body><div id="root" data-composition-id="editplus-social-kinetic-v28-native" data-start="0" data-duration="'+sec(plan.durationMs)+'"'+
 ' data-width="'+width+'" data-height="'+height+'" data-fps="'+fps+'">'+divs+'</div>'+
 '<script src="https://cdn.jsdelivr.net/npm/gsap@3.13.0/dist/gsap.min.js"></script>'+
 '<script>const tl=gsap.timeline({paused:true});'+cues.join('')+
 'window.__timelines=window.__timelines||{};window.__timelines["editplus-social-kinetic-v28-native"]=tl;'+
 'window.__sceneManifest='+JSON.stringify(info)+';</script></body></html>';
}

