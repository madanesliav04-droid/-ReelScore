const $ = id => document.getElementById(id);
const SUPABASE_URL = String(window.VIRAL_SUPABASE_URL || '').replace(/\/$/,'');
const SUPABASE_KEY = String(window.VIRAL_SUPABASE_KEY || '');
const API_URL = String(window.VIRAL_API_URL || '').replace(/\/$/,'');
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

let session=null, entitlement=null, authMode='login', lastHoverBurst=0, pendingFile=null, pendingReanalysis=false, currentVideoSha256=null;
let currentFile=null, objectUrl=null, currentAnalysis=null, baselineAnalysis=null, reanalysisMode=false, analyzing=false, counterTimer=0, scrollRAF=0, mouseRAF=0, resultMode=false, storagePath=null, storageUpload=null, uploadGeneration=0, analysisStartedAt=0, analysisProgressTimer=null;

function clamp(v,a=0,b=1){return Math.max(a,Math.min(b,v))}\nasync function sha256File(file){
  const buffer=await file.arrayBuffer();
  const digest=await crypto.subtle.digest('SHA-256',buffer);
  return [...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,'0')).join('');
}

function mix(a,b,t){return a+(b-a)*t}
function ease(t){return t<.5?2*t*t:1-Math.pow(-2*t+2,2)/2}
function seg(p,a,b){return clamp((p-a)/(b-a))}
function fmt(n){return n>=1000?(n/1000).toFixed(n>=10000?0:1).replace('.0','')+'K':String(n)}
function setCard(i,score,note){cards[i].querySelector('strong').textContent=Math.round(Number(score)||0);cards[i].querySelector('small').textContent=note||''}
function showToast(msg){toast.textContent=msg;toast.classList.remove('hidden');clearTimeout(showToast.t);showToast.t=setTimeout(()=>toast.classList.add('hidden'),3400)}
function escapeHtml(s){return String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[m]))}

function stageProgress(){const r=cinematic.getBoundingClientRect(), total=cinematic.offsetHeight-innerHeight;return clamp(-r.top/Math.max(1,total))}
function setCopy(index,opacity,dx=0,dy=0){const el=copies[index];if(!el)return;el.style.opacity=String(opacity);el.style.transform=`translate3d(${dx}px,calc(-50% + ${dy}px),0)`;el.style.pointerEvents=opacity>.7?'auto':'none'}
function updateStage(){
  const p=stageProgress(); scrollFill.style.height=(p*100)+'%';
  if(resultMode){ copies.forEach((_,i)=>setCopy(i,0)); stageResultCta.classList.remove('hidden'); return; }
  stageResultCta.classList.add('hidden');
  const phase0=1-seg(p,.08,.18), phase1=Math.min(seg(p,.14,.23),1-seg(p,.28,.36)), phase2=Math.min(seg(p,.34,.43),1-seg(p,.48,.57)), phase3=Math.min(seg(p,.55,.63),1-seg(p,.68,.76)), phase4=seg(p,.76,.88);
  setCopy(0,phase0,0,-20*seg(p,.08,.18)); setCopy(1,phase1); setCopy(2,phase2); setCopy(3,phase3); setCopy(4,phase4);

  let x=19,y=-50,ry=-16,rx=6,rz=-2,scale=1;
  if(p<.22){const t=ease(seg(p,0,.22));x=mix(19,10,t);ry=mix(-16,18,t);scale=mix(1,.92,t)}
  else if(p<.46){const t=ease(seg(p,.22,.46));x=mix(10,0,t);y=mix(-50,-54,t);ry=mix(18,0,t);rz=mix(-2,90,t);scale=mix(.92,1.22,t)}
  else if(p<.68){const t=ease(seg(p,.46,.68));x=mix(0,-18,t);y=mix(-54,-59,t);ry=mix(0,-30,t);rz=mix(90,0,t);scale=mix(1.22,.76,t)}
  else {const t=ease(seg(p,.68,.88));x=mix(-18,0,t);y=mix(-59,-50,t);ry=mix(-30,0,t);rx=mix(6,0,t);rz=0;scale=mix(.76,1.03,t)}
  if(lowPower){x*=.58;scale=Math.min(scale,1.06)}
  phoneRig.style.transform=`translate3d(calc(-50% + ${x}vw),${y}%,0) scale(${scale})`;
  phone.style.transform=`rotateY(${ry}deg) rotateX(${rx}deg) rotateZ(${rz}deg)`;

  const gridIn=seg(p,.31,.44), gridOut=1-seg(p,.65,.78); mediaGrid.style.opacity=String(Math.min(gridIn,gridOut)); mediaGrid.style.transform=`translate(-50%,-50%) scale(${mix(.78,1.08,gridIn)}) rotate(${mix(-4,3,gridIn)}deg)`;
  const sphIn=seg(p,.50,.62), sphOut=1-seg(p,.72,.84); sphere.style.opacity=String(Math.min(sphIn,sphOut)); sphere.style.transform=`translate(-50%,-50%) scale(${mix(0,1,sphIn)})`;
  halo.style.opacity=String(mix(1,.45,seg(p,.42,.72))); orbit1.style.transform=`translate(-50%,-50%) rotate(${p*170}deg)`; orbit2.style.transform=`translate(-50%,-50%) rotate(${-p*110}deg)`;

  const socialFade=1-seg(p,.12,.34); badges.forEach((b,i)=>{b.style.opacity=String(socialFade);b.style.transform=`translate3d(${(i%2?1:-1)*p*45}px,${p*20}px,0)`});
  const metricOpacity=p<.72?Math.max(.15,1-seg(p,.10,.35)):seg(p,.72,.84);floats.forEach((f,i)=>{f.style.opacity=String(metricOpacity);f.style.transform=`translateY(${Math.sin(p*6+i)*8}px)`});

  if(p>.76){showAnalysisLayer()} else if(!analyzing){showSocialLayer()}
  scrollHint.style.opacity=String(1-seg(p,.04,.16));
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
async function track(name,properties={}){if(!session?.user)return;try{await supa('/rest/v1/viralplus_events',{method:'POST',body:{user_id:session.user.id,event_name:name,properties}})}catch{}}
async function refreshEntitlement(){if(!session?.user)return;try{const d=await supa('/rest/v1/rpc/viralplus_get_entitlement',{method:'POST',body:{}});entitlement=Array.isArray(d)?d[0]:d;if(entitlement){usagePill.classList.remove('hidden');const days=entitlement.trial_active&&entitlement.trial_ends_at?Math.max(0,Math.ceil((new Date(entitlement.trial_ends_at)-Date.now())/86400000)):0;usagePill.textContent=entitlement.trial_active?`ESSAI · ${days} j · ${entitlement.remaining}/${entitlement.analysis_limit}`:`${String(entitlement.plan).toUpperCase()} · ${entitlement.remaining}/${entitlement.analysis_limit} analyses`}}catch(e){console.warn(e)}}

function openAuth(){authModal.classList.remove('hidden')}
function closeAuth(){authModal.classList.add('hidden')}
async function processPendingFile(){if(pendingFile&&session?.user){const f=pendingFile,r=pendingReanalysis;pendingFile=null;pendingReanalysis=false;setFile(f,r)}}
async function ensureAuth(){if(session?.user&&await getToken())return true;openAuth();return false}
[...document.querySelectorAll('.authTabs button')].forEach(b=>b.addEventListener('click',()=>{authMode=b.dataset.auth;document.querySelectorAll('.authTabs button').forEach(x=>x.classList.toggle('active',x===b));$('authSubmit').textContent=authMode==='login'?'Se connecter':'Créer mon compte';$('authMessage').textContent=''}));
$('authForm').addEventListener('submit',async e=>{e.preventDefault();const email=$('authEmail').value.trim(),password=$('authPassword').value;const msg=$('authMessage');msg.textContent='Connexion…';try{if(authMode==='signup'){const d=await supa('/auth/v1/signup',{method:'POST',auth:false,body:{email,password,options:{emailRedirectTo:authRedirectUrl()}}});if(d.access_token){d.expires_at=Math.floor(Date.now()/1000)+(d.expires_in||3600);saveSession(d);closeAuth();await refreshEntitlement();await loadHistory();showToast('Compte créé. Bienvenue dans Viral+.');await processPendingFile()}else{msg.textContent='Compte créé. Vérifie ton email. Le lien te ramènera automatiquement ici.'}}else{const d=await supa('/auth/v1/token',{method:'POST',auth:false,query:'?grant_type=password',body:{email,password}});d.expires_at=Math.floor(Date.now()/1000)+(d.expires_in||3600);saveSession(d);closeAuth();await refreshEntitlement();await loadHistory();track('login');showToast('Connecté à Viral+.');await processPendingFile()}}catch(err){msg.textContent=err.message}});
$('closeAuth').addEventListener('click',closeAuth);authModal.addEventListener('click',e=>{if(e.target===authModal)closeAuth()});
accountBtn.addEventListener('click',async()=>{if(!session?.user){openAuth();return}if(confirm(`Déconnecter ${session.user.email} ?`)){saveSession(null);entitlement=null;loadHistory();showToast('Déconnecté.')}});

async function scrollToAnalysis(){const ok=await ensureAuth();const target=cinematic.offsetTop+(cinematic.offsetHeight-innerHeight)*.87;scrollTo({top:target,behavior:'smooth'});if(ok)track('analyse_clicked')}
['heroAnalyse','navAnalyse','resultStart','finalAnalyse'].forEach(id=>$(id).addEventListener('click',scrollToAnalysis));$('heroScroll').addEventListener('click',()=>scrollTo({top:cinematic.offsetTop+innerHeight*.85,behavior:'smooth'}));$('brandHome').addEventListener('click',()=>scrollTo({top:0,behavior:'smooth'}));$('phoneImprove').addEventListener('click',()=>document.getElementById('workspace').scrollIntoView({behavior:'smooth'}));stageResultCta.addEventListener('click',()=>document.getElementById('workspace').scrollIntoView({behavior:'smooth'}));$('historyNav').addEventListener('click',()=>document.getElementById('history').scrollIntoView({behavior:'smooth'}));

async function uploadVideoToStorage(file,generation){
  const token=await getToken();
  if(!token) throw new Error('Session expirée. Reconnecte-toi.');
  const safeBase=(file.name||'video.mp4').replace(/[^a-zA-Z0-9._-]/g,'_').slice(-100);
  const path=`${session.user.id}/${Date.now()}-${Math.random().toString(36).slice(2,10)}-${safeBase}`;
  analyzeBtn.disabled=true;
  analyzeBtn.textContent='Upload 0%…';
  analysisState.textContent='UPLOAD DE LA VIDÉO';
  return new Promise((resolve,reject)=>{
    const xhr=new XMLHttpRequest();
    const endpoint=`${SUPABASE_URL}/storage/v1/object/viralplus-videos/${path.split('/').map(encodeURIComponent).join('/')}`;
    xhr.open('POST',endpoint,true);
    xhr.setRequestHeader('Authorization',`Bearer ${token}`);
    xhr.setRequestHeader('apikey',SUPABASE_KEY);
    xhr.setRequestHeader('Content-Type',file.type||'video/mp4');
    xhr.setRequestHeader('x-upsert','true');
    xhr.upload.onprogress=(e)=>{
      if(generation!==uploadGeneration)return;
      if(!e.lengthComputable)return;
      const pct=Math.max(0,Math.min(100,Math.round(e.loaded/e.total*100)));
      analyzeBtn.textContent=`Upload ${pct}%…`;
      timelineLabel.textContent='Upload';
      timelineText.textContent=`${pct}%`;
      timelineFill.style.width=pct+'%';
    };
    xhr.onerror=()=>{if(generation===uploadGeneration)reject(new Error('Échec de l’upload. Vérifie ta connexion puis réessaie.'))};
    xhr.onabort=()=>{if(generation===uploadGeneration)reject(new Error('Upload interrompu.'))};
    xhr.onload=async()=>{
      if(generation!==uploadGeneration)return;
      let d={};try{d=JSON.parse(xhr.responseText||'{}')}catch{}
      if(xhr.status<200||xhr.status>=300){
        reject(new Error(d.message||d.error||`Échec de l’upload (${xhr.status}).`));
        return;
      }
      try{
        const parts=path.split('/').map(encodeURIComponent).join('/');
        const r=await fetch(`${SUPABASE_URL}/storage/v1/object/sign/viralplus-videos/${parts}`,{
          method:'POST',
          headers:{apikey:SUPABASE_KEY,Authorization:`Bearer ${token}`,'Content-Type':'application/json'},
          body:JSON.stringify({expiresIn:900})
        });
        const sd=await r.json().catch(()=>({}));
        if(!r.ok||!sd.signedURL)throw new Error(sd.message||sd.error||'Impossible de préparer l’analyse.');
        storagePath=path;
        resolve(sd.signedURL.startsWith('http')?sd.signedURL:`${SUPABASE_URL}/storage/v1${sd.signedURL}`);
      }catch(e){reject(e)}
    };
    storageUpload={abort:()=>xhr.abort()};
    xhr.send(file);
  });
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
  if(file.size>100*1024*1024){showToast('Vidéo trop lourde : 100 Mo maximum.');return}
  if(!session?.user){pendingFile=file;pendingReanalysis=isReanalysis;openAuth();return}
  uploadGeneration++;
  if(storageUpload){try{storageUpload.abort(true)}catch{}}
  if(objectUrl)URL.revokeObjectURL(objectUrl);
  objectUrl=URL.createObjectURL(file);
  currentFile=file;
  currentVideoSha256=null;
  storagePath=null;
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
reanalyseInput.addEventListener('change',e=>{setFile(e.target.files?.[0],true);e.target.value=''});
['dragenter','dragover'].forEach(evt=>dropzone.addEventListener(evt,e=>{e.preventDefault();dropzone.classList.add('dragover')}));
['dragleave','drop'].forEach(evt=>dropzone.addEventListener(evt,e=>{e.preventDefault();dropzone.classList.remove('dragover')}));
dropzone.addEventListener('drop',e=>setFile(e.dataTransfer.files?.[0],false));
$('changeVideo').addEventListener('click',e=>{e.preventDefault();e.stopPropagation();fileInput.click()});

function fakeProgress(){
  analysisState.textContent='ANALYSE VIDÉO RÉELLE';
  analysisLayer.classList.add('busy');
  phoneScore.classList.remove('hidden');
  scoreNumber.textContent='—';
  timelineFill.classList.add('indeterminate');
  timelineFill.style.width='32%';
  timelineLabel.textContent='Analyse';
  analysisStartedAt=Date.now();
  const steps=[
    [0,'PRÉPARATION DU DIAGNOSTIC'],
    [3500,'LECTURE AUDIO + VISUEL'],
    [9000,'DÉTECTION DU HOOK'],
    [16000,'ANALYSE DE LA STRUCTURE'],
    [24000,'ÉVALUATION DU POTENTIEL DE PARTAGE'],
    [32000,'CONSTRUCTION DU DIAGNOSTIC'],
    [45000,'FINALISATION DU SCORE']
  ];
  steps.forEach(([ms,label])=>setTimeout(()=>{if(analyzing){analysisState.textContent=label;timelineText.textContent=label.toLowerCase()}},ms));
  clearInterval(analysisProgressTimer);
  analysisProgressTimer=setInterval(()=>{
    if(!analyzing)return;
    const elapsed=Math.floor((Date.now()-analysisStartedAt)/1000);
    timelineText.textContent=`analyse en cours · ${elapsed}s`;
    analysisState.textContent=elapsed>45?'LE MOTEUR FINALISE LE DIAGNOSTIC':'ANALYSE VIDÉO RÉELLE';
  },1000);
  return [];
}
function clearTimers(ts){ts.forEach(clearTimeout);clearInterval(analysisProgressTimer);analysisProgressTimer=null}
async function runAnalysis(){
  if(!currentFile||analyzing)return;
  if(!await ensureAuth())return;
  const token=await getToken();if(!token)return;
  if(!storagePath){showToast('La vidéo n’est pas encore prête. Attends la fin de l’upload.');return}
  if(!currentVideoSha256){
    try{currentVideoSha256=await sha256File(currentFile)}catch{showToast('Impossible de préparer l’empreinte vidéo. Réessaie.');return}
  }
  analyzing=true;analyzeBtn.disabled=true;analyzeBtn.textContent='Analyse en cours…';
  track('analysis_started',{reanalysis:reanalysisMode});
  const timers=fakeProgress();
  try{
    const signedParts=storagePath.split('/').map(encodeURIComponent).join('/');
    const sr=await fetch(`${SUPABASE_URL}/storage/v1/object/sign/viralplus-videos/${signedParts}`,{
      method:'POST',headers:{apikey:SUPABASE_KEY,Authorization:`Bearer ${token}`,'Content-Type':'application/json'},
      body:JSON.stringify({expiresIn:900})
    });
    const sd=await sr.json().catch(()=>({}));
    if(!sr.ok||!sd.signedURL)throw new Error(sd.message||sd.error||'Impossible de préparer la vidéo.');
    const signedUrl=sd.signedURL.startsWith('http')?sd.signedURL:`${SUPABASE_URL}/storage/v1${sd.signedURL}`;
    const headers={
      Authorization:`Bearer ${token}`,
      'Content-Type':'application/json',
      'X-File-Name':encodeURIComponent(currentFile.name||'video.mp4'),
      'X-File-Size':String(currentFile.size),
      'X-Video-Mime-Type':currentFile.type||'video/mp4',
      'X-Video-SHA256':currentVideoSha256,
      'X-Reanalysis':reanalysisMode?'1':'0'
    };
    if(reanalysisMode&&baselineAnalysis?.analysis_id)headers['X-Baseline-Analysis-Id']=baselineAnalysis.analysis_id;
    let r=await fetch(`${API_URL}/analyze`,{method:'POST',headers,body:JSON.stringify({storage_url:signedUrl,video_sha256:currentVideoSha256})});
    if(r.status===401&&await refreshSession()){
      headers.Authorization=`Bearer ${session.access_token}`;
      r=await fetch(`${API_URL}/analyze`,{method:'POST',headers,body:JSON.stringify({storage_url:signedUrl,video_sha256:currentVideoSha256})});
    }
    const data=await r.json().catch(()=>({}));
    if(!r.ok){
      if(data.code==='CREATOR_REQUIRED'||data.code==='QUOTA_EXHAUSTED'){openPaywall();await refreshEntitlement()}
      throw new Error(data.error||`Erreur ${r.status}`);
    }
    clearTimers(timers);timelineFill.classList.remove('indeterminate');currentAnalysis=data;
    await animateScore(data.final_score||0);renderPhoneMetrics(data);renderResult(data);showResultLayer(data);
    resultEmpty.classList.add('hidden');resultContent.classList.remove('hidden');
    if(reanalysisMode&&baselineAnalysis)renderComparison(baselineAnalysis,data);
    else{baselineAnalysis=data;comparePanel.classList.add('hidden');metricDelta.classList.add('hidden')}
    analysisState.textContent='ANALYSE TERMINÉE';analyzeBtn.textContent='Analyse terminée';burstSocial(lowPower?6:10);
    await refreshEntitlement();await loadHistory();
    track('analysis_completed',{score:data.final_score,reanalysis:reanalysisMode,score_version:data.score_version});
    try{
      const parts=storagePath.split('/').map(encodeURIComponent).join('/');
      await fetch(`${SUPABASE_URL}/storage/v1/object/viralplus-videos/${parts}`,{method:'DELETE',headers:{apikey:SUPABASE_KEY,Authorization:`Bearer ${token}`}});
    }catch{}
    storagePath=null;
  }catch(err){
    showToast(err.message);analysisState.textContent='ERREUR';analyzeBtn.textContent='Réessayer';analyzeBtn.disabled=false;
  }finally{clearTimers(timers);timelineFill.classList.remove('indeterminate');analysisLayer.classList.remove('busy');analyzing=false}
}
analyzeBtn.addEventListener('click',runAnalysis);
function animateScore(target){return new Promise(resolve=>{const start=performance.now(),dur=800;function f(now){const t=Math.min(1,(now-start)/dur),v=Math.round(target*(1-Math.pow(1-t,3)));scoreNumber.textContent=v;if(t<1)requestAnimationFrame(f);else resolve()}requestAnimationFrame(f)})}
function renderPhoneMetrics(data){const s=data.scores||{};setCard(0,s.spoken_hook??data.final_score,'Hook parlé');setCard(1,s.retention??data.final_score,'Rétention');setCard(2,s.visual_hook??data.final_score,'Hook visuel');setCard(3,s.shareability??data.final_score,'Partage');timelineFill.style.width=Math.max(8,data.final_score)+'%';timelineLabel.textContent='Score';timelineText.textContent=data.final_score+'/100'}
function statusFor(score){return score>=78?['Prête','Ta vidéo est prête à être publiée.','Le diagnostic est solide. Vérifie les dernières recommandations.']:score>=60?['Presque prête','Ta vidéo est proche d’une bonne version.','Quelques corrections ciblées peuvent encore renforcer la vidéo.']:['À retravailler','Ta vidéo n’est pas encore prête.','Corrige les points prioritaires avant publication.']}
function renderResult(data){const score=data.final_score||0,[status,title,text]=statusFor(score);resultScore.textContent=score;scoreOrb.style.setProperty('--scoreDeg',(score*3.6)+'deg');statusBadge.textContent=status;resultVerdictTitle.textContent=title;resultVerdictText.textContent=data.verdict||text;versionLine.textContent=`Score ${data.score_version||'non versionné'} · ${data.model_used||''}`;mainProblem.textContent=data.main_problem||'Le hook doit être renforcé.';mainWhy.textContent=data.why||'L’idée principale arrive trop tard.';const hot=(data.timeline||[]).find(x=>/red|orange/i.test(String(x.status)))||(data.timeline||[])[0]||{};hotspotTime.textContent=hot.time||'00:00 → 00:02';hotspotReason.textContent=hot.reason||hot.label||'Le début doit être renforcé.';hookBefore.textContent=data.detected_spoken_hook||data.detected_title_text||'Hook non détecté';hookAfter.textContent=data.recommended_hook||'Raccourcis l’ouverture et annonce immédiatement la promesse.';actionList.innerHTML='';(data.action_items||[]).forEach((item,i)=>{const el=document.createElement('div');el.className='actionItem';el.innerHTML=`<b>${i+1}</b><span>${escapeHtml(item)}</span>`;actionList.appendChild(el)});if((data.locked||[]).length){for(let i=0;i<3;i++){const ph=document.createElement('div');ph.className='lockedPlaceholder';actionList.appendChild(ph)}premiumTeaser.classList.remove('hidden')}else premiumTeaser.classList.add('hidden');}
function renderComparison(before,after){if(before.score_version!==after.score_version){comparePanel.classList.add('hidden');metricDelta.classList.remove('hidden');metricDelta.innerHTML='<span class="deltaChip">Comparaison non affichée : version de score différente.</span>';return}comparePanel.classList.remove('hidden');beforeScore.textContent=before.final_score+'/100';afterScore.textContent=after.final_score+'/100';const d=after.final_score-before.final_score;deltaScore.textContent=(d>=0?'+':'')+d+' points';const keys=[['Hook','spoken_hook'],['Rétention','retention'],['Visuel','visual_hook'],['Partage','shareability']];metricDelta.classList.remove('hidden');metricDelta.innerHTML=keys.map(([l,k])=>{const x=(Number(after.scores?.[k])||0)-(Number(before.scores?.[k])||0);return `<span class="deltaChip">${l} <b>${x>=0?'+':''}${x}</b></span>`}).join('');}

$('reanalyseBtn').addEventListener('click',async()=>{if(!await ensureAuth())return;if(entitlement?.plan!=='creator'){openPaywall();track('paywall_viewed',{source:'rescore'});return}reanalysisMode=true;reanalyseInput.click()});
function openPaywall(){paywall.classList.remove('hidden')}$('upgradeBtn').addEventListener('click',openPaywall);$('closePaywall').addEventListener('click',()=>paywall.classList.add('hidden'));paywall.addEventListener('click',e=>{if(e.target===paywall)paywall.classList.add('hidden')});
$('requestCreator').addEventListener('click',async()=>{if(!await ensureAuth())return;try{await supa('/rest/v1/viralplus_upgrade_requests',{method:'POST',body:{user_id:session.user.id},prefer:'resolution=ignore-duplicates'});$('upgradeMessage').textContent='Demande enregistrée. Nous t’ajouterons à la bêta Creator.';track('upgrade_requested')}catch(e){$('upgradeMessage').textContent='Ta demande est déjà enregistrée.'}});

async function saveOutcome(){if(!currentAnalysis?.analysis_id){showToast('Analyse une vidéo avant d’enregistrer ses résultats.');return}const row={analysis_id:currentAnalysis.analysis_id,user_id:session.user.id,outcome_window:$('outcomeWindow').value,views:num('outViews'),shares:num('outShares'),saves:num('outSaves'),comments:num('outComments'),followers_gained:num('outFollowers')};try{await supa('/rest/v1/viralplus_outcomes',{method:'POST',body:row,prefer:'resolution=merge-duplicates,return=representation',query:'?on_conflict=analysis_id,outcome_window'});$('outcomeStatus').textContent='Résultat enregistré. Merci — ça aide Viral+ à devenir plus fiable.';track('outcome_saved',{window:row.outcome_window,views:row.views})}catch(e){$('outcomeStatus').textContent=e.message}}
function num(id){const v=$(id).value;return v===''?null:Number(v)}$('saveOutcome').addEventListener('click',saveOutcome);

async function loadHistory(){const grid=$('historyGrid');if(!session?.user){grid.innerHTML='<div class="historyEmpty">Connecte-toi pour retrouver tes analyses.</div>';return}try{const rows=await supa('/rest/v1/viralplus_analyses',{query:'?select=id,created_at,video_name,final_score,status,is_reanalysis,baseline_analysis_id,score_version,result_json&order=created_at.desc&limit=30'});if(!rows.length){grid.innerHTML='<div class="historyEmpty">Aucune analyse pour le moment.</div>';return}grid.innerHTML=rows.map(r=>`<article class="historyCard" data-id="${r.id}"><small>${new Date(r.created_at).toLocaleString('fr-FR')}</small><strong>${r.final_score}/100</strong><span>${escapeHtml(r.video_name)} · ${r.is_reanalysis?'Re-score':'Analyse'}</span></article>`).join('');grid.querySelectorAll('.historyCard').forEach(card=>card.addEventListener('click',()=>{const row=rows.find(x=>x.id===card.dataset.id);if(!row)return;const data={...(row.result_json||{}),analysis_id:row.id,final_score:row.final_score,score_version:row.score_version,status:row.status};currentAnalysis=data;renderResult(data);showResultLayer(data);resultEmpty.classList.add('hidden');resultContent.classList.remove('hidden');document.getElementById('workspace').scrollIntoView({behavior:'smooth'});track('history_opened',{analysis_id:row.id})}))}catch(e){grid.innerHTML=`<div class="historyEmpty">${escapeHtml(e.message)}</div>`}}
$('refreshHistory').addEventListener('click',loadHistory);

(async function init(){await handleAuthCallback();if(!session)session=storedSession();if(session&&isExpired(session))await refreshSession();updateAccountUI();if(session?.user){await refreshEntitlement();await loadHistory();track('page_view',{path:location.pathname})}updateStage();tickCounters()})();
