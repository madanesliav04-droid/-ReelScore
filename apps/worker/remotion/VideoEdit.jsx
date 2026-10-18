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
    top:portrait?'52%':'12%',
    right:portrait?'5%':'3.5%',
    width:portrait?'90%':'36%',
    minHeight:portrait?185:122,
    boxSizing:'border-box',
    opacity:alpha,
    transform:`translate3d(0,${dy}px,0)`,
    border:'1px solid rgba(246,241,232,0.22)',
    background:'linear-gradient(135deg,rgba(29,31,36,.39),rgba(23,24,29,.19))',
    backdropFilter:'blur(11px)',
    WebkitBackdropFilter:'blur(11px)',
    borderRadius:portrait?19:14,
    boxShadow:'0 14px 42px rgba(0,0,0,.14),inset 0 1px rgba(255,255,255,.12)',
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
      <span style={{fontVariantNumeric:'tabular-nums',opacity:.45}}>EDIT / 03</span>
    </div>
    <div style={{padding:portrait?'21px 24px 24px':'16px 20px 21px'}}>
      <div style={{
        fontFamily:'Georgia,Times New Roman,serif',fontWeight:400,
        fontSize:portrait?38:Math.max(23,Math.min(39,headline.length>22?26:35)),
        lineHeight:1.14,letterSpacing:'-.025em',color:'#faf7f0',
        transform:`translateY(${(1-ease((t-120)/390))*7}px)`,
        opacity:ease((t-65)/390)
      }}>{headline}</div>
      <div style={{height:1,background:'linear-gradient(90deg,rgba(248,243,233,.29),rgba(248,243,233,0))',margin:'15px 0 12px',transformOrigin:'left',transform:`scaleX(${ease((t-140)/550)})`}}/>
      <div style={{
        fontFamily:'Arial,sans-serif',fontWeight:400,
        fontSize:portrait?20:15,lineHeight:1.38,
        color:'rgba(248,244,237,.82)',
        opacity:ease((t-210)/360)
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
