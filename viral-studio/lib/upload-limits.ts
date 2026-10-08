/** Effective upload ceiling: this Supabase project's global Storage cap is 50 MiB.
 * The bucket-level 500 MiB limit does NOT override the project-level limit.
 * Raise the global Storage setting and this constant together before advertising larger files.
 */
export const MAX_VIDEO_UPLOAD_MIB = 50;
export const MAX_VIDEO_UPLOAD_BYTES = MAX_VIDEO_UPLOAD_MIB * 1024 * 1024;

export function videoUploadPreflight(file:{name:string;size:number}):string|null {
  if (!file.size) return "Ce fichier est vide. Choisis une vidéo.";
  if (!/\.(mp4|mov|webm)$/i.test(file.name)) return "Choisis une vidéo MP4, MOV ou WebM.";
  if (file.size > MAX_VIDEO_UPLOAD_BYTES) {
    const sizeMiB = (file.size / (1024 * 1024)).toFixed(1).replace(".", ",");
    return `Cette vidéo fait ${sizeMiB} Mo : la limite actuelle est de ${MAX_VIDEO_UPLOAD_MIB} Mo. Exporte une version MP4 plus légère avant de l'importer.`;
  }
  return null;
}

export function videoUploadErrorMessage(status?:number|null):string {
  if (status === 413) {
    return `Fichier refusé par le stockage : limite maximale de ${MAX_VIDEO_UPLOAD_MIB} Mo. Réduis la taille de la vidéo avant de réessayer.`;
  }
  if (status === 401 || status === 403) {
    return "Ta session d'import a expiré ou l'accès a été refusé. Reconnecte-toi, puis réessaie.";
  }
  if (status === 409) {
    return "Conflit sur cet import. Relance le transfert avec le même fichier.";
  }
  return "La connexion a interrompu l'envoi. Tu peux sélectionner à nouveau le même fichier pour reprendre le transfert.";
}
