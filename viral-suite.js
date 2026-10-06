(()=>{
  const SUPABASE_URL=String(window.VIRAL_SUPABASE_URL||'').replace(/\/$/,'');
  const SUPABASE_KEY=String(window.VIRAL_SUPABASE_KEY||'');
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  let toastTimer=0,currentClipProject=null,currentClipJob=null;

  function notify(message){
    let el=document.getElementById('suiteToast');
    if(!el){el=document.createElement('div');el.id='suiteToast';el.className='suiteToast';document.body.appendChild(el)}
    el.textContent=message;el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),3600);
  }
  function stored(){try{return JSON.parse(localStorage.getItem('viralplus_session')||'null')}catch{return null}}
  function save(s){if(s)localStorage.setItem('viralplus_session',JSON.stringify(s));else localStorage.removeItem('viralplus_session')}
  async function accessToken(){
    let s=stored();if(!s?.access_token)return null;
    if(s.expires_at&&Date.now()/1000>s.expires_at-60){
      if(!s.refresh_token)return null;
      const r=await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`,{method:'POST',headers:{apikey:SUPABASE_KEY,'Content-Type':'application/json'},body:JSON.stringify({refresh_token:s.refresh_token})});
      if(!r.ok){save(null);return null}
      s=await r.json();s.expires_at=Math.floor(Date.now()/1000)+(s.expires_in||3600);save(s);
    }
    return s.access_token;
  }
  async function request(path,{method='GET',body}={}){
    const token=await accessToken();
    if(!token){document.getElementById('accountBtn')?.click();throw new Error('Connecte-toi pour utiliser Clip+.');}
    const r=await fetch(`${SUPABASE_URL}${path}`,{method,headers:{apikey:SUPABASE_KEY,Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
    let data=null;try{data=await r.json()}catch{}
    if(!r.ok)throw new Error(data?.error||data?.message||`Erreur ${r.status}`);
    return data;
  }
  const clipApi=(route,opts)=>request('/functions/v1/clip-jobs/'+String(route||'').replace(/^\//,''),opts);
  const editApi=(route,opts)=>request('/functions/v1/viral-edit-jobs/'+String(route||'').replace(/^\//,''),opts);

  function injectShell(){
    const nav=document.querySelector('.nav');
    const brand=nav?.querySelector('.brand');
    if(brand){brand.innerHTML='VIRAL<b>+</b><span class="studioWord">STUDIO</span>';brand.setAttribute('aria-label','Viral+ Studio')}

    const suiteNav=document.createElement('div');suiteNav.className='suiteNav';suiteNav.innerHTML=`
      <button class="active" data-suite="home">Studio</button>
      <button data-suite="analyze">Analyze+</button>
      <button data-suite="edit">Edit+</button>
      <button data-suite="clip">Clip+</button>`;
    document.body.appendChild(suiteNav);

    const cinematic=document.getElementById('cinematic');
    const studio=document.createElement('section');studio.className='studioIntro';studio.id='studio';studio.innerHTML=`
      <div class="studioIntroInner">
        <div class="studioEyebrow"><i></i>VIRAL+ STUDIO · CONTENT INTELLIGENCE</div>
        <h2>ONE VIDEO.<span>EVERY MOVE.</span></h2>
        <p class="studioIntroLead">Une seule interface pour comprendre ce qui bloque, monter une version plus forte et transformer une longue vidéo en plusieurs shorts prêts à publier.</p>
        <div class="studioModuleGrid">
          <article class="studioModule" data-open="analyze"><small>01 · ANALYZE+</small><h3>Comprends.</h3><p>Upload ton Reel. Viral+ mesure le hook, le rythme, la rétention potentielle et te montre quoi corriger.</p><div class="moduleArrow">↗</div></article>
          <article class="studioModule" data-open="edit"><small>02 · EDIT+</small><h3>Transforme.</h3><p>Silences, cuts, punch-ins, captions, structure et rendu vertical : le diagnostic devient un montage.</p><div class="moduleArrow">↗</div></article>
          <article class="studioModule clip" data-open="clip"><small>03 · CLIP+</small><h3>Multiplie.</h3><p>Colle un lien autorisé YouTube, TikTok ou Instagram. L’IA trouve les meilleurs moments et génère plusieurs clips.</p><div class="moduleArrow">↗</div></article>
        </div>
      </div>`;
    if(cinematic?.parentNode)cinematic.parentNode.insertBefore(studio,cinematic.nextSibling);

    const workspace=document.getElementById('workspace');
    const clip=document.createElement('section');clip.className='clipStudio';clip.id='clipStudio';clip.innerHTML=`
      <div class="clipStudioInner">
        <div class="clipTop">
          <div><div class="studioEyebrow"><i></i>CLIP+ · AI REPURPOSING</div><h2>ONE LINK.<br><em>MANY CLIPS.</em></h2></div>
          <p>Clip+ importe une vidéo publique que tu as le droit d’utiliser, la transcrit, repère les moments autonomes les plus forts, les recadre en 9:16, ajoute les sous-titres et rend les MP4.</p>
        </div>
        <div class="clipWorkbench">
          <div class="clipPanel">
            <div class="clipUrlWrap"><span>↗</span><input id="clipSourceUrl" type="url" inputmode="url" placeholder="Colle le lien YouTube, TikTok ou Instagram…"><button id="clipStart">Créer mes clips</button></div>
            <div class="platformRow"><div class="platformChip"><b>▶</b>YouTube</div><div class="platformChip"><b>♪</b>TikTok</div><div class="platformChip"><b>◎</b>Instagram</div><div class="platformChip"><b>9:16</b>prêt à poster</div></div>
            <div class="clipOptions">
              <div class="clipField"><label>Nombre de clips</label><select id="clipCount"><option value="3">3 clips</option><option value="5" selected>5 clips</option><option value="8">8 clips</option></select></div>
              <div class="clipField"><label>Durée</label><select id="clipDuration"><option value="20-45">20–45 s</option><option value="30-60" selected>30–60 s</option><option value="45-90">45–90 s</option></select></div>
              <div class="clipField"><label>Sous-titres</label><select id="clipCaption"><option value="modern_bold">Modern Bold</option><option value="creator">Creator</option><option value="authority">Authority</option><option value="minimal">Minimal</option><option value="karaoke">Karaoke</option><option value="ugc">UGC</option></select></div>
            </div>
            <label class="rightsRow"><input id="clipRights" type="checkbox"><span>Je confirme que je possède cette vidéo ou que j’ai l’autorisation de la télécharger, la modifier et la republier.</span></label>
            <div class="clipStatus" id="clipStatus"><div class="clipStatusTop"><strong id="clipStage">Prêt</strong><span id="clipPct">0%</span></div><div class="clipProgress"><i id="clipBar"></i></div></div>
          </div>
          <div class="clipPanel clipExplain">
            <div class="clipExplainCard"><small>01 · UNDERSTAND</small><strong>Transcription horodatée</strong><p>L’IA comprend les phrases, les pauses et les idées, pas seulement les changements de plans.</p></div>
            <div class="clipExplainCard"><small>02 · SELECT</small><strong>Moments autonomes</strong><p>Hook, valeur, tension, fin naturelle et potentiel de partage déterminent les candidats.</p></div>
            <div class="clipExplainCard"><small>03 · RENDER</small><strong>Short-form prêt à poster</strong><p>Vertical 1080×1920, audio normalisé et captions brûlées dans la vidéo.</p></div>
          </div>
        </div>
        <div class="clipResults" id="clipResults"></div>
      </div>`;
    if(workspace?.parentNode)workspace.parentNode.insertBefore(clip,workspace);

    suiteNav.addEventListener('click',e=>{const b=e.target.closest('button');if(b)openModule(b.dataset.suite)});
    document.querySelectorAll('[data-open]').forEach(el=>el.addEventListener('click',()=>openModule(el.dataset.open)));
    document.getElementById('clipStart')?.addEventListener('click',startClipJob);
  }

  function openModule(module){
    document.querySelectorAll('.suiteNav button').forEach(b=>b.classList.toggle('active',b.dataset.suite===module));
    if(module==='home')return document.getElementById('studio')?.scrollIntoView({behavior:'smooth'});
    if(module==='clip')return document.getElementById('clipStudio')?.scrollIntoView({behavior:'smooth'});
    if(module==='analyze'){
      const target=document.getElementById('dropzone')||document.getElementById('cinematic');target?.scrollIntoView({behavior:'smooth',block:'center'});return;
    }
    if(module==='edit'){
      document.getElementById('workspace')?.scrollIntoView({behavior:'smooth'});notify('Edit+ s’active après une analyse Viral+ ou directement depuis un clip Clip+.');
    }
  }

  function jobUI(job){
    const pct=Math.max(0,Math.min(100,Number(job?.progress)||0));
    const el=document.getElementById('clipStatus');el?.classList.toggle('active',!['completed','failed'].includes(job?.status));
    const labels={queued:'Mise en file',processing:'Import',transcribing:'Transcription',analyzing:'Sélection des moments',rendering:'Rendu des clips',encoding:'Encodage',completed:'Clips prêts',failed:'Échec'};
    const stage=job?.stage||labels[job?.status]||job?.status||'Traitement';
    if(document.getElementById('clipStage'))document.getElementById('clipStage').textContent=stage;
    if(document.getElementById('clipPct'))document.getElementById('clipPct').textContent=pct+'%';
    if(document.getElementById('clipBar'))document.getElementById('clipBar').style.width=pct+'%';
  }

  async function startClipJob(){
    const button=document.getElementById('clipStart'),url=document.getElementById('clipSourceUrl')?.value.trim(),rights=document.getElementById('clipRights')?.checked;
    if(!url)return notify('Colle d’abord le lien de la vidéo.');
    if(!rights)return notify('Confirme d’abord que tu as le droit d’utiliser cette vidéo.');
    const [min,max]=String(document.getElementById('clipDuration')?.value||'30-60').split('-').map(Number);
    button.disabled=true;button.textContent='Préparation…';document.getElementById('clipResults').innerHTML='';
    try{
      const created=await clipApi('create',{method:'POST',body:{source_url:url,confirm_rights:true,clip_count:Number(document.getElementById('clipCount')?.value||5),min_duration_sec:min,max_duration_sec:max,caption_preset:document.getElementById('clipCaption')?.value||'modern_bold',add_captions:true}});
      currentClipProject=created.project?.id;currentClipJob=created.job?.id;if(!currentClipProject||!currentClipJob)throw new Error('Clip+ n’a pas créé le job.');
      jobUI(created.job);button.textContent='Clip+ travaille…';
      const finished=await pollClipJob(currentClipJob);jobUI(finished);
      const project=await clipApi('projects/'+currentClipProject);renderClips(project.clips||[]);notify(`${project.clips?.length||0} clip(s) prêt(s).`);
    }catch(err){notify(err.message||'Clip+ a rencontré une erreur.');jobUI({status:'failed',progress:0,stage:err.message||'Échec'});}
    finally{button.disabled=false;button.textContent='Créer mes clips'}
  }

  async function pollClipJob(id){
    const deadline=Date.now()+45*60*1000;
    while(Date.now()<deadline){
      const {job}=await clipApi('jobs/'+id);jobUI(job);
      if(job.status==='completed')return job;
      if(job.status==='failed'||job.status==='cancelled')throw new Error(job.error||'Le clipping a échoué.');
      await sleep(1600);
    }
    throw new Error('Le traitement continue en arrière-plan. Recharge ton historique plus tard.');
  }

  function renderClips(clips){
    const grid=document.getElementById('clipResults');if(!grid)return;
    if(!clips.length){grid.innerHTML='';return}
    grid.innerHTML=clips.map(c=>{
      const score=Math.max(0,Math.min(100,Number(c.viral_score)||0)),duration=Math.round((Number(c.end_ms)-Number(c.start_ms))/1000);
      return `<article class="clipCard" data-clip="${esc(c.id)}"><div class="clipRank"><span>CLIP ${String(c.rank).padStart(2,'0')}</span><div class="clipScore" style="--deg:${score*3.6}deg"><b>${score}</b></div></div><h4>${esc(c.title||'Moment sélectionné')}</h4><p>${esc(c.hook||c.rationale||'Passage sélectionné par Clip+.')}</p><div class="clipMeta">${duration}s · 1080×1920 · H.264</div><div class="clipActions"><button class="primary" data-action="open">Ouvrir</button><button data-action="analyze">Analyze+</button><button data-action="edit">Edit+</button></div></article>`;
    }).join('');
    grid.querySelectorAll('.clipCard').forEach(card=>card.addEventListener('click',async e=>{
      const button=e.target.closest('[data-action]');if(!button)return;const clip=clips.find(x=>x.id===card.dataset.clip);if(!clip)return;
      const action=button.dataset.action;
      try{
        button.disabled=true;
        if(action==='open'){
          const data=await clipApi(`clips/${clip.id}/url`);if(!data.signed_url)throw new Error('Lien privé indisponible.');window.open(data.signed_url,'_blank','noopener');
        }else if(action==='analyze')await analyzeClip(clip);
        else if(action==='edit')await editClip(clip);
      }catch(err){notify(err.message||'Action impossible.')}finally{button.disabled=false}
    }));
  }

  async function analyzeClip(clip){
    notify('Analyze+ examine ce clip…');
    const created=await request('/rest/v1/rpc/create_processing_job',{method:'POST',body:{p_kind:'viral_analysis',p_video_id:clip.output_video_id,p_payload:{source:'clipplus',clip_output_id:clip.id},p_idempotency_key:`viral:clip:${clip.id}`}});
    const job=Array.isArray(created)?created[0]:created;if(!job?.id)throw new Error('Impossible de lancer Analyze+.');
    const finished=await pollGenericJob(job.id,'clip-jobs');const score=finished.result?.final_score;
    notify(score!=null?`Analyse terminée : ${score}/100.`:'Analyse terminée. Ouvre ton historique Viral+.');
    document.getElementById('refreshHistory')?.click();setTimeout(()=>openModule('analyze'),700);
  }

  async function editClip(clip){
    notify('Edit+ prépare une version Creator Clean…');
    const created=await editApi('edit',{method:'POST',body:{video_id:clip.output_video_id,style:'creator_clean',caption_preset:'modern_bold',settings:{source:'clipplus',clip_output_id:clip.id}}});
    const job=created.job;if(!job?.id)throw new Error('Impossible de lancer Edit+.');
    const finished=await pollGenericJob(job.id,'viral-edit-jobs');const exportId=finished.result?.export_id;if(!exportId)throw new Error('Export Edit+ introuvable.');
    const out=await editApi(`exports/${exportId}/url`);if(!out.signed_url)throw new Error('URL Edit+ indisponible.');
    notify('Version Edit+ prête.');window.open(out.signed_url,'_blank','noopener');
  }

  async function pollGenericJob(id,endpoint){
    const deadline=Date.now()+35*60*1000;
    while(Date.now()<deadline){
      const data=endpoint==='clip-jobs'?await clipApi('jobs/'+id):await editApi('jobs/'+id);const job=data.job;
      if(job?.status==='completed')return job;
      if(job?.status==='failed'||job?.status==='cancelled')throw new Error(job.error||'Le traitement a échoué.');
      await sleep(1500);
    }
    throw new Error('Le traitement prend plus de temps que prévu.');
  }

  function motion(){
    if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;
    document.addEventListener('pointermove',e=>{
      const cards=[...document.querySelectorAll('.studioModule')];
      cards.forEach(card=>{const r=card.getBoundingClientRect();if(e.clientX<r.left-40||e.clientX>r.right+40||e.clientY<r.top-40||e.clientY>r.bottom+40){card.style.removeProperty('--mx');return}const x=(e.clientX-r.left)/r.width-.5,y=(e.clientY-r.top)/r.height-.5;card.style.transform=`translateY(-5px) rotateX(${(-y*3).toFixed(2)}deg) rotateY(${(x*3).toFixed(2)}deg)`});
    },{passive:true});
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{injectShell();motion()});else{injectShell();motion()}
})();
