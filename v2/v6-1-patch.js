/* Viral+ V6.1 — declutter + meaningful scroll narrative */
(() => {
  const $ = (s) => document.querySelector(s);
  const byId = (id) => document.getElementById(id);
  const sticky = byId('stickyStage');
  const phoneRig = byId('phoneRig');
  const phone = byId('phone');
  const socialLayer = byId('socialLayer');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!sticky || !phoneRig || !phone) return;

  const setHero = () => {
    const hero = $('.copy0');
    if (!hero) return;
    const eyebrow = hero.querySelector('.eyebrow');
    const h1 = hero.querySelector('h1');
    const p = hero.querySelector('p');
    if (eyebrow) eyebrow.innerHTML = '<i></i> Analyse avant publication';
    if (h1) h1.innerHTML = 'ANALYSE TON REEL. <span>CORRIGE-LE AVANT DE PUBLIER.</span>';
    if (p) p.textContent = 'Viral+ repère le hook faible, les temps morts et ce qui freine le partage. Tu sais quoi modifier, où et pourquoi.';
    const proof = hero.querySelector('.v6Promise');
    if (proof) proof.innerHTML = '<span><i></i>Score Viral+</span><span><i></i>Moments faibles</span><span><i></i>Corrections précises</span>';
  };

  const setStep = (index, label, title, text) => {
    const el = $(`.copy${index}`);
    if (!el) return;
    const small = el.querySelector(':scope > small');
    const h = el.querySelector('h2');
    const p = el.querySelector('p');
    if (small) small.textContent = label;
    if (h) h.innerHTML = title;
    if (p) p.textContent = text;
  };

  setHero();
  setStep(1, '01 · IMPORT', 'CHOISIS <span>TA VIDÉO.</span>', 'Le téléphone reste ton point de repère. Tu importes ton Reel directement dedans.');
  setStep(2, '02 · ANALYSE', 'VIRAL+ <span>REGARDE CE QUI COMPTE.</span>', 'Hook, rétention, rythme, visuel et partage. Pas de métriques inutiles.');
  setStep(3, '03 · DIAGNOSTIC', 'UN PROBLÈME. <span>UN MOMENT PRÉCIS.</span>', 'Viral+ te montre où la vidéo perd de la force et ce qu’il faut changer.');
  setStep(4, '04 · AMÉLIORATION', 'CORRIGE. <span>PUIS RE-SCORE.</span>', 'Tu compares la version avant et après avant de choisir celle que tu publies.');

  if (!$('.v61ScrollCue')) {
    const cue = document.createElement('div');
    cue.className = 'v61ScrollCue';
    cue.innerHTML = '<i></i> Fais défiler — la scène réagit à la viralité';
    sticky.appendChild(cue);
  }

  // Continuous but purposeful phone motion: social -> face-on -> analysis.
  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
  const mix = (a, b, t) => a + (b - a) * t;
  const seg = (p, a, b) => clamp((p - a) / (b - a));
  const stageP = () => {
    const c = byId('cinematic');
    if (!c) return 0;
    const r = c.getBoundingClientRect();
    return clamp(-r.top / Math.max(1, c.offsetHeight - innerHeight));
  };

  let raf = 0;
  let lastP = 0;
  let burstMark = -1;

  const burstItems = [
    ['♥', 'icon like'], ['💬', 'icon comment'], ['🔥', 'icon fire'], ['✨', 'icon comment'], ['↗', 'icon share'],
    ['+1 follower', 'pill'], ['1.2K likes', 'pill'], ['partagé', 'pill'], ['sauvegardé', 'pill']
  ];

  function burst(count = 4) {
    if (reduced || !socialLayer?.classList.contains('active')) return;
    const r = phone.getBoundingClientRect();
    const cx = r.left + r.width * .62;
    const cy = r.top + r.height * .52;
    const nodes = [];
    for (let i = 0; i < count; i++) {
      const [label, cls] = burstItems[Math.floor(Math.random() * burstItems.length)];
      const n = document.createElement('div');
      n.className = `v61Burst ${cls}`;
      n.textContent = label;
      n.style.left = `${cx + (Math.random() - .5) * r.width * .28}px`;
      n.style.top = `${cy + (Math.random() - .5) * r.height * .08}px`;
      n.style.setProperty('--x', `${(Math.random() - .5) * 220}px`);
      n.style.setProperty('--y', `${-(120 + Math.random() * 220)}px`);
      n.style.setProperty('--r', `${(Math.random() - .5) * 28}deg`);
      n.style.setProperty('--dur', `${1.05 + Math.random() * .55}s`);
      document.body.appendChild(n);
      nodes.push(n);
    }
    setTimeout(() => nodes.forEach(n => n.remove()), 1800);
  }

  function update() {
    const p = stageP();
    let scale = .92, ry = -10, rx = 4, rz = -1, x = 0, y = 0;

    // Social discovery: small cinematic approach, no random spinning.
    if (p < .26) {
      const t = seg(p, 0, .26);
      scale = mix(.92, 1.0, t);
      ry = mix(-10, -5, t);
      x = mix(0, -8, t);
    }
    // Analysis begins: the phone faces the user because it becomes the tool.
    else if (p < .62) {
      const t = seg(p, .26, .62);
      scale = mix(1.0, 1.04, t);
      ry = mix(-5, 0, t);
      rx = mix(4, 0, t);
      rz = mix(-1, 0, t);
      x = mix(-8, -18, t);
    }
    // Diagnostic: phone pulls back slightly so the metrics can appear around it.
    else if (p < .80) {
      const t = seg(p, .62, .80);
      scale = mix(1.04, .94, t);
      ry = 0; rx = 0; rz = 0;
      x = mix(-18, -10, t);
    }
    // Upload/analyse state: stable, straight, ready to use.
    else {
      const t = seg(p, .80, .92);
      scale = mix(.94, 1.0, t);
      ry = 0; rx = 0; rz = 0;
      x = mix(-10, -4, t);
    }

    phoneRig.style.setProperty('--vp-phone-scale', scale.toFixed(3));
    phoneRig.style.setProperty('--vp-phone-x', `${x}px`);
    phoneRig.style.setProperty('--vp-phone-y', `${y}px`);
    phone.style.setProperty('--vp-phone-ry', `${ry}deg`);
    phone.style.setProperty('--vp-phone-rx', `${rx}deg`);
    phone.style.setProperty('--vp-phone-rz', `${rz}deg`);

    sticky.classList.toggle('v61-analysis', p > .69);

    // Trigger a few social reactions at meaningful scroll beats, not continuously.
    const beats = [.035, .09, .155, .22];
    beats.forEach((b, i) => {
      if (lastP < b && p >= b && burstMark !== i) {
        burstMark = i;
        burst(innerWidth < 900 ? 2 : 4);
      }
    });
    if (p < .02) burstMark = -1;
    lastP = p;
    raf = 0;
  }

  const request = () => { if (!raf) raf = requestAnimationFrame(update); };
  addEventListener('scroll', request, { passive: true });
  addEventListener('resize', request, { passive: true });
  request();

  // One controlled click burst remains as a signature interaction.
  phone.addEventListener('click', () => {
    if (stageP() < .25) burst(innerWidth < 900 ? 5 : 9);
  }, { passive: true });
})();
