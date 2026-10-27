// Transport aliases only. Never substitute one of the six artistic models.
const implemented=new Set(['creator_clean','business_viral','codie','leila','cinematic_story','ugc_native']);
const aliases={clean:'creator_clean',impact:'business_viral',alex_hormozi:'hormozi_omni'};
export function editContract(value,{alexReconstruction=false}={}){
 const requested=String(value||'clean'),workerStyle=aliases[requested]||requested;
 if(workerStyle==='hormozi_omni')return alexReconstruction
  ?{ok:true,requested,workerStyle,projectStyle:workerStyle,reconstruction:true}
  :{ok:false,code:'ALEX_V16_SOURCE_REQUIRED',requested,workerStyle,message:'La reconstruction Alex V16 reste en validation. Son raccordement est désactivé par défaut ; aucun preset de remplacement ne sera lancé.'};
 if(!implemented.has(workerStyle))return {ok:false,code:'EDIT_STYLE_NOT_IMPLEMENTED',requested,workerStyle,message:'Ce modèle ne possède pas de pipeline raccordé sur ce worker.'};
 return {ok:true,requested,workerStyle,projectStyle:workerStyle==='creator_clean'?'clean':workerStyle==='business_viral'?'impact':workerStyle};
}
