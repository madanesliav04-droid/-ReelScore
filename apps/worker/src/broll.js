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
Maximum: ${maxCues} B-rolls.

RÈGLES:
- Ne mets pas de B-roll pendant tout le hook sauf si c'est indispensable.
- Préfère les noms concrets: lieux, objets, marques, métiers, technologies, personnes historiques, actions observables.
- Évite les concepts abstraits comme "succès", "motivation", "business" seuls.
- Chaque query_en doit être une recherche d'image courte et concrète en ANGLAIS.
- Une image doit illustrer exactement la phrase prononcée.
- Évite deux B-rolls trop proches.
- Retourne uniquement du JSON valide.

FORMAT:
{"cues":[{"start_sec":4.2,"end_sec":6.8,"query_en":"New York stock exchange trading floor","reason":"illustre la bourse citée"}]}

TRANSCRIPTION MONTÉE:
${transcript}`;

    const parsed=await generateJson({
      prompt,
      geminiKey,
      models:[model,fallbackModel]
    });

    const raw=Array.isArray(parsed?.cues)
      ?parsed.cues
      :[];
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

      cleaned.push({
        startMs,
        endMs,
        query,
        reason:String(cue.reason||'')
          .slice(0,240)
      });
      lastEnd=endMs;

      if(cleaned.length>=maxCues)break;
    }

    const resolved=[];
    const used=new Set();

    for(const cue of cleaned){
      const asset=await findCommonsAsset(
        cue.query,
        used
      );
      if(!asset)continue;
      used.add(asset.assetUrl);
      resolved.push({
        ...cue,
        ...asset
      });
    }

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

async function findCommonsAsset(
  query,
  used
){
  const params=new URLSearchParams({
    action:'query',
    generator:'search',
    gsrsearch:
      `${query} filetype:bitmap`,
    gsrnamespace:'6',
    gsrlimit:'12',
    prop:'imageinfo',
    iiprop:'url|mime|size|extmetadata',
    iiurlwidth:'1800',
    format:'json'
  });

  const r=await fetch(
    'https://commons.wikimedia.org/w/api.php?'+
    params.toString(),
    {
      headers:{
        'User-Agent':
          'ViralStudio-EditPlus/1.0'
      }
    }
  );

  if(!r.ok)return null;
  const body=await r.json();
  const pages=Object.values(
    body?.query?.pages||{}
  );

  for(const page of pages){
    const info=page?.imageinfo?.[0];
    if(!info)continue;

    const mime=String(
      info.mime||''
    );
    if(
      ![
        'image/jpeg',
        'image/png',
        'image/webp'
      ].includes(mime)
    )continue;

    const width=Number(
      info.thumbwidth||
      info.width||
      0
    );
    const height=Number(
      info.thumbheight||
      info.height||
      0
    );
    if(
      width<700||
      height<500
    )continue;

    const meta=info.extmetadata||{};
    const license=plain(
      meta.LicenseShortName?.value||
      meta.UsageTerms?.value||
      ''
    );

    if(
      !/cc0|public domain|pd-/i
        .test(license)
    )continue;

    const assetUrl=
      info.thumburl||
      info.url;
    if(
      !assetUrl||
      used.has(assetUrl)
    )continue;

    let host='';
    try{
      host=new URL(
        assetUrl
      ).hostname;
    }catch{
      continue;
    }
    if(
      host!=='upload.wikimedia.org'
    )continue;

    return {
      assetUrl,
      sourcePage:
        info.descriptionurl||
        null,
      mimeType:mime,
      width,
      height,
      license,
      artist:plain(
        meta.Artist?.value||
        meta.Credit?.value||
        ''
      ).slice(0,180),
      provider:'wikimedia_commons'
    };
  }

  return null;
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
