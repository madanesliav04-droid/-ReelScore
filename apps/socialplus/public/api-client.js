// Browser adapter: cookie session + CSRF, same-origin only. Engines stay server-side.
export function createApiClient(getState,{onExpired=()=>{}}={}){
 return async function api(path,options={}){
  if(!path.startsWith('/api/'))throw Error('Chemin API local requis.');
  const state=getState(),controller=state.abortController,userId=state.user?.id,csrf=state.csrf;
  const headers={...(options.body instanceof Blob?{}:{'Content-Type':'application/json'}),...options.headers};
  if(csrf)headers['X-CSRF-Token']=csrf;
  const response=await fetch(path,{...options,credentials:'same-origin',signal:controller.signal,headers});
  const data=await response.json().catch(()=>({}));
  const current=getState();
  if(controller!==current.abortController||controller.signal.aborted)throw Object.assign(Error('Cette session est fermée.'),{code:'SESSION_CHANGED'});
  if(!response.ok){
   const error=Object.assign(Error(data.message||`La demande a échoué (${response.status}).`),{code:data.code,status:response.status});
   const trace=data.trace_id||response.headers.get('X-Trace-Id');
   if(response.status>=500&&trace)error.message+=` Référence : ${trace}`;
   if(response.status===401&&userId)setTimeout(()=>{const s=getState();if(s.user?.id===userId&&s.csrf===csrf&&s.abortController===controller)onExpired();},0);
   throw error;
  }
  return data;
 };
}
