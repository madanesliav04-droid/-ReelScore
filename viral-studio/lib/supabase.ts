import { createClient } from "@supabase/supabase-js";

export const SUPABASE_URL = "https://eiypztjpmxdiuaqxjuqx.supabase.co";
export const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_Wl8iv037-iZ59iStDPu96A_RMn-US2C";
export const SUPABASE_PROJECT_REF = "eiypztjpmxdiuaqxjuqx";
export const VIDEO_BUCKET = "viralplus-videos";

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
});

export function functionUrl(name:string,path=""){
  const cleanPath = path.startsWith("/") ? path.slice(1) : path;
  return `/api/${name}${cleanPath ? `/${cleanPath}` : ""}`;
}
