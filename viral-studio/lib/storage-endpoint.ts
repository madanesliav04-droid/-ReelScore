export function resumableUploadUrl(supabaseUrl:string){
  const url=new URL("/storage/v1/upload/resumable",supabaseUrl);
  if(url.hostname.endsWith(".supabase.co")){
    url.hostname=url.hostname.replace(/\.supabase\.co$/, ".storage.supabase.co");
  }
  return url.href;
}
