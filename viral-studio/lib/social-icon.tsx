import {ImageResponse} from "next/og";

export function socialIcon(size:192|512|180){
  const mark=Math.round(size*.34);
  return new ImageResponse(
    <div style={{width:"100%",height:"100%",display:"flex",alignItems:"center",justifyContent:"center",background:"linear-gradient(145deg,#18252d 0%,#080c11 78%)",borderRadius:size*.22,position:"relative"}}>
      <div style={{position:"absolute",inset:Math.round(size*.092),border:`${Math.max(1,Math.round(size*.008))}px solid rgba(164,228,202,.32)`,borderRadius:Math.round(size*.18),display:"flex"}}/>
      <div style={{display:"flex",alignItems:"center",justifyContent:"center",width:"72%",height:"72%",position:"relative"}}>
        <span style={{fontFamily:"sans-serif",fontWeight:900,fontSize:Math.round(size*.53),lineHeight:1,color:"#f2faf8",letterSpacing:"-0.13em",paddingRight:Math.round(size*.09)}}>S</span>
        <span style={{fontFamily:"sans-serif",position:"absolute",top:Math.round(size*.025),right:Math.round(size*.015),fontWeight:800,fontSize:Math.round(size*.27),lineHeight:1,color:"#a9efd1"}}>+</span>
      </div>
    </div>,
    {width:size,height:size}
  );
}
