import {NextRequest,NextResponse} from "next/server";
import {BACKEND_DISABLED,SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY} from "@/lib/supabase";

// Same-origin gateway for browser-based authentication. This prevents Safari
// in-app browser privacy/network rules from silently dropping cross-origin
// GoTrue requests. Upstream is FIXED to our Supabase Auth service.
// No credentials, request bodies, tokens or emails are ever logged here.
export const runtime="nodejs";
export const dynamic="force-dynamic";

const ALLOWED=new Set([
  "token","signup","recover","verify","otp","user","logout",
  "settings","health","authorize","callback","reauthenticate",
  "mfa","invite","magiclink","sso"
]);

async function handler(req:NextRequest,{params}:{params:Promise<{path:string[]}>}){
  if(BACKEND_DISABLED)return NextResponse.json({code:"BACKEND_NOT_CONFIGURED",message:"La connexion est indisponible sur cet aperçu."},{status:503,headers:{"Cache-Control":"no-store, private"}});
  const {path}=await params;
  if(!path?.length||!ALLOWED.has(path[0])||
    !path.every(x=>/^[a-zA-Z0-9_-]{1,70}$/.test(x))){
    return NextResponse.json({code:"NOT_ALLOWED",message:"Requête non autorisée."},{status:404});
  }
  const search=req.nextUrl.search||"";
  const url=`${SUPABASE_URL}/auth/v1/${path.join("/")}${search}`;
  const headers=new Headers();
  headers.set("apikey",SUPABASE_PUBLISHABLE_KEY);
  headers.set("accept","application/json");
  for(const key of ["authorization","content-type","x-client-info","x-supabase-api-version"]){
    const value=req.headers.get(key);
    if(value)headers.set(key,value);
  }
  // Explicitly avoid any Railway, Next.js, or proxy caching of credentials.
  try{
    const result=await fetch(url,{
      method:req.method,
      headers,
      body:["GET","HEAD"].includes(req.method)?undefined:await req.arrayBuffer(),
      cache:"no-store",
      redirect:"manual",
      signal:AbortSignal.timeout(13000)
    });
    // Supabase GoTrue returns structured errors and sessions as JSON.
    const responseHeaders=new Headers({
      "Cache-Control":"no-store, private",
      "Content-Type":result.headers.get("content-type")||"application/json",
      "X-Content-Type-Options":"nosniff"
    });
    return new NextResponse(await result.arrayBuffer(),{
      status:result.status,
      headers:responseHeaders
    });
  }catch{
    // Never expose credentials or the upstream response to logs.
    return NextResponse.json({
      code:"auth_service_unreachable",
      message:"Le service de connexion ne répond pas. Réessaie dans quelques instants."
    },{status:503,headers:{"Cache-Control":"no-store, private"}});
  }
}
export const GET=handler;
export const POST=handler;
export const PUT=handler;
export const PATCH=handler;
export const DELETE=handler;
