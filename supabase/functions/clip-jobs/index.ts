import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {createClient} from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL=Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ALLOWED_ORIGIN=Deno.env.get("ALLOWED_ORIGIN")||"https://madanesliav04-droid.github.io";
const VIDEO_BUCKET="viralplus-videos";
const CORS={
  "Access-Control-Allow-Origin":ALLOWED_ORIGIN,
  "Access-Control-Allow-Headers":"authorization,content-type,apikey,x-client-info",
  "Access-Control-Allow-Methods":"GET,POST,OPTIONS",
  "Access-Control-Max-Age":"86400",
  "Vary":"Origin"
};

function out(body:unknown,status=200){return new Response(JSON.stringify(body),{status,headers:{...CORS,"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"}})}
function uuid(v:unknown){return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(v||""))}
function admin(){return createClient(SUPABASE_URL,SERVICE_KEY,{auth:{persistSession:false,autoRefreshToken:false}})}
function asUser(req:Request){const auth=req.headers.get("Authorization")||"";return createClient(SUPABASE_URL,SERVICE_KEY,{global:{headers:{Authorization:auth}},auth:{persistSession:false,autoRefreshToken:false}})}
async function userFromRequest(req:Request){const auth=req.headers.get("Authorization")||"";if(!auth.startsWith("Bearer "))return null;const c=asUser(req);const {data,error}=await c.auth.getUser(auth.slice(7));return error?null:data.user}

function sourceInfo(raw:unknown){
  const value=String(raw||"").trim();
  if(value.length<8||value.length>1800)return null;
  let u:URL;try{u=new URL(value)}catch{return null}
  if(u.protocol!=="https:")return null;
  const h=u.hostname.toLowerCase().replace(/^www\./,"");
  if(h==="localhost"||h.endsWith(".local")||/^127\./.test(h)||/^10\./.test(h)||/^192\.168\./.test(h))return null;
  let platform="direct";
  if(h==="youtu.be"||h.endsWith("youtube.com"))platform="youtube";
  else if(h.endsWith("tiktok.com"))platform="tiktok";
  else if(h.endsWith("instagram.com"))platform="instagram";
  return {url:u.toString(),platform};
}
function boundedInt(v:unknown,fallback:number,min:number,max:number){const n=Math.round(Number(v));return Number.isFinite(n)?Math.max(min,Math.min(max,n)):fallback}

Deno.serve(async(req:Request)=>{
  if(req.method==="OPTIONS")return new Response(null,{status:204,headers:CORS});
  const origin=req.headers.get("Origin");
  if(origin&&origin!==ALLOWED_ORIGIN)return out({error:"ORIGIN_NOT_ALLOWED"},403);
  const user=await userFromRequest(req);if(!user)return out({error:"AUTH_REQUIRED"},401);
  const db=admin(), userDb=asUser(req), url=new URL(req.url);
  const parts=url.pathname.split("/").filter(Boolean);const i=parts.lastIndexOf("clip-jobs");const tail=i>=0?parts.slice(i+1):parts;

  if(req.method==="POST"&&tail[0]==="create"){
    const body=await req.json().catch(()=>null);if(!body)return out({error:"INVALID_BODY"},400);
    const src=sourceInfo(body.source_url);if(!src)return out({error:"UNSUPPORTED_OR_UNSAFE_URL"},400);
    if(body.confirm_rights!==true)return out({error:"RIGHTS_CONFIRMATION_REQUIRED"},400);
    const count=boundedInt(body.clip_count,5,1,10), min=boundedInt(body.min_duration_sec,20,8,90), max=boundedInt(body.max_duration_sec,60,15,120);
    if(max<min)return out({error:"INVALID_DURATION_RANGE"},400);
    const settings={
      caption_preset:["modern_bold","minimal","creator","karaoke","authority","ugc"].includes(String(body.caption_preset))?String(body.caption_preset):"modern_bold",
      format:"9:16",
      language:String(body.language||"auto").slice(0,32),
      add_captions:body.add_captions!==false,
      reframe:"smart_vertical"
    };
    const {data:project,error:pe}=await db.from("clip_projects").insert({
      user_id:user.id,source_url:src.url,source_platform:src.platform,title:String(body.title||"").slice(0,240)||null,
      requested_clip_count:count,min_duration_sec:min,max_duration_sec:max,status:"queued",settings
    }).select("*").single();
    if(pe)return out({error:pe.message},500);
    try{
      const created=await userDb.rpc("create_processing_job",{
        p_kind:"clip_generate",p_video_id:null,
        p_payload:{clip_project_id:project.id,source_url:src.url,source_platform:src.platform,clip_count:count,min_duration_sec:min,max_duration_sec:max,settings,requested_at:new Date().toISOString()},
        p_idempotency_key:`clip:${project.id}`
      });
      const job=Array.isArray(created)?created[0]:created;if(!job?.id)throw new Error("JOB_CREATE_FAILED");
      return out({project,job},202);
    }catch(error){await db.from("clip_projects").update({status:"failed"}).eq("id",project.id);return out({error:String(error?.message||error)},500)}
  }

  if(req.method==="GET"&&tail[0]==="jobs"&&uuid(tail[1])){
    const {data,error}=await db.from("processing_jobs").select("id,kind,status,progress,stage,result,error,error_code,created_at,updated_at,completed_at").eq("id",tail[1]).eq("user_id",user.id).maybeSingle();
    if(error)return out({error:error.message},500);if(!data)return out({error:"JOB_NOT_FOUND"},404);return out({job:data});
  }

  if(req.method==="GET"&&tail[0]==="projects"&&uuid(tail[1])){
    const {data:project,error}=await db.from("clip_projects").select("*").eq("id",tail[1]).eq("user_id",user.id).maybeSingle();
    if(error)return out({error:error.message},500);if(!project)return out({error:"PROJECT_NOT_FOUND"},404);
    const {data:clips,error:ce}=await db.from("clip_outputs").select("id,rank,viral_score,title,hook,rationale,start_ms,end_ms,status,output_video_id,created_at,metadata").eq("project_id",project.id).eq("user_id",user.id).order("rank");
    if(ce)return out({error:ce.message},500);return out({project,clips:clips||[]});
  }

  if(req.method==="GET"&&tail[0]==="clips"&&uuid(tail[1])&&tail[2]==="url"){
    const {data:clip,error}=await db.from("clip_outputs").select("id,user_id,output_video_id").eq("id",tail[1]).eq("user_id",user.id).maybeSingle();
    if(error)return out({error:error.message},500);if(!clip)return out({error:"CLIP_NOT_FOUND"},404);
    const {data:media,error:me}=await db.from("media_assets").select("id,storage_bucket,storage_path,mime_type,size_bytes,status").eq("id",clip.output_video_id).eq("user_id",user.id).maybeSingle();
    if(me||!media)return out({error:me?.message||"OUTPUT_MEDIA_NOT_FOUND"},404);
    const {data:signed,error:se}=await db.storage.from(media.storage_bucket||VIDEO_BUCKET).createSignedUrl(media.storage_path,600);
    if(se||!signed?.signedUrl)return out({error:se?.message||"SIGNED_URL_FAILED"},500);
    return out({clip,media,signed_url:signed.signedUrl,expires_in:600});
  }

  return out({error:"NOT_FOUND"},404);
});