const SUPABASE_URL="https://eiypztjpmxdiuaqxjuqx.supabase.co";
const KEY="sb_publishable_Wl8iv037-iZ59iStDPu96A_RMn-US2C";
const PROJECT_REF="eiypztjpmxdiuaqxjuqx";
const BUCKET="viralplus-videos";
const client=window.supabase.createClient(SUPABASE_URL,KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});

let session=null,media=null,currentJob=null,poller=null,authMode="login",analysis=null;
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];

function toast(msg){const el=$("#toast");el.textContent=msg;el.classList.remove("hidden");clearTimeout(el._t);el._t=setTimeout(()=>el.classList.add("hidden"),3200)}
function showAuth(){ $("#authModal").classList.remove("hidden") }
function hideAuth(){ $("#authModal").classList.add("hidden") }
function token(){return session?.access_token||""}
function fn(name,path=""){return `${SUPABASE_URL}/functions/v1/${name}${path?"/"+String(path).replace(/^\//,""):""}`}
async function api(url,opts={}){
  const headers={apikey:KEY,Authorization:`Bearer ${token()}`,"Content-Type":"application/json",...(opts.headers||{})};
  const r=await fetch(url,{...opts,headers});
  const body=await r.json().catch(()=>({}));
  if(!r.ok)throw new Error(body.error||body.message||`Request failed (${r.status})`);
  return body;
}
function setTab(name){
  $$(".tab").forEach(x=>x.classList.toggle("active",x.dataset.tab===name));
  $$(".pane").forEach(x=>x.classList.toggle("active",x.dataset.pane===name));
  document.querySelector("#workspace").scrollIntoView({behavior:"smooth",block:"start"});
}
function setState(job){
  $("#stateMedia").textContent=media?.id?"Registered":"—";
  $("#stateJob").textContent=job?.status||"—";
  $("#stateStage").textContent=job?.stage||"—";
  $("#stateProgress").textContent=Number.isFinite(Number(job?.progress))?Number(job.progress)+"%":"—";
  $("#jobLog").textContent=job?[`${job.kind||"job"} · ${job.status}`,job.stage||"",job.id||"",job.error||""].filter(Boolean).join("\n"):"No job running.";
}
function requireAuth(){if(!session){showAuth();toast("Connecte-toi pour utiliser le vrai moteur.");return false}return true}

async function refreshSession(){
  const {data}=await client.auth.getSession();session=data.session;
  const el=$("#accountState"),btn=$("#authBtn");
  if(session){el.textContent=session.user.email||"Signed in";btn.textContent="Sign out"}
  else{el.textContent="Not signed in";btn.textContent="Sign in"}
}
client.auth.onAuthStateChange((_e,s)=>{session=s;refreshSession()});
refreshSession();

$("#authBtn").onclick=async()=>{if(session){await client.auth.signOut();toast("Déconnecté")}else showAuth()};
$("#startBtn").onclick=$("#heroStart").onclick=()=>{if(!session)showAuth();else setTab("viral")};
$("#closeAuth").onclick=hideAuth;
$("#authModal").addEventListener("click",e=>{if(e.target===$("#authModal"))hideAuth()});
$$("[data-authmode]").forEach(b=>b.onclick=()=>{
  authMode=b.dataset.authmode;$$("[data-authmode]").forEach(x=>x.classList.toggle("active",x===b));
  $("#authTitle").textContent=authMode==="login"?"Sign in":"Create your studio.";
  $("#authSubmit").textContent=authMode==="login"?"Sign in":"Create account";
  $("#authMessage").textContent="";
});
$("#authForm").onsubmit=async e=>{
  e.preventDefault();$("#authMessage").textContent="";$("#authSubmit").disabled=true;
  try{
    const email=$("#email").value.trim(),password=$("#password").value;
    const res=authMode==="login"?await client.auth.signInWithPassword({email,password}):await client.auth.signUp({email,password});
    if(res.error)throw res.error;
    await refreshSession();hideAuth();toast(authMode==="login"?"Connecté.":"Compte créé.");setTab("viral");
  }catch(err){$("#authMessage").textContent=err.message||String(err)}
  finally{$("#authSubmit").disabled=false}
};

$$(".tab").forEach(b=>b.onclick=()=>setTab(b.dataset.tab));
$$("[data-module]").forEach(b=>b.onclick=()=>{if(!session)showAuth();setTab(b.dataset.module)});
$$("[data-open]").forEach(b=>b.onclick=()=>{if(!session)showAuth();setTab(b.dataset.open)});

const scene=$("#scene");
window.addEventListener("mousemove",e=>{
  if(innerWidth<900)return;
  const dx=(e.clientX-innerWidth/2)/innerWidth,dy=(e.clientY-innerHeight/2)/innerHeight;
  scene.style.transform=`translate3d(${dx*12}px,${dy*8}px,0)`;
  const p=scene.querySelector(".phone"); if(p)p.style.transform=`rotateY(${-8+dx*7}deg) rotateX(${-dy*5}deg) rotateZ(5deg)`;
},{passive:true});

function safeName(name){return name.replace(/[^a-zA-Z0-9._-]+/g,"-").slice(-120)}
async function uploadVideo(file){
  if(!requireAuth())return;
  $("#viralFileName").textContent=file.name;$("#uploadWrap").classList.remove("hidden");$("#uploadProgress").style.width="0%";$("#uploadText").textContent="0%";
  $("#analyzeBtn").disabled=true;$("#editBtn").disabled=true;media=null;analysis=null;setState(null);
  const objectName=`${session.user.id}/${crypto.randomUUID()}-${safeName(file.name)}`;
  const upload=new tus.Upload(file,{
    endpoint:`https://${PROJECT_REF}.storage.supabase.co/storage/v1/upload/resumable`,
    retryDelays:[0,3000,5000,10000,20000],
    headers:{authorization:`Bearer ${token()}`,"x-upsert":"false"},
    uploadDataDuringCreation:true,removeFingerprintOnSuccess:true,chunkSize:6*1024*1024,
    metadata:{bucketName:BUCKET,objectName,contentType:file.type||"video/mp4",cacheControl:"3600"},
    onError(err){toast("Upload impossible: "+(err.message||err));$("#uploadText").textContent="Failed"},
    onProgress(sent,total){const p=Math.round(sent/total*100);$("#uploadProgress").style.width=p+"%";$("#uploadText").textContent=p+"%"},
    async onSuccess(){
      try{
        const body=await api(fn("viral-edit-jobs","media"),{method:"POST",body:JSON.stringify({storage_path:objectName,mime_type:file.type||"video/mp4",size_bytes:file.size,original_name:file.name,module:"shared"})});
        media=body.media;$("#uploadText").textContent="Uploaded · Ready";$("#analyzeBtn").disabled=false;$("#editBtn").disabled=false;$("#editMedia").textContent=file.name+" · media registered";setState(null);toast("Vidéo prête.");
      }catch(err){toast(err.message)}
    }
  });
  try{const prev=await upload.findPreviousUploads();if(prev.length)upload.resumeFromPreviousUpload(prev[0])}catch{}
  upload.start();
}
$("#viralFile").onchange=e=>{const f=e.target.files?.[0];if(f)uploadVideo(f)};

async function pollJob(id,kind,projectId=null,onDone){
  if(poller)clearInterval(poller);
  const tick=async()=>{
    try{
      const path=kind==="clip"?fn("clip-jobs",`jobs/${id}`):fn("viral-edit-jobs",`jobs/${id}`);
      const body=await api(path);currentJob=body.job;setState(currentJob);
      if(["completed","failed"].includes(currentJob.status)){
        clearInterval(poller);poller=null;
        if(currentJob.status==="failed"){throw new Error(currentJob.error||currentJob.error_code||"Job failed")}
        await onDone?.(currentJob,projectId);
      }
    }catch(err){if(poller)clearInterval(poller);poller=null;toast(err.message);setState({...currentJob,status:"failed",error:err.message})}
  };
  await tick();if(currentJob&&!["completed","failed"].includes(currentJob.status))poller=setInterval(tick,2200);
}

$("#analyzeBtn").onclick=async()=>{
  if(!requireAuth()||!media)return;$("#analyzeBtn").disabled=true;$("#viralResult").classList.add("hidden");
  try{
    const body=await api(fn("viral-edit-jobs","analysis"),{method:"POST",body:JSON.stringify({video_id:media.id})});
    currentJob=body.job;setState(currentJob);toast("Analyse lancée.");
    await pollJob(body.job.id,"core",null,async job=>{
      const {data,error}=await client.from("viralplus_analyses").select("*").eq("job_id",job.id).maybeSingle();if(error)throw error;
      analysis=data?.result_json?{...data.result_json,id:data.id,analysis_id:data.id}:data;
      const r=$("#viralResult");r.classList.remove("hidden");
      r.innerHTML=`<div class="resultScore">${analysis?.final_score??data?.final_score??"—"}<small>/100</small></div><small>MAIN PROBLEM</small><h4>${escapeHtml(analysis?.main_problem||data?.main_problem||"Analysis completed")}</h4><p>${escapeHtml(analysis?.why||data?.why||"")}</p><button class="primary" id="fixBtn">FIX WITH EDIT+ →</button>`;
      $("#fixBtn").onclick=()=>setTab("edit");$("#analyzeBtn").disabled=false;toast("Analyse terminée.");
    });
  }catch(err){toast(err.message);$("#analyzeBtn").disabled=false}
};

$("#editBtn").onclick=async()=>{
  if(!requireAuth()||!media)return;$("#editBtn").disabled=true;$("#editResult").classList.remove("hidden");$("#editResult").innerHTML="Creating edit job…";
  try{
    const body=await api(fn("viral-edit-jobs","edit"),{method:"POST",body:JSON.stringify({video_id:media.id,analysis_id:analysis?.analysis_id||analysis?.id||null,style:$("#editStyle").value,caption_preset:$("#captionPreset").value})});
    currentJob=body.job;setState(currentJob);toast("Montage lancé.");
    await pollJob(body.job.id,"core",null,async job=>{
      $("#editResult").innerHTML=`<small>EDIT+ COMPLETED</small><h4>Render job completed.</h4><p>Job ${escapeHtml(job.id)} terminé. Le rendu est enregistré dans le backend Viral Studio.</p>`;$("#editBtn").disabled=false;toast("Montage terminé.");
    });
  }catch(err){toast(err.message);$("#editBtn").disabled=false}
};

$("#clipBtn").onclick=async()=>{
  if(!requireAuth())return;const url=$("#clipUrl").value.trim();if(!url)return toast("Colle un lien vidéo.");if(!$("#rights").checked)return toast("Confirme tes droits sur le contenu.");
  $("#clipBtn").disabled=true;$("#clipResult").classList.remove("hidden");$("#clipResult").innerHTML="Finding best moments…";
  try{
    const body=await api(fn("clip-jobs","create"),{method:"POST",body:JSON.stringify({source_url:url,confirm_rights:true,clip_count:Number($("#clipCount").value),min_duration_sec:20,max_duration_sec:60,caption_preset:$("#clipCaption").value,add_captions:true})});
    currentJob=body.job;setState(currentJob);toast("Clip+ lancé.");
    await pollJob(body.job.id,"clip",body.project.id,async(_job,projectId)=>{
      const detail=await api(fn("clip-jobs",`projects/${projectId}`));const clips=detail.clips||[];
      $("#clipResult").innerHTML=`<small>CLIP+ RESULTS</small><h4>${clips.length} clips generated</h4><div class="clipCards">${clips.map(c=>`<div class="clipCard"><b>${c.viral_score??"—"}</b> <small>VIRAL POTENTIAL · CLIP 0${c.rank}</small><h4>${escapeHtml(c.title||"Untitled")}</h4><p>${escapeHtml(c.hook||c.rationale||"")}</p></div>`).join("")}</div>`;$("#clipBtn").disabled=false;toast("Clips générés.");
    });
  }catch(err){toast(err.message);$("#clipBtn").disabled=false}
};

function escapeHtml(v){return String(v??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]))}
