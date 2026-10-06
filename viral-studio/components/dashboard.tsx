"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { BarChart3, Clapperboard, Home, Library, LogOut, Scissors, Settings, Upload, Zap } from "lucide-react";
import * as tus from "tus-js-client";
import { functionUrl, supabase, SUPABASE_PROJECT_REF, VIDEO_BUCKET } from "@/lib/supabase";

type Module = "viral"|"edit"|"clip";
type Job = {id:string;status:string;progress?:number;stage?:string;result?:any;error?:any;error_code?:string};
type Media = {id:string;storage_path:string;mime_type:string;size_bytes:number;original_name?:string};

async function api(path:string, token:string, init:RequestInit={}){
  const res=await fetch(path,{...init,headers:{"Content-Type":"application/json",Authorization:`Bearer ${token}`,...(init.headers||{})}});
  const body=await res.json().catch(()=>({}));
  if(!res.ok) throw new Error(body?.error||body?.message||`Request failed (${res.status})`);
  return body;
}

function safeName(name:string){return name.replace(/[^a-zA-Z0-9._-]+/g,"-").slice(-120)}

export function Dashboard(){
  const [session,setSession]=useState<any>(null);
  const [email,setEmail]=useState("");
  const [password,setPassword]=useState("");
  const [authMode,setAuthMode]=useState<"login"|"signup">("login");
  const [authError,setAuthError]=useState("");
  const [active,setActive]=useState<Module>("viral");
  const [file,setFile]=useState<File|null>(null);
  const [media,setMedia]=useState<Media|null>(null);
  const [uploadPct,setUploadPct]=useState(0);
  const [job,setJob]=useState<Job|null>(null);
  const [analysis,setAnalysis]=useState<any>(null);
  const [error,setError]=useState("");
  const [clipUrl,setClipUrl]=useState("");
  const [clipProject,setClipProject]=useState<any>(null);
  const pollRef=useRef<ReturnType<typeof setInterval>|null>(null);

  useEffect(()=>{
    supabase.auth.getSession().then(({data})=>setSession(data.session));
    const {data}=supabase.auth.onAuthStateChange((_event,next)=>setSession(next));
    return ()=>data.subscription.unsubscribe();
  },[]);

  useEffect(()=>()=>{if(pollRef.current)clearInterval(pollRef.current)},[]);

  const token=session?.access_token||"";
  const userId=session?.user?.id||"";

  async function authenticate(e:React.FormEvent){
    e.preventDefault(); setAuthError("");
    const action=authMode==="login"?supabase.auth.signInWithPassword({email,password}):supabase.auth.signUp({email,password});
    const {error}=await action;
    if(error)setAuthError(error.message);
  }

  function uploadVideo(selected:File){
    if(!session)return setError("Connecte-toi avant l’upload.");
    setError(""); setFile(selected); setMedia(null); setAnalysis(null); setJob(null); setUploadPct(0);
    const objectName=`${userId}/${crypto.randomUUID()}-${safeName(selected.name)}`;
    const upload=new tus.Upload(selected,{
      endpoint:`https://${SUPABASE_PROJECT_REF}.storage.supabase.co/storage/v1/upload/resumable`,
      retryDelays:[0,3000,5000,10000,20000],
      headers:{authorization:`Bearer ${token}`,"x-upsert":"false"},
      uploadDataDuringCreation:true,
      removeFingerprintOnSuccess:true,
      chunkSize:6*1024*1024,
      metadata:{bucketName:VIDEO_BUCKET,objectName,contentType:selected.type||"video/mp4",cacheControl:"3600"},
      onError(err){setError(err.message||"Upload impossible")},
      onProgress(sent,total){setUploadPct(Math.round(sent/total*100))},
      async onSuccess(){
        try{
          const body=await api(functionUrl("viral-edit-jobs","media"),token,{method:"POST",body:JSON.stringify({
            storage_path:objectName,mime_type:selected.type||"video/mp4",size_bytes:selected.size,original_name:selected.name,module:"shared"
          })});
          setMedia(body.media); setUploadPct(100);
        }catch(e:any){setError(e.message)}
      }
    });
    upload.findPreviousUploads().then(previous=>{if(previous.length)upload.resumeFromPreviousUpload(previous[0]);upload.start()});
  }

  async function watchJob(id:string, kind:"core"|"clip"="core"){
    if(pollRef.current)clearInterval(pollRef.current);
    const tick=async()=>{
      try{
        const url=kind==="clip"?functionUrl("clip-jobs",`jobs/${id}`):functionUrl("viral-edit-jobs",`jobs/${id}`);
        const body=await api(url,token);
        setJob(body.job);
        if(["completed","failed"].includes(body.job.status)){
          if(pollRef.current)clearInterval(pollRef.current);
          if(body.job.status==="completed" && body.job.kind==="viral_analysis"){
            const {data}=await supabase.from("viralplus_analyses").select("*").eq("job_id",id).maybeSingle();
            if(data)setAnalysis(data.result_json||data);
          }
          if(body.job.status==="completed" && body.job.kind==="clip_generate" && body.job.result?.clip_project_id){
            const detail=await api(functionUrl("clip-jobs",`projects/${body.job.result.clip_project_id}`),token);
            setClipProject(detail);
          }
        }
      }catch(e:any){setError(e.message);if(pollRef.current)clearInterval(pollRef.current)}
    };
    await tick(); pollRef.current=setInterval(tick,2000);
  }

  async function startAnalysis(){
    if(!media)return setError("Importe d’abord une vidéo.");
    setError(""); setAnalysis(null);
    try{
      const body=await api(functionUrl("viral-edit-jobs","analysis"),token,{method:"POST",body:JSON.stringify({video_id:media.id})});
      setJob(body.job); await watchJob(body.job.id);
    }catch(e:any){setError(e.message)}
  }

  async function startEdit(){
    if(!media)return setError("Importe d’abord une vidéo.");
    setError("");
    try{
      const body=await api(functionUrl("viral-edit-jobs","edit"),token,{method:"POST",body:JSON.stringify({video_id:media.id,analysis_id:analysis?.analysis_id||analysis?.id||null,style:"codie",caption_preset:"modern_bold"})});
      setJob(body.job); await watchJob(body.job.id);
    }catch(e:any){setError(e.message)}
  }

  async function startClip(){
    if(!clipUrl.trim())return setError("Colle un lien vidéo.");
    setError(""); setClipProject(null);
    try{
      const body=await api(functionUrl("clip-jobs","create"),token,{method:"POST",body:JSON.stringify({source_url:clipUrl.trim(),confirm_rights:true,clip_count:5,min_duration_sec:20,max_duration_sec:60,caption_preset:"modern_bold",add_captions:true})});
      setJob(body.job); await watchJob(body.job.id,"clip");
    }catch(e:any){setError(e.message)}
  }

  const score=useMemo(()=>analysis?.final_score??analysis?.score??null,[analysis]);

  if(!session) return <main className="auth-screen">
    <div className="auth-orb"/>
    <section className="auth-box">
      <div className="side-brand big">VIRAL <span>STUDIO</span></div>
      <h1>{authMode==="login"?"Welcome back.":"Create your studio."}</h1>
      <p>Clip. Edit. Analyze. Export.</p>
      <form onSubmit={authenticate}>
        <input className="field" type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="Email" required/>
        <input className="field" type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Password" minLength={6} required/>
        <button className="btn primary auth-submit">{authMode==="login"?"Sign in":"Create account"}</button>
      </form>
      {authError&&<div className="error auth-error">{authError}</div>}
      <button className="auth-switch" onClick={()=>setAuthMode(authMode==="login"?"signup":"login")}>{authMode==="login"?"No account? Create one":"Already registered? Sign in"}</button>
    </section>
  </main>;

  return <main className="dashboard-shell">
    <aside className="sidebar">
      <div className="side-brand">VIRAL <span>STUDIO</span></div>
      <div className="side-group"><small>HOME</small><button className="side-link active"><Home size={16}/> Home</button></div>
      <div className="side-group"><small>CREATE</small>
        <button className="side-link" onClick={()=>setActive("viral")}><BarChart3 size={16}/> Viral+</button>
        <button className="side-link" onClick={()=>setActive("edit")}><Clapperboard size={16}/> Edit+</button>
        <button className="side-link" onClick={()=>setActive("clip")}><Scissors size={16}/> Clip+</button>
      </div>
      <div className="side-group"><small>LIBRARY</small><button className="side-link"><Library size={16}/> Projects</button></div>
      <div className="side-group"><small>ACCOUNT</small><button className="side-link"><Settings size={16}/> Settings</button><button className="side-link" onClick={()=>supabase.auth.signOut()}><LogOut size={16}/> Sign out</button></div>
    </aside>

    <section className="dash-main">
      <header className="dash-top"><div><h1>What are we creating today?</h1><p>One workspace for the full short-form loop.</p></div><div className="user-pill">{session.user.email}</div></header>

      <div className="create-grid">
        <button className="create-card" onClick={()=>setActive("viral")}><div className="icon"><BarChart3/></div><div><h3>Analyze a Reel</h3><p>Score the hook, retention potential and structure.</p></div></button>
        <button className="create-card" onClick={()=>setActive("edit")}><div className="icon"><Clapperboard/></div><div><h3>Create an Edit</h3><p>Generate cuts, captions, punch-ins and render.</p></div></button>
        <button className="create-card" onClick={()=>setActive("clip")}><div className="icon"><Scissors/></div><div><h3>Generate Clips</h3><p>Turn long-form URLs into ranked short-form moments.</p></div></button>
      </div>

      <div className="module-tabs">
        <button className={active==="viral"?"active":""} onClick={()=>setActive("viral")}>Viral+</button>
        <button className={active==="edit"?"active":""} onClick={()=>setActive("edit")}>Edit+</button>
        <button className={active==="clip"?"active":""} onClick={()=>setActive("clip")}>Clip+</button>
      </div>

      <div className="workspace-grid">
        <section className="panel">
          {active!=="clip"?<>
            <h3>{active==="viral"?"Analyze your next Reel":"Build an automatic edit"}</h3>
            <label className="upload-zone">
              <input type="file" accept="video/mp4,video/quicktime,video/webm,.mp4,.mov,.webm" onChange={e=>{const f=e.target.files?.[0];if(f)uploadVideo(f)}}/>
              <div><Upload size={30}/><b>{file?file.name:"Drop a video here"}</b><span>MP4 · MOV · WebM · resumable upload</span></div>
            </label>
            {file&&<div className="progress"><i style={{width:`${uploadPct}%`}}/></div>}
            <div className="status-row"><span>Upload</span><span className="status-pill">{media?"Ready":file?`${uploadPct}%`:"Waiting"}</span></div>
            <div className="form-row">
              {active==="viral"?<button className="btn primary" onClick={startAnalysis} disabled={!media}><Zap size={16}/> Analyze video</button>:<button className="btn primary" onClick={startEdit} disabled={!media}><Clapperboard size={16}/> Create Codie edit</button>}
            </div>
          </>:<>
            <h3>Turn long content into short-form.</h3>
            <input className="field" value={clipUrl} onChange={e=>setClipUrl(e.target.value)} placeholder="Paste YouTube, TikTok or Instagram URL"/>
            <p className="panel-note">Only content you own or have permission to process. If direct ingestion is unavailable, upload will remain the fallback.</p>
            <button className="btn primary" onClick={startClip}><Scissors size={16}/> Generate Clips</button>
          </>}
          {error&&<div className="job-card error">{error}</div>}
        </section>

        <aside className="panel">
          <h3>Live backend state</h3>
          <div className="status-row"><span>Media</span><span className="status-pill">{media?.id?"Registered":"—"}</span></div>
          <div className="status-row"><span>Job</span><span className="status-pill">{job?.status||"—"}</span></div>
          <div className="status-row"><span>Stage</span><span className="status-pill">{job?.stage||"—"}</span></div>
          <div className="status-row"><span>Progress</span><span className="status-pill">{typeof job?.progress==="number"?job.progress+"%":"—"}</span></div>
          {job&&<div className="job-card"><strong>{job.status}</strong><small>{job.id}</small>{job.error&&<div className="error">{String(job.error)}</div>}</div>}
        </aside>
      </div>

      {active==="viral"&&analysis&&<section className="result-panel">
        <div><small>VIRAL SCORE</small><div className="score-big">{score??"—"}<span>/100</span></div></div>
        <div className="result-copy"><small>MAIN PROBLEM</small><h2>{analysis.main_problem||"Diagnostic completed"}</h2><p>{analysis.why}</p><button className="btn primary" onClick={()=>setActive("edit")}>FIX WITH EDIT+ →</button></div>
      </section>}

      {active==="clip"&&clipProject?.clips?.length>0&&<section className="clips-section">
        <div className="section-heading"><small>CLIP+</small><h2>Best moments found.</h2></div>
        <div className="clips-grid">{clipProject.clips.map((clip:any)=><article className="clip-card" key={clip.id}><div className="clip-rank">0{clip.rank}</div><strong>{clip.viral_score??"—"}</strong><small>Viral potential</small><h3>{clip.title||"Untitled clip"}</h3><p>{clip.hook||clip.rationale}</p></article>)}</div>
      </section>}
    </section>
  </main>
}
