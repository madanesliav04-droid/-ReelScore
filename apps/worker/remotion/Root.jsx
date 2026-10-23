import React from 'react';
import {Composition} from 'remotion';
import {EditPlusVideo} from './VideoEdit.jsx';

const defaultProps={
  sourceUrl:'',
  durationMs:15000,
  timeline:{
    style:'creator_clean',
    captionPreset:'modern_bold',
    captionConfig:{},
    captions:[],
    punchIns:[],
    brollCues:[]
  }
};

export const Root=()=>(
  <Composition
    id="EditPlus"
    component={EditPlusVideo}
    durationInFrames={450}
    fps={30}
    width={1080}
    height={1920}
    defaultProps={defaultProps}
    calculateMetadata={({props})=>({
      durationInFrames:Math.max(1,Math.ceil((Number(props.durationMs)||1000)/1000*30)),
      fps:30,
      width:1080,
      height:1920
    })}
  />
);
