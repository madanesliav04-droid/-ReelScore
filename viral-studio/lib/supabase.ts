import { createClient } from "@supabase/supabase-js";

export const SUPABASE_URL = "https://eiypztjpmxdiuaqxjuqx.supabase.co";
export const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_Wl8iv037-iZ59iStDPu96A_RMn-US2C";
export const SUPABASE_PROJECT_REF = "eiypztjpmxdiuaqxjuqx";
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
