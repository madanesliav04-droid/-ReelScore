/** Edit+ V19 format policy. This module does not render media by itself. */
export const V19_PRESETS=Object.freeze({
 ugc_natif:{ratio:'9:16',font:'Inter',weight:600,fullScreenBroll:true},
 impact:{ratio:'9:16',font:'Archivo Black',weight:900,fullScreenBroll:true},
 alex:{ratio:'9:16',font:'Montserrat',weight:800,fullScreenBroll:true},
 v15b_horizontal:{ratio:'16:9',font:'Plus Jakarta Sans',weight:600,fullScreenBroll:false}
});
const PORTRAIT=new Set(['ugc_natif','impact','alex']);
export function checkV19Format({model,width,height,outputFormat='native'}){
 const preset=V19_PRESETS[model];
 if(!preset)return {ok:false,code:'UNKNOWN_MODEL'};
 const w=Number(width),h=Number(height);
 if(!Number.isFinite(w)||!Number.isFinite(h)||w<=0||h<=0)return {ok:false,code:'INVALID_DIMENSIONS'};
 const portrait=h>w;
 if(model==='v15b_horizontal'&&portrait)return {ok:false,code:'HORIZONTAL_REQUIRED',suggest:['ugc_natif','impact','alex']};
 if(PORTRAIT.has(model)&&!portrait)return {ok:false,code:'VERTICAL_REQUIRED',suggest:['v15b_horizontal']};
 const target=outputFormat==='native'?(portrait?'portrait':'landscape'):outputFormat;
 if(target!==(portrait?'portrait':'landscape'))return {ok:false,code:'REQUIRES_CROP_OR_PADDING',suggest:'native'};
 return {ok:true,model,width:w,height:h,aspect:w/h,outputFormat:target,policy:preset};
}
export function applyV19Safety({model,width,height,outputFormat='native',timeline={}}){
 const format=checkV19Format({model,width,height,outputFormat});
 if(!format.ok)return {ok:false,error:format};
 const horizontal=model==='v15b_horizontal';
 return {ok:true,format,model,timeline:{...timeline,
   width:format.width,height:format.height,
   brollCues:horizontal?[]:(Array.isArray(timeline.brollCues)?timeline.brollCues:[]),
   graphicCues:Array.isArray(timeline.graphicCues)?timeline.graphicCues:[],
   compositing:horizontal?'keep_original_full_frame_small_overlays':'semantic_broll_if_licensed',
   fullScreenBrollAllowed:!horizontal,
   preserveSourceFPS:true,preventFaceOcclusion:true,requireTranscriptWordAlignment:true
 }};
}
