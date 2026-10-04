/* Viral+ V6 patch — clearer story, meaningful motion, reliable email confirmation */
(() => {
  const byId = (id) => document.getElementById(id);
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const returnUrl = `${location.origin}${location.pathname}`;

  function setCopy(index, eyebrow, title, text) {
    const el = document.querySelector(`.copy${index}`);
    if (!el) return;
    const small = el.querySelector(':scope > small');
    const h = el.querySelector(index === 0 ? 'h1' : 'h2');
    const p = el.querySelector('p');
    if (small) small.textContent = eyebrow;
    if (h) h.innerHTML = title;
    if (p) p.textContent = text;
  }

  // 1) Make the product understandable in a few seconds.
  const hero = document.querySelector('.copy0');
  if (hero) {
    const h1 = hero.querySelector('h1');
    const p = hero.querySelector('p');
    if (h1) h1.innerHTML = 'SAIS CE QUI BLOQUE <span>TA VIDÉO AVANT DE PUBLIER.</span>';
    if (p) p.textContent = 'Importe ton Reel. Viral+ analyse le hook, la rétention, le visuel et le potentiel de partage, puis te donne les corrections prioritaires.';
    const actions = hero.querySelector('.heroActions');
    if (actions && !hero.querySelector('.v6Promise')) {
      const proof = document.createElement('div');
      proof.className = 'v6Promise';
      proof.innerHTML = '<span><i></i>Score clair</span><span><i></i>Corrections concrètes</span><span><i></i>Re-score avant/après</span>';
      actions.insertAdjacentElement('afterend', proof);
    }
  }
  setCopy(1, 'ÉTAPE 01', 'IMPORTE <span>TA VIDÉO.</span>', 'Tu choisis ton Reel. Pas de tableau compliqué : Viral+ prépare directement l’analyse.');
  setCopy(2, 'ÉTAPE 02', 'VIRAL+ <span>L’ANALYSE.</span>', 'Hook, rétention, clarté, visuel et partage : les points qui peuvent freiner ta vidéo sont vérifiés.');
  setCopy(3, 'ÉTAPE 03', 'VOIS CE QUI <span>BLOQUE.</span>', 'Un problème principal. Le moment précis. La correction à appliquer avant de publier.');
  setCopy(4, 'ÉTAPE 04', 'CORRIGE. <span>PUIS RE-SCORE.</span>', 'Tu compares la version avant et après pour vérifier que la vidéo est réellement plus forte.');

  const sticky = byId('stickyStage');
  if (sticky && !document.querySelector('.v6MicroHint')) {
    const hint = document.createElement('div');
    hint.className = 'v6MicroHint';
    hint.innerHTML = '<b>♥</b> Fais défiler : les signaux de viralité réagissent';
    sticky.appendChild(hint);
  }

  // 2) Add premium, colorful viral signals tied to real interactions.
  const phone = byId('phone');
  const socialLayer = byId('socialLayer');
  let burstLock = 0;
  const items = [
    ['♥', 'like'], ['💬', 'comment'], ['🔥', 'fire'], ['✨', 'comment'], ['↗', 'share'],
    ['+1 follower', 'pill'], ['12.4K vues', 'pill'], ['partagé', 'pill'], ['sauvegardé', 'pill']
  ];

  function stageIsSocial() {
    try { return socialLayer?.classList.contains('active') && stageProgress() < .22; }
    catch { return socialLayer?.classList.contains('active'); }
  }

  function premiumBurst(count = 9, intensity = 1) {
    if (reduced || !phone || !stageIsSocial()) return;
    const rect = phone.getBoundingClientRect();
    const cx = rect.left + rect.width * .58;
    const cy = rect.top + rect.height * .56;
    const nodes = [];
    for (let i = 0; i < count; i++) {
      const [label, cls] = items[Math.floor(Math.random() * items.length)];
      const n = document.createElement('div');
      n.className = `viralBurst ${cls}`;
      n.textContent = label;
      n.style.left = `${cx + (Math.random() - .5) * rect.width * .38}px`;
      n.style.top = `${cy + (Math.random() - .5) * rect.height * .12}px`;
      const spread = (120 + Math.random() * 210) * intensity;
      n.style.setProperty('--x', `${(Math.random() - .5) * spread * 1.45}px`);
      n.style.setProperty('--y', `${-(110 + Math.random() * spread)}px`);
      n.style.setProperty('--r', `${(Math.random() - .5) * 34}deg`);
      n.style.setProperty('--dur', `${1.05 + Math.random() * .8}s`);
      document.body.appendChild(n);
      nodes.push(n);
    }
    setTimeout(() => nodes.forEach(n => n.remove()), 2200);
  }

  function pulsePhone() {
    if (reduced || !phone) return;
    const r = phone.getBoundingClientRect();
    const ring = document.createElement('div');
    ring.className = 'phonePulse';
    ring.style.left = `${r.left + r.width / 2}px`;
    ring.style.top = `${r.top + r.height / 2}px`;
    document.body.appendChild(ring);
    setTimeout(() => ring.remove(), 1000);
  }

  phone?.addEventListener('pointerenter', () => premiumBurst(innerWidth < 900 ? 4 : 7, .75));
  phone?.addEventListener('click', () => { pulsePhone(); premiumBurst(innerWidth < 900 ? 8 : 14, 1.15); });
  addEventListener('wheel', () => {
    const now = performance.now();
    if (now - burstLock < 320 || !stageIsSocial()) return;
    burstLock = now;
    premiumBurst(innerWidth < 900 ? 3 : 6, .72);
  }, { passive: true });

  // 3) Make account creation reliable on Safari/iPhone.
  // Supabase's email confirmation must return to the actual Viral+ URL, then the implicit-flow tokens are restored here.
  async function finishEmailConfirmation() {
    if (!location.hash || !location.hash.includes('access_token=')) return false;
    const params = new URLSearchParams(location.hash.slice(1));
    const accessToken = params.get('access_token');
    const refreshToken = params.get('refresh_token');
    const expiresIn = Number(params.get('expires_in') || 3600);
    if (!accessToken) return false;
    try {
      const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${accessToken}` }
      });
      const user = userRes.ok ? await userRes.json() : null;
      const authSession = {
        access_token: accessToken,
        refresh_token: refreshToken,
        expires_in: expiresIn,
        expires_at: Math.floor(Date.now() / 1000) + expiresIn,
        token_type: params.get('token_type') || 'bearer',
        user
      };
      saveSession(authSession);
      history.replaceState({}, document.title, `${location.pathname}${location.search}`);
      closeAuth?.();
      await refreshEntitlement?.();
      await loadHistory?.();
      showToast?.('Email confirmé. Ton compte Viral+ est prêt.');
      return true;
    } catch (e) {
      console.error('Viral+ confirmation error', e);
      return false;
    }
  }

  const hashError = location.hash ? new URLSearchParams(location.hash.slice(1)).get('error_description') : '';
  if (hashError) {
    history.replaceState({}, document.title, `${location.pathname}${location.search}`);
    setTimeout(() => showToast?.(decodeURIComponent(hashError)), 150);
  } else {
    finishEmailConfirmation();
  }

  const authForm = byId('authForm');
  const authPassword = byId('authPassword');
  const authMessage = byId('authMessage');
  const authSubmit = byId('authSubmit');

  document.querySelectorAll('.authTabs button').forEach(btn => {
    btn.addEventListener('click', () => {
      if (authPassword) authPassword.autocomplete = btn.dataset.auth === 'signup' ? 'new-password' : 'current-password';
      if (authPassword) authPassword.minLength = 8;
    });
  });

  if (authForm) {
    // Capture phase: replace the old V5 submit flow before it executes.
    authForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      e.stopImmediatePropagation();
      const email = byId('authEmail')?.value.trim();
      const password = authPassword?.value || '';
      if (!email) return;
      if (password.length < 8) {
        authMessage.textContent = 'Utilise au moins 8 caractères pour ton mot de passe.';
        return;
      }
      authSubmit.disabled = true;
      authMessage.classList.remove('authSuccess');
      authMessage.textContent = authMode === 'signup' ? 'Création du compte…' : 'Connexion…';
      try {
        if (authMode === 'signup') {
          const d = await supa('/auth/v1/signup', {
            method: 'POST',
            auth: false,
            query: `?redirect_to=${encodeURIComponent(returnUrl)}`,
            body: { email, password }
          });
          if (d.access_token) {
            d.expires_at = Math.floor(Date.now() / 1000) + (d.expires_in || 3600);
            saveSession(d);
            closeAuth();
            await refreshEntitlement();
            await loadHistory();
            showToast('Compte créé. Bienvenue dans Viral+.');
          } else {
            authMessage.classList.add('authSuccess');
            authMessage.textContent = 'Compte créé ✓ Ouvre l’email Viral+, puis reviens ici. Le lien te reconnectera automatiquement.';
          }
        } else {
          const d = await supa('/auth/v1/token', {
            method: 'POST', auth: false, query: '?grant_type=password', body: { email, password }
          });
          d.expires_at = Math.floor(Date.now() / 1000) + (d.expires_in || 3600);
          saveSession(d);
          closeAuth();
          await refreshEntitlement();
          await loadHistory();
          track?.('login');
          showToast('Connecté à Viral+.');
        }
      } catch (err) {
        authMessage.textContent = err?.message || 'Une erreur est survenue.';
      } finally {
        authSubmit.disabled = false;
      }
    }, true);
  }

  const authCard = document.querySelector('.authCard');
  if (authCard && !authCard.querySelector('.authTrust')) {
    const trust = document.createElement('div');
    trust.className = 'authTrust';
    trust.innerHTML = '<span>🔒 Compte sécurisé</span><span>3 analyses test</span><span>Aucune CB requise</span>';
    const tabs = authCard.querySelector('.authTabs');
    tabs?.insertAdjacentElement('beforebegin', trust);
  }
})();
