import React from 'react';
import {AbsoluteFill,OffthreadVideo,interpolate,spring,useCurrentFrame,useVideoConfig} from 'remotion';

const POSITIONS={
  lower_middle:{bottom:280,left:70,right:70},
  lower_third:{bottom:220,left:68,right:68},
  middle_low:{bottom:380,left:60,right:60}
};

export const EditPlusVideo=({sourceUrl,durationMs,timeline})=>{
  const frame=useCurrentFrame();
  const {fps}=useVideoConfig();
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
          width:'100%',height:'100%',objectFit:'cover',
          transform:`scale(${scale})`,
          transformOrigin:'50% 44%'
        }}
      />

      <AbsoluteFill style={{
        background:'linear-gradient(180deg,transparent 58%,rgba(5,5,7,.12) 72%,rgba(5,5,7,.46) 100%)',
        pointerEvents:'none'
      }}/>

      {caption?(
        <div style={{
          position:'absolute',
          ...(POSITIONS[cfg.position]||POSITIONS.lower_middle),
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
            fontSize:cfg.fontSize||72,
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
                  transform:active?'scale(1.055)':'scale(1)',
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
