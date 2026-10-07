"use client";

import {useEffect,useMemo,useRef,useState} from "react";
import {BarChart3,Clapperboard,LogOut,Scissors,Upload,Zap,Check,Link2} from "lucide-react";
import * as tus from "tus-js-client";
import {functionUrl,supabase,SUPABASE_PROJECT_REF,VIDEO_BUCKET} from "@/lib/supabase";

type Module="viral"|"edit"|"clip";
type Job={id:string;kind?:string;status:string;progress?:number;stage?:string;result?:any;error?:any;error_code?:string};
type Media={id:string;storage_path:string;mime_type:string;size_bytes:number;original_name?:string};
type EditModel={id:string;name:string;category:string;preview:string;meta:string};

const VIRAL_METRICS=[
  ["hook","Hook"],
  ["scroll_stop","Scroll stop"],
  ["retention","Retention"],
  ["clarity","Clarity"],
  ["rhythm","Rhythm"],
  ["structure","Structure"],
  ["text_captions","Captions"],
  ["visual","Visual"],
  ["audio","Audio"],
  ["originality","Originality"],
  ["cta","CTA"]
] as const;

function scoreTone(value:any){
  const n=Number(value||0);
  return n>=80?"good":n>=60?"mid":"bad";
}

const EDIT_MODELS:EditModel[]=[
  {id:"codie",name:"Codie",category:"Business storytelling",preview:"FACE CAM",meta:"Narrative · restrained B-roll"},
  {id:"impact",name:"Impact",category:"High-energy business",preview:"IMPACT",meta:"Fast · punchy · visual"},
  {id:"clean",name:"Clean",category:"Modern creator",preview:"CLEAN",meta:"Simple · polished · minimal"},
  {id:"authority",name:"Authority",category:"Podcast & expert",preview:"AUTHORITY",meta:"Calm · premium · credible"},
  {id:"explainer",name:"Explainer",category:"Tutorial & SaaS",preview:"EXPLAIN",meta:"Show · label · clarify"},
  {id:"data",name:"Data",category:"Numbers & evidence",preview:"DATA",meta:"Proof · numbers · comparison"},
  {id:"ugc_native",name:"UGC Native",category:"Native social",preview:"UGC",meta:"Human · phone-native · direct"},
  {id:"cinematic_story",name:"Cinematic Story",category:"Personal story",preview:"STORY",meta:"Emotional · breathing room"}
];

async function freshSession(){
  let {data,error}=await supabase.auth.getSession();
  if(error)throw error;
  let current=data.session;
  const expiresAt=Number(current?.expires_at||0)*1000;
  if(current&&expiresAt-Date.now()<90_000){
    const refreshed=await supabase.auth.refreshSession();
    if(refreshed.error)throw refreshed.error;
    current=refreshed.data.session;
  }
  if(!current?.access_token)throw new Error("SESSION_REQUIRED");
  return current;
}

async function api(path:string,_token:string,init:RequestInit={},allowRetry=true){
  const current=await freshSession();
  const run=async(accessToken:string)=>fetch(path,{
    ...init,
    headers:{
      "Content-Type":"application/json",
      Authorization:`Bearer ${accessToken}`,
      ...(init.headers||{})
    }
  });

  let res=await run(current.access_token);

  if(res.status===401&&allowRetry){
    const refreshed=await supabase.auth.refreshSession();
    const retryToken=refreshed.data.session?.access_token;
    if(retryToken)res=await run(retryToken);
  }

  const body=await res.json().catch(()=>({}));
  if(!res.ok){
    const code=String(body?.error||body?.message||"");
    if(res.status===401||code==="AUTH_REQUIRED")throw new Error("Ta session a expiré. Reconnecte-toi une fois puis Edit+ gardera automatiquement la session active.");
    throw new Error(/quota|credit|limit/i.test(code)?"La limite de traitement est atteinte. Réessaie plus tard.":"Le service n’a pas pu traiter la demande. Réessaie dans un instant.");
  }
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
  const [clipRights,setClipRights]=useState(false);
  const [clipCount,setClipCount]=useState<5|10|20>(5);
  const [clipProject,setClipProject]=useState<any>(null);
  const [clipFallback,setClipFallback]=useState(false);
  const [clipFile,setClipFile]=useState<File|null>(null);
  const [clipMedia,setClipMedia]=useState<Media|null>(null);
  const [clipUploadPct,setClipUploadPct]=useState(0);
  const [editModel,setEditModel]=useState("codie");
  const [format,setFormat]=useState("native");
  const [sourceUrl,setSourceUrl]=useState("");
  const sourceRef=useRef<HTMLVideoElement|null>(null);
  const [authNotice,setAuthNotice]=useState("");
  const [editExportUrl,setEditExportUrl]=useState("");
  const [busy,setBusy]=useState(false);
  const pollRef=useRef<ReturnType<typeof setInterval>|null>(null);

  useEffect(()=>{
    const requested=new URLSearchParams(window.location.search).get("tool");
    if(requested==="viral"||requested==="edit"||requested==="clip")setActive(requested);
    supabase.auth.getSession().then(({data})=>setSession(data.session));
    const {data}=supabase.auth.onAuthStateChange((_event,next)=>setSession(next));
    return ()=>data.subscription.unsubscribe();
  },[]);
  useEffect(()=>()=>{if(pollRef.current)clearInterval(pollRef.current)},[]);
  useEffect(()=>{
    if(!session?.access_token)return;
    try{
      const saved=localStorage.getItem("viral-studio-active-job");
      if(!saved)return;
      const parsed=JSON.parse(saved);
      if(!parsed?.id||!["core","clip"].includes(parsed?.channel))return;
      setBusy(true);
      void watchJob(parsed.id,parsed.channel);
    }catch{}
  },[session?.access_token]);

  const token=session?.access_token||"";
  const userId=session?.user?.id||"";
  const selectedModel=EDIT_MODELS.find(x=>x.id===editModel)||EDIT_MODELS[0];
  const score=useMemo(()=>analysis?.final_score??analysis?.score??null,[analysis]);
  const safeZone=analysis?.safe_zone||null;

  function switchModule(next:Module){
    if(busy)return;
    setActive(next);
    setError("");
    setJob(null);
    history.replaceState(null,"",`/dashboard?tool=${next}`);
  }

  function displayJobError(current:Job){
    const code=String(current?.error_code||"");
    if(code==="NO_CLIPS_FOUND")return "Aucun passage suffisamment fort n’a été détecté dans cette vidéo.";
    if(["YOUTUBE_EGRESS_REQUIRED","YOUTUBE_IMPORT_FAILED","YOUTUBE_UNAVAILABLE","IMPORT_CONFIGURATION_ERROR"].includes(code))return "YouTube bloque l’import automatique de cette source. Importe le fichier vidéo ci-dessous : Clip+ reprendra exactement le même pipeline de génération.";
    return "Le traitement n’a pas pu aboutir. Réessaie avec cette vidéo ou importe un autre fichier.";
  }

  async function authenticate(e:React.FormEvent){
    e.preventDefault();setAuthError("");
    const action=authMode==="login"?supabase.auth.signInWithPassword({email,password}):supabase.auth.signUp({email,password});
    const {data,error}=await action;if(error)setAuthError(error.message);else if(authMode==="signup"&&!data.session)setAuthNotice("Consulte tes emails pour confirmer ton compte, puis connecte-toi.");
  }

  async function uploadVideo(selected:File){
    if(selected.size>500*1024*1024)return setError("Cette vidéo dépasse 500 Mo.");
    if(busy)return;
    setSourceUrl(URL.createObjectURL(selected));
    let liveSession:any;
    try{
      liveSession=await freshSession();
    }catch{
      setError("Reconnecte-toi pour continuer.");
      return;
    }
    const liveUserId=liveSession.user?.id;
    if(!liveUserId)return setError("Session utilisateur invalide.");
    setError("");setFile(selected);setMedia(null);setAnalysis(null);setJob(null);setUploadPct(0);setEditExportUrl("");
    const objectName=`${liveUserId}/${crypto.randomUUID()}-${safeName(selected.name)}`;
    const upload=new tus.Upload(selected,{
      endpoint:`https://${SUPABASE_PROJECT_REF}.storage.supabase.co/storage/v1/upload/resumable`,
      retryDelays:[0,3000,5000,10000,20000],
      headers:{authorization:`Bearer ${liveSession.access_token}`,"x-upsert":"false"},
      uploadDataDuringCreation:true,removeFingerprintOnSuccess:true,chunkSize:6*1024*1024,
      metadata:{bucketName:VIDEO_BUCKET,objectName,contentType:selected.type||"video/mp4",cacheControl:"3600"},
      onError(err){setError(err.message||"Upload impossible")},
      onProgress(sent,total){setUploadPct(Math.round(sent/total*100))},
      async onSuccess(){
        try{
          const body=await api(functionUrl("viral-edit-jobs","media"),token,{method:"POST",body:JSON.stringify({storage_path:objectName,mime_type:selected.type||"video/mp4",size_bytes:selected.size,original_name:selected.name,module:"shared"})});
          setMedia(body.media);setUploadPct(100);
        }catch(e:any){setError(e.message)}
      }
    });
    upload.findPreviousUploads().then(previous=>{if(previous.length)upload.resumeFromPreviousUpload(previous[0]);upload.start()});
  }

  async function uploadClipSource(selected:File){
    if(selected.size>500*1024*1024)return setError("Cette vidéo dépasse 500 Mo.");
    if(busy)return;
    let liveSession:any;
    try{
      liveSession=await freshSession();
    }catch{
      setError("Reconnecte-toi pour continuer.");
      return;
    }
    const liveUserId=liveSession.user?.id;
    if(!liveUserId)return setError("Session utilisateur invalide.");
    setError("");setClipFile(selected);setClipMedia(null);setClipUploadPct(0);setJob(null);setClipProject(null);
    const objectName=`${liveUserId}/${crypto.randomUUID()}-${safeName(selected.name)}`;
    const upload=new tus.Upload(selected,{
      endpoint:`https://${SUPABASE_PROJECT_REF}.storage.supabase.co/storage/v1/upload/resumable`,
      retryDelays:[0,3000,5000,10000,20000],
      headers:{authorization:`Bearer ${liveSession.access_token}`,"x-upsert":"false"},
      uploadDataDuringCreation:true,removeFingerprintOnSuccess:true,chunkSize:6*1024*1024,
      metadata:{bucketName:VIDEO_BUCKET,objectName,contentType:selected.type||"video/mp4",cacheControl:"3600"},
      onError(err){setError(err.message||"Upload impossible")},
      onProgress(sent,total){setClipUploadPct(Math.round(sent/total*100))},
      async onSuccess(){
        try{
          const body=await api(functionUrl("viral-edit-jobs","media"),token,{method:"POST",body:JSON.stringify({storage_path:objectName,mime_type:selected.type||"video/mp4",size_bytes:selected.size,original_name:selected.name,module:"shared"})});
          setClipMedia(body.media);setClipUploadPct(100);setError("");
        }catch(e:any){setError(e.message)}
      }
    });
    upload.findPreviousUploads().then(previous=>{if(previous.length)upload.resumeFromPreviousUpload(previous[0]);upload.start()});
  }

  async function watchJob(id:string,kind:"core"|"clip"="core"){
    if(pollRef.current)clearInterval(pollRef.current);
    try{localStorage.setItem("viral-studio-active-job",JSON.stringify({id,channel:kind}))}catch{}
    const tick=async()=>{
      try{
        const url=kind==="clip"?functionUrl("clip-jobs",`jobs/${id}`):functionUrl("viral-edit-jobs",`jobs/${id}`);
        const body=await api(url,token);setJob(body.job);
        const done=["completed","failed"].includes(body.job.status);
        if(!done)return false;
        if(pollRef.current)clearInterval(pollRef.current);pollRef.current=null;setBusy(false);
        try{localStorage.removeItem("viral-studio-active-job")}catch{}
        if(body.job.status==="failed"){
          const code=String(body.job.error_code||"");
          if(kind==="clip"&&["YOUTUBE_EGRESS_REQUIRED","YOUTUBE_IMPORT_FAILED","YOUTUBE_UNAVAILABLE","IMPORT_CONFIGURATION_ERROR"].includes(code))setClipFallback(true);
          setError(displayJobError(body.job));
          return true;
        }
        if(body.job.kind==="viral_analysis"){
          const {data,error:analysisError}=await supabase.from("viralplus_analyses").select("*").eq("job_id",id).maybeSingle();
          if(analysisError)throw analysisError;
          if(!data)throw new Error("Analyse terminée mais résultat introuvable.");
          setAnalysis(data.result_json?{...data.result_json,id:data.id,analysis_id:data.id}:data);
        }
        if(body.job.kind==="edit_render"&&body.job.result?.export_id){
          const out=await api(functionUrl("viral-edit-jobs",`exports/${body.job.result.export_id}/url`),token);
          if(out?.signed_url)setEditExportUrl(out.signed_url);
        }
        if(body.job.kind==="clip_generate"&&body.job.result?.clip_project_id){
          const detail=await api(functionUrl("clip-jobs",`projects/${body.job.result.clip_project_id}`),token);
          setClipProject(detail);
        }
        return true;
      }catch(e:any){setError(e.message);setBusy(false);try{localStorage.removeItem("viral-studio-active-job")}catch{};if(pollRef.current)clearInterval(pollRef.current);pollRef.current=null;return true}
    };
    pollRef.current=setInterval(()=>void tick(),2000);
    await tick();
  }

  async function startAnalysis(){
    if(busy)return;if(!media)return setError("Importe d’abord une vidéo.");
    setError("");setAnalysis(null);setBusy(true);
    try{
      const body=await api(functionUrl("viral-edit-jobs","analysis"),token,{method:"POST",body:JSON.stringify({video_id:media.id})});
      setJob(body.job);await watchJob(body.job.id);
    }catch(e:any){setError(e.message);setBusy(false)}
  }

  async function startEdit(){
    if(busy)return;if(!media)return setError("Importe d’abord une vidéo.");
    setError("");setEditExportUrl("");setBusy(true);
    try{
      const body=await api(functionUrl("viral-edit-jobs","edit"),token,{method:"POST",body:JSON.stringify({
        video_id:media.id,
        analysis_id:analysis?.analysis_id||analysis?.id||null,
        style:editModel, settings:{format}
      })});
      setJob(body.job);await watchJob(body.job.id);
    }catch(e:any){setError(e.message);setBusy(false)}
  }

  async function startClip(){
    if(busy)return;
    if(!clipMedia&&!clipUrl.trim())return setError("Colle une URL YouTube ou importe la vidéo.");
    if(!clipRights)return setError("Confirme que tu as le droit de traiter cette vidéo.");
    setError("");setClipProject(null);setBusy(true);
    try{
      const body=await api(functionUrl("clip-jobs","create"),token,{method:"POST",body:JSON.stringify({
        ...(clipMedia?{source_video_id:clipMedia.id}:{source_url:clipUrl.trim()}),
        confirm_rights:true,clip_count:clipCount,min_duration_sec:20,max_duration_sec:60,caption_preset:"modern_bold",add_captions:true
      })});
      setJob(body.job);setClipProject({project:body.project,clips:[]});await watchJob(body.job.id,"clip");
    }catch(e:any){setError(e.message);setBusy(false)}
  }

  async function openClip(clipId:string){
    try{
      const body=await api(functionUrl("clip-jobs",`clips/${clipId}/url`),token);
      if(!body?.signed_url)throw new Error("Clip indisponible.");
      window.open(body.signed_url,"_blank","noopener,noreferrer");
    }catch(e:any){setError(e.message)}
  }

  async function useClip(clip:any,next:Module){
    if(busy)return;
    try{
      const body=await api(functionUrl("viral-edit-jobs",`media/${clip.output_video_id}/url`),token);
      setMedia(body.media);setFile(null);setAnalysis(null);setEditExportUrl("");setSourceUrl(body.signed_url);switchModule(next);
    }catch(e:any){setError(e.message)}
  }

  if(!session)return <main className="auth-screen"><div className="auth-orb"/><section className="auth-box">
    <div className="side-brand big">VIRAL <span>STUDIO</span></div>
    <h1>{authMode==="login"?"Welcome back.":"Create your studio."}</h1><p>Clip. Edit. Analyze. Export.</p>
    <form onSubmit={authenticate}><input className="field" type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="Email" required/><input className="field" type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Password" minLength={6} required/><button className="btn primary auth-submit">{authMode==="login"?"Sign in":"Create account"}</button></form>
    {authError&&<div className="error auth-error">{authError}</div>}{authNotice&&<p role="status">{authNotice}</p>}
    <button className="auth-switch" onClick={()=>setAuthMode(authMode==="login"?"signup":"login")}>{authMode==="login"?"No account? Create one":"Already registered? Sign in"}</button>
  </section></main>;

  return <main className="dashboard-shell">
    <aside className="sidebar">
      <div className="side-brand">VIRAL <span>STUDIO</span></div>
      <div className="side-group"><small>CREATE</small>
        <button className="side-link" onClick={()=>switchModule("viral")}><BarChart3 size={16}/> Viral+</button>
        <button className="side-link" onClick={()=>switchModule("edit")}><Clapperboard size={16}/> Edit+</button>
        <button className="side-link" onClick={()=>switchModule("clip")}><Scissors size={16}/> Clip+</button>
      </div>
      <div className="side-group"><small>ACCOUNT</small><button className="side-link" onClick={()=>supabase.auth.signOut()}><LogOut size={16}/> Sign out</button></div>
    </aside>

    <section className="dash-main">
      <header className="dash-top"><div><h1>What are we creating today?</h1><p>Three tools. One simple workflow.</p></div><div className="user-pill">{session.user.email}</div></header>
      <div className="module-tabs"><button className={active==="viral"?"active":""} onClick={()=>switchModule("viral")}>Viral+</button><button className={active==="edit"?"active":""} onClick={()=>switchModule("edit")}>Edit+</button><button className={active==="clip"?"active":""} onClick={()=>switchModule("clip")}>Clip+</button></div>

      {active==="viral"&&<div className="workspace-grid">
        <section className="panel">
          <small className="eyebrow">VIRAL+ · ANALYZE</small><h3>Upload. Understand what blocks the video.</h3>
          <label className="upload-zone"><input type="file" accept="video/mp4,video/quicktime,video/webm,.mp4,.mov,.webm" onChange={e=>{const f=e.target.files?.[0];if(f)uploadVideo(f)}}/><div><Upload size={30}/><b>{file?file.name:media?"Clip importé — prêt à analyser":"Drop a Reel here"}</b><span>MP4 · MOV · WebM</span></div></label>
          {file&&<div className="progress"><i style={{width:`${uploadPct}%`}}/></div>}
          <button className="btn primary full" onClick={startAnalysis} disabled={!media||busy}><Zap size={16}/> {busy&&job?.kind==="viral_analysis"?"Analyzing…":"Analyze video"}</button>
          <InlineJobState job={job?.kind==="viral_analysis"?job:null}/>
          {error&&<div className="job-card error">{error}</div>}
        </section>
        {sourceUrl?<video ref={sourceRef} className="source-preview" src={sourceUrl} controls playsInline/>:<BackendState media={media} job={job}/>}
      </div>}

      {active==="edit"&&<>
        <div className="workspace-grid">
          <section className="panel">
            <small className="eyebrow">EDIT+ · AI EDIT</small><h3>Upload once. Pick the look. Edit+ does the rest.</h3>
            <label className="upload-zone"><input type="file" accept="video/mp4,video/quicktime,video/webm,.mp4,.mov,.webm" onChange={e=>{const f=e.target.files?.[0];if(f)uploadVideo(f)}}/><div><Upload size={30}/><b>{file?file.name:media?"Clip importé — prêt à monter":"Drop your video here"}</b><span>Then choose one of the 8 locked models</span></div></label>
            {file&&<div className="progress"><i style={{width:`${uploadPct}%`}}/></div>}
            <div className="status-row"><span>Video</span><span className="status-pill">{media?"Ready":file?`${uploadPct}%`:"Waiting"}</span></div>
          </section>
          {sourceUrl?<video ref={sourceRef} className="source-preview" src={sourceUrl} controls playsInline/>:<BackendState media={media} job={job}/>}
        </div>

        <section className="model-library">
          <div className="section-heading"><small>8 LOCKED MODELS</small><h2>Choose the actual editing language.</h2><p>Every model changes pacing, captions, crops, graphics, B-roll rules and finishing. Same source ≠ same render.</p></div>
          <div className="model-grid">{EDIT_MODELS.map(model=><button key={model.id} className={`model-card ${editModel===model.id?"selected":""}`} data-model={model.id} onClick={()=>setEditModel(model.id)}>
            <div className="model-preview"><div className="preview-face"/><div className="preview-caption">{model.preview}</div><div className="preview-cut"/><span className="preview-badge">{model.name}</span></div>
            <div className="model-copy"><div><strong>{model.name}</strong><span>{model.category}</span></div>{editModel===model.id&&<Check size={18}/>}<p>{model.meta}</p></div>
          </button>)}</div>
          <label className="format-picker">Format de sortie <select className="field" value={format} onChange={e=>setFormat(e.target.value)} disabled={busy}><option value="native">Natif — conserver le format source</option><option value="portrait">Portrait — 1080 × 1920</option><option value="landscape">Paysage — 1920 × 1080</option></select></label>
          <button className="btn primary create-edit" onClick={startEdit} disabled={!media||busy}><Clapperboard size={17}/> {busy&&job?.kind==="edit_render"?"Editing…":`Create with ${selectedModel.name}`}</button>
          <InlineJobState job={job?.kind==="edit_render"?job:null}/>
          {error&&<div className="job-card error">{error}</div>}
        </section>
      </>}

      {active==="clip"&&<div className="workspace-grid">
        <section className="panel clip-url-panel">
          <small className="eyebrow">CLIP+ · YOUTUBE TO SHORTS</small><h3>Paste a long YouTube video. Get the best Shorts.</h3>
          <p className="clip-promise">URL → analyse complète → meilleurs passages → 9:16 → captions → clips prêts à poster.</p>
          <div className="url-box"><Link2 size={20}/><input value={clipUrl} onChange={e=>{setClipUrl(e.target.value);setClipMedia(null)}} placeholder="Paste YouTube URL"/></div>
          <button type="button" className="clip-upload-toggle" onClick={()=>setClipFallback(v=>!v)}>{clipFallback?"Hide file import":"YouTube blocked? Import the video instead"}</button>
          {clipFallback&&<div className="clip-upload-fallback">
            <small>DIRECT FILE FALLBACK</small>
            <p>MP4, MOV ou WebM. Le fichier rejoint ensuite le même moteur Clip+ : sélection des passages, 9:16 et captions.</p>
            <label className="upload-zone compact"><input type="file" accept="video/mp4,video/quicktime,video/webm,.mp4,.mov,.webm" onChange={e=>{const f=e.target.files?.[0];if(f)uploadClipSource(f)}}/><div><Upload size={24}/><b>{clipFile?clipFile.name:"Import the source video"}</b><span>{clipMedia?"Ready for Clip+":clipFile?`${clipUploadPct}% uploaded`:"Up to 500 MB"}</span></div></label>
            {clipFile&&<div className="progress"><i style={{width:`${clipUploadPct}%`}}/></div>}
          </div>}
          <div className="clip-count-label">How many clips do you want?</div>
          <div className="clip-count-selector">{([5,10,20] as const).map(n=><button key={n} className={clipCount===n?"selected":""} onClick={()=>setClipCount(n)}><strong>{n}</strong><span>clips</span></button>)}</div>
          <div className="quality-note"><Check size={14}/><span>Quality first: Clip+ can return fewer clips if the source does not contain enough strong standalone moments.</span></div>
          <label className="rights-check"><input type="checkbox" checked={clipRights} onChange={e=>setClipRights(e.target.checked)}/><span>Je confirme que je possède cette vidéo ou que j’ai l’autorisation de la traiter.</span></label>
          <button className="btn primary full" onClick={startClip} disabled={(!clipMedia&&!clipUrl.trim())||!clipRights||busy}><Scissors size={16}/> {busy&&job?.kind==="clip_generate"?`Creating up to ${clipCount} clips…`:clipMedia?`Generate ${clipCount} clips from upload`:`Generate ${clipCount} clips`}</button>
          <InlineJobState job={job?.kind==="clip_generate"?job:null}/>
          {error&&<div className="job-card error">{error}</div>}
        </section>
        <BackendState media={null} job={job}/>
      </div>}

      {active==="edit"&&editExportUrl&&<section className="result-panel edit-result"><div className="result-copy"><small>EDIT+ · READY</small><h2>{selectedModel.name} render ready.</h2><p>The final video was rendered with the locked {selectedModel.name} model.</p><div className="result-actions"><a className="btn primary" href={editExportUrl} target="_blank" rel="noreferrer">Open MP4 ↗</a></div></div><video className="result-video" src={editExportUrl} controls playsInline/></section>}

      {active==="viral"&&analysis&&<>
        <section className="result-panel viral-hero-result">
          <div><small>VIRAL SCORE</small><div className="score-big">{score??"—"}<span>/100</span></div><div className="score-version">Creative potential · pre-publish</div></div>
          <div className="result-copy"><small>VERDICT</small><h2>{analysis.main_problem||"Diagnostic completed"}</h2><p>{analysis.verdict||analysis.why}</p><div className="result-why">{analysis.why}</div><button className="btn primary" onClick={()=>switchModule("edit")}>FIX WITH EDIT+ →</button></div>
        </section>

        <section className="viral-detail-section">
          <div className="section-heading"><small>DETAILED SCORING</small><h2>Exactly where the score comes from.</h2><p>Each criterion is scored independently, with the observable reason behind it.</p></div>
          <div className="viral-score-grid">
            {VIRAL_METRICS.map(([key,label])=>{const value=analysis.scores?.[key];const evidence=analysis.score_evidence?.[key];const breakdown=(analysis.score_breakdown||[]).find((x:any)=>x.key===key);return <article className={`viral-metric ${scoreTone(value)}`} key={key}><div className="metric-head"><span>{label}</span><strong>{value??"—"}<small>/100</small></strong></div><div className="metric-bar"><i style={{width:`${Math.max(0,Math.min(100,Number(value||0)))}%`}}/></div><p>{evidence||"No evidence returned."}</p>{breakdown&&<div className="score-weight"><span>Weight {breakdown.weight}%</span><b>+{breakdown.contribution} pts</b></div>}{key==="cta"&&<small className="metric-note">Diagnosed separately · 0% weight in Viral Score</small>}</article>})}
          </div>
        </section>

        <section className="viral-fix-grid">
          <article className="viral-fix-card priority-card">
            <small>TOP 3 FIXES</small><h3>Change these before posting.</h3>
            <div className="fix-plan-list">{(analysis.fix_plan?.length?analysis.fix_plan:(analysis.action_items||[]).map((item:any,i:number)=>({priority:i+1,area:"editing",problem:item,exact_change:item}))).slice(0,3).map((item:any,i:number)=><div className="fix-plan-item" key={i}><div className="fix-priority">P{item.priority||i+1}</div><div><div className="fix-meta"><strong>{String(item.area||"editing").toUpperCase()}</strong>{Number(item.end_sec||0)>Number(item.start_sec||0)&&<span>{Number(item.start_sec||0).toFixed(1)}s → {Number(item.end_sec||0).toFixed(1)}s</span>}</div>{item.problem&&<p><b>Problem:</b> {item.problem}</p>}{item.why_it_matters&&<p><b>Why:</b> {item.why_it_matters}</p>}<div className="exact-change"><b>DO THIS →</b> {item.exact_change||item.problem}</div>{item.example&&<div className="fix-example"><b>Example:</b> {item.example}</div>}{item.expected_effect&&<small>{item.expected_effect}</small>}</div></div>)}</div>
          </article>
          <article className="viral-fix-card rewrite-card">
            <small>REWRITE</small><h3>Use stronger packaging.</h3>
            {analysis.recommended_hook&&<div className="rewrite-row"><span>Hook</span><strong>{analysis.recommended_hook}</strong></div>}
            {analysis.recommended_title&&<div className="rewrite-row"><span>Title</span><strong>{analysis.recommended_title}</strong></div>}
            {analysis.recommended_cta&&<div className="rewrite-row"><span>CTA</span><strong>{analysis.recommended_cta}</strong></div>}
            {analysis.alternative_hooks?.length>0&&<div className="alt-hooks">{analysis.alternative_hooks.map((h:any,i:number)=><p key={i}>{i+1}. {h}</p>)}</div>}
          </article>
        </section>

        {analysis.timeline?.length>0&&<section className="viral-timeline-panel">
          <div className="section-heading"><small>TIMELINE FIXES</small><h2>What to change, second by second.</h2></div>
          <div className="viral-timeline">{analysis.timeline.map((x:any,i:number)=><article key={i} className={`timeline-fix ${x.severity||"orange"}`}><button className="timeline-time" onClick={()=>{if(sourceRef.current){sourceRef.current.currentTime=Number(x.start_sec)||0;sourceRef.current.scrollIntoView({behavior:"smooth",block:"center"});}}}>{Number(x.start_sec||0).toFixed(1)}s → {Number(x.end_sec||0).toFixed(1)}s ▶</button><div><strong>{x.label||"Moment to fix"}</strong><p>{x.problem}</p><small>{x.correction}</small>{x.broll_query&&<em>B-roll: {x.broll_query}</em>}</div></article>)}</div>
        </section>}

        {safeZone&&<section className="safe-zone-panel"><div className="safe-phone"><div className="unsafe top"/><div className="safe-frame"><span>UNIVERSAL SAFE</span></div><div className="unsafe right"/><div className="unsafe bottom"/></div><div className="safe-copy"><small>SAFE ZONE</small><h2>{safeZone.score??"—"}<span>/100</span></h2><p>{safeZone.summary||"Framing, text and caption placement checked for short-form UI risk."}</p><div className="safe-metrics"><span>Framing <b>{safeZone.framing}</b></span><span>Text <b>{safeZone.text_safety}</b></span><span>Captions <b>{safeZone.caption_safety}</b></span><span>Platform fit <b>{safeZone.platform_fit}</b></span></div>{safeZone.issues?.length>0&&<div className="safe-issues">{safeZone.issues.slice(0,6).map((x:any,i:number)=><div className={`safe-issue ${x.severity}`} key={i}><strong>{x.element}</strong><span>{x.problem}</span><small>{x.correction}</small></div>)}</div>}</div></section>}
      </>}

      {active==="clip"&&clipProject?.clips?.length>0&&<section className="clips-section"><div className="section-heading"><small>CLIP+ · READY</small><h2>{clipProject.clips.length} strong clip{clipProject.clips.length>1?"s":""} found.</h2><p>{clipProject.clips.length<clipCount?`You asked for ${clipCount}. Clip+ stopped at ${clipProject.clips.length} because quality comes before quota.`:"All requested clips passed the quality threshold."}</p></div><div className="clips-grid">{clipProject.clips.map((clip:any)=><article className="clip-card" key={clip.id}><div className="clip-rank">0{clip.rank}</div><strong>{clip.viral_score??"—"}</strong><small>Viral potential</small><h3>{clip.title||"Untitled clip"}</h3><p>{clip.hook||clip.rationale}</p><button className="btn primary clip-open" onClick={()=>openClip(clip.id)}>Open clip ↗</button><button className="btn ghost" onClick={()=>useClip(clip,"edit")}>Open in Edit+ →</button><button className="btn ghost" onClick={()=>useClip(clip,"viral")}>Analyze with Viral+ →</button></article>)}</div></section>}
    </section>
  </main>;
}

function BackendState({media,job}:{media:Media|null;job:Job|null}){
  return <aside className="panel backend-state"><h3>Live state</h3><div className="status-row"><span>Source</span><span className="status-pill">{media?.id?"Registered":"—"}</span></div><div className="status-row"><span>Job</span><span className="status-pill">{job?.status||"—"}</span></div><div className="status-row"><span>Stage</span><span className="status-pill">{job?.stage||"—"}</span></div><div className="status-row"><span>Progress</span><span className="status-pill">{typeof job?.progress==="number"?job.progress+"%":"—"}</span></div>{job&&<div className="job-card"><strong>{job.status}</strong><small>{job.id}</small></div>}</aside>
}


function InlineJobState({job}:{job:Job|null}){
  if(!job)return null;
  const progress=typeof job.progress==="number"?Math.max(0,Math.min(100,job.progress)):0;
  const label=job.status==="queued"
    ?"Queued — waiting for worker"
    :job.status==="completed"
      ?"Completed"
      :job.status==="failed"
        ?"Failed"
        :job.stage||job.status||"Processing";
  return <div className="inline-job-state">
    <div><span>{label}</span><b>{progress}%</b></div>
    <div className="progress"><i style={{width:`${progress}%`}}/></div>
  </div>;
}
