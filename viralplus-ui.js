const $ = id => document.getElementById(id);
const SUPABASE_URL = String(window.VIRAL_SUPABASE_URL || '').replace(/\/$/,'');
const SUPABASE_KEY = String(window.VIRAL_SUPABASE_KEY || '');
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const lowPower = innerWidth < 900;

const cinematic=$('cinematic'), phoneRig=$('phoneRig'), phone=$('phone'), halo=$('halo'), orbit1=$('orbit1'), orbit2=$('orbit2'), mediaGrid=$('mediaGrid'), sphere=$('sphere'), scrollFill=$('scrollFill'), scrollHint=$('scrollHint');
const copies=[...document.querySelectorAll('.copy')], socialLayer=$('socialLayer'), analysisLayer=$('analysisLayer'), resultLayer=$('resultLayer');
const fileInput=$('fileInput'), reanalyseInput=$('reanalyseInput'), dropzone=$('dropzone'), previewVideo=$('previewVideo'), placeholder=$('placeholder'), videoShade=$('videoShade'), videoFileName=$('videoFileName'), analyzeBtn=$('analyzeBtn'), analysisState=$('analysisState'), phoneScore=$('phoneScore'), scoreNumber=$('scoreNumber'), timelineFill=$('timelineFill'), timelineText=$('timelineText'), timelineLabel=$('timelineLabel');
const cards=[$('cardHook'),$('cardRetention'),$('cardVisual'),$('cardShare')];
const badges=[...document.querySelectorAll('.socialBadge')], floats=[...document.querySelectorAll('.float')];
const heroViews=$('heroViews'),heroLikes=$('heroLikes'),heroFollowers=$('heroFollowers'),likeCounter=$('likeCounter'),commentCounter=$('commentCounter'),shareCounter=$('shareCounter'),sViews=$('sViews'),sLikes=$('sLikes'),sFollowers=$('sFollowers'),sComments=$('sComments');
const authModal=$('authModal'),paywall=$('paywall'),toast=$('toast'),usagePill=$('usagePill'),accountBtn=$('accountBtn');
const resultEmpty=$('resultEmpty'),resultContent=$('resultContent'),resultScore=$('resultScore'),scoreOrb=$('scoreOrb'),statusBadge=$('statusBadge'),resultVerdictTitle=$('resultVerdictTitle'),resultVerdictText=$('resultVerdictText'),versionLine=$('versionLine'),mainProblem=$('mainProblem'),mainWhy=$('mainWhy'),hotspotTime=$('hotspotTime'),hotspotReason=$('hotspotReason'),hookBefore=$('hookBefore'),hookAfter=$('hookAfter'),actionList=$('actionList'),premiumTeaser=$('premiumTeaser'),comparePanel=$('comparePanel'),beforeScore=$('beforeScore'),afterScore=$('afterScore'),deltaScore=$('deltaScore'),metricDelta=$('metricDelta');
const stageResultCta=$('stageResultCta'),phoneResultScore=$('phoneResultScore'),phoneStatus=$('phoneStatus'),phoneProblem=$('phoneProblem'),phoneHotspot=$('phoneHotspot');

let session=null, entitlement=null, authMode='login', lastHoverBurst=0, pendingFile=null, pendingReanalysis=false;
let currentFile=null, objectUrl=null, currentAnalysis=null, baselineAnalysis=null, reanalysisMode=false, analyzing=false, counterTimer=0, scrollRAF=0, mouseRAF=0, resultMode=false, storagePath=null, storageUpload=null, currentVideoId=null, currentJobId=null, currentAnalysisIdempotencyKey=null, uploadGeneration=0, analysisStartedAt=0, analysisProgressTimer=null;

function clamp(v,a=0,b=1){return Math.max(a,Math.min(b,v))}
function mix(a,b,t){return a+(b-a)*t}
function ease(t){return t<.5?2*t*t:1-Math.pow(-2*t+2,2)/2}
function seg(p,a,b){return clamp((p-a)/(b-a))}
function fmt(n){return n>=1000?(n/1000).toFixed(n>=10000?0:1).replace('.0','')+'K':String(n)}
function setCard(i,score,note){cards[i].querySelector('strong').textContent=Math.round(Number(score)||0);cards[i].querySelector('small').textContent=note||''}
function showToast(msg){toast.textContent=msg;toast.classList.remove('hidden');clearTimeout(showToast.t);showToast.t=setTimeout(()=>toast.classList.add('hidden'),3400)}
function escapeHtml(s){return String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[m]))}

function stageProgress(){const r=cinematic.getBoundingClientRect(), total=cinematic.offsetHeight-innerHeight;return clamp(-r.top/Math.max(1,total))}
function setCopy(index,opacity,dx=0,dy=0){const el=copies[index];if(!el)return;el.style.opacity=String(opacity);el.style.transform=index===0?'translate3d(-50%,0,0)':`translate3d(${dx}px,calc(-50% + ${dy}px),0)`;el.style.pointerEvents=opacity>.7?'auto':'none'}
function updateStage(){
  const p=stageProgress(); scrollFill.style.height=(p*100)+'%';
  if(resultMode){ copies.forEach((_,i)=>setCopy(i,0)); stageResultCta.classList.remove('hidden'); return; }
  stageResultCta.classList.add('hidden');
  setCopy(0,1);
  for(let k=1;k<copies.length;k++)setCopy(k,0);
  phoneRig.style.transform='translate3d(-50%,-50%,0) scale(1)';
  phone.style.transform='rotateY(-7deg) rotateX(3deg) rotateZ(-1deg)';
  mediaGrid.style.opacity='.12';
  mediaGrid.style.transform='translate(-50%,-50%) scale(1)';
  sphere.style.opacity='.65';
  sphere.style.transform='translate(-50%,-50%) scale(1)';
  halo.style.opacity='.9';
  orbit1.style.transform='translate(-50%,-50%) rotate('+(p*170)+'deg)';
  orbit2.style.transform='translate(-50%,-50%) rotate('+(-p*110)+'deg)';
  const socialFade=1-seg(p,.62,.76);
  badges.forEach((b,idx)=>{b.style.opacity=String(socialFade);b.style.transform='translate3d('+((idx%2?1:-1)*p*18)+'px,'+(p*8)+'px,0)'});
  const metricOpacity=.55+.45*Math.sin(p*Math.PI);
  floats.forEach((f,idx)=>{f.style.opacity=String(metricOpacity);f.style.transform='translateY('+Math.sin(p*6+idx)*8+'px)'});
  if(p>.62){showAnalysisLayer()} else if(!analyzing){showSocialLayer()}
  scrollHint.style.opacity=String(1-seg(p,.02,.12));
}
function requestStage(){if(scrollRAF)return;scrollRAF=requestAnimationFrame(()=>{updateStage();scrollRAF=0})}
addEventListener('scroll',requestStage,{passive:true}); addEventListener('resize',requestStage,{passive:true});

function showSocialLayer(){if(resultMode)return;socialLayer.classList.add('active');analysisLayer.classList.remove('active');resultLayer.classList.remove('active')}
function showAnalysisLayer(){if(resultMode)return;socialLayer.classList.remove('active');analysisLayer.classList.add('active');resultLayer.classList.remove('active')}
function showResultLayer(data){resultMode=true;socialLayer.classList.remove('active');analysisLayer.classList.remove('active');resultLayer.classList.add('active');phoneResultScore.textContent=data.final_score;phoneStatus.textContent=statusFor(data.final_score)[0].toUpperCase();phoneProblem.textContent=data.main_problem||'Voici le problème principal.';const hot=(data.timeline||[])[0]||{};phoneHotspot.textContent=hot.time||'00:00 → 00:02';stageResultCta.classList.remove('hidden');updateStage()}

function burstSocial(count=14){if(reduceMotion)return;const labels=['♥ 1.2K','💬 incroyable','↗ 96','+742 followers','12.4K vues','exactement'];const r=phone.getBoundingClientRect(),frag=document.createDocumentFragment(),nodes=[];for(let i=0;i<count;i++){const n=document.createElement('div');n.className='socialParticle';n.textContent=labels[Math.floor(Math.random()*labels.length)];n.style.left=(r.left+r.width/2-40+Math.random()*80)+'px';n.style.top=(r.top+r.height*.55-20+Math.random()*60)+'px';n.style.setProperty('--x',(Math.random()*300-150)+'px');n.style.setProperty('--y',(-150-Math.random()*250)+'px');n.style.setProperty('--r',(Math.random()*44-22)+'deg');n.style.setProperty('--dur',(1.2+Math.random()*.9)+'s');frag.appendChild(n);nodes.push(n)}document.body.appendChild(frag);setTimeout(()=>nodes.forEach(n=>n.remove()),2400)}
phone.addEventListener('click',()=>{if(socialLayer.classList.contains('active'))burstSocial(lowPower?8:16)});
phone.addEventListener('pointerenter',()=>{if(socialLayer.classList.contains('active'))burstSocial(lowPower?3:6)});
phone.addEventListener('pointermove',()=>{if(lowPower||reduceMotion||!socialLayer.classList.contains('active'))return;const now=performance.now();if(now-lastHoverBurst>900){lastHoverBurst=now;burstSocial(3)}});
addEventListener('mousemove',e=>{if(lowPower||reduceMotion||!socialLayer.classList.contains('active')||stageProgress()>.1)return;if(mouseRAF)return;const cx=e.clientX,cy=e.clientY;mouseRAF=requestAnimationFrame(()=>{const x=(cx/innerWidth-.5)*4,y=(cy/innerHeight-.5)*-3;phone.style.transform=`rotateY(${-16+x}deg) rotateX(${6+y}deg) rotateZ(-2deg)`;mouseRAF=0})},{passive:true});

function tickCounters(){clearTimeout(counterTimer);if(!document.hidden&&socialLayer.classList.contains('active')){const v=124000+Math.floor(Math.random()*900),l=18900+Math.floor(Math.random()*120),f=4300+Math.floor(Math.random()*30),c=1800+Math.floor(Math.random()*22),s=5400+Math.floor(Math.random()*35);heroViews.textContent=fmt(v);heroLikes.textContent=fmt(l);heroFollowers.textContent='+'+fmt(f);likeCounter.textContent=fmt(l);commentCounter.textContent=fmt(c);shareCounter.textContent=fmt(s);sViews.textContent=fmt(v)+' vues';sLikes.textContent=fmt(l)+' likes';sFollowers.textContent='+'+fmt(f)+' followers';sComments.textContent=fmt(c)+' commentaires'}counterTimer=setTimeout(tickCounters,1600)}
document.addEventListener('visibilitychange',()=>{if(!document.hidden)tickCounters()});

function saveSession(s){session=s;if(s)localStorage.setItem('viralplus_session',JSON.stringify(s));else localStorage.removeItem('viralplus_session');updateAccountUI()}
function storedSession(){try{return JSON.parse(localStorage.getItem('viralplus_session')||'null')}catch{return null}}
function authRedirectUrl(){return location.origin+location.pathname}
async function handleAuthCallback(){
  const hash=new URLSearchParams(location.hash.replace(/^#/,''));
  const access=hash.get('access_token'), refresh=hash.get('refresh_token');
  if(access){
    try{
      const r=await fetch(SUPABASE_URL+'/auth/v1/user',{headers:{apikey:SUPABASE_KEY,Authorization:'Bearer '+access}});
      const user=await r.json();
      if(r.ok&&user?.id){
        const d={access_token:access,refresh_token:refresh||'',expires_in:Number(hash.get('expires_in')||3600),expires_at:Math.floor(Date.now()/1000)+Number(hash.get('expires_in')||3600),user};
        saveSession(d);
        await processPendingFile();
        history.replaceState({},document.title,location.pathname+location.search);
        closeAuth();
        showToast('Email confirmé. Ton compte Viral+ est prêt.');
        await refreshEntitlement(); await loadHistory();
        return true;
      }
    }catch{}
  }
  const error=hash.get('error_description');
  if(error){showToast(decodeURIComponent(error));history.replaceState({},document.title,location.pathname+location.search)}
  return false
}
function isExpired(s){return !s?.access_token || (s.expires_at && Date.now()/1000 > s.expires_at-60)}
async function refreshSession(){if(!session?.refresh_token)return false;const r=await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`,{method:'POST',headers:{apikey:SUPABASE_KEY,'Content-Type':'application/json'},body:JSON.stringify({refresh_token:session.refresh_token})});if(!r.ok){saveSession(null);return false}const d=await r.json();d.expires_at=Math.floor(Date.now()/1000)+(d.expires_in||3600);saveSession(d);return true}
async function getToken(){if(isExpired(session)){const ok=await refreshSession();if(!ok)return null}return session?.access_token||null}
function updateAccountUI(){if(session?.user){accountBtn.textContent=(session.user.email||'Compte').split('@')[0];}else{accountBtn.textContent='Se connecter';usagePill.classList.add('hidden')}}
async function supa(path,{method='GET',body,prefer,query='',auth=true}={}){const token=auth?await getToken():null;const headers={apikey:SUPABASE_KEY,'Content-Type':'application/json'};if(token)headers.Authorization=`Bearer ${token}`;if(prefer)headers.Prefer=prefer;const r=await fetch(`${SUPABASE_URL}${path}${query}`,{method,headers,body:body===undefined?undefined:JSON.stringify(body)});let data=null;try{data=await r.json()}catch{}if(!r.ok)throw new Error(data?.msg||data?.message||data?.error_description||data?.error||`Erreur ${r.status}`);return data}
async function jobsApi(route,{method='GET',body}={}){return supa('/functions/v1/viral-edit-jobs/'+String(route||'').replace(/^\//,''),{method,body})}

async function track(name,properties={}){if(!session?.user)return;try{await supa('/rest/v1/viralplus_events',{method:'POST',body:{user_id:session.user.id,event_name:name,properties}})}catch{}}
async function refreshEntitlement(){if(!session?.user)return;try{const d=await supa('/rest/v1/rpc/viralplus_get_entitlement',{method:'POST',body:{}});entitlement=Array.isArray(d)?d[0]:d;if(entitlement){usagePill.classList.remove('hidden');const days=entitlement.trial_active&&entitlement.trial_ends_at?Math.max(0,Math.ceil((new Date(entitlement.trial_ends_at)-Date.now())/86400000)):0;usagePill.textContent=`BÊTA GRATUITE · ${entitlement.remaining}/${entitlement.analysis_limit} analyses`}}catch(e){console.warn(e)}}

function openAuth(){authModal.classList.remove('hidden')}
function closeAuth(){authModal.classList.add('hidden')}
async function processPendingFile(){if(pendingFile&&session?.user){const f=pendingFile,r=pendingReanalysis;pendingFile=null;pendingReanalysis=false;setFile(f,r)}}
async function ensureAuth(){if(session?.user&&await getToken())return true;openAuth();return false}
[...document.querySelectorAll('.authTabs button')].forEach(b=>b.addEventListener('click',()=>{authMode=b.dataset.auth;document.querySelectorAll('.authTabs button').forEach(x=>x.classList.toggle('active',x===b));$('authSubmit').textContent=authMode==='login'?'Se connecter':'Créer mon compte';$('authMessage').textContent=''}));
$('authForm').addEventListener('submit',async e=>{e.preventDefault();const email=$('authEmail').value.trim(),password=$('authPassword').value;const msg=$('authMessage');msg.textContent='Connexion…';try{if(authMode==='signup'){const d=await supa('/auth/v1/signup',{method:'POST',auth:false,body:{email,password,options:{emailRedirectTo:authRedirectUrl()}}});if(d.access_token){d.expires_at=Math.floor(Date.now()/1000)+(d.expires_in||3600);saveSession(d);closeAuth();await refreshEntitlement();await loadHistory();showToast('Compte créé. Bienvenue dans Viral+.');await processPendingFile()}else{msg.textContent='Compte créé. Vérifie ton email. Le lien te ramènera automatiquement ici.'}}else{const d=await supa('/auth/v1/token',{method:'POST',auth:false,query:'?grant_type=password',body:{email,password}});d.expires_at=Math.floor(Date.now()/1000)+(d.expires_in||3600);saveSession(d);closeAuth();await refreshEntitlement();await loadHistory();track('login');showToast('Connecté à Viral+.');await processPendingFile()}}catch(err){msg.textContent=err.message}});
$('closeAuth').addEventListener('click',closeAuth);authModal.addEventListener('click',e=>{if(e.target===authModal)closeAuth()});
accountBtn.addEventListener('click',async()=>{if(!session?.user){openAuth();return}if(confirm(`Déconnecter ${session.user.email} ?`)){saveSession(null);entitlement=null;loadHistory();showToast('Déconnecté.')}});

function scrollToAnalysis(){const target=cinematic.offsetTop+(cinematic.offsetHeight-innerHeight)*.87;scrollTo({top:target,behavior:'smooth'});track('analyse_clicked')}
['heroAnalyse','navAnalyse','resultStart','finalAnalyse'].forEach(id=>$(id).addEventListener('click',scrollToAnalysis));/* Robust CTA/dropzone handlers: capture phase prevents stale/duplicate handlers from blocking the primary UX. */
heroAnalyse.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();scrollToAnalysis()},{capture:true});
$('heroScroll').addEventListener('click',()=>scrollTo({top:cinematic.offsetTop+innerHeight*.85,behavior:'smooth'}));$('brandHome').addEventListener('click',()=>scrollTo({top:0,behavior:'smooth'}));$('phoneImprove').addEventListener('click',()=>document.getElementById('workspace').scrollIntoView({behavior:'smooth'}));stageResultCta.addEventListener('click',()=>document.getElementById('workspace').scrollIntoView({behavior:'smooth'}));$('historyNav').addEventListener('click',()=>document.getElementById('history').scrollIntoView({behavior:'smooth'}));

function updateUploadUI(pct){
  const value=Math.max(0,Math.min(100,Math.round(Number(pct)||0)));
  analyzeBtn.textContent=`Upload ${value}%…`;
  timelineLabel.textContent='Upload';
  timelineText.textContent=`${value}%`;
  timelineFill.style.width=value+'%';
}
function resumableEndpoint(){
  const projectRef=new URL(SUPABASE_URL).hostname.split('.')[0];
  return `https://${projectRef}.storage.supabase.co/storage/v1/upload/resumable`;
}
async function uploadVideoToStorage(file,generation){
  const token=await getToken();
  if(!token) throw new Error('Session expirée. Reconnecte-toi.');
  const safeBase=(file.name||'video.mp4').replace(/[^a-zA-Z0-9._-]/g,'_').slice(-100);
  const resumeKey=`viralplus_upload_${session.user.id}_${file.size}_${file.lastModified}_${safeBase}`;
  let path=sessionStorage.getItem(resumeKey);
  if(!path){
    path=`${session.user.id}/${Date.now()}-${Math.random().toString(36).slice(2,10)}-${safeBase}`;
    sessionStorage.setItem(resumeKey,path);
  }

  analyzeBtn.disabled=true;
  analysisState.textContent='UPLOAD DE LA VIDÉO';
  updateUploadUI(0);
  track('video_upload_started',{name:file.name,size:file.size,mime_type:file.type||'video/mp4'});

  try{
    if(window.tus?.Upload){
      await new Promise((resolve,reject)=>{
        const upload=new window.tus.Upload(file,{
          endpoint:resumableEndpoint(),
          retryDelays:[0,3000,5000,10000,20000],
          headers:{authorization:`Bearer ${token}`},
          uploadDataDuringCreation:true,
          removeFingerprintOnSuccess:true,
          metadata:{
            bucketName:'viralplus-videos',
            objectName:path,
            contentType:file.type||'video/mp4',
            cacheControl:'3600',
            metadata:JSON.stringify({module:'viralplus',source:'web'})
          },
          chunkSize:6*1024*1024,
          onError:error=>reject(error),
          onProgress:(uploaded,total)=>{
            if(generation!==uploadGeneration)return;
            updateUploadUI(total?uploaded/total*100:0);
          },
          onSuccess:()=>resolve()
        });

        storageUpload={abort:()=>upload.abort(true)};
        upload.findPreviousUploads()
          .then(previous=>{
            if(generation!==uploadGeneration)return;
            const samePath=(previous||[]).find(p=>p?.metadata?.objectName===path);
            if(samePath)upload.resumeFromPreviousUpload(samePath);
            upload.start();
          })
          .catch(reject);
      });
    }else{
      await new Promise((resolve,reject)=>{
        const xhr=new XMLHttpRequest();
        const endpoint=`${SUPABASE_URL}/storage/v1/object/viralplus-videos/${path.split('/').map(encodeURIComponent).join('/')}`;
        xhr.open('POST',endpoint,true);
        xhr.setRequestHeader('Authorization',`Bearer ${token}`);
        xhr.setRequestHeader('apikey',SUPABASE_KEY);
        xhr.setRequestHeader('Content-Type',file.type||'video/mp4');
        xhr.upload.onprogress=e=>{
          if(generation!==uploadGeneration||!e.lengthComputable)return;
          updateUploadUI(e.loaded/e.total*100);
        };
        xhr.onerror=()=>reject(new Error('Échec de l’upload. Vérifie ta connexion puis réessaie.'));
        xhr.onabort=()=>reject(new Error('Upload interrompu.'));
        xhr.onload=()=>{
          let d={};try{d=JSON.parse(xhr.responseText||'{}')}catch{}
          if(xhr.status<200||xhr.status>=300){
            reject(new Error(d.message||d.error||`Échec de l’upload (${xhr.status}).`));
            return;
          }
          resolve();
        };
        storageUpload={abort:()=>xhr.abort()};
        xhr.send(file);
      });
    }

    if(generation!==uploadGeneration)return null;
    sessionStorage.removeItem(resumeKey);
    storagePath=path;
    currentVideoId=await registerMediaAsset(file,path);
    updateUploadUI(100);
    track('video_upload_completed',{name:file.name,size:file.size,mime_type:file.type||'video/mp4'});
    return path;
  }catch(error){
    track('video_upload_failed',{message:String(error?.message||error).slice(0,300),size:file.size});
    throw error;
  }
}
async function registerMediaAsset(file,path){
  const existing=await supa('/rest/v1/media_assets',{
    query:`?select=id&storage_bucket=eq.viralplus-videos&storage_path=eq.${encodeURIComponent(path)}&limit=1`
  });
  if(existing?.[0]?.id)return existing[0].id;

  const rows=await supa('/rest/v1/media_assets',{
    method:'POST',
    prefer:'return=representation',
    body:{
      user_id:session.user.id,
      module:'viralplus',
      kind:'source',
      storage_bucket:'viralplus-videos',
      storage_path:path,
      original_name:file.name||'video.mp4',
      mime_type:file.type||'video/mp4',
      size_bytes:file.size,
      status:'uploaded',
      metadata:{source:'web',upload_protocol:window.tus?.Upload?'tus':'standard'}
    }
  });
  const asset=Array.isArray(rows)?rows[0]:rows;
  if(!asset?.id)throw new Error('Impossible d’enregistrer la vidéo.');
  return asset.id;
}

async function prepareVideoUpload(file,isReanalysis,generationArg){
  storagePath=null;
  storageUpload=null;
  const myGeneration=generationArg||uploadGeneration;
  try{
    await uploadVideoToStorage(file,myGeneration);
    if(myGeneration!==uploadGeneration)return false;
    analyzeBtn.disabled=false;
    analyzeBtn.textContent=isReanalysis?'Re-analyser cette version':'Analyser la vidéo';
    analysisState.textContent=isReanalysis?'VERSION CORRIGÉE CHARGÉE':'VIDÉO CHARGÉE';
    timelineLabel.textContent='Prête';
    timelineFill.style.width='100%';
    timelineText.textContent='Upload terminé';
    return true;
  }catch(e){
    if(myGeneration!==uploadGeneration)return false;
    analyzeBtn.disabled=true;
    analyzeBtn.textContent='Réessayer l’upload';
    analysisState.textContent='ERREUR UPLOAD';
    showToast(e.message||'Échec de l’upload.');
    return false;
  }
}
function setFile(file,isReanalysis=false){
  if(!file)return;
  if(file.size>500*1024*1024){showToast('Vidéo trop lourde : 500 Mo maximum pour cette version.');return}
  if(!session?.user){pendingFile=file;pendingReanalysis=isReanalysis;openAuth();return}
  uploadGeneration++;
  if(storageUpload){try{storageUpload.abort(true)}catch{}}
  if(objectUrl)URL.revokeObjectURL(objectUrl);
  objectUrl=URL.createObjectURL(file);
  currentFile=file;
  storagePath=null;
  currentVideoId=null;
  currentJobId=null;
  currentAnalysisIdempotencyKey=null;
  reanalysisMode=isReanalysis;
  previewVideo.src=objectUrl;
  dropzone.classList.add('hasVideo');
  placeholder.classList.add('hidden');
  videoShade.classList.remove('hidden');
  videoFileName.textContent=file.name;
  analyzeBtn.disabled=true;
  analyzeBtn.textContent='Upload 0%…';
  analysisState.textContent='UPLOAD DE LA VIDÉO';
  resultMode=false;
  showAnalysisLayer();
  previewVideo.play().catch(()=>{});
  track('video_selected',{name:file.name,size:file.size,reanalysis:isReanalysis});
  const generation=uploadGeneration;
  prepareVideoUpload(file,isReanalysis,generation);
}
fileInput.addEventListener('change',e=>{setFile(e.target.files?.[0],false);e.target.value=''});

// Hardened native picker: do not depend solely on label semantics inside the phone mockup.
function openVideoPicker(){
  let input=$('fileInput');
  if(!input){
    input=document.createElement('input');
    input.id='fileInput';
    input.type='file';
    input.accept='video/*,.mp4,.mov,.webm';
    input.className='dropFileInput';
    document.body.appendChild(input);
    input.addEventListener('change',e=>{setFile(e.target.files?.[0],false);e.target.value=''});
  }
  try{ if(typeof input.showPicker==='function'){ input.showPicker(); return; } }catch(e){}
  input.click();
}
dropzone.addEventListener('click',e=>{
  if(e.target.closest('#changeVideo')) return;
  if(e.target===fileInput) return;
  e.preventDefault();
  e.stopPropagation();
  openVideoPicker();
});
reanalyseInput.addEventListener('change',e=>{setFile(e.target.files?.[0],true);e.target.value=''});
const workspaceUploader=$('workspaceUploader');
['dragenter','dragover'].forEach(evt=>dropzone.addEventListener(evt,e=>{e.preventDefault();dropzone.classList.add('dragover')}));
['dragleave','drop'].forEach(evt=>dropzone.addEventListener(evt,e=>{e.preventDefault();dropzone.classList.remove('dragover')}));
dropzone.addEventListener('drop',e=>setFile(e.dataTransfer.files?.[0],false));
if(workspaceUploader){
  ['dragenter','dragover'].forEach(evt=>workspaceUploader.addEventListener(evt,e=>{e.preventDefault();workspaceUploader.classList.add('dragover')}));
  ['dragleave','drop'].forEach(evt=>workspaceUploader.addEventListener(evt,e=>{e.preventDefault();workspaceUploader.classList.remove('dragover')}));
  workspaceUploader.addEventListener('drop',e=>{e.preventDefault();e.stopPropagation();setFile(e.dataTransfer.files?.[0],false)});
}
$('changeVideo').addEventListener('click',e=>{e.preventDefault();e.stopPropagation();fileInput.click()});

function analysisWaitUI(){
  analysisState.textContent='MISE EN FILE';
  analysisLayer.classList.add('busy');
  phoneScore.classList.remove('hidden');
  scoreNumber.textContent='—';
  timelineFill.classList.remove('indeterminate');
  timelineFill.style.width='0%';
  timelineLabel.textContent='Job';
  timelineText.textContent='mise en file…';
}
function jobLabel(status){
  return ({
    uploaded:'Upload',
    queued:'En file',
    processing:'Préparation',
    transcribing:'Transcription',
    analyzing:'Analyse',
    generating_report:'Rapport',
    planning:'Plan de montage',
    rendering:'Rendu',
    encoding:'Encodage',
    completed:'Terminé',
    failed:'Échec',
    cancelled:'Annulé'
  })[status]||String(status||'Traitement');
}
function updateJobUI(job){
  const pct=Math.max(0,Math.min(100,Number(job?.progress)||0));
  timelineFill.style.width=pct+'%';
  timelineLabel.textContent=jobLabel(job?.status);
  timelineText.textContent=job?.stage||`${pct}%`;
  analysisState.textContent=jobLabel(job?.status).toUpperCase();
}
async function pollProcessingJob(jobId){
  const deadline=Date.now()+30*60*1000;
  while(Date.now()<deadline){
    if(currentJobId!==jobId)throw new Error('Analyse remplacée par une nouvelle demande.');
    const rows=await supa('/rest/v1/processing_jobs',{
      query:`?select=id,status,progress,stage,result,error,error_code,updated_at&id=eq.${encodeURIComponent(jobId)}&limit=1`
    });
    const job=rows?.[0];
    if(!job)throw new Error('Job d’analyse introuvable.');
    updateJobUI(job);
    if(job.status==='completed')return job;
    if(job.status==='failed'||job.status==='cancelled'){
      const e=new Error(job.error||'Le traitement a échoué.');
      e.code=job.error_code||job.status;
      throw e;
    }
    await new Promise(resolve=>setTimeout(resolve,1200));
  }
  throw new Error('L’analyse prend plus de temps que prévu. Elle reste enregistrée dans ton compte.');
}
function normalizeAnalysisRow(row){
  const data={...(row?.result_json||{})};
  data.analysis_id=row?.id||data.analysis_id;
  data.video_id=row?.video_id||data.video_id||null;
  data.final_score=Number(row?.final_score??data.final_score??0);
  data.score_version=row?.score_version||data.score_version;
  data.model_used=row?.model_used||data.model_used;
  data.status=row?.status||data.status;
  if(Array.isArray(data.timeline)){
    data.timeline=data.timeline.map(x=>{
      if(x.time)return x;
      const s=Number(x.start_sec||0),e=Number(x.end_sec||s);
      return {...x,time:`${s.toFixed(1)}s → ${e.toFixed(1)}s`,status:x.status||x.severity,reason:x.reason||x.problem||x.correction};
    });
  }
  return data;
}
async function fetchAnalysisForJob(job){
  const analysisId=job?.result?.analysis_id;
  const filter=analysisId?`id=eq.${encodeURIComponent(analysisId)}`:`job_id=eq.${encodeURIComponent(job.id)}`;
  const rows=await supa('/rest/v1/viralplus_analyses',{
    query:`?select=id,video_id,created_at,video_name,final_score,status,is_reanalysis,baseline_analysis_id,score_version,model_used,result_json&${filter}&limit=1`
  });
  if(!rows?.[0])throw new Error('Rapport terminé mais résultat introuvable.');
  return normalizeAnalysisRow(rows[0]);
}
async function runAnalysis(){
  if(!currentFile||analyzing)return;
  if(!await ensureAuth())return;
  if(!storagePath||!currentVideoId){showToast('La vidéo n’est pas encore prête. Attends la fin de l’upload.');return}

  analyzing=true;
  analyzeBtn.disabled=true;
  analyzeBtn.textContent='Analyse en cours…';
  analysisWaitUI();
  track('analysis_started',{reanalysis:reanalysisMode,video_id:currentVideoId});

  try{
    if(!currentAnalysisIdempotencyKey){
      const suffix=reanalysisMode&&baselineAnalysis?.analysis_id?baselineAnalysis.analysis_id:'initial';
      currentAnalysisIdempotencyKey=`viral:${currentVideoId}:${suffix}`;
    }
    const payload={
      reanalysis:reanalysisMode,
      baseline_analysis_id:reanalysisMode&&baselineAnalysis?.analysis_id?baselineAnalysis.analysis_id:null
    };
    const created=await supa('/rest/v1/rpc/create_processing_job',{
      method:'POST',
      body:{
        p_kind:'viral_analysis',
        p_video_id:currentVideoId,
        p_payload:payload,
        p_idempotency_key:currentAnalysisIdempotencyKey
      }
    });
    const job=Array.isArray(created)?created[0]:created;
    if(!job?.id)throw new Error('Impossible de créer le job d’analyse.');
    currentJobId=job.id;
    updateJobUI(job);

    const finished=await pollProcessingJob(job.id);
    const data=await fetchAnalysisForJob(finished);
    currentAnalysis=data;
    if(data.video_id)currentVideoId=data.video_id;

    await animateScore(data.final_score||0);
    renderPhoneMetrics(data);
    renderResult(data);
    showResultLayer(data);
    resultEmpty.classList.add('hidden');
    resultContent.classList.remove('hidden');

    if(reanalysisMode&&baselineAnalysis)renderComparison(baselineAnalysis,data);
    else{
      baselineAnalysis=data;
      comparePanel.classList.add('hidden');
      metricDelta.classList.add('hidden');
    }

    analysisState.textContent='ANALYSE TERMINÉE';
    analyzeBtn.textContent='Analyse terminée';
    timelineFill.style.width='100%';
    burstSocial(lowPower?6:10);
    await refreshEntitlement();
    await loadHistory();
    track('analysis_completed',{
      score:data.final_score,
      reanalysis:reanalysisMode,
      score_version:data.score_version,
      job_id:job.id,
      video_id:currentVideoId
    });
  }catch(err){
    if(String(err?.message||'').includes('quota_exhausted'))await refreshEntitlement();
    currentAnalysisIdempotencyKey=null;
    track('analysis_failed',{message:String(err?.message||err).slice(0,300),reanalysis:reanalysisMode,job_id:currentJobId});
    showToast(err.message||'Échec de l’analyse.');
    analysisState.textContent='ERREUR';
    analyzeBtn.textContent='Réessayer';
    analyzeBtn.disabled=false;
  }finally{
    analysisLayer.classList.remove('busy');
    analyzing=false;
  }
}
analyzeBtn.addEventListener('click',runAnalysis);
function animateScore(target){return new Promise(resolve=>{const start=performance.now(),dur=800;function f(now){const t=Math.min(1,(now-start)/dur),v=Math.round(target*(1-Math.pow(1-t,3)));scoreNumber.textContent=v;if(t<1)requestAnimationFrame(f);else resolve()}requestAnimationFrame(f)})}
function renderPhoneMetrics(data){const s=data.scores||{};setCard(0,s.hook??s.spoken_hook??data.final_score,'Hook');setCard(1,s.retention??data.final_score,'Rétention');setCard(2,s.visual??s.visual_hook??data.final_score,'Visuel');setCard(3,s.scroll_stop??s.shareability??data.final_score,'Scroll stop');timelineFill.style.width=Math.max(8,data.final_score)+'%';timelineLabel.textContent='Score';timelineText.textContent=data.final_score+'/100'}
function statusFor(score){return score>=78?['Prête','Ta vidéo est prête à être publiée.','Le diagnostic est solide. Vérifie les dernières recommandations.']:score>=60?['Presque prête','Ta vidéo est proche d’une bonne version.','Quelques corrections ciblées peuvent encore renforcer la vidéo.']:['À retravailler','Ta vidéo n’est pas encore prête.','Corrige les points prioritaires avant publication.']}
function renderResult(data){const score=data.final_score||0,[status,title,text]=statusFor(score);resultScore.textContent=score;scoreOrb.style.setProperty('--scoreDeg',(score*3.6)+'deg');statusBadge.textContent=status;resultVerdictTitle.textContent=title;resultVerdictText.textContent=data.verdict||text;versionLine.textContent=`Score ${data.score_version||'non versionné'} · ${data.model_used||''}`;mainProblem.textContent=data.main_problem||'Le hook doit être renforcé.';mainWhy.textContent=data.why||'L’idée principale arrive trop tard.';const hot=(data.timeline||[]).find(x=>/red|orange/i.test(String(x.status)))||(data.timeline||[])[0]||{};hotspotTime.textContent=hot.time||'00:00 → 00:02';hotspotReason.textContent=hot.reason||hot.label||'Le début doit être renforcé.';hookBefore.textContent=data.detected_spoken_hook||data.detected_title_text||'Hook non détecté';hookAfter.textContent=data.recommended_hook||'Raccourcis l’ouverture et annonce immédiatement la promesse.';actionList.innerHTML='';(data.action_items||[]).forEach((item,i)=>{const el=document.createElement('div');el.className='actionItem';el.innerHTML=`<b>${i+1}</b><span>${escapeHtml(item)}</span>`;actionList.appendChild(el)});if((data.locked||[]).length){for(let i=0;i<3;i++){const ph=document.createElement('div');ph.className='lockedPlaceholder';actionList.appendChild(ph)}premiumTeaser.classList.remove('hidden')}else premiumTeaser.classList.add('hidden');}
function renderComparison(before,after){if(before.score_version!==after.score_version){comparePanel.classList.add('hidden');metricDelta.classList.remove('hidden');metricDelta.innerHTML='<span class="deltaChip">Comparaison non affichée : version de score différente.</span>';return}comparePanel.classList.remove('hidden');beforeScore.textContent=before.final_score+'/100';afterScore.textContent=after.final_score+'/100';const d=after.final_score-before.final_score;deltaScore.textContent=(d>=0?'+':'')+d+' points';const aliases={hook:'spoken_hook',scroll_stop:'shareability'};const keys=[['Hook','hook'],['Rétention','retention'],['Rythme','rhythm'],['Scroll stop','scroll_stop']];metricDelta.classList.remove('hidden');metricDelta.innerHTML=keys.map(([l,k])=>{const bv=Number(before.scores?.[k]??before.scores?.[aliases[k]]??0);const av=Number(after.scores?.[k]??after.scores?.[aliases[k]]??0);const x=av-bv;return `<span class="deltaChip">${l} <b>${x>=0?'+':''}${x}</b></span>`}).join('')}

$('reanalyseBtn').addEventListener('click',async()=>{if(!await ensureAuth())return;reanalysisMode=true;reanalyseInput.click()});
function openPaywall(){paywall.classList.remove('hidden')}$('upgradeBtn').addEventListener('click',openPaywall);$('closePaywall').addEventListener('click',()=>paywall.classList.add('hidden'));paywall.addEventListener('click',e=>{if(e.target===paywall)paywall.classList.add('hidden')});
$('requestCreator').addEventListener('click',async()=>{if(!await ensureAuth())return;try{await supa('/rest/v1/viralplus_upgrade_requests',{method:'POST',body:{user_id:session.user.id},prefer:'resolution=ignore-duplicates'});$('upgradeMessage').textContent='Demande enregistrée. Nous t’ajouterons à la bêta Creator.';track('upgrade_requested')}catch(e){$('upgradeMessage').textContent='Ta demande est déjà enregistrée.'}});

async function saveOutcome(){if(!currentAnalysis?.analysis_id){showToast('Analyse une vidéo avant d’enregistrer ses résultats.');return}const row={analysis_id:currentAnalysis.analysis_id,user_id:session.user.id,outcome_window:$('outcomeWindow').value,views:num('outViews'),shares:num('outShares'),saves:num('outSaves'),comments:num('outComments'),followers_gained:num('outFollowers')};try{await supa('/rest/v1/viralplus_outcomes',{method:'POST',body:row,prefer:'resolution=merge-duplicates,return=representation',query:'?on_conflict=analysis_id,outcome_window'});$('outcomeStatus').textContent='Résultat enregistré. Merci — ça aide Viral+ à devenir plus fiable.';track('outcome_saved',{window:row.outcome_window,views:row.views})}catch(e){$('outcomeStatus').textContent=e.message}}
function num(id){const v=$(id).value;return v===''?null:Number(v)}$('saveOutcome').addEventListener('click',saveOutcome);

async function loadHistory(){const grid=$('historyGrid');if(!session?.user){grid.innerHTML='<div class="historyEmpty">Connecte-toi pour retrouver tes analyses.</div>';return}try{const rows=await supa('/rest/v1/viralplus_analyses',{query:'?select=id,video_id,created_at,video_name,final_score,status,is_reanalysis,baseline_analysis_id,score_version,result_json&order=created_at.desc&limit=30'});if(!rows.length){grid.innerHTML='<div class="historyEmpty">Aucune analyse pour le moment.</div>';return}grid.innerHTML=rows.map(r=>`<article class="historyCard" data-id="${r.id}"><small>${new Date(r.created_at).toLocaleString('fr-FR')}</small><strong>${r.final_score}/100</strong><span>${escapeHtml(r.video_name)} · ${r.is_reanalysis?'Re-score':'Analyse'}</span></article>`).join('');grid.querySelectorAll('.historyCard').forEach(card=>card.addEventListener('click',()=>{const row=rows.find(x=>x.id===card.dataset.id);if(!row)return;const data={...(row.result_json||{}),analysis_id:row.id,video_id:row.video_id,final_score:row.final_score,score_version:row.score_version,status:row.status};currentAnalysis=data;currentVideoId=row.video_id||null;renderResult(data);showResultLayer(data);resultEmpty.classList.add('hidden');resultContent.classList.remove('hidden');document.getElementById('workspace').scrollIntoView({behavior:'smooth'});track('history_opened',{analysis_id:row.id})}))}catch(e){grid.innerHTML=`<div class="historyEmpty">${escapeHtml(e.message)}</div>`}}
$('refreshHistory').addEventListener('click',loadHistory);

(async function init(){await handleAuthCallback();if(!session)session=storedSession();if(session&&isExpired(session))await refreshSession();updateAccountUI();if(session?.user){await refreshEntitlement();await loadHistory();track('page_view',{path:location.pathname})}updateStage();tickCounters()})();

/* V8 functional multi-page analysis hub */
(function(){
  const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const num=v=>Math.max(0,Math.min(100,Math.round(Number(v)||0)));
  const metrics=[['Hook','hook'],['Rétention','retention'],['Visuel','visual'],['Scroll stop','scroll_stop']];
  async function runEditPlus(style='creator_clean',captionPreset='modern_bold'){
    if(!currentAnalysis?.analysis_id){showToast('Analyse Viral+ requise avant Edit+.');return}
    const videoId=currentAnalysis.video_id||currentVideoId;
    if(!videoId){showToast('Vidéo source introuvable.');return}
    if(!await ensureAuth())return;

    const buttons=[...document.querySelectorAll('.v8EditLaunch')];
    buttons.forEach(b=>{b.disabled=true;b.textContent='Préparation Edit+…'});
    track('edit_started',{analysis_id:currentAnalysis.analysis_id,video_id:videoId,style,caption_preset:captionPreset});

    try{
      const created=await jobsApi('edit',{
        method:'POST',
        body:{
          video_id:videoId,
          analysis_id:currentAnalysis.analysis_id,
          style,
          caption_preset:captionPreset
        }
      });
      const job=created?.job;
      if(!job?.id)throw new Error('Impossible de créer le montage Edit+.');

      currentJobId=job.id;
      analysisWaitUI();
      updateJobUI(job);
      let renderTracked=false;
      const deadline=Date.now()+45*60*1000;
      let finished=null;

      while(Date.now()<deadline){
        const state=await jobsApi('jobs/'+job.id);
        const live=state?.job;
        if(!live)throw new Error('Job Edit+ introuvable.');
        updateJobUI(live);
        if(!renderTracked&&(live.status==='rendering'||live.status==='encoding')){
          renderTracked=true;
          track('render_started',{job_id:job.id,style});
        }
        if(live.status==='completed'){finished=live;break}
        if(live.status==='failed'||live.status==='cancelled'){
          const err=new Error(live.error||'Le montage Edit+ a échoué.');
          err.code=live.error_code||live.status;
          throw err;
        }
        await new Promise(resolve=>setTimeout(resolve,1500));
      }
      if(!finished)throw new Error('Le render prend plus de temps que prévu. Il reste enregistré dans ton compte.');

      const exportId=finished.result?.export_id;
      const outputVideoId=finished.result?.output_video_id;
      if(!exportId||!outputVideoId)throw new Error('Render terminé mais export introuvable.');

      const access=await jobsApi('exports/'+exportId+'/url');
      if(!access?.signed_url)throw new Error('Impossible de préparer l’export.');

      track('render_completed',{job_id:job.id,export_id:exportId,style});
      showEditResult({
        url:access.signed_url,
        exportId,
        outputVideoId,
        style,
        captionPreset,
        jobId:job.id
      });
    }catch(err){
      track('render_failed',{message:String(err?.message||err).slice(0,300),style});
      showToast(err.message||'Échec Edit+.');
      buttons.forEach(b=>{b.disabled=false;b.textContent='Corriger avec Edit+ →'});
    }finally{
      analysisLayer.classList.remove('busy');
    }
  }

  function showEditResult(result){
    const existing=document.getElementById('v8EditResult');
    if(existing)existing.remove();
    const panel=document.createElement('div');
    panel.id='v8EditResult';
    panel.className='v8LabCard';
    panel.style.marginTop='18px';
    panel.innerHTML=
      '<span class="v8Kicker">EDIT+ TERMINÉ</span>'+
      '<h3>Ta version montée est prête.</h3>'+
      '<p>Style '+esc(result.style)+' · sous-titres '+esc(result.captionPreset)+'.</p>'+
      '<div class="v8Actions">'+
      '<a class="v8Action primary" id="v8OpenExport" href="'+esc(result.url)+'" target="_blank" rel="noopener">Ouvrir / enregistrer la vidéo</a>'+
      '<button class="v8Action" id="v8ReanalyseEdit">Ré-analyser avec Viral+</button>'+
      '</div>';
    const hubEl=document.getElementById('v8Hub');
    hubEl?.appendChild(panel);

    document.getElementById('v8OpenExport')?.addEventListener('click',()=>track('export_downloaded',{export_id:result.exportId,job_id:result.jobId}));
    document.getElementById('v8ReanalyseEdit')?.addEventListener('click',async()=>{
      try{
        const key='viral:'+result.outputVideoId+':'+currentAnalysis.analysis_id;
        const created=await supa('/rest/v1/rpc/create_processing_job',{
          method:'POST',
          body:{
            p_kind:'viral_analysis',
            p_video_id:result.outputVideoId,
            p_payload:{reanalysis:true,baseline_analysis_id:currentAnalysis.analysis_id,source:'editplus'},
            p_idempotency_key:key
          }
        });
        const job=Array.isArray(created)?created[0]:created;
        if(!job?.id)throw new Error('Impossible de lancer le re-score.');
        currentJobId=job.id;
        const finished=await pollProcessingJob(job.id);
        const data=await fetchAnalysisForJob(finished);
        currentVideoId=result.outputVideoId;
        currentAnalysis=data;
        await animateScore(data.final_score||0);
        renderPhoneMetrics(data);
        renderResult(data);
        showResultLayer(data);
        hub(data);
        track('analysis_completed',{score:data.final_score,reanalysis:true,source:'editplus',job_id:job.id});
      }catch(err){
        showToast(err.message||'Échec du re-score.');
      }
    });

    panel.scrollIntoView({behavior:'smooth',block:'nearest'});
  }

  function hub(data){
    if(!resultContent||!data)return;
    let el=document.getElementById('v8Hub');
    if(!el){el=document.createElement('div');el.id='v8Hub';el.className='v8Hub';resultContent.appendChild(el)}
    const score=num(data.final_score), s=data.scores||{}, tl=Array.isArray(data.timeline)?data.timeline:[], hot=tl.find(x=>/red|orange/i.test(String(x.status)))||tl[0]||{};
    const before=data.detected_spoken_hook||data.detected_title_text||'Hook non détecté';
    const after=data.recommended_hook||'Raccourcis l’ouverture et rends la promesse immédiate.';
    const acts=(data.action_items||[]).slice(0,5);
    const bars=tl.length?tl.map((x,i)=>'<i class="v8Seg '+(/red|orange/i.test(String(x.status))?'hot':'')+'" style="height:'+Math.max(14,num(x.score||x.attention||50)*.58)+'%" title="'+esc(x.time||('Point '+(i+1)))+'"></i>').join(''):'<i class="v8Seg hot" style="height:35%"></i><i class="v8Seg" style="height:58%"></i><i class="v8Seg" style="height:72%"></i><i class="v8Seg" style="height:48%"></i><i class="v8Seg" style="height:62%"></i>';
    const cards=metrics.map(m=>{const v=num(s[m[1]]);return '<button class="v8Mini v8Metric" data-page="diagnostic"><span>'+m[0]+'</span><strong>'+v+'</strong><div class="v8Bar"><i style="width:'+v+'%"></i></div></button>'}).join('');
    const rows=acts.length?acts.map((a,i)=>'<div class="v8Rule"><b>0'+(i+1)+'</b><span>'+esc(a)+'</span></div>').join(''):'<div class="v8Rule"><b>01</b><span>Renforce l’ouverture et supprime le détour avant la promesse.</span></div>';
    el.innerHTML=
      '<div class="v8HubTop"><div><div class="v8Brandline"><i class="v8BrandDot"></i>VIRAL+</div><div class="v8Live">CREATOR INTELLIGENCE · ANALYSE ACTIONNABLE</div></div><div class="v8Live">SCORE '+esc(data.score_version||'stable')+'</div></div>'+
      '<div class="v8Tabs"><button class="v8Tab active" data-tab="overview">Vue d’ensemble</button><button class="v8Tab" data-tab="diagnostic">Diagnostic</button><button class="v8Tab" data-tab="hook">Hook Lab</button><button class="v8Tab" data-tab="structure">Structure</button><button class="v8Tab" data-tab="rescore">Re-score</button></div>'+
      '<section class="v8Page active" data-page="overview"><div class="v8HeroResult"><div class="v8ScoreCard"><div class="v8ScoreRing" style="--v8deg:'+score*3.6+'deg"><div><div><strong>'+score+'</strong><small>/100</small></div></div></div><div class="v8ScoreLabel">POTENTIEL VIRAL+ · HEURISTIQUE</div></div><div class="v8Problem"><div><span class="v8Kicker">BLOCAGE PRINCIPAL</span><h3>'+esc(data.main_problem||'Le hook doit être renforcé.')+'</h3><p>'+esc(data.why||'La tension ou la promesse arrive trop tard.')+'</p><div class="v8Hotspot"><b>'+esc(hot.time||'00:00 → 00:02')+'</b><span>'+esc(hot.reason||hot.label||'Zone prioritaire')+'</span></div></div><div class="v8Actions"><button class="v8Action primary v8EditLaunch">Corriger avec Edit+ →</button><button class="v8Action" data-page="hook">Hook Lab</button><button class="v8Action" data-page="diagnostic">Voir les preuves</button></div></div></div><div class="v8SectionTitle"><div><h3>Les signaux qui tirent le score</h3><p>Chaque carte ouvre le diagnostic correspondant.</p></div></div><div class="v8MetricGrid">'+cards+'</div><div class="v8Disclaimer">Viral+ utilise des signaux observables et des heuristiques propriétaires. Il ne reproduit pas l’algorithme privé de Meta et ne promet pas la viralité.</div></section>'+
      '<section class="v8Page" data-page="diagnostic"><div class="v8SectionTitle"><div><h3>Où la vidéo perd de la force</h3><p>Le diagnostic priorise ce que tu peux réellement modifier.</p></div></div><div class="v8Timeline"><div class="v8TimelineRow">'+bars+'</div><div class="v8TimelineLegend"><span>Début</span><span>Milieu</span><span>Fin</span></div></div><div class="v8Lab"><div class="v8LabCard"><span class="v8Kicker">À FAIRE MAINTENANT</span><h3>Corrections prioritaires</h3>'+rows+'</div><div class="v8LabCard"><span class="v8Kicker">MOMENT CRITIQUE</span><h3>'+esc(hot.time||'00:00 → 00:02')+'</h3><p>'+esc(hot.reason||hot.label||'Cette zone concentre la priorité de correction.')+'</p><div class="v8Actions"><button class="v8Action primary" data-page="hook">Ouvrir Hook Lab</button></div></div></div></section>'+
      '<section class="v8Page" data-page="hook"><div class="v8SectionTitle"><div><h3>Hook Lab</h3><p>Une formulation concrète à tester, pas juste une note.</p></div></div><div class="v8HookGrid"><article class="v8Hook before"><label>ACTUEL</label><p>'+esc(before)+'</p></article><article class="v8Hook after"><label>VERSION À TESTER</label><p>'+esc(after)+'</p></article></div><div class="v8Actions"><button class="v8Action primary" id="v8ReanalyseHook">J’ai corrigé → Re-scorer</button><button class="v8Action" data-page="rescore">Comparer les versions</button></div></section>'+
      '<section class="v8Page" data-page="structure"><div class="v8SectionTitle"><div><h3>Structure</h3><p>Supprimer les secondes faibles et renforcer la promesse.</p></div></div><div class="v8Lab"><div class="v8LabCard"><span class="v8Kicker">CE QUE VIRAL+ CHERCHE</span><h3>Une séquence qui mérite de rester</h3><div class="v8Rule"><b>01</b><span>Hook compréhensible sans contexte.</span></div><div class="v8Rule"><b>02</b><span>Promesse tenue rapidement.</span></div><div class="v8Rule"><b>03</b><span>Preuve, tension ou utilité qui justifie de rester.</span></div><div class="v8Rule"><b>04</b><span>Moment naturellement partageable.</span></div></div><div class="v8LabCard"><span class="v8Kicker">PROCHAINE ACTION</span><h3>Transforme le diagnostic</h3><div class="v8Rule"><b>↗</b><span>Coupe autour du hotspot.</span></div><div class="v8Rule"><b>↗</b><span>Teste le Hook Lab.</span></div><div class="v8Rule"><b>↗</b><span>Reviens lancer un re-score.</span></div><div style="display:grid;gap:10px;margin-top:18px"><select id="v8EditStyle" class="v8Action"><option value="creator_clean">Creator Clean</option><option value="codie">Codie</option><option value="business_viral">Business Viral</option><option value="podcast_authority">Podcast / Authority</option></select><select id="v8CaptionPreset" class="v8Action"><option value="modern_bold">Modern Bold</option><option value="minimal">Minimal</option><option value="creator">Creator</option><option value="karaoke">Karaoke</option><option value="authority">Authority</option><option value="ugc">UGC</option></select><button class="v8Action primary v8EditLaunch">Corriger avec Edit+ →</button></div></div></div></section>'+
      '<section class="v8Page" data-page="rescore"><div class="v8SectionTitle"><div><h3>Re-score</h3><p>Mesure l’écart entre ta version de départ et ta version corrigée.</p></div></div><div class="v8ReScore"><div class="v8Version"><small>VERSION DE DÉPART</small><strong>'+num(baselineAnalysis?.final_score||score)+'</strong><span>/100</span></div><div class="v8Arrow">→</div><div class="v8Version after"><small>VERSION ACTUELLE</small><strong>'+score+'</strong><span>/100</span></div></div><div class="v8Actions"><button class="v8Action primary" id="v8Reanalyse">Importer ma version corrigée</button><button class="v8Action" data-page="overview">Retour au diagnostic</button></div><div class="v8Disclaimer">Une hausse du score signifie que la version correspond mieux aux critères Viral+. Elle ne garantit pas une hausse réelle des vues.</div></section>';
    function tab(name){el.querySelectorAll('.v8Tab').forEach(x=>x.classList.toggle('active',x.dataset.tab===name));el.querySelectorAll('.v8Page').forEach(x=>x.classList.toggle('active',x.dataset.page===name))}
    el.querySelectorAll('.v8Tab').forEach(x=>x.onclick=()=>tab(x.dataset.tab));
    el.querySelectorAll('[data-page]').forEach(x=>x.onclick=()=>{if(x.dataset.page)tab(x.dataset.page)});
    const re=el.querySelector('#v8Reanalyse,#v8ReanalyseHook');if(re)re.onclick=()=>document.getElementById('reanalyseBtn')?.click();
    el.querySelectorAll('.v8EditLaunch').forEach(btn=>btn.addEventListener('click',e=>{
      e.preventDefault();
      e.stopPropagation();
      const style=el.querySelector('#v8EditStyle')?.value||'creator_clean';
      const caption=el.querySelector('#v8CaptionPreset')?.value||'modern_bold';
      runEditPlus(style,caption);
    }));
  }
  let last=null;
  setInterval(()=>{if(currentAnalysis&&currentAnalysis.analysis_id!==last){last=currentAnalysis.analysis_id;hub(currentAnalysis)}},300);
})();

/* ===== VIRAL+ / OMNI IMMERSIVE V9 — interaction override ===== */
(function(){
  const hero=$('heroAnalyse'), portal=$('sphere'), analyse=$('navAnalyse');
  const sceneCopy=[...document.querySelectorAll('.copy')];
  function revealUpload(){
    if(typeof showAnalysisLayer==='function') showAnalysisLayer();
    document.querySelector('.phone')?.classList.add('portalActive');
    const target=Math.max(0, cinematic.offsetTop + cinematic.offsetHeight*.20);
    window.scrollTo({top:target,behavior:reduceMotion?'auto':'smooth'});
    setTimeout(function(){try{if(fileInput&&fileInput.showPicker)fileInput.showPicker();else if(fileInput)fileInput.click()}catch(e){try{if(fileInput)fileInput.click()}catch(e2){}}},420);
  }
  if(hero) hero.onclick=revealUpload;
  if(analyse) analyse.onclick=revealUpload;
  if(portal){portal.style.cursor='pointer';portal.addEventListener('click',revealUpload)}

  updateStage=function(){
    const p=stageProgress();
    if(scrollFill) scrollFill.style.height=(p*100)+'%';
    if(resultMode){sceneCopy.forEach(function(_,i){setCopy(i,0)});if(stageResultCta)stageResultCta.classList.remove('hidden');return}
    if(stageResultCta)stageResultCta.classList.add('hidden');

    let active=0;
    if(p>=.19&&p<.39)active=1;
    else if(p>=.39&&p<.59)active=2;
    else if(p>=.59&&p<.79)active=3;
    else if(p>=.79)active=4;

    sceneCopy.forEach(function(_,i){setCopy(i,i===active?1:0)});
    if(sceneCopy[active]){
      sceneCopy[active].style.left='50%';
      sceneCopy[active].style.top=active===0?'43%':'50%';
      sceneCopy[active].style.transform='translate3d(-50%,-50%,0)';
    }

    const scale=active===0?1:mix(1,.72,clamp((p-.18)/.7));
    if(phoneRig){
      phoneRig.style.transform='translate3d(-50%,calc(-50% - '+(active===0?0:-8)+'px),0) scale('+scale+')';
      phoneRig.style.opacity=String(mix(1,.72,clamp((p-.18)/.75)));
    }
    if(phone){
      const rotY=active===0?-7:mix(-7,14,clamp((p-.18)/.82));
      const rotZ=active===0?-2:mix(-2,4,clamp((p-.18)/.82));
      phone.style.transform='rotateY('+rotY+'deg) rotateX(4deg) rotateZ('+rotZ+'deg)';
    }
    if(sphere){
      const s=active===0?1:mix(1,.62,clamp((p-.15)/.85));
      sphere.style.transform='translate(-50%,-50%) scale('+s+') rotate('+(p*90)+'deg)';
      sphere.style.opacity=String(mix(.8,.42,p));
    }
    if(halo){
      halo.style.opacity=String(mix(.9,.35,p));
      halo.style.transform='translate(-50%,-50%) scale('+mix(1,.72,p)+')';
    }
    if(orbit1)orbit1.style.transform='translate(-50%,-50%) rotate('+(p*260)+'deg) scale('+mix(1,1.08,p)+')';
    if(orbit2)orbit2.style.transform='translate(-50%,-50%) rotate('+(-p*180)+'deg)';

    if(p>.24&&p<.36&&!analyzing)showAnalysisLayer();
    else if(p<.18&&!analyzing&&!resultMode)showSocialLayer();
    if(scrollHint)scrollHint.style.opacity=String(1-seg(p,.02,.10));
  };
  requestStage();
})();
