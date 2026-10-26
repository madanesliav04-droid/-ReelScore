// ffprobe dimensions describe encoded pixels; iPhone rotation describes display.
export function displayFrame(video){
 const rawWidth=Number(video?.width),rawHeight=Number(video?.height);
 if(!Number.isInteger(rawWidth)||!Number.isInteger(rawHeight)||rawWidth<2||rawHeight<2)throw Object.assign(new Error('Aucune piste vidéo exploitable.'),{code:'VIDEO_STREAM_REQUIRED'});
 const rotation=((Math.round(Number(video.side_data_list?.find(x=>x.rotation!==undefined)?.rotation??video.tags?.rotate??0))%360)+360)%360;
 if(![0,90,180,270].includes(rotation))throw Object.assign(new Error('Rotation vidéo non prise en charge sans modifier le cadrage.'),{code:'VIDEO_ROTATION_UNSUPPORTED'});
 return {width:rotation%180?rawHeight:rawWidth,height:rotation%180?rawWidth:rawHeight,rawWidth,rawHeight,rotation};
}
