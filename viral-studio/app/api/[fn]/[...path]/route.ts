import { NextRequest, NextResponse } from "next/server";
import { SUPABASE_URL } from "@/lib/supabase";

const ALLOWED = new Set(["viral-edit-jobs","clip-jobs"]);

async function proxy(req:NextRequest,{params}:{params:Promise<{fn:string;path:string[]}>}){
  const {fn,path}=await params;
  if(!ALLOWED.has(fn)) return NextResponse.json({error:"NOT_ALLOWED"},{status:404});
  const auth=req.headers.get("authorization");
  if(!auth) return NextResponse.json({error:"AUTH_REQUIRED"},{status:401});
  const target=`${SUPABASE_URL}/functions/v1/${fn}/${(path||[]).join("/")}`;
  const init:RequestInit={method:req.method,headers:{Authorization:auth,"Content-Type":req.headers.get("content-type")||"application/json"}};
  if(!["GET","HEAD"].includes(req.method)) init.body=await req.text();
  const upstream=await fetch(target,init);
  const text=await upstream.text();
  return new NextResponse(text,{status:upstream.status,headers:{"Content-Type":upstream.headers.get("content-type")||"application/json","Cache-Control":"no-store"}});
}
export const GET=proxy;
export const POST=proxy;
export const PUT=proxy;
export const PATCH=proxy;
export const DELETE=proxy;
