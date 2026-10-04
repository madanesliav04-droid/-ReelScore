const $=id=>document.getElementById(id);
const phone=$('phone'),socialLayer=$('socialLayer'),analysisLayer=$('analysisLayer'),tabs=[...document.querySelectorAll('.stateTab')];
const heroViews=$('heroViews'),heroLikes=$('heroLikes'),heroFollowers=$('heroFollowers'),likeCounter=$('likeCounter'),commentCounter=$('commentCounter'),shareCounter=$('shareCounter');
const sViews=$('sViews'),sLikes=$('sLikes'),sFollowers=$('sFollowers'),sComments=$('sComments');
const cards=[$('cardHook'),$('cardRetention'),$('cardVisual'),$('cardShare')];
const mainTitle=$('mainTitle'),mainText=$('mainText'),fixTitle=$('fixTitle'),fixText=$('fixText');
const fileInput=$('fileInput'),preview=$('preview'),placeholder=$('placeholder'),previewVideo=$('previewVideo'),analyzeBtn=$('analyzeBtn'),timelineFill=$('timelineFill'),timelineText=$('timelineText');
const reduceMotion=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const lowPower=window.innerWidth<900;
let mode='social';
let objectUrl=null;
let mouseRAF=0;
let counterTimer=0;

function setCard(i,score,note){cards[i].querySelector('strong').textContent=score;cards[i].querySelector('small').textContent=note}

function setMode(m){
  mode=m;
  tabs.forEach(t=>t.classList.toggle('active',t.dataset.mode===m));
  const a=m==='analysis'||m==='improve';
  socialLayer.classList.toggle('active',!a);
  analysisLayer.classList.toggle('active',a);

  if(m==='social'){
    phone.style.transform='rotateY(-15deg) rotateX(7deg) rotateZ(-2deg)';
    resetSocial();
  }
  if(m==='problem'){
    phone.style.transform='rotateY(-9deg) rotateX(5deg) rotateZ(-1deg)';
    heroViews.textContent='487';heroLikes.textContent='31';heroFollowers.textContent='+2';
    likeCounter.textContent='31';commentCounter.textContent='2';shareCounter.textContent='0';
    sViews.textContent='487 vues';sLikes.textContent='31 likes';sFollowers.textContent='+2 followers';sComments.textContent='2 commentaires';
    setCard(0,'41','Commence trop lentement');setCard(1,'53','Longueur au milieu');setCard(2,'38','Début trop statique');setCard(3,'49','Pas encore marquant');
    mainTitle.textContent='La vidéo se bloque';mainText.textContent='L’ouverture ne donne pas immédiatement une raison de rester.';
    fixTitle.textContent='Ce que Viral+ va corriger';fixText.textContent='Raccourcir le début, renforcer le hook et créer une rupture visuelle.';
  }
  if(m==='analysis'){
    phone.style.transform='rotateY(-4deg) rotateX(2deg) rotateZ(0deg)';
    setCard(0,'68','Promesse identifiable');setCard(1,'61','Quelques temps morts');setCard(2,'57','Début trop statique');setCard(3,'73','Bon angle de sujet');
    mainTitle.textContent='Analyse en cours';mainText.textContent='La vidéo reste dans le téléphone. Les scores apparaissent autour.';
    fixTitle.textContent='Prochaine étape';fixText.textContent='Viral+ construit les corrections à appliquer avant publication.';
  }
  if(m==='improve'){
    phone.style.transform='rotateY(0deg) rotateX(0deg) rotateZ(0deg)';
    setCard(0,'82','Beaucoup plus clair');setCard(1,'74','Plus dense');setCard(2,'78','Ouverture plus vive');setCard(3,'84','Plus partageable');
    timelineFill.style.width='84%';timelineText.textContent='Version améliorée';
    mainTitle.textContent='Version renforcée';mainText.textContent='La même scène montre maintenant la progression obtenue.';
    fixTitle.textContent='Nouveau hook';fixText.textContent='« Si tes vidéos restent bloquées au même niveau, regarde ça. »';
    if(!reduceMotion) burstSocial(lowPower?8:14);
  }
}

function resetSocial(){
  heroViews.textContent='124K';heroLikes.textContent='18.9K';heroFollowers.textContent='+4.3K';
  likeCounter.textContent='18.9K';commentCounter.textContent='1.8K';shareCounter.textContent='5.4K';
  sViews.textContent='124K vues';sLikes.textContent='18.9K likes';sFollowers.textContent='+4.3K followers';sComments.textContent='1.8K commentaires';
  setCard(0,'82','Compris immédiatement');setCard(1,'71','Peut être densifiée');setCard(2,'64','Ajoute une rupture');setCard(3,'79','Bon potentiel');
  timelineFill.style.width='70%';timelineText.textContent='0:00 → 0:02';
  mainTitle.textContent='Ton hook';mainText.textContent='Il démarre trop lentement. Annonce l’idée plus vite et ajoute une rupture visuelle.';
  fixTitle.textContent='Version plus forte';fixText.textContent='« Si tes vidéos restent bloquées au même niveau, regarde ça. »';
}

function fmt(n){return n>=1000?(n/1000).toFixed(n>=10000?0:1).replace('.0','')+'K':String(n)}

function tickCounters(){
  clearTimeout(counterTimer);
  if(!document.hidden&&mode==='social'){
    const v=124000+Math.floor(Math.random()*900),l=18900+Math.floor(Math.random()*120),f=4300+Math.floor(Math.random()*30),c=1800+Math.floor(Math.random()*22),s=5400+Math.floor(Math.random()*35);
    heroViews.textContent=fmt(v);heroLikes.textContent=fmt(l);heroFollowers.textContent='+'+fmt(f);
    likeCounter.textContent=fmt(l);commentCounter.textContent=fmt(c);shareCounter.textContent=fmt(s);
    sViews.textContent=fmt(v)+' vues';sLikes.textContent=fmt(l)+' likes';sFollowers.textContent='+'+fmt(f)+' followers';sComments.textContent=fmt(c)+' commentaires';
  }
  counterTimer=setTimeout(tickCounters,1500);
}

document.addEventListener('visibilitychange',()=>{if(!document.hidden)tickCounters()});

function burstSocial(count=14){
  const labels=['♥ 1.2K','💬 incroyable','↗ 96','+742 followers','12.4K vues','exactement','je devais voir ça'];
  const r=phone.getBoundingClientRect();
  const fragment=document.createDocumentFragment();
  const nodes=[];
  for(let i=0;i<count;i++){
    const p=document.createElement('div');
    p.className='socialParticle';
    p.textContent=labels[Math.floor(Math.random()*labels.length)];
    p.style.left=(r.left+r.width/2-40+Math.random()*80)+'px';
    p.style.top=(r.top+r.height*.55-20+Math.random()*60)+'px';
    p.style.setProperty('--x',(Math.random()*280-140)+'px');
    p.style.setProperty('--y',(-140-Math.random()*220)+'px');
    p.style.setProperty('--r',(Math.random()*40-20)+'deg');
    p.style.setProperty('--dur',(1.25+Math.random()*.8)+'s');
    fragment.appendChild(p);nodes.push(p);
  }
  document.body.appendChild(fragment);
  setTimeout(()=>nodes.forEach(p=>p.remove()),2300);
}

phone.addEventListener('click',()=>{
  if(mode!=='social')return;
  if(!reduceMotion){
    phone.animate([
      {transform:'rotateY(-15deg) rotateX(7deg) scale(1)'},
      {transform:'rotateY(-9deg) rotateX(4deg) scale(1.025)'},
      {transform:'rotateY(-15deg) rotateX(7deg) scale(1)'}
    ],{duration:520,easing:'cubic-bezier(.2,.8,.2,1)'});
    burstSocial(lowPower?10:18);
  }
});

fileInput.addEventListener('change',e=>{
  const file=e.target.files?.[0];if(!file)return;
  if(objectUrl)URL.revokeObjectURL(objectUrl);
  objectUrl=URL.createObjectURL(file);
  previewVideo.src=objectUrl;
  preview.classList.add('hasVideo');
  placeholder.style.display='none';
  previewVideo.play().catch(()=>{});
  setMode('analysis');
});

analyzeBtn.addEventListener('click',()=>{
  setMode('analysis');analyzeBtn.textContent='Analyse...';
  let i=0;
  const steps=[
    ['Lecture du hook','0:00 → 0:02',['68','61','57','73']],
    ['Analyse du rythme','0:06 → 0:09',['72','66','63','76']],
    ['Construction du diagnostic','Score 82/100',['82','74','78','84']]
  ];
  const timer=setInterval(()=>{
    const s=steps[i];timelineText.textContent=s[1];timelineFill.style.width=(55+i*15)+'%';
    setCard(0,s[2][0],i<2?'Analyse du hook':'Beaucoup plus clair');
    setCard(1,s[2][1],i<2?'Rythme en lecture':'Plus dense');
    setCard(2,s[2][2],i<2?'Lecture visuelle':'Ouverture plus vive');
    setCard(3,s[2][3],i<2?'Potentiel de partage':'Plus partageable');
    mainTitle.textContent=s[0];mainText.textContent=i<2?'Viral+ analyse la vidéo dans la même interface.':'Analyse terminée. Voici la priorité à corriger.';
    fixTitle.textContent=i<2?'En préparation':'Hook amélioré';fixText.textContent=i<2?'Les recommandations apparaissent progressivement.':'« Si tes vidéos restent bloquées au même niveau, regarde ça. »';
    i++;
    if(i===steps.length){clearInterval(timer);analyzeBtn.textContent='Améliorer';setTimeout(()=>setMode('improve'),350)}
  },950);
});

tabs.forEach(t=>t.addEventListener('click',()=>setMode(t.dataset.mode)));
$('heroAnalyse').addEventListener('click',()=>setTimeout(()=>setMode('analysis'),250));

window.addEventListener('mousemove',e=>{
  if(lowPower||reduceMotion||mode!=='social')return;
  if(mouseRAF)return;
  const cx=e.clientX,cy=e.clientY;
  mouseRAF=requestAnimationFrame(()=>{
    const x=(cx/innerWidth-.5)*7;
    const y=(cy/innerHeight-.5)*-4;
    phone.style.transform=`rotateY(${-15+x}deg) rotateX(${7+y}deg) rotateZ(-2deg)`;
    mouseRAF=0;
  });
},{passive:true});

window.addEventListener('beforeunload',()=>{if(objectUrl)URL.revokeObjectURL(objectUrl)});

tickCounters();
setMode('social');