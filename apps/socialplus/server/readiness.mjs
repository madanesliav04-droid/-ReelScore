import {spawnSync} from 'node:child_process';
import {transcriptionKey} from './transcription.mjs';
import {assertKineticRelease} from './kinetic-release.mjs';

// Configuration/tool readiness, not a certificate of model fidelity or public TLS.
export function createReadiness({db,ownerId,ownerTotpSecret,origin,secureCookies}){
 let cached=null,at=0;
 return ()=>{
  if(cached&&Date.now()-at<30000)return cached;
  const works=(command)=>{const result=spawnSync(command,['-version'],{stdio:'ignore',timeout:3000});return result.status===0};
  let sqlite=false,owner=false,locked=false;
  try{sqlite=db.prepare('SELECT 1 AS ok').get().ok===1;owner=Boolean(ownerId&&ownerTotpSecret&&db.prepare('SELECT id FROM security_users WHERE id=? AND disabled_at IS NULL').get(ownerId));}catch{}
  try{assertKineticRelease();locked=true}catch{}
  const chrome=spawnSync(process.env.SOCIALPLUS_CHROMIUM||'/usr/bin/chromium',['--version'],{stdio:'ignore',timeout:3000});
  let asr=false;try{asr=Boolean(transcriptionKey())}catch{}
  const checks={sqlite,ownerProvisioned:owner,httpsConfigured:origin.startsWith('https://')&&secureCookies===true,ffmpeg:works('ffmpeg'),ffprobe:works('ffprobe'),chromium:chrome.status===0,offlineAsrConfigured:asr,kineticReleaseIntact:locked};
  at=Date.now();cached={ready:Object.values(checks).every(Boolean),checks,scope:'Configuration and installed tools only; not phonetic, visual or external TLS validation'};return cached;
 };
}
