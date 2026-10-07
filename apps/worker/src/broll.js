import {EDIT_STYLES} from './edit.js';

export async function planContextualBroll({
  timeline,
  style,
  geminiKey,
  model,
  fallbackModel
}){
  try{
    const cfg=
      EDIT_STYLES[style]||
      EDIT_STYLES.creator_clean;
    const captions=
      Array.isArray(timeline?.captions)
        ?timeline.captions
        :[];

    if(!captions.length)return [];

    const durationMs=Math.max(
      1,
      Number(timeline.outputDurationMs)||1
    );
    const maxCues=Math.max(
      1,
      Math.ceil(
        durationMs/30000*
        cfg.broll.maxPer30s
      )
    );

    const transcript=captionTranscript(
      captions,
      36000
    );

    const prompt=`Tu es le directeur B-roll de Edit+.

Tu dois choisir uniquement les moments où une vraie image améliore clairement la compréhension de ce qui est dit.
Ne remplis PAS la vidéo de B-roll.
Style de montage: ${style}.
Durée vidéo montée: ${(durationMs/1000).toFixed(1)} s.
Maximum: ${maxCues} B-rolls.\nCONTRAT DU MODÈLE: ${cfg.brollDirective||'B-roll uniquement pertinent.'}

RÈGLES:
- Ne mets pas de B-roll pendant tout le hook sauf si c'est indispensable.
- Préfère les noms concrets: lieux, objets, marques, métiers, technologies, personnes historiques, actions observables.
- Évite les concepts abstraits comme "succès", "motivation", "business" seuls.
- Chaque query_en doit être une recherche d'image courte et concrète en ANGLAIS.
- Ne traduis jamais mot-à-mot une phrase abstraite. Transforme l'idée en scène réellement photographiable.
- query_en et alt_queries_en ne doivent contenir AUCUN mot français.
- Si aucune scène visuelle précise n'améliore la phrase, n'ajoute aucun cue à cet endroit.
- Pour CHAQUE cue, fournis aussi exactement 3 alt_queries_en, du plus précis au plus simple.
- La 3e alternative doit contenir seulement 1 à 3 noms concrets faciles à trouver en photo (ex: "calculator price", "laptop analytics", "product boxes").
- Une image doit illustrer exactement la phrase prononcée.
- Interdiction de proposer des recherches génériques du type "business meeting", "person working laptop", "success", "professional office" sauf si ces éléments sont EXPLICITEMENT cités.
- Chaque cue doit avoir un visual_anchor concret: personne nommée, lieu, objet, interface, produit, geste, document, chiffre visualisable ou action précise.
- Ajoute specificity de 0 à 1. N'utilise un cue que si specificity >= 0.72.
- Évite deux B-rolls trop proches.
- Retourne uniquement du JSON valide.

FORMAT:
{"cues":[{"start_sec":4.2,"end_sec":6.8,"query_en":"New York stock exchange trading floor","alt_queries_en":["stock exchange traders","trading floor screens","stock traders"],"visual_anchor":"stock exchange trading floor","specificity":0.94,"reason":"illustre précisément la bourse citée"}]}

TRANSCRIPTION MONTÉE:
${transcript}`;

    let parsed=null;
    try{
      parsed=await generateJson({
        prompt,
        geminiKey,
        models:[model,fallbackModel]
      });
    }catch(error){
      console.warn(JSON.stringify({
        event:'broll_ai_fallback',
        error:String(error?.message||error).slice(0,500)
      }));
    }

    const raw=Array.isArray(parsed?.cues)&&parsed.cues.length
      ?parsed.cues
      :localCueCandidates(captions,maxCues,cfg);
    const cleaned=[];
    let lastEnd=-Infinity;

    for(const cue of raw){
      let startMs=Math.max(
        0,
        Math.round(Number(cue.start_sec||0)*1000)
      );
      let endMs=Math.min(
        durationMs,
        Math.round(Number(cue.end_sec||0)*1000)
      );

      if(startMs<900)startMs=900;
      const desired=Math.max(
        cfg.broll.minDurationMs,
        Math.min(
          cfg.broll.maxDurationMs,
          endMs-startMs
        )
      );
      endMs=Math.min(
        durationMs,
        startMs+desired
      );

      if(endMs-startMs<800)continue;
      if(
        startMs-lastEnd<
        cfg.broll.minGapMs
      )continue;

      const query=String(
        cue.query_en||''
      )
        .replace(/[\r\n]+/g,' ')
        .trim()
        .slice(0,100);

      if(query.length<3)continue;

      const altQueries=Array.isArray(cue.alt_queries_en)
        ?cue.alt_queries_en
          .map(x=>String(x||'').replace(/[\r\n]+/g,' ').trim().slice(0,100))
          .filter(x=>x.length>=3)
          .slice(0,4)
        :[];

      const specificity=Number(cue.specificity??(String(cue.reason||'').includes('local transcript fallback')?0.78:0));
      if(specificity<0.72)continue;
      if(isLowValueBrollQuery(query))continue;

      cleaned.push({
        startMs,
        endMs,
        query,
        searchQueries:buildSearchVariants(query,altQueries),
        visualAnchor:String(cue.visual_anchor||query).slice(0,160),
        specificity,
        reason:String(cue.reason||'')
          .slice(0,240)
      });
      lastEnd=endMs;

      if(cleaned.length>=maxCues)break;
    }

    console.log(JSON.stringify({
      event:'broll_plan_created',
      style,
      planned:cleaned.length,
      queries:cleaned.map(x=>x.query)
    }));

    const resolved=[];
    const used=new Set();

    for(const cue of cleaned){
      let asset=null;
      const attempts=Array.isArray(cue.searchQueries)&&cue.searchQueries.length
        ?cue.searchQueries
        :buildSearchVariants(cue.query,[]);
      let checked=0;

      for(const q of attempts){
        if(checked>=8)break;

        // Try more than one visual for the same semantic query. The first
        // search hit is often merely keyword-related, not editorially correct.
        for(let candidateAttempt=0;candidateAttempt<2;candidateAttempt++){
          const candidate=
            await findOpenverseAsset(q,used)||
            await findCommonsAsset(q,used);

          if(!candidate)break;
          checked++;

          const approved=await validateBrollAsset({
            cue,
            searchQuery:q,
            asset:candidate,
            geminiKey,
            models:[model,fallbackModel]
          });

          if(approved){
            asset=candidate;
            break;
          }

          used.add(candidate.assetUrl);
          if(checked>=8)break;
        }

        if(asset)break;
      }

      if(!asset){
        console.warn(JSON.stringify({
          event:'broll_asset_not_found',
          query:cue.query
        }));
        continue;
      }
      used.add(asset.assetUrl);
      resolved.push({
        ...cue,
        ...asset
      });
    }

    console.log(JSON.stringify({
      event:'broll_assets_resolved',
      style,
      planned:cleaned.length,
      resolved:resolved.length,
      assets:resolved.map(x=>({
        query:x.query,
        provider:x.provider,
        license:x.license,
        sourcePage:x.sourcePage
      }))
    }));

    return resolved;
  }catch(error){
    console.warn(JSON.stringify({
      event:'broll_planning_skipped',
      error:String(error?.message||error)
        .slice(0,700)
    }));
    return [];
  }
}

function isLowValueBrollQuery(query){
  const q=String(query||'').toLowerCase().replace(/[^a-z0-9\s-]/g,' ').replace(/\s+/g,' ').trim();
  if(!q)return true;

  const generic=[
    'business meeting',
    'professional office',
    'person working',
    'people working',
    'success business',
    'happy business person',
    'business people',
    'office team',
    'corporate office'
  ];
  if(generic.some(x=>q===x))return true;

  const concrete=/\b(iphone|smartphone|laptop|computer|dashboard|analytics|chart|contract|document|calculator|car|house|restaurant|camera|microphone|trading|stock|instagram|tiktok|youtube|money|cash|product|package|store|phone|screen|website|app|keyboard|desk|signature|meeting room|whiteboard)\b/i;
  const named=/\b[A-Z][a-z]{2,}\b/.test(String(query||''));
  const action=/\b(signing|typing|filming|editing|speaking|presenting|driving|cooking|shopping|paying|scrolling|recording|trading|packing|shipping|calling)\b/i.test(q);

  return !concrete.test(q)&&!named&&!action&&q.split(/\s+/).length<4;
}

function buildSearchVariants(query,alternates=[]){
  const base=String(query||'').replace(/[\r\n]+/g,' ').trim();
  const words=base.split(/\s+/).filter(Boolean);
  const meaningful=words.filter(w=>!/^(business|professional|modern|photo|photograph|image|different|side|numbers|declining|with|on|of|the|a|an)$/i.test(w));
  const variants=[
    base,
    ...alternates,
    meaningful.slice(0,4).join(' '),
    meaningful.slice(0,3).join(' '),
    meaningful.slice(-3).join(' '),
    meaningful.slice(-2).join(' ')
  ];

  return variants
    .map(x=>String(x||'').replace(/\s+/g,' ').trim())
    .filter((x,i,a)=>x.length>=3&&a.indexOf(x)===i)
    .slice(0,9);
}

function localCueCandidates(captions,maxCues,cfg){
  const stop=new Set([
    'alors','avec','avoir','comme','dans','des','donc','elle','elles','encore',
    'est','être','faire','fait','faut','ils','juste','mais','même','nous','parce',
    'pas','peut','plus','pour','quand','que','qui','quoi','sans','ses','son','sur',
    'tes','ton','tout','très','une','vous','vos','aux','ces','cet','cette','mes',
    'leur','leurs','notre','votre','cest','jai','estce','on','lui','moi','toi',
    'the','and','you','your','that','this','with','from','have','just','into',
    'about','what','when','where','why','how'
  ]);

  const concepts=[
    [/moins cher|prix|coût|coûte|tarif/i,'price tags retail shopping'],
    [/prospect|client|vente|vendre|vendeur/i,'salesperson talking with customer'],
    [/je me forme|formation|apprendre|cours/i,'person watching online course laptop'],
    [/peaufine|peaufiner|travail.*pas terminé|pas terminé/i,'video editor editing timeline computer'],
    [/reste[r]? à zéro|rester à zéro|à zéro|zero/i,'analytics dashboard zero sales'],
    [/toucher le cœur|coeur|cœur/i,'person hand on chest speaking'],
    [/aider les personnes|aider.*personne|besoin de toi/i,'one person helping another person'],
    [/offre|proposition|devis/i,'contract document desk office'],
    [/qualité|niveau/i,'quality control professional workplace'],
    [/accompagnement|suivi|support/i,'customer support agent headset'],
    [/solution|résoudre|problème|problématique/i,'person solving problem whiteboard'],
    [/compare|comparaison|comparer/i,'product comparison shopping'],
    [/résultat/i,'analytics dashboard laptop'],
    [/contrat|accord/i,'contract signing office'],
    [/équipe|collaborateur/i,'team meeting office'],
    [/téléphone|iphone|smartphone/i,'smartphone hand'],
    [/ordinateur|laptop|pc/i,'laptop desk'],
    [/instagram|réseaux sociaux|tiktok|youtube/i,'social media smartphone'],
    [/argent|euro|dollar|revenu/i,'cash money wallet'],
    [/maison|appartement|immobilier/i,'modern house real estate'],
    [/voiture|auto|véhicule/i,'modern car street'],
    [/restaurant|burger|food|repas/i,'restaurant food table'],
    [/trading|bourse|marché/i,'stock market trading screens']
  ];

  const candidates=[];
  for(let i=0;i<captions.length;i++){
    const c=captions[i];
    const text=String(c.text||'').trim();
    if(!text)continue;

    let query='';
    for(const [re,value] of concepts){
      if(re.test(text)){query=value;break;}
    }

    // Quality-first fallback: never turn untranslated transcript fragments into
    // stock-image searches. If we cannot map the sentence to a concrete visual,
    // staying on the speaker is better than inserting irrelevant B-roll.
    if(!query)continue;

    const startMs=Math.max(900,Number(c.startMs)||0);
    const baseDuration=Math.max(
      cfg.broll.minDurationMs,
      Math.min(
        cfg.broll.maxDurationMs,
        Math.max(1500,(Number(c.endMs)||startMs+1800)-startMs+800)
      )
    );
    const endMs=Math.min(
      Number(captions.at(-1)?.endMs||startMs+baseDuration),
      startMs+baseDuration
    );

    candidates.push({
      start_sec:startMs/1000,
      end_sec:endMs/1000,
      query_en:query,
      visual_anchor:query,
      specificity:0.78,
      reason:'local transcript fallback'
    });

    if(candidates.length>=maxCues*3)break;
  }

  // Spread cues through the edit instead of clustering them.
  const picked=[];
  let last=-Infinity;
  for(const cue of candidates){
    const start=Number(cue.start_sec||0)*1000;
    if(start-last<cfg.broll.minGapMs)continue;
    picked.push(cue);
    last=start;
    if(picked.length>=maxCues)break;
  }
  return picked;
}

async function generateJson({
  prompt,
  geminiKey,
  models
}){
  const unique=[...new Set(
    (models||[]).filter(Boolean)
  )];
  let lastError=null;

  for(const model of unique){
    for(let attempt=0;attempt<2;attempt++){
      try{
        const r=await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
          {
            method:'POST',
            signal:AbortSignal.timeout(15000),
            headers:{
              'x-goog-api-key':geminiKey,
              'content-type':'application/json'
            },
            body:JSON.stringify({
              contents:[
                {
                  role:'user',
                  parts:[{text:prompt}]
                }
              ],
              generationConfig:{
                responseMimeType:
                  'application/json',
                temperature:.15
              }
            })
          }
        );

        if(!r.ok){
          const body=(await r.text())
            .slice(0,700);
          const err=new Error(
            `Gemini B-roll ${r.status}: ${body}`
          );
          err.status=r.status;
          throw err;
        }

        const body=await r.json();
        const text=(body.candidates||[])
          .flatMap(
            x=>x.content?.parts||[]
          )
          .map(x=>x.text||'')
          .join('')
          .trim()
          .replace(
            /^\`\`\`(?:json)?\s*/i,
            ''
          )
          .replace(/\`\`\`$/,'')
          .trim();

        return JSON.parse(text);
      }catch(error){
        lastError=error;
        const status=Number(
          error?.status||0
        );
        const transient=[
          429,500,502,503,504
        ].includes(status);

        if(
          transient&&
          attempt===0
        ){
          await sleep(900);
          continue;
        }
        break;
      }
    }
  }

  throw lastError||new Error(
    'B-roll planning unavailable'
  );
}

async function findOpenverseAsset(
  query,
  used
){
  const variants=buildSearchVariants(query,[]);

  for(const variant of variants){
    const params=new URLSearchParams({
      q:variant,
      license:'pdm,cc0,by',
      page_size:'32',
      mature:'false',
      categories:'photograph'
    });

    let response;
    try{
      response=await fetch(
        'https://api.openverse.org/v1/images/?'+params.toString(),
        {
          signal:AbortSignal.timeout(8000),
          headers:{
            'User-Agent':'ViralStudio-EditPlus/1.0',
            'Accept':'application/json'
          }
        }
      );
    }catch{
      continue;
    }

    if(!response.ok){
      console.warn(JSON.stringify({
        event:'openverse_search_failed',
        status:response.status,
        query:variant,
        body:(await response.text()).slice(0,240)
      }));
      continue;
    }
    const body=await response.json();
    const results=Array.isArray(body?.results)?body.results:[];

    console.log(JSON.stringify({
      event:'openverse_search_results',
      query:variant,
      count:results.length,
      sample:results.slice(0,3).map(item=>({
        id:item?.id||null,
        title:String(item?.title||'').slice(0,100),
        license:item?.license||null,
        category:item?.category||null,
        source:item?.source||item?.provider||null,
        width:item?.width||null,
        height:item?.height||null
      }))
    }));

    for(const item of results){
      const id=String(item?.id||'');
      if(!/^[0-9a-f-]{36}$/i.test(id))continue;

      const width=Number(item?.width||0);
      const height=Number(item?.height||0);
      if(
        width&&height&&(
          Math.max(width,height)<1000||
          Math.min(width,height)<500||
          Math.max(width/height,height/width)>3.2
        )
      )continue;

      const license=String(item?.license||'').toLowerCase();
      if(!['pdm','cc0','by'].includes(license))continue;

      const assetUrl=
        `https://api.openverse.org/v1/images/${id}/thumb/?compressed=true`;

      if(used.has(assetUrl))continue;

      const title=String(item?.title||'').trim();
      const tags=Array.isArray(item?.tags)
        ?item.tags.slice(0,12).map(x=>String(x?.name||x||'')).join(' ')
        :'';

      const searchable=[title,tags].filter(Boolean).join(' ');
      const relevance=lexicalRelevance(
        variant,
        searchable
      );
      const originalRelevance=lexicalRelevance(
        query,
        searchable
      );

      const badVisual=/\b(map|historical|archive|archival|cartoon|illustration|diagram|projection|blueprint|manuscript|painting|poster|engraving|etching|satellite|aerial map)\b/i;
      const queryAllowsBad=/\b(map|historical|cartoon|illustration|diagram|blueprint|painting|poster)\b/i.test(variant);
      if(badVisual.test(searchable)&&!queryAllowsBad)continue;
      const minRelevance=
        variant===query
          ?0.28
          :variant.split(/\s+/).length<=2
            ?0.18
            :0.22;
      if(relevance<minRelevance)continue;

      return {
        assetUrl,
        sourcePage:item?.foreign_landing_url||item?.detail_url||null,
        mimeType:'image/jpeg',
        width:width||1800,
        height:height||1200,
        license:
          license==='pdm'
            ?'Public Domain'
            :license==='cc0'
              ?'CC0'
              :`CC BY ${item?.license_version||''}`.trim(),
        licenseUrl:item?.license_url||null,
        artist:String(item?.creator||'').slice(0,180),
        attribution:String(item?.attribution||'').slice(0,600),
        title:title.slice(0,220),
        provider:'openverse',
        source:String(item?.source||item?.provider||'').slice(0,80),
        searchQuery:variant,
        relevance,
        originalRelevance
      };
    }
  }

  return null;
}

function lexicalHitStats(query,text){
  const stop=new Set([
    'the','and','with','from','into','photo','photograph',
    'business','modern','professional'
  ]);
  const terms=[...new Set(
    String(query||'')
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g,' ')
      .split(/\s+/)
      .filter(x=>x.length>2&&!stop.has(x))
  )];
  const hay=String(text||'').toLowerCase();
  const hits=terms.filter(term=>hay.includes(term)).length;
  return {termCount:terms.length,hits};
}

function lexicalRelevance(query,text){
  const stop=new Set([
    'the','and','with','from','into','photo','photograph',
    'business','modern','professional'
  ]);
  const terms=String(query||'')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g,' ')
    .split(/\s+/)
    .filter(x=>x.length>2&&!stop.has(x));
  if(!terms.length)return .5;

  const hay=String(text||'').toLowerCase();
  const hits=terms.filter(term=>hay.includes(term)).length;
  return hits/terms.length;
}

async function findCommonsAsset(
  query,
  used
){
  const variants=buildSearchVariants(query,[query+' photograph']);

  for(const variant of variants){
    const params=new URLSearchParams({
      action:'query',
      generator:'search',
      gsrsearch:`${variant} filetype:bitmap`,
      gsrnamespace:'6',
      gsrlimit:'24',
      prop:'imageinfo',
      iiprop:'url|mime|size|extmetadata',
      iiurlwidth:'1800',
      format:'json',
      origin:'*'
    });

    const r=await fetch(
      'https://commons.wikimedia.org/w/api.php?'+params.toString(),
      {
        signal:AbortSignal.timeout(8000),
        headers:{'User-Agent':'ViralStudio-EditPlus/1.0'}
      }
    );
    if(!r.ok)continue;

    const body=await r.json();
    const pages=Object.values(body?.query?.pages||{});

    for(const page of pages){
      const info=page?.imageinfo?.[0];
      if(!info)continue;

      const mime=String(info.mime||'');
      if(!['image/jpeg','image/png','image/webp'].includes(mime))continue;

      const width=Number(info.thumbwidth||info.width||0);
      const height=Number(info.thumbheight||info.height||0);
      if(width<500||height<350)continue;

      const meta=info.extmetadata||{};
      const license=plain(
        meta.LicenseShortName?.value||
        meta.UsageTerms?.value||
        ''
      );

      const safeCommercial=
        /cc0|public domain|pd-/i.test(license)||
        /^cc by(?:\s|$|\d)/i.test(license);

      const shareAlike=/by-sa/i.test(license);
      const nonCommercial=/\bnc\b|noncommercial/i.test(license);

      if(!safeCommercial||shareAlike||nonCommercial)continue;

      const title=plain(page?.title||'');
      const description=plain(
        meta.ImageDescription?.value||
        meta.ObjectName?.value||
        ''
      );
      const searchable=[title,description].filter(Boolean).join(' ');
      const relevance=lexicalRelevance(variant,searchable);
      const hitStats=lexicalHitStats(variant,searchable);
      const originalRelevance=lexicalRelevance(query,searchable);
      const minRelevance=
        variant===query
          ?0.2
          :variant.split(/\s+/).length<=2
            ?0.12
            :0.16;
      if(relevance<minRelevance)continue;
      if(hitStats.termCount>=3&&hitStats.hits<2)continue;
      if(hitStats.termCount===2&&hitStats.hits<1)continue;
      if(originalRelevance<0.16)continue;

      const badVisual=/\b(map|coat of arms|flag|logo|diagram|scan|manuscript|painting|engraving|cartoon|poster|stamp)\b/i;
      const queryAllowsBad=/\b(map|logo|diagram|painting|cartoon|poster|flag)\b/i.test(variant);
      if(badVisual.test(searchable)&&!queryAllowsBad)continue;

      const assetUrl=info.thumburl||info.url;
      if(!assetUrl||used.has(assetUrl))continue;

      let host='';
      try{host=new URL(assetUrl).hostname}catch{continue}
      if(host!=='upload.wikimedia.org')continue;

      return {
        assetUrl,
        sourcePage:info.descriptionurl||null,
        mimeType:mime,
        width,
        height,
        license,
        artist:plain(
          meta.Artist?.value||
          meta.Credit?.value||
          ''
        ).slice(0,180),
        title:title.slice(0,220),
        provider:'wikimedia_commons',
        searchQuery:variant,
        relevance,
        originalRelevance
      };
    }
  }

  return null;
}

async function validateBrollAsset({
  cue,
  searchQuery,
  asset,
  geminiKey,
  models
}){
  if(!geminiKey)return false;

  let imageBytes=null;
  try{
    const r=await fetch(asset.assetUrl,{
      signal:AbortSignal.timeout(8000),
      headers:{
        'User-Agent':'ViralStudio-EditPlus/1.0'
      }
    });
    if(!r.ok){
      console.warn(JSON.stringify({
        event:'broll_validation_image_fetch_failed',
        status:r.status,
        provider:asset.provider,
        assetUrl:asset.assetUrl
      }));
      return false;
    }

    const length=Number(r.headers.get('content-length')||0);
    if(length>5*1024*1024)return false;

    const bytes=Buffer.from(await r.arrayBuffer());
    if(bytes.length<1000||bytes.length>5*1024*1024)return false;
    imageBytes=bytes.toString('base64');
  }catch(error){
    console.warn(JSON.stringify({
      event:'broll_validation_image_fetch_error',
      provider:asset.provider,
      error:String(error?.message||error).slice(0,240)
    }));
    return false;
  }

  const prompt=`Tu es le contrôleur qualité B-roll de Edit+.

Juge UNIQUEMENT ce qui est réellement visible dans les pixels de CETTE IMAGE.
N'utilise PAS le titre, la légende, la page source, le contexte historique ou une histoire associée à l'image pour créer un lien.

Recherche principale: ${cue.query}
Recherche utilisée: ${searchQuery}
Raison éditoriale: ${cue.reason||''}

RÈGLES STRICTES:
- APPROUVE seulement si le sujet principal ET l'action/objet demandés sont immédiatement visibles sans explication.
- Si la requête demande une PERSONNE, une personne humaine pertinente doit être clairement visible.
- Si la requête demande une ACTION (ex: travailler sur laptop, signer, toucher son coeur), cette action doit être réellement visible.
- Un animal, un paysage, un objet ou une archive ne peut jamais remplacer une personne/action demandée.
- REJETTE les correspondances basées sur l'ambiance, l'émotion supposée, le contexte de la page ou un seul mot générique.
- REJETTE documents historiques, archives, cartes, schémas, vieilles coupures, peintures, affiches ou photos anciennes sauf demande explicite.
- REJETTE toute image qui demanderait une explication pour comprendre le lien.
- Pour un Reel business moderne, privilégie une lecture instantanée et contemporaine.
- Ne juge PAS la licence ici; elle a déjà été filtrée.
- Décompose séparément le sujet, l’action et l’objet requis. Chacun doit être visible.
- Exemple: des mains formant un cœur sur un ventre ne correspondent PAS à une personne touchant sa poitrine. Une poignée de main ne prouve PAS une vente conclue.
- Retourne uniquement JSON: {"match":true,"subject_match":true,"action_match":true,"object_match":true,"confidence":0.0,"visible_match":"","reason":""}`;

  for(const activeModel of [...new Set((models||[]).filter(Boolean))]){
    try{
      const r=await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(activeModel)}:generateContent`,
        {
          method:'POST',
          signal:AbortSignal.timeout(15000),
          headers:{
            'x-goog-api-key':geminiKey,
            'content-type':'application/json'
          },
          body:JSON.stringify({
            contents:[{
              role:'user',
              parts:[
                {inline_data:{
                  mime_type:asset.mimeType||'image/jpeg',
                  data:imageBytes
                }},
                {text:prompt}
              ]
            }],
            generationConfig:{
              responseMimeType:'application/json',
              temperature:0
            }
          })
        }
      );

      if(!r.ok)continue;
      const body=await r.json();
      const raw=(body.candidates||[])
        .flatMap(x=>x.content?.parts||[])
        .map(x=>x.text||'')
        .join('')
        .trim()
        .replace(/^\`\`\`(?:json)?\s*/i,'')
        .replace(/\`\`\`$/,'')
        .trim();

      const parsed=JSON.parse(raw);
      const ok=
        parsed?.match===true&&
        parsed.subject_match===true&&parsed.action_match===true&&parsed.object_match===true&&
        Number(parsed?.confidence||0)>=0.92;

      console.log(JSON.stringify({
        event:'broll_asset_validated',
        query:cue.query,
        search_query:searchQuery,
        provider:asset.provider,
        approved:ok,
        confidence:Number(parsed?.confidence||0),
        reason:String(parsed?.reason||'').slice(0,240),
        sourcePage:asset.sourcePage||null
      }));

      return ok;
    }catch{}
  }

  return false;
}

function captionTranscript(
  captions,
  maxChars
){
  const lines=[];
  for(const c of captions){
    lines.push(
      `[${(Number(c.startMs||0)/1000).toFixed(1)}s] ${String(c.text||'').trim()}`
    );
  }
  return lines
    .join('\n')
    .slice(0,maxChars);
}

function plain(value){
  return String(value||'')
    .replace(/<[^>]+>/g,' ')
    .replace(/&nbsp;/gi,' ')
    .replace(/&amp;/gi,'&')
    .replace(/\s+/g,' ')
    .trim();
}

function sleep(ms){
  return new Promise(
    resolve=>setTimeout(resolve,ms)
  );
}
