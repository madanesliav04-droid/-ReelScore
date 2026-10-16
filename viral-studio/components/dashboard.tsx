"use client";

import {useEffect,useMemo,useRef,useState} from "react";
import {BarChart3,Clapperboard,LogOut,Scissors,Upload,Zap,Check,Link2,ArrowRight,FileVideo,ShieldCheck} from "lucide-react";
import * as tus from "tus-js-client";
import {functionUrl,supabase,SUPABASE_PROJECT_REF,VIDEO_BUCKET} from "@/lib/supabase";
import {authMessage} from "@/lib/auth-message";
import {MAX_VIDEO_UPLOAD_MIB,uploadParts,videoUploadPreflight,videoUploadErrorMessage} from "@/lib/upload-limits";

type Module="viral"|"edit"|"clip";
type Job={id:string;kind?:string;status:string;progress?:number;stage?:string;result?:any;error?:any;error_code?:string;clip_project_id?:string|null};
type Media={id:string;storage_path:string;mime_type:string;size_bytes:number;original_name?:string};
type EditModel={id:string;name:string;category:string;preview:string;meta:string;goal:string;actions:string[];never:string};

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

// Five focused models. Historical exports from retired models remain accessible.
const EDIT_MODELS:EditModel[]=[
  {
    id:"codie",name:"Codie",category:"Business storytelling",preview:"FACE CAM",meta:"Narrative · restrained B-roll",
    goal:"Faire ressortir une histoire business forte, facecam dominante.",
    actions:["IDENTITÉ VERROUILLÉE : Noto Sans 850, taille 66 px en 1080×1920, blanc #FFFFFF, accent orange #FF9B45; 4 mots maximum, position middle-low, apparition douce.","NARRATION : facecam principale, maximum 3 cadrages (normal / crop / close-up); zoom uniquement sur passage fort, pas de bruitage ou transition gratuit.","Supprimer les silences de 780 ms ou plus, en préservant les respirations courtes.","Déclencher un zoom narratif seulement sur une rupture importante : au plus 3 par 30 s.","Ajouter jusqu’à 2 B-rolls de 1,9 à 3,4 s lorsqu’un élément concret est cité et illustrable.","Afficher des sous-titres blancs premium, sans surlignage mot-à-mot systématique.","Appliquer un traitement voix premium discret."],
    never:"Pas de zoom automatique, de carte citation décorative ou de B-roll abstrait."
  },
  {
    id:"impact",name:"Impact",category:"High-energy business",preview:"IMPACT",meta:"Fast · punchy · visual",
    goal:"Créer une vidéo énergique qui accélère la compréhension et la rétention.",
    actions:["IDENTITÉ VERROUILLÉE : DejaVu Sans 900, taille 80 px en 1080×1920, blanc #FFFFFF, accent cyan #37E6FF; 3 mots maximum, mot actif et pop rapide.","RYTHME : hard cuts éditoriaux, 8 punch-ins maximum par 30 s, éléments de langage percutants; refuser glitch et flash non motivés.","Couper les silences dès 420 ms et les hésitations transcrites.","Accentuer visuellement le hook avec un punch-in court.","Jusqu’à 8 punch-ins narratifs et 5 B-rolls concrets par 30 s.","Afficher un mot-clé ou une phrase de 4 mots maximum en grand lors de moments forts.","Sous-titres dynamiques et finition audio plus incisive."],
    never:"Pas d’inserts sans rapport avec le discours, ni de cuts qui amputent le sens."
  },
  {
    id:"clean",name:"Clean",category:"Modern creator",preview:"CLEAN",meta:"Simple · polished · minimal",
    goal:"Améliorer la fluidité d’une facecam sans attirer l’attention sur le montage.",
    actions:["IDENTITÉ VERROUILLÉE : Noto Sans 750, taille 60 px en 1080×1920, blanc #FFFFFF, sans couleur secondaire; 5 mots maximum en bas de cadre, apparition douce.","SOBRIÉTÉ : cadrage stable, montage invisible, aucune carte graphique, aucun karaoké ou transition décorative.","Couper les silences de plus de 620 ms et les hésitations détectées.","Ajouter au maximum 3 recadrages légers par 30 s, seulement si la narration le justifie.","Limiter à 1 B-roll explicatif par 30 s.","Afficher des sous-titres blancs lisibles et stables.","Équilibrer voix et image sans effet d’habillage superflu."],
    never:"Pas de cartouche graphique automatique, d’animation ou de zoom décoratif."
  },
  {
    id:"explainer",name:"Explainer",category:"Tutorial & SaaS",preview:"EXPLAIN",meta:"Show · label · clarify",
    goal:"Transformer une démonstration en étapes faciles à comprendre.",
    actions:["IDENTITÉ VERROUILLÉE : DejaVu Sans 800, taille 68 px en 1080×1920, blanc #FFFFFF, accent cyan clair #7CE8FF; 4 mots maximum, mot actif et apparition douce.","PÉDAGOGIE : images uniquement lorsque les outils et étapes sont réellement cités; aucun écran fictif; retour rapide vers la facecam.","Supprimer les silences dès 560 ms et les hésitations détectées.","Afficher des cartes d’étapes uniquement si une étape est réellement annoncée.","Jusqu’à 5 recadrages et 5 B-rolls d’outils, objets ou interfaces cités par 30 s.","Faire correspondre la durée des illustrations aux phrases et actions expliquées.","Utiliser des sous-titres didactiques et un son discret."],
    never:"Pas de capture de logiciel fictive, d’étape créée de toutes pièces ou d’image générique."
  },
  {
    id:"ugc_native",name:"UGC Native",category:"Native social",preview:"UGC",meta:"Human · phone-native · direct",
    goal:"Conserver un rendu smartphone naturel, spontané et convaincant.",
    actions:["IDENTITÉ VERROUILLÉE : DejaVu Sans 850, taille 68 px en 1080×1920, blanc #FFFFFF, accent rose #FF3FBF; 4 mots maximum, mot actif et pop léger.","NATIVITÉ : gestuelle et produit visibles, cuts smartphone, très peu de B-rolls, aucun effet publicitaire ou preuve inventée.","Préserver les respirations courtes, les gestes et les imperfections humaines utiles.","Ne couper que les silences de 740 ms ou plus.","Limiter à 3 zooms subtils et 1 insert produit pertinent par 30 s.","Utiliser des sous-titres modernes aux couleurs du modèle sans cartouche publicitaire forcé.","Nettoyer légèrement l’image et la voix sans dénaturer la captation."],
    never:"Pas de badges commerciaux, de cartes graphiques automatiques, ni de montage trop publicitaire."
  },
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
  if(!current?.access_token)throw Object.assign(new Error("Reconnecte-toi pour reprendre ton travail."),{status:401});
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
    if(res.status===401||code==="AUTH_REQUIRED")throw Object.assign(new Error("Ta session a expiré. Reconnecte-toi pour reprendre ton travail."),{status:401});
    if(code.toLowerCase().includes("quota_exhausted"))throw Object.assign(new Error("Ton quota mensuel d’analyses Viral+ est atteint. Consulte le compteur, puis réessaie après son renouvellement."),{status:429,code});
    throw Object.assign(new Error(/quota|credit|limit/i.test(code)?"La limite de traitement est atteinte. Réessaie plus tard.":"Le service n’a pas pu traiter la demande. Réessaie dans un instant."),{status:res.status});
  }
  return body;
}
function safeName(name:string){return name.replace(/[^a-zA-Z0-9._-]+/g,"-").slice(-120)}

export function Dashboard(){
  const [session,setSession]=useState<any>(null);
  const [authReady,setAuthReady]=useState(false);
  const [email,setEmail]=useState("");
  const [password,setPassword]=useState("");
  const [authMode,setAuthMode]=useState<"login"|"signup">("login");
  const [authError,setAuthError]=useState("");
  const [authPending,setAuthPending]=useState(false);
  const authLock=useRef(false);
  const [active,setActive]=useState<Module>("edit");
  const [file,setFile]=useState<File|null>(null);
  const [media,setMedia]=useState<Media|null>(null);
  const [uploadPct,setUploadPct]=useState(0);
  const [viralQuota,setViralQuota]=useState<{used:number;limit:number;remaining:number;reset_at:string}|null>(null);
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
  const [editOutputMediaId,setEditOutputMediaId]=useState("");
  const [preFixScore,setPreFixScore]=useState<number|null>(null);
  const [preFixVersion,setPreFixVersion]=useState<string|null>(null);
  const [busy,setBusy]=useState(false);
  const pollRef=useRef<ReturnType<typeof setTimeout>|null>(null);
  const pollGeneration=useRef(0);
  const uploadRef=useRef<tus.Upload|null>(null);
  const uploadLocked=useRef(false);
  const [uploading,setUploading]=useState(false);

  useEffect(()=>{
    const requested=new URLSearchParams(window.location.search).get("tool");
    if(requested==="viral"||requested==="edit")setActive(requested);
    else if(requested==="clip"){setActive("viral");history.replaceState(null,"","/dashboard?tool=viral");}
    supabase.auth.getSession().then(({data})=>setSession(data.session)).catch(()=>setSession(null)).finally(()=>setAuthReady(true));
    const {data}=supabase.auth.onAuthStateChange((_event,next)=>{setSession(next);setAuthReady(true)});
    return ()=>data.subscription.unsubscribe();
  },[]);
  useEffect(()=>{
    const owner=session?.user?.id;
    pollGeneration.current++;
    if(pollRef.current)clearTimeout(pollRef.current);
    void uploadRef.current?.abort();
    uploadRef.current=null;uploadLocked.current=false;setUploading(false);
    setBusy(false);setJob(null);setMedia(null);setFile(null);setSourceUrl("");
    setAnalysis(null);setClipMedia(null);setClipFile(null);setClipProject(null);
    setEditExportUrl("");setEditOutputMediaId("");setError("");
    setViralQuota(null);
    if(owner){
      try{
        const saved=localStorage.getItem(`viral-studio-active-job:${owner}`);
        const parsed=saved?JSON.parse(saved):null;
        if(parsed?.id&&["core","clip"].includes(parsed.channel)){
          setActive(parsed.module==="edit"?"edit":"viral");setBusy(true);
          void watchJob(parsed.id,parsed.channel);
        }
      }catch{}
    }
    return ()=>{
      pollGeneration.current++;
      if(pollRef.current)clearTimeout(pollRef.current);
      void uploadRef.current?.abort();
    };
  },[session?.user?.id]);
  useEffect(()=>()=>{
    if(sourceUrl.startsWith("blob:"))URL.revokeObjectURL(sourceUrl);
  },[sourceUrl]);

  const token=session?.access_token||"";
  const userId=session?.user?.id||"";
  const selectedModel=EDIT_MODELS.find(x=>x.id===editModel)||EDIT_MODELS[0];
  const score=useMemo(()=>analysis?.final_score??analysis?.score??null,[analysis]);
  const safeZone=analysis?.safe_zone||null;

  function switchModule(next:Module){
    if(busy||uploadLocked.current||next==="clip")return;
    setActive(next);
    setError("");
    setJob(null);
    history.replaceState(null,"",`/dashboard?tool=${next}`);
    if(next==="viral")void api(functionUrl("viral-edit-jobs","quota"),"").then(q=>setViralQuota(q.quota||null)).catch(()=>{});
  }

  function displayJobError(current:Job){
    const code=String(current?.error_code||"");
    if(code==="NO_CLIPS_FOUND")return "Aucun passage suffisamment fort n’a été détecté dans cette vidéo.";
    if(["YOUTUBE_EGRESS_REQUIRED","YOUTUBE_IMPORT_FAILED","YOUTUBE_UNAVAILABLE","IMPORT_CONFIGURATION_ERROR"].includes(code))return "YouTube bloque l’import automatique de cette source. Importe le fichier vidéo ci-dessous : Clip+ reprendra exactement le même pipeline de génération.";
    return "Le traitement n’a pas pu aboutir. Réessaie avec cette vidéo ou importe un autre fichier.";
  }

  async function authenticate(e:React.FormEvent){
    e.preventDefault();if(authLock.current)return;
    authLock.current=true;setAuthPending(true);setAuthError("");setAuthNotice("");
    try{
      const credentials={email:email.trim(),password};
      const {data,error}=await (authMode==="login"?supabase.auth.signInWithPassword(credentials):supabase.auth.signUp(credentials));
      if(error)setAuthError(authMessage(error));
      else if(authMode==="signup"&&!data.session)setAuthNotice("Consulte tes emails pour confirmer ton compte, puis connecte-toi.");
    }catch(error){setAuthError(authMessage(error))}
    finally{authLock.current=false;setAuthPending(false)}
  }

  async function uploadVideo(selected:File){return uploadSource(selected,false)}
  async function uploadClipSource(selected:File){return uploadSource(selected,true)}

  async function uploadSource(selected:File,isClip:boolean){
    if(busy||uploadLocked.current)return;
    const preflightError=videoUploadPreflight(selected);
    if(preflightError)return setError(preflightError);
    const ext=selected.name.split(".").pop()?.toLowerCase();
    const mime=({mp4:"video/mp4",mov:"video/quicktime",webm:"video/webm"} as Record<string,string>)[ext||""];
    if(!mime)return setError("Choisis une vidéo MP4, MOV ou WebM.");
    uploadLocked.current=true;setUploading(true);setError("");
    const release=()=>{uploadLocked.current=false;setUploading(false);uploadRef.current=null};
    try{
      const liveSession=await freshSession();
      const owner=liveSession.user.id;
      const generation=pollGeneration.current;
      const alive=()=>generation===pollGeneration.current;
      const parts=uploadParts(selected.size);
      const multipart=parts.length>1;
      const baseName=`${owner}/${crypto.randomUUID()}-${safeName(selected.name)}`;
      const chunkManifest:{path:string;size:number}[]=[];
      if(isClip){setClipFile(selected);setClipMedia(null);setClipUploadPct(0);setClipProject(null)}
      else{
        setSourceUrl(URL.createObjectURL(selected));setFile(selected);setMedia(null);
        setAnalysis(null);setUploadPct(0);setEditExportUrl("");setEditOutputMediaId("");setPreFixScore(null);setPreFixVersion(null);
      }
      setJob(null);
      const sendPart=async(partIndex:number):Promise<void>=>{
        if(!alive())return;
        const part=parts[partIndex];
        let objectName=multipart?baseName+"-part"+String(partIndex).padStart(3,"0"):baseName;
        const blob=multipart?selected.slice(part.start,part.end,mime):selected;
        const upload=new tus.Upload(blob,{
        endpoint:`https://${SUPABASE_PROJECT_REF}.storage.supabase.co/storage/v1/upload/resumable`,
        fingerprint:async()=>JSON.stringify(["viral-studio-v2",owner,selected.name,selected.size,selected.lastModified,...(multipart?[partIndex]:[])]),
        retryDelays:[0,3000,5000,10000,20000],
        headers:{"x-upsert":"false"},
        onBeforeRequest:async req=>{
          const current=await freshSession();
          if(current.user.id!==owner)throw new Error("Session modifiée.");
          req.setHeader("authorization",`Bearer ${current.access_token}`);
        },
        uploadDataDuringCreation:true,removeFingerprintOnSuccess:true,chunkSize:6*1024*1024,
        metadata:{bucketName:VIDEO_BUCKET,objectName,contentType:mime,cacheControl:"3600"},
        onError(uploadError){
          const status=Number((uploadError as any)?.originalResponse?.getStatus?.()||0);
          console.warn("Video upload failed",status);
          if(alive()){setError(videoUploadErrorMessage(status));release()}
        },
        onProgress(sent,total){if(alive())(isClip?setClipUploadPct:setUploadPct)(Math.min(99,Math.round((part.start+sent)/selected.size*100)))},
        async onSuccess(){
          if(!alive())return;
          chunkManifest.push({path:objectName,size:part.size});
          if(partIndex+1<parts.length){
            try{await sendPart(partIndex+1)}
            catch(err){console.warn("Multipart upload continuation failed",err);if(alive()){setError("L’import est interrompu. Sélectionne le même fichier pour reprendre.");release()}}
            return;
          }
          try{
            const body=await api(functionUrl("viral-edit-jobs","media"),token,{method:"POST",body:JSON.stringify({storage_path:chunkManifest[0]?.path,mime_type:mime,size_bytes:selected.size,original_name:selected.name,module:"shared",...(multipart?{metadata:{multipart:{version:1,parts:chunkManifest}}}:{})})});
            if(alive()){(isClip?setClipMedia:setMedia)(body.media);(isClip?setClipUploadPct:setUploadPct)(100)}
            if(!isClip)void api(functionUrl("viral-edit-jobs","quota"),"").then(q=>setViralQuota(q.quota||null)).catch(()=>{});
          }catch{if(alive())setError("La vidéo a été envoyée mais sa préparation a échoué. Réessaie l’import.")}
          finally{if(alive())release()}
        }
      });
      uploadRef.current=upload;
      const previous=await upload.findPreviousUploads();
      if(!alive())return;
      const resumable=previous.find(p=>p.metadata?.bucketName===VIDEO_BUCKET&&p.metadata?.objectName?.startsWith(owner+"/"));
      if(resumable){objectName=resumable.metadata.objectName;upload.options.metadata={...upload.options.metadata,objectName};upload.resumeFromPreviousUpload(resumable)}
      upload.start();
      };
      await sendPart(0);
    }catch{setError("L’import n’a pas démarré. Vérifie ta connexion et reconnecte-toi si nécessaire.");release()}
  }

  async function watchJob(id:string,kind:"core"|"clip"="core"){
    if(pollRef.current)clearTimeout(pollRef.current);
    const generation=++pollGeneration.current;
    const alive=()=>generation===pollGeneration.current;
    const storageKey=`viral-studio-active-job:${session.user.id}`;
    try{localStorage.setItem(storageKey,JSON.stringify({id,channel:kind,module:active}))}catch{}
    let failures=0;
    const tick=async()=>{
      if(!alive())return;
      let finished=false;
      try{
        const url=kind==="clip"?functionUrl("clip-jobs",`jobs/${id}`):functionUrl("viral-edit-jobs",`jobs/${id}`);
        const body=await api(url,token);
        if(!alive())return;
        setJob(body.job);
        setActive(body.job.kind==="edit_render"?"edit":body.job.kind==="viral_analysis"?"viral":active);
        // Every ready output becomes accessible immediately, including after a browser restart.
        if(kind==="clip"&&body.job.clip_project_id){
          try{
            const partial=await api(functionUrl("clip-jobs",`projects/${body.job.clip_project_id}`),token);
            if(alive())setClipProject(partial);
          }catch{
            // A transient project-read failure must not interrupt durable job polling.
          }
        }
        if(["failed","cancelled"].includes(body.job.status)){
          const code=String(body.job.error_code||"");
          if(kind==="clip"&&["YOUTUBE_EGRESS_REQUIRED","YOUTUBE_IMPORT_FAILED","YOUTUBE_UNAVAILABLE","IMPORT_CONFIGURATION_ERROR"].includes(code))setClipFallback(true);
          setError(body.job.status==="cancelled"?"Ce traitement a été annulé. Tu peux en lancer un nouveau.":displayJobError(body.job));
          finished=true;
        }else if(body.job.status==="completed"){
          // Retrieve every result before removing the recovery pointer.
          if(body.job.kind==="viral_analysis"){
            const {data,error:analysisError}=await supabase.from("viralplus_analyses").select("*").eq("job_id",id).maybeSingle();
            if(analysisError||!data)throw analysisError||new Error("Résultat indisponible.");
            const source=await api(functionUrl("viral-edit-jobs",`media/${body.job.video_id}/url`),token);
            if(!alive())return;
            setMedia(source.media);setSourceUrl(source.signed_url);
            setAnalysis(data.result_json?{...data.result_json,id:data.id,analysis_id:data.id}:data);
          }
          if(body.job.kind==="edit_render"){
            if(!body.job.result?.export_id)throw new Error("Export indisponible.");
            const out=await api(functionUrl("viral-edit-jobs",`exports/${body.job.result.export_id}/url`),token);
            if(!out?.signed_url)throw new Error("Export indisponible.");
            if(!alive())return;
            setEditOutputMediaId(String(body.job.result.output_video_id||out.media?.id||""));
            setEditExportUrl(out.signed_url);
          }
          if(body.job.kind==="clip_generate"){
            if(!body.job.result?.clip_project_id)throw new Error("Clips indisponibles.");
            const detail=await api(functionUrl("clip-jobs",`projects/${body.job.result.clip_project_id}`),token);
            if(!alive())return;
            setClipProject(detail);
          }
          setError("");finished=true;
        }else{setError("")}
        failures=0;
      }catch(e:any){
        if(!alive())return;
        if([401,403,404].includes(e?.status)){
          setError(e.status===404?"Ce traitement n’est plus disponible. Tu peux en lancer un nouveau.":"Reconnecte-toi pour reprendre ton traitement conservé.");
          setBusy(false);pollRef.current=null;
          if(e.status===404){try{localStorage.removeItem(storageKey)}catch{}}
          return;
        }
        failures++;
        setError("Connexion interrompue. Ton traitement reste conservé ; reconnexion automatique…");
      }
      if(!alive())return;
      if(finished){
        setBusy(false);pollRef.current=null;
        try{localStorage.removeItem(storageKey)}catch{}
      }else{
        pollRef.current=setTimeout(()=>void tick(),Math.min(30000,2000*2**Math.min(failures,4)));
      }
    };
    await tick();
  }

  async function startAnalysis(){
    if(busy||uploadLocked.current)return;if(!media)return setError("Importe d’abord une vidéo.");
    setError("");setAnalysis(null);setBusy(true);
    try{
      const body=await api(functionUrl("viral-edit-jobs","analysis"),token,{method:"POST",body:JSON.stringify({video_id:media.id})});
      setJob(body.job);
      void api(functionUrl("viral-edit-jobs","quota"),"").then(q=>setViralQuota(q.quota||null)).catch(()=>{});
      await watchJob(body.job.id);
    }catch(e:any){setError(e.message);setBusy(false)}
  }

  function pickAutoFixModel(result:any){
    const plan=Array.isArray(result?.fix_plan)?result.fix_plan:[];
    const areas=plan.map((x:any)=>String(x?.area||"")+" "+String(x?.problem||"")).join(" ").toLowerCase();
    if(/hook|retention|rhythm|pacing|editing|scroll/.test(areas))return "impact";
    if(/clarity|structure|message|explain|compréhension/.test(areas))return "explainer";
    if(/visual|caption|text|safe zone|framing/.test(areas))return "clean";

    const s=result?.scores||{};
    const metric=(key:string)=>Number.isFinite(Number(s[key]))?Number(s[key]):100;
    if(Math.min(metric("hook"),metric("scroll_stop"),metric("retention"),metric("rhythm"))<65)return "impact";
    if(Math.min(metric("clarity"),metric("structure"))<65)return "explainer";
    if(Math.min(metric("visual"),metric("text_captions"))<65)return "clean";
    return "codie";
  }

  async function startEdit(autoFix=false){
    if(busy||uploadLocked.current)return;if(!media)return setError("Importe d’abord une vidéo.");
    const modelToUse=autoFix?pickAutoFixModel(analysis):editModel;

    if(autoFix){
      const before=Number(score);
      setPreFixScore(Number.isFinite(before)?before:null);
      setPreFixVersion(String(analysis?.score_version||""));
      setEditModel(modelToUse);
      setActive("edit");
      history.replaceState(null,"","/dashboard?tool=edit");
    }

    setError("");setEditExportUrl("");setEditOutputMediaId("");setBusy(true);
    try{
      const body=await api(functionUrl("viral-edit-jobs","edit"),token,{method:"POST",body:JSON.stringify({
        video_id:media.id,
        analysis_id:analysis?.analysis_id||analysis?.id||null,
        style:modelToUse,
        settings:{format}
      })});
      setJob(body.job);await watchJob(body.job.id);
    }catch(e:any){setError(e.message);setBusy(false)}
  }

  async function analyzeEditOutput(){
    if(busy||!editOutputMediaId)return;
    setError("");setBusy(true);
    try{
      const out=await api(functionUrl("viral-edit-jobs",`media/${editOutputMediaId}/url`),token);
      if(!out?.media)throw new Error("Rendu Edit+ introuvable.");
      setMedia(out.media);
      setFile(null);
      setAnalysis(null);
      setSourceUrl(out.signed_url||"");
      setActive("viral");
      history.replaceState(null,"","/dashboard?tool=viral");

      const body=await api(functionUrl("viral-edit-jobs","analysis"),token,{
        method:"POST",
        body:JSON.stringify({video_id:editOutputMediaId})
      });
      setJob(body.job);
      await watchJob(body.job.id);
    }catch(e:any){
      setError(e.message);
      setBusy(false);
    }
  }

  async function startClip(){
    if(busy||uploadLocked.current)return;
    if(!clipMedia&&!clipUrl.trim())return setError("Colle une URL YouTube ou importe la vidéo.");
    if(!clipRights)return setError("Confirme que tu as le droit de traiter cette vidéo.");
    setError("");setClipProject(null);setBusy(true);
    try{
      const body=await api(functionUrl("clip-jobs","create"),token,{method:"POST",body:JSON.stringify({
        ...(clipMedia?{source_video_id:clipMedia.id}:{source_url:clipUrl.trim()}),
        confirm_rights:true,clip_count:clipCount,min_duration_sec:10,max_duration_sec:15,caption_preset:"modern_bold",add_captions:true
      })});
      setJob(body.job);setClipProject({project:body.project,clips:[]});await watchJob(body.job.id,"clip");
    }catch(e:any){setError(e.message);setBusy(false)}
  }

  async function openClip(clipId:string,download=false){
    // Open synchronously from the click gesture to avoid popup blockers after API awaits.
    const tab=window.open("about:blank","_blank");
    if(tab)tab.opener=null;
    try{
      const suffix=download?"?download=1":"";
      const body=await api(functionUrl("clip-jobs",`clips/${clipId}/url`)+suffix,token);
      if(!body?.signed_url)throw new Error("Clip indisponible.");
      if(tab)tab.location.href=body.signed_url;
      else window.location.assign(body.signed_url);
    }catch(e:any){
      tab?.close();
      setError(e.message);
    }
  }

  async function useClip(clip:any,next:Module){
    if(busy||uploadLocked.current)return;
    try{
      const body=await api(functionUrl("viral-edit-jobs",`media/${clip.output_video_id}/url`),token);
      setMedia(body.media);setFile(null);setAnalysis(null);setEditExportUrl("");setSourceUrl(body.signed_url);switchModule(next);
    }catch(e:any){setError(e.message)}
  }

  if(!authReady)return <main className="social-loading" role="status" aria-live="polite"><div className="social-loading-icon">S+</div><p>Ouverture de Social+…</p></main>;

  if(!session)return <main className="auth-screen"><div className="auth-orb"/><section className="auth-box">
    <div className="side-brand big">SOCIAL <span>+</span></div>
    <h1>{authMode==="login"?"Bon retour.":"Bienvenue sur Social+."}</h1><p>Montage intelligent avec Edit+. Analyse éditoriale avec Viral+.</p>
    <form onSubmit={authenticate} aria-busy={authPending}><input className="field" type="email" autoComplete="email" disabled={authPending} value={email} onChange={e=>setEmail(e.target.value)} placeholder="Email" required/><input className="field" type="password" autoComplete={authMode==="login"?"current-password":"new-password"} disabled={authPending} value={password} onChange={e=>setPassword(e.target.value)} placeholder="Password" minLength={6} required/><button type="submit" disabled={authPending} className="btn primary auth-submit">{authPending?"Connexion…":authMode==="login"?"Se connecter":"Créer mon compte"}</button></form>
    {authError&&<div role="alert" className="error auth-error">{authError}</div>}{authNotice&&<p role="status">{authNotice}</p>}
    <button className="auth-switch" disabled={authPending} onClick={()=>{setAuthError("");setAuthNotice("");setAuthMode(authMode==="login"?"signup":"login")}}>{authMode==="login"?"Créer un compte":"Déjà inscrit ? Se connecter"}</button>
  </section></main>;

  return <main className="dashboard-shell">
    <aside className="sidebar">
      <div className="side-brand">SOCIAL<span>+</span></div>
      <div className="side-group"><small>TES OUTILS</small>
        <button type="button" className={`side-link ${active==="edit"?"active":""}`} disabled={busy||uploading} onClick={()=>switchModule("edit")}><Clapperboard size={17}/> Edit+</button>
        <button type="button" className={`side-link ${active==="viral"?"active":""}`} disabled={busy||uploading} onClick={()=>switchModule("viral")}><BarChart3 size={17}/> Viral+</button>
      </div>
      <div className="side-group social-account"><small>COMPTE</small><button type="button" className="side-link" onClick={()=>void supabase.auth.signOut()}><LogOut size={16}/> Se déconnecter</button></div>
    </aside>

    <section className="dash-main">
      <header className="dash-top social-dash-head"><div><div className="social-dash-kicker">SOCIAL+ / STUDIO VIDÉO</div><h1>{active==="edit"?"Montage intelligent.":"Analyse éditoriale."}</h1><p>{active==="edit"?"Un vrai montage adapté à ton contenu, pas des effets automatiques sans raison.":"Comprends ce qui peut être amélioré et pourquoi, avec des observations vérifiables."}</p></div><div className="social-user-actions"><span className="user-pill" title={session.user.email}>{session.user.email}</span><button type="button" className="social-signout" onClick={()=>void supabase.auth.signOut()} aria-label="Se déconnecter"><LogOut size={16}/><span>Quitter</span></button></div></header>
      <div className="module-tabs social-workspace-tabs" role="group" aria-label="Choisir un outil">
        <button type="button" aria-pressed={active==="edit"} disabled={busy||uploading} className={active==="edit"?"active":""} onClick={()=>switchModule("edit")}><Clapperboard size={18}/><span><strong>Edit+</strong><small>Monter une vidéo</small></span></button>
        <button type="button" aria-pressed={active==="viral"} disabled={busy||uploading} className={active==="viral"?"active":""} onClick={()=>switchModule("viral")}><BarChart3 size={18}/><span><strong>Viral+</strong><small>Analyser une vidéo</small></span></button>
      </div>

      {active==="viral"&&<div className="workspace-grid">
        <section className="panel">
          <small className="eyebrow">VIRAL+ / ANALYSER</small><h3>Comprends les forces et les faiblesses de ta vidéo.</h3><p className="social-panel-explainer">Ajoute ton rush. Viral+ examine le hook, la clarté, le rythme et les passages à revoir, sans inventer de données Instagram.</p>
          {viralQuota&&<p role="status" className="quota-status" data-testid="viral-monthly-quota">Analyses ce mois : <strong>{viralQuota.used}/{viralQuota.limit}</strong> · {viralQuota.remaining} disponibles · renouvellement le {new Date(viralQuota.reset_at).toLocaleDateString("fr-FR",{day:"numeric",month:"long"})}</p>}
          <label className="upload-zone"><input type="file" disabled={busy||uploading} accept="video/mp4,video/quicktime,video/webm,.mp4,.mov,.webm" onChange={e=>{const f=e.currentTarget.files?.[0];e.currentTarget.value="";if(f)void uploadVideo(f)}}/><div><Upload size={30}/><b>{file?file.name:media?"Vidéo importée, prête à analyser":"Choisir une vidéo à analyser"}</b><span>MP4 · MOV · WebM · max {MAX_VIDEO_UPLOAD_MIB} Mo</span></div></label>
          {file&&<div className="social-upload-status" role="status" aria-live="polite"><span>{uploading?"Import en cours":media?"Import terminé":"Préparation du fichier"}</span><strong>{uploadPct}%</strong><div className="progress"><i style={{width:`${uploadPct}%`}}/></div></div>}
          <button className="btn primary full" onClick={startAnalysis} disabled={!media||busy||uploading}><Zap size={16}/> {busy&&job?.kind==="viral_analysis"?"Analyse en cours…":uploading?"Import en cours…":"Analyser ma vidéo"}</button>
          <InlineJobState job={job?.kind==="viral_analysis"?job:null}/>
          {error&&<div className="job-card error">{error}</div>}
        </section>
        {sourceUrl?<video ref={sourceRef} className="source-preview" src={sourceUrl} controls playsInline/>:<BackendState media={media} job={job}/>}
      </div>}

      {active==="edit"&&<>
        <div className="workspace-grid">
          <section className="panel">
            <small className="eyebrow">EDIT+ / MONTER</small><h3>Un montage construit autour de tes paroles.</h3><p className="social-panel-explainer">Importe un rush, sélectionne un style puis génère un export. L'original reste intact.</p>
            <label className="upload-zone"><input type="file" disabled={busy||uploading} accept="video/mp4,video/quicktime,video/webm,.mp4,.mov,.webm" onChange={e=>{const f=e.currentTarget.files?.[0];e.currentTarget.value="";if(f)void uploadVideo(f)}}/><div><Upload size={30}/><b>{file?file.name:media?"Vidéo importée, prête à monter":"Choisir une vidéo à monter"}</b><span>MP4 · MOV · WebM · max {MAX_VIDEO_UPLOAD_MIB} Mo · 5 modèles ciblés</span></div></label>
            {file&&<div className="social-upload-status" role="status" aria-live="polite"><span>{uploading?"Import en cours":media?"Import terminé":"Préparation du fichier"}</span><strong>{uploadPct}%</strong><div className="progress"><i style={{width:`${uploadPct}%`}}/></div></div>}
            {error&&<div role="alert" className="job-card error">{error}</div>}
            <div className="status-row"><span>Fichier vidéo</span><span className="status-pill">{media?"Prêt":file?`${uploadPct}%`:"En attente"}</span></div>
          </section>
          {sourceUrl?<video ref={sourceRef} className="source-preview" src={sourceUrl} controls playsInline/>:<BackendState media={media} job={job}/>}
        </div>

        <section className="model-library">
          <div className="section-heading"><small>5 MODÈLES CIBLÉS</small><h2>Choisis ton langage de montage.</h2><p>Codie, Impact, Clean, Explainer et UGC Native. Les autres styles sont retirés temporairement pour concentrer le travail sur la qualité réelle des exports.</p></div>
          <div className="model-grid">{EDIT_MODELS.map(model=><button key={model.id} className={`model-card ${editModel===model.id?"selected":""}`} data-model={model.id} onClick={()=>setEditModel(model.id)}>
            <div className={`model-preview ${model.id==="editorial_breakdown"?"editorial-preview":""}`}><div className="preview-face"/><div className="preview-caption">{model.preview}</div><div className="preview-cut"/><span className="preview-badge">{model.name}</span></div>
            <div className="model-copy"><div><strong>{model.name}</strong><span>{model.category}</span></div>{editModel===model.id&&<Check size={18}/>}<p>{model.meta}</p></div>
          </button>)}</div>
          <section className="model-action-contract" data-testid="edit-model-action-contract" aria-live="polite">
            <div className="contract-head"><span>CONTRAT DE MONTAGE · {selectedModel.name.toUpperCase()}</span><h3>{selectedModel.goal}</h3></div>
            <p className="contract-notice">Identité visuelle verrouillée par modèle. Les quantités sont des plafonds, pas des effets obligatoires : un montage utile prime sur le remplissage.</p>
            <ol>{selectedModel.actions.map((action,i)=><li key={i}><span>{String(i+1).padStart(2,"0")}</span><p>{action}</p></li>)}</ol>
            <div className="contract-avoid"><strong>À éviter</strong><p>{selectedModel.never}</p></div>
          </section>
          <label className="format-picker">Format de sortie <select className="field" value={format} onChange={e=>setFormat(e.target.value)} disabled={busy}><option value="native">Natif — conserver le format source</option><option value="portrait">Portrait — 1080 × 1920</option><option value="landscape">Paysage — 1920 × 1080</option></select></label>
          <button className="btn primary create-edit" onClick={()=>void startEdit(false)} disabled={!media||busy||uploading}><Clapperboard size={17}/> {busy&&job?.kind==="edit_render"?"Montage en cours…":`Créer mon montage · ${selectedModel.name}`}</button>
          <InlineJobState job={job?.kind==="edit_render"?job:null}/>
        </section>
      </>}

      {active==="edit"&&editExportUrl&&<section className="result-panel edit-result"><div className="result-copy"><small>EDIT+ · EXPORT TERMINÉ</small><h2>Ton montage {selectedModel.name} est prêt.</h2><p>Regarde l’export puis télécharge-le pour le publier.</p><div className="result-actions"><a className="btn primary" href={editExportUrl} target="_blank" rel="noreferrer">Ouvrir le MP4 ↗</a><button className="btn ghost" onClick={()=>void analyzeEditOutput()} disabled={busy||!editOutputMediaId}>Analyser dans Viral+ <ArrowRight size={15}/></button></div></div><video className="result-video" src={editExportUrl} controls playsInline/></section>}

      {active==="viral"&&analysis&&<>
        <section className="result-panel viral-hero-result">
          <div><small>VIRAL SCORE</small><div className="score-big">{score??"—"}<span>/100</span></div><div className="score-version">{preFixScore!==null&&score!==null?(preFixVersion&&preFixVersion===analysis.score_version?`Score créatif estimé : avant ${preFixScore} → après ${score} (pas des performances Instagram)`:"Scores non comparables : méthodologies différentes"):"Potentiel créatif estimé · avant publication"}</div></div>
          <div className="result-copy"><small>VERDICT</small><h2>{analysis.main_problem||"Diagnostic completed"}</h2><p>{analysis.verdict||analysis.why}</p><div className="result-why">{analysis.why}</div><button className="btn primary" onClick={()=>void startEdit(true)} disabled={busy}>Essayer avec Edit+ <ArrowRight size={15}/></button></div>
        </section>

        {analysis.top_priority&&<section className="viral-v5-priority" aria-label="Priorité éditoriale du Viral Score">
          <div className="viral-v5-heading">
            <small>PRIORITÉ N°1 · SCORE PONDÉRÉ</small>
            <strong>{String(analysis.top_priority.key||"").replaceAll("_"," ")} · {analysis.top_priority.score}/100</strong>
            <span>Impact théorique maximal : {Number(analysis.top_priority.impact_points||0).toFixed(1)} point(s) sur le Viral Score</span>
          </div>
          <div className="viral-v5-detail">
            <p>{analysis.top_priority.evidence||"Preuve insuffisante : diagnostic à vérifier."}</p>
            {analysis.top_priority.exact_change&&<div className="viral-v5-action"><b>Correction précise</b><span>{analysis.top_priority.exact_change}</span></div>}
            {analysis.top_priority.start_sec!==null&&analysis.top_priority.start_sec!==undefined&&<button className="viral-v5-seek" onClick={()=>{if(sourceRef.current){sourceRef.current.currentTime=Number(analysis.top_priority.start_sec)||0;sourceRef.current.scrollIntoView({behavior:"smooth",block:"center"});}}}>Examiner le passage à {Number(analysis.top_priority.start_sec||0).toFixed(1)} s ▶</button>}
          </div>
        </section>}

        <section className="viral-detail-section">
          <div className="section-heading"><small>LE DÉTAIL DU SCORE</small><h2>Comprends chaque critère.</h2><p>Chaque note repose sur une évaluation éditoriale et ses observations. Pas sur des statistiques Instagram.</p></div>
          <div className="viral-score-grid">
            {VIRAL_METRICS.map(([key,label])=>{const value=analysis.scores?.[key];const evidence=analysis.score_evidence?.[key];const breakdown=(analysis.score_breakdown||[]).find((x:any)=>x.key===key);return <article className={`viral-metric ${scoreTone(value)}`} key={key}><div className="metric-head"><span>{label}</span><strong>{value??"—"}<small>/100</small></strong></div><div className="metric-bar"><i style={{width:`${Math.max(0,Math.min(100,Number(value||0)))}%`}}/></div><p>{evidence||"Aucune observation fournie."}</p>{breakdown&&<div className="score-weight"><span>Poids {breakdown.weight}%</span><b>+{breakdown.contribution} pts</b></div>}{key==="cta"&&<small className="metric-note">Diagnostiqué à part · 0 % dans le score</small>}</article>})}
          </div>
        </section>

        <section className="viral-fix-grid">
          <article className="viral-fix-card priority-card">
            <small>À CORRIGER, SI NÉCESSAIRE</small><h3>Des modifications concrètes.</h3>
            <div className="fix-plan-list">{(analysis.fix_plan?.length?analysis.fix_plan:(analysis.action_items||[]).map((item:any,i:number)=>({priority:i+1,area:"editing",problem:item,exact_change:item}))).slice(0,3).map((item:any,i:number)=><div className="fix-plan-item" key={i}><div className="fix-priority">P{item.priority||i+1}</div><div><div className="fix-meta"><strong>{String(item.area||"editing").toUpperCase()}</strong>{Number(item.end_sec||0)>Number(item.start_sec||0)&&<span>{Number(item.start_sec||0).toFixed(1)}s → {Number(item.end_sec||0).toFixed(1)}s</span>}</div>{item.problem&&<p><b>Problème :</b> {item.problem}</p>}{item.why_it_matters&&<p><b>Pourquoi :</b> {item.why_it_matters}</p>}<div className="exact-change"><b>À FAIRE →</b> {item.exact_change||item.problem}</div>{item.example&&<div className="fix-example"><b>Exemple :</b> {item.example}</div>}{item.evidence_status&&<small className="viral-fix-evidence">{item.evidence_status==="transcript_excerpt_verified"?"Extrait présent dans la transcription":"Observation IA à vérifier dans la vidéo"}</small>}{item.source_quote&&<p className="viral-quote"><b>Extrait :</b> « {item.source_quote} »</p>}{item.observable_evidence&&<p className="viral-quote"><b>Observation :</b> {item.observable_evidence}</p>}{item.expected_effect&&<small>{item.expected_effect}</small>}</div></div>)}</div>
          </article>
          <article className="viral-fix-card rewrite-card">
            <small>TESTS POSSIBLES</small><h3>Une meilleure accroche ? Vérifions.</h3>
            {analysis.recommendation_video_review&&<p className="viral-hook-warning">{analysis.recommendation_video_review.status==="video_review_completed"?"Double contrôle : propositions réexaminées à partir du rush original.":"Second contrôle indisponible : suggestions non vérifiées écartées."}</p>}
                        {analysis.hook_experiments?.candidates?.length>0?<>
              <div className="viral-hook-test-flag">HYPOTHÈSES PERSONNALISÉES · PAS DE GAIN GARANTI</div>
              {analysis.hook_experiments.candidates.map((suggestion:any,i:number)=><div key={i} className="viral-hook-experiment">
                <small>PROPOSITION {i+1} · {suggestion.variable_changed}</small>
                <div className="viral-hook-comparison">
                  <div><span>{analysis.detected_spoken_hook&&analysis.detected_spoken_hook!=="INDETECTABLE"?"A · Accroche actuelle":"A · Extrait réel vérifiable"}</span><p>{analysis.detected_spoken_hook&&analysis.detected_spoken_hook!=="INDETECTABLE"?analysis.detected_spoken_hook:suggestion.source_quote}</p></div>
                  <div><span>B · Nouvelle ouverture à tester</span><strong>{suggestion.proposed_hook}</strong></div>
                </div>
                <p className="viral-hook-reason"><b>Phrase source retrouvée :</b> « {suggestion.source_quote} »</p>
                <p className="viral-hook-reason"><b>Pourquoi la tester :</b> {suggestion.why_test}</p>
                <p className="viral-hook-reason"><b>Hypothèse :</b> {suggestion.test_hypothesis}</p>
              </div>)}
              <p className="viral-hook-warning">Test A/B conseillé : modifier uniquement l'ouverture, garder le sujet et le reste du montage comparables, puis examiner la rétention et les autres données réelles disponibles. L'algorithme et l'audience peuvent varier.</p>
              <p className="viral-hook-warning">Aucune variante ne peut être déclarée meilleure avant comparaison des performances réelles.</p>
            </>:<div className="viral-hook-empty"><strong>Aucune nouvelle accroche suffisamment justifiée</strong><p>{analysis.hook_experiments?.status==="insufficient_verified_context"?"Les suggestions non étayées par la vidéo ont été écartées. Nous préférons ne rien proposer plutôt qu'inventer un hook générique.":"Cette analyse ne dispose pas encore d’une recommandation de hook vérifiée."}</p></div>}
            {analysis.recommended_title&&<div className="rewrite-row"><span>Titre à tester</span><strong>{analysis.recommended_title}</strong></div>}
            {analysis.recommended_cta&&<div className="rewrite-row"><span>CTA à tester</span><strong>{analysis.recommended_cta}</strong></div>}
          </article>
        </section>

        {analysis.editorial_risk_map?.length>0&&<section className="viral-v5-risk" aria-label="Risques de décrochage éditoriaux estimés">
          <div className="section-heading"><small>RISQUES ÉDITORIAUX · ESTIMATION IA</small><h2>Passages susceptibles de perdre l'attention.</h2><p>Ce ne sont pas des données de rétention Instagram : seuls les passages et les problèmes observés sont affichés.</p></div>
          <div className="viral-v5-risk-rows">{analysis.editorial_risk_map.slice(0,8).map((risk:any,i:number)=><button type="button" key={i} className={`viral-v5-risk-row ${risk.severity==="red"?"risk-high":"risk-mid"}`} onClick={()=>{if(sourceRef.current){sourceRef.current.currentTime=Number(risk.start_sec)||0;sourceRef.current.scrollIntoView({behavior:"smooth",block:"center"});}}}><span className="risk-time">{Number(risk.start_sec||0).toFixed(1)}–{Number(risk.end_sec||0).toFixed(1)} s</span><span className="risk-meaning"><strong>{risk.observed_problem}</strong><small>{risk.suggested_correction}</small></span><span className="risk-play">▶</span></button>)}</div>
        </section>}

        {analysis.timeline?.length>0&&<section className="viral-timeline-panel">
          <div className="section-heading"><small>CHRONOLOGIE</small><h2>Les passages à vérifier.</h2></div>
          <div className="viral-timeline">{analysis.timeline.map((x:any,i:number)=><article key={i} className={`timeline-fix ${x.severity||"orange"}`}><button className="timeline-time" onClick={()=>{if(sourceRef.current){sourceRef.current.currentTime=Number(x.start_sec)||0;sourceRef.current.scrollIntoView({behavior:"smooth",block:"center"});}}}>{Number(x.start_sec||0).toFixed(1)}s → {Number(x.end_sec||0).toFixed(1)}s ▶</button><div><strong>{x.label||"Moment to fix"}</strong><p>{x.problem}</p><small>{x.correction}</small>{x.broll_query&&<em>B-roll: {x.broll_query}</em>}</div></article>)}</div>
        </section>}

        {safeZone&&<section className="safe-zone-panel"><div className="safe-phone"><div className="unsafe top"/><div className="safe-frame"><span>UNIVERSAL SAFE</span></div><div className="unsafe right"/><div className="unsafe bottom"/></div><div className="safe-copy"><small>ZONE DE VISIBILITÉ</small><h2>{safeZone.score??"—"}<span>/100</span></h2><p>{safeZone.summary||"Framing, text and caption placement checked for short-form UI risk."}</p><div className="safe-metrics"><span>Cadrage <b>{safeZone.framing}</b></span><span>Texte <b>{safeZone.text_safety}</b></span><span>Sous-titres <b>{safeZone.caption_safety}</b></span><span>Format <b>{safeZone.platform_fit}</b></span></div>{safeZone.issues?.length>0&&<div className="safe-issues">{safeZone.issues.slice(0,6).map((x:any,i:number)=><div className={`safe-issue ${x.severity}`} key={i}><strong>{x.element}</strong><span>{x.problem}</span><small>{x.correction}</small></div>)}</div>}</div></section>}
      </>}

    </section>
  </main>;
}

function BackendState({media,job}:{media:Media|null;job:Job|null}){
  return <aside className="panel backend-state"><h3>Live state</h3><div className="status-row"><span>Source</span><span className="status-pill">{media?.id?"Registered":"—"}</span></div><div className="status-row"><span>Job</span><span className="status-pill">{job?.status||"—"}</span></div><div className="status-row"><span>Stage</span><span className="status-pill">{job?.stage||"—"}</span></div><div className="status-row"><span>Progress</span><span className="status-pill">{job?.status==="completed"?"100 %":job?"Étape en cours":"—"}</span></div>{job&&<div className="job-card"><strong>{job.status}</strong><small>{job.id}</small></div>}</aside>
}


function InlineJobState({job}:{job:Job|null}){
  if(!job)return null;
  const done=job.status==="completed";
  const label=job.status==="queued"
    ?"En attente de traitement"
    :job.status==="completed"
      ?"Terminé"
      :job.status==="failed"
        ?"Échec du traitement"
        :job.stage||job.status||"Processing";
  return <div className="inline-job-state" role="status" aria-live="polite">
    <div><span>{label}</span><b>{done?"100 %":"Étape en cours"}</b></div>
    {done&&<div className="progress"><i style={{width:"100%"}}/></div>}
  </div>;
}
