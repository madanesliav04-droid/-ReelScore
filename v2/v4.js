const $=id=>document.getElementById(id);
const phone=$('phone'),socialLayer=$('socialLayer'),analysisLayer=$('analysisLayer'),analysisScreen=analysisLayer;
const heroViews=$('heroViews'),heroLikes=$('heroLikes'),heroFollowers=$('heroFollowers'),likeCounter=$('likeCounter'),commentCounter=$('commentCounter'),shareCounter=$('shareCounter');
const sViews=$('sViews'),sLikes=$('sLikes'),sFollowers=$('sFollowers'),sComments=$('sComments');
const cards=[$('cardHook'),$('cardRetention'),$('cardVisual'),$('cardShare')];
const fileInput=$('fileInput'),reanalyseInput=$('reanalyseInput'),dropzone=$('dropzone'),placeholder=$('placeholder'),previewVideo=$('previewVideo'),videoShade=$('videoShade'),videoFileName=$('videoFileName'),analyzeBtn=$('analyzeBtn'),analysisState=$('analysisState'),phoneScore=$('phoneScore'),scoreNumber=$('scoreNumber'),timelineFill=$('timelineFill'),timelineText=$('timelineText'),timelineLabel=$('timelineLabel');
const resultEmpty=$('resultEmpty'),resultContent=$('resultContent'),resultScore=$('resultScore'),scoreOrb=$('scoreOrb'),statusBadge=$('statusBadge'),resultVerdictTitle=$('resultVerdictTitle'),resultVerdictText=$('resultVerdictText'),mainProblem=$('mainProblem'),mainWhy=$('mainWhy'),hotspotTime=$('hotspotTime'),hotspotReason=$('hotspotReason'),hookBefore=$('hookBefore'),hookAfter=$('hookAfter'),actionList=$('actionList'),comparePanel=$('comparePanel'),beforeScore=$('beforeScore'),afterScore=$('afterScore'),deltaScore=$('deltaScore');
const experience=$('experience'),cinemaTitle=$('cinemaTitle'),cinemaText=$('cinemaText'),cinemaEyebrow=$('cinemaEyebrow');
const reduceMotion=matchMedia('(prefers-reduced-motion: reduce)').matches,lowPower=innerWidth<900;
let currentFile=null,objectUrl=null,isAnalyzing=false,baselineScore=null,reanalysisMode=false,counterTimer=0,mouseRAF=0;
const W={retention:.24,shareability:.16,originality:.15,audience_relevance:.12,spoken_hook:.11,visual_hook:.08,clarity:.05,value_emotion:.04,title:.03,rhythm:.02,cta:0};

function setCard(i,score,note){cards[i].querySelector('strong').textContent=Math.round(Number(score)||0);cards[i].querySelector('small').textContent=note||''}
function fmt(n){return n>=1000?(n/1000).toFixed(n>=10000?0:1).replace('.0','')+'K':String(n)}
function scoreFinal(scores){let x=0,total=0;for(const[k,w]of Object.entries(W)){x+=(Number(scores?.[k])||0)*w;total+=w}return Math.round(Math.max(0,Math.min(100,total?x/total:0)))}
function statusFor(score){return score>=78?['Prête','Ta vidéo est prête à être publiée.','Le diagnostic est solide. Vérifie les dernières recommandations avant publication.']:score>=60?['Presque prête','Ta vidéo est proche d’une bonne version.','Quelques corrections ciblées peuvent encore renforcer la rétention et le partage.']:['À retravailler','Ta vidéo n’est pas encore prête.','Corrige les points prioritaires avant publication.']}
function showToast(message){const old=document.querySelector('.errorToast');if(old)old.remove();const el=document.createElement('div');el.className='errorToast';el.textContent=message;document.body.appendChild(el);setTimeout(()=>el.remove(),3600)}

function showSocial(){socialLayer.classList.add('active');analysisLayer.classList.remove('active');phoneScore.classList.add('hidden');phone.style.transform='rotateY(-15deg) rotateX(7deg) rotateZ(-2deg)'}
function showAnalysis(){socialLayer.classList.remove('active');analysisLayer.classList.add('active');phone.style.transform='rotateY(-2deg) rotateX(1deg) rotateZ(0deg)'}
function goAnalyse(){showAnalysis();window.scrollTo({top:0,behavior:'smooth'});setTimeout(()=>fileInput.click(),reduceMotion?0:450)}

function tickCounters(){clearTimeout(counterTimer);if(!document.hidden&&socialLayer.classList.contains('active')){const v=124000+Math.floor(Math.random()*900),l=18900+Math.floor(Math.random()*120),f=4300+Math.floor(Math.random()*30),c=1800+Math.floor(Math.random()*22),s=5400+Math.floor(Math.random()*35);heroViews.textContent=fmt(v);heroLikes.textContent=fmt(l);heroFollowers.textContent='+'+fmt(f);likeCounter.textContent=fmt(l);commentCounter.textContent=fmt(c);shareCounter.textContent=fmt(s);sViews.textContent=fmt(v)+' vues';sLikes.textContent=fmt(l)+' likes';sFollowers.textContent='+'+fmt(f)+' followers';sComments.textContent=fmt(c)+' commentaires'}counterTimer=setTimeout(tickCounters,1600)}

function burstSocial(count=14){if(reduceMotion)return;const labels=['♥ 1.2K','💬 incroyable','↗ 96','+742 followers','12.4K vues','exactement','je devais voir ça'];const r=phone.getBoundingClientRect();const fragment=document.createDocumentFragment(),nodes=[];for(let i=0;i<count;i++){const p=document.createElement('div');p.className='socialParticle';p.textContent=labels[Math.floor(Math.random()*labels.length)];p.style.left=(r.left+r.width/2-40+Math.random()*80)+'px';p.style.top=(r.top+r.height*.55-20+Math.random()*60)+'px';p.style.setProperty('--x',(Math.random()*300-150)+'px');p.style.setProperty('--y',(-150-Math.random()*250)+'px');p.style.setProperty('--r',(Math.random()*44-22)+'deg');p.style.setProperty('--dur',(1.2+Math.random()*.9)+'s');fragment.appendChild(p);nodes.push(p)}document.body.appendChild(fragment);setTimeout(()=>nodes.forEach(n=>n.remove()),2400)}

function setFile(file,isReanalysis=false){if(!file)return;if(file.size>95*1024*1024){showToast('Vidéo trop lourde : 95 Mo maximum.');return}if(objectUrl)URL.revokeObjectURL(objectUrl);objectUrl=URL.createObjectURL(file);currentFile=file;reanalysisMode=isReanalysis;previewVideo.src=objectUrl;dropzone.classList.add('hasVideo');placeholder.classList.add('hidden');videoShade.classList.remove('hidden');videoFileName.textContent=file.name;analyzeBtn.disabled=false;analyzeBtn.textContent=isReanalysis?'Re-analyser cette version':'Analyser la vidéo';analysisState.textContent=isReanalysis?'VERSION CORRIGÉE CHARGÉE':'VIDÉO CHARGÉE';showAnalysis();previewVideo.play().catch(()=>{})}

fileInput.addEventListener('change',e=>setFile(e.target.files?.[0],false));
reanalyseInput.addEventListener('change',e=>setFile(e.target.files?.[0],true));
['dragenter','dragover'].forEach(evt=>dropzone.addEventListener(evt,e=>{e.preventDefault();dropzone.classList.add('dragover')}));
['dragleave','drop'].forEach(evt=>dropzone.addEventListener(evt,e=>{e.preventDefault();dropzone.classList.remove('dragover')}));
dropzone.addEventListener('drop',e=>setFile(e.dataTransfer.files?.[0],false));
$('changeVideo').addEventListener('click',e=>{e.preventDefault();e.stopPropagation();fileInput.click()});

function progress(label,pct){analysisState.textContent=label.toUpperCase();analysisScreen.classList.add('busy');timelineFill.style.width=pct+'%';timelineText.textContent=pct<45?'Lecture du hook':pct<75?'Analyse de la rétention':'Construction du diagnostic';timelineLabel.textContent=pct<45?'Hook':pct<75?'Rétention':'Diagnostic';phoneScore.classList.remove('hidden');scoreNumber.textContent=Math.max(0,Math.min(99,Math.round(pct*.78)))}

async function runAnalysis(){if(!currentFile||isAnalyzing)return;if(typeof window.analyzeWithAI!=='function'){showToast('Le moteur Viral+ n’est pas chargé. Recharge la page.');return}isAnalyzing=true;analyzeBtn.disabled=true;analyzeBtn.textContent='Analyse en cours…';analysisScreen.classList.add('busy');phoneScore.classList.remove('hidden');scoreNumber.textContent='0';try{const data=await window.analyzeWithAI(currentFile,progress);const score=scoreFinal(data.scores||{});await animateScore(score);renderPhoneScores(data,score);renderResult(data,score);if(reanalysisMode&&baselineScore!==null){comparePanel.classList.remove('hidden');beforeScore.textContent=baselineScore+'/100';afterScore.textContent=score+'/100';const delta=score-baselineScore;deltaScore.textContent=(delta>=0?'+':'')+delta+' points'}else{baselineScore=score;comparePanel.classList.add('hidden')}resultEmpty.classList.add('hidden');resultContent.classList.remove('hidden');analysisState.textContent='ANALYSE TERMINÉE';analyzeBtn.textContent='Analyse terminée';burstSocial(lowPower?6:10);setTimeout(()=>document.getElementById('workspace').scrollIntoView({behavior:'smooth',block:'start'}),500)}catch(err){console.error(err);showToast(err?.message||'Analyse impossible.');analysisState.textContent='ERREUR D’ANALYSE';analyzeBtn.textContent='Réessayer';analyzeBtn.disabled=false}finally{isAnalyzing=false;analysisScreen.classList.remove('busy')}}
analyzeBtn.addEventListener('click',runAnalysis);

function animateScore(target){return new Promise(resolve=>{const start=performance.now(),dur=850;function frame(now){const t=Math.min(1,(now-start)/dur),e=1-Math.pow(1-t,3),v=Math.round(target*e);scoreNumber.textContent=v;if(t<1)requestAnimationFrame(frame);else resolve()}requestAnimationFrame(frame)})}
function renderPhoneScores(data,score){const s=data.scores||{};setCard(0,s.spoken_hook??score,'Hook parlé');setCard(1,s.retention??score,'Rétention estimée');setCard(2,s.visual_hook??score,'Hook visuel');setCard(3,s.shareability??score,'Potentiel de partage');timelineFill.style.width=Math.max(12,score)+'%';timelineLabel.textContent='Score';timelineText.textContent=score+'/100'}
function renderResult(data,score){resultScore.textContent=score;scoreOrb.style.setProperty('--scoreDeg',(score*3.6)+'deg');const [status,title,text]=statusFor(score);statusBadge.textContent=status;resultVerdictTitle.textContent=title;resultVerdictText.textContent=data.verdict||text;mainProblem.textContent=data.main_problem||'Le hook doit être renforcé.';mainWhy.textContent=data.why||'L’idée principale arrive trop tard.';const hotspot=(data.timeline||[])[0]||{};hotspotTime.textContent=hotspot.time||'00:00 → 00:02';hotspotReason.textContent=hotspot.reason||hotspot.label||'Le début ne crée pas assez vite de tension.';hookBefore.textContent=data.detected_spoken_hook||data.detected_title_text||'Hook non détecté';hookAfter.textContent=data.recommended_hook||'Raccourcis l’ouverture et annonce immédiatement la promesse.';const items=(data.action_items||[]).slice(0,6);actionList.innerHTML='';const fallback=['Raccourcis les 2 premières secondes.','Annonce la promesse plus tôt.','Ajoute une rupture visuelle au début.','Renforce le CTA final.'];(items.length?items:fallback).forEach((item,i)=>{const el=document.createElement('div');el.className='actionItem'+(i>1?' locked':'');el.innerHTML=`<b>${i+1}</b><span>${escapeHtml(item)}</span>`;actionList.appendChild(el)});if((items.length||fallback.length)<=2)$('premiumTeaser').classList.add('hidden');else $('premiumTeaser').classList.remove('hidden')}
function escapeHtml(s){return String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}

const sceneContent=[
  ['ACTE 01','LA VIRALITÉ ATTIRE.','Les chiffres montent. Les signaux sociaux donnent envie. Mais ils ne disent pas pourquoi une vidéo fonctionne.'],
  ['ACTE 02','PUIS TOUT PEUT SE BLOQUER.','Un hook trop lent ou un moment mort suffit à casser la courbe dès les premières secondes.'],
  ['ACTE 03','VIRAL+ ENTRE DANS LA VIDÉO.','Le téléphone pivote : on quitte le décor pour entrer dans le contenu sans changer d’univers.'],
  ['ACTE 04','LE DIAGNOSTIC PREND FORME.','Le produit isole le problème principal, le moment précis et la correction à appliquer.'],
  ['ACTE 05','UNE MEILLEURE VERSION ÉMERGE.','Tu corriges, tu recharges ta vidéo et Viral+ mesure si la nouvelle version est vraiment plus forte.']
];
function updateExperienceScene(){const r=experience.getBoundingClientRect(),vh=innerHeight,total=experience.offsetHeight-vh;const p=Math.max(0,Math.min(1,-r.top/Math.max(1,total)));const step=Math.min(4,Math.floor(p*5));experience.dataset.scene=String(step);const c=sceneContent[step];cinemaEyebrow.textContent=c[0];cinemaTitle.textContent=c[1];cinemaText.textContent=c[2]}
let scrollRAF=0;addEventListener('scroll',()=>{if(scrollRAF)return;scrollRAF=requestAnimationFrame(()=>{updateExperienceScene();scrollRAF=0})},{passive:true});

phone.addEventListener('click',()=>{if(!socialLayer.classList.contains('active'))return;burstSocial(lowPower?9:17);if(!reduceMotion)phone.animate([{transform:'rotateY(-15deg) rotateX(7deg) scale(1)'},{transform:'rotateY(-8deg) rotateX(3deg) scale(1.03)'},{transform:'rotateY(-15deg) rotateX(7deg) scale(1)'}],{duration:560,easing:'cubic-bezier(.2,.8,.2,1)'})});
addEventListener('mousemove',e=>{if(lowPower||reduceMotion||!socialLayer.classList.contains('active'))return;if(mouseRAF)return;const cx=e.clientX,cy=e.clientY;mouseRAF=requestAnimationFrame(()=>{const x=(cx/innerWidth-.5)*7,y=(cy/innerHeight-.5)*-4;phone.style.transform=`rotateY(${-15+x}deg) rotateX(${7+y}deg) rotateZ(-2deg)`;mouseRAF=0})},{passive:true});

document.addEventListener('visibilitychange',()=>{if(!document.hidden)tickCounters()});
['heroAnalyse','navAnalyse','finalAnalyse'].forEach(id=>$(id).addEventListener('click',goAnalyse));
$('resultStart').addEventListener('click',goAnalyse);
$('reanalyseBtn').addEventListener('click',()=>{reanalysisMode=true;reanalyseInput.click()});
$('upgradeBtn').addEventListener('click',()=>$('paywall').classList.remove('hidden'));
$('closePaywall').addEventListener('click',()=>$('paywall').classList.add('hidden'));
$('paywall').addEventListener('click',e=>{if(e.target===$('paywall'))$('paywall').classList.add('hidden')});
$('paywallCta').addEventListener('click',()=>showToast('Paiement bientôt disponible sur Viral+.'));
addEventListener('beforeunload',()=>{if(objectUrl)URL.revokeObjectURL(objectUrl)});
updateExperienceScene();tickCounters();showSocial();
