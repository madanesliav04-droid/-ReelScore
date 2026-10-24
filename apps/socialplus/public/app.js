import {createApiClient} from './api-client.js';
import {MODEL_ORDER,projectStatus,sourceMeta,transcriptRows,acousticScore,ACOUSTIC_SUMMARY_VERSION} from './studio-ui.js';
import {uploadSource,loadShareFile} from './media-client.js';
import {draftModelEvents} from './model-events.js';
const $ = (selector, root = document) => root.querySelector(selector);
const main = $('#main');
const sheet = $('#sheet');
const initialState = () => ({
  user: null, csrf: '', projects: [], styles: [], project: null,
  selectedStyle: null, file: null, objectUrl: null, strategyTab: 'video',
  view:0, drafts:{}, filter:'all', preview: null, authMode: 'login', busy: false, jobTimer: null, abortController: new AbortController()
});
const state = initialState();

const paths = {
  home: '<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z"/>',
  projects: '<rect x="3" y="4" width="18" height="16" rx="3"/><path d="M8 4v16M3 10h18"/>',
  share: '<path d="M12 15V3m-4 4 4-4 4 4M7 10H4v11h16V10h-3"/>',
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

function resetPrivateState() {
  clearTimeout(state.jobTimer);
  try{if(state.user)sessionStorage.removeItem('socialplus-project-'+state.user.id);}catch{}
  state.zoneObserver?.disconnect();
  state.abortController.abort();
  if(state.analysisUrl)URL.revokeObjectURL(state.analysisUrl);
  if(state.objectUrl)URL.revokeObjectURL(state.objectUrl);
  for(const key of Object.keys(state))delete state[key];
  Object.assign(state,initialState());
  sheet.close();
  $('#sheet-body').replaceChildren();
  $('#main-nav').hidden=true;
  $('#account-button').innerHTML=icon('user');
}

function hydrateIcons(root = document) {
  root.querySelectorAll('[data-icon]').forEach(element => { element.innerHTML = icon(element.dataset.icon); });
}

function ensureCurrentSession(controller) {
  if(controller!==state.abortController || controller.signal.aborted)throw Object.assign(new Error('Cette session est fermée.'),{code:'SESSION_CHANGED'});
}
const staleSession = error => error.name==='AbortError' || error.code==='SESSION_CHANGED';

const api=createApiClient(()=>state,{onExpired:()=>{resetPrivateState();auth();}});

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
function closeSheet() { sheet.querySelectorAll('video').forEach(v=>v.pause());sheet.close();state.shareFile=null; }
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
  if(state.user && state.user.id!==data.user?.id)resetPrivateState();
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
  const status=projectStatus(project);
  return `<article class="project-row"><button class="project-open" data-action="open-project" data-id="${esc(project.id)}"><span class="project-symbol">${icon(project.has_output?'check':'film')}</span><span class="project-copy"><strong>${esc(project.name)}</strong><small>${esc(sourceMeta(project))}</small><span class="pill ${status.tone}">${esc(status.label)}</span></span>${icon('arrow')}</button><button class="icon-button" data-action="project-options" data-id="${esc(project.id)}" aria-label="Options de ${esc(project.name)}">${icon('projects')}</button></article>`;
}
async function home() {
  const view=state.view;
  const {projects=[]}=await api('/api/projects');if(view!==state.view)return;state.projects=projects;
  const name=(state.user.display_name||'').split(' ')[0];
  const active=projects.filter(p=>p.state==='rendering');
  const latest=projects[0];
  main.innerHTML=`<section class="page home-page">${heading('Votre studio personnel',`Bonjour${name?', '+esc(name):''}.`,'Une idée. Votre voix. Un contenu qui vous ressemble.')}<div class="quick-actions"><button class="quick-action" data-action="new-project"><span class="action-symbol">${icon('plus')}</span><span><strong>Nouveau montage</strong><small>Donnez une direction à votre vidéo</small></span>${icon('arrow')}</button><a class="quick-action" href="#analysis"><span class="action-symbol">${icon('chart')}</span><span><strong>Analyser une vidéo</strong><small>Comprendre avant de publier</small></span>${icon('arrow')}</a></div>${active.length?`<section class="section"><div class="section-heading"><h2>En cours</h2><span class="pill working">${active.length}</span></div>${active.map(projectCard).join('')}</section>`:''}${latest?`<div class="resume-line section"><span>Votre dernier projet</span><button class="text-button" data-action="open-project" data-id="${esc(latest.id)}">Reprendre ${icon('arrow')}</button></div>`:''}<div class="section-heading"><h2>Récemment</h2><a class="text-button" href="#projects">Tout voir ${icon('arrow')}</a></div>${projects.length?`<div class="project-rows">${projects.slice(0,3).map(projectCard).join('')}</div>`:empty('Votre studio est prêt.','Importez votre premier rush. Il sera enregistré dans votre espace privé.',button('Choisir une vidéo','new-project'))}<p class="privacy-footnote">${icon('lock')} Vos fichiers restent dans votre espace privé.</p></section>`;
  refreshProjectList('home');
}
async function projectLibrary(){
 const view=state.view;
 const {projects=[]}=await api('/api/projects');if(view!==state.view)return;state.projects=projects;
 const filtered=projects.filter(p=>state.filter==='all'||(state.filter==='rendering'?p.state==='rendering':p.has_output));
 main.innerHTML=`<section class="page">${heading('Votre bibliothèque','Projets.','Vos rushs, vos montages et leurs résultats.')}<div class="library-toolbar"><div class="segmented" aria-label="Filtrer les projets">${[['all','Tous'],['rendering','En cours'],['complete','Exports']].map(([id,label])=>`<button data-action="filter-projects" data-id="${id}" aria-pressed="${state.filter===id}" class="${state.filter===id?'active':''}">${label}</button>`).join('')}</div><button class="icon-button" data-action="new-project" aria-label="Nouveau projet">${icon('plus')}</button></div><div class="project-rows">${filtered.map(projectCard).join('')||empty('Aucun projet ici.','Vos vidéos enregistrées apparaîtront ici.')}</div></section>`;
 refreshProjectList('projects');
}
function refreshProjectList(target){
 clearTimeout(state.jobTimer);
 if(state.projects.some(p=>p.state==='rendering'))state.jobTimer=setTimeout(()=>{if(currentPage()===target)(target==='home'?home():projectLibrary()).catch(e=>notify(e.message));},4000);
}
function currentPage(){return (location.hash.slice(1).split('?')[0]||'home').replace(/^strategy$/,'analysis');}
function rememberProject(){try{if(state.user&&state.project)sessionStorage.setItem('socialplus-project-'+state.user.id,state.project.id);}catch{}}
function readDraft(){
 if(!state.project||$('.studio-page')?.dataset.projectId!==state.project.id)return;
 const transcript=$('#transcript');if(!transcript)return;
 state.drafts[state.project.id]={transcript:transcript.value,events:$('#reference-events')?.value||'[]',style:state.selectedStyle,preview:$('#caption-preview-mode')?.checked===true,placement:$('#placement-reviewed')?.checked===true,reviewed:$('#captions-reviewed')?.checked===true,pauseIds:[...document.querySelectorAll('[data-pause-id]:checked')].map(el=>el.dataset.pauseId)};
}
async function openProjectOptions(id){
 const {project}=await api('/api/projects/'+encodeURIComponent(id));
 openSheet(project.name,`<p class="help-text">${esc(sourceMeta(project))}</p><div class="video-stage section"><video controls playsinline preload="metadata" src="/api/projects/${encodeURIComponent(id)}/${project.has_output?'output':'media'}"></video></div><div class="menu-list"><button data-action="open-project" data-id="${esc(id)}">${icon('film')}Ouvrir dans Montage</button>${project.has_source?`<button data-action="project-analysis" data-id="${esc(id)}">${icon('chart')}Analyser ce rush</button>`:''}${project.has_output?`<a href="/api/projects/${encodeURIComponent(id)}/output?download=1" download>${icon('download')}Télécharger le MP4</a><button data-action="share-output" data-id="${esc(id)}">${icon('share')}Partager le MP4</button>`:''}<button class="danger-text" data-action="remove-project" data-id="${esc(id)}">${icon('close')}Supprimer ce projet</button></div>`);
}

async function montage() {
  const view=state.view;
  const catalog=await api('/api/studio/styles');if(view!==state.view)return;
  state.styles=[...(catalog.styles||[])].sort((a,b)=>MODEL_ORDER.indexOf(a.id)-MODEL_ORDER.indexOf(b.id));
  if(!state.selectedStyle)state.selectedStyle=state.styles[0]?.id;
  if(!state.project&&!state.file){try{const id=sessionStorage.getItem('socialplus-project-'+state.user.id);if(id)state.project=(await api('/api/projects/'+encodeURIComponent(id))).project;}catch(e){if(e.status!==404)throw e;}}
  if(state.project?.id){const {project}=await api('/api/projects/'+encodeURIComponent(state.project.id));if(view!==state.view)return;state.project=project;rememberProject();}
  const project=state.project;
  if(project&&state.drafts[project.id]?.style)state.selectedStyle=state.drafts[project.id].style;
  main.innerHTML=`<section class="page studio-page" data-project-id="${esc(project?.id||'')}">${heading('Montage','Votre prochain montage.','Votre format. Votre voix. Votre signature.')}<div class="studio-layout"><div class="studio-source"><div class="step-heading"><span>01</span><h2>Votre vidéo</h2>${project?.has_source?'<span class="pill good">Enregistrée</span>':''}</div>${project?.has_source||state.objectUrl?`<div class="video-stage"><video id="source-preview" controls playsinline preload="metadata" src="${state.objectUrl||'/api/projects/'+encodeURIComponent(project.id)+'/media'}"></video></div><div class="file-detail"><div><strong>${esc(state.file?.name||project?.source_name||'Vidéo')}</strong><p>${esc(sourceMeta(project))}</p></div><label class="text-button" for="video-input">Changer</label></div>`:`<label class="upload-area" for="video-input"><span class="upload-symbol">${icon('plus')}</span><h3>Ajouter votre vidéo</h3><p>Photothèque ou Fichiers.<br>Le format natif et la voix sont conservés.</p><small>60 s · 1080p · 200 Mo maximum pour les modèles</small></label>`}<input class="visually-hidden" id="video-input" type="file" accept="video/*,.mov,.mp4,.m4v"><div id="upload-status" aria-live="polite"></div>${project?`<div class="source-shortcuts"><button class="text-button" data-action="project-analysis" data-id="${esc(project.id)}">${icon('chart')}Analyser ce rush</button><details><summary>Nom du projet</summary><form class="form section" data-form="project-save">${field('title','Nom',project.name,'text','required maxlength="120"')}<button class="button secondary" type="submit">Enregistrer</button><p class="form-error" role="alert"></p></form></details></div>`:''}</div><div class="studio-controls"><div class="step-heading"><span>02</span><h2>Votre modèle</h2><span class="pill">6 signatures</span></div><div class="model-list" role="group" aria-label="Modèles de montage">${state.styles.map((style,index)=>`<button class="model" data-action="select-style" data-id="${esc(style.id)}" aria-pressed="${style.id===state.selectedStyle}"><span class="model-number">${String(index+1).padStart(2,'0')}</span><span class="model-copy"><strong>${esc(style.label)}</strong><small>${esc(style.version)} · ${style.available?'Bêta connectée':'Indisponible'}</small></span><span class="model-check" aria-hidden="true">${icon('check')}</span></button>`).join('')}</div><div id="model-detail" class="model-detail"></div><div class="step-heading section"><span>03</span><h2>Préparer et vérifier</h2></div><button class="button secondary full" data-action="prepare-model" ${!project?.has_source||!catalog.transcription?.configured?'disabled':''}>${icon('spark')}Préparer mon montage</button><p class="help-text section" id="transcription-status">${catalog.transcription?.configured?'La transcription est locale. Vérifiez les mots avant publication.':'Transcription locale non configurée. Consultez le guide d’installation.'}</p><details class="review-section"><summary>Paroles et synchronisation <span id="word-count"></span></summary><div id="word-review"></div><label class="checkbox-label section"><input id="captions-reviewed" type="checkbox"><span>J’ai écouté et vérifié tous les mots et leurs horaires.</span></label><details><summary>Horaires avancés (JSON)</summary><textarea id="transcript" rows="5" aria-label="Transcription horodatée JSON"></textarea><button class="text-button" data-action="refresh-words">Afficher ces mots</button><button class="text-button" data-action="transcribe-source" ${!project?.has_source||!catalog.transcription?.configured?'disabled':''}>Relancer la transcription</button></details></details><div id="restored-controls"><label class="section">Zone libre pour les graphismes<select id="graphic-zone"><option value="left">À gauche du sujet</option><option value="right">À droite du sujet</option></select></label><p class="help-text">La zone proposée est indiquée sur l’aperçu pour Codie, Leila et Kinetic. Vérifiez toute la vidéo, y compris les gestes : aucune détection de visage ou de main. Alex, Cinematic et Spatial peuvent utiliser tout l’écran.</p><label class="checkbox-label section"><input id="placement-reviewed" type="checkbox"><span>J’ai vérifié les zones libres et accepté les scènes plein écran de ce modèle.</span></label><details class="advanced-controls"><summary>Animations avancées</summary><button class="text-button" data-action="draft-model-events">Recalculer les propositions</button><label>Événements du rush (JSON)<textarea id="reference-events" rows="4">[]</textarea></label></details></div><label class="checkbox-label section"><input id="caption-preview-mode" type="checkbox" checked><span>Prévisualisation bêta, transcription à vérifier.</span></label><div class="render-action"><button class="button full" data-action="render" ${!project?.has_source?'disabled':''}>${icon('film')}Lancer le montage</button><p class="help-text">Format natif · audio original · MP4 H.264/AAC</p></div><div id="render-status" aria-live="polite"></div><details class="section"><summary>Coupes et export technique</summary><button class="text-button" data-action="analyze-source" ${!project?.has_source?'disabled':''}>Mesurer les pauses</button><div id="source-signals" aria-live="polite"></div><button class="button secondary full section" data-action="guided-edit" disabled>Appliquer uniquement mes coupes</button><button class="text-button" data-action="technical-export" ${!project?.has_source?'disabled':''}>Exporter la source sans habillage</button></details></div></div></section>`;
  updateStyleDetail();
  if(project?.has_source){
    const [{report},{transcript}]=await Promise.all([api('/api/projects/'+encodeURIComponent(project.id)+'/signals'),api('/api/projects/'+encodeURIComponent(project.id)+'/transcript')]);
    if(view!==state.view)return;
    if(report)showSourceSignals(report);if(transcript)showTranscript(transcript);
    const draft=state.drafts[project.id];
    if(draft){$('#transcript').value=draft.transcript;$('#reference-events').value=draft.events;$('#caption-preview-mode').checked=draft.preview;$('#placement-reviewed').checked=draft.placement;$('#captions-reviewed').checked=draft.reviewed;refreshWordEditor();for(const el of document.querySelectorAll('[data-pause-id]'))el.checked=(state.analysisCuts?.projectId===project.id&&state.analysisCuts?.fingerprint===report?.fingerprint?state.analysisCuts.ids:draft.pauseIds||[]).includes(el.dataset.pauseId);}
    else if(transcript)rebuildEvents();
    if(project.latestJob)await pollJob(project.latestJob.id,project.id,view);
  }
}
function updateZoneGuide(){
 const video=$('#source-preview');if(!video)return;
 const stage=video.closest('.video-stage');let guide=stage.querySelector('.source-zone');
 if(!guide){guide=document.createElement('div');guide.className='source-zone';guide.setAttribute('aria-hidden','true');stage.append(guide);}
 const fullscreen=['alex-hormozi-v16','cinematic-storytelling-v7','apple-premium-spatial'].includes(state.selectedStyle);
 guide.hidden=fullscreen;
 const update=()=>{
  if(!video.isConnected||!video.videoWidth)return;
  const box=video.getBoundingClientRect(),parent=stage.getBoundingClientRect(),ratio=video.videoWidth/video.videoHeight;
  const width=Math.min(box.width,box.height*ratio),height=width/ratio;
  const x=$('#graphic-zone')?.value==='right'?0.73:0.05;
  guide.style.left=(box.left-parent.left+(box.width-width)/2+x*width)+'px';
  guide.style.top=(box.top-parent.top+(box.height-height)/2+.1*height)+'px';
  guide.style.width=(width*.22)+'px';guide.style.height=(height*.34)+'px';
 };
 if(!video.dataset.zoneReady){video.dataset.zoneReady='true';video.addEventListener('loadedmetadata',update);}
 state.zoneObserver?.disconnect();state.zoneObserver=new ResizeObserver(update);state.zoneObserver.observe(video);update();
}
function refreshWordEditor(){
 const words=JSON.parse($('#transcript').value||'[]');
 $('#word-review').innerHTML=transcriptRows(words);$('#word-count').textContent=words.length?`${words.length} mots / groupes`:'';
}
function rebuildEvents(){
 const input=$('#transcript');if(!input)return;
 const words=JSON.parse(input.value||'[]');
 $('#reference-events').value=JSON.stringify(words.length?draftModelEvents(state.selectedStyle,words,$('#graphic-zone').value):[],null,2);
 $('#placement-reviewed').checked=false;
 readDraft();
}

function showTranscript(transcript){
  const input=$('#transcript');if(!input)return;
  input.value=JSON.stringify(transcript.words,null,2);
  $('#captions-reviewed').checked=false;
  refreshWordEditor();
  const warnings=transcript.warnings||[];
  $('#transcription-status').textContent=`${transcript.words.length} mots ou groupes horodatés · ${warnings.length} point(s) à vérifier. ${transcript.notice}`;
}
function showSourceSignals(report){
  const target=$('#source-signals');if(!target)return;
  target.innerHTML=signalSummary(report)+`<p class="help-text section">Écoutez chaque passage avant de cocher. Les 250 ms aux bords de chaque pause sont conservées.</p>${report.suggestions.map(p=>`<label class="checkbox-label section"><input type="checkbox" data-pause-id="${esc(p.id)}"><span>Raccourcir ${number(p.startMs/1000)}–${number(p.endMs/1000)} s <button class="text-button" type="button" data-action="seek-source" data-time="${Math.max(0,p.startMs/1000-.5)}">Écouter</button></span></label>`).join('') || '<p class="help-text">Aucune pause intérieure de plus de 0,8 seconde détectée. Vous pouvez conserver le rush et ajouter vos sous-titres.</p>'}`;
  const choices=state.analysisCuts;
  if(choices?.projectId===state.project?.id&&choices.fingerprint===report.fingerprint)for(const el of document.querySelectorAll('[data-pause-id]'))el.checked=choices.ids.includes(el.dataset.pauseId);
  $('[data-action=guided-edit]').disabled=false;
}
function signalSummary(report){
  return `<p class="help-text">${esc(report.notice)}</p>${Object.values(report.criteria||{}).map(c=>`<details><summary>${esc(c.label)} · ${c.score==null?'Non évaluable':c.score+'/100'}</summary><p>${esc(c.notice)}</p><small>${esc(c.formula)}</small></details>`).join('')}${(report.findings||[]).map(f=>`<details><summary>${number(f.startMs/1000)}–${number(f.endMs/1000)} s · ${esc(f.what)}</summary><p>${esc(f.why)}</p><p>${esc(f.how)}</p></details>`).join('')}<p class="help-text"></p><div class="section">${stat('Pauses acoustiques',number(report.silenceRatio*100)+' %','Seuil mesuré : −35 dBFS')}${stat('Niveau moyen',report.meanVolumeDb==null?'Non disponible':number(report.meanVolumeDb)+' dBFS','Mesure du fichier source')}</div><ul>${report.recommendations.map(text=>`<li>${esc(text)}</li>`).join('')}</ul><small>Moteur ${esc(report.engineVersion)} · fichier ${esc(report.fingerprint.slice(0,12))}</small>`;
}

function updateStyleDetail() {
  const style = state.styles.find(item => (item.style_id || item.id) === state.selectedStyle);
  if (!style || !$('#model-detail')) return;
  const available = style.available || style.enabled || style.status === 'production';
  $('#model-detail').innerHTML = `<p>${state.selectedStyle==='cinematic-storytelling-v7'?'<strong>Bêta — transcription à vérifier.</strong> ':''}${esc(style.description || style.reason || style.unavailable_reason || (available ? 'Moteur disponible pour essais. Les contrôles qualité restent requis.' : 'Sources ou dépendances de rendu non disponibles. Aucun rendu de remplacement ne sera généré.'))}</p>${(style.missingSources || style.missing)?.length ? `<p class="mt-8">Éléments requis : ${(style.missingSources || style.missing).map(esc).join(', ')}</p>` : ''}`;
  $('#restored-controls').hidden=!style.previewAvailable;
  const previewButton=$('[data-action=restored-preview]');if(previewButton)previewButton.disabled=!state.project?.has_source;
  const renderButton = $('[data-action="render"]');
  if (renderButton) renderButton.disabled = !available || !state.project?.has_source || state.project.state==='rendering';
  document.querySelectorAll('.model').forEach(element => element.setAttribute('aria-pressed', String(element.dataset.id === state.selectedStyle)));
  updateZoneGuide();
}

async function strategy() {
  main.innerHTML = `<section class="page">${heading('Analyse', 'Comprendre. Puis créer.', 'Des constats mesurés. Des corrections expliquées.')}<details class="analysis-library"><summary>Profil, statistiques et méthodes</summary><div class="subnav" role="group" aria-label="Sections Analyse">${[['overview','Vue d’ensemble'],['profile','Mon profil'],['metrics','Performances'],['video','Analyser une vidéo'],['methods','Méthodes'],['competitors','Concurrence'],['results','Résultats']].map(([id,label]) => `<button data-action="strategy-tab" data-id="${id}" class="${state.strategyTab === id ? 'active' : ''}">${label}</button>`).join('')}</div></details><div id="strategy-content"><div class="loading-screen"><span class="spinner"></span></div></div></section>`;
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
    await analysisView(content);
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
  const controller=state.abortController;
  clearTimeout(state.jobTimer);
  readDraft();
  const view=++state.view;
  const target = currentPage();
  $('#main-nav').querySelectorAll('a').forEach(element => {
    if (element.dataset.tab === target) element.setAttribute('aria-current','page');
    else element.removeAttribute('aria-current');
  });
  if (!state.user) return auth();
  try {
    if (target === 'montage') await montage();
    else if (target === 'analysis') await strategy();
    else if(target==='projects')await projectLibrary();
    else if (target === 'admin') await admin();
    else await home();
    main.focus({ preventScroll:true });
  } catch (error) {
    if(staleSession(error) || controller!==state.abortController || view!==state.view)return;
    main.innerHTML = `<section class="page">${heading('Votre espace','Une action à reprendre.')}<div class="panel"><p class="form-error">${esc(error.message)}</p><button class="button secondary section" data-action="retry">Réessayer</button></div></section>`;
  }
}

async function saveProject(form) {
  const controller=state.abortController;
  const title = new FormData(form).get('title');
  if (!state.project) {
    const result = await post('/api/projects', { name: title });
    ensureCurrentSession(controller);
    state.project = result.project || result;
  } else {
    const result = await api('/api/projects/' + encodeURIComponent(state.project.id), { method:'PATCH',body:JSON.stringify({name:title}) });
    ensureCurrentSession(controller);
    state.project = result.project || { ...state.project,title };
  }
  if (state.file) {
    const status = $('#upload-status');
    status.innerHTML = '<div class="notice">' + icon('upload') + '<span>Enregistrement de la vidéo… Gardez cette page ouverte.</span></div><div class="progress-track"><span></span></div>';
    const result = await api('/api/projects/' + encodeURIComponent(state.project.id) + '/source', {
      method:'POST',body:state.file,headers:{'Content-Type':state.file.type || 'application/octet-stream','X-Filename':encodeURIComponent(state.file.name)}
    });
    ensureCurrentSession(controller);
    state.project = result.project || { ...state.project,source_name:state.file.name,has_source:true };
    state.file = null;
    if (state.objectUrl) URL.revokeObjectURL(state.objectUrl);
    state.objectUrl = null;
  }
  notify('Votre projet est enregistré.');
  await montage();
}

async function renderProject(styleId = state.selectedStyle) {
  const projectId=state.project?.id,view=state.view;
  if(state.renderStarting)return;
  readDraft();
  const transcript = $('#transcript')?.value.trim();
  let aligned;
  if (transcript) { try { aligned = JSON.parse(transcript); } catch { throw new Error('La transcription doit être un tableau JSON valide.'); } }
  if($('#captions-reviewed')?.checked===true&&Array.isArray(aligned))aligned=aligned.map(w=>w?.reviewRequired===true?{...w,confirmed:true}:w);
  let events;
  if(styleId.startsWith('restored-preview:')||state.styles.some(s=>s.id===styleId&&s.previewAvailable)){try{events=JSON.parse($('#reference-events').value);}catch{throw new Error('Les événements graphiques doivent être un tableau JSON valide.');}}
  const payload={style_id:styleId,transcript:aligned,events,allowUnreviewedPreview:$('#caption-preview-mode')?.checked===true,placementReviewed:$('#placement-reviewed')?.checked===true,approvedPauseIds:[...document.querySelectorAll('[data-pause-id]:checked')].map(input=>input.dataset.pauseId),captionsReviewed:$('#captions-reviewed')?.checked===true};
  const serialized=JSON.stringify(payload);
  if(state.renderRequest?.projectId!==projectId||state.renderRequest?.payload!==serialized)state.renderRequest={projectId,payload:serialized,key:crypto.randomUUID()};
  payload.requestId=state.renderRequest.key;
  const area = $('#render-status');
  area.innerHTML = '<div class="notice">' + icon('clock') + '<span>Vérification du moteur et des sources…</span></div>';
  let acceptedJobId;
  state.renderStarting=true;
  const renderButton=$('[data-action=render]');if(renderButton)renderButton.disabled=true;
  try {
    const data = await post('/api/projects/' + encodeURIComponent(projectId) + '/render', payload);
    const job = data.job || data;
    if (!job.id && !job.job_id) throw new Error('Le moteur n’a pas retourné de tâche de rendu.');
    acceptedJobId=job.id||job.job_id;
    await pollJob(acceptedJobId,projectId,view);
  } catch (error) {
    if(area.isConnected)area.innerHTML = `<p class="form-error section" role="alert">${esc(error.message)}</p>${acceptedJobId?`<button class="button secondary" data-action="resume-job" data-id="${esc(acceptedJobId)}">Vérifier à nouveau</button><p class="help-text">La tâche est enregistrée sur le serveur. Vous pouvez aussi la retrouver dans Projets.</p>`:''}`;
  }finally{state.renderStarting=false;if(renderButton?.isConnected)updateStyleDetail();}
}

async function pollJob(id,projectId=state.project?.id,view=state.view) {
  if(view!==state.view||state.project?.id!==projectId||currentPage()!=='montage')return;
  const data = await api('/api/jobs/' + encodeURIComponent(id));
  if(view!==state.view||state.project?.id!==projectId||currentPage()!=='montage')return;
  const job = data.job || data;
  const status = job.state || job.status || job.job_state;
  state.project.latestJob=job;state.project.state=status==='complete'?'complete':['rendering','queued'].includes(status)?'rendering':'ready';
  if(status==='complete')state.project.has_output=true;
  updateStyleDetail();
  const area = $('#render-status');
  if (!area) return;
  if (['complete','completed','succeeded','done'].includes(status)) {
    const url = job.export_url || job.download_url || '/api/projects/' + encodeURIComponent(projectId) + '/output';
    area.innerHTML = `<div class="video-stage section"><video controls playsinline src="${esc(url)}"></video></div><a class="button full section" href="${esc(url)}${url.includes('?')?'&':'?'}download=1" download> ${icon('download')}Télécharger le MP4</a><button class="button secondary full section" data-action="share-output" data-id="${esc(projectId)}">${icon('share')}Partager le MP4</button><p class="help-text section">Vérifiez la synchronisation, la composition et l’audio avant publication.</p>`;
  } else if (['failed','error','blocked','superseded'].includes(status)) {
    if(state.renderRequest?.projectId===projectId)state.renderRequest=null;
    area.innerHTML = `<div class="render-failure" role="alert"><h3>Ce montage est à reprendre.</h3><p>${esc(job.error_message || job.error || job.message || 'Le moteur n’a pas pu produire le rendu.')}</p><p class="help-text">Votre rush est conservé. Vérifiez les réglages puis relancez le montage.</p></div>`;
  } else {
    area.innerHTML = `<div class="notice" role="status">${icon('clock')}<span>Rendu en cours · ${Math.max(0,Math.min(99,Number(job.progress)||0))} % · gardez cette page ouverte.</span></div><progress max="100" value="${Math.max(0,Math.min(99,Number(job.progress)||0))}" aria-label="Progression du montage"></progress>`;
    state.jobTimer = setTimeout(() => pollJob(id,projectId,view).catch(error => { if(view===state.view&&$('#render-status'))$('#render-status').innerHTML=`<p class="form-error">${esc(error.message)}</p><button class="button secondary" data-action="resume-job" data-id="${esc(id)}">Vérifier à nouveau</button><p class="help-text">Le traitement continue sur le serveur s’il est toujours actif.</p>`; }), document.hidden?6000:2000);
  }
}

document.addEventListener('click', async event => {
  const element = event.target.closest('[data-action]');
  if (!element) return;
  const action = element.dataset.action;
  if(action==='analysis-to-montage'){state.project=state.analysisProject;rememberProject();location.hash='montage';return;}

  try {
    if(action==='prepare-model'){await prepareModel(element);return;}
    if(action==='project-options'){await openProjectOptions(element.dataset.id);return;}
    if(action==='filter-projects'){state.filter=element.dataset.id;await projectLibrary();return;}
    if(action==='project-analysis'){readDraft();state.analysisProject=(await api('/api/projects/'+encodeURIComponent(element.dataset.id))).project;state.strategyTab='video';closeSheet();if(currentPage()==='analysis')await strategy();else location.hash='analysis';return;}
    if(action==='remove-project'){if(confirm('Supprimer ce projet et ses fichiers ?')){await api('/api/projects/'+encodeURIComponent(element.dataset.id),{method:'DELETE'});if(state.project?.id===element.dataset.id){state.project=null;try{sessionStorage.removeItem('socialplus-project-'+state.user.id);}catch{}}if(state.analysisProject?.id===element.dataset.id)state.analysisProject=null;delete state.drafts[element.dataset.id];closeSheet();if(currentPage()==='projects')await projectLibrary();else await route();}return;}
    if(action==='retry-upload'){await importVideo(state.file,element.dataset.analysis==='true');return;}
    if(action==='refresh-words'){refreshWordEditor();rebuildEvents();return;}
    if(action==='resume-job'){await pollJob(element.dataset.id);return;}
    if(action==='share-output'){await prepareShare(element.dataset.id,element);return;}
    if(action==='share-ready'){if(state.shareFile)await navigator.share({files:[state.shareFile],title:'Social+'});return;}
    if (action === 'auth-login' || action === 'auth-activate') { state.authMode = action === 'auth-login' ? 'login' : 'activate'; auth(); }
    else if (action === 'new-project') { readDraft();state.project=null;try{sessionStorage.removeItem('socialplus-project-'+state.user.id);}catch{}state.file=null;if(state.objectUrl)URL.revokeObjectURL(state.objectUrl);state.objectUrl=null;if(location.hash==='#montage') await montage();else location.hash='montage'; }
    else if (action === 'open-project') {
      const data = await api('/api/projects/' + encodeURIComponent(element.dataset.id));
      readDraft();state.project=data.project || data;state.selectedStyle=state.project.style_id||state.selectedStyle;rememberProject();closeSheet();state.file=null;if(state.objectUrl)URL.revokeObjectURL(state.objectUrl);state.objectUrl=null;
      if(location.hash==='#montage')await montage();else location.hash='montage';
    } else if (action === 'select-style') { const previous=state.selectedStyle;try{state.selectedStyle=element.dataset.id;rebuildEvents();updateStyleDetail();}catch(e){state.selectedStyle=previous;throw e;} }
    else if(action==='restored-preview')await renderProject('restored-preview:'+state.selectedStyle);
    else if (action === 'render') await renderProject();
    else if(action==='draft-model-events'){const words=JSON.parse($('#transcript').value||'[]');const events=draftModelEvents(state.selectedStyle,words,$('#graphic-zone').value);$('#reference-events').value=JSON.stringify(events,null,2);$('#placement-reviewed').checked=false;notify(events.length?`${events.length} animation(s) proposée(s). Vérifiez leur placement.`:'Aucun mot pertinent pour ce modèle : les sous-titres restent actifs.');}
    else if(action==='transcribe-source'){element.disabled=true;const status=$('#transcription-status');status.textContent='Transcription locale en cours…';try{const {transcript}=await post('/api/projects/'+encodeURIComponent(state.project.id)+'/transcript');showTranscript(transcript);}catch(error){if(status.isConnected)status.textContent=error.message;throw error;}finally{if(element.isConnected)element.disabled=false;}}
    else if(action==='analyze-source'){element.disabled=true;try{const {report}=await post('/api/projects/'+encodeURIComponent(state.project.id)+'/signals');showSourceSignals(report);}finally{if(element.isConnected)element.disabled=false;}}
    else if(action==='guided-edit')await renderProject('guided-edit');
    else if(action==='seek-source'){const video=$('#source-preview');if(video){video.currentTime=Number(element.dataset.time);video.play().catch(()=>{});}}
    else if(action==='strategy-source-analysis'){element.disabled=true;try{const {report}=await post('/api/projects/'+encodeURIComponent($('#strategy-project').value)+'/signals');$('#strategy-source-signals').innerHTML=signalSummary(report);}finally{if(element.isConnected)element.disabled=false;}}
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
    else if (action === 'logout') { await post('/api/auth/logout');resetPrivateState();await session();await route(); }
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
  } catch(error) { element.disabled=false;if(error.name!=='AbortError')notify(error.message); }
});

async function prepareModel(element){
 const controller=state.abortController,view=state.view,id=state.project.id;
 element.disabled=true;$('#transcription-status').textContent='Mesure du son et transcription locale…';
 try{
  const {report}=await post('/api/projects/'+encodeURIComponent(id)+'/signals');
  const {transcript}=await post('/api/projects/'+encodeURIComponent(id)+'/transcript');
  ensureCurrentSession(controller);if(view!==state.view||state.project?.id!==id)return;
  showSourceSignals(report);showTranscript(transcript);rebuildEvents();$('#caption-preview-mode').checked=true;readDraft();
  $('#transcription-status').textContent+= ' Préparation terminée : ouvrez la revue des paroles, puis vérifiez les zones.';
  notify('Montage préparé. Vérifiez les paroles et les zones.');
 }catch(e){if(view===state.view&&$('#transcription-status'))$('#transcription-status').textContent=e.message;throw e;}
 finally{if(element.isConnected)element.disabled=false;}
}
async function prepareShare(id,element){
 if(!navigator.share||!navigator.canShare){notify('Téléchargez le MP4, puis partagez-le depuis Fichiers.');return;}
 element.disabled=true;
 try{const file=await loadShareFile(id,{signal:state.abortController.signal});if(!navigator.canShare({files:[file]})){notify('Le partage de fichiers n’est pas disponible. Utilisez Télécharger.');return;}state.shareFile=file;openSheet('Partager votre montage',`<p>Le MP4 est prêt pour le partage. Choisissez ensuite son destinataire dans la feuille de partage de votre appareil.</p><button class="button full section" data-action="share-ready">${icon('share')}Ouvrir le partage</button>`);}
 finally{if(element.isConnected)element.disabled=false;}
}

document.addEventListener('submit', async event => {
  const form=event.target.closest('[data-form]');
  if (!form) return;
  event.preventDefault();
  const controller=state.abortController;
  const values=Object.fromEntries(new FormData(form));
  setBusy(form,true);
  try {
    switch(form.dataset.form) {
      case 'login': case 'activate': {
        if(form.dataset.form==='activate')values.acceptTerms=true;
        const data=await post('/api/auth/' + form.dataset.form,values);
        resetPrivateState();state.user=data.user;state.csrf=data.csrf || data.user?.csrf;await session();history.replaceState(null,'','#home');await route();notify('Bienvenue dans votre espace.');break;
      }
      case 'reset-password': await post('/api/auth/reset',values);closeSheet();notify('Mot de passe modifié. Connectez-vous avec votre nouveau mot de passe.');break;
      case 'redeem-invite': await post('/api/gifts/redeem',values);closeSheet();await session();notify('Votre invitation a été activée.');break;
      case 'project-save': await saveProject(form);break;
      case 'mission-proof': {const result=await api('/api/strategy/missions/' + encodeURIComponent(form.dataset.id),{method:'PATCH',body:JSON.stringify(values)});const mission=state.missions.find(item=>item.id===form.dataset.id);Object.assign(mission,result.mission);notify('Votre preuve est enregistrée.');break;}
      case 'profile': await api('/api/strategy/profile',{method:'PUT',body:JSON.stringify(values)});notify('Votre profil est enregistré.');break;
      case 'csv': {
        const file=new FormData(form).get('csvfile');
        if(file.size>2000000)throw new Error('Le CSV dépasse 2 Mo. Importez un extrait plus petit.');
        const csv=await file.text();ensureCurrentSession(controller);
        state.csvSource=csv;state.csvPlatform=values.platform;
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
      case 'delete-account': await post('/api/privacy/delete',values);resetPrivateState();await session();await route();notify('Votre compte et vos données ont été supprimés.');break;
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
  } catch(error) { if(staleSession(error))return;if(form.dataset.form==='project-save' && $('#upload-status'))$('#upload-status').innerHTML='';formError(form,error); }
  finally { if(form.isConnected)setBusy(form,false); }
});

document.addEventListener('change',async event=>{
  if(event.target.matches('[data-mission-step]')) {
    const mission=state.missions?.find(item=>item.id===event.target.dataset.missionId);if(!mission)return;
    const steps=mission.steps.map((step,index)=>({...step,completed:index===Number(event.target.dataset.missionStep)?event.target.checked:step.completed}));
    try {const result=await api('/api/strategy/missions/' + encodeURIComponent(mission.id),{method:'PATCH',body:JSON.stringify({steps})});Object.assign(mission,result.mission);notify('Étape enregistrée.');}catch(error){event.target.checked=!event.target.checked;notify(error.message);}
  } else if(event.target.id==='video-input'||event.target.id==='analysis-video'){
    try{await importVideo(event.target.files?.[0],event.target.id==='analysis-video');}catch(e){if(!staleSession(e))notify(e.message);}
  } else if(event.target.id==='analysis-project-select'){
    try{state.analysisProject=event.target.value?(await api('/api/projects/'+encodeURIComponent(event.target.value))).project:null;await strategy();}catch(e){notify(e.message);}
  } else if(event.target.matches('[data-analysis-pause]')){state.analysisCuts.ids=[...document.querySelectorAll('[data-analysis-pause]:checked')].map(el=>el.dataset.analysisPause);const draft=state.drafts[state.analysisCuts.projectId];if(draft)draft.pauseIds=[...state.analysisCuts.ids];}
  else if(event.target.id==='graphic-zone'){rebuildEvents();updateZoneGuide();}
  else if(event.target.matches('[data-word-index]')){
    const words=JSON.parse($('#transcript').value||'[]');const index=Number(event.target.dataset.wordIndex);
    words[index]={...words[index],text:event.target.value,reviewRequired:true,confirmed:false};
    $('#transcript').value=JSON.stringify(words,null,2);$('#captions-reviewed').checked=false;rebuildEvents();
  }
  if(event.target.matches('#captions-reviewed,#caption-preview-mode,#placement-reviewed,#reference-events,#transcript,[data-pause-id]'))readDraft();
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
    if(values[key+'_score']===''||values[key+'_score']==null)continue;
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

async function analysisView(content){
 const view=state.view;
 const {projects=[]}=await api('/api/projects');if(view!==state.view||!content.isConnected)return;
 const sources=projects.filter(p=>p.has_source);
 if(!state.analysisProject&&state.project?.has_source)state.analysisProject=state.project;
 if(state.analysisProject&&!sources.some(p=>p.id===state.analysisProject.id))state.analysisProject=null;
 const project=state.analysisProject;
 content.innerHTML=`<div class="analysis-layout"><div>${project?`<div class="video-stage"><video id="analysis-media" controls playsinline preload="metadata" src="/api/projects/${encodeURIComponent(project.id)}/media"></video></div><div class="file-detail"><div><strong>${esc(project.name)}</strong><p>${esc(sourceMeta(project))}</p></div><label class="text-button" for="analysis-video">Changer</label></div>`:`<label class="upload-area" for="analysis-video"><span class="upload-symbol">${icon('chart')}</span><h3>Choisir une vidéo</h3><p>Repérez ce qui mérite votre attention.<br>Votre rush reste privé.</p><small>Photothèque ou Fichiers · 200 Mo maximum</small></label>`}<input id="analysis-video" class="visually-hidden" type="file" accept="video/*,.mov,.mp4,.m4v"><div id="analysis-upload-status" aria-live="polite"></div>${sources.length?`<label class="section">Réutiliser un rush enregistré<select id="analysis-project-select"><option value="">Choisir un projet</option>${sources.map(p=>`<option value="${esc(p.id)}" ${p.id===project?.id?'selected':''}>${esc(p.name)}</option>`).join('')}</select></label>`:''}<div id="analysis-preview"></div></div><div><form class="form" data-form="video-analysis"><label>Votre objectif<select name="goal_type"><option value="awareness">Visibilité</option><option value="community">Communauté</option><option value="leads">Prospects</option></select></label><button type="submit" class="button full" id="analyze-video-button" ${!project?'disabled':''}>${icon('chart')}Analyser mon rush</button><p class="help-text">Mesures acoustiques réelles, sans prédiction de vues. Les critères non observables ne sont pas notés.</p>${editorialReview()}<p class="form-error" role="alert"></p></form><div id="video-analysis-result" class="section" aria-live="polite"></div></div></div>`;
 if(project){const {report}=await api('/api/projects/'+encodeURIComponent(project.id)+'/signals');if(view===state.view&&report)showAnalysisResult(report);}
}
function editorialView(editorial){
 if(!editorial)return '';
 const labels={hook:'Hook',clarity:'Clarté',structure:'Structure',rhythm:'Rythme',retention:'Rétention',captions:'Sous-titres',visuals:'Visuels',audio:'Audio',cta:'CTA',originality:'Originalité'};
 return `<section class="section"><h3>Repères éditoriaux locaux</h3><p class="help-text">${esc(editorial.notice)}</p>${Object.entries(editorial.criteria).map(([id,c])=>`<details><summary>${esc(labels[id])} · ${c.status==='not_evaluable'?'non évaluable':c.status==='measured'?'mesuré':'indice textuel'}</summary><p>${esc(c.observation)}</p><p class="help-text">${esc(c.limit)}</p></details>`).join('')}${editorial.findings.map(f=>`<details><summary>${number(f.startMs/1000)}–${number(f.endMs/1000)} s · ${esc(f.what)}${f.provisional?' · à confirmer':''}</summary><p><strong>Pourquoi</strong><br>${esc(f.why)}</p><p><strong>Comment</strong><br>${esc(f.how)}</p><p><strong>Vérifier l’amélioration</strong><br>${esc(f.verify)}</p><p class="help-text">Preuve : ${esc(f.evidence)}</p><button class="text-button" data-action="seek-analysis" data-time="${f.startMs/1000}">Écouter ce passage</button></details>`).join('')}<small>${esc(editorial.engineVersion)} · ${esc(editorial.inputHash.slice(0,12))} · aucun appel payant</small></section>`;
}
function showAnalysisResult(report,analysis,editorial){
 if(state.analysisCuts?.projectId!==state.analysisProject.id||state.analysisCuts?.fingerprint!==report.fingerprint)state.analysisCuts={projectId:state.analysisProject.id,fingerprint:report.fingerprint,ids:[]};
 const score=acousticScore(report);
 $('#video-analysis-result').innerHTML=`<section class="score-summary" data-score-version="${ACOUSTIC_SUMMARY_VERSION}"><div><p class="eyebrow">Diagnostic acoustique</p><strong class="score-value">${score==null?'—':score}<small>/100</small></strong></div><p>Indice technique v1, moyenne des sous-scores disponibles. Il ne mesure pas la qualité éditoriale ni la viralité.</p></section>${signalSummary(report)}${editorialView(editorial)}${report.suggestions.length?`<details><summary>Choisir les pauses à examiner dans Montage</summary><p class="help-text">Écoutez chaque passage avant de sélectionner une coupe. Les paroles et leurs marges restent protégées par le moteur.</p>${report.suggestions.map(p=>`<label class="checkbox-label section"><input type="checkbox" data-analysis-pause="${esc(p.id)}" ${state.analysisCuts.ids.includes(p.id)?'checked':''}><span>${number(p.startMs/1000)}–${number(p.endMs/1000)} s <button class="text-button" type="button" data-action="seek-analysis" data-time="${Math.max(0,p.startMs/1000-.5)}">Écouter</button></span></label>`).join('')}</details>`:''}<button class="button full section" data-action="analysis-to-montage">${icon('film')}Monter cette vidéo</button>${analysis?`<details><summary>Revue éditoriale · ${analysis.score==null?'non évaluable':analysis.score+'/100'}</summary><p>Couverture : ${number(analysis.coverage)} %. Notes fournies par vous, sans expertise automatique du discours.</p>${Object.entries(analysis.criteria||{}).map(([key,c])=>`<p><strong>${esc(REVIEW_CRITERIA.find(r=>r[0]===key)?.[1]||key)} · ${c.score}/100</strong><br>${esc(c.evidence)} · ${number(c.start_sec)} s</p>`).join('')}${(analysis.excluded_criteria||[]).map(c=>`<p>${esc(REVIEW_CRITERIA.find(r=>r[0]===c.key)?.[1]||c.key)} : ${esc(c.reason)}</p>`).join('')}</details>`:''}`;
}
async function analyzeVideo(form,values) {
 const controller=state.abortController,view=state.view,project=state.analysisProject;
 if(!project?.has_source)throw Error('Importez ou choisissez un rush enregistré.');
 $('#video-analysis-result').innerHTML='<div class="notice" role="status"><span class="spinner"></span><span>Mesure du son et des pauses…</span></div>';
 const {report}=await post('/api/projects/'+encodeURIComponent(project.id)+'/signals');
 ensureCurrentSession(controller);if(view!==state.view)return;
 const {analysis}=await post('/api/strategy/video-analyses',{fingerprint:report.fingerprint,context:{goal_type:values.goal_type},metadata:{duration_seconds:report.metadata.durationMs/1000,width:report.metadata.width,height:report.metadata.height,has_audio:report.metadata.hasAudio},transcript:{text:values.transcript_text||''},criteria:collectCriteria(values)});
 ensureCurrentSession(controller);if(view!==state.view)return;
 let editorial;try{({editorial}=await post('/api/projects/'+encodeURIComponent(project.id)+'/editorial',{goal:values.goal_type}));}catch(error){if(staleSession(error)||error.status===401)throw error;if(view===state.view){showAnalysisResult(report,analysis);$('#video-analysis-result').insertAdjacentHTML('beforeend',`<p class="form-error section" role="alert">Repères textuels indisponibles : ${esc(error.message)} Les mesures acoustiques restent disponibles.</p>`);}return;}
 ensureCurrentSession(controller);if(view!==state.view)return;
 showAnalysisResult(report,analysis,editorial);
}
async function importVideo(file,forAnalysis=false){
 if(!file)return;
 if(state.uploading)throw Error('Un import est déjà en cours.');
 if(!file.type.startsWith('video/')&&!(file.type===''&&/\.(mp4|mov|m4v|webm)$/i.test(file.name)))throw Error('Choisissez un fichier vidéo.');
 if(file.size>200*1048576)throw Error('Cette vidéo dépasse 200 Mo. Choisissez un rush plus court.');
 const controller=state.abortController,view=state.view;
 state.uploading=true;state.file=file;
 const status=forAnalysis?$('#analysis-upload-status'):$('#upload-status');
 if(status)status.innerHTML='<div class="notice" role="status"><span class="spinner"></span><span>Import de votre rush…</span></div><progress max="100" value="0" aria-label="Envoi de la vidéo"></progress><p class="help-text">Gardez le Wi-Fi et cette page ouverts.</p>';
 try{
  const created=state.retryFile===file&&state.retryProject?{project:state.retryProject}:await post('/api/projects',{name:file.name.replace(/\.[^.]+$/,'')});
  state.retryFile=file;state.retryProject=created.project;
  const uploaded=await uploadSource({projectId:created.project.id,file,csrf:state.csrf,signal:controller.signal,onProgress:value=>{if(status?.isConnected){status.querySelector('progress').value=value;status.querySelector('.notice span:last-child').textContent=value===100?'Vérification du fichier…':`Import · ${value} %`;}}});
  ensureCurrentSession(controller);
  state.project=uploaded.project;state.analysisProject=uploaded.project;state.file=null;state.retryFile=null;state.retryProject=null;
  if(state.objectUrl)URL.revokeObjectURL(state.objectUrl);state.objectUrl=null;rememberProject();
  if(view===state.view){if(forAnalysis)await strategy();else await montage();}
 }catch(error){
  if(status?.isConnected)status.innerHTML=`<p class="form-error" role="alert">${esc(error.message)}</p><button class="button secondary" data-action="retry-upload" data-analysis="${forAnalysis}">Réessayer l’import</button>`;
  throw error;
 }finally{state.uploading=false;}
}

document.addEventListener('input',event=>{
  if(event.target.id==='faq-search')document.querySelectorAll('[data-faq]').forEach(item=>{item.hidden=!item.dataset.faq.includes(event.target.value.toLocaleLowerCase('fr'));});
});
$('#account-button').addEventListener('click',account);
$('#close-sheet').addEventListener('click',closeSheet);
sheet.addEventListener('close',()=>{if(!sheet.open){sheet.querySelectorAll('video').forEach(v=>v.pause());state.shareFile=null;}});
sheet.addEventListener('click',event=>{if(event.target===sheet){const box=sheet.getBoundingClientRect();if(event.clientX<box.left||event.clientX>box.right||event.clientY<box.top||event.clientY>box.bottom)closeSheet();}});
window.addEventListener('hashchange',()=>{document.querySelectorAll('video').forEach(v=>v.pause());closeSheet();route();window.scrollTo({top:0});});
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&state.user&&currentPage()==='montage'&&state.project?.latestJob?.state==='rendering'){clearTimeout(state.jobTimer);pollJob(state.project.latestJob.id).catch(e=>notify(e.message));}});
window.addEventListener('offline',()=>notify('Vous êtes hors ligne. Les actions seront disponibles au retour de la connexion.'));
try {document.documentElement.dataset.theme=localStorage.getItem('socialplus-theme') || (matchMedia('(prefers-color-scheme: light)').matches?'light':'dark');} catch {document.documentElement.dataset.theme='dark';}
hydrateIcons();
try { await session();if(new URLSearchParams(location.search).has('invite'))state.authMode='activate';await route(); }
catch(error) { main.innerHTML=`<div class="loading-screen"><h2>Votre espace est indisponible.</h2><p>${esc(error.message)}</p><button class="button secondary" data-action="retry">Réessayer</button></div>`; }
