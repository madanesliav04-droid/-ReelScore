"use client";

import {useEffect,useMemo,useRef,useState} from "react";
import {BarChart3,Clapperboard,LogOut,Scissors,Upload,Zap,Check,Link2,ArrowRight,FileVideo,ShieldCheck,History,UserRound,Share2,RefreshCw} from "lucide-react";
import * as tus from "tus-js-client";
import {UgcRushUploader} from "./ugc-rush-uploader";
import {BACKEND_DISABLED,functionUrl,supabase,SUPABASE_RESUMABLE_URL,VIDEO_BUCKET} from "@/lib/supabase";
import {authMessage} from "@/lib/auth-message";
import {MAX_VIDEO_UPLOAD_MB,uploadParts,videoUploadPreflight,videoUploadErrorMessage} from "@/lib/upload-limits";
import {uploadToR2} from "@/lib/r2-upload";

type Module="viral"|"edit"|"clip";
type Job={id:string;kind?:string;status:string;progress?:number;stage?:string;result?:any;error?:any;error_code?:string;clip_project_id?:string|null};
type Media={id:string;storage_path?:string;mime_type:string;size_bytes:number;original_name?:string;status?:string;created_at?:string};
type EditModel={id:string;name:string;category:string;preview:string;meta:string;goal:string;actions:string[];never:string;available:boolean;state:string};

const VIRAL_METRICS=[
  ["hook","Hook"],
  ["scroll_stop","Arrêt du défilement"],
  ["retention","Rétention estimée"],
  ["clarity","Clarté"],
  ["rhythm","Rythme"],
  ["structure","Structure"],
  ["text_captions","Sous-titres"],
  ["visual","Visuels"],
  ["audio","Audio"],
  ["originality","Originalité"],
  ["cta","CTA"]
] as const;

function scoreTone(value:any){
  const n=Number(value||0);
  return n>=80?"good":n>=60?"mid":"bad";
}

// Preserve artistic engines and historical exports; UGC remains experimental.
const BETA_ALEX_ONLY=process.env.NEXT_PUBLIC_SOCIALPLUS_ALEX_ONLY==="true";
const EDIT_MODELS:EditModel[]=[
  {
    "id": "codie",
    "name": "Codie × OMNI",
    "category": "Storytelling business",
    "preview": "CODIE",
    "meta": "Référence Codie V60 · moteur actuel : ancien Codie bêta",
    "goal": "Facecam dominante, cuts fluides, 2–3 B-rolls utiles, voix originale.",
    "actions": [
      "Codie V60 est la référence visuelle retenue, mais ce moteur n'est pas encore déployé.",
      "Cuts narratifs, recadrages utiles, sous-titres fidèles aux paroles.",
      "Visage préservé, B-rolls rares, bulles synchronisées, son discret."
    ],
    "never": "Pas de fausses preuves ni de zoom automatique.",
    "available": true,
    "state": "ANCIEN MOTEUR BÊTA"
  },
  {
    "id": "leila",
    "name": "Leila Hormozi",
    "category": "Montage narratif",
    "preview": "LEILA",
    "meta": "Leila contextuel · comparaison seulement si justifiée, animations adaptées au discours",
    "goal": "Comprendre chaque réel avant de choisir les mouvements et les visuels, sans tableau systématique.",
    "actions": [
      "Analyser le sens du discours et sélectionner des visuels adaptés, ou n'en afficher aucun.",
      "Sous-titres révélés mot à mot ; montage bloqué si les horodatages sont incohérents.",
      "Tableau uniquement pour une vraie comparaison, chiffres seulement s'ils sont prononcés."
    ],
    "never": "Ne jamais forcer un tableau, inventer une donnée ou masquer le visage.",
    "available": true,
    "state": "MOTEUR CONTEXTUEL · V22"
  },
  {
    "id": "hormozi_omni",
    "name": "Alex Hormozi",
    "category": "Explication visuelle",
    "preview": "HORMOZI",
    "meta": "Reconstruction plein écran · validation visuelle et transcription en cours",
    "goal": "Montage didactique plein écran, en conservant toujours le format source.",
    "actions": [
      "Rendus de contrôle sur rushs bruts disponibles ; le modèle reste désactivé avant validation.",
      "Respecter la référence V11 / V16 et le 16:9 natif.",
      "Aucune insertion latérale ni bande ajoutée.",
      "Cuts intentionnels, démonstrations utiles, voix et sous-titres exacts."
    ],
    "never": "Pas de recadrage horizontal, doublage ou superposition.",
    "available": process.env.NEXT_PUBLIC_ALEX_V16_REVIEW_ENABLED==="true",
    "state": "RECONSTRUCTION À VALIDER"
  },
  {
    "id": "cinematic_story",
    "name": "Cinematic Storytelling",
    "category": "Mini-documentaire narratif",
    "preview": "CINEMA",
    "meta": "Moteur narratif vérifié V1 · animation documentaire expérimentale",
    "goal": "Transformer les paroles en scènes cinématographiques cohérentes, sans effet décoratif systématique.",
    "actions": [
      "Détecter les changements narratifs dans la transcription horodatée.",
      "Afficher uniquement les éléments réellement justifiés par les mots prononcés.",
      "Sous-titres synchronisés et transitions documentaires, export au format natif.",
      "Les véritables B-rolls et compositions 2.5D avancées restent à intégrer et à tester."
    ],
    "never": "Pas de chiffres inventés, de plans fictifs ni de timeline identique sur toutes les vidéos.",
    "available": true,
    "state": "BÊTA · STORYBOARD CONTEXTUEL"
  },
  {
    "id": "ugc_native",
    "name": "UGC Storytelling",
    "category": "Storytelling immersif · plusieurs rushes",
    "preview": "UGC",
    "meta": "Référence UGC 28 secondes · import multi-rush et moteur de composition à vérifier sur vrais fichiers",
    "goal": "Faire une histoire : découverte, présentation, expérience, résultat. Plans pertinents et voix originale.",
    "actions": [
      "Rush principal avec la voix ; jusqu’à 40 plans secondaires importés par lots.",
      "Cuts narratifs, plans de produits, détails, ambiance, portraits et résultats.",
      "Titres cinétiques, texte blanc et accent contextuel ; animations justifiées.",
      "Couper les blancs sans couper des mots, préserver le son original et le format pertinent."
    ],
    "never": "Pas d'images inventées, pas de doublage, pas de rushes placés sans cohérence narrative.",
    "available": true,
    "state": "BÊTA · MULTI-RUSH"
  },
  {
    "id": "social_kinetic",
    "name": "Social Kinetic",
    "category": "Motion éditorial",
    "preview": "KINETIC",
    "meta": "V28 existante dans la branche de référence · non raccordée sur ce worker",
    "goal": "Facecam, mots animés intégrés au décor, bulles bleues et chiffres vérifiés.",
    "actions": [
      "La V28 validée est conservée dans sa branche dédiée ; aucun montage générique ne sera lancé ici.",
      "Suivre la référence vidéo reçue le 16 octobre.",
      "N'afficher un chiffre que s'il est réellement prononcé.",
      "Animer uniquement dans une zone visuelle libre, sans cacher le visage."
    ],
    "never": "Pas d'animation décorative ou de statistique inventée.",
    "available": false,
    "state": "V28 NON RACCORDÉE SUR CE WORKER"
  }
  ,{
    id:"apple_spatial",name:"Apple Premium / Spatial UI",category:"Spatial UI",
    preview:"SPATIAL",meta:"Sources V10 existantes · pipeline non raccordé sur ce worker",
    goal:"Conserver la direction artistique Spatial UI validée.",
    actions:["Aucun rendu n’est proposé tant que le moteur original n’est pas raccordé et testé."],
    never:"Aucun preset de remplacement.",available:false,state:"V10 À RACCORDER"
  }
];
if(BETA_ALEX_ONLY)for(const model of EDIT_MODELS)model.available=model.id==='hormozi_omni'&&model.available;
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
    if(res.status===402)throw Object.assign(new Error("Le backend a atteint une limite de quota ou de facturation. Aucun résultat n’est disponible. Contacte l’administrateur."),{status:402,code:"BACKEND_QUOTA_BLOCKED"});
    if(code==="BACKEND_UNREACHABLE"||code==="BACKEND_NOT_CONFIGURED")throw Object.assign(new Error(body.message||"Le serveur de traitement est indisponible."),{status:res.status,code});
    if(res.status===401||code==="AUTH_REQUIRED")throw Object.assign(new Error("Ta session a expiré. Reconnecte-toi pour reprendre ton travail."),{status:401});
    if(["STORAGE_OBJECT_SIZE_MISMATCH","R2_OBJECT_SIZE_MISMATCH","MULTIPART_OBJECT_MISSING"].includes(code))throw Object.assign(new Error("Le stockage ne contient pas encore le fichier complet. Reprends l’import avec le même fichier."),{status:res.status,code});
    if(code.toLowerCase().includes("quota_exhausted"))throw Object.assign(new Error("Ton quota mensuel d’analyses est atteint. Consulte le compteur, puis réessaie après son renouvellement."),{status:429,code});
    if(["UGC_RUSH_NOT_ACCESSIBLE","INVALID_UGC_RUSH_LIST","UGC_BATCH_TOO_LARGE"].includes(code))
      throw Object.assign(new Error(code==="UGC_BATCH_TOO_LARGE"?"Le lot de rushes est trop volumineux.":"Un rush n'est plus disponible. Vérifie la sélection dans ta bibliothèque."),{status:res.status,code});
    if(["VIDEO_ID_REQUIRED","MEDIA_NOT_FOUND"].includes(code))
      throw Object.assign(new Error("Choisis une vidéo avec la voix principale avant de lancer le montage."),{status:res.status,code});
    throw Object.assign(new Error(/quota|credit|limit/i.test(code)?"La limite de traitement est atteinte. Réessaie plus tard.":"Le service n’a pas pu traiter la demande. Réessaie dans un instant."),{status:res.status,code});
  }
  return body;
}
function safeName(name:string){return name.replace(/[^a-zA-Z0-9._-]+/g,"-").slice(-120)}

export function Dashboard({preview=false}:{preview?:boolean}={}){
  const [session,setSession]=useState<any>(null);
  const [authReady,setAuthReady]=useState(false);
  const [email,setEmail]=useState("");
  const [password,setPassword]=useState("");
  const [authMode,setAuthMode]=useState<"login"|"signup"|"forgot"|"recovery">("login");
  const [showPassword,setShowPassword]=useState(false);
  const [authError,setAuthError]=useState("");
  const [authPending,setAuthPending]=useState(false);
  const authLock=useRef(false);
  const [active,setActive]=useState<Module>("edit");
  const [utility,setUtility]=useState<"history"|"profile"|null>(null);
  const [historyJobs,setHistoryJobs]=useState<any[]>([]);
  const [historyLoading,setHistoryLoading]=useState(false);
  const historyGeneration=useRef(0);
  const [historyError,setHistoryError]=useState("");
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
  const [editModel,setEditModel]=useState(BETA_ALEX_ONLY?"hormozi_omni":"codie");
  const [ugcRushIds,setUgcRushIds]=useState<string[]>([]);
  const [ugcRushPending,setUgcRushPending]=useState(false);
  const [ugcLibrary,setUgcLibrary]=useState<Media[]>([]);
  const [ugcLibraryIds,setUgcLibraryIds]=useState<string[]>([]);
  const [ugcPrimaryMedia,setUgcPrimaryMedia]=useState<Media|null>(null);
  const [ugcLibraryError,setUgcLibraryError]=useState("");
  const [ugcLibraryLoading,setUgcLibraryLoading]=useState(false);
  const [format,setFormat]=useState("native");
  const [sourceUrl,setSourceUrl]=useState("");
  const sourceRef=useRef<HTMLVideoElement|null>(null);
  const [authNotice,setAuthNotice]=useState("");
  const [editExportUrl,setEditExportUrl]=useState("");
  const [editDownloadUrl,setEditDownloadUrl]=useState("");
  const [editReviewRequired,setEditReviewRequired]=useState(false);
  const [editOutputMediaId,setEditOutputMediaId]=useState("");
  const [preFixScore,setPreFixScore]=useState<number|null>(null);
  const [preFixVersion,setPreFixVersion]=useState<string|null>(null);
  const [busy,setBusy]=useState(false);
  const pollRef=useRef<ReturnType<typeof setTimeout>|null>(null);
  const pollGeneration=useRef(0);
  const uploadRef=useRef<tus.Upload|null>(null);
  const r2UploadRef=useRef<XMLHttpRequest|null>(null);
  const uploadLocked=useRef(false);
  const [uploading,setUploading]=useState(false);

  useEffect(()=>{
    const requested=new URLSearchParams(window.location.search).get("tool");
    if(requested==="viral"||requested==="edit")setActive(requested);
    else if(requested==="clip"){setActive("viral");history.replaceState(null,"","/dashboard?tool=viral");}
    if(preview||BACKEND_DISABLED){setAuthReady(true);return;}
    // Do not trap an iPhone on the loading screen if storage/network stalls.
    let active=true;
    const bootstrapTimer=window.setTimeout(()=>{if(active)setAuthReady(true)},9000);
    supabase.auth.getSession().then(({data})=>{
      if(active)setSession(data.session);
    }).catch(()=>{
      if(active)setSession(null);
    }).finally(()=>{
      if(active){window.clearTimeout(bootstrapTimer);setAuthReady(true)}
    });
    const {data}=supabase.auth.onAuthStateChange((event,next)=>{
      if(!active)return;
      setSession(next);setAuthReady(true);
      if(event==="PASSWORD_RECOVERY"){setAuthMode("recovery");setAuthError("");setAuthNotice("");}
    });
    return ()=>{active=false;window.clearTimeout(bootstrapTimer);data.subscription.unsubscribe()};
  },[preview]);
  useEffect(()=>{
    const owner=session?.user?.id;
    historyGeneration.current++;setHistoryJobs([]);setHistoryError("");setHistoryLoading(false);setUtility(null);
    pollGeneration.current++;
    if(pollRef.current)clearTimeout(pollRef.current);
    void uploadRef.current?.abort();
    r2UploadRef.current?.abort();r2UploadRef.current=null;
    uploadRef.current=null;uploadLocked.current=false;setUploading(false);
    setBusy(false);setJob(null);setMedia(null);setFile(null);setSourceUrl("");
    setUgcRushIds([]);setUgcRushPending(false);setUgcLibrary([]);setUgcLibraryIds([]);setUgcPrimaryMedia(null);
    setAnalysis(null);setClipMedia(null);setClipFile(null);setClipProject(null);
    setEditExportUrl("");setEditOutputMediaId("");setEditReviewRequired(false);setError("");
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
      r2UploadRef.current?.abort();
    };
  },[session?.user?.id]);
  useEffect(()=>()=>{
    if(sourceUrl.startsWith("blob:"))URL.revokeObjectURL(sourceUrl);
  },[sourceUrl]);

  useEffect(()=>{
    if(!session?.user?.id||editModel!=="ugc_native")return;
    let cancelled=false;
    setUgcLibraryLoading(true);setUgcLibraryError("");
    void api(functionUrl("viral-edit-jobs","media"),"")
      .then(result=>{if(!cancelled)setUgcLibrary(Array.isArray(result?.media)?result.media:[])})
      .catch(()=>{if(!cancelled)setUgcLibraryError("Impossible de retrouver les anciens rushes. Recharge cette page.")})
      .finally(()=>{if(!cancelled)setUgcLibraryLoading(false)});
    return ()=>{cancelled=true};
  },[session?.user?.id,editModel]);

  const token=session?.access_token||"";
  const userId=session?.user?.id||"";
  const selectedModel=EDIT_MODELS.find(x=>x.id===editModel)||EDIT_MODELS[0];
  const ugcReadyIds=Array.from(new Set([...ugcRushIds,...ugcLibraryIds]));
  const ugcPrimaryId=ugcPrimaryMedia?.id||media?.id||"";
  const ugcSecondaryIds=ugcReadyIds.filter(id=>id!==ugcPrimaryId);
  const ugcRelatedRushes=ugcLibrary.filter(item=>
    Boolean(ugcPrimaryMedia?.created_at)&&item.id!==ugcPrimaryId&&
    Number.isFinite(Date.parse(String(item.created_at||"")))&&
    Math.abs(Date.parse(String(item.created_at))-Date.parse(String(ugcPrimaryMedia?.created_at)))<=10*60*1000
  ).slice(0,19);
  const canCreateEdit=!preview&&Boolean((editModel==="ugc_native"?(ugcPrimaryId&&ugcSecondaryIds.length>=1):media?.id)&&!busy&&!uploading&&!ugcRushPending&&selectedModel.available);
  const score=useMemo(()=>analysis?.final_score??analysis?.score??null,[analysis]);
  const safeZone=analysis?.safe_zone||null;

  async function loadHistory(){
    if(preview)return;
    const generation=++historyGeneration.current;
    setHistoryLoading(true);setHistoryError("");
    try{const result=await api(functionUrl("viral-edit-jobs","jobs"),"");if(generation===historyGeneration.current)setHistoryJobs(Array.isArray(result.jobs)?result.jobs:[])}
    catch(e:any){if(generation===historyGeneration.current)setHistoryError(e.message||"Historique indisponible. Réessaie.")}
    finally{if(generation===historyGeneration.current)setHistoryLoading(false)}
  }

  async function retryJob(){
    if(preview||busy||!job?.id||job.status!=="failed")return;
    setBusy(true);setError("");
    try{const response=await api(functionUrl("viral-edit-jobs",`jobs/${job.id}/retry`),"",{method:"POST"});setJob(response.job);await watchJob(response.job.id)}
    catch(e:any){setError(e.message||"Reprise impossible.");setBusy(false)}
  }

  async function shareExport(){
    if(!editExportUrl)return;
    try{if(navigator.share)await navigator.share({title:"Mon montage Social+",url:editExportUrl});else window.open(editExportUrl,"_blank","noopener,noreferrer")}
    catch(e:any){if(e.name!=="AbortError")setError("Partage indisponible. Utilise le téléchargement du MP4.")}
  }

  function switchModule(next:Module){
    if(busy||uploadLocked.current||next==="clip")return;
    setUtility(null);
    setActive(next);
    setError("");
    setJob(null);
    history.replaceState(null,"",`${preview?"/apercu":"/dashboard"}?tool=${next}`);
    if(next==="viral"&&!preview)void api(functionUrl("viral-edit-jobs","quota"),"").then(q=>setViralQuota(q.quota||null)).catch(()=>{});
  }

  function displayJobError(current:Job){
    const code=String(current?.error_code||"");
    if(code==="NO_CLIPS_FOUND")return "Aucun passage suffisamment fort n’a été détecté dans cette vidéo.";
    if(code==="ALEX_V16_SOURCE_REQUIRED")return "Le générateur Alex V11/V16 est encore manquant. Aucun montage de remplacement n’a été lancé.";
    if(["SOURCE_SIZE_MISMATCH","SOURCE_HASH_MISMATCH"].includes(code))return "Le fichier reçu est incomplet ou différent de l’original. Réessaie l’import sans lancer de rendu.";
    if(["ASR_TIMING_INVALID","ASR_NOT_READY"].includes(code))return "Aucune transcription vocale fiable détectée. Relance en UGC avec au moins 2 vidéos : le montage sans paroles sera utilisé, sans sous-titres inventés.";
    if(code==="UGC_NEEDS_MULTIPLE_RUSHES")return "Montage UGC : sélectionne une vidéo principale et au moins un autre rush.";
    if(code==="UGC_MEDIA_TOO_SHORT_OR_INVALID")return "Une vidéo est trop courte ou illisible. Utilise des rushes d’au moins une seconde.";
    if(code.startsWith("UGC_"))return "Montage UGC interrompu : "+code+". Tes vidéos sont conservées. Vérifie le choix de la vidéo principale.";
    if(["YOUTUBE_EGRESS_REQUIRED","YOUTUBE_IMPORT_FAILED","YOUTUBE_UNAVAILABLE","IMPORT_CONFIGURATION_ERROR"].includes(code))return "YouTube bloque l’import automatique de cette source. Importe le fichier vidéo ci-dessous : Extraits reprendra exactement le même pipeline de génération.";
    return "Le traitement n’a pas pu aboutir. Réessaie avec cette vidéo ou importe un autre fichier.";
  }

  async function authenticate(e:React.FormEvent){
    if(BACKEND_DISABLED){e.preventDefault();return setAuthError("Backend non connecté.")}
    e.preventDefault();
    if(authLock.current)return;
    authLock.current=true;setAuthPending(true);setAuthError("");setAuthNotice("");
    let timeout:ReturnType<typeof setTimeout>|undefined;
    // A hung browser request must not leave the form disabled forever.
    async function withDeadline<T>(request:PromiseLike<T>):Promise<T>{
      try{
        return await Promise.race([
          Promise.resolve(request),
          new Promise<T>((_,reject)=>{
            timeout=setTimeout(()=>reject(new Error("AUTH_REQUEST_TIMEOUT")),15000);
          })
        ]);
      }finally{if(timeout)clearTimeout(timeout)}
    }
    try{
      const normalizedEmail=email.trim().toLowerCase();
      if(authMode==="forgot"){
        const {error}=await withDeadline(supabase.auth.resetPasswordForEmail(normalizedEmail,{
          redirectTo:window.location.origin+"/dashboard?tool=edit"
        }));
        if(error)setAuthError(authMessage(error));
        else setAuthNotice("Si ce compte existe, un lien de réinitialisation a été envoyé. Vérifie aussi les indésirables.");
      }else if(authMode==="recovery"){
        const {error}=await withDeadline(supabase.auth.updateUser({password}));
        if(error)setAuthError(authMessage(error));
        else{
          setPassword("");setShowPassword(false);setAuthMode("login");
          setAuthNotice("Mot de passe mis à jour. Tu es connecté.");
        }
      }else{
        const credentials={email:normalizedEmail,password};
        const {data,error}=await withDeadline(authMode==="login"
          ?supabase.auth.signInWithPassword(credentials)
          :supabase.auth.signUp(credentials));
        if(error)setAuthError(authMessage(error));
        else if(authMode==="signup"&&!data.session)
          setAuthNotice("Compte créé. Consulte tes emails pour confirmer ton adresse, puis connecte-toi.");
        else if(authMode==="login"&&!data.session)
          setAuthError("Connexion non finalisée. Vérifie ton email et réessaie.");
      }
    }catch(error){
      const message=error instanceof Error?error.message:"";
      setAuthError(message==="AUTH_REQUEST_TIMEOUT"
        ?"Le serveur ne répond pas. Vérifie ta connexion puis réessaie, le bouton est débloqué."
        :authMessage(error));
    }finally{authLock.current=false;setAuthPending(false)}
  }

  async function uploadVideo(selected:File){
    if(preview)return setError("Connectez-vous pour importer une vidéo.");return uploadSource(selected,false)}
  async function uploadClipSource(selected:File){return uploadSource(selected,true)}

  async function uploadSource(selected:File,isClip:boolean){
    if(busy||uploadLocked.current)return;
    const preflightError=videoUploadPreflight(selected);
    if(preflightError)return setError(preflightError);
    const ext=selected.name.split(".").pop()?.toLowerCase();
    const mime=({mp4:"video/mp4",mov:"video/quicktime",webm:"video/webm"} as Record<string,string>)[ext||""];
    if(!mime)return setError("Choisis une vidéo MP4, MOV ou WebM.");
    uploadLocked.current=true;setUploading(true);setError("");
    const release=()=>{uploadLocked.current=false;setUploading(false);uploadRef.current=null;r2UploadRef.current=null};
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
        setAnalysis(null);setUploadPct(0);setEditExportUrl("");setEditOutputMediaId("");setEditReviewRequired(false);setPreFixScore(null);setPreFixVersion(null);
      }
      setJob(null);
      const storage=await api(functionUrl("viral-edit-jobs","storage-config"),token);
      if(storage?.provider==="r2"){
        try{
          const ticket=await api(functionUrl("viral-edit-jobs","r2-upload-ticket"),token,{
            method:"POST",body:JSON.stringify({
              size_bytes:selected.size,mime_type:mime,original_name:selected.name
            })
          });
          if(!ticket?.signed_upload_url||!ticket?.storage_path)throw new Error("Autorisation d’import R2 indisponible.");
          await uploadToR2({
            url:ticket.signed_upload_url,file:selected,mime,
            onRequest:xhr=>{r2UploadRef.current=xhr;},
            onProgress:p=>{if(alive())(isClip?setClipUploadPct:setUploadPct)(p);}
          });
          if(!alive())return;
          const result=await api(functionUrl("viral-edit-jobs","media"),token,{
            method:"POST",body:JSON.stringify({
              storage_provider:"r2",storage_path:ticket.storage_path,
              mime_type:mime,size_bytes:selected.size,original_name:selected.name
            })
          });
          if(!result?.media?.id)throw new Error("Enregistrement R2 impossible.");
          if(alive()){
            (isClip?setClipMedia:setMedia)(result.media);
            (isClip?setClipUploadPct:setUploadPct)(100);
            if(!isClip)void api(functionUrl("viral-edit-jobs","quota"),"").then(q=>setViralQuota(q.quota||null)).catch(()=>{});
          }
        }catch(e:any){
          if(alive())setError(String(e?.message||"Import R2 interrompu."));
        }finally{release();}
        return;
      }
      const sendPart=async(partIndex:number):Promise<void>=>{
        if(!alive())return;
        const part=parts[partIndex];
        let objectName=multipart?baseName+"-part"+String(partIndex).padStart(3,"0"):baseName;
        const blob=multipart?selected.slice(part.start,part.end,mime):selected;
        const upload=new tus.Upload(blob,{
        endpoint:SUPABASE_RESUMABLE_URL,
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
            setEditReviewRequired(body.job.result.review_required===true||out.media?.metadata?.review_required===true);
            setEditExportUrl(out.signed_url);
            setEditDownloadUrl(out.download_url||"");
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
          if(e.status===401){
            setSession(null);setAuthNotice("Reconnecte-toi pour reprendre ton traitement conservé.");
            void supabase.auth.signOut({scope:"local"}).catch(()=>{});
          }
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
    if(preview)return setError("Connectez-vous pour analyser une vidéo.");
    if(BETA_ALEX_ONLY)return setError("L’analyse n’est pas activée dans cette préproduction Alex V16.");
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
    if(busy||uploadLocked.current)return;
    const modelToUse=autoFix?"codie":editModel;
    const videoId=modelToUse==="ugc_native"?ugcPrimaryId:media?.id;
    if(!videoId)return setError(modelToUse==="ugc_native"?
      "Importe au moins un rush, ou sélectionne une vidéo déjà stockée ci-dessous.":
      "Importe d’abord une vidéo.");
    if(!["codie","leila","hormozi_omni","social_kinetic","ugc_native","cinematic_story"].includes(modelToUse))return setError("Ce modèle n’est pas encore raccordé au moteur. Aucun preset de remplacement ne sera lancé.");

    if(modelToUse==="ugc_native"&&ugcRushPending)return setError("Attends la fin de l’import des rushes secondaires.");
    if(modelToUse==="ugc_native"&&ugcSecondaryIds.length<1)return setError("Ajoute au moins un plan secondaire. Un montage UGC nécessite plusieurs vidéos.");

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
        video_id:videoId,
        analysis_id:media?.id===videoId?(analysis?.analysis_id||analysis?.id||null):null,
        style:modelToUse,
        settings:{format,...(modelToUse==="ugc_native"?{ugc_rush_video_ids:ugcSecondaryIds}: {})}
      })});
      setJob(body.job);await watchJob(body.job.id);
    }catch(e:any){setError(e.message);setBusy(false)}
  }

  async function analyzeEditOutput(){
    if(busy||!editOutputMediaId)return;
    setError("");setBusy(true);
    try{
      const out=await api(functionUrl("viral-edit-jobs",`media/${editOutputMediaId}/url`),token);
      if(!out?.media)throw new Error("Rendu Montage introuvable.");
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

  if(!authReady&&!preview)return <main className="social-loading" role="status" aria-live="polite"><div className="social-loading-icon">S+</div><p>Ouverture de Social+…</p></main>;

  if((!session||authMode==="recovery")&&!preview)return <main className="auth-screen"><div className="auth-orb"/><section className="auth-box">
    <div className="side-brand big">SOCIAL <span>+</span></div>
    <h1>{authMode==="login"?"Bon retour.":authMode==="signup"?"Bienvenue sur Social+.":authMode==="forgot"?"Retrouver mon compte.":"Nouveau mot de passe."}</h1>
    {BACKEND_DISABLED&&<p role="status">Le backend de cette prévisualisation n’est pas connecté. <a href="/apercu">Explorer l’interface sans traitement</a></p>}
    <p>{authMode==="forgot"?"Entre ton email pour recevoir un lien de réinitialisation.":authMode==="recovery"?"Choisis un nouveau mot de passe pour retrouver Montage et Analyse.":"Montage intelligent avec Montage. Analyse éditoriale avec Analyse."}</p>
    <form onSubmit={authenticate} aria-busy={authPending} aria-label="Connexion Social+">
      {authMode!=="recovery"&&<input className="field" type="email" inputMode="email" autoCapitalize="none" autoComplete="email" disabled={authPending} value={email} onChange={e=>setEmail(e.target.value)} placeholder="Adresse email" aria-label="Adresse email" required/>}
      {authMode!=="forgot"&&<div className="auth-password-field">
        <input className="field" type={showPassword?"text":"password"} autoComplete={authMode==="login"?"current-password":"new-password"} disabled={authPending} value={password} onChange={e=>setPassword(e.target.value)} placeholder="Mot de passe" aria-label="Mot de passe" minLength={6} required/>
        <button type="button" className="auth-password-toggle" disabled={authPending} onClick={()=>setShowPassword(v=>!v)} aria-label={showPassword?"Masquer le mot de passe":"Afficher le mot de passe"}>{showPassword?"Masquer":"Afficher"}</button>
      </div>}
      <button type="submit" disabled={authPending||BACKEND_DISABLED} className="btn primary auth-submit">
        {authPending?"Vérification…":authMode==="forgot"?"Recevoir mon lien":authMode==="recovery"?"Enregistrer le nouveau mot de passe":authMode==="login"?"Se connecter":"Créer mon compte"}
      </button>
    </form>
    {authError&&<div role="alert" className="error auth-error" aria-live="assertive">{authError}</div>}
    {authNotice&&<p className="auth-notice" role="status">{authNotice}</p>}
    {authMode==="login"&&<button type="button" className="auth-link" disabled={authPending} onClick={()=>{setAuthError("");setAuthNotice("");setAuthMode("forgot")}}>Mot de passe oublié ?</button>}
    <button type="button" className="auth-switch" disabled={authPending} onClick={()=>{
      setAuthError("");setAuthNotice("");setPassword("");setShowPassword(false);
      setAuthMode(authMode==="login"?"signup":"login");
    }}>{authMode==="login"?"Créer un compte":authMode==="signup"?"Déjà inscrit ? Se connecter":"Retour à la connexion"}</button>
  </section></main>;

  return <main className="dashboard-shell">
    <aside className="sidebar">
      <div className="side-brand">SOCIAL<span>+</span></div>
      <div className="side-group"><small>TES OUTILS</small>
        <button type="button" className={`side-link ${active==="edit"?"active":""}`} disabled={busy||uploading} onClick={()=>switchModule("edit")}><Clapperboard size={17}/> Montage</button>
        <button type="button" className={`side-link ${active==="viral"?"active":""}`} disabled={busy||uploading} onClick={()=>switchModule("viral")}><BarChart3 size={17}/> Analyse</button>
      </div>
      <div className="side-group social-account"><small>COMPTE</small><button type="button" className="side-link" onClick={()=>void supabase.auth.signOut()}><LogOut size={16}/> Se déconnecter</button></div>
    </aside>

    <section className="dash-main">
      {preview&&<p className="preview-notice" role="status">Aperçu de l’interface · aucun compte, upload ou traitement actif. <a href="/dashboard">Se connecter</a></p>}
      <div hidden={utility!==null}>
      <header className="dash-top social-dash-head"><div><div className="social-dash-kicker">SOCIAL+ / STUDIO VIDÉO</div><h1>{active==="edit"?"Montage intelligent.":"Analyse éditoriale."}</h1><p>{active==="edit"?"Un vrai montage adapté à ton contenu, pas des effets automatiques sans raison.":"Comprends ce qui peut être amélioré et pourquoi, avec des observations vérifiables."}</p></div><div className="social-user-actions"><span className="user-pill" title={session?.user?.email}>{session?.user?.email}</span><button type="button" className="social-signout" onClick={()=>void supabase.auth.signOut()} aria-label="Se déconnecter"><LogOut size={16}/><span>Quitter</span></button></div></header>
      <div className="module-tabs social-workspace-tabs" role="group" aria-label="Choisir un outil">
        <button type="button" aria-pressed={active==="edit"} disabled={busy||uploading} className={active==="edit"?"active":""} onClick={()=>switchModule("edit")}><Clapperboard size={18}/><span><strong>Montage</strong><small>Monter une vidéo</small></span></button>
        <button type="button" aria-pressed={active==="viral"} disabled={busy||uploading} className={active==="viral"?"active":""} onClick={()=>switchModule("viral")}><BarChart3 size={18}/><span><strong>Analyse</strong><small>Analyser une vidéo</small></span></button>
      </div>

      {active==="viral"&&<div className="workspace-grid">
        <section className="panel">
          {preview&&<p className="preview-notice"><a className="btn primary" href="/analyse-locale">Importer et tester une vidéo sur cet appareil</a><br/>Contrôle technique réel, sans transfert serveur. Analyse éditoriale non disponible.</p>}
          <small className="eyebrow">ANALYSE / ANALYSER</small><h3>Comprends les forces et les faiblesses de ta vidéo.</h3><p className="social-panel-explainer">Ajoute ton rush. Analyse examine le hook, la clarté, le rythme et les passages à revoir, sans inventer de données Instagram.</p>
          {viralQuota&&<p role="status" className="quota-status" data-testid="viral-monthly-quota">Analyses ce mois : <strong>{viralQuota.used}/{viralQuota.limit}</strong> · {viralQuota.remaining} disponibles · renouvellement le {new Date(viralQuota.reset_at).toLocaleDateString("fr-FR",{day:"numeric",month:"long"})}</p>}
          <label className="upload-zone" onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();if(preview||busy||uploading)return;if(e.dataTransfer.files.length!==1)return setError("Dépose une seule vidéo principale.");void uploadVideo(e.dataTransfer.files[0])}}><input type="file" disabled={preview||busy||uploading} accept="video/mp4,video/quicktime,video/webm,.mp4,.mov,.webm" onChange={e=>{const f=e.currentTarget.files?.[0];e.currentTarget.value="";if(f)void uploadVideo(f)}}/><div><Upload size={30}/><b>{file?file.name:media?"Vidéo importée, prête à analyser":"Choisir une vidéo à analyser"}</b><span>MP4 · MOV · WebM · max {MAX_VIDEO_UPLOAD_MB} Mo</span></div></label>
          {file&&<div className="social-upload-status" role="status" aria-live="polite"><span>{uploading?"Import en cours":media?"Import terminé":"Préparation du fichier"}</span><strong>{uploadPct}%</strong><div className="progress"><i style={{width:`${uploadPct}%`}}/></div></div>}
          <button className="btn primary full" onClick={startAnalysis} disabled={preview||BETA_ALEX_ONLY||!media||busy||uploading}><Zap size={16}/> {busy&&job?.kind==="viral_analysis"?"Analyse en cours…":uploading?"Import en cours…":"Analyser ma vidéo"}</button>
          <InlineJobState job={job?.kind==="viral_analysis"?job:null} available={Boolean(analysis)}/>
          {error&&<div className="job-card error">{error}</div>}
        </section>
        {sourceUrl?<video ref={sourceRef} className="source-preview" src={sourceUrl} controls playsInline/>:<BackendState media={media} job={job}/>}
      </div>}

      {active==="edit"&&<>
        <div className="workspace-grid">
          <section className="panel">
            <small className="eyebrow">MONTAGE / MONTER</small><h3>Un montage construit autour de tes paroles.</h3><p className="social-panel-explainer">Importe un rush, sélectionne un style puis génère un export. L'original reste intact.</p>
            <label className="upload-zone" onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();if(preview||busy||uploading)return;if(e.dataTransfer.files.length!==1)return setError("Dépose une seule vidéo principale.");void uploadVideo(e.dataTransfer.files[0])}}><input type="file" disabled={preview||busy||uploading} accept="video/mp4,video/quicktime,video/webm,.mp4,.mov,.webm" onChange={e=>{const f=e.currentTarget.files?.[0];e.currentTarget.value="";if(f)void uploadVideo(f)}}/><div><Upload size={30}/><b>{file?file.name:media?"Vidéo importée, prête à monter":"Choisir une vidéo à monter"}</b><span>MP4 · MOV · WebM · max {MAX_VIDEO_UPLOAD_MB} Mo · {EDIT_MODELS.filter(model=>model.id!=="ugc_native").length} modèles de montage</span></div></label>
            {file&&<div className="social-upload-status" role="status" aria-live="polite"><span>{uploading?"Import en cours":media?"Import terminé":"Préparation du fichier"}</span><strong>{uploadPct}%</strong><div className="progress"><i style={{width:`${uploadPct}%`}}/></div></div>}
            {error&&<div role="alert" className="job-card error">{error}</div>}
            <div className="status-row"><span>Fichier vidéo</span><span className="status-pill">{media?"Prêt":file?`${uploadPct}%`:"En attente"}</span></div>
          </section>
          {sourceUrl?<video ref={sourceRef} className="source-preview" src={sourceUrl} controls playsInline/>:<BackendState media={media} job={job}/>}
        </div>

        {!BETA_ALEX_ONLY&&!preview&&<details className="experimental-model"><summary>Laboratoire · UGC non validé</summary><p>Parcours expérimental conservé, distinct des six modèles retenus.</p><button className="btn ghost" data-model="ugc_native" disabled={busy||uploading} onClick={()=>setEditModel("ugc_native")}>Explorer UGC Storytelling</button></details>}

        {editModel==="ugc_native"&&<section className="panel ugc-multirush-panel">
          <small className="eyebrow">UGC / 02 · PLANS SECONDAIRES</small>
          <h3>Ajoute tes rushes d’illustration.</h3>
          <p className="social-panel-explainer">Le premier import ci-dessus est la voix principale. Ajoute ensuite toutes les prises d’ambiance, plans de produit, détails et résultats. Une seule piste voix sera conservée.</p>
          <UgcRushUploader key={userId} ownerId={userId} disabled={busy}
            register={async details=>{
              const response=await api(functionUrl("viral-edit-jobs","media"),token,{method:"POST",body:JSON.stringify(details)});
              return response.media;
            }}
            onChange={(ids,pending)=>{setUgcRushIds(ids);setUgcRushPending(pending);}}
            onError={message=>setError(message)}
          />

          <div className="ugc-ready-summary" role="status">
            <strong>{ugcSecondaryIds.length} plan{ugcSecondaryIds.length!==1?"s":""} secondaire{ugcSecondaryIds.length!==1?"s":""} sélectionné{ugcSecondaryIds.length!==1?"s":""}</strong>
            <span>{ugcPrimaryId?"Vidéo principale prête · "+ugcSecondaryIds.length+" plans secondaires":"Choisis explicitement une vidéo principale ci-dessous."}</span>
            <small>{ugcPrimaryId&&ugcSecondaryIds.length===0?
              "Ajoute au moins un autre rush avant de créer le montage.":
              "Si aucun mot n’est prononcé, Montage produit un montage visuel sans sous-titres inventés. La voix originale est conservée lorsqu’elle existe."}</small>
          </div>
          <div className="ugc-saved-library" data-testid="ugc-saved-library">
            <div className="ugc-saved-head">
              <strong>Vidéos déjà importées</strong>
              <small>{ugcLibraryLoading?"Chargement…":ugcLibrary.length+" retrouvées"}</small>
            </div>
            {ugcPrimaryMedia&&ugcRelatedRushes.length>0&&
              <button type="button" className="ugc-saved-batch-select" disabled={busy}
                onClick={()=>setUgcLibraryIds(ids=>Array.from(new Set([...ids,...ugcRelatedRushes.map(x=>x.id)])))}>
                Ajouter les {ugcRelatedRushes.length} autres vidéos du même lot
              </button>}
            {ugcLibraryError&&<p role="alert">{ugcLibraryError}</p>}
            {!ugcLibraryLoading&&ugcLibrary.length===0&&<p>Aucun ancien rush retrouvé. Utilise les imports ci-dessus.</p>}
            <div className="ugc-saved-list">
              {ugcLibrary.slice(0,25).map(item=>{
                const selected=ugcLibraryIds.includes(item.id);
                const isPrimary=(ugcPrimaryMedia?.id===item.id||media?.id===item.id);
                const alreadyAdded=ugcRushIds.includes(item.id);
                return <div className="ugc-saved-row" key={item.id}>
                  <div><strong>{item.original_name||"Vidéo"}</strong><small>{(Number(item.size_bytes||0)/1048576).toFixed(1)} Mo</small></div>
                  <button type="button" disabled={busy} aria-pressed={isPrimary} className={isPrimary?"selected":""}
                    onClick={()=>{setUgcPrimaryMedia(item);setUgcLibraryIds(ids=>ids.filter(x=>x!==item.id));setError("");}}>
                    {isPrimary?"Principale ✓":"Choisir comme principale"}
                  </button>
                  <button type="button" disabled={busy||alreadyAdded} aria-pressed={selected||alreadyAdded}
                    onClick={()=>setUgcLibraryIds(ids=>selected?ids.filter(x=>x!==item.id):[...ids,item.id])}>
                    {selected||alreadyAdded?"Ajouté ✓":"Ajouter"}
                  </button>
                </div>;
              })}
            </div>
          </div>
        </section>}

        <section className="model-library">
          <div className="section-heading"><small>6 MODÈLES ET RÉFÉRENCES</small><h2>Choisis ton modèle de montage.</h2><p>Les moteurs déjà présents restent accessibles avec leurs limites bêta. Alex V16, Social Kinetic V28 et Spatial V10 restent visibles mais indisponibles tant que leur pipeline original n’est pas raccordé et testé. Vérifie chaque export avant publication.</p></div>
          <div className="model-grid social-approved-model-grid">{EDIT_MODELS.filter(model=>model.id!=="ugc_native").map(model=><button type="button" key={model.id} disabled={!model.available||busy||uploading} aria-label={`${model.name} — ${model.state}`} className={`model-card social-approved-model ${editModel===model.id?"selected":""} ${model.available?"is-available":"is-pending"}`} data-model={model.id} onClick={()=>{if(model.available){setEditModel(model.id);if(["hormozi_omni","leila","cinematic_story"].includes(model.id))setFormat("native")}}}>
              <div className="social-model-identity"><span>MONTAGE / {model.preview}</span><small className={`social-model-state ${model.available?"beta":"pending"}`}>{model.state}</small><strong>{model.name}</strong><p>{model.goal}</p></div>
              <div className="model-copy"><div><strong>{model.name}</strong><span>{model.category}</span></div>{editModel===model.id&&<Check size={18}/>}<p>{model.meta}</p></div>
            </button>)}</div>
          <p className="social-model-truth" role="note">Les moteurs activés produisent un rendu bêta, sans garantie de reproduction fidèle des vidéos de référence. Leila utilise les mots horodatés : si la transcription échoue, l'export est interrompu plutôt que d'inventer des sous-titres. Le modèle UGC accepte des plans supplémentaires ; le montage final demande encore validation humaine. Aucun modèle non reconnu n’est remplacé silencieusement.</p>
          <details className="model-action-contract" data-testid="edit-model-action-contract"><summary>Règles et limites de ce modèle</summary>
            <div className="contract-head"><span>CONTRAT DE MONTAGE · {selectedModel.name.toUpperCase()}</span><h3>{selectedModel.goal}</h3></div>
            <p className="contract-notice">{selectedModel.id==="cinematic_story"?"Version bêta : la narration et les titres animés sont raccordés. Aucun B-roll généré ni résultat 100/100 garanti avant tests réels.":"Le contrat décrit la référence de montage souhaitée. Le moteur historique disponible ne garantit pas encore la fidélité à la V60."}</p>
            <ol>{selectedModel.actions.map((action,i)=><li key={i}><span>{String(i+1).padStart(2,"0")}</span><p>{action}</p></li>)}</ol>
            <div className="contract-avoid"><strong>À éviter</strong><p>{selectedModel.never}</p></div>
          </details>
          <label className="format-picker">Format de sortie {["hormozi_omni","leila","cinematic_story"].includes(selectedModel.id)&&<small>· Format natif obligatoire pour préserver le cadrage</small>} <select className="field" value={["hormozi_omni","cinematic_story"].includes(selectedModel.id)?"native":format} onChange={e=>setFormat(e.target.value)} disabled={busy||["hormozi_omni","cinematic_story"].includes(selectedModel.id)}><option value="native">Natif — conserver le format source</option><option value="portrait">Portrait — 1080 × 1920</option><option value="landscape">Paysage — 1920 × 1080</option></select></label>
          <button className="btn primary create-edit" onClick={()=>void startEdit(false)} disabled={!canCreateEdit}><Clapperboard size={17}/> {busy&&job?.kind==="edit_render"?"Montage en cours…":`Créer mon montage · ${selectedModel.name}`}</button>
          <p className="social-model-truth" role="note">{selectedModel.id==="ugc_native"?"UGC : choisis une vidéo principale et au moins un rush supplémentaire. Sans paroles détectées, le rendu sera visuel uniquement.":selectedModel.id==="hormozi_omni"?"Hormozi conserve obligatoirement le cadrage et le format de la source. Les animations fondées sur des preuves peuvent être absentes si l’analyse n’en fournit pas.":selectedModel.id==="leila"?"Leila : montage contextuel. Pas de tableau sans comparaison. Insertion refusée si les paroles ne la confirment pas. Relecture recommandée avant publication.":selectedModel.id==="social_kinetic"?"Social Kinetic : les animations n’apparaissent que si leurs mots, leurs timings et leur emplacement sont vérifiés.":"Codie bêta : le rendu V60 reste à comparer et à valider."}</p>
          <InlineJobState job={job?.kind==="edit_render"?job:null} available={Boolean(editExportUrl)}/>{job?.kind==="edit_render"&&job.status==="failed"&&<button className="btn ghost" disabled={preview||busy} onClick={()=>void retryJob()}><RefreshCw size={16}/> Réessayer le traitement</button>}
        </section>
      </>}

      {active==="edit"&&editExportUrl&&<section className="result-panel edit-result"><div className="result-copy"><small>MONTAGE · EXPORT TERMINÉ</small><h2>{editReviewRequired?"Rendu de contrôle à vérifier.":`Ton montage ${selectedModel.name} est prêt.`}</h2>{editReviewRequired?<p role="alert">Transcription ou fidélité non validée. Vérifie les paroles et le rendu avant toute publication.</p>:<p>Regarde l’export puis télécharge-le pour le publier.</p>}<div className="result-actions"><button className="btn ghost" onClick={()=>void shareExport()}><Share2 size={16}/> Partager</button><a className="btn primary" href={editExportUrl} target="_blank" rel="noreferrer">Ouvrir le MP4 ↗</a>{editDownloadUrl&&<a className="btn ghost" href={editDownloadUrl} download>Télécharger le MP4</a>}<button className="btn ghost" onClick={()=>void analyzeEditOutput()} disabled={BETA_ALEX_ONLY||busy||!editOutputMediaId}>Analyser ce montage <ArrowRight size={15}/></button></div></div><video className="result-video" src={editExportUrl} controls playsInline/></section>}

      {active==="viral"&&analysis&&<>
        <section className="result-panel viral-hero-result">
          <div><small>ANALYSE ÉDITORIALE · QUALITÉ ÉDITORIALE ESTIMÉE</small><div className="score-big">{score??"—"}<span>/100</span></div><div className="score-version">{preFixScore!==null&&score!==null?(preFixVersion&&preFixVersion===analysis.score_version?`Score créatif estimé : avant ${preFixScore} → après ${score} (pas des performances Instagram)`:"Scores non comparables : méthodologies différentes"):"Potentiel créatif estimé · avant publication"}</div></div>
          <div className="result-copy"><small>VERDICT</small><h2>{analysis.main_problem||"Diagnostic terminé"}</h2><p>{analysis.verdict||analysis.why}</p><div className="result-why">{analysis.why}</div><button className="btn primary" onClick={()=>void startEdit(true)} disabled={busy}>Essayer avec Montage <ArrowRight size={15}/></button></div>
        </section>

        {analysis.score_audit?.methodology&&<section className="viral-calibration-truth" aria-label="Méthodologie du score">
          <div className="viral-calibration-intro"><strong>Ce que ce score mesure réellement</strong><p>Qualité éditoriale estimée sur la vidéo : accroche, clarté, progression, structure et réalisation. Ce n'est ni une probabilité de viralité ni une prévision des vues.</p></div>
          <div className="viral-calibration-tags"><span>Critères pondérés publiquement</span><span>Signaux techniques contextualisés</span><span>Comparaison valable entre analyses de même version</span></div>
          {analysis.score_audit.caveats?.length>0&&<details><summary>Vérifications de contexte</summary><div>{analysis.score_audit.caveats.map((item:string,i:number)=><p key={i}>{item}</p>)}</div></details>}
          {analysis.score_audit.independent_video_review?.disputed_criteria?.length>0&&<p className="viral-calibration-disputed"><strong>Vérification complémentaire recommandée :</strong> divergence entre les analyses IA sur {analysis.score_audit.independent_video_review.disputed_criteria.map((key:string)=>key.replaceAll("_"," ")).join(", ")}. Ces notes restent des estimations à examiner, pas une vérité.</p>}
          {analysis.score_audit.independent_video_review?.status==="unavailable"&&<p className="viral-calibration-disputed">Contrôle contradictoire du score indisponible : résultat provisoire à considérer avec prudence.</p>}
          <small>Ce score n'est pas encore étalonné statistiquement sur de véritables performances Instagram ou TikTok. Seules des données de publication pourraient valider son pouvoir prédictif.</small>
        </section>}
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

        {safeZone&&<section className="safe-zone-panel"><div className="safe-phone"><div className="unsafe top"/><div className="safe-frame"><span>{safeZone.mode==="native_landscape_composition"?"NATIVE 16:9":"UNIVERSAL SAFE"}</span></div><div className="unsafe right"/><div className="unsafe bottom"/></div><div className="safe-copy"><small>ZONE DE VISIBILITÉ</small><h2>{safeZone.score??"—"}<span>/100</span></h2><p>{safeZone.summary||"Composition et lisibilité estimées sur la vidéo originale."}</p>{safeZone.caution&&<p className="safe-scope-note">{safeZone.caution}</p>}<div className="safe-metrics"><span>Cadrage <b>{safeZone.framing}</b></span><span>Texte <b>{safeZone.text_safety}</b></span><span>Sous-titres <b>{safeZone.caption_safety}</b></span><span>Format <b>{safeZone.platform_fit??"N/A"}</b></span></div>{safeZone.issues?.length>0&&<div className="safe-issues">{safeZone.issues.slice(0,6).map((x:any,i:number)=><div className={`safe-issue ${x.severity}`} key={i}><strong>{x.element}</strong><span>{x.problem}</span><small>{x.correction}</small></div>)}</div>}</div></section>}
      </>}

      </div>
      {utility==="history"&&<section className="utility-screen"><small className="eyebrow">VOTRE ESPACE</small><h1>Historique</h1><p>Vos traitements sauvegardés sur votre compte.</p><button className="btn ghost" disabled={historyLoading||preview} onClick={()=>void loadHistory()}><RefreshCw size={16}/> Actualiser</button>{historyLoading&&<p role="status">Chargement des traitements…</p>}{historyError&&<p role="alert" className="error">{historyError}</p>}{!historyLoading&&!historyError&&!historyJobs.length&&<p className="empty-state">{preview?"Connectez-vous pour retrouver vos vidéos. Aucun historique fictif n’est affiché.":"Aucun traitement enregistré pour le moment."}</p>}<div className="history-list">{historyJobs.map(item=><button className="history-item" key={item.id} disabled={busy||uploading} onClick={()=>{setUtility(null);setEditExportUrl("");setEditDownloadUrl("");setAnalysis(null);setBusy(true);void watchJob(item.id)}}><span>{item.kind==="edit_render"?"Montage":"Analyse"}<small>{new Date(item.created_at).toLocaleString("fr-FR")}</small></span><span>{jobLabel(item.status)} <ArrowRight size={16}/></span></button>)}</div></section>}
      {utility==="profile"&&<section className="utility-screen"><small className="eyebrow">VOTRE ESPACE</small><h1>Profil</h1><p>{session?.user?.email||"Aperçu sans connexion"}</p><div className="profile-links"><a href="/faq">Questions fréquentes <ArrowRight size={16}/></a><a href="/confidentialite">Confidentialité <ShieldCheck size={16}/></a><p>Les avis et l’administration privée nécessitent un backend autorisé. Aucun paiement n’est activé.</p>{!preview&&<button className="btn ghost" onClick={()=>void supabase.auth.signOut()}><LogOut size={16}/> Se déconnecter</button>}</div></section>}
    </section>
    <nav className="ios-tabbar" aria-label="Navigation Social+">
      <button aria-current={!utility&&active==="viral"?"page":undefined} onClick={()=>switchModule("viral")} disabled={busy||uploading}><BarChart3 size={21}/><span>Analyse</span></button>
      <button aria-current={!utility&&active==="edit"?"page":undefined} onClick={()=>switchModule("edit")} disabled={busy||uploading}><Clapperboard size={21}/><span>Montage</span></button>
      <button aria-current={utility==="history"?"page":undefined} onClick={()=>{setUtility("history");void loadHistory()}}><History size={21}/><span>Historique</span></button>
      <button aria-current={utility==="profile"?"page":undefined} onClick={()=>setUtility("profile")}><UserRound size={21}/><span>Profil</span></button>
    </nav>
  </main>;
}

function jobLabel(status:string){return ({queued:"En attente",completed:"Terminé",failed:"Échec",cancelled:"Annulé",rendering:"Rendu",transcribing:"Transcription",processing:"Traitement"} as Record<string,string>)[status]||"En cours"}

function BackendState({media,job}:{media:Media|null;job:Job|null}){
  return <aside className="panel backend-state"><h3>État du traitement</h3><div className="status-row"><span>Source</span><span className="status-pill">{media?.id?"Importée":"—"}</span></div><div className="status-row"><span>Job</span><span className="status-pill">{job?.status||"—"}</span></div><div className="status-row"><span>Étape</span><span className="status-pill">{job?.stage||"—"}</span></div><div className="status-row"><span>Progression</span><span className="status-pill">{job?.status==="completed"?"100 %":job?"Étape en cours":"—"}</span></div>{job&&<div className="job-card"><strong>{job.status}</strong><small>{job.id}</small></div>}</aside>
}


function InlineJobState({job,available=false}:{job:Job|null;available?:boolean}){
  if(!job)return null;
  const done=job.status==="completed"&&available;
  const label=job.status==="queued"
    ?"En attente de traitement"
    :job.status==="completed"
      ?available?"Terminé":"Vérification du résultat"
      :job.status==="failed"
        ?"Échec du traitement"
        :job.stage||job.status||"Processing";
  return <div className="inline-job-state" role="status" aria-live="polite">
    <div><span>{label}</span><b>{done?"Résultat disponible":`${Math.max(0,Math.min(100,Number(job.progress)||0))} %`}</b></div>
    {<div className="progress" role="progressbar" aria-label="Progression du traitement" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.max(0,Math.min(100,Number(job.progress)||0))}><i style={{width:`${Math.max(0,Math.min(100,Number(job.progress)||0))}%`}}/></div>}
  </div>;
}
