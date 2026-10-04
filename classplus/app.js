const state={problem:localStorage.getItem('liav_problem')||'',route:localStorage.getItem('liav_route')||''};
const problemText={
 direction:{label:'Je ne sais pas quoi lancer',reply:'Ton problème n’est pas de manquer d’idées. C’est de choisir une direction suffisamment claire pour arrêter de repartir de zéro.',method:'Dans ton cas, le premier travail est de réduire les options. On filtre par temps, situation, compétences, budget et objectif 90 jours.'},
 execution:{label:'J’ai une idée mais je n’exécute pas assez',reply:'Tu n’as probablement pas besoin d’une nouvelle stratégie. Tu as besoin d’un plan plus petit, plus mesurable et impossible à esquiver.',method:'Dans ton cas, on ne cherche pas une nouvelle idée. On transforme ton idée actuelle en missions simples avec preuve d’exécution.'},
 stagnation:{label:'J’ai commencé mais je stagne',reply:'Stagner ne veut pas dire que ta voie est mauvaise. Ça veut souvent dire qu’il faut mesurer ce qui bloque, corriger, puis repartir avec un cycle plus propre.',method:'Dans ton cas, le diagnostic sert à identifier le goulot d’étranglement avant d’ajouter de nouvelles actions.'}
};
const routeText={
 classplus:{label:'Commencer gratuitement avec CLASS+',lead:'Tu n’as pas besoin d’acheter quoi que ce soit aujourd’hui. Commence par observer, apprendre et exécuter une chose.'},
 method:{label:'Comprendre la méthode',lead:'Tu veux d’abord comprendre la logique. Garde le parcours comme filtre : objectif, diagnostic, voie, roadmap, mission, preuve, résultat.'},
 coaching:{label:'Être accompagné',lead:'Tu es déjà dans une logique d’accompagnement. La prochaine étape sera de vérifier si ta situation correspond à la prochaine session.'}
};
function applyState(){
 document.querySelectorAll('[data-problem]').forEach(el=>el.classList.toggle('active',el.dataset.problem===state.problem));
 document.querySelectorAll('[data-route]').forEach(el=>el.classList.toggle('active',el.dataset.route===state.route));
 if(state.problem){
  document.getElementById('diagnosticReply').textContent=problemText[state.problem].reply;
  document.getElementById('methodLead').textContent=problemText[state.problem].method;
  document.getElementById('summaryProblem').textContent=problemText[state.problem].label;
  document.getElementById('chaosSmall').textContent=state.problem==='direction'?'Ce que ton cerveau voit':state.problem==='execution'?'Ce qui te ralentit':'Ce qu’il faut diagnostiquer';
 }
 if(state.route){document.getElementById('summaryRoute').textContent=routeText[state.route].label;document.getElementById('finalLead').textContent=routeText[state.route].lead;}
}
document.querySelectorAll('[data-problem]').forEach(btn=>btn.addEventListener('click',()=>{
 state.problem=btn.dataset.problem;localStorage.setItem('liav_problem',state.problem);applyState();
 setTimeout(()=>document.getElementById('problem').scrollIntoView({behavior:'smooth'}),180);
}));
document.querySelectorAll('[data-route]').forEach(btn=>btn.addEventListener('click',()=>{
 state.route=btn.dataset.route;localStorage.setItem('liav_route',state.route);applyState();
 const target=state.route==='classplus'?'classplus':state.route==='coaching'?'session':'roadmap';
 setTimeout(()=>document.getElementById(target).scrollIntoView({behavior:'smooth'}),180);
}));
const revealObs=new IntersectionObserver(entries=>entries.forEach(e=>{if(e.isIntersecting){e.target.classList.add('in');revealObs.unobserve(e.target)}}),{threshold:.14});
document.querySelectorAll('.reveal').forEach(el=>revealObs.observe(el));
const manifesto=[...document.querySelectorAll('#manifesto>div')];
const roads=[...document.querySelectorAll('.road')];
function activate(list,container){const r=container.getBoundingClientRect(),v=innerHeight,p=Math.max(0,Math.min(1,(v-r.top)/(v+r.height*.75))),n=Math.ceil(p*list.length);list.forEach((el,i)=>el.classList.toggle('on',i<n));}
const progress=document.getElementById('progress'),orb=document.getElementById('orb');
function onScroll(){
 const max=document.documentElement.scrollHeight-innerHeight,p=max>0?scrollY/max:0;
 progress.style.height=(p*100)+'%';
 orb.style.transform=`translateY(${-Math.sin(p*Math.PI*8)*6}px) rotate(${(p*36)-8}deg)`;
 activate(manifesto,document.getElementById('manifesto'));activate(roads,document.getElementById('roadmapList'));
}
let ticking=false;addEventListener('scroll',()=>{if(!ticking){requestAnimationFrame(()=>{onScroll();ticking=false});ticking=true}},{passive:true});
document.getElementById('year').textContent=new Date().getFullYear();
applyState();onScroll();setTimeout(()=>document.querySelectorAll('.hero .reveal').forEach((el,i)=>setTimeout(()=>el.classList.add('in'),90*i)),80);