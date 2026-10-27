// Fixed upstream and bounded wait: never redirect a member's bearer token.
export async function proxyJobs(req: Request, fn: string, path: string[], origin: string, send: typeof fetch = fetch) {
  const headers = {"Cache-Control":"no-store, private"};
  if(!["viral-edit-jobs","clip-jobs"].includes(fn)||!path?.length||!path.every(x=>/^[a-zA-Z0-9_-]{1,100}$/.test(x)))
    return Response.json({error:"NOT_ALLOWED"},{status:404,headers});
  const auth=req.headers.get("authorization");
  if(!auth||!/^Bearer\s+\S+$/i.test(auth))return Response.json({error:"AUTH_REQUIRED"},{status:401,headers});
  const target=new URL(`/functions/v1/${fn}/${path.join("/")}`,origin);
  target.search=new URL(req.url).search;
  try {
    const upstream=await send(target,{
      method:req.method,headers:{Authorization:auth,"Content-Type":req.headers.get("content-type")||"application/json"},
      body:["GET","HEAD"].includes(req.method)?undefined:await req.arrayBuffer(),
      cache:"no-store",redirect:"error",signal:AbortSignal.timeout(13000)
    });
    const responseHeaders=new Headers(headers);
    responseHeaders.set("Content-Type",upstream.headers.get("content-type")||"application/json");
    const retry=upstream.headers.get("retry-after");if(retry)responseHeaders.set("Retry-After",retry);
    return new Response([204,205,304].includes(upstream.status)?null:await upstream.arrayBuffer(),{status:upstream.status,headers:responseHeaders});
  } catch {
    return Response.json({error:"BACKEND_UNREACHABLE",message:"Le serveur de traitement ne répond pas. Réessaie dans quelques instants."},{status:503,headers});
  }
}
