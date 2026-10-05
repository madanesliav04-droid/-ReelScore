'use strict';
(async function(){
  const script=document.currentScript;
  const base=script.src.replace(/boot-fast\.js(?:\?.*)?$/,'');
  const fail=(m)=>{document.body.innerHTML=`<main style="min-height:100vh;display:grid;place-items:center;background:#07070a;color:#fff;font-family:system-ui;padding:24px"><div style="max-width:520px;text-align:center"><h1 style="font-size:28px">Impossible de charger l’éditeur</h1><p style="color:#aeb3bf">${m}</p><button onclick="location.reload()" style="margin-top:12px;padding:12px 18px;border:0;border-radius:12px;background:#8d6fff;color:#fff;font-weight:800">Réessayer</button></div></main>`};
  try{
    const res=await fetch(base+'index.html',{cache:'no-store'});
    if(!res.ok)throw new Error('Interface indisponible');
    const html=await res.text();
    const doc=new DOMParser().parseFromString(html,'text/html');
    doc.querySelectorAll('script').forEach(s=>s.remove());
    document.title=doc.title||'Edit+';
    document.body.innerHTML=doc.body.innerHTML;

    const style=document.createElement('link');
    style.rel='stylesheet';style.href=base+'styles.css?v=6002';document.head.appendChild(style);

    const files=['core.js','analysis.js','timeline.js','preview.js','render.js','perf.js','font-loader.js'];
    for(const file of files){
      await new Promise((resolve,reject)=>{
        const s=document.createElement('script');
        s.src=base+file+'?v=6002';
        s.async=false;
        s.onload=resolve;
        s.onerror=()=>reject(new Error('Chargement '+file));
        document.body.appendChild(s);
      });
    }
  }catch(e){console.error(e);fail(e.message||'Erreur de chargement');}
})();
