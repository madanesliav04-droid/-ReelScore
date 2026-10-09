/** Free-project Storage allows up to 50 MiB per *object*.
 * Multi-part uploads split one client video into <=40 MiB objects then the
 * processing worker reassembles them in source order. Per-video maximum 500 MiB.
 */
export const MAX_VIDEO_UPLOAD_MIB=500;
export const MAX_VIDEO_UPLOAD_BYTES=MAX_VIDEO_UPLOAD_MIB*1024*1024;
export const UPLOAD_PART_MIB=40;
export const UPLOAD_PART_BYTES=UPLOAD_PART_MIB*1024*1024;
export type UploadPart={index:number;start:number;end:number;size:number};

export function uploadParts(size:number):UploadPart[]{
  if(!Number.isSafeInteger(size)||size<=0||size>MAX_VIDEO_UPLOAD_BYTES)throw new Error("INVALID_VIDEO_SIZE");
  const out:UploadPart[]=[];
  for(let start=0;start<size;start+=UPLOAD_PART_BYTES){
    const end=Math.min(size,start+UPLOAD_PART_BYTES);
    out.push({index:out.length,start,end,size:end-start});
  }
  return out;
}

export function videoUploadPreflight(file:{name:string;size:number}):string|null{
  if(!file.size)return "Ce fichier est vide. Choisis une vidéo.";
  if(!/\.(mp4|mov|webm)$/i.test(file.name))return "Choisis une vidéo MP4, MOV ou WebM.";
  if(!Number.isSafeInteger(file.size)||file.size>MAX_VIDEO_UPLOAD_BYTES){
    const sizeMiB=(file.size/(1024*1024)).toFixed(1).replace(".",",");
    return `Cette vidéo fait ${sizeMiB} Mo : la limite par vidéo est de ${MAX_VIDEO_UPLOAD_MIB} Mo.`;
  }
  return null;
}
export function videoUploadErrorMessage(status?:number|null):string{
  if(status===413)return "Un morceau a dépassé la limite du stockage. L’import peut être repris en sélectionnant le même fichier.";
  if(status===401||status===403)return "Ta session d'import a expiré ou l'accès a été refusé. Reconnecte-toi, puis réessaie.";
  if(status===409)return "Conflit sur cet import. Relance le transfert avec le même fichier.";
  return "La connexion a interrompu l'envoi. Tu peux sélectionner à nouveau le même fichier pour reprendre le transfert.";
}
