import React from 'react';
import {revealTimedWord} from './word-reveal.js';
import {AbsoluteFill,OffthreadVideo,interpolate,spring,useCurrentFrame,useVideoConfig} from 'remotion';

const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const ease=t=>1-Math.pow(1-clamp(t,0,1),3);
/** No overlay unless the story actually calls for that visual. */
const LeilaVisual=({scene,ms,portrait,theme})=>{
  const t=ms-scene.startMs,remain=scene.endMs-ms;
  const opacity=Math.min(ease(t/330),ease(remain/300));
  const lift=(1-ease(t/470))*11;
  const items=(scene.items||[]).map(s=>String(s||'').slice(0,110));
  const comparison=scene.type==='comparison'&&items.length===2;
  const sequence=(scene.type==='steps'||scene.type==='flow')&&items.length===2;
  const metric=scene.type==='metric'&&items.length===1;
  const emphasis=scene.type==='emphasis'&&items.length===1;
  if(!(comparison||sequence||metric||emphasis))return null;
  const place=scene.placement==='right'?'right':'left';
  const ink=theme?.[place]?.ink||'#f8f5ef';
  const position={
    position:'absolute',top:portrait?'13%':'15%',
    [place]:portrait?'7%':'4%',zIndex:4,
    width:portrait?'86%':comparison?'42%':'35%',
    pointerEvents:'none',opacity,
    transform:'translate3d(0,'+lift+'px,0)',
    color:ink,fontFamily:'Arial,sans-serif',boxSizing:'border-box'
  };
  const glass={
    background:'linear-gradient(150deg,rgba(28,30,33,.40),rgba(19,20,24,.23))',
    border:'1px solid rgba(246,243,236,.20)',
    borderRadius:portrait?18:13,overflow:'hidden',
    boxShadow:'0 14px 32px rgba(0,0,0,.13),inset 0 1px rgba(255,255,255,.10)',
    backdropFilter:'blur(9px)',WebkitBackdropFilter:'blur(9px)'
  };
  const fineText={
    fontFamily:'Georgia,Times New Roman,serif',fontWeight:400,
    letterSpacing:'-.022em',lineHeight:1.17,overflowWrap:'anywhere'
  };
  if(comparison)return <div style={position}>
    <div style={{...glass,color:'#faf6ef'}}>
      <div style={{padding:portrait?'15px 19px':'11px 16px',
        borderBottom:'1px solid rgba(243,239,231,.15)',
        fontSize:portrait?13:10,letterSpacing:'.16em',
        color:'rgba(249,246,237,.64)'}}>COMPARAISON</div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr'}}>
        {items.map((item,i)=><div key={i} style={{
          padding:portrait?'21px 16px 25px':'20px 15px 24px',
          minHeight:portrait?100:74,
          borderRight:i===0?'1px solid rgba(245,241,230,.19)':'none',
          opacity:ease((t-160-i*140)/370),
          ...fineText,fontSize:portrait?28:Math.max(18,item.length>22?19:26)
        }}>{item}</div>)}
      </div>
    </div>
  </div>;
  if(sequence)return <div style={position}>
    <div style={{display:'flex',alignItems:'stretch',gap:portrait?12:9}}>
      {items.map((item,i)=><React.Fragment key={i}>
        {i>0&&<div style={{alignSelf:'center',color:'rgba(246,241,230,.72)',
          fontSize:portrait?23:19,opacity:ease((t-280)/350)}}>→</div>}
        <div style={{
          flex:1,minWidth:0,padding:portrait?'16px 17px':'12px 14px',
          ...glass,color:'#faf6ef',opacity:ease((t-90-i*220)/380),
          ...fineText,fontSize:portrait?23:Math.max(16,item.length>26?16:21)
        }}>{item}</div>
      </React.Fragment>)}
    </div>
  </div>;
  if(metric)return <div style={position}>
    <div style={{display:'inline-flex',flexDirection:'column',alignItems:'flex-start',
      gap:portrait?11:8,padding:portrait?'10px 6px':'7px 5px',
      textShadow:ink==='#292522'?'0 2px 12px rgba(255,255,255,.55)':'0 3px 19px rgba(0,0,0,.6)'}}>
      <span style={{...fineText,fontSize:portrait?49:36,
        opacity:ease((t-90)/390)}}>{items[0]}</span>
      <span style={{height:1,width:'75%',background:'rgba(253,246,233,.71)',
        transformOrigin:'left',transform:'scaleX('+ease((t-160)/410)+')'}}/>
    </div>
  </div>;
  return <div style={position}>
    <div style={{display:'inline-block',maxWidth:'100%',padding:portrait?'8px':'6px',
      ...fineText,fontSize:portrait?35:29,
      fontStyle:'italic',textShadow:ink==='#292522'?'0 2px 12px rgba(255,255,255,.55)':'0 5px 24px rgba(0,0,0,.7)'}}>
      {items[0]}
    </div>
  </div>;
};

const POSITIONS={
  lower_middle:{bottom:280,left:70,right:70},
  lower_third:{bottom:220,left:68,right:68},
  middle_low:{bottom:380,left:60,right:60}
};

export const EditPlusVideo=({sourceUrl,durationMs,timeline})=>{
  const frame=useCurrentFrame();
  const {fps,width,height}=useVideoConfig();
  const leila=timeline?.style==='leila';
  const portrait=height>width;
  const ms=frame/fps*1000;
  const punch=(timeline?.punchIns||[]).find(p=>ms>=p.startMs&&ms<=p.endMs);
  const baseScale=punch?.scale||1;
  const punchStart=punch?Math.round(punch.startMs/1000*fps):frame;
  const local=Math.max(0,frame-punchStart);
  const ramp=punch?spring({fps,frame:local,config:{damping:18,stiffness:180,mass:.7}}):0;
  const scale=punch?interpolate(ramp,[0,1],[1,baseScale],{extrapolateRight:'clamp'}):1;
  const caption=(timeline?.captions||[]).find(c=>ms>=c.startMs&&ms<=c.endMs);
  const cfg=timeline?.captionConfig||{};

  return (
    <AbsoluteFill style={{backgroundColor:'#050507',overflow:'hidden'}}>
      <OffthreadVideo
        src={sourceUrl}
        style={{
          width:'100%',height:'100%',objectFit:leila?'contain':'cover',
          transform:`scale(${scale})`,
          transformOrigin:'50% 44%'
        }}
      />

      <AbsoluteFill style={{
        background:'linear-gradient(180deg,transparent 58%,rgba(5,5,7,.12) 72%,rgba(5,5,7,.46) 100%)',
        pointerEvents:'none'
      }}/>

      {leila?(timeline?.leilaScenes||[]).filter(s=>ms>=s.startMs&&ms<=s.endMs).map((s,i)=><LeilaVisual key={s.startMs+'-'+i} scene={s} ms={ms} portrait={portrait} theme={timeline.leilaTheme}/>):null}

      {caption?(
        <div style={{
          position:'absolute',
          ...(leila?{bottom:portrait?'8%':'5%',left:portrait?'8%':'21%',right:portrait?'8%':'21%'}:(POSITIONS[cfg.position]||POSITIONS.lower_middle)),
          display:'flex',justifyContent:'center',
          textAlign:'center',pointerEvents:'none'
        }}>
          <div style={{
            display:'inline-flex',justifyContent:'center',alignItems:'center',flexWrap:'wrap',
            gap:'0 .28em',
            maxWidth:940,
            padding:cfg.background?'14px 22px':'0',
            borderRadius:cfg.background?22:0,
            background:cfg.background?'rgba(5,5,7,.58)':'transparent',
            backdropFilter:cfg.background?'blur(10px)':'none',
            fontFamily:cfg.fontFamily||'Inter,Arial,sans-serif',
            fontWeight:cfg.fontWeight||900,
            fontSize:leila?(portrait?Math.min(48,width*.052):Math.min(40,width*.032)):(cfg.fontSize||72),
            lineHeight:cfg.lineHeight||1,
            letterSpacing:'-0.045em',
            textTransform:'none'
          }}>
            {(caption.words||[]).map((word,i)=>{
              const wordState=leila?revealTimedWord(ms,word):null;
              const active=leila?wordState.active:(cfg.activeWord&&ms>=word.startMs&&ms<=word.endMs);
              return (
                <span key={i} style={{
                  display:'inline-block',
                  opacity:leila?wordState.opacity:1,
                  color:active?(cfg.activeColor||'#ff6a00'):(cfg.textColor||'#fff'),
                  WebkitTextStroke:`${cfg.stroke||0}px rgba(5,5,7,.92)`,
                  paintOrder:'stroke fill',
                  textShadow:cfg.shadow?'0 5px 17px rgba(0,0,0,.84)':'none',
                  transform:leila?'scale('+wordState.scale+')':active?'scale(1.055)':'scale(1)',
                  transformOrigin:'50% 70%'
                }}>{word.text}</span>
              );
            })}
          </div>
        </div>
      ):null}
    </AbsoluteFill>
  );
};
