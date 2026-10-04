const GOOGLE_BASE = 'https://generativelanguage.googleapis.com';
const MAX_BYTES = 100 * 1024 * 1024;
const SCORE_FALLBACK = {retention:.24,shareability:.16,originality:.15,audience_relevance:.12,spoken_hook:.11,visual_hook:.08,clarity:.05,value_emotion:.04,title:.03,rhythm:.02,cta:0};

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const cors = corsHeaders(origin, env.ALLOWED_ORIGIN);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });

    const url = new URL(request.url);
    if (request.method === 'GET' && url.pathname === '/health') {
      return json({ok:true,service:'Viral+ API',auth_required:true,supabase_configured:Boolean(env.SUPABASE_URL&&env.SUPABASE_PUBLISHABLE_KEY),gemini_secret_configured:Boolean(env.GEMINI_API_KEY),model:env.MODEL||'gemini-3.8-flash',fallback_model:env.FALLBACK_MODEL||'gemini-3.5-flash-lite',score_version:'vp-score-1'},200,cors);
    }

    if (url.pathname !== '/analyze' || request.method !== 'POST') return json({ error: 'Not found' }, 404, cors);
    if (origin && env.ALLOWED_ORIGIN && origin !== env.ALLOWED_ORIGIN) return json({ error: 'Origin non autorisée.' }, 403, cors);
    if (!env.GEMINI_API_KEY) return json({ error: 'GEMINI_API_KEY non configurée.' }, 500, cors);
    if (!env.SUPABASE_URL || !env.SUPABASE_PUBLISHABLE_KEY) return json({ error: 'Backend utilisateur Viral+ non configuré.' }, 500, cors);

    const token = bearer(request.headers.get('Authorization'));
    if (!token) return json({ error: 'Connecte-toi pour analyser une vidéo.', code: 'AUTH_REQUIRED' }, 401, cors);
    const auth = await getSupabaseUser(env, token);
    if (!auth.ok) return json({ error: 'Session expirée. Reconnecte-toi.', code: 'AUTH_REQUIRED' }, 401, cors);

    const isReanalysis = request.headers.get('X-Reanalysis') === '1';
    const baselineAnalysisId = safeUuid(request.headers.get('X-Baseline-Analysis-Id'));
    const entitlement = await rpc(env, token, 'viralplus_get_entitlement', {});
    const ent = Array.isArray(entitlement) ? entitlement[0] : entitlement;
    if (!ent) return json({ error: 'Impossible de vérifier ton offre Viral+.' }, 500, cors);
    if (isReanalysis && ent.plan !== 'creator') return json({ error: 'Le re-score avant/après est inclus dans Viral+ Creator.', code: 'CREATOR_REQUIRED', plan: ent.plan }, 402, cors);

    const credit = await rpc(env, token, 'viralplus_consume_credit', {});
    const c = Array.isArray(credit) ? credit[0] : credit;
    if (!c?.allowed) return json({ error: 'Tu as utilisé toutes tes analyses disponibles.', code: 'QUOTA_EXHAUSTED', entitlement: c || ent }, 402, cors);

    const mimeType = (request.headers.get('content-type') || '').split(';')[0].trim();
    const size = Number(request.headers.get('x-file-size') || request.headers.get('content-length') || '0');
    const displayName = safeName(decodeURIComponentSafe(request.headers.get('x-file-name') || 'video.mp4'));
    if (!mimeType.startsWith('video/')) return await refundAndReturn(env, token, { error: 'Viral+ accepte uniquement les fichiers vidéo.' }, 400, cors);
    if (!Number.isFinite(size) || size <= 0) return await refundAndReturn(env, token, { error: 'Taille de vidéo invalide.' }, 400, cors);
    if (size > MAX_BYTES) return await refundAndReturn(env, token, { error: `Vidéo trop lourde : ${(size/1048576).toFixed(1)} Mo. Maximum : 100 Mo.` }, 413, cors);

    let geminiFileName = null;
    try {
      const apiKey = String(env.GEMINI_API_KEY).trim().replace(/^['"]|['"]$/g, '');
      const rules = await loadRulebook(env.RULEBOOK_URL);
      const uploaded = await uploadToGemini(request.body, { apiKey, size, mimeType, displayName });
      geminiFileName = uploaded.name;
      const activeFile = await waitForFile(uploaded.name, apiKey);
      const analysis = await generateAnalysisWithFallback({apiKey,primaryModel:env.MODEL||'gemini-3.8-flash',fallbackModel:env.FALLBACK_MODEL||'gemini-3.5-flash-lite',fileUri:activeFile.uri,mimeType:activeFile.mimeType||activeFile.mime_type||mimeType,prompt:buildPrompt(rules)});

      analysis.rulebook_version = analysis.rulebook_version || rules.version || 'unknown';
      const finalScore = scoreFinal(analysis.scores || {}, rules.weights || SCORE_FALLBACK);
      const scoreVersion = `${analysis.rulebook_version}|vp-score-1`;
      const status = finalScore >= 78 ? 'ready' : finalScore >= 60 ? 'almost' : 'rework';
      const filtered = filterForPlan(analysis, ent.plan);
      filtered.final_score = finalScore;
      filtered.score_version = scoreVersion;
      filtered.status = status;
      filtered.plan = ent.plan;
      filtered.entitlement = {plan:ent.plan,used:c.used,limit:c.analysis_limit,remaining:c.remaining,period_start:c.period_start};

      const hotspot = firstHotspot(filtered.timeline || []);
      const row = {user_id:auth.user.id,video_name:displayName,final_score:finalScore,score_version:scoreVersion,model_used:analysis.model_used||null,rulebook_version:analysis.rulebook_version||null,is_reanalysis:isReanalysis,baseline_analysis_id:baselineAnalysisId||null,status,main_problem:filtered.main_problem||null,why:filtered.why||null,detected_spoken_hook:filtered.detected_spoken_hook||null,recommended_hook:filtered.recommended_hook||null,hotspot_time:hotspot.time||null,hotspot_reason:hotspot.reason||hotspot.label||null,scores:filtered.scores||{},action_items:filtered.action_items||[],result_json:filtered};
      const inserted = await supabaseInsert(env, token, 'viralplus_analyses', row);
      const saved = Array.isArray(inserted) ? inserted[0] : inserted;
      filtered.analysis_id = saved?.id || null;
      filtered.baseline_analysis_id = baselineAnalysisId || null;
      return json(filtered, 200, cors);
    } catch (err) {
      console.error('Viral+ analysis error', err);
      try { await rpc(env, token, 'viralplus_refund_credit', {}); } catch (refundErr) { console.warn('Refund credit failed', refundErr); }
      return json({ error: friendlyError(err) }, err?.status || 500, cors);
    } finally {
      if (geminiFileName) {
        try {const apiKey=String(env.GEMINI_API_KEY).trim().replace(/^['"]|['"]$/g,'');await deleteGeminiFile(geminiFileName,apiKey);} catch (e) { console.warn('Gemini cleanup failed', e); }
      }
    }
  }
};

function corsHeaders(origin,allowedOrigin){const allowed=origin&&allowedOrigin&&origin===allowedOrigin?origin:(allowedOrigin||'*');return {'Access-Control-Allow-Origin':allowed,'Access-Control-Allow-Methods':'GET,POST,OPTIONS','Access-Control-Allow-Headers':'Authorization,Content-Type,X-File-Name,X-File-Size,X-Reanalysis,X-Baseline-Analysis-Id','Access-Control-Max-Age':'86400','Vary':'Origin'}}
function json(data,status=200,extra={}){return new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',...extra}})}
function bearer(v=''){const m=String(v).match(/^Bearer\s+(.+)$/i);return m?.[1]||''}
function safeName(v){return String(v||'video.mp4').replace(/[\r\n]/g,'').slice(0,120)}
function safeUuid(v){return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(v||''))?String(v):null}
function decodeURIComponentSafe(v){try{return decodeURIComponent(v)}catch{return v}}
async function getSupabaseUser(env,token){const r=await fetch(`${env.SUPABASE_URL}/auth/v1/user`,{headers:{apikey:env.SUPABASE_PUBLISHABLE_KEY,Authorization:`Bearer ${token}`}});if(!r.ok)return{ok:false};return{ok:true,user:await r.json()}}
async function rpc(env,token,fn,body){const r=await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/${fn}`,{method:'POST',headers:{apikey:env.SUPABASE_PUBLISHABLE_KEY,Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify(body||{})});if(!r.ok){const t=await r.text();const e=new Error(`Supabase RPC ${fn}: ${t}`);e.status=r.status;throw e}return await r.json()}
async function supabaseInsert(env,token,table,row){const r=await fetch(`${env.SUPABASE_URL}/rest/v1/${table}`,{method:'POST',headers:{apikey:env.SUPABASE_PUBLISHABLE_KEY,Authorization:`Bearer ${token}`,'Content-Type':'application/json',Prefer:'return=representation'},body:JSON.stringify(row)});if(!r.ok){const t=await r.text();const e=new Error(`Supabase insert ${table}: ${t}`);e.status=r.status;throw e}return await r.json()}
async function refundAndReturn(env,token,payload,status,cors){try{await rpc(env,token,'viralplus_refund_credit',{})}catch{}return json(payload,status,cors)}
function scoreFinal(scores,weights){let total=0,sum=0;for(const[k,wRaw]of Object.entries(weights||SCORE_FALLBACK)){const w=Number(wRaw)||0;total+=w;sum+=(Number(scores?.[k])||0)*w}return Math.round(Math.max(0,Math.min(100,total?sum/total:0)))}
function firstHotspot(timeline){return timeline.find(x=>/red|orange|weak|bad/i.test(String(x?.status||'')))||timeline[0]||{}}
function filterForPlan(analysis,plan){const copy=JSON.parse(JSON.stringify(analysis||{}));if(plan==='creator'){copy.locked=[];return copy}copy.action_items=(copy.action_items||[]).slice(0,2);copy.alternative_hooks=[];delete copy.recommended_title;delete copy.recommended_cta;copy.locked=['full_corrections','alternative_hooks','recommended_title','recommended_cta','rescore','history_insights'];return copy}
async function loadRulebook(url){if(!url)return fallbackRules();try{const r=await fetch(url,{headers:{Accept:'application/json'},cf:{cacheTtl:300,cacheEverything:true}});if(!r.ok)throw new Error(`Rulebook ${r.status}`);return await r.json()}catch(e){console.warn('Rulebook fallback',e);return fallbackRules()}}
function fallbackRules(){return{version:'fallback',methodology:'Distinguer informations officielles Meta et heuristiques Viral+.',principles:[],weights:SCORE_FALLBACK}}
async function uploadToGemini(body,{apiKey,size,mimeType,displayName}){const start=await fetch(`${GOOGLE_BASE}/upload/v1beta/files`,{method:'POST',headers:{'x-goog-api-key':apiKey,'X-Goog-Upload-Protocol':'resumable','X-Goog-Upload-Command':'start','X-Goog-Upload-Header-Content-Length':String(size),'X-Goog-Upload-Header-Content-Type':mimeType,'Content-Type':'application/json'},body:JSON.stringify({file:{display_name:displayName}})});if(!start.ok)throw await googleError(start,'Impossible de préparer l’upload Gemini.');const uploadUrl=start.headers.get('x-goog-upload-url');if(!uploadUrl)throw new Error('Gemini n’a pas renvoyé d’URL d’upload.');const uploadedRes=await fetch(uploadUrl,{method:'POST',headers:{'Content-Type':mimeType,'X-Goog-Upload-Offset':'0','X-Goog-Upload-Command':'upload, finalize'},body});if(!uploadedRes.ok)throw await googleError(uploadedRes,'Échec de l’upload vidéo vers Gemini.');const uploaded=await uploadedRes.json();if(!uploaded?.file?.name||!uploaded?.file?.uri)throw new Error('Réponse d’upload Gemini incomplète.');return uploaded.file}
async function waitForFile(name,apiKey){for(let i=0;i<36;i++){const r=await fetch(`${GOOGLE_BASE}/v1beta/${name}`,{headers:{'x-goog-api-key':apiKey}});if(!r.ok)throw await googleError(r,'Impossible de vérifier la vidéo Gemini.');const f=await r.json();const s=String(f.state||'').toUpperCase();if(s==='ACTIVE')return f;if(s==='FAILED')throw new Error('Gemini n’a pas réussi à traiter cette vidéo.');await sleep(2500)}throw new Error('Le traitement vidéo a dépassé le délai prévu.')}
async function generateAnalysisWithFallback({apiKey,primaryModel,fallbackModel,fileUri,mimeType,prompt}){const models=[...new Set([primaryModel,fallbackModel].filter(Boolean))];let lastError;for(const model of models){for(let a=0;a<2;a++){try{const x=await generateAnalysis({apiKey,model,fileUri,mimeType,prompt});x.model_used=model;return x}catch(e){lastError=e;if(!isTransientModelError(e))throw e;if(a===0)await sleep(1500)}}}throw lastError||new Error('Tous les modèles sont temporairement indisponibles.')}
async function generateAnalysis({apiKey,model,fileUri,mimeType,prompt}){const r=await fetch(`${GOOGLE_BASE}/v1beta/models/${encodeURIComponent(model)}:generateContent`,{method:'POST',headers:{'x-goog-api-key':apiKey,'Content-Type':'application/json'},body:JSON.stringify({contents:[{role:'user',parts:[{file_data:{mime_type:mimeType,file_uri:fileUri}},{text:prompt}]}],generationConfig:{temperature:0,responseMimeType:'application/json'}})});if(!r.ok)throw await googleError(r,'Gemini n’a pas pu analyser la vidéo.');const p=await r.json();const text=(p?.candidates||[]).flatMap(c=>c?.content?.parts||[]).map(x=>x?.text||'').join('').trim();if(!text)throw new Error('Aucun diagnostic exploitable.');return parseJsonText(text)}
function isTransientModelError(e){const m=String(e?.message||e||'');return[429,500,502,503,504].includes(Number(e?.status))||/high demand|temporar|overload|unavailable|resource exhausted|try again later/i.test(m)}
function buildPrompt(rules){
  const principles=(rules?.principles||[]).map(p=>`- ${p.id||'signal'}: ${p.rule||''} | preuve: ${p.evidence||''}`).join('\\n');
  return `Tu es le moteur d’analyse vidéo de Viral+. Analyse UNIQUEMENT CETTE VIDÉO RÉELLE, pas une vidéo type, pas un profil de créateur générique et pas un scénario imaginaire. Tu n’as pas accès à l’algorithme privé de Meta : ne prétends jamais connaître ses poids secrets et ne promets jamais la viralité.

RÉFÉRENTIEL ${rules?.version||'unknown'}
${rules?.methodology||''}
${principles}

MÉTHODE OBLIGATOIRE
1. Regarde et écoute réellement le fichier du début à la fin. Identifie le sujet, la promesse, l’audience visée, le format, le ton et la structure.
2. Décris les éléments observables propres à CETTE vidéo : mots du hook, première information utile, rythme, silences, changements de plan/mouvement, texte à l’écran, présence visage/objet, répétitions, preuve, exemple, émotion, payoff et CTA.
3. Pour chaque score, pars des preuves observées dans cette vidéo. N’utilise jamais une valeur par défaut. Deux vidéos différentes doivent pouvoir recevoir des scores très différents.
4. Chaque score doit être justifiable par un élément concret de la vidéo. Si un élément n’est pas observable, écris INDETECTABLE et réduis la confiance au lieu d’inventer.
5. Sépare le potentiel de distribution/partage du CTA de conversion.
6. Le score final sera calculé séparément par Viral+ à partir de tes sous-scores : ne fabrique donc pas un score final arbitraire.

ÉCHELLE
0-20 très faible
21-40 faible
41-59 moyen
60-74 solide mais améliorable
75-89 fort
90-100 exceptionnel et clairement justifié

Ne donne jamais un conseil générique sans expliquer ce qui, dans CETTE vidéo, pose problème. Les corrections doivent citer un moment précis ou une caractéristique précise quand c’est possible.

Réponds UNIQUEMENT en JSON valide :
{"detected_spoken_hook":"...","detected_visual_hook":"...","detected_title_text":"...","detected_cta":"...","scores":{"retention":0,"shareability":0,"originality":0,"audience_relevance":0,"spoken_hook":0,"visual_hook":0,"clarity":0,"value_emotion":0,"title":0,"rhythm":0,"cta":0},"score_reasons":{"retention":"preuve observée dans cette vidéo","shareability":"preuve observée dans cette vidéo","originality":"preuve observée dans cette vidéo","audience_relevance":"preuve observée dans cette vidéo","spoken_hook":"preuve observée dans cette vidéo","visual_hook":"preuve observée dans cette vidéo","clarity":"preuve observée dans cette vidéo","value_emotion":"preuve observée dans cette vidéo","title":"preuve observée dans cette vidéo","rhythm":"preuve observée dans cette vidéo","cta":"preuve observée dans cette vidéo"},"verdict":"...","main_problem":"...","why":"...","meta_alignment":"...","recommended_hook":"...","alternative_hooks":["...","...","..."],"recommended_title":"...","recommended_cta":"...","timeline":[{"time":"0:00","status":"red","label":"Ouverture","reason":"preuve précise"}],"action_items":["correction précise #1","correction précise #2"],"confidence":{"audio":0,"visual":0,"text":0,"meta_evidence":0},"rulebook_version":"${rules?.version||'unknown'}"}`;
}
function parseJsonText(text){let c=text.trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/i,'');const s=c.indexOf('{'),e=c.lastIndexOf('}');if(s>=0&&e>s)c=c.slice(s,e+1);return JSON.parse(c)}
async function deleteGeminiFile(name,apiKey){await fetch(`${GOOGLE_BASE}/v1beta/${name}`,{method:'DELETE',headers:{'x-goog-api-key':apiKey}})}
async function googleError(response,fallback){let detail='';try{const b=await response.json();detail=b?.error?.message||b?.message||''}catch{}const e=new Error(detail?`${fallback} ${detail}`:fallback);e.status=response.status>=400&&response.status<600?response.status:500;return e}
function friendlyError(err){const m=String(err?.message||err||'Erreur inconnue');if(/high demand|temporar|overload|unavailable|try again later/i.test(m))return 'Les modèles Gemini sont momentanément saturés. Réessaie dans quelques minutes.';if(/quota|resource exhausted|429/i.test(m))return 'Quota Gemini temporairement atteint.';if(/leaked/i.test(m))return 'La clé Gemini est bloquée et doit être remplacée.';return m}
function sleep(ms){return new Promise(r=>setTimeout(r,ms))}
