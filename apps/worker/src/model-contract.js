// Transport aliases only. Never substitute one of the six artistic models.
const implemented=new Set(['creator_clean','business_viral','codie','leila','cinematic_story','ugc_native']);
const aliases={clean:'creator_clean',impact:'business_viral',alex_hormozi:'hormozi_omni'};
export function editContract(value){
 const requested=String(value||'clean'),workerStyle=aliases[requested]||requested;
 if(workerStyle==='hormozi_omni')return {ok:false,code:'ALEX_V16_SOURCE_REQUIRED',requested,workerStyle,message:'Le générateur plein écran V11/V16 est absent de cette branche. Le module historique retrouvé ne certifie pas la V16. Aucun preset de remplacement ne sera lancé.'};
 if(!implemented.has(workerStyle))return {ok:false,code:'EDIT_STYLE_NOT_IMPLEMENTED',requested,workerStyle,message:'Ce modèle ne possède pas de pipeline raccordé sur ce worker.'};
 return {ok:true,requested,workerStyle,projectStyle:workerStyle==='creator_clean'?'clean':workerStyle==='business_viral'?'impact':workerStyle};
}
