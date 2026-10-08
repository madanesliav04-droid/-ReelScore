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

function out(body:unknown,status=200){
  return new Response(JSON.stringify(body),{
    status,
    headers:{...CORS,"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"}
  });
}

function isUuid(v:unknown){
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(v||""));
}

function safePath(v:unknown){
  const value=String(v||"");
  if(!value||value.includes("..")||value.startsWith("/")||value.length>700)return null;
  return value;
}

function sha(v:unknown){
  const value=String(v||"").toLowerCase().trim();
  return /^[0-9a-f]{64}$/.test(value)?value:null;
}

async function userFromRequest(req:Request){
  const auth=req.headers.get("Authorization")||"";
  if(!auth.startsWith("Bearer "))return null;
  const client=createClient(SUPABASE_URL,SERVICE_KEY,{
    global:{headers:{Authorization:auth}},
    auth:{persistSession:false,autoRefreshToken:false}
  });
  const {data,error}=await client.auth.getUser(auth.slice(7));
  if(error||!data.user)return null;
  return data.user;
}

function admin(){
  return createClient(SUPABASE_URL,SERVICE_KEY,{
    auth:{persistSession:false,autoRefreshToken:false}
  });
}

function asUser(req:Request){
  const auth=req.headers.get("Authorization")||"";
  return createClient(SUPABASE_URL,SERVICE_KEY,{
    global:{headers:{Authorization:auth}},
    auth:{persistSession:false,autoRefreshToken:false}
  });
}

async function ownMedia(db:ReturnType<typeof admin>,userId:string,id:string){
  const {data,error}=await db.from("media_assets")
    .select("id,user_id,storage_bucket,storage_path,mime_type,size_bytes,sha256,status")
    .eq("id",id)
    .eq("user_id",userId)
    .is("deleted_at",null)
    .maybeSingle();
  if(error)throw error;
  return data;
}

async function registerMedia(db:ReturnType<typeof admin>,userId:string,body:any){
  const path=safePath(body?.storage_path);
  const mime=String(body?.mime_type||"");
  const size=Number(body?.size_bytes||0);
  if(!path||!path.startsWith(userId+"/"))throw new Error("INVALID_STORAGE_PATH");
  if(!mime.startsWith("video/"))throw new Error("INVALID_VIDEO_TYPE");
  if(!Number.isFinite(size)||size<=0||size>500*1024*1024)throw new Error("INVALID_VIDEO_SIZE");

  const {data:list,error:listError}=await db.storage.from(VIDEO_BUCKET).list(
    path.split("/").slice(0,-1).join("/"),
    {search:path.split("/").at(-1),limit:10}
  );
  if(listError)throw listError;
  const name=path.split("/").at(-1);
  const exists=(list||[]).some(x=>x.name===name);
  if(!exists)throw new Error("STORAGE_OBJECT_NOT_FOUND");

  const row={
    user_id:userId,
    module:"viralplus",
    kind:"source",
    storage_bucket:VIDEO_BUCKET,
    storage_path:path,
    original_name:String(body?.original_name||name||"video").slice(0,240),
    mime_type:mime,
    size_bytes:size,
    duration_ms:Number.isFinite(Number(body?.duration_ms))?Math.max(0,Math.round(Number(body.duration_ms))):null,
    width:Number.isFinite(Number(body?.width))?Math.max(1,Math.round(Number(body.width))):null,
    height:Number.isFinite(Number(body?.height))?Math.max(1,Math.round(Number(body.height))):null,
    sha256:sha(body?.sha256),
    status:"uploaded",
    metadata:body?.metadata&&typeof body.metadata==="object"?body.metadata:{}
  };

  const {data,error}=await db.from("media_assets")
    .upsert(row,{onConflict:"storage_bucket,storage_path"})
    .select("*")
    .single();
  if(error)throw error;
  return data;
}

async function createJob(
  userDb:ReturnType<typeof asUser>,
  kind:"viral_analysis"|"edit_render",
  videoId:string,
  payload:any,
  idempotencyKey:string
){
  const {data,error}=await userDb.rpc("create_processing_job",{
    p_kind:kind,
    p_video_id:videoId,
    p_payload:payload||{},
    p_idempotency_key:idempotencyKey
  });
  if(error)throw error;
  const job=Array.isArray(data)?data[0]:data;
  if(!job?.id)throw new Error("JOB_CREATE_FAILED");
  return job;
}

async function route(req:Request){
  if(req.method==="OPTIONS")return new Response(null,{status:204,headers:CORS});
  const origin=req.headers.get("Origin");
  if(origin&&origin!==ALLOWED_ORIGIN)return out({error:"ORIGIN_NOT_ALLOWED"},403);

  const user=await userFromRequest(req);
  if(!user)return out({error:"AUTH_REQUIRED"},401);

  const url=new URL(req.url);
  const parts=url.pathname.split("/").filter(Boolean);
  const fnIndex=parts.lastIndexOf("viral-edit-jobs");
  const tail=fnIndex>=0?parts.slice(fnIndex+1):parts;
  const db=admin();
  const userDb=asUser(req);

  if(req.method==="GET"&&tail[0]==="quota"){
    const {data:profile,error}=await db.from("viralplus_profiles")
      .select("analyses_used,analysis_limit,period_start")
      .eq("user_id",user.id)
      .maybeSingle();
    if(error)return out({error:"QUOTA_READ_FAILED"},500);
    const now=new Date();
    const currentMonth=Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),1);
    const period=profile?.period_start?new Date(profile.period_start).getTime():currentMonth;
    const used=period<currentMonth?0:Math.max(0,Number(profile?.analyses_used||0));
    const limit=Math.max(1,Number(profile?.analysis_limit||20));
    const resetAt=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth()+1,1)).toISOString();
    return out({quota:{used,limit,remaining:Math.max(0,limit-used),reset_at:resetAt}});
  }

  if(req.method==="POST"&&tail[0]==="media"){
    const body=await req.json().catch(()=>null);
    if(!body)return out({error:"INVALID_BODY"},400);
    try{
      const media=await registerMedia(db,user.id,body);
      return out({media},201);
    }catch(error){
      const msg=String(error?.message||error);
      const status=/INVALID_|NOT_FOUND/.test(msg)?400:500;
      return out({error:msg},status);
    }
  }

  if(req.method==="POST"&&tail[0]==="analysis"){
    const body=await req.json().catch(()=>null);
    if(!body)return out({error:"INVALID_BODY"},400);

    let media;
    try{
      media=body.video_id&&isUuid(body.video_id)
        ? await ownMedia(db,user.id,String(body.video_id))
        : await registerMedia(db,user.id,body);
    }catch(error){
      return out({error:String(error?.message||error)},400);
    }
    if(!media)return out({error:"MEDIA_NOT_FOUND"},404);

    const digest=sha(media.sha256)||String(media.id);
    const baseline=isUuid(body?.baseline_analysis_id)?String(body.baseline_analysis_id):null;
    const mode=baseline?"reanalysis":"analysis";
    const key=`viral:${mode}:${digest}:${baseline||"base"}`;

    try{
      const job=await createJob(userDb,"viral_analysis",media.id,{
        is_reanalysis:Boolean(baseline),
        baseline_analysis_id:baseline,
        requested_at:new Date().toISOString()
      },key);
      return out({job,media},202);
    }catch(error){
      return out({error:String(error?.message||error)},500);
    }
  }

  if(req.method==="POST"&&tail[0]==="edit"){
    const body=await req.json().catch(()=>null);
    if(!body||!isUuid(body.video_id))return out({error:"VIDEO_ID_REQUIRED"},400);
    const media=await ownMedia(db,user.id,String(body.video_id));
    if(!media)return out({error:"MEDIA_NOT_FOUND"},404);

    const allowedStyles=["codie","impact","clean","authority","explainer","data","ugc_native","cinematic_story","editorial_breakdown","creator_clean","business_viral","podcast_authority"];
    const requestedStyle=String(body.style||"clean");
    const style=allowedStyles.includes(requestedStyle)?requestedStyle:"clean";
    const canonicalStyle={creator_clean:"clean",business_viral:"impact",podcast_authority:"authority"}[style]||style;
    const captionByModel={
      codie:"authority",
      impact:"impact",
      clean:"clean",
      authority:"authority",
      explainer:"explainer",
      data:"data",
      ugc_native:"ugc",
      cinematic_story:"cinematic",
      editorial_breakdown:"editorial"
    };
    const caption=captionByModel[canonicalStyle]||"clean";
    const sourceAnalysisId=isUuid(body.analysis_id)?String(body.analysis_id):null;
    const requestId=crypto.randomUUID();
    const format=["native","portrait","landscape"].includes(body.settings?.format)?body.settings.format:"native";

    const {data:project,error:projectError}=await db.from("edit_projects")
      .insert({
        user_id:user.id,
        source_video_id:media.id,
        source_analysis_id:sourceAnalysisId,
        style:canonicalStyle,
        caption_preset:caption,
        status:"planning",
        settings:{
          ...(body.settings&&typeof body.settings==="object"?body.settings:{}),
          format,
          model_contract_version:"editplus-models-v3-editorial-breakdown"
        }
      })
      .select("*")
      .single();
    if(projectError)return out({error:projectError.message},500);

    try{
      const job=await createJob(userDb,"edit_render",media.id,{
        edit_project_id:project.id,
        source_analysis_id:sourceAnalysisId,
        style:canonicalStyle,
        caption_preset:caption,
        settings:{format,model_contract_version:"editplus-models-v3-editorial-breakdown"},
        requested_at:new Date().toISOString()
      },`edit:${project.id}:${requestId}`);
      return out({project,job},202);
    }catch(error){
      await db.from("edit_projects").update({status:"failed"}).eq("id",project.id);
      return out({error:String(error?.message||error)},500);
    }
  }

  if(req.method==="GET"&&tail[0]==="jobs"&&isUuid(tail[1])){
    const id=String(tail[1]);
    const {data,error}=await db.from("processing_jobs")
      .select("id,kind,video_id,output_video_id,status,progress,stage,retry_count,max_retries,created_at,started_at,completed_at,error_code,error,result")
      .eq("id",id)
      .eq("user_id",user.id)
      .maybeSingle();
    if(error)return out({error:error.message},500);
    if(!data)return out({error:"JOB_NOT_FOUND"},404);
    return out({job:data});
  }

  if(req.method==="GET"&&tail[0]==="media"&&isUuid(tail[1])&&tail[2]==="url"){
    const media=await ownMedia(db,user.id,String(tail[1]));
    if(!media)return out({error:"MEDIA_NOT_FOUND"},404);

    const {data,error}=await db.storage
      .from(media.storage_bucket)
      .createSignedUrl(media.storage_path,600);

    if(error||!data?.signedUrl){
      return out({error:error?.message||"SIGNED_URL_FAILED"},500);
    }

    return out({
      media:{
        id:media.id,
        mime_type:media.mime_type,
        size_bytes:media.size_bytes,
        status:media.status
      },
      signed_url:data.signedUrl,
      expires_in:600
    });
  }

  if(req.method==="GET"&&tail[0]==="exports"&&isUuid(tail[1])&&tail[2]==="url"){
    const exportId=String(tail[1]);
    const {data:exportRow,error:exportError}=await db
      .from("edit_exports")
      .select("id,project_id,job_id,user_id,output_video_id,preset,status")
      .eq("id",exportId)
      .eq("user_id",user.id)
      .maybeSingle();

    if(exportError)return out({error:exportError.message},500);
    if(!exportRow)return out({error:"EXPORT_NOT_FOUND"},404);

    const media=await ownMedia(db,user.id,String(exportRow.output_video_id));
    if(!media)return out({error:"OUTPUT_MEDIA_NOT_FOUND"},404);

    const {data,error}=await db.storage
      .from(media.storage_bucket)
      .createSignedUrl(media.storage_path,600);

    if(error||!data?.signedUrl){
      return out({error:error?.message||"SIGNED_URL_FAILED"},500);
    }

    return out({
      export:exportRow,
      media:{
        id:media.id,
        mime_type:media.mime_type,
        size_bytes:media.size_bytes,
        status:media.status
      },
      signed_url:data.signedUrl,
      expires_in:600
    });
  }

  if(req.method==="POST"&&tail[0]==="jobs"&&isUuid(tail[1])&&tail[2]==="retry"){
    const id=String(tail[1]);
    const {data,error}=await db.from("processing_jobs")
      .update({
        status:"queued",
        progress:0,
        stage:"manual_retry",
        next_attempt_at:new Date().toISOString(),
        locked_at:null,
        locked_by:null,
        heartbeat_at:null,
        completed_at:null,
        error_code:null,
        error:null
      })
      .eq("id",id)
      .eq("user_id",user.id)
      .eq("status","failed")
      .lt("retry_count",3)
      .select("*")
      .maybeSingle();
    if(error)return out({error:error.message},500);
    if(!data)return out({error:"JOB_NOT_RETRYABLE"},409);

    await db.from("job_events").insert({
      job_id:data.id,user_id:user.id,status:"queued",progress:0,
      message:"Manual retry requested",details:{}
    });
    return out({job:data},202);
  }

  return out({error:"NOT_FOUND"},404);
}

Deno.serve(route);
