import React from 'react';
import {AbsoluteFill,OffthreadVideo,interpolate,spring,useCurrentFrame,useVideoConfig} from 'remotion';

const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const ease=t=>1-Math.pow(1-clamp(t,0,1),3);
const LeilaGlass=({scene,ms,portrait})=>{
  const t=ms-scene.startMs,remain=scene.endMs-ms;
  const alpha=Math.min(ease(t/380),ease(remain/340));
  const dy=(1-ease(t/500))*14;
  const headline=String(scene.lines?.[0]||'').slice(0,90);
  const detail=String(scene.lines?.[1]||'').slice(0,160);
  return <div style={{
    position:'absolute',
    zIndex:3,
    top:portrait?'54%':'14%',
    left:portrait?'5%':'3%',
    width:portrait?'90%':'30%',
    minHeight:portrait?185:178,
    boxSizing:'border-box',
    opacity:alpha,
    transform:`translate3d(0,${dy}px,0)`,
    border:'1px solid rgba(246,241,232,0.22)',
    background:'linear-gradient(145deg,rgba(43,43,42,.54),rgba(39,38,38,.35))',
    backdropFilter:'blur(11px)',
    WebkitBackdropFilter:'blur(11px)',
    borderRadius:portrait?17:13,
    boxShadow:'0 12px 36px rgba(0,0,0,.11),inset 0 1px rgba(255,255,255,.09)',
    overflow:'hidden',
    pointerEvents:'none'
  }}>
    <div style={{
      display:'flex',alignItems:'center',justifyContent:'space-between',
      borderBottom:'1px solid rgba(246,241,232,.16)',
      padding:portrait?'19px 24px 14px':'14px 20px 10px',
      fontFamily:'Arial,sans-serif',fontWeight:500,
      letterSpacing:'0.17em',fontSize:portrait?17:11,color:'rgba(253,249,240,.79)'
    }}>
      <span>{scene.label}</span>
      <span style={{fontVariantNumeric:'tabular-nums',opacity:.45}}>PAROLES</span>
    </div>
    <div style={{
      display:'grid',gridTemplateColumns:'minmax(75px,30%) 1fr',
      backgroundImage:'linear-gradient(rgba(247,241,232,.045) 1px,transparent 1px)',
      backgroundSize:'100% 43px'
    }}>
      <div style={{
        borderRight:'1px solid rgba(247,241,232,.15)',
        borderBottom:'1px solid rgba(247,241,232,.13)',
        padding:portrait?'18px 11px 18px 22px':'17px 9px 16px 17px',
        fontFamily:'Arial,sans-serif',fontSize:portrait?13:10,
        fontWeight:500,letterSpacing:'0.13em',color:'rgba(247,241,232,.58)'
      }}>MOT CLÉ</div>
      <div style={{
        borderBottom:'1px solid rgba(247,241,232,.13)',
        padding:portrait?'15px 18px':'13px 15px',
        fontFamily:'Georgia,Times New Roman,serif',fontWeight:400,
        fontSize:portrait?32:Math.max(19,headline.length>22?20:26),
        lineHeight:1.17,letterSpacing:'-.025em',color:'#faf7f0',
        opacity:ease((t-75)/390),transform:`translateY(${(1-ease((t-100)/410))*7}px)`
      }}>{headline}</div>
      <div style={{
        borderRight:'1px solid rgba(247,241,232,.15)',
        padding:portrait?'19px 11px 22px 22px':'16px 9px 20px 17px',
        fontFamily:'Arial,sans-serif',fontSize:portrait?13:10,
        fontWeight:500,letterSpacing:'0.13em',color:'rgba(247,241,232,.58)'
      }}>CONTEXTE</div>
      <div style={{
        padding:portrait?'16px 18px 22px':'13px 15px 20px',
        fontFamily:'Arial,sans-serif',fontWeight:400,
        fontSize:portrait?19:14,lineHeight:1.42,
        color:'rgba(248,244,237,.82)',
        opacity:ease((t-210)/380)
      }}>{detail}</div>
    </div>
    <div style={{
      position:'absolute',width:'34%',height:1,bottom:0,left:0,
      background:'rgba(250,245,233,.56)',
      transformOrigin:'left',transform:`scaleX(${ease(t/500)})`
    }}/>
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

      {leila?(timeline?.leilaScenes||[]).filter(s=>ms>=s.startMs&&ms<=s.endMs).map((s,i)=><LeilaGlass key={s.startMs+'-'+i} scene={s} ms={ms} portrait={portrait}/>):null}

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
            fontSize:leila?(portrait?Math.min(46,width*.044):Math.min(27,width*.026)):(cfg.fontSize||72),
            lineHeight:cfg.lineHeight||1,
            letterSpacing:'-0.045em',
            textTransform:'none'
          }}>
            {(caption.words||[]).map((word,i)=>{
              const active=cfg.activeWord&&ms>=word.startMs&&ms<=word.endMs;
              return (
                <span key={i} style={{
                  color:active?(cfg.activeColor||'#ff6a00'):(cfg.textColor||'#fff'),
                  WebkitTextStroke:`${cfg.stroke||0}px rgba(5,5,7,.92)`,
                  paintOrder:'stroke fill',
                  textShadow:cfg.shadow?'0 6px 22px rgba(0,0,0,.55)':'none',
                  transform:leila?'scale(1)':active?'scale(1.055)':'scale(1)',
                  transition:'transform 80ms linear'
                }}>{word.text}</span>
              );
            })}
          </div>
        </div>
      ):null}
    </AbsoluteFill>
  );
};
