// Connection layer only: do not change the approved compositor to wire the UI.
import {readFileSync} from 'node:fs';import {createHash} from 'node:crypto';
const base=new URL('../',import.meta.url);
const release=JSON.parse(readFileSync(new URL('engines/releases/social-kinetic-v28.json',base),'utf8'));
const hash=value=>createHash('sha256').update(value).digest('hex');
export const KINETIC_RELEASE=release.id;
export function assertKineticRelease(){
 for(const [path,expected] of Object.entries(release.files))if(hash(readFileSync(new URL(path,base)))!==expected)throw Object.assign(Error('Le moteur Social Kinetic diffère de la version verrouillée. Rendu suspendu.'),{status:503,code:'KINETIC_RELEASE_CHANGED'});
 return release.id;
}
export function transcriptFingerprint(words){
 if(!Array.isArray(words)||words.length>3000||words.some(w=>!w||typeof w.text!=='string'||!Number.isFinite(w.startMs??w.start*1000)||!Number.isFinite(w.endMs??w.end*1000)))return null;
 return hash(JSON.stringify(words.map(w=>({text:w.text,startMs:w.startMs??Math.round(w.start*1000),endMs:w.endMs??Math.round(w.end*1000)}))));
}
export function reviewedKineticDirection(metadata,words){
 assertKineticRelease();
 const approved=release.reviewedSources.find(p=>p.sourceSha256===metadata?.sourceSha256&&p.transcriptSha256===transcriptFingerprint(words));
 return {release:release.id,direction:approved?structuredClone(approved.direction):null,notice:approved?'Direction visuelle validée retrouvée pour ce rush et ces mots. La transcription reste à écouter.':'Ce rush ou sa transcription ne possède pas encore de direction contextuelle validée. Préparez les repères V28 dans Animations avancées ; aucun ancien preset ne sera lancé.'};
}
