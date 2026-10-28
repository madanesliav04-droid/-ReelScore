import { createClient } from "@supabase/supabase-js";
import {resumableUploadUrl} from "./storage-endpoint";

export const BACKEND_DISABLED=process.env.NEXT_PUBLIC_SOCIALPLUS_BACKEND_DISABLED==="true";

if(!BACKEND_DISABLED&&(process.env.NEXT_PUBLIC_SOCIALPLUS_ALEX_ONLY==="true"||process.env.VERCEL_ENV==="preview")&&
  (!process.env.NEXT_PUBLIC_SUPABASE_URL||!process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY||process.env.NEXT_PUBLIC_SUPABASE_URL.includes("eiypztjpmxdiuaqxjuqx"))){
  throw new Error("Préproduction Alex : configurer explicitement un backend Supabase isolé et sa clé publique.");
}

// Explicit environment overrides permit real isolated local Auth/Storage tests.
// Only a publishable/anon key belongs in NEXT_PUBLIC_; never a service-role key.
export const SUPABASE_URL = BACKEND_DISABLED?"https://socialplus-backend-unconfigured.invalid":process.env.NEXT_PUBLIC_SUPABASE_URL||"https://eiypztjpmxdiuaqxjuqx.supabase.co";
export const SUPABASE_PUBLISHABLE_KEY = BACKEND_DISABLED?"sb_publishable_unconfigured":process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY||"sb_publishable_Wl8iv037-iZ59iStDPu96A_RMn-US2C";
export const SUPABASE_PROJECT_REF = new URL(SUPABASE_URL).hostname.split(".")[0];
// Hosted projects use the dedicated Storage domain; self-hosted/test stacks
// expose the same real resumable API on their configured origin.
export const SUPABASE_RESUMABLE_URL = resumableUploadUrl(SUPABASE_URL);
export const VIDEO_BUCKET = "viralplus-videos";

// Redirect GoTrue browser calls through the Social+ origin. User sessions
// still stay in supabase-js: the gateway never creates its own cookies.
export const authGatewayFetch:typeof fetch=(input,init)=>{
  const url=typeof input==="string"?input:input instanceof URL?input.href:input.url;
  const prefix=SUPABASE_URL+"/auth/v1/";
  if(url.startsWith(prefix)){
    // Keeps token?grant_type=password, signup, recover, refresh, and user
    // endpoint paths and query strings exactly unchanged.
    const suffix=url.slice(prefix.length);
    return fetch("/api/auth-gateway/"+suffix,init);
  }
  return fetch(input,init);
};

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  global: {fetch:authGatewayFetch},
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
});

export function functionUrl(name:string,path=""){
  const cleanPath = path.startsWith("/") ? path.slice(1) : path;
  return `/api/${name}${cleanPath ? `/${cleanPath}` : ""}`;
}
