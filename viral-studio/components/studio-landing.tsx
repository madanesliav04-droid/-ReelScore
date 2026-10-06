"use client";

import Link from "next/link";
import { motion, useScroll, useTransform } from "motion/react";
import { ArrowRight, BarChart3, Captions, Clapperboard, Scissors, Sparkles, WandSparkles } from "lucide-react";

const modules = [
  {name:"Clip+", kicker:"FIND", title:"One video. Multiple opportunities.", copy:"Turn long-form content into ranked short-form clips, ready for Edit+.", icon:Scissors},
  {name:"Edit+", kicker:"BUILD", title:"Your editor, without the editing.", copy:"Cuts, captions, punch-ins, pacing and rendering from one workspace.", icon:Clapperboard},
  {name:"Viral+", kicker:"LEARN", title:"Stop guessing why content stalls.", copy:"A measured + multimodal Viral Score with timeline-level diagnosis, Safe Zone checks and fixes.", icon:BarChart3},
];

export function StudioLanding(){
  const {scrollYProgress}=useScroll();
  const phoneY=useTransform(scrollYProgress,[0,.35],[0,150]);
  const phoneRotate=useTransform(scrollYProgress,[0,.35],[-8,0]);
  const glow=useTransform(scrollYProgress,[0,.3],[1,.45]);

  return <main className="site-shell">
    <nav className="nav-shell">
      <Link href="/" className="brand">VIRAL <span>STUDIO</span></Link>
      <div className="nav-links">
        <a href="#product">Product</a><a href="#viral">Viral+</a><a href="#edit">Edit+</a><a href="#clip">Clip+</a>
      </div>
      <div className="nav-actions"><Link href="/dashboard" className="btn ghost">Sign in</Link><Link href="/dashboard" className="btn primary">Start free <ArrowRight size={16}/></Link></div>
    </nav>

    <section className="hero">
      <motion.div className="hero-glow" style={{opacity:glow}}/>
      <div className="hero-copy">
        <motion.div initial={{opacity:0,y:12}} animate={{opacity:1,y:0}} className="eyebrow"><Sparkles size={14}/> CREATOR OPERATING SYSTEM</motion.div>
        <motion.h1 initial={{opacity:0,y:24}} animate={{opacity:1,y:0}} transition={{delay:.08}}>TURN ANY VIDEO<br/>INTO CONTENT<br/><span>THAT PERFORMS.</span></motion.h1>
        <motion.p initial={{opacity:0,y:18}} animate={{opacity:1,y:0}} transition={{delay:.16}}>Clip it. Edit it. Analyze it. Export it.</motion.p>
        <motion.div initial={{opacity:0,y:14}} animate={{opacity:1,y:0}} transition={{delay:.24}} className="hero-actions">
          <Link href="/dashboard" className="btn primary xl">Start Creating <ArrowRight size={18}/></Link>
          <a href="#product" className="btn ghost xl">See how it works</a>
        </motion.div>
      </div>

      <motion.div className="phone-stage" style={{y:phoneY,rotateZ:phoneRotate}}>
        <div className="metric-chip chip-a"><span>Viral Score</span><b>LIVE</b></div>
        <div className="metric-chip chip-b"><span>Safe Zone</span><b>CHECK</b></div>
        <div className="metric-chip chip-c"><span>Hook</span><b>SCAN</b></div>
        <div className="phone">
          <div className="phone-top"/>
          <div className="phone-screen">
            <div className="reel-noise"/>
            <div className="creator-line"><span className="avatar">V+</span><div><b>viralstudio</b><small>original audio</small></div></div>
            <div className="center-mark">VIRAL<span>+</span></div>
            <div className="social-stack"><span>♥</span><span>●</span><span>↗</span></div>
            <div className="caption-live"><b>DON'T POST</b><br/>before you know what breaks retention.</div>
          </div>
        </div>
      </motion.div>
    </section>

    <section id="product" className="story">
      <div className="section-label">THE FLOW</div>
      <h2>CLIP <i>→</i> EDIT <i>→</i> ANALYZE <i>→</i> EXPORT</h2>
      <p>One workspace. One media library. One continuous loop from raw footage to a stronger version.</p>
      <div className="flow-line">
        {["Long video","Best moments","Auto edit","Viral diagnosis","Ready to post"].map((x,i)=><motion.div key={x} initial={{opacity:0,y:20}} whileInView={{opacity:1,y:0}} viewport={{once:true}} transition={{delay:i*.08}} className="flow-node"><b>{String(i+1).padStart(2,"0")}</b><span>{x}</span></motion.div>)}
      </div>
    </section>

    <section className="module-stack">
      {modules.map((m,i)=>{const Icon=m.icon; return <article key={m.name} id={m.name==="Clip+"?"clip":m.name==="Edit+"?"edit":"viral"} className="module-panel">
        <div className="module-copy"><small>{m.kicker} · {m.name}</small><h3>{m.title}</h3><p>{m.copy}</p><Link href="/dashboard" className="text-link">Open {m.name} <ArrowRight size={16}/></Link></div>
        <div className={"module-demo demo-"+i}>
          <div className="demo-top"><span>{m.name}</span><Icon size={18}/></div>
          {i===0 && <><div className="longbar"/><div className="clip-grid">{["BEST","STRONG","READY"].map((label,n)=><div key={label}><span>0{n+1}</span><b>{label}</b><small>selected moment</small></div>)}</div></>}
          {i===1 && <><div className="editor-canvas"><WandSparkles/></div><div className="timeline-mini">{[22,36,18,42,24].map((w,n)=><i key={n} style={{width:w}}/> )}</div><div className="caption-pill"><Captions size={14}/> Modern Bold</div></>}
          {i===2 && <><div className="score-ring"><strong>—</strong><span>/100</span></div><div className="analysis-bars">{["Hook","Retention","Clarity","Safe Zone"].map((x)=><div key={x}><span>{x}</span><i><b style={{width:"100%"}}/></i></div>)}</div></>}
        </div>
      </article>})}
    </section>

    <section className="final-band">
      <div><small>VIRAL STUDIO</small><h2>Make the next version stronger.</h2></div>
      <Link href="/dashboard" className="btn primary xl">Start free <ArrowRight size={18}/></Link>
    </section>
  </main>
}
