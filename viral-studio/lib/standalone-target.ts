export function standaloneTarget(origin:string|undefined,verified:string|undefined):string|null{
 if(verified!=='true'||!origin)return null;
 try{const url=new URL(origin);if(url.protocol!=='https:'||url.username||url.password||url.port||url.pathname!=='/'||url.search||url.hash||url.hostname.endsWith('.supabase.co')||url.hostname.endsWith('.r2.cloudflarestorage.com'))return null;return url.origin;}catch{return null}
}
