// Infrastructure-only image. This is not an Alex preset or model replacement.
import React from 'react';
import {Composition,registerRoot} from 'remotion';
const Probe=()=> <div style={{width:'100%',height:'100%',background:'#15213b',color:'white',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'sans-serif'}}>Social+ infrastructure probe</div>;
registerRoot(()=> <Composition id="InfrastructureProbe" component={Probe} durationInFrames={30} fps={30} width={320} height={180}/>);
