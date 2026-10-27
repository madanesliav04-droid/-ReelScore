import { NextRequest } from "next/server";
import { SUPABASE_URL } from "@/lib/supabase";
import {proxyJobs} from "@/lib/jobs-proxy";
export const dynamic="force-dynamic";

async function proxy(req:NextRequest,{params}:{params:Promise<{fn:string;path:string[]}>}){
  const {fn,path}=await params;
  return proxyJobs(req,fn,path,SUPABASE_URL);
}
export const GET=proxy;
export const POST=proxy;
export const PUT=proxy;
export const PATCH=proxy;
export const DELETE=proxy;
