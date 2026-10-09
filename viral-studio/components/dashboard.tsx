"use client";

import {useEffect,useMemo,useRef,useState} from "react";
import {BarChart3,Clapperboard,LogOut,Scissors,Upload,Zap,Check,Link2} from "lucide-react";
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
  const [email,setEmail]=useState("");
  const [password,setPassword]=useState("");
  const [authMode,setAuthMode]=useState<"login"|"signup">("login");
  const [authError,setAuthError]=useState("");
  const [authPending,setAuthPending]=useState(false);
  const authLock=useRef(false);
  const [active,setActive]=useState<Module>("viral");
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
  const [busy,setBusy]=useState(false);
  const pollRef=useRef<ReturnType<typeof setTimeout>|null>(null);
  const pollGeneration=useRef(0);
  const uploadRef=useRef<tus.Upload|null>(null);
  const uploadLocked=useRef(false);
  const [uploading,setUploading]=useState(false);

  useEffect(()=>{
    const requested=new URLSearchParams(window.location.search).get("tool");
    if(requested==="viral"||requested==="edit"||requested==="clip")setActive(requested);
    supabase.auth.getSession().then(({data})=>setSession(data.session));
    const {data}=supabase.auth.onAuthStateChange((_event,next)=>setSession(next));
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
          setActive(parsed.module||"viral");setBusy(true);
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
    if(busy||uploadLocked.current)return;
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
        setAnalysis(null);setUploadPct(0);setEditExportUrl("");setEditOutputMediaId("");setPreFixScore(null);
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
        setActive(body.job.kind==="clip_generate"?"clip":body.job.kind==="edit_render"?"edit":"viral");
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

  if(!session)return <main className="auth-screen"><div className="auth-orb"/><section className="auth-box">
    <div className="side-brand big">VIRAL <span>STUDIO</span></div>
    <h1>{authMode==="login"?"Welcome back.":"Create your studio."}</h1><p>Clip. Edit. Analyze. Export.</p>
    <form onSubmit={authenticate} aria-busy={authPending}><input className="field" type="email" autoComplete="email" disabled={authPending} value={email} onChange={e=>setEmail(e.target.value)} placeholder="Email" required/><input className="field" type="password" autoComplete={authMode==="login"?"current-password":"new-password"} disabled={authPending} value={password} onChange={e=>setPassword(e.target.value)} placeholder="Password" minLength={6} required/><button type="submit" disabled={authPending} className="btn primary auth-submit">{authPending?"Connexion…":authMode==="login"?"Sign in":"Create account"}</button></form>
    {authError&&<div role="alert" className="error auth-error">{authError}</div>}{authNotice&&<p role="status">{authNotice}</p>}
    <button className="auth-switch" disabled={authPending} onClick={()=>{setAuthError("");setAuthNotice("");setAuthMode(authMode==="login"?"signup":"login")}}>{authMode==="login"?"No account? Create one":"Already registered? Sign in"}</button>
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
          {viralQuota&&<p role="status" className="quota-status" data-testid="viral-monthly-quota">Analyses ce mois : <strong>{viralQuota.used}/{viralQuota.limit}</strong> · {viralQuota.remaining} disponibles · renouvellement le {new Date(viralQuota.reset_at).toLocaleDateString("fr-FR",{day:"numeric",month:"long"})}</p>}
          <label className="upload-zone"><input type="file" disabled={busy||uploading} accept="video/mp4,video/quicktime,video/webm,.mp4,.mov,.webm" onChange={e=>{const f=e.currentTarget.files?.[0];e.currentTarget.value="";if(f)void uploadVideo(f)}}/><div><Upload size={30}/><b>{file?file.name:media?"Clip importé — prêt à analyser":"Drop a Reel here"}</b><span>MP4 · MOV · WebM · max {MAX_VIDEO_UPLOAD_MIB} Mo</span></div></label>
          {file&&<div className="progress"><i style={{width:`${uploadPct}%`}}/></div>}
          <button className="btn primary full" onClick={startAnalysis} disabled={!media||busy||uploading}><Zap size={16}/> {busy&&job?.kind==="viral_analysis"?"Analyzing…":"Analyze video"}</button>
          <InlineJobState job={job?.kind==="viral_analysis"?job:null}/>
          {error&&<div className="job-card error">{error}</div>}
        </section>
        {sourceUrl?<video ref={sourceRef} className="source-preview" src={sourceUrl} controls playsInline/>:<BackendState media={media} job={job}/>}
      </div>}

      {active==="edit"&&<>
        <div className="workspace-grid">
          <section className="panel">
            <small className="eyebrow">EDIT+ · AI EDIT</small><h3>Upload once. Pick the look. Edit+ does the rest.</h3>
            <label className="upload-zone"><input type="file" disabled={busy||uploading} accept="video/mp4,video/quicktime,video/webm,.mp4,.mov,.webm" onChange={e=>{const f=e.currentTarget.files?.[0];e.currentTarget.value="";if(f)void uploadVideo(f)}}/><div><Upload size={30}/><b>{file?file.name:media?"Clip importé — prêt à monter":"Drop your video here"}</b><span>MP4 · MOV · WebM · max {MAX_VIDEO_UPLOAD_MIB} Mo · 5 modèles ciblés</span></div></label>
            {file&&<div className="progress"><i style={{width:`${uploadPct}%`}}/></div>}
            {error&&<div role="alert" className="job-card error">{error}</div>}
            <div className="status-row"><span>Video</span><span className="status-pill">{media?"Ready":file?`${uploadPct}%`:"Waiting"}</span></div>
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
          <button className="btn primary create-edit" onClick={()=>void startEdit(false)} disabled={!media||busy||uploading}><Clapperboard size={17}/> {busy&&job?.kind==="edit_render"?"Editing…":`Create with ${selectedModel.name}`}</button>
          <InlineJobState job={job?.kind==="edit_render"?job:null}/>
        </section>
      </>}

      {active==="clip"&&<div className="workspace-grid">
        <section className="panel clip-url-panel">
          <small className="eyebrow">CLIP+ · YOUTUBE TO SHORTS</small><h3>Paste a long YouTube video. Get the best Shorts.</h3>
          <p className="clip-promise">URL → analyse des moments forts → extraits de 10 à 15 secondes → 9:16 → captions → clips prêts à poster.</p>
          <div className="url-box"><Link2 size={20}/><input value={clipUrl} onChange={e=>{setClipUrl(e.target.value);setClipMedia(null)}} placeholder="Paste YouTube URL"/></div>
          <button type="button" className="clip-upload-toggle" onClick={()=>setClipFallback(v=>!v)}>{clipFallback?"Hide file import":"YouTube blocked? Import the video instead"}</button>
          {clipFallback&&<div className="clip-upload-fallback">
            <small>DIRECT FILE FALLBACK</small>
            <p>MP4, MOV ou WebM. Le fichier rejoint ensuite le même moteur Clip+ : sélection des passages, 9:16 et captions.</p>
            <label className="upload-zone compact"><input type="file" disabled={busy||uploading} accept="video/mp4,video/quicktime,video/webm,.mp4,.mov,.webm" onChange={e=>{const f=e.currentTarget.files?.[0];e.currentTarget.value="";if(f)void uploadClipSource(f)}}/><div><Upload size={24}/><b>{clipFile?clipFile.name:"Import the source video"}</b><span>{clipMedia?"Ready for Clip+":clipFile?`${clipUploadPct}% uploaded`:`Max ${MAX_VIDEO_UPLOAD_MIB} Mo actuellement`}</span></div></label>
            {clipFile&&<div className="progress"><i style={{width:`${clipUploadPct}%`}}/></div>}
          </div>}
          <div className="clip-count-label">Combien d’extraits courts de 10–15 s veux-tu ?</div>
          <div className="clip-count-selector">{([5,10,20] as const).map(n=><button key={n} className={clipCount===n?"selected":""} onClick={()=>setClipCount(n)}><strong>{n}</strong><span>clips</span></button>)}</div>
          <div className="quality-note"><Check size={14}/><span>Meilleurs moments uniquement : hook immédiat, idée autonome, chute naturelle. Clip+ peut en produire moins si la vidéo ne contient pas assez de passages forts.</span></div>
          <label className="rights-check"><input type="checkbox" checked={clipRights} onChange={e=>setClipRights(e.target.checked)}/><span>Je confirme que je possède cette vidéo ou que j’ai l’autorisation de la traiter.</span></label>
          <button className="btn primary full" onClick={startClip} disabled={(!clipMedia&&!clipUrl.trim())||!clipRights||busy||uploading}><Scissors size={16}/> {busy&&job?.kind==="clip_generate"?`Creating up to ${clipCount} clips…`:clipMedia?`Generate ${clipCount} clips from upload`:`Generate ${clipCount} clips`}</button>
          <InlineJobState job={job?.kind==="clip_generate"?job:null}/>
          {error&&<div className="job-card error">{error}</div>}
        </section>
        <BackendState media={null} job={job}/>
      </div>}

      {active==="edit"&&editExportUrl&&<section className="result-panel edit-result"><div className="result-copy"><small>EDIT+ · READY</small><h2>{selectedModel.name} render ready.</h2><p>The final video was rendered with the locked {selectedModel.name} model.</p><div className="result-actions"><a className="btn primary" href={editExportUrl} target="_blank" rel="noreferrer">Open MP4 ↗</a><button className="btn ghost" onClick={()=>void analyzeEditOutput()} disabled={busy||!editOutputMediaId}>Analyze improved version →</button></div></div><video className="result-video" src={editExportUrl} controls playsInline/></section>}

      {active==="viral"&&analysis&&<>
        <section className="result-panel viral-hero-result">
          <div><small>VIRAL SCORE</small><div className="score-big">{score??"—"}<span>/100</span></div><div className="score-version">{preFixScore!==null&&score!==null?`Before ${preFixScore} → Now ${score}`:"Creative potential · pre-publish"}</div></div>
          <div className="result-copy"><small>VERDICT</small><h2>{analysis.main_problem||"Diagnostic completed"}</h2><p>{analysis.verdict||analysis.why}</p><div className="result-why">{analysis.why}</div><button className="btn primary" onClick={()=>void startEdit(true)} disabled={busy}>FIX WITH AI →</button></div>
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

      {active==="clip"&&clipProject?.clips?.length>0&&<section className="clips-section"><div className="section-heading"><small>CLIP+ · {job?.kind==="clip_generate"&&job.status!=="completed"?"EN COURS":"READY"}</small><h2>{clipProject.clips.length} clip{clipProject.clips.length>1?"s":""} disponible{clipProject.clips.length>1?"s":""}.</h2><p>{job?.kind==="clip_generate"&&!["completed","failed","cancelled"].includes(job.status)?`${clipProject.clips.length}/${clipProject.project?.requested_clip_count||clipCount} export(s) prêt(s). Les autres continuent en arrière-plan.`:clipProject.clips.length<clipCount?`Tu as demandé ${clipCount} clips : ${clipProject.clips.length} ont franchi le seuil qualité.`:"Les clips demandés sont disponibles."}</p></div><div className="clips-grid">{clipProject.clips.map((clip:any)=><article className="clip-card" key={clip.id}><div className="clip-rank">0{clip.rank}</div><strong>{clip.viral_score??"—"}</strong><small>{Number(clip.end_ms)>Number(clip.start_ms)?`${((clip.end_ms-clip.start_ms)/1000).toFixed(1)} s · `:""}Viral potential</small><h3>{clip.title||"Untitled clip"}</h3><p>{clip.hook||clip.rationale}</p><button className="btn primary clip-open" onClick={()=>openClip(clip.id)}>Voir le clip ↗</button><button className="btn ghost" onClick={()=>openClip(clip.id,true)}>Télécharger MP4 ↓</button><button className="btn ghost" onClick={()=>useClip(clip,"edit")}>Open in Edit+ →</button><button className="btn ghost" onClick={()=>useClip(clip,"viral")}>Analyze with Viral+ →</button></article>)}</div></section>}
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
    ?"Queued — waiting for worker"
    :job.status==="completed"
      ?"Completed"
      :job.status==="failed"
        ?"Failed"
        :job.stage||job.status||"Processing";
  return <div className="inline-job-state">
    <div><span>{label}</span><b>{done?"100 %":"Étape en cours"}</b></div>
    {done&&<div className="progress"><i style={{width:"100%"}}/></div>}
  </div>;
}
