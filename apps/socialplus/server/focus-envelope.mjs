const smooth=x=>{const p=Math.max(0,Math.min(1,x));return p*p*(3-2*p);};
// Exact V10 entry/release envelopes sampled on the compositor's 30fps clock.
// sendcmd changes blend opacity once per frame, rather than evaluating time
// expressions for every pixel and color plane.
export function focusOpacityCommands(events,durationMs,fps=30){
 const rows=[];let previous=null;
 for(let frame=0;frame<Math.ceil(durationMs/1000*fps);frame++){
  const t=frame/fps,strength=Math.max(0,...events.map(e=>Math.min(smooth((t-e.startMs/1000)/.58),smooth((e.endMs/1000-t)/.55))));
  const opacity=(1-.62*strength).toFixed(6);
  if(opacity!==previous){rows.push(`${t.toFixed(6)} blend@spatial all_opacity ${opacity};`);previous=opacity;}
 }
 return rows.join('\n')+'\n';
}
