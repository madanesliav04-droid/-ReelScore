"use client";

import {useEffect,useRef,useState} from "react";
import {ArrowDown,ArrowUp,Check,Film,Trash2,UploadCloud,RotateCcw} from "lucide-react";
import * as tus from "tus-js-client";
import {SUPABASE_PROJECT_REF,VIDEO_BUCKET,supabase,functionUrl} from "@/lib/supabase";
import {uploadToR2} from "@/lib/r2-upload";
import {MAX_VIDEO_UPLOAD_MB,uploadParts,videoUploadPreflight,videoUploadErrorMessage} from "@/lib/upload-limits";

export type UgcRush={id:string;name:string;size:number;mediaId:string|null;status:"waiting"|"uploading"|"ready"|"error";progress:number;message:string};
const MAX_RUSHES=40;
const MAX_BATCH_BYTES=3*1024*1024*1024;
const mimeFor=(name:string)=>({mp4:"video/mp4",mov:"video/quicktime",webm:"video/webm"} as Record<string,string>)[name.split(".").pop()?.toLowerCase()||""]||"";

export function UgcRushUploader({ownerId,disabled,register,onChange,onError}:{
  ownerId:string;disabled:boolean;
  register:(details:{storage_path:string;mime_type:string;size_bytes:number;original_name:string;storage_provider?:string;metadata?:any})=>Promise<{id:string}>;
  onChange:(ids:string[],pending:boolean)=>void;
  onError:(reason:string)=>void;
}){
  const [rushes,setRushes]=useState<UgcRush[]>([]);
  const listRef=useRef<UgcRush[]>([]);
  const activeUpload=useRef<tus.Upload|null>(null);
  const activeR2Upload=useRef<XMLHttpRequest|null>(null);
  const stopped=useRef(false);
  const processing=useRef(false);
  const pending=useRef<Array<{key:string;file:File}>>([]);
  const filesRef=useRef<Map<string,File>>(new Map());
  const [pickerHint,setPickerHint]=useState("");
  const previousOwner=useRef(ownerId);

  function update(next:UgcRush[]){
    listRef.current=next;
    setRushes(next);
    onChange(next.filter(x=>x.status==="ready"&&x.mediaId).map(x=>x.mediaId!),next.some(x=>x.status==="waiting"||x.status==="uploading"));
  }
  function patch(key:string,changes:Partial<UgcRush>){
    update(listRef.current.map(x=>x.id===key?{...x,...changes}:x));
  }
  useEffect(()=>{
    stopped.current=false;
    return ()=>{stopped.current=true;void activeUpload.current?.abort();activeR2Upload.current?.abort();};
  },[]);
  useEffect(()=>{
    // A new user already starts with empty lists. Never clear rushes after the
    // first file-selection event on Safari/Playwright just because mount effects run.
    if(previousOwner.current===ownerId)return;
    previousOwner.current=ownerId;
    pending.current=[];
    filesRef.current.clear();
    update([]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[ownerId]);

  async function r2Api(route:string,data?:object){
    const {data:sessionData,error}=await supabase.auth.getSession();
    const token=sessionData.session?.access_token;
    if(error||!token||sessionData.session?.user.id!==ownerId)throw new Error("Session expirée.");
    const response=await fetch(functionUrl("viral-edit-jobs",route),{
      method:data?"POST":"GET",
      headers:{Authorization:"Bearer "+token,...(data?{"Content-Type":"application/json"}:{})},
      ...(data?{body:JSON.stringify(data)}:{})
    });
    const result=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error(String(result.error||"R2_NOT_AVAILABLE"));
    return result;
  }
  async function uploadOne(key:string,file:File){
    const mime=mimeFor(file.name);
    if(!mime)throw new Error("Format vidéo non reconnu.");
    const storage=await r2Api("storage-config");
    if(storage.provider==="r2"){
      patch(key,{status:"uploading",progress:0,message:"Import R2 en cours"});
      const ticket=await r2Api("r2-upload-ticket",{
        size_bytes:file.size,mime_type:mime,original_name:file.name
      });
      if(!ticket?.storage_path||!ticket?.signed_upload_url)throw new Error("Autorisation R2 indisponible.");
      await uploadToR2({
        url:ticket.signed_upload_url,file,mime,
        onRequest:xhr=>{activeR2Upload.current=xhr;},
        onProgress:p=>{if(!stopped.current)patch(key,{progress:p});}
      });
      activeR2Upload.current=null;
      if(stopped.current||!listRef.current.some(x=>x.id===key))return;
      patch(key,{progress:99,message:"Vérification R2"});
      const result=await register({
        storage_provider:"r2",storage_path:ticket.storage_path,
        mime_type:mime,size_bytes:file.size,original_name:file.name
      });
      if(!result?.id)throw new Error("Enregistrement R2 impossible.");
      patch(key,{status:"ready",progress:100,mediaId:result.id,message:"Prêt"});
      return;
    }
    const parts=uploadParts(file.size);
    const multipart=parts.length>1;
    const safeName=file.name.replace(/[^a-zA-Z0-9._-]+/g,"-").slice(-100);
    const objectStem=ownerId+"/"+crypto.randomUUID()+"-"+safeName;
    const manifests:{path:string;size:number}[]=[];
    patch(key,{status:"uploading",progress:0,message:"Import en cours"});
    for(const part of parts){
      if(stopped.current||!listRef.current.some(x=>x.id===key))return;
      const objectName=multipart?objectStem+"-part"+String(part.index).padStart(3,"0"):objectStem;
      const blob=multipart?file.slice(part.start,part.end,mime):file;
      await new Promise<void>((resolve,reject)=>{
        const upload=new tus.Upload(blob,{
          endpoint:"https://"+SUPABASE_PROJECT_REF+".storage.supabase.co/storage/v1/upload/resumable",
          chunkSize:6*1024*1024,
          retryDelays:[0,3000,5000,10000,20000],
          removeFingerprintOnSuccess:true,
          uploadDataDuringCreation:true,
          headers:{"x-upsert":"false"},
          metadata:{bucketName:VIDEO_BUCKET,objectName,contentType:mime,cacheControl:"3600"},
          fingerprint:async()=>JSON.stringify(["ugc-many-v1",ownerId,file.name,file.size,file.lastModified,part.index]),
          onBeforeRequest:async(request)=>{
            const {supabase}=await import("@/lib/supabase");
            const {data,error}=await supabase.auth.getSession();
            if(error||!data.session||data.session.user.id!==ownerId)throw new Error("Session expirée.");
            request.setHeader("authorization","Bearer "+data.session.access_token);
          },
          onProgress:(sent)=>{if(!stopped.current)patch(key,{progress:Math.min(99,Math.round((part.start+sent)/file.size*100))});},
          onError:(err)=>{
            const status=Number((err as any)?.originalResponse?.getStatus?.()||0);
            const detail=String(err?.message||"").slice(0,160);
            reject(new Error(videoUploadErrorMessage(status)+(status?" (HTTP "+status+")":"")+
              (status===0&&detail?" · "+detail:"")));
          },
          onSuccess:()=>resolve()
        });
        activeUpload.current=upload;
        void upload.findPreviousUploads().then(previous=>{
          if(stopped.current){reject(new Error("Import interrompu."));return;}
          const match=previous.find(p=>p.metadata?.bucketName===VIDEO_BUCKET&&p.metadata?.objectName===objectName);
          if(match)upload.resumeFromPreviousUpload(match);
          upload.start();
        }).catch(reject);
      });
      manifests.push({path:objectName,size:part.size});
    }
    if(stopped.current||!listRef.current.some(x=>x.id===key))return;
    patch(key,{progress:99,message:"Vérification du fichier"});
    const result=await register({
      storage_path:manifests[0].path,mime_type:mime,size_bytes:file.size,original_name:file.name,
      ...(multipart?{metadata:{multipart:{version:1,parts:manifests}}}:{})
    });
    if(!result?.id)throw new Error("Enregistrement du rush impossible.");
    patch(key,{status:"ready",progress:100,mediaId:result.id,message:"Prêt"});
  }
  async function drain(){
    if(processing.current)return;
    processing.current=true;
    try{
      while(!stopped.current&&pending.current.length){
        const next=pending.current.shift()!;
        if(!listRef.current.some(x=>x.id===next.key))continue;
        try{await uploadOne(next.key,next.file)}
        catch(e:any){
          const msg=String(e?.message||"Import interrompu.");
          patch(next.key,{status:"error",message:msg});
          onError(next.file.name+" : "+msg);
        }finally{activeUpload.current=null;activeR2Upload.current=null}
      }
    }finally{processing.current=false}
  }
  function addFiles(input:FileList|File[]|null){
    setPickerHint("");
    if(!input||disabled)return;
    const newFiles=Array.from(input);
    const existing=new Set(listRef.current.map(x=>x.name+"-"+x.size+"-"+filesRef.current.get(x.id)?.lastModified));
    const accepted:{key:string;file:File}[]=[];
    let total=listRef.current.reduce((n,x)=>n+x.size,0);
    for(const file of newFiles){
      const issue=videoUploadPreflight(file);
      if(issue){onError(file.name+" : "+issue);continue;}
      const signature=file.name+"-"+file.size+"-"+file.lastModified;
      if(existing.has(signature))continue;
      if(listRef.current.length+accepted.length>=MAX_RUSHES){onError("Maximum "+MAX_RUSHES+" rushes secondaires par montage.");break;}
      if(total+file.size>MAX_BATCH_BYTES){onError("Le lot dépasse 3 Go. Répartis les rushes en plusieurs projets.");break;}
      total+=file.size;existing.add(signature);
      accepted.push({key:crypto.randomUUID(),file});
    }
    if(!accepted.length)return;
    for(const entry of accepted)filesRef.current.set(entry.key,entry.file);
    update([...listRef.current,...accepted.map(({key,file})=>({id:key,name:file.name,size:file.size,mediaId:null,status:"waiting" as const,progress:0,message:"En attente"}))]);
    pending.current.push(...accepted);
    void drain();
  }
  function retry(key:string){
    if(disabled||processing.current&&listRef.current.find(x=>x.id===key)?.status==="uploading")return;
    const rush=listRef.current.find(x=>x.id===key);
    const file=filesRef.current.get(key);
    if(!rush||rush.status!=="error"||!file)return;
    patch(key,{status:"waiting",progress:0,message:"Nouvelle tentative…"});
    pending.current.push({key,file});
    void drain();
  }
  function remove(key:string){
    if(listRef.current.find(x=>x.id===key)?.status==="uploading"){onError("Attends la fin de l’import en cours avant de supprimer ce rush.");return;}
    filesRef.current.delete(key);
    pending.current=pending.current.filter(x=>x.key!==key);
    update(listRef.current.filter(x=>x.id!==key));
  }
  function move(key:string,direction:number){
    const next=[...listRef.current];
    const idx=next.findIndex(x=>x.id===key),to=idx+direction;
    if(idx<0||to<0||to>=next.length)return;
    [next[idx],next[to]]=[next[to],next[idx]];
    update(next);
  }
  const ready=rushes.filter(x=>x.status==="ready").length;
  return <div className="ugc-uploader" data-testid="ugc-rush-uploader">
    <div className="ugc-uploader-head"><div><strong>Bibliothèque de rushes UGC</strong><p>Ajoute les plans de détails, d’ambiance, de produit et de résultat. Le rush principal reste séparé.</p></div><span>{ready}/{rushes.length} prêts</span></div>
    <div className="ugc-picker-actions">
      <label className="ugc-batch-drop ugc-picker-single" onClick={()=>setPickerHint("Choisis UNE vidéo dans Photos. Si 20 vidéos bloquent la photothèque, utilise ce mode plusieurs fois.")}>
        <input data-testid="ugc-single-file-input" type="file" disabled={disabled}
          accept="video/*,.mp4,.mov,.webm"
          onChange={e=>{const files=e.currentTarget.files;addFiles(files);e.currentTarget.value="";}}/>
        <UploadCloud size={22}/><span><strong>Importer 1 vidéo</strong><small>Max {MAX_VIDEO_UPLOAD_MB} Mo par vidéo · tu peux répéter l’opération</small></span>
      </label>
      <label className="ugc-batch-drop ugc-picker-batch" onClick={()=>setPickerHint("Sur iPhone, sélectionne 3 à 5 vidéos maximum dans Photos, ou utilise « Choisir un fichier » / Fichiers.")} onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();addFiles(e.dataTransfer.files);}}>
        <input data-testid="ugc-file-input" type="file" multiple disabled={disabled}
          accept="video/*,.mp4,.mov,.webm"
          onChange={e=>{addFiles(e.currentTarget.files);e.currentTarget.value="";}}/>
        <UploadCloud size={22}/><span><strong>Importer un lot</strong><small>3–5 vidéos à la fois · {MAX_VIDEO_UPLOAD_MB} Mo max chacune · jusqu’à 40 au total</small></span>
      </label>
      <label className="ugc-batch-drop ugc-picker-files" onClick={()=>setPickerHint("Choisis « Fichiers » dans le sélecteur iOS. Les fichiers doivent être enregistrés sur l’iPhone ou iCloud Drive.")} onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();addFiles(e.dataTransfer.files);}}>
        <input data-testid="ugc-files-input" type="file" multiple disabled={disabled}
          onChange={e=>{addFiles(e.currentTarget.files);e.currentTarget.value="";}}/>
        <UploadCloud size={22}/><span><strong>Importer depuis Fichiers</strong><small>Alternative si Photos se bloque · MP4, MOV, WebM</small></span>
      </label>
    </div>
    {pickerHint&&<p role="status" className="ugc-picker-hint">{pickerHint}</p>}
    {rushes.length>0&&<div className="ugc-rush-list" role="list" aria-label="Rushes importés">
      {rushes.map((rush,i)=><div className="ugc-rush-item" role="listitem" key={rush.id}>
        <Film size={17}/><div className="ugc-rush-desc"><strong title={rush.name}>{rush.name}</strong><small>{(rush.size/1048576).toFixed(1)} Mo · {rush.message}</small>{rush.status==="uploading"&&<div className="ugc-rush-bar"><i style={{width:rush.progress+"%"}}/></div>}</div>
        <span className={"ugc-rush-state "+rush.status}>{rush.status==="ready"?<Check size={15}/>:rush.status==="uploading"?rush.progress+"%":rush.status==="error"?"Erreur":"…"}</span>
        {rush.status==="error"&&<button type="button" className="ugc-rush-retry" title="Réessayer ce rush" onClick={()=>retry(rush.id)} disabled={disabled}><RotateCcw size={15}/> Réessayer</button>}
        <button type="button" title="Monter" disabled={disabled||i===0} onClick={()=>move(rush.id,-1)}><ArrowUp size={15}/></button>
        <button type="button" title="Descendre" disabled={disabled||i===rushes.length-1} onClick={()=>move(rush.id,1)}><ArrowDown size={15}/></button>
        <button type="button" title="Retirer" disabled={disabled||rush.status==="uploading"} onClick={()=>remove(rush.id)}><Trash2 size={15}/></button>
      </div>)}
    </div>}
    <p className="ugc-rush-footnote">Tous les rushes sont stockés dans ton espace privé. L’ordre de la liste sert de priorité de montage. Les rushes supplémentaires n’ajoutent pas de voix.</p>
  </div>;
}
