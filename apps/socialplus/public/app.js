import { fingerprintFile } from './fingerprint.js';
const $ = (selector, root = document) => root.querySelector(selector);
const main = $('#main');
const sheet = $('#sheet');
const state = {
  user: null, csrf: '', projects: [], styles: [], project: null,
  selectedStyle: null, file: null, objectUrl: null, strategyTab: 'overview',
  preview: null, authMode: 'login', busy: false, jobTimer: null
};

const paths = {
  home: '<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z"/>',
  film: '<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M7 3v18M17 3v18M3 8h4M3 16h4M17 8h4M17 16h4"/>',
  chart: '<path d="M4 3v17h17M8 14l4-5 4 2 5-7"/>',
  arrow: '<path d="M4 12h16m-6-6 6 6-6 6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  user: '<circle cx="12" cy="8" r="3.5"/><path d="M5 21v-2a7 7 0 0 1 14 0v2"/>',
  upload: '<path d="M12 16V3m-5 5 5-5 5 5M4 16v4a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-4"/>',
  lock: '<rect x="5" y="10" width="14" height="11" rx="3"/><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v.1"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  moon: '<path d="M20.5 14A9 9 0 0 1 10 3.5 9 9 0 1 0 20.5 14Z"/>',
  book: '<path d="M12 5c-3-2-6-2-9-1v15c3-1 6-1 9 1 3-2 6-2 9-1V4c-3-1-6-1-9 1Zm0 0v15"/>',
  message: '<path d="M21 11a8 8 0 0 1-8 8H7l-5 3 2-6a8 8 0 0 1-1-5 8 8 0 0 1 18 0Z"/>',
  download: '<path d="M12 3v13m-5-5 5 5 5-5M4 17v4h16v-4"/>',
  shield: '<path d="m12 2 8 4v6c0 5-8 10-8 10S4 17 4 12V6Z"/><path d="m8 11 3 3 5-6"/>',
  exit: '<path d="M9 3H4v18h5m5-15 6 6-6 6M8 12h12"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  spark: '<path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5Z"/>'
};
const icon = name => `<svg viewBox="0 0 24 24" aria-hidden="true">${paths[name] || paths.info}</svg>`;
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const date = value => value ? new Date(value).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Sans échéance';
const number = value => value == null ? 'Non disponible' : new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 }).format(value);
const button = (label, action, secondary = false, attributes = '') => `<button class="button${secondary ? ' secondary' : ''}" data-action="${action}" ${attributes}>${label}</button>`;
const field = (name, label, value = '', type = 'text', attributes = '') => `<label>${label}<input name="${name}" type="${type}" value="${esc(value)}" ${attributes}></label>`;
const empty = (title, text, action = '') => `<div class="empty-state"><div class="icon-tile">${icon('film')}</div><h3>${title}</h3><p>${text}</p>${action}</div>`;

function hydrateIcons(root = document) {
  root.querySelectorAll('[data-icon]').forEach(element => { element.innerHTML = icon(element.dataset.icon); });
}

async function api(path, options = {}) {
  const headers = { ...(options.body instanceof Blob ? {} : { 'Content-Type': 'application/json' }), ...options.headers };
  if (state.csrf) headers['X-CSRF-Token'] = state.csrf;
  const response = await fetch(path, { credentials: 'same-origin', ...options, headers });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.message || `La demande a échoué (${response.status}).`);
    const trace=data.trace_id || response.headers.get('X-Trace-Id');
    if(response.status>=500 && trace)error.message+=` Référence : ${trace}`;
    error.code = data.code;
    error.status = response.status;
    throw error;
  }
  return data;
}

const post = (path, data = {}) => api(path, { method: 'POST', body: JSON.stringify(data) });
function notify(message) {
  $('#toast').textContent = message;
  $('#toast').hidden = false;
  clearTimeout(notify.timer);
  notify.timer = setTimeout(() => { $('#toast').hidden = true; }, 4800);
}
function openSheet(title, content) {
  $('#sheet-title').textContent = title;
  $('#sheet-body').innerHTML = content;
  hydrateIcons(sheet);
  if (!sheet.open) sheet.showModal();
}
function closeSheet() { sheet.close(); }
function setBusy(form, busy) {
  form.querySelectorAll('button[type="submit"]').forEach(element => {
    element.disabled = busy;
    if(busy){element.dataset.previousLabel=element.innerHTML;element.textContent='Un instant…';}
    else if(element.dataset.previousLabel){element.innerHTML=element.dataset.previousLabel;delete element.dataset.previousLabel;}
  });
  const error = $('.form-error', form);
  if (error && busy) error.textContent = '';
}
function formError(form, error) {
  let target = $('.form-error', form);
  if (!target) { target = document.createElement('p'); target.className = 'form-error'; target.setAttribute('role', 'alert'); form.append(target); }
  target.textContent = error.message;
}

async function session() {
  const data = await api('/api/session');
  state.user = data.user;
  state.csrf = data.csrf || data.user?.csrf || '';
  $('#main-nav').hidden = !state.user;
  $('#account-button').innerHTML = state.user ? esc((state.user.display_name || state.user.displayName || state.user.email || 'S').slice(0, 1).toUpperCase()) : icon('user');
  $('#account-button').title = state.user ? 'Mon compte' : 'Aide et confidentialité';
}

function auth() {
  const activation = state.authMode === 'activate';
  main.innerHTML = `<section class="page login-layout">
    <div class="login-intro"><p class="eyebrow">Votre espace de création</p><h1>Du contenu.<br>Du sens.<br>De l’impact.</h1><p>Montez vos vidéos avec intention. Comprenez vos résultats. Faites avancer votre création, dans un seul espace.</p>
      <div class="login-highlights"><span>${icon('film')}Six directions créatives</span><span>${icon('target')}Une stratégie claire</span><span>${icon('lock')}Vos données privées</span></div>
    </div>
    <div class="panel"><div class="segmented"><button data-action="auth-login" class="${activation ? '' : 'active'}">Connexion</button><button data-action="auth-activate" class="${activation ? 'active' : ''}">Invitation</button></div>
      <h2 class="auth-title">${activation ? 'Bienvenue chez vous.' : 'Votre création vous attend.'}</h2><p class="auth-description">${activation ? 'Activez votre invitation personnelle. Accès gratuit, aucune facturation.' : 'Connectez-vous à votre espace privé Social+.'}</p>
      <form class="form" data-form="${activation ? 'activate' : 'login'}">
        ${activation ? field('displayName', 'Votre prénom', '', 'text', 'required autocomplete="given-name" maxlength="80"') + field('code', 'Code d’invitation', new URLSearchParams(location.search).get('invite') || '', 'text', 'required autocomplete="off"') : ''}
        ${field('email', 'Adresse e-mail', '', 'email', 'required autocomplete="email"')}
        ${field('password', 'Mot de passe', '', 'password', `required minlength="12" autocomplete="${activation ? 'new-password' : 'current-password'}"`)}
        ${!activation ? field('totp', 'Code de l’authentificateur · propriétaire uniquement', '', 'text', 'inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" maxlength="6"') : '<label class="checkbox-label"><input name="acceptTerms" type="checkbox" required><span>J’accepte les <button type="button" class="text-button" data-action="legal" data-kind="terms">CGU</button> et j’ai lu la <button type="button" class="text-button" data-action="legal" data-kind="privacy">politique de confidentialité</button>.</span></label>'}
        <button type="submit" class="button full">${activation ? 'Activer mon accès' : 'Me connecter'}${icon('arrow')}</button><p class="form-error" role="alert"></p>
      </form><p class="help-text mt-17">${activation ? 'Votre invitation est personnelle. Une adresse confirmée par le propriétaire est nécessaire.' : 'Accès sur invitation. Récupération par code personnel fourni par le propriétaire.'}</p>
      <div class="public-footer"><button data-action="recover-access">Récupérer mon accès</button><button data-action="faq">FAQ</button><button data-action="support">Support</button><button data-action="legal" data-kind="legal">Mentions légales</button><button data-action="legal" data-kind="privacy">Confidentialité</button></div>
    </div></section>`;
}

function heading(eyebrow, title, description = '') {
  return `<div class="page-heading"><p class="eyebrow">${eyebrow}</p><h1>${title}</h1>${description ? `<p>${description}</p>` : ''}</div>`;
}

function projectCard(project) {
  return `<button class="project" data-action="open-project" data-id="${esc(project.id)}"><div class="project-media">${project.source_name || project.has_source ? `<video src="/api/projects/${encodeURIComponent(project.id)}/media#t=0.1" muted playsinline preload="metadata"></video>` : icon('film')}</div><div class="project-info"><h3>${esc(project.title || project.name || 'Sans titre')}</h3><p>${date(project.updated_at || project.created_at)}</p><span class="pill">${esc(({draft:'Brouillon',ready:'Source importée',rendering:'Rendu en cours',complete:'Export prêt'})[project.state] || project.status || 'Brouillon')}</span></div></button>`;
}

async function home() {
  const data = await api('/api/projects');
  state.projects = data.projects || [];
  const firstName = (state.user.display_name || state.user.displayName || '').split(' ')[0];
  const latest = state.projects[0];
  main.innerHTML = `<section class="page">${heading('Votre espace de création', `Bonjour${firstName ? `, ${esc(firstName)}` : ''}.`, 'Une idée à faire grandir ? Commencez ici.')}
    <div class="hero-layout"><article class="hero"><div><p class="eyebrow">${latest ? 'Reprendre votre élan' : 'Tout commence par une idée'}</p><h2>${latest ? esc(latest.title || latest.name || 'Votre dernier projet') : 'Votre prochain<br>contenu commence ici.'}</h2><p>${latest ? `Enregistré le ${date(latest.updated_at || latest.created_at)}. Votre projet vous attend.` : 'Un rush. Une direction créative. Votre voix, mise en valeur.'}</p></div>${button(`${icon(latest ? 'film' : 'plus')}${latest ? 'Reprendre le projet' : 'Nouveau montage'}`, latest ? 'open-project' : 'new-project', false, latest ? `data-id="${esc(latest.id)}"` : '')}</article>
    <article class="action-card"><div><div class="icon-tile">${icon('chart')}</div><h2>Créez avec<br>une direction.</h2><p>Un diagnostic clair et des actions concrètes à partir de vos propres données.</p></div><a href="#strategy" class="text-button">Analyser mon compte${icon('arrow')}</a></article></div>
    <div class="section-heading"><div><h2>Vos projets</h2><p>${state.projects.length ? `${state.projects.length} projet${state.projects.length > 1 ? 's' : ''} enregistré${state.projects.length > 1 ? 's' : ''}` : 'Un espace pour vos prochaines créations.'}</p></div>${button(`${icon('plus')}Nouveau`, 'new-project', true)}</div>
    ${state.projects.length ? `<div class="project-list">${state.projects.map(projectCard).join('')}</div>` : empty('Votre première création, bientôt ici.', 'Importez un rush pour créer un projet. Il sera enregistré dans votre espace privé.', '<a href="#montage" class="text-button">Ouvrir Montage' + icon('arrow') + '</a>')}
    <div class="notice">${icon('lock')}<span>Votre espace est privé. Les statistiques et les projets affichés proviennent uniquement de vos propres données.</span></div></section>`;
}

async function montage() {
  const catalog = await api('/api/studio/styles');
  state.styles = catalog.styles || catalog;
  if (!Array.isArray(state.styles)) state.styles = [];
  if (!state.selectedStyle) state.selectedStyle = state.styles[0]?.style_id || state.styles[0]?.id;
  const project = state.project;
  main.innerHTML = `<section class="page">${heading('Montage', 'Votre voix. Votre style.', 'Importez votre vidéo et choisissez sa direction créative.')}
    <div class="workspace"><div>
      ${project?.source_name || project?.has_source || state.objectUrl ? `<div class="video-stage"><video id="source-preview" controls playsinline preload="metadata" src="${state.objectUrl || '/api/projects/' + encodeURIComponent(project.id) + '/media'}"></video></div><div class="file-detail"><div><strong>${esc(state.file?.name || project.source_name || project.name || project.title)}</strong><p>${state.file ? number(state.file.size / 1048576) + ' Mo · aperçu local' : 'Source enregistrée dans votre espace'}</p></div><label class="text-button" for="video-input">Changer</label></div>` : `<label class="upload-area" for="video-input"><span class="icon-tile">${icon('upload')}</span><h3>Choisir votre rush</h3><p>Photothèque, caméra ou fichiers.<br>Votre vidéo conserve son format natif.</p><small>MP4, MOV, WebM · jusqu’à 200 Mo</small></label>`}
      <input class="visually-hidden" id="video-input" type="file" accept="video/mp4,video/quicktime,video/webm,video/*">
      <div id="upload-status" aria-live="polite"></div>${project?.metadata ? `<p class="help-text">${project.metadata.width} × ${project.metadata.height} · ${number(project.metadata.durationMs/1000)} s · ${project.metadata.hasAudio?'Piste audio détectée':'Audio non détecté'} · format natif</p>` : ''}${project?.has_source ? `<a class="text-button" href="/api/projects/${encodeURIComponent(project.id)}/media" download="${esc(project.source_name || 'rush-source')}">${icon('download')}Télécharger ma source</a>` : ''}
      <form class="form section" data-form="project-save">${field('title', 'Nom du projet', project?.name || project?.title || state.file?.name?.replace(/\.[^.]+$/, '') || '', 'text', 'required maxlength="120" placeholder="Donnez un nom à votre création"')}
        <button class="button secondary" type="submit" ${!state.file && !project ? 'disabled' : ''}>${icon('check')}Enregistrer le projet</button><p class="form-error" role="alert"></p></form>
      <div class="notice">${icon('info')}<span>La vidéo est d’abord lue sur cet appareil. L’enregistrement l’envoie à votre espace privé. Aucun service externe payant n’est appelé.</span></div>
      <div class="panel section"><h3>Paroles et synchronisation</h3><p class="help-text">Si le moteur l’exige, fournissez des mots alignés et vérifiés. Aucun sous-titre n’est inventé.</p><label class="mt-15">Transcription alignée JSON · facultative<textarea id="transcript" rows="4" placeholder='[{"text":"Bonjour","start":0.2,"end":0.6}]'></textarea></label></div>
    </div><div><div class="row between mb-18"><h2>Direction créative</h2><span class="pill">6 modèles</span></div><div class="model-list">${state.styles.map((style, index) => {
      const id = style.style_id || style.id;
      const available = style.available || style.enabled || style.status === 'production';
      return `<button class="model" data-action="select-style" data-id="${esc(id)}" aria-pressed="${id === state.selectedStyle}"><span class="model-number">0${index + 1}</span><span><strong>${esc(style.display_name || style.label || style.name)}</strong><small>${esc(style.version || '')}</small></span><span class="pill ${available ? 'good' : ''}">${available ? (style.status === 'production' ? 'Disponible' : 'Bêta') : 'Indisponible'}</span></button>`;
    }).join('')}</div><div id="model-detail" class="model-detail"></div>
      <button class="button full section" data-action="render" ${!project?.id ? 'disabled' : ''}>${icon('spark')}Lancer le montage</button><div id="render-status" aria-live="polite"></div><div class="panel section"><h3>Exporter votre source</h3><p class="help-text">Convertissez votre vidéo en MP4 H.264/AAC avec son audio original et son format natif. Cette opération technique ne réalise aucun montage artistique.</p><button class="button secondary full section" data-action="technical-export" ${!project?.has_source ? 'disabled' : ''}>${icon('download')}Exporter la source en MP4</button></div>${project?.has_output ? `<a class="button secondary full section" href="/api/projects/${encodeURIComponent(project.id)}/output?download=1" download>${icon('download')}Télécharger mon dernier export</a>` : ''}${project?.id ? `<button class="text-button section" data-action="delete-project">Supprimer ce projet</button>` : ''}
      <div class="notice">${icon('shield')}<span>Les modèles sont des références visuelles validées. Leur disponibilité dépend des sources et de la recette de chaque moteur.</span></div>
    </div></div></section>`;
  updateStyleDetail();
}

function updateStyleDetail() {
  const style = state.styles.find(item => (item.style_id || item.id) === state.selectedStyle);
  if (!style || !$('#model-detail')) return;
  const available = style.available || style.enabled || style.status === 'production';
  $('#model-detail').innerHTML = `<p>${esc(style.description || style.reason || style.unavailable_reason || (available ? 'Moteur disponible pour essais. Les contrôles qualité restent requis.' : 'Sources ou dépendances de rendu non disponibles. Aucun rendu de remplacement ne sera généré.'))}</p>${(style.missingSources || style.missing)?.length ? `<p class="mt-8">Éléments requis : ${(style.missingSources || style.missing).map(esc).join(', ')}</p>` : ''}`;
  const renderButton = $('[data-action="render"]');
  if (renderButton) renderButton.disabled = !available || !state.project?.id;
  document.querySelectorAll('.model').forEach(element => element.setAttribute('aria-pressed', String(element.dataset.id === state.selectedStyle)));
}

async function strategy() {
  main.innerHTML = `<section class="page">${heading('Stratégie', 'Créez. Comprenez. Progressez.', 'Vos données, des constats explicables et les prochaines actions utiles.')}<div class="subnav" role="group" aria-label="Sections Stratégie">${[['overview','Vue d’ensemble'],['profile','Mon profil'],['metrics','Performances'],['video','Analyser une vidéo'],['methods','Méthodes'],['competitors','Concurrence'],['results','Résultats']].map(([id,label]) => `<button data-action="strategy-tab" data-id="${id}" class="${state.strategyTab === id ? 'active' : ''}">${label}</button>`).join('')}</div><div id="strategy-content"><div class="loading-screen"><span class="spinner"></span></div></div></section>`;
  const content = $('#strategy-content');
  if (state.strategyTab === 'profile') {
    const { profile = {} } = await api('/api/strategy/profile');
    content.innerHTML = `<div class="panel"><h2>Une direction qui vous ressemble.</h2><p>Ces informations rendent vos recommandations plus pertinentes. Aucune connexion Instagram n’est simulée.</p><form class="form" data-form="profile"><div class="field-grid">${field('handle','Identifiant du compte',profile.handle,'text','placeholder="@votrecompte"')}<label>Plateforme<select name="platform"><option value="instagram">Instagram</option><option value="tiktok">TikTok</option><option value="youtube">YouTube</option></select></label></div>${field('niche','Votre domaine',profile.niche,'text','placeholder="Le sujet sur lequel vous apportez de la valeur"')}${field('target_audience','Votre audience',profile.target_audience,'text','placeholder="À qui vous adressez-vous ?"')}${field('offer','Votre proposition',profile.offer)}<label>Votre bio actuelle<textarea name="bio_text" maxlength="2500">${esc(profile.bio_text)}</textarea></label><label>Objectif prioritaire<select name="goal_type">${[['awareness','Développer ma visibilité'],['community','Renforcer ma communauté'],['leads','Générer des prospects']].map(([value,label])=>`<option value="${value}" ${profile.goal_type===value?'selected':''}>${label}</option>`).join('')}</select></label>${field('goal_details','Comment reconnaîtrez-vous un progrès ?',profile.goal_details)}<button type="submit" class="button">Enregistrer mon profil${icon('check')}</button><p class="form-error" role="alert"></p></form></div>`;
    $('[name="platform"]', content).value = profile.platform || 'instagram';
  } else if (state.strategyTab === 'metrics') await metrics(content);
  else if (state.strategyTab === 'methods') {
    const { methods = [] } = await api('/api/strategy/methods');
    content.innerHTML = `<div class="panel"><h2>Comprendre le processus.</h2><p>Des méthodes à appliquer vous-même, avec leurs sources et leurs limites.</p>${methods.filter(method => method.enabled !== false).map(method => `<details><summary>${esc(method.id)} · ${esc(method.title)}<span class="pill ml-10">v${esc(method.version)}</span></summary><ol>${(method.process_steps || []).map(step=>`<li>${esc(typeof step === 'string' ? step : step.description)}</li>`).join('')}</ol><p><strong>À pratiquer</strong><br>${esc(method.exercise)}</p><p><strong>Indicateur de réussite</strong><br>${esc(Array.isArray(method.success_metrics) ? method.success_metrics.join(' · ') : method.success_metrics)}</p><p>${esc(Array.isArray(method.pitfalls) ? method.pitfalls.join(' · ') : method.pitfalls)}</p>${safeSource(method.source_url)}</details>`).join('')}</div>`;
  } else if (state.strategyTab === 'video') {
    content.innerHTML = `<div class="workspace"><div><label class="upload-area" for="analysis-video"><span class="icon-tile">${icon('film')}</span><h3>Avant de publier.</h3><p>Vérifiez les caractéristiques de votre vidéo. Le fichier reste sur cet appareil.</p><small>Aucun envoi vidéo pour ce précontrôle</small></label><input id="analysis-video" class="visually-hidden" type="file" accept="video/*"><div id="analysis-preview" class="section"></div></div><div class="panel"><h2>Un regard mesuré.</h2><p>Les critères qui ne peuvent pas être observés restent « non évaluables ».</p><form class="form" data-form="video-analysis"><label>Objectif<select name="goal_type"><option value="awareness">Visibilité</option><option value="community">Communauté</option><option value="leads">Prospects</option></select></label><p class="help-text">Sans transcription fiable et revue éditoriale, le précontrôle ne produit aucun score global. Il ne prédit jamais les vues ni la viralité.</p>${editorialReview()}<button type="submit" class="button" id="analyze-video-button" disabled>Vérifier ma vidéo${icon('arrow')}</button><p class="form-error" role="alert"></p></form><div id="video-analysis-result" class="section" aria-live="polite"></div></div></div>`;
  } else if (state.strategyTab === 'results') {
    await resultsPanel(content);
  } else if (state.strategyTab === 'competitors') {
    const { competitors = [] } = await api('/api/strategy/competitors');
    content.innerHTML = `<div class="grid-two stack-mobile"><div class="panel"><h2>Observer pour se différencier.</h2><p>Ajoutez de 3 à 5 profils publics et vos observations. Aucune collecte automatisée.</p><form class="form" data-form="competitor">${field('handle','Compte public','','text','required placeholder="@compte"')}<label>Plateforme<select name="platform"><option value="instagram">Instagram</option><option value="tiktok">TikTok</option><option value="youtube">YouTube</option></select></label>${field('source_public','Lien public de la source','','url','required')}<label>Vos observations<textarea name="relevant_notes" required placeholder="Audience, promesse, formats, différences à tester…"></textarea></label><button type="submit" class="button">Ajouter mon observation${icon('plus')}</button><p class="form-error" role="alert"></p></form></div><div class="panel"><h2>Vos repères</h2>${competitors.length ? competitors.map(item=>`<article class="mission"><h3>${esc(item.handle)}</h3><p>${esc(item.relevant_notes)}</p><small>Observation du ${date(item.collected_at || item.created_at)}</small>${safeSource(item.source_public)}<button class="text-button" data-action="delete-competitor" data-id="${esc(item.id)}">Supprimer cette observation</button></article>`).join('') : empty('Aucune observation pour le moment.', 'La comparaison commence par des faits publics et des notes sourcées.')}</div></div>`;
  } else {
    const [{ missions = [] }, { profile = {} }, { metrics: rows = [] }] = await Promise.all([api('/api/strategy/missions'), api('/api/strategy/profile'), api('/api/strategy/metrics')]);
    state.missions=missions;
    content.innerHTML = `<div class="hero-layout"><article class="hero hero-compact"><div><p class="eyebrow">Votre prochaine avancée</p><h2>${missions.length ? 'Une action à la fois.' : 'Commencez par votre cap.'}</h2><p>${missions.length ? 'Vos priorités sont reliées à des constats et à des méthodes.' : 'Décrivez votre profil, puis construisez un diagnostic sur vos données.'}</p></div>${button('Établir mon diagnostic' + icon('arrow'),'diagnose')}</article><div class="action-card"><div><div class="icon-tile">${icon('target')}</div><h2>${profile.niche ? esc(profile.niche) : 'Votre profil de créateur'}</h2><p>${profile.target_audience ? esc(profile.target_audience) : 'Votre audience, votre promesse et votre objectif.'}</p></div><button class="text-button" data-action="strategy-tab" data-id="profile">${profile.niche ? 'Ajuster mon profil' : 'Définir mon profil'}${icon('arrow')}</button></div></div>
      <div class="section-heading"><h2>Mes missions</h2><span class="pill">3 priorités maximum</span></div><div id="diagnostic-result" aria-live="polite"></div><div class="panel" id="mission-list">${missions.length ? missions.map(missionCard).join('') : empty('Le bon prochain pas.', 'Votre diagnostic fera émerger des missions adaptées aux informations disponibles.')}</div>
      <div class="section-heading"><h2>Mes résultats</h2><button class="text-button" data-action="strategy-tab" data-id="metrics">Voir les performances${icon('arrow')}</button></div>${rows.length ? `<div class="grid-two">${stat('Publications renseignées', rows.length, 'Source : vos saisies et imports')}${stat('Dernière collecte', date(rows[0].collected_at), esc(rows[0].source_kind || 'manuel'))}</div>` : `<div class="notice">${icon('chart')}<span>Aucune statistique importée. Ajoutez vos chiffres manuellement ou par CSV pour suivre des résultats réels.</span></div>`}`;
  }
}

function safeSource(url) {
  try { const parsed = new URL(url); if (parsed.protocol === 'https:' || parsed.protocol === 'http:') return `<a class="source-link" href="${esc(parsed.href)}" target="_blank" rel="noopener noreferrer">Consulter la source ↗</a>`; } catch {}
  return '';
}
function stat(label, value, source) { return `<div class="stat"><small>${label}</small><strong>${value}</strong><small>${source}</small></div>`; }
function missionCard(mission) {
  return `<article class="mission ${mission.status === 'done' ? 'done' : ''}"><div class="row between"><h3>${esc(mission.title)}</h3><span class="pill">${esc(mission.method_id || '')}</span></div><p>${esc(mission.finding?.observation || mission.observation || mission.description || '')}</p>${mission.steps?.length ? `<div class="form section">${mission.steps.map((step,index) => `<label class="checkbox-label"><input type="checkbox" data-mission-step="${index}" data-mission-id="${esc(mission.id)}" ${step.completed?'checked':''}><span>${esc(typeof step === 'string' ? step : step.description)}</span></label>`).join('')}</div>` : ''}${mission.exercise?`<p><strong>À pratiquer</strong><br>${esc(mission.exercise)}</p>`:''}${mission.finding?.how_to_measure?`<p class="help-text">Indicateur de réussite : ${esc(mission.finding.how_to_measure.join(' · '))}</p>`:''}${safeSource(mission.source_url)}<details><summary>Ma preuve d’exécution</summary><form class="form section" data-form="mission-proof" data-id="${esc(mission.id)}"><label>Ce que j’ai fait et observé<textarea name="completion_note" maxlength="2000" placeholder="Une action réalisée, une source, un constat…">${esc(mission.completion_note)}</textarea></label><button class="button secondary" type="submit">Enregistrer ma preuve</button><p class="form-error" role="alert"></p></form></details><button class="text-button" data-action="mission-status" data-id="${esc(mission.id)}" data-status="${mission.status === 'done' ? 'active' : 'done'}">${icon('check')}${mission.status === 'done' ? 'Réouvrir la mission' : 'Marquer comme réalisée'}</button></article>`;
}

async function metrics(content) {
  const { metrics: rows = [], notice = '', trend } = await api('/api/strategy/metrics');
  content.innerHTML = `<div class="section-heading mt-0"><div><h2>Vos performances réelles</h2><p>Chaque chiffre conserve sa source et sa date de collecte.</p></div></div><div class="grid-two stack-mobile"><div class="panel"><h3>Importer un CSV</h3><p class="help-text">Colonnes : publication_at, collected_at, external_post_id, reach, views, likes, comments, shares, saves. Séparateur ; accepté.</p><form class="form section" data-form="csv"><label>Plateforme<select name="platform"><option value="instagram">Instagram</option><option value="tiktok">TikTok</option><option value="youtube">YouTube</option></select></label><label>Fichier CSV<input type="file" name="csvfile" accept=".csv,text/csv" required></label><button class="button secondary" type="submit">Vérifier avant import${icon('arrow')}</button><p class="form-error" role="alert"></p></form></div><div class="panel"><h3>Saisir une publication</h3><p class="help-text">Laissez un champ vide si la donnée est inconnue. Un zéro est une mesure.</p><form class="form section" data-form="metric"><div class="field-grid">${field('external_post_id','Identifiant / lien','','text','required')}${field('publication_at','Date de publication','','date','required')}${field('collected_at','Date de collecte',new Date().toISOString().slice(0,10),'date','required')}</div><label>Plateforme<select name="platform"><option value="instagram">Instagram</option><option value="tiktok">TikTok</option><option value="youtube">YouTube</option></select></label><div class="field-grid">${['reach','views','likes','comments','shares','saves'].map((key,index)=>field(key,['Portée','Vues','J’aime','Commentaires','Partages','Enregistrements'][index],'','number','min="0" step="1"')).join('')}</div><details><summary>Contexte de comparaison · facultatif</summary><div class="field-grid section">${field('format','Format de publication','','text','placeholder="Reel, Short…"')}${field('observation_window','Fenêtre d’observation','','text','placeholder="24 h, 7 jours, 28 jours…"')}${field('video_duration_seconds','Durée vidéo (secondes)','','number','min="0" step="0.01"')}${field('average_watch_seconds','Visionnage moyen (secondes)','','number','min="0" step="0.01"')}${field('definition_version','Définition de la mesure','','text','placeholder="Source / définition fournie par la plateforme"')}</div></details><button class="button secondary" type="submit">Enregistrer ces chiffres${icon('check')}</button><p class="form-error" role="alert"></p></form></div></div><div id="csv-preview" class="section" aria-live="polite"></div>
    ${metricTrend(trend)}
    ${rows.length ? `<div class="panel section"><h3>Historique des publications</h3><div class="table-wrap"><table><thead><tr><th>Publication</th><th>Plateforme</th><th>Portée</th><th>Vues</th><th>Partages / portée</th><th>Source</th><th>Collecte</th></tr></thead><tbody>${rows.map(row=>`<tr><td>${esc(row.external_post_id)}</td><td>${esc(row.platform)}</td><td>${number(row.reach)}</td><td>${number(row.views)}</td><td>${row.rates?.share_rate == null ? 'Non évaluable' : number(row.rates.share_rate) + ' %'}</td><td>${esc(row.source_kind)}</td><td>${date(row.collected_at)}</td></tr>`).join('')}</tbody></table></div><p class="help-text">${esc(notice || 'Les plateformes et les fenêtres d’observation différentes ne sont pas agrégées.')}</p></div>` : `<div class="notice section">${icon('info')}<span>Aucun historique disponible. Vos chiffres importés apparaîtront ici.</span></div>`}`;
}

function metricTrend(trend) {
  if(!trend?.available)return `<div class="notice section">${icon('chart')}<span>Évolution non évaluable. ${esc(trend?.reason || 'Renseignez le contexte des publications avant de comparer leurs résultats.')}</span></div>`;
  const points=trend.points,maximum=Math.max(1,...points.map(p=>p.value));
  const coords=points.map((point,index)=>({x:28+index/(points.length-1)*544,y:166-point.value/maximum*140,...point}));
  return `<figure class="panel section"><figcaption><h3>Évolution · ${esc(trend.metric)}</h3><p class="help-text">${esc(trend.platform)} · ${esc(trend.format)} · fenêtre ${esc(trend.observation_window)} · ${points.length} publications comparables</p></figcaption><svg class="metric-trend" viewBox="0 0 600 200" role="img" aria-label="Évolution descriptive des partages divisés par la portée, dans l’ordre des publications"><path class="trend-axis" d="M28 20v146h544"/><polyline points="${coords.map(p=>`${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')}"/>${coords.map(p=>`<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="4"><title>${esc(p.external_post_id)} : ${number(p.value)} % · ${esc(p.source_kind)} · collecte ${date(p.collected_at)}</title></circle>`).join('')}<text x="28" y="192">${esc(date(points[0].publication_at))}</text><text x="572" y="192" text-anchor="end">${esc(date(points.at(-1).publication_at))}</text></svg><p class="help-text">${esc(trend.notice)} Ordre chronologique ; le survol des points indique la mesure et sa source. Définition : ${esc(trend.definition_version)}.</p></figure>`;
}

function renderCsvPreview(preview) {
  const keys=['platform','publication_at','collected_at','external_post_id','reach','views','likes','comments','shares','saves','video_duration_seconds','average_watch_seconds','format','observation_window','definition_version','profile_visits','follows_attributed'];
  $('#csv-preview').innerHTML=`<div class="panel"><h3>Vérification de votre import</h3><p class="help-text section">${preview.valid_count} ligne(s) valide(s). ${(preview.errors || []).length} erreur(s). Aucune donnée n’a encore été importée.</p><details><summary>Vérifier la correspondance des colonnes</summary><form class="form section" data-form="csv-mapping">${(preview.columns || []).map(column=>`<label>${esc(column)}<select name="${esc(column)}"><option value="__ignore__">Ne pas importer</option>${keys.map(key=>`<option value="${key}" ${preview.column_mapping?.[column]===key?'selected':''}>${key}</option>`).join('')}</select></label>`).join('')}<button class="button secondary" type="submit">Actualiser l’aperçu</button><p class="form-error" role="alert"></p></form></details>${preview.errors?.length ? `<ul class="form-error">${preview.errors.map(error=>`<li>Ligne ${esc(error.row)} · ${esc(error.field)} : ${esc(error.message)}</li>`).join('')}</ul>` : ''}<div class="table-wrap"><table><thead><tr>${(preview.columns || []).slice(0,7).map(name=>`<th>${esc(name)}</th>`).join('')}</tr></thead><tbody>${(preview.rows || []).slice(0,5).map(row=>`<tr>${(preview.columns || []).slice(0,7).map(key=>`<td>${esc(row[preview.column_mapping?.[key] || key])}</td>`).join('')}</tr>`).join('')}</tbody></table></div><p class="help-text">Seules les lignes valides seront importées. Les erreurs restent affichées et les doublons seront ignorés.</p>${button('Confirmer l’import' + icon('check'),'commit-csv',false,preview.valid_count?'':'disabled')}</div>`;
}

function account() {
  openSheet(state.user ? 'Votre espace' : 'Aide et confidentialité', `${state.user ? `<div class="row mb-20"><div class="avatar">${esc((state.user.display_name || 'S').slice(0,1))}</div><div><h3>${esc(state.user.display_name || state.user.displayName || 'Votre compte')}</h3><p class="text-12">${esc(state.user.email)}</p></div></div><p class="help-text">Accès privé gratuit · ${state.user.access_expires_at ? 'jusqu’au ' + date(state.user.access_expires_at) : 'sans échéance'}</p>` : ''}<div class="menu-list"><button data-action="theme">${icon('moon')}Changer l’apparence</button><button data-action="faq">${icon('book')}Questions fréquentes</button>${state.user ? `<button data-action="feedback">${icon('message')}Donner mon avis</button><button data-action="my-feedback">${icon('message')}Mes messages privés</button><button data-action="redeem-invite">${icon('lock')}Activer une nouvelle invitation</button>` : ''}<button data-action="support">${icon('message')}Contacter le support</button><button data-action="legal" data-kind="privacy">${icon('shield')}Confidentialité et mes données</button><button data-action="legal" data-kind="terms">${icon('book')}Conditions d’utilisation</button><button data-action="legal" data-kind="legal">${icon('info')}Mentions légales</button>${state.user ? `<button data-action="export-data">${icon('download')}Exporter mes données</button>${!state.user.isOwner && state.user.role!=='owner' ? `<button data-action="delete-data">${icon('shield')}Demander la suppression de mes données</button>` : ''}${!state.user.isOwner && state.user.role!=='owner' ? `<button data-action="delete-account">${icon('shield')}Supprimer mon compte et mes données</button>` : ''}${state.user.isOwner || state.user.role === 'owner' ? `<a href="#admin" data-action="admin">${icon('lock')}Administration privée</a>` : ''}<button data-action="logout">${icon('exit')}Me déconnecter</button>` : ''}</div>`);
}

async function faq() {
  const { entries = [] } = await api('/api/faq');
  openSheet('Questions fréquentes', `<label>Rechercher<input id="faq-search" type="search" placeholder="Votre question…"></label><div id="faq-entries">${entries.map(entry=>`<details data-faq="${esc((entry.question + ' ' + entry.answer).toLowerCase())}"><summary>${esc(entry.question)}</summary><p>${esc(entry.answer)}</p><small>${esc(entry.category)}</small></details>`).join('') || '<p class="help-text section">La FAQ n’a pas encore été publiée par le propriétaire.</p>'}</div>`);
}

function feedback(support = false) {
  if(support) {
    openSheet('Contacter le support', `<p class="help-text">Votre message sera enregistré pour le propriétaire. Aucune notification par e-mail n’est envoyée automatiquement. Une adresse facultative permet de vous identifier, sans vérifier votre identité.</p><form class="form section" data-form="support">${field('contactEmail','Votre adresse e-mail · facultative',state.user?.email || '', 'email','autocomplete="email"')}<label>Votre message<textarea name="body" required minlength="10" maxlength="5000" placeholder="Décrivez votre demande ou votre problème d’accès…"></textarea></label><button class="button" type="submit">Transmettre au propriétaire${icon('arrow')}</button><p class="form-error" role="alert"></p></form>`);
    return;
  }
  if (!state.user) {
    openSheet('Récupérer votre accès', '<p>Votre espace est privé. Pour une invitation ou une récupération de compte, contactez directement la personne qui vous a transmis l’accès.</p><p class="help-text section">Les coordonnées publiques du support doivent être renseignées par le propriétaire avant ouverture aux équipes. Aucune adresse n’est inventée.</p>');
    return;
  }
  openSheet(support ? 'Contacter le support' : 'Votre avis compte.', `<p class="feedback-description">Votre message est privé. Il sera visible uniquement par vous et le propriétaire.</p><form class="form" data-form="feedback"><label>Catégorie<select name="category">${[['avis','Un avis'],['idee','Une idée'],['bug','Signaler un problème'],['support','Contacter le support']].map(([value,label])=>`<option value="${value}" ${support && value==='support'?'selected':''}>${label}</option>`).join('')}</select></label><label>Note facultative<select name="rating"><option value="">Sans note</option>${[5,4,3,2,1].map(n=>`<option value="${n}">${n} / 5</option>`).join('')}</select></label><label>Votre message<textarea name="body" required minlength="10" maxlength="5000" placeholder="Ce qui vous aide, ce qui pourrait être amélioré…"></textarea></label><label class="checkbox-label"><input type="checkbox" name="publicationConsent"><span>J’autorise séparément une éventuelle publication comme témoignage, après relecture. Je peux retirer cet accord.</span></label><button class="button" type="submit">Envoyer mon message${icon('arrow')}</button><p class="form-error" role="alert"></p></form>`);
}

async function legal(kind) {
  const labels = { privacy:'Confidentialité', terms:'Conditions d’utilisation', legal:'Mentions légales', cookies:'Cookies nécessaires' };
  try {
    const document = await api('/api/privacy/' + encodeURIComponent(kind));
    const body = document.document?.body || document.body || document.content;
    openSheet(labels[kind] || 'Informations', `${document.status==='draft' || document.complete===false || document.missing_fields?.length ? '<p class="form-error">Document de travail à compléter. L’ouverture aux équipes n’est pas validée tant que les mentions réelles manquent.</p>' : ''}<div class="legal-copy">${esc(body || 'Document non publié : identité de l’éditeur et contact réels à renseigner. L’ouverture aux équipes n’est pas validée.')}</div>${document.version ? `<p class="help-text section">Version ${esc(document.version)}</p>` : ''}`);
  } catch (error) {
    openSheet(labels[kind] || 'Informations', '<p>Document non publié : le propriétaire doit compléter l’identité de l’éditeur, le contact et les informations réelles avant l’ouverture aux équipes. L’ouverture aux équipes n’est pas validée tant que ces éléments manquent.</p><p class="help-text section">Les coordonnées juridiques, les sous-traitants et les durées de conservation ne sont pas inventés. Aucun traceur publicitaire n’est installé dans cette interface.</p>');
  }
}

async function admin() {
  if (!state.user?.isOwner && state.user?.role !== 'owner') throw new Error('Cette administration est réservée au propriétaire.');
  const [{ members = [] }, { invites = [] }, { entries = [] }, faqData] = await Promise.all([api('/api/admin/members'),api('/api/admin/invites'),api('/api/admin/feedback'),api('/api/admin/faq')]);
  const usage=await api('/api/admin/usage').catch(error=>({unavailable:error.message}));
  state.faqEntries = faqData.entries || [];
  main.innerHTML = `<section class="page">${heading('Propriétaire', 'Votre administration.', 'Gérez les accès et les retours. Les contenus privés des membres restent privés.')}${usagePanel(usage)}
    <div class="grid-two stack-mobile"><div class="panel"><h2>Une invitation personnelle.</h2><p>Le code est affiché une seule fois. Partagez-le par votre canal habituel.</p><form class="form" data-form="invite">${field('email','Adresse e-mail du membre','','email','required')}${field('team','Équipe · facultative')}<div class="field-grid"><label>Durée de l’accès<select name="durationDays"><option value="7">7 jours</option><option value="30">30 jours</option><option value="permanent">Permanent</option></select></label><label>Validité du code<select name="codeExpiresDays"><option value="7">7 jours</option><option value="1">1 jour</option><option value="30">30 jours</option></select></label></div><label class="checkbox-label"><input name="emailVerifiedByOwner" type="checkbox" required><span>J’ai vérifié personnellement l’adresse e-mail et l’identité du destinataire.</span></label><button type="submit" class="button">Créer l’invitation${icon('plus')}</button><p class="form-error" role="alert"></p></form><div id="invite-result" aria-live="polite"></div></div><div class="panel"><h2>Les accès en cours</h2>${invites.length ? invites.map(item=>`<article class="mission"><div class="row between"><strong>${esc(item.email || item.target_email || item.code_prefix || 'Invitation personnelle')}</strong><span class="pill">${item.uses || 0}/${item.max_uses || 1}</span></div><p>Code valide jusqu’au ${date(item.expires_at)} · ${esc(item.team || 'Sans équipe')}</p>${item.is_active === false || item.revoked_at ? '<small>Révoquée</small>' : `<button class="text-button" data-action="revoke-invite" data-id="${esc(item.id)}">Révoquer ce code</button>`}</article>`).join('') : '<p class="help-text">Aucune invitation créée.</p>'}</div></div>
    <div class="section-heading"><h2>Membres</h2><span class="pill">${members.length} compte${members.length > 1 ? 's' : ''}</span></div><div class="panel"><div class="table-wrap"><table><thead><tr><th>Membre</th><th>Équipe</th><th>Accès</th><th>Actions</th></tr></thead><tbody>${members.map(member=>`<tr><td>${esc(member.display_name)}<br><small>${esc(member.email)}</small></td><td>${esc(member.team || '—')}</td><td>${member.role==='owner'?'Propriétaire':member.disabled_at?'Suspendu':member.grant?(member.grant.expires_at?'Actif · '+date(member.grant.expires_at):'Permanent'):({revoked:'Révoqué',expired:'Expiré',pending:'En attente'})[member.access_status] || 'Aucun accès actif'}</td><td>${member.role==='owner' ? 'Propriétaire' : `<button class="text-button" data-action="member-action" data-id="${esc(member.id)}" data-operation="${member.disabled_at?'restore':'suspend'}">${member.disabled_at?'Rétablir':'Suspendre'}</button> <button class="text-button" data-action="extend-member" data-id="${esc(member.id)}">Prolonger</button> <button class="text-button" data-action="member-action" data-id="${esc(member.id)}" data-operation="revoke">Révoquer</button> <button class="text-button" data-action="issue-reset" data-id="${esc(member.id)}">Récupération</button>`}</td></tr>`).join('')}</tbody></table></div></div>
    <div class="section-heading"><h2>Retours privés</h2></div><div class="panel">${entries.length ? entries.map(entry=>`<article class="mission"><div class="row between"><h3>${esc(entry.category)}</h3><span class="pill">${esc(entry.status || entry.triage_state)}</span></div><p>${esc(entry.body)}</p><small>${date(entry.created_at)} · ${entry.publicationConsent || entry.publication_consent ? 'Accord de publication renseigné' : 'Privé'}</small><form class="form section" data-form="feedback-reply" data-id="${esc(entry.id)}"><label>Réponse privée<textarea name="reply" maxlength="5000">${esc(entry.reply || entry.owner_reply)}</textarea></label><label>Statut<select name="status"><option value="nouveau" ${entry.status==='nouveau'?'selected':''}>Nouveau</option><option value="en cours" ${entry.status==='en cours'?'selected':''}>En cours</option><option value="résolu" ${entry.status==='résolu'?'selected':''}>Résolu</option></select></label><button class="button secondary" type="submit">Enregistrer la réponse</button><p class="form-error" role="alert"></p></form></article>`).join('') : '<p class="help-text">Aucun message reçu.</p>'}</div>
    <div class="section-heading"><h2>FAQ</h2></div><div class="grid-two stack-mobile"><div class="panel"><h3>Publier une réponse utile.</h3><form class="form section" data-form="faq-edit">${field('question','Question','','text','required maxlength="250"')}<label>Réponse<textarea name="answer" required maxlength="5000"></textarea></label>${field('category','Catégorie','Premiers pas')}${field('sortOrder','Ordre d’affichage',0,'number','min="0" max="10000" step="1"')}<label class="checkbox-label"><input name="published" type="checkbox" checked><span>Publier cette réponse</span></label><button type="submit" class="button secondary">Enregistrer la FAQ</button><p class="form-error" role="alert"></p></form></div><div class="panel">${(faqData.entries || []).map(entry=>`<details><summary>${esc(entry.question)}</summary><p>${esc(entry.answer)}</p><button class="text-button" data-action="edit-faq" data-id="${esc(entry.id)}">Modifier cette réponse</button><button class="text-button" data-action="faq-toggle" data-id="${esc(entry.id)}" data-published="${!entry.published}">${entry.published ? 'Archiver' : 'Publier'}</button></details>`).join('') || '<p class="help-text">Aucune FAQ publiée.</p>'}</div></div>
    <div class="section"><div class="row wrap"><button class="text-button" data-action="support-admin">Messages du support${icon('arrow')}</button><button class="text-button" data-action="method-admin">Gérer les méthodes${icon('arrow')}</button><button class="text-button" data-action="deletion-requests">Demandes de suppression${icon('arrow')}</button><button class="text-button" data-action="audit-log">Journal d’administration${icon('arrow')}</button></div></div></section>`;
}

async function supportAdmin() {
  const {entries=[]}=await api('/api/admin/support');
  openSheet('Messages de support',entries.map(entry=>`<article class="mission"><h3>${esc(entry.contact_email || 'Sans adresse de contact')}</h3><small>${entry.contact_email?(entry.contact_verified?'Adresse vérifiée':'Adresse non vérifiée'):'Aucune adresse fournie'} · ${date(entry.created_at)}</small><p>${esc(entry.body)}</p><form class="form section" data-form="support-note" data-id="${esc(entry.id)}"><label>Note interne · aucune notification<textarea name="note" maxlength="5000">${esc(entry.owner_note)}</textarea></label><label>Statut<select name="status">${['nouveau','en cours','résolu'].map(status=>`<option value="${status}" ${entry.status===status?'selected':''}>${status}</option>`).join('')}</select></label><button class="button secondary" type="submit">Enregistrer</button><p class="form-error" role="alert"></p></form><button class="text-button" data-action="delete-support" data-id="${esc(entry.id)}">Supprimer ce message</button></article>`).join('') || '<p>Aucun message reçu.</p>');
}

function usagePanel(usage) {
  if(usage.unavailable)return `<div class="notice">${icon('info')}<span>Consommation non disponible : ${esc(usage.unavailable)}</span></div>`;
  const jobs=(usage.render_jobs || []).reduce((sum,row)=>sum+Number(row.count),0);
  const complete=(usage.render_jobs || []).filter(row=>['complete','completed'].includes(row.state)).reduce((sum,row)=>sum+Number(row.count),0);
  return `<div class="grid-three admin-usage">${stat('Projets enregistrés',number(usage.projects),'Agrégat de l’espace privé')}${stat('Stockage des vidéos',number(usage.storage_bytes/1048576)+' Mo',`Limite par membre : ${number(usage.limits?.user_storage_bytes/1048576)} Mo`)}${stat('Traitements terminés',number(complete)+' / '+number(jobs),`${number(usage.completed_render_seconds)} s de traitement mesurées`)}</div><div class="notice">${icon('info')}<span>${number(usage.external_paid_calls)} appel à un service externe facturé dans ce serveur. Limite par membre : ${number(usage.limits?.renders_per_day)} traitements par jour UTC. ${esc(usage.cost_notice || 'Les coûts de la machine et de l’hébergement ne sont pas mesurés.')}</span></div>`;
}

async function methodAdmin() {
  const {methods=[]}=await api('/api/admin/method-versions');
  state.adminMethods=methods;
  openSheet('Bibliothèque des méthodes',methods.map(method=>`<article class="mission"><div class="row between"><h3>${esc(method.id)} · ${esc(method.title)}</h3><span class="pill">v${esc(method.version)}</span></div><p class="help-text">${method.enabled===false?'Désactivée':'Publiée'} · ${esc(method.source_title || '')}</p><div class="row wrap"><button class="text-button" data-action="edit-method" data-id="${esc(method.id)}">Publier une nouvelle version</button><button class="text-button" data-action="toggle-method" data-id="${esc(method.id)}" data-enabled="${method.enabled===false}">${method.enabled===false?'Activer':'Désactiver'}</button></div></article>`).join(''));
}

async function route() {
  clearTimeout(state.jobTimer);
  const target = location.hash.slice(1).split('?')[0] || 'home';
  $('#main-nav').querySelectorAll('a').forEach(element => {
    if (element.dataset.tab === target) element.setAttribute('aria-current','page');
    else element.removeAttribute('aria-current');
  });
  if (!state.user) return auth();
  try {
    if (target === 'montage') await montage();
    else if (target === 'strategy') await strategy();
    else if (target === 'admin') await admin();
    else await home();
    main.focus({ preventScroll:true });
  } catch (error) {
    main.innerHTML = `<section class="page">${heading('Votre espace','Une action à reprendre.')}<div class="panel"><p class="form-error">${esc(error.message)}</p><button class="button secondary section" data-action="retry">Réessayer</button></div></section>`;
  }
}

async function saveProject(form) {
  const title = new FormData(form).get('title');
  if (!state.project) {
    const result = await post('/api/projects', { name: title });
    state.project = result.project || result;
  } else {
    const result = await api('/api/projects/' + encodeURIComponent(state.project.id), { method:'PATCH',body:JSON.stringify({name:title}) });
    state.project = result.project || { ...state.project,title };
  }
  if (state.file) {
    const status = $('#upload-status');
    status.innerHTML = '<div class="notice">' + icon('upload') + '<span>Enregistrement de la vidéo… Gardez cette page ouverte.</span></div><div class="progress-track"><span></span></div>';
    const result = await api('/api/projects/' + encodeURIComponent(state.project.id) + '/source', {
      method:'POST',body:state.file,headers:{'Content-Type':state.file.type || 'application/octet-stream','X-Filename':encodeURIComponent(state.file.name)}
    });
    state.project = result.project || { ...state.project,source_name:state.file.name,has_source:true };
    state.file = null;
    if (state.objectUrl) URL.revokeObjectURL(state.objectUrl);
    state.objectUrl = null;
  }
  notify('Votre projet est enregistré.');
  await montage();
}

async function renderProject(styleId = state.selectedStyle) {
  const transcript = $('#transcript')?.value.trim();
  let aligned;
  if (transcript) { try { aligned = JSON.parse(transcript); } catch { throw new Error('La transcription doit être un tableau JSON valide.'); } }
  const area = $('#render-status');
  area.innerHTML = '<div class="notice">' + icon('clock') + '<span>Vérification du moteur et des sources…</span></div>';
  try {
    const data = await post('/api/projects/' + encodeURIComponent(state.project.id) + '/render', {style_id:styleId,transcript:aligned});
    const job = data.job || data;
    if (!job.id && !job.job_id) throw new Error('Le moteur n’a pas retourné de tâche de rendu.');
    await pollJob(job.id || job.job_id);
  } catch (error) {
    area.innerHTML = `<p class="form-error section">${esc(error.message)}</p>`;
  }
}

async function pollJob(id) {
  const data = await api('/api/jobs/' + encodeURIComponent(id));
  const job = data.job || data;
  const status = job.state || job.status || job.job_state;
  const area = $('#render-status');
  if (!area) return;
  if (['complete','completed','succeeded','done'].includes(status)) {
    const url = job.export_url || job.download_url || '/api/projects/' + encodeURIComponent(state.project.id) + '/output';
    area.innerHTML = `<div class="video-stage section"><video controls playsinline src="${esc(url)}"></video></div><a class="button full section" href="${esc(url)}?download=1" download> ${icon('download')}Télécharger le MP4</a><p class="help-text section">Vérifiez la synchronisation, la composition et l’audio avant publication.</p>`;
  } else if (['failed','error','blocked'].includes(status)) {
    area.innerHTML = `<p class="form-error section">${esc(job.error_message || job.error || job.message || 'Le moteur n’a pas pu produire le rendu.')}</p>`;
  } else {
    area.innerHTML = '<div class="notice">' + icon('clock') + '<span>Rendu en cours… Le temps dépend de votre vidéo.</span></div><div class="progress-track"><span></span></div>';
    state.jobTimer = setTimeout(() => pollJob(id).catch(error => { if ($('#render-status')) $('#render-status').textContent = error.message; }), 2000);
  }
}

document.addEventListener('click', async event => {
  const element = event.target.closest('[data-action]');
  if (!element) return;
  const action = element.dataset.action;
  try {
    if (action === 'auth-login' || action === 'auth-activate') { state.authMode = action === 'auth-login' ? 'login' : 'activate'; auth(); }
    else if (action === 'new-project') { state.project=null;state.file=null;if(state.objectUrl)URL.revokeObjectURL(state.objectUrl);state.objectUrl=null;if(location.hash==='#montage') await montage();else location.hash='montage'; }
    else if (action === 'open-project') {
      const data = await api('/api/projects/' + encodeURIComponent(element.dataset.id));
      state.project=data.project || data;state.file=null;if(state.objectUrl)URL.revokeObjectURL(state.objectUrl);state.objectUrl=null;
      if(location.hash==='#montage')await montage();else location.hash='montage';
    } else if (action === 'select-style') { state.selectedStyle=element.dataset.id;updateStyleDetail(); }
    else if (action === 'render') await renderProject();
    else if (action === 'technical-export') await renderProject('technical-export');
    else if (action === 'delete-project') { if(confirm('Supprimer ce projet et ses vidéos de votre espace ?')) { await api('/api/projects/' + encodeURIComponent(state.project.id), {method:'DELETE'});state.project=null;state.file=null;state.objectUrl=null;notify('Projet supprimé.');location.hash='home'; } }
    else if (action === 'strategy-tab') { state.strategyTab=element.dataset.id;await strategy(); }
    else if (action === 'diagnose') {
      element.disabled=true;
      const {diagnostic} = await post('/api/strategy/diagnostic');state.missions=diagnostic.missions || [];
      $('#mission-list').innerHTML=(diagnostic.missions || []).map(missionCard).join('') || empty('Données insuffisantes.', 'Renseignez votre profil ou des mesures pour établir des priorités utiles.');
      $('#diagnostic-result').innerHTML=`<div class="notice">${icon('info')}<span>${esc(diagnostic.notice || '')}<br><small>Moteur ${esc(diagnostic.engine_version)} · ${date(diagnostic.generated_at)}</small></span></div>${(diagnostic.findings || []).map(finding=>`<details><summary>${esc(finding.title)}</summary><p>${esc(finding.observation)}</p><p>${esc(finding.hypothesis)}</p><p class="help-text">Confiance : ${esc(finding.confidence)} · ${esc(finding.limitations)}</p>${safeSource(finding.source_url)}</details>`).join('')}`;
      element.disabled=false;
    } else if (action === 'mission-status') { await api('/api/strategy/missions/' + encodeURIComponent(element.dataset.id), {method:'PATCH',body:JSON.stringify({status:element.dataset.status})});await strategy();notify('Votre progression est enregistrée.'); }
    else if (action === 'commit-csv') { const result=await post('/api/strategy/imports',{preview_id:state.preview.preview_id});notify(`${result.imported} publication(s) importée(s), ${result.skipped || 0} doublon(s) ignoré(s).`);await strategy(); }
    else if (action === 'theme') { const theme=document.documentElement.dataset.theme==='light'?'dark':'light';document.documentElement.dataset.theme=theme;try {localStorage.setItem('socialplus-theme',theme);} catch {}notify(theme==='light'?'Apparence claire':'Apparence sombre'); }
    else if (action === 'recover-access') openSheet('Récupérer votre accès', `<p>Demandez au propriétaire un code de récupération personnel, valable une heure.</p><form class="form section" data-form="reset-password">${field('email','Adresse e-mail','','email','required autocomplete="email"')}${field('code','Code personnel de récupération','','text','required autocomplete="off"')}${field('password','Nouveau mot de passe','','password','required minlength="12" autocomplete="new-password"')}<button class="button" type="submit">Enregistrer mon nouveau mot de passe</button><p class="form-error" role="alert"></p></form>`);
    else if (action === 'redeem-invite') openSheet('Activer votre invitation', `<p>Votre compte conserve ses données. Une invitation personnelle peut renouveler votre accès gratuit.</p><form class="form section" data-form="redeem-invite">${field('code','Code d’invitation','','text','required autocomplete="off"')}<button class="button" type="submit">Activer ce code</button><p class="form-error" role="alert"></p></form>`);
    else if (action === 'my-feedback') {
      const {entries=[]}=await api('/api/feedback');
      openSheet('Mes messages privés', entries.map(entry=>`<article class="mission"><div class="row between"><h3>${esc(entry.category)}</h3><span class="pill">${esc(entry.status)}</span></div><p>${esc(entry.body)}</p>${entry.owner_reply?`<div class="panel"><h3>Réponse du propriétaire</h3><p>${esc(entry.owner_reply)}</p></div>`:''}<small>${date(entry.created_at)}</small>${entry.publication_consent ? `<button class="text-button" data-action="withdraw-consent" data-id="${esc(entry.id)}">Retirer mon accord de publication</button>` : '<p class="help-text">Publication non autorisée.</p>'}</article>`).join('') || '<p>Aucun message envoyé pour le moment.</p>');
    }
    else if (action === 'withdraw-consent') {await api('/api/feedback/' + encodeURIComponent(element.dataset.id),{method:'PATCH',body:JSON.stringify({publicationConsent:false})});notify('Accord de publication retiré.');closeSheet();}
    else if (action === 'faq') await faq();
    else if (action === 'feedback') feedback();
    else if (action === 'support') feedback(true);
    else if (action === 'legal') await legal(element.dataset.kind);
    else if (action === 'admin') closeSheet();
    else if (action === 'logout') { await post('/api/auth/logout');closeSheet();await session();await route(); }
    else if (action === 'export-data') {
      const data=await api('/api/privacy/export');const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download='socialplus-mes-donnees.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),5000);notify('Votre export a été téléchargé.');
    } else if (action === 'delete-data') openSheet('Suppression de vos données', `<p>Votre demande sera enregistrée et devra être traitée de façon vérifiée. Cette action ne prétend pas effacer silencieusement vos données.</p><form class="form section" data-form="delete-request">${field('password','Confirmez votre mot de passe','','password','required autocomplete="current-password"')}<button type="submit" class="button danger">Enregistrer ma demande</button><p class="form-error" role="alert"></p></form>`);
    else if (action === 'delete-account') openSheet('Supprimer définitivement mon compte', `<p>Votre compte, vos projets, vos vidéos et vos données de stratégie seront supprimés. Cette action est irréversible.</p><form class="form section" data-form="delete-account">${field('password','Votre mot de passe','','password','required autocomplete="current-password"')}${field('confirm','Saisissez SUPPRIMER','','text','required pattern="SUPPRIMER" autocomplete="off"')}<button class="button danger" type="submit">Supprimer mon compte et mes données</button><p class="form-error" role="alert"></p></form>`);
    else if (action === 'issue-reset') {const result=await post('/api/admin/members/' + encodeURIComponent(element.dataset.id) + '/reset-password');openSheet('Code de récupération personnel',`<p>À transmettre après vérification de l’identité de ${esc(result.email)}. Valable une heure et à usage unique.</p><code class="code-output">${esc(result.code)}</code><p class="help-text">Le code n’est affiché qu’une fois.</p>`);}
    else if (action === 'support-admin') await supportAdmin();
    else if (action === 'delete-support') {if(confirm('Supprimer définitivement ce message de support ?')){await api('/api/admin/support/' + encodeURIComponent(element.dataset.id),{method:'DELETE'});await supportAdmin();notify('Message supprimé.');}}
    else if (action === 'method-admin') await methodAdmin();
    else if (action === 'edit-method') {
      const method=state.adminMethods.find(item=>item.id===element.dataset.id);
      openSheet('Nouvelle version · '+method.id, `<p class="help-text">Cette publication conserve l’historique de la méthode. Vérifiez la source avant de la publier.</p><form class="form section" data-form="method-version" data-id="${esc(method.id)}">${field('title','Titre',method.title,'text','required')}${field('source_url','Source officielle',method.source_url,'url','required')}${field('source_title','Nom de la source',method.source_title || '')}<label>Étapes · une par ligne<textarea name="process_steps" required>${esc((method.process_steps || []).join('\n'))}</textarea></label><label>Exercice<textarea name="exercise" required>${esc(method.exercise)}</textarea></label><label>Indicateurs de réussite · un par ligne<textarea name="success_metrics" required>${esc((method.success_metrics || []).join('\n'))}</textarea></label><label>Limites et pièges · un par ligne<textarea name="pitfalls">${esc((method.pitfalls || []).join('\n'))}</textarea></label><button class="button" type="submit">Publier cette version</button><p class="form-error" role="alert"></p></form>`);
    }
    else if (action === 'toggle-method') {await api('/api/admin/method-versions/' + encodeURIComponent(element.dataset.id),{method:'PATCH',body:JSON.stringify({enabled:element.dataset.enabled==='true'})});await methodAdmin();notify('Disponibilité de la méthode mise à jour.');}
    else if (action === 'deletion-requests') {
      const {entries=[]}=await api('/api/admin/deletion-requests');
      openSheet('Demandes de suppression',entries.map(entry=>`<article class="mission"><h3>${esc(entry.display_name)}</h3><p>${esc(entry.email)}</p><small>${date(entry.requested_at)} · ${esc(entry.status)}</small>${entry.status!=='completed'?`<button class="text-button" data-action="complete-deletion" data-id="${esc(entry.id)}">Supprimer les données et clôturer</button>`:''}</article>`).join('') || '<p>Aucune demande en attente.</p>');
    }
    else if (action === 'complete-deletion') {if(confirm('Supprimer définitivement le compte et les fichiers de ce membre ?')){await post('/api/admin/deletion-requests/' + encodeURIComponent(element.dataset.id) + '/complete',{confirm:'SUPPRIMER'});closeSheet();notify('Suppression effectuée.');await admin();}}
    else if (action === 'revoke-invite') { await post('/api/admin/invites/' + encodeURIComponent(element.dataset.id) + '/revoke');await admin();notify('Code révoqué.'); }
    else if (action === 'member-action') { await post('/api/admin/members/' + encodeURIComponent(element.dataset.id) + '/' + element.dataset.operation);await admin();notify('Accès mis à jour.'); }
    else if (action === 'extend-member') openSheet('Prolonger un accès', `<form class="form" data-form="extend-member" data-id="${esc(element.dataset.id)}"><label>Nouvelle durée<select name="durationDays"><option value="7">7 jours</option><option value="30">30 jours</option><option value="permanent">Permanent</option></select></label><button class="button" type="submit">Confirmer la prolongation</button><p class="form-error" role="alert"></p></form>`);
    else if (action === 'edit-faq') {const entry=state.faqEntries.find(item=>item.id===element.dataset.id);openSheet('Modifier la FAQ',`<form class="form" data-form="faq-edit"><input type="hidden" name="id" value="${esc(entry.id)}">${field('question','Question',entry.question,'text','required maxlength="250"')}<label>Réponse<textarea name="answer" required maxlength="5000">${esc(entry.answer)}</textarea></label>${field('category','Catégorie',entry.category)}${field('sortOrder','Ordre d’affichage',entry.sort_order || 0,'number','min="0" max="10000" step="1"')}<label class="checkbox-label"><input name="published" type="checkbox" ${entry.published?'checked':''}><span>Publier cette réponse</span></label><button class="button" type="submit">Enregistrer les modifications</button><p class="form-error" role="alert"></p></form>`);}
    else if (action === 'faq-toggle') { const entry=state.faqEntries.find(item=>item.id===element.dataset.id);await api('/api/admin/faq', {method:'PATCH',body:JSON.stringify({...entry,published:element.dataset.published==='true'})});await admin();notify('FAQ mise à jour.'); }
    else if (action === 'audit-log') { const data=await api('/api/admin/audit-log');openSheet('Journal d’administration', `<div class="table-wrap"><table><thead><tr><th>Date</th><th>Action</th><th>Résultat</th></tr></thead><tbody>${(data.entries || data.logs || []).map(item=>`<tr><td>${date(item.created_at)}</td><td>${esc(item.action)}</td><td>${esc(item.result || 'effectué')}</td></tr>`).join('')}</tbody></table></div>`); }
    else if (action === 'seek-analysis') {const video=$('#analysis-media');if(video){video.currentTime=Number(element.dataset.time);video.scrollIntoView({block:'center'});}}
    else if (action === 'delete-competitor') {await api('/api/strategy/competitors/' + encodeURIComponent(element.dataset.id),{method:'DELETE'});await strategy();notify('Observation supprimée.');}
    else if (action === 'retry') {await session();await route();}
  } catch(error) { element.disabled=false;notify(error.message); }
});

document.addEventListener('submit', async event => {
  const form=event.target.closest('[data-form]');
  if (!form) return;
  event.preventDefault();
  const values=Object.fromEntries(new FormData(form));
  setBusy(form,true);
  try {
    switch(form.dataset.form) {
      case 'login': case 'activate': {
        if(form.dataset.form==='activate')values.acceptTerms=true;
        const data=await post('/api/auth/' + form.dataset.form,values);
        state.user=data.user;state.csrf=data.csrf || data.user?.csrf;await session();await route();notify('Bienvenue dans votre espace.');break;
      }
      case 'reset-password': await post('/api/auth/reset',values);closeSheet();notify('Mot de passe modifié. Connectez-vous avec votre nouveau mot de passe.');break;
      case 'redeem-invite': await post('/api/gifts/redeem',values);closeSheet();await session();notify('Votre invitation a été activée.');break;
      case 'project-save': await saveProject(form);break;
      case 'mission-proof': {const result=await api('/api/strategy/missions/' + encodeURIComponent(form.dataset.id),{method:'PATCH',body:JSON.stringify(values)});const mission=state.missions.find(item=>item.id===form.dataset.id);Object.assign(mission,result.mission);notify('Votre preuve est enregistrée.');break;}
      case 'profile': await api('/api/strategy/profile',{method:'PUT',body:JSON.stringify(values)});notify('Votre profil est enregistré.');break;
      case 'csv': {
        const file=new FormData(form).get('csvfile');
        if(file.size>2000000)throw new Error('Le CSV dépasse 2 Mo. Importez un extrait plus petit.');
        state.csvSource=await file.text();state.csvPlatform=values.platform;
        state.preview=await post('/api/strategy/imports/preview',{csv:state.csvSource,platform:values.platform});
        renderCsvPreview(state.preview);
        break;
      }
      case 'csv-mapping': state.preview=await post('/api/strategy/imports/preview',{csv:state.csvSource,platform:state.csvPlatform,column_mapping:values});renderCsvPreview(state.preview);break;
      case 'metric': {
        const payload={...values,publication_at:new Date(values.publication_at).toISOString(),collected_at:values.collected_at ? new Date(values.collected_at).toISOString() : new Date().toISOString()};
        for(const key of ['reach','views','likes','comments','shares','saves'])payload[key]=values[key]===''?null:Number(values[key]);
        await post('/api/strategy/metrics',payload);notify('Ces mesures sont enregistrées.');await strategy();break;
      }
      case 'result': if(values.before_metric_id===values.after_metric_id)throw new Error('Choisissez deux mesures distinctes.');await post('/api/strategy/results',{...values,analysis_id:values.analysis_id || null});notify('Comparaison enregistrée sans modifier l’analyse d’origine.');await strategy();break;
      case 'competitor': await post('/api/strategy/competitors',{...values,collected_at:values.collected_at ? new Date(values.collected_at).toISOString() : new Date().toISOString()});notify('Observation enregistrée.');await strategy();break;
      case 'video-analysis': await analyzeVideo(form,values);break;
      case 'support': await post('/api/support',values);closeSheet();notify('Message transmis au propriétaire. Aucun e-mail automatique envoyé.');break;
      case 'support-note': await api('/api/admin/support/' + encodeURIComponent(form.dataset.id),{method:'PATCH',body:JSON.stringify(values)});notify('Note interne enregistrée. Aucun e-mail envoyé.');break;
      case 'feedback': await post('/api/feedback',{...values,rating:values.rating?Number(values.rating):null,publicationConsent:form.elements.publicationConsent.checked});closeSheet();notify('Votre message privé est enregistré.');break;
      case 'delete-account': await post('/api/privacy/delete',values);closeSheet();state.project=null;state.file=null;state.objectUrl=null;await session();await route();notify('Votre compte et vos données ont été supprimés.');break;
      case 'method-version': await post('/api/admin/method-versions',{...values,method_id:form.dataset.id,process_steps:values.process_steps.split('\n').map(step=>step.trim()).filter(Boolean),success_metrics:values.success_metrics.split('\n').map(step=>step.trim()).filter(Boolean),pitfalls:values.pitfalls.split('\n').map(step=>step.trim()).filter(Boolean),enabled:true});closeSheet();notify('Nouvelle version publiée.');break;
      case 'delete-request': await post('/api/privacy/delete-request',values);closeSheet();notify('Votre demande de suppression est enregistrée.');break;
      case 'invite': {
        const result=await post('/api/admin/invites',{...values,durationDays:values.durationDays==='permanent'?null:Number(values.durationDays),codeExpiresDays:Number(values.codeExpiresDays),maxUses:1,emailVerifiedByOwner:true});
        $('#invite-result').innerHTML=`<p class="help-text section">Code personnel à transmettre manuellement. Il ne sera plus affiché.</p><code class="code-output">${esc(result.code)}</code><p class="help-text">L’adresse du destinataire et ce code sont nécessaires à l’activation.</p>`;break;
      }
      case 'extend-member': await post('/api/admin/members/' + encodeURIComponent(form.dataset.id) + '/extend',{durationDays:values.durationDays==='permanent'?null:Number(values.durationDays)});closeSheet();await admin();notify('Accès prolongé.');break;
      case 'feedback-reply': await api('/api/admin/feedback/' + encodeURIComponent(form.dataset.id),{method:'PATCH',body:JSON.stringify(values)});notify('Réponse privée enregistrée.');break;
      case 'faq-edit': await post('/api/admin/faq',{...values,sortOrder:Number(values.sortOrder || 0),published:form.elements.published.checked});closeSheet();await admin();notify('Réponse FAQ enregistrée.');break;
    }
  } catch(error) { if(form.dataset.form==='project-save' && $('#upload-status'))$('#upload-status').innerHTML='';formError(form,error); }
  finally { if(form.isConnected)setBusy(form,false); }
});

document.addEventListener('change',async event=>{
  if(event.target.matches('[data-mission-step]')) {
    const mission=state.missions?.find(item=>item.id===event.target.dataset.missionId);if(!mission)return;
    const steps=mission.steps.map((step,index)=>({...step,completed:index===Number(event.target.dataset.missionStep)?event.target.checked:step.completed}));
    try {const result=await api('/api/strategy/missions/' + encodeURIComponent(mission.id),{method:'PATCH',body:JSON.stringify({steps})});Object.assign(mission,result.mission);notify('Étape enregistrée.');}catch(error){event.target.checked=!event.target.checked;notify(error.message);}
  } else if(event.target.id==='video-input') {
    const file=event.target.files?.[0];
    if(!file)return;
    if(!file.type.startsWith('video/') && !(file.type==='' && /\.(mp4|mov|m4v|webm)$/i.test(file.name)))return notify('Choisissez un fichier vidéo.');
    if(file.size>200*1048576)return notify('Cette vidéo dépasse 200 Mo. Réduisez le fichier avant de l’importer.');
    if(state.objectUrl)URL.revokeObjectURL(state.objectUrl);
    clearTimeout(state.jobTimer);state.file=file;state.objectUrl=URL.createObjectURL(file);
    await montage();
  } else if(event.target.id==='analysis-video') {
    const file=event.target.files?.[0];
    if(!file)return;
    if(file.size>200*1048576)return notify('Cette vidéo dépasse 200 Mo. Choisissez un extrait plus petit.');
    state.analysisFile=file;
    if(state.analysisUrl)URL.revokeObjectURL(state.analysisUrl);
    state.analysisUrl=URL.createObjectURL(file);
    $('#analysis-preview').innerHTML=`<div class="video-stage"><video id="analysis-media" controls playsinline preload="metadata" src="${state.analysisUrl}"></video></div><p class="help-text section">${esc(file.name)} · ${number(file.size/1048576)} Mo</p>`;
    const video=$('#analysis-media');
    video.addEventListener('loadedmetadata',()=>{$('#analyze-video-button').disabled=false;},{once:true});
    video.addEventListener('error',()=>notify('Ce format ne peut pas être lu par votre navigateur.'),{once:true});
  }
});

const REVIEW_CRITERIA = [
  ['hook','Hook','La promesse est-elle compréhensible dès l’ouverture ?'],
  ['scroll_stop','Arrêt du défilement','Quel élément concret motive à regarder ?'],
  ['clarity','Clarté','Le message principal est-il précis et compréhensible ?'],
  ['retention','Rétention potentielle','La progression donne-t-elle une raison de poursuivre ? Aucune rétention réelle ne peut être prédite.'],
  ['structure','Structure','Identifiez introduction, développement et conclusion.'],
  ['rhythm','Rythme','Relevez une pause ou une rupture réellement observable.'],
  ['text_captions','Sous-titres','Vérifiez les mots, le contraste et les zones de sécurité.'],
  ['visual','Visuel','Observez cadrage et lisibilité, sans supposer le regard d’un algorithme.'],
  ['audio','Audio','Écoutez la piste : volume, saturation ou silence observable.'],
  ['originality','Originalité','Décrivez votre apport propre ; aucune recherche exhaustive de similitude n’est effectuée.'],
  ['cta','Appel à l’action','La prochaine action est-elle explicite et cohérente ?']
];
function editorialReview() {
  return `<details><summary>Ajouter ma revue éditoriale documentée</summary><p>Une auto-évaluation, pas une analyse automatique. Notez uniquement les critères observés et citez un moment précis. Laissez les autres vides.</p><label class="section">Transcription fiable, relue par vous<textarea name="transcript_text" maxlength="50000" placeholder="Le texte réellement prononcé…"></textarea></label><label class="checkbox-label section"><input type="checkbox" name="audioVerified"><span>J’ai vérifié la présence de la piste audio en l’écoutant.</span></label>${REVIEW_CRITERIA.map(([id,label,description])=>`<details><summary>${label}</summary><p>${description}</p><div class="field-grid section">${field(id+'_score','Votre note sur 100','','number','min="0" max="100" step="1"')}${field(id+'_start','Début observé (secondes)','','number','min="0" step="0.01"')}${field(id+'_end','Fin observée (secondes)','','number','min="0" step="0.01"')}</div><label class="section">Preuve / constat observable<textarea name="${id}_evidence" minlength="20" maxlength="2000" placeholder="Décrivez précisément ce que vous avez observé à ce moment."></textarea></label></details>`).join('')}</details>`;
}
function collectCriteria(values) {
  const criteria={};
  for(const [key] of REVIEW_CRITERIA) {
    if(values[key+'_score']==='')continue;
    criteria[key]={score:Number(values[key+'_score']),source_kind:'manual',evidence:values[key+'_evidence'],start_sec:values[key+'_start']===''?null:Number(values[key+'_start']),end_sec:values[key+'_end']===''?null:Number(values[key+'_end'])};
  }
  return criteria;
}
async function resultsPanel(content) {
  const [{metrics=[]},{analyses=[]},{results=[]}]=await Promise.all([api('/api/strategy/metrics'),api('/api/strategy/video-analyses'),api('/api/strategy/results')]);
  const options=metrics.map(metric=>`<option value="${esc(metric.id)}">${esc(metric.external_post_id)} · ${date(metric.collected_at)} · ${esc(metric.platform)}</option>`).join('');
  content.innerHTML=`<div class="grid-two stack-mobile"><div class="panel"><h2>Évaluez votre hypothèse.</h2><p>Comparez des mesures de même plateforme et de fenêtres comparables. Une corrélation ne démontre pas une cause.</p>${metrics.length>1?`<form class="form section" data-form="result"><label>Mesure de référence<select name="before_metric_id">${options}</select></label><label>Mesure après expérience<select name="after_metric_id">${options}</select></label><label>Analyse éditoriale associée · facultative<select name="analysis_id"><option value="">Sans analyse associée</option>${analyses.map(analysis=>`<option value="${esc(analysis.id)}">${date(analysis.created_at)} · ${analysis.score==null?'Non évaluable':analysis.score+'/100'} · ${esc(analysis.fingerprint?.slice(0,8))}</option>`).join('')}</select></label><label>Votre hypothèse<textarea name="hypothesis" required maxlength="2000" placeholder="Ce que vous avez modifié, et l’effet que vous souhaitiez mesurer."></textarea></label><button class="button" type="submit">Comparer et enregistrer</button><p class="form-error" role="alert"></p></form>`:empty('Deux mesures sont nécessaires.', 'Ajoutez des mesures datées dans Performances avant de comparer.')}</div><div class="panel"><h2>Vos comparaisons</h2>${results.map(result=>`<article class="mission"><h3>${esc(({not_evaluable:'Comparaison non évaluable',unclear:'Écart descriptif · conclusion incertaine',improved:'Amélioration observée',worsened:'Baisse observée'})[result.conclusion] || 'Comparaison documentée')}</h3><p>${esc(result.hypothesis)}</p><p>${esc(result.caveat || result.reason || result.notice || 'Vérifiez les conditions de comparaison avant toute conclusion.')}</p>${result.reasons?.length?`<ul class="help-text">${result.reasons.map(reason=>`<li>${esc(reason)}</li>`).join('')}</ul>`:''}${result.comparable?`<div class="table-wrap"><table><thead><tr><th>Indicateur</th><th>Écart en points</th></tr></thead><tbody>${Object.entries(result.deltas || {}).filter(([,value])=>value!==null).map(([key,value])=>`<tr><td>${esc(key)}</td><td>${value>0?'+':''}${number(value)}</td></tr>`).join('')}</tbody></table></div>`:''}<small>${date(result.created_at)} · Source manuelle</small></article>`).join('') || '<p class="help-text">Aucune expérience enregistrée.</p>'}</div></div>`;
  const after=$('[name="after_metric_id"]',content);if(after && after.options.length>1)after.selectedIndex=1;
}

async function analyzeVideo(form,values) {
  const file=state.analysisFile;
  const video=$('#analysis-media');
  if(!file || !video?.videoWidth)throw new Error('Choisissez une vidéo lisible avant de continuer.');
  const fingerprint=await fingerprintFile(file);
  const {analysis}=await post('/api/strategy/video-analyses',{
    fingerprint,context:{goal_type:values.goal_type},metadata:{duration_seconds:video.duration,width:video.videoWidth,height:video.videoHeight,has_audio:form.elements.audioVerified.checked ? true : null},transcript:{text:values.transcript_text || ''},criteria:collectCriteria(values)
  });
  $('#video-analysis-result').innerHTML=`<h3>Précontrôle enregistré.</h3><div class="table-wrap"><table><tbody><tr><th>Format natif</th><td>${video.videoWidth} × ${video.videoHeight}</td></tr><tr><th>Durée</th><td>${number(video.duration)} s</td></tr><tr><th>Empreinte</th><td><code>${fingerprint.slice(0,16)}…</code></td></tr><tr><th>Score éditorial</th><td>${analysis.score==null?'Non évaluable':number(analysis.score) + ' / 100'}</td></tr><tr><th>Couverture des critères</th><td>${number(analysis.coverage)} %</td></tr></tbody></table></div><p class="help-text">${esc(analysis.notice || 'Le discours et les critères visuels ne sont pas évalués automatiquement. Aucun score global ne peut être attribué avec cette couverture.')}</p>${Object.entries(analysis.criteria || {}).map(([key,criterion])=>`<details><summary>${esc(REVIEW_CRITERIA.find(item=>item[0]===key)?.[1] || key)} · ${criterion.score}/100</summary><p>${esc(criterion.evidence)}</p><button class="text-button" data-action="seek-analysis" data-time="${criterion.start_sec}">Revoir à ${number(criterion.start_sec)} s${icon('arrow')}</button><small>Observation documentée par vous</small></details>`).join('')}<details><summary>Critères exclus (${analysis.excluded_criteria?.length || 0})</summary>${(analysis.excluded_criteria || []).map(item=>`<p><strong>${esc(REVIEW_CRITERIA.find(criterion=>criterion[0]===item.key)?.[1] || item.key)}</strong><br>${esc(item.reason)}</p>`).join('')}</details>`;
}

document.addEventListener('input',event=>{
  if(event.target.id==='faq-search')document.querySelectorAll('[data-faq]').forEach(item=>{item.hidden=!item.dataset.faq.includes(event.target.value.toLocaleLowerCase('fr'));});
});
$('#account-button').addEventListener('click',account);
$('#close-sheet').addEventListener('click',closeSheet);
sheet.addEventListener('click',event=>{if(event.target===sheet){const box=sheet.getBoundingClientRect();if(event.clientX<box.left||event.clientX>box.right||event.clientY<box.top||event.clientY>box.bottom)closeSheet();}});
window.addEventListener('hashchange',()=>{closeSheet();route();window.scrollTo({top:0});});
window.addEventListener('offline',()=>notify('Vous êtes hors ligne. Les actions seront disponibles au retour de la connexion.'));
try {document.documentElement.dataset.theme=localStorage.getItem('socialplus-theme') || 'dark';} catch {document.documentElement.dataset.theme='dark';}
hydrateIcons();
try { await session();if(new URLSearchParams(location.search).has('invite'))state.authMode='activate';await route(); }
catch(error) { main.innerHTML=`<div class="loading-screen"><h2>Votre espace est indisponible.</h2><p>${esc(error.message)}</p><button class="button secondary" data-action="retry">Réessayer</button></div>`; }
