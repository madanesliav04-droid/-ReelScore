"use client";

import Link from "next/link";
import {ArrowRight,BarChart3,Check,ChevronRight,Clapperboard,FileVideo,Menu,ShieldCheck,Sparkles,UploadCloud,X,Zap} from "lucide-react";
import {useState} from "react";

const modules=[
  {id:"edit",name:"Edit+",number:"01",eyebrow:"MONTAGE INTELLIGENT",headline:"Du rush au montage.",description:"Importe ta vidéo, choisis ton style et lance le rendu. Le format d'origine reste disponible, y compris l'horizontal.",points:["Montage selon le modèle choisi","Sous-titres et cuts adaptés","Vidéo exportable"],Icon:Clapperboard},
  {id:"viral",name:"Viral+",number:"02",eyebrow:"ANALYSE ÉDITORIALE",headline:"Comprends avant de poster.",description:"Analyse ton hook, ton rythme et ta clarté. Reçois des pistes liées à ta vidéo, pas une liste de conseils copiés-collés.",points:["Score créatif estimé et détaillé","Problèmes horodatés et preuves","Hypothèses de hooks à tester"],Icon:BarChart3}
] as const;

export function StudioLanding(){
  const [menuOpen,setMenuOpen]=useState(false);
  return <main className="social-site">
    <nav className="social-nav" aria-label="Navigation principale">
      <Link className="social-logo" href="/" aria-label="Social+ - accueil"><span className="social-logo-mark">S<span>+</span></span><span>SOCIAL<span>+</span></span></Link>
      <div className={`social-nav-links ${menuOpen?"is-open":""}`}>
        <a href="#modules" onClick={()=>setMenuOpen(false)}>Les outils</a>
        <a href="#method" onClick={()=>setMenuOpen(false)}>Comment ça marche</a>
        <Link href="/dashboard?tool=viral" onClick={()=>setMenuOpen(false)}>Viral+</Link>
        <Link href="/dashboard?tool=edit" onClick={()=>setMenuOpen(false)}>Edit+</Link>
      </div>
      <Link className="social-nav-cta" href="/dashboard?tool=viral">Ouvrir Social+ <ArrowRight size={16}/></Link>
      <button className="social-menu-toggle" type="button" aria-label={menuOpen?"Fermer le menu":"Ouvrir le menu"} aria-expanded={menuOpen} onClick={()=>setMenuOpen(v=>!v)}>{menuOpen?<X size={22}/>:<Menu size={22}/>}</button>
    </nav>

    <section className="social-hero" aria-labelledby="social-hero-title">
      <div className="social-hero-bg" aria-hidden="true"/>
      <div className="social-hero-content">
        <div className="social-overline"><span className="social-pulse"/> STUDIO VIDÉO POUR CRÉATEURS</div>
        <h1 id="social-hero-title">Une meilleure vidéo.<br/><span>Un seul studio.</span></h1>
        <p>Montage intelligent. Analyse éditoriale. Deux outils pensés pour améliorer ton contenu, du premier rush à la prochaine version.</p>
        <div className="social-hero-buttons">
          <Link className="social-button social-button-main" href="/dashboard?tool=edit">Commencer avec Edit+ <ArrowRight size={18}/></Link>
          <Link className="social-button social-button-outline" href="/dashboard?tool=viral">Analyser une vidéo <BarChart3 size={17}/></Link>
        </div>
        <div className="social-hero-proof"><ShieldCheck size={16}/> Des diagnostics argumentés, jamais de viralité garantie.</div>
      </div>
      <div className="social-product-demo" aria-label="Aperçu illustratif de Social+">
        <div className="social-demo-top"><span><i/> SOCIAL+ / WORKSPACE</span><span>APERÇU DE L’INTERFACE</span></div>
        <div className="social-demo-main">
          <div className="social-demo-video">
            <div className="social-demo-portrait">
              <div className="social-demo-lens"><FileVideo size={35} strokeWidth={1.3}/></div>
              <span className="social-demo-caps">TA VIDÉO</span>
              <div className="social-demo-timeline"><span/><span/><span/><span/></div>
            </div>
          </div>
          <div className="social-demo-insights">
            <div className="social-demo-tabs"><span>EDIT+</span><span>VIRAL+</span></div>
            <small>ANALYSE LIÉE À TA VIDÉO</small>
            <strong>Chaque suggestion doit avoir une raison.</strong>
            <div className="social-insight-item"><span className="social-insight-dot"/> <div><b>Hook</b><p>Vérifier la promesse des premières secondes.</p></div></div>
            <div className="social-insight-item"><span className="social-insight-dot"/> <div><b>Rythme</b><p>Pointer un passage précis, si nécessaire.</p></div></div>
            <div className="social-demo-verified"><Check size={14}/> Pas de chiffres inventés</div>
          </div>
        </div>
        <div className="social-demo-bottom"><span><Zap size={13}/> Un espace, deux workflows</span><span>9:16 · 16:9</span></div>
      </div>
    </section>

    <section id="modules" className="social-modules" aria-labelledby="social-modules-title">
      <div className="social-section-intro"><div className="social-section-label">TON WORKSPACE</div><h2 id="social-modules-title">Deux outils.<br/>Une seule exigence : <em>la qualité.</em></h2><p>Choisis ce que tu veux faire maintenant. Chaque outil possède sa propre interface et son propre parcours.</p></div>
      <div className="social-module-grid">
        {modules.map(m=><article className={`social-module social-module-${m.id}`} key={m.id}>
          <div className="social-module-top"><span>{m.number} / {m.eyebrow}</span><m.Icon size={24}/></div>
          <div className="social-module-symbol" aria-hidden="true"><m.Icon strokeWidth={.75}/></div>
          <div className="social-module-content"><h3>{m.name}</h3><h4>{m.headline}</h4><p>{m.description}</p><ul>{m.points.map(point=><li key={point}><Check size={14}/>{point}</li>)}</ul><Link href={`/dashboard?tool=${m.id}`} className="social-module-link">Ouvrir {m.name} <ArrowRight size={18}/></Link></div>
        </article>)}
      </div>
    </section>

    <section className="social-method" id="method">
      <div className="social-section-intro"><div className="social-section-label">LE PARCOURS</div><h2>Importe. Travaille.<br/><em>Décide sur des faits.</em></h2></div>
      <div className="social-method-grid">
        <div><span>01</span><UploadCloud size={25}/><h3>Importe ta vidéo</h3><p>Depuis ton téléphone ou ton ordinateur. MP4, MOV ou WebM, jusqu'à 500 Mo.</p></div>
        <div><span>02</span><Sparkles size={25}/><h3>Choisis ton action</h3><p>Edit+ produit un montage. Viral+ analyse ce qui est observable dans ta vidéo.</p></div>
        <div><span>03</span><ChevronRight size={25}/><h3>Récupère le résultat</h3><p>Télécharge ton montage ou examine des recommandations à vérifier et à tester.</p></div>
      </div>
    </section>

    <section className="social-end"><div className="social-end-glow"/><div><span>SOCIAL+</span><h2>La prochaine version<br/>commence ici.</h2><p>Un outil de montage. Un outil d'analyse. Rien de superflu.</p></div><Link className="social-button social-button-main" href="/dashboard?tool=edit">Accéder au studio <ArrowRight size={18}/></Link></section>
    <footer className="social-footer"><Link className="social-logo" href="/"><span className="social-logo-mark">S<span>+</span></span><span>SOCIAL<span>+</span></span></Link><span>Montage & analyse vidéo</span><Link href="/dashboard?tool=viral">Ouvrir Viral+</Link></footer>
  </main>;
}
