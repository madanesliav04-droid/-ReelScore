import {createHash,randomUUID} from 'node:crypto';
import {reviewEditorialFixes} from './legacy/viral-personalization.js';

export const ENGINE_VERSION='socialplus-strategy-v18.1';
export const SCORE_VERSION='socialplus-editorial-v18.1';
export const SCORE_WEIGHTS=Object.freeze({hook:15,scroll_stop:10,clarity:12,retention:10,structure:12,rhythm:8,text_captions:7,visual:6,audio:6,originality:7,cta:7});
const NOTICE='Diagnostic éditorial déterministe, sans prédiction de viralité. Les données des réseaux sociaux proviennent de vos saisies ou imports, sans connexion automatique.';
const clean=(value,max=3000)=>String(value??'').normalize('NFC').trim().slice(0,max);
const norm=value=>clean(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,'');
const stable=value=>value===null||typeof value!=='object'?JSON.stringify(value):Array.isArray(value)?'['+value.map(stable).join(',')+']':'{'+Object.keys(value).sort().filter(k=>value[k]!==undefined).map(k=>JSON.stringify(k)+':'+stable(value[k])).join(',')+'}';
export const inputHash=value=>createHash('sha256').update(stable(value)).digest('hex');
const fail=(code,message,status=400)=>Object.assign(new Error(message),{code,status});
const platforms=new Set(['instagram','tiktok','youtube','other']);
const numericFields=['reach','views','likes','comments','shares','saves','profile_visits','follows','follows_attributed','average_watch_seconds','video_duration_seconds','attributed_qualified_leads','tracked_visitors'];
const textFields=['external_post_id','topic','format','definition_version','proof_ref','observation_window','denominator_kind'];
const aliases={date:'publication_at',date_publication:'publication_at',publication:'publication_at',publie_le:'publication_at',collected_at:'collected_at',date_collecte:'collected_at',date_observation:'collected_at',plateforme:'platform',reseau:'platform',id:'external_post_id',post_id:'external_post_id',id_publication:'external_post_id',portee:'reach',comptes_touches:'reach',vues:'views',lectures:'views',jaime:'likes',j_aime:'likes',mentions_j_aime:'likes',commentaires:'comments',partages:'shares',enregistrements:'saves',sauvegardes:'saves',visites_profil:'profile_visits',abonnes:'follows',abonnes_attribues:'follows_attributed',duree:'video_duration_seconds',duree_secondes:'video_duration_seconds',duree_video:'video_duration_seconds',duree_moyenne:'average_watch_seconds',temps_moyen:'average_watch_seconds',sujet:'topic',format:'format',periode:'observation_window'};

export function parseNumber(value,field='value'){
 if(value===undefined||value===null||String(value).trim()==='')return null;
 if(typeof value==='boolean')throw fail('INVALID_NUMBER',`${field} : nombre attendu.`);
 let str=String(value).trim().replace(/[\u00a0\u202f ]/g,'');
 if(str.includes(',')&&str.includes('.'))throw fail('INVALID_NUMBER',`${field} : séparateurs ambigus.`);
 if(!/^\d+(?:[.,]\d+)?$/.test(str))throw fail('INVALID_NUMBER',`${field} : nombre positif ou zéro attendu.`);
 const n=Number(str.replace(',','.'));
 if(!Number.isFinite(n)||n<0||n>1e15)throw fail('INVALID_NUMBER',`${field} : valeur invalide.`);
 return n;
}
const date=(value,field,required=false)=>{
 if(value===undefined||value===null||String(value).trim()===''){if(required)throw fail('INVALID_DATE',`${field} est requis.`);return null;}
 const str=String(value).trim();
 if(!/^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(str))throw fail('INVALID_DATE',`${field} : utilisez une date ISO (AAAA-MM-JJ).`);
 const calendar=new Date(str.slice(0,10)+'T00:00:00.000Z');
 if(!Number.isFinite(calendar.getTime())||calendar.toISOString().slice(0,10)!==str.slice(0,10)||str.includes('T')&&!/(Z|[+-]\d{2}:\d{2})$/i.test(str))throw fail('INVALID_DATE',`${field} : date impossible ou fuseau absent.`);
 const parsed=new Date(str);
 if(!Number.isFinite(parsed.getTime())||parsed.getTime()>Date.now()+86400000||parsed.getUTCFullYear()<2000)throw fail('INVALID_DATE',`${field} : date impossible ou future.`);
 return parsed.toISOString();
};
export function normalizeMetric(raw,{source_kind='manual',platform}={}){
 if(!raw||typeof raw!=='object'||Array.isArray(raw))throw fail('INVALID_METRIC','Mesure invalide.');
 const result={platform:norm(raw.platform||platform),source_kind};
 if(!platforms.has(result.platform))throw fail('INVALID_PLATFORM','Plateforme attendue : instagram, tiktok, youtube ou other.');
 result.publication_at=date(raw.publication_at,'publication_at',true);
 result.collected_at=date(raw.collected_at,'collected_at',true);
 if(result.collected_at<result.publication_at)throw fail('INVALID_PERIOD','La collecte précède la publication.');
 for(const key of numericFields){
  result[key]=parseNumber(raw[key],key);
  if(result[key]!==null&&!['average_watch_seconds','video_duration_seconds'].includes(key)&&!Number.isSafeInteger(result[key]))throw fail('INVALID_COUNT',`${key} : un nombre entier de comptes ou d’actions est requis.`);
 }
 for(const key of textFields)result[key]=clean(raw[key],key==='proof_ref'?1000:300)||null;
 result.attribution_documented=raw.attribution_documented===true||raw.attribution_documented==='true';
 result.verified_flag=raw.verified_flag===true;
 if(!numericFields.some(key=>result[key]!==null))throw fail('EMPTY_METRIC','Renseignez au moins une mesure réelle.');
 if(result.video_duration_seconds===0)throw fail('INVALID_DURATION','La durée doit être supérieure à zéro.');
 return result;
}
export const metricIdentity=metric=>inputHash({platform:metric.platform,source_kind:metric.source_kind,content:metric.external_post_id||{publication_at:metric.publication_at,topic:metric.topic,format:metric.format},collected_at:metric.collected_at,observation_window:metric.observation_window});
export function calculateRates(metric){
 const ratio=(numerator,denominator)=>{
  if(numerator===null||numerator===undefined||!(denominator>0))return null;
  const value=numerator/denominator*100;
  return Number.isFinite(value)?Number(value.toFixed(2)):null;
 };
 const complete=['likes','comments','shares','saves'].every(k=>metric[k]!==null&&metric[k]!==undefined);
 const engagement=complete?['likes','comments','shares','saves'].reduce((sum,k)=>sum+metric[k],0):null;
 return {share_rate:ratio(metric.shares,metric.reach),save_rate:ratio(metric.saves,metric.reach),engagement_rate:ratio(engagement,metric.reach),watch_ratio:ratio(metric.average_watch_seconds,metric.video_duration_seconds),profile_action_rate:metric.attribution_documented?ratio(metric.follows_attributed,metric.profile_visits):null,profile_period_ratio:!metric.attribution_documented?ratio(metric.follows,metric.profile_visits):null,lead_conversion_rate:metric.attribution_documented?ratio(metric.attributed_qualified_leads,metric.tracked_visitors):null,labels:{share_rate:'Partages / portée',save_rate:'Enregistrements / portée',engagement_rate:'(J’aime + commentaires + partages + enregistrements) / portée',watch_ratio:'Durée moyenne / durée vidéo ; peut dépasser 100 % en cas de relecture',profile_action_rate:'Abonnements attribués / visites de profil (attribution documentée)',profile_period_ratio:'Ratio indicatif de période, sans attribution individuelle',lead_conversion_rate:'Prospects qualifiés attribués / visiteurs suivis'}};
}

export function parseCSV(csv){
 if(typeof csv!=='string'||csv.length>2_000_000)throw fail('CSV_SIZE','CSV attendu, maximum 2 Mo.');
 csv=csv.replace(/^\uFEFF/,'');
 if(csv.includes('\0'))throw fail('CSV_FORMAT','Le fichier contient des caractères binaires.');
 const first=csv.split(/\r?\n/)[0]||'';
 let quoted=false,semicolons=0,commas=0,tabs=0;
 for(let i=0;i<first.length;i++){const c=first[i];if(c==='"'){if(quoted&&first[i+1]==='"')i++;else quoted=!quoted;}else if(!quoted){if(c===';')semicolons++;if(c===',')commas++;if(c==='\t')tabs++;}}
 const delimiter=tabs>Math.max(semicolons,commas)?'\t':semicolons>=commas?';':',';
 const rows=[],row=[];let cell='',inQuote=false,closedQuote=false;
 const pushCell=()=>{row.push(cell);cell='';closedQuote=false;};
 const pushRow=()=>{pushCell();if(row.some(c=>c.trim()))rows.push([...row]);row.length=0;if(rows.length>5001)throw fail('CSV_ROWS','Maximum 5 000 lignes par import.');};
 for(let i=0;i<csv.length;i++){
  const c=csv[i];
  if(inQuote){if(c==='"'){if(csv[i+1]==='"'){cell+='"';i++;}else{inQuote=false;closedQuote=true;}}else cell+=c;continue;}
  if(c==='"'){if(cell.length||closedQuote)throw fail('CSV_FORMAT','Guillemet inattendu.');inQuote=true;continue;}
  if(c===delimiter){pushCell();continue;}
  if(c==='\r'||c==='\n'){if(c==='\r'&&csv[i+1]==='\n')i++;pushRow();continue;}
  if(closedQuote&&!/\s/.test(c))throw fail('CSV_FORMAT','Texte inattendu après un champ entre guillemets.');
  if(!closedQuote)cell+=c;
 }
 if(inQuote)throw fail('CSV_FORMAT','Champ entre guillemets non fermé.');
 if(cell.length||row.length)pushRow();
 if(rows.length<2)throw fail('CSV_EMPTY','Le CSV doit contenir un en-tête et une ligne.');
 const columns=rows.shift().map(c=>clean(c,150));
 if(columns.some(c=>!c)||new Set(columns.map(norm)).size!==columns.length)throw fail('CSV_COLUMNS','En-têtes vides ou dupliqués.');
 return {columns,rows,delimiter};
}
export function previewCSV({csv,platform,column_mapping={}}){
 const parsed=parseCSV(csv),errors=[],rows=[],identities=new Map(),conflicts=new Set();
 const validKeys=new Set(['platform','publication_at','collected_at','attribution_documented','verified_flag',...numericFields,...textFields]);
 const mapping=Object.fromEntries(parsed.columns.map(c=>{const n=norm(c);return[c,column_mapping[c]||aliases[n]||n];}));
 const mappedKeys=Object.values(mapping).filter(key=>validKeys.has(key));
 if(new Set(mappedKeys).size!==mappedKeys.length)throw fail('CSV_MAPPING','Deux colonnes ciblent la même mesure ; corrigez le mapping.');
 for(const key of Object.values(mapping))if(key&&!validKeys.has(key))continue;
 parsed.rows.forEach((cells,index)=>{
  const rowNumber=index+2;
  if(cells.length!==parsed.columns.length){errors.push({row:rowNumber,field:null,message:'Nombre de colonnes incohérent.'});return;}
  const raw={platform};
  parsed.columns.forEach((col,i)=>{const key=mapping[col];if(validKeys.has(key))raw[key]=cells[i];});
  try{
   const metric=normalizeMetric(raw,{platform,source_kind:'csv'}),identity=metricIdentity(metric),checksum=inputHash(metric);
   if(identities.has(identity)&&identities.get(identity)!==checksum){conflicts.add(identity);throw fail('CONFLICTING_METRIC','Deux mesures contradictoires du même contenu au même instant ; corrigez les sources avant import.');}
   identities.set(identity,checksum);rows.push({row:rowNumber,...metric});
  }catch(error){errors.push({row:rowNumber,field:error.code,message:error.message});}
 });
 const validRows=rows.filter(row=>!conflicts.has(metricIdentity(row)));
 return {columns:parsed.columns,column_mapping:mapping,rows:validRows,errors,valid_count:validRows.length,total_count:parsed.rows.length,delimiter:parsed.delimiter};
}

const method=(id,title,source_url,process_steps,exercise,success_metrics,pitfalls)=>({id,title,version:1,enabled:true,source_url,source_title:source_url.includes('acquisition')?'Acquisition.com — ressources Hormozi (adaptation pédagogique)':source_url.includes('tiktok')?'TikTok for Business — Creative Codes / Creative Center':source_url.includes('youtube')?'YouTube Help — Analytics':'Meta — Best Practices / méthode Social+',last_verified_at:null,source_verification:'Référence du cahier V18 ; lien externe non revérifié pendant cette recette',process_steps,exercise,success_metrics,pitfalls,notice:'Adaptation pédagogique : ni règle secrète de plateforme ni garantie de résultats.'});
export const METHODS=Object.freeze([
 method('M01','Audience idéale','https://www.acquisition.com/leads-gifts',['Décrivez un segment précis et son problème concret.','Interrogez des personnes de ce segment avec des questions ouvertes.','Comparez leurs mots à votre positionnement.'],'Écrivez trois problèmes exprimés par votre audience, avec la source et la date.',['Pertinence des retours qualitatifs','Correspondance avec votre objectif'],['Déduire toute une audience de quelques réactions']),
 method('M02','Promesse et bio','https://www.acquisition.com/training/offers',['Identifiez la cible, le bénéfice et une preuve vérifiable.','Faites lire votre bio à une personne du segment sans explication.','Notez ce qui est compris et ajustez un seul élément.'],'Rédigez vous-même une bio, puis relevez trois réponses au test de compréhension.',['Compréhension de la cible et du bénéfice','Actions / visites si disponibles'],['Inventer une preuve','Confondre ratio de période et conversion attribuée']),
 method('M03','Piliers éditoriaux','https://www.acquisition.com/leads-gifts',['Classez vos contenus réels par thème et objectif.','Définissez deux à quatre piliers cohérents.','Comparez les résultats uniquement à format et période comparables.'],'Classez vos derniers contenus et justifiez chaque pilier.',['Répartition des contenus','Résultats par pilier avec provenance'],['Imposer des piliers sans contenu observé']),
 method('M04','Hook : ouverture observable','https://ads.tiktok.com/business/en/creative-codes',['Revoyez les premières secondes avec le discours réel.','Décrivez la promesse et la raison de poursuivre.','Changez une variable et testez une variante fidèle au sujet.'],'Écrivez deux ouvertures personnelles sans inventer chiffre ni promesse.',['Attention initiale si mesurée','Compréhension de la promesse'],['Promettre la viralité','Pénaliser automatiquement un plan fixe']),
 method('M05','Structure et progression','https://ads.tiktok.com/business/en/creative-codes',['Repérez ouverture, développement et conclusion dans le transcript.','Vérifiez que chaque partie sert la promesse.','Testez la compréhension avec une personne de la cible.'],'Annotez votre propre vidéo avec trois passages et leur rôle.',['Compréhension','Résultats postpublication comparables'],['Recomposer le sens du discours à la place du créateur']),
 method('M06','Rétention mesurée','https://support.google.com/youtube/answer/9314415',['Importez une courbe de rétention autorisée et datée.','Localisez une chute observée et revoyez le passage.','Posez une hypothèse puis comparez une variante.'],'Annotez une chute réelle avec timecode, preuve et hypothèse alternative.',['Courbes comparables','Réplication sur plusieurs publications'],['Inventer une courbe à partir de cuts ou silences']),
 method('M07','Valeur de partage','https://about.fb.com/news/2024/10/best-practices-education-hub-creators-instagram/',['Comparez vos partages / portée sur des observations équivalentes.','Décrivez la valeur transmissible des contenus réellement partagés.','Testez une seule idée de transmission.'],'Choisissez un contenu existant et formulez pourquoi une personne précise le partagerait.',['Partages / portée','Qualité des retours'],['Comparer vues et portée','Inventer un taux officiel idéal']),
 method('M08','Concurrence et différenciation','https://ads.tiktok.com/business/creativecenter/',['Renseignez trois à cinq profils publics et la date d’observation.','Relevez preuves, angles et publics visés sans copier.','Choisissez une hypothèse de différenciation à tester.'],'Remplissez une comparaison qualitative avec sources accessibles.',['Retours de l’audience','Résultats du test de votre angle'],['Scraper des profils privés','Présenter un volume non vérifié comme réel']),
 method('M09','Plan lié à un objectif','https://www.acquisition.com/leads-gifts',['Reliez chaque pilier à un objectif mesurable.','Choisissez une cadence réaliste et une seule expérience.','Programmez une revue des résultats réels.'],'Préparez votre propre plan et indiquez comment chaque action sert le KPI.',['Exécution du plan','KPI lié à l’objectif'],['Produire un calendrier générique sans contexte']),
 method('M10','Ressource utile pour prospects','https://www.acquisition.com/leads-gifts',['Confirmez un problème précis de l’audience.','Construisez vous-même une ressource qui aide à le résoudre.','Testez le parcours avec attribution documentée.'],'Prototypez une ressource utile puis testez le parcours avec une personne de la cible.',['Prospects qualifiés attribués','Retours qualitatifs'],['Prescrire un lead magnet sans objectif prospects']),
 method('M11','Parcours d’acquisition','https://www.acquisition.com/leads-gifts',['Cartographiez publication, visite, clic et demande qualifiée.','Identifiez une friction observable.','Corrigez-la puis suivez des cohortes comparables.'],'Testez manuellement chaque étape et notez une friction avec preuve.',['Prospects qualifiés / visiteurs suivis si attribution fiable'],['Attribuer une vente à des vues sans preuve']),
 method('M12','Expérimentation et preuves','https://support.google.com/youtube/answer/9314415',['Formulez une hypothèse et une métrique avant le test.','Conservez la baseline, la période et les sources.','Changez une variable, mesurez et concluez avec les limites.'],'Collectez cinq contenus comparables avant une conclusion chiffrée.',['Qualité et comparabilité des observations','Réplication'],['Prendre corrélation pour causalité','Comparer des définitions de vues différentes'])
]);

export function priority({impact,gap,confidence,ease}){
 if([impact,gap,confidence,ease].some(n=>typeof n!=='number'||!Number.isFinite(n)||n<0||n>5))throw fail('PRIORITY_INVALID','Composantes de priorité invalides.');
 return Math.round(100*(.35*impact/5+.30*gap/5+.25*confidence/5+.10*ease/5));
}
export function compareMetrics(before,after){
 const reasons=[];
 for(const key of ['platform','format','observation_window','definition_version'])if(!before[key]||!after[key]||before[key]!==after[key])reasons.push(`${key} absent ou non comparable`);
 if(before.video_duration_seconds===null||after.video_duration_seconds===null||Math.abs(before.video_duration_seconds-after.video_duration_seconds)>Math.max(5,before.video_duration_seconds*.2))reasons.push('durées absentes ou trop différentes');
 if(before.platform==='youtube'&&(!before.definition_version||!after.definition_version))reasons.push('Vérifiez la définition des vues YouTube ; une rupture de définition empêche la comparaison.');
 const a=calculateRates(before),b=calculateRates(after);
 const deltas=Object.fromEntries(Object.keys(a).filter(k=>k!=='labels').map(k=>[k,!reasons.length&&a[k]!==null&&b[k]!==null?Math.round((b[k]-a[k])*100)/100:null]));
 return {comparable:reasons.length===0,reasons,deltas,conclusion:reasons.length?'not_evaluable':'unclear',caveat:'Écart descriptif, sans attribution causale. Même une hausse ne démontre pas que l’action en est la cause.'};
}

export const EXPERIMENT_METRICS=Object.freeze({share_rate:'Partages / portée',save_rate:'Enregistrements / portée',engagement_rate:'Engagement complet / portée',watch_ratio:'Durée moyenne / durée vidéo',profile_action_rate:'Abonnements attribués / visites de profil',lead_conversion_rate:'Prospects qualifiés attribués / visiteurs suivis'});
const EXPERIMENT_CAVEAT='Écart descriptif entre deux publications, sans attribution causale. Un seul test ne démontre pas l’efficacité de votre action ; vérifiez les différences de sujet, d’audience et de contexte avant de répliquer.';

export function buildMetricTrend(rows){
 const groups=new Map();
 for(const row of rows){
  if(!row.external_post_id||!row.format||!row.observation_window||!row.definition_version||!(row.video_duration_seconds>0)||calculateRates(row).share_rate===null)continue;
  const key=JSON.stringify([row.platform,row.format,row.observation_window,row.definition_version]);
  const group=groups.get(key)||new Map(),previous=group.get(row.external_post_id);
  if(!previous||row.collected_at>previous.collected_at)group.set(row.external_post_id,row);
  groups.set(key,group);
 }
 let selectedGroup=[],selectedStart=0,selectedEnd=0,bestCount=0;
 for(const group of groups.values()){
  const sorted=[...group.values()].sort((a,b)=>a.video_duration_seconds-b.video_duration_seconds||a.external_post_id.localeCompare(b.external_post_id));
  let left=0;
  for(let right=0;right<sorted.length;right++){
   while(sorted[right].video_duration_seconds-sorted[left].video_duration_seconds>Math.max(5,sorted[left].video_duration_seconds*.2))left++;
   if(right-left+1>bestCount){bestCount=right-left+1;selectedGroup=sorted;selectedStart=left;selectedEnd=right+1;}
  }
 }
 const selected=selectedGroup.slice(selectedStart,selectedEnd);
 if(selected.length<2)return {available:false,reason:'Au moins deux publications avec plateforme, format, durée, fenêtre et définition comparables sont nécessaires. Les partages et la portée doivent être mesurés.'};
 selected.sort((a,b)=>a.publication_at.localeCompare(b.publication_at)||a.external_post_id.localeCompare(b.external_post_id));
 const anchor=selected[0];
 return {available:true,platform:anchor.platform,format:anchor.format,observation_window:anchor.observation_window,definition_version:anchor.definition_version,total_points:selected.length,points:selected.slice(-200).map(row=>({id:row.id,external_post_id:row.external_post_id,publication_at:row.publication_at,collected_at:row.collected_at,source_kind:row.source_kind,value:calculateRates(row).share_rate})),unit:'%',metric:'Partages / portée',notice:'Évolution descriptive de publications comparables. Un seul instantané, le plus récent, est retenu par publication ; aucune attribution causale.'};
}

export function buildDiagnostic({profile={},metrics=[],competitors=[],methods=METHODS,method_state=[]}){
 const state=new Map(method_state.map(x=>[x.method_id,x]));
 const enabled=methods.map(m=>({...m,...state.get(m.id)})).filter(m=>m.enabled&&m.source_url?.startsWith('https://'));
 const byId=new Map(enabled.map(m=>[m.id,m]));
 const findings=[];
 const add=(rule_id,method_id,title,observation,components,confidence='qualitative',evidence=[])=>{
  const m=byId.get(method_id);if(!m)return;
  findings.push({rule_id,method_id,method_version:m.version,title,observation,evidence,hypothesis:'Hypothèse de travail à vérifier par vos observations et exercices.',why_method:`La méthode « ${m.title} » aide à clarifier ce point sans prétendre prédire la performance.`,step_by_step:m.process_steps,how_to_measure:m.success_metrics,source_url:m.source_url,confidence,limitations:[m.notice,'Les seuils et priorités sont des heuristiques internes versionnées.'],priority:priority(components)});
 };
 const goal=profile.goal_type||'awareness';
 const comparable=metrics.filter(x=>x.platform===(profile.platform||'instagram')&&x.format&&x.observation_window&&x.definition_version&&x.video_duration_seconds>0);
 const groups=new Map();
 for(const metric of comparable){const key=[metric.platform,metric.format,metric.observation_window,metric.definition_version,Math.round(metric.video_duration_seconds/10)].join('|');const values=groups.get(key)||[];values.push(metric);groups.set(key,values);}
 const cohort=[...groups.values()].sort((a,b)=>b.length-a.length||stable(a).localeCompare(stable(b)))[0]||[];
 const uniqueContent=new Set(cohort.map(x=>x.external_post_id||inputHash({publication_at:x.publication_at,topic:x.topic}))).size;
 if(uniqueContent<5)add('collect_comparable','M12','Collecter et vérifier vos mesures',`${uniqueContent} contenu(s) comparable(s) dans la cohorte la plus représentée. Les conclusions chiffrées restent insuffisantes.`,{impact:5,gap:5,confidence:5,ease:5},'measured',cohort.map(x=>({metric_id:x.id,source_kind:x.source_kind,collected_at:x.collected_at})));
 if(!clean(profile.target_audience))add('audience_missing','M01','Préciser votre audience','Votre profil ne décrit pas encore son audience cible.',{impact:goal==='leads'?5:4,gap:5,confidence:5,ease:4});
 if(!clean(profile.bio_text)||!clean(profile.niche))add('promise_unclear','M02','Clarifier votre promesse et votre bio','La bio ou la niche n’est pas renseignée. La clarté sémantique ne peut pas être évaluée automatiquement.',{impact:goal==='leads'?5:3,gap:4,confidence:5,ease:4});
 if(goal==='leads'&&clean(profile.target_audience)&&!clean(profile.offer))add('lead_journey_missing','M11','Documenter le parcours vers vos prospects','L’objectif prospects est déclaré, mais aucune offre/parcours n’est documenté.',{impact:5,gap:5,confidence:4,ease:3});
 if(competitors.length<3)add('competitors_incomplete','M08','Comparer des profils publics','Moins de trois profils publics documentés ; la différenciation reste une hypothèse qualitative.',{impact:goal==='awareness'?4:2,gap:3,confidence:4,ease:3});
 if(!clean(profile.goal_details))add('plan_missing','M09','Relier vos actions à votre objectif','Le résultat attendu et sa mesure ne sont pas précisés.',{impact:goal==='community'?5:3,gap:4,confidence:5,ease:4});
 if(uniqueContent>=5){
  const measured=cohort.filter(x=>x.shares!==null&&x.reach>0);
  if(measured.length>=5){
   const sorted=[...measured].sort((a,b)=>a.publication_at.localeCompare(b.publication_at));
   const mid=Math.floor(sorted.length/2),first=sorted.slice(0,mid),last=sorted.slice(mid);
   const rate=rows=>rows.reduce((sum,x)=>sum+x.shares,0)/rows.reduce((sum,x)=>sum+x.reach,0)*100;
   if(rate(last)<rate(first))add('share_rate_lower','M07','Étudier votre valeur de partage',`Le taux de partage descriptif est inférieur sur la seconde moitié de la cohorte (${rate(last).toFixed(2)} % contre ${rate(first).toFixed(2)} %).`,{impact:goal==='awareness'?5:3,gap:3,confidence:3,ease:3},'measured',sorted.map(x=>({metric_id:x.id,source_kind:x.source_kind,collected_at:x.collected_at})));
  }
 }
 findings.sort((a,b)=>b.priority-a.priority||a.rule_id.localeCompare(b.rule_id));
 const snapshot={profile,metrics:[...metrics].sort((a,b)=>stable(a).localeCompare(stable(b))),competitors:[...competitors].sort((a,b)=>stable(a).localeCompare(stable(b))),methods:enabled.map(m=>({id:m.id,version:m.version,source_url:m.source_url})),engine_version:ENGINE_VERSION};
 const hash=inputHash(snapshot);
 const missions=findings.slice(0,3).map(f=>{const m=byId.get(f.method_id);return{id:inputHash({input:hash,rule_id:f.rule_id}).slice(0,32),title:f.title,method_id:f.method_id,method_version:f.method_version,status:'active',steps:m.process_steps.map(description=>({description,completed:false})),exercise:m.exercise,source_url:m.source_url,finding:f};});
 return {input_hash:hash,engine_version:ENGINE_VERSION,findings,missions,notice:NOTICE,goal_type:goal};
}

export function analyzeVideo(raw){
 if(!/^[a-f0-9]{64}$/i.test(raw?.fingerprint||''))throw fail('FINGERPRINT_REQUIRED','Empreinte SHA-256 du fichier requise.');
 const metadata={duration_seconds:parseNumber(raw.metadata?.duration_seconds,'duration_seconds'),width:parseNumber(raw.metadata?.width,'width'),height:parseNumber(raw.metadata?.height,'height'),has_audio:typeof raw.metadata?.has_audio==='boolean'?raw.metadata.has_audio:null};
 if(!(metadata.duration_seconds>0&&metadata.width>0&&metadata.height>0))throw fail('VIDEO_METADATA','Durée et dimensions vidéo valides requises.');
 const context={goal_type:['awareness','leads','community'].includes(raw.context?.goal_type)?raw.context.goal_type:'awareness',platform:platforms.has(raw.context?.platform)?raw.context.platform:'instagram',notes:clean(raw.context?.notes,1500)};
 const transcript={text:clean(raw.transcript?.text,50000),words:Array.isArray(raw.transcript?.words)?raw.transcript.words.slice(0,10000):[]};
 const semantic=new Set(['hook','scroll_stop','clarity','retention','structure','originality','cta']);
 const criteria={},excluded_criteria=[];
 for(const [key,weight] of Object.entries(SCORE_WEIGHTS)){
  const supplied=raw.criteria?.[key];
  let reason=null;
  if(!supplied)reason='Observation éditoriale vérifiée non fournie.';
  else if(!['manual','measured'].includes(supplied.source_kind))reason='Provenance de l’observation non reconnue.';
  else if(semantic.has(key)&&!transcript.text)reason='Transcription fiable non fournie : critère sémantique non évaluable.';
  else if(key==='audio'&&metadata.has_audio!==true)reason='Piste audio absente ou non vérifiée.';
  else if(typeof supplied.score!=='number'||!Number.isFinite(supplied.score)||supplied.score<0||supplied.score>100)throw fail('CRITERION_SCORE',`Note invalide : ${key}.`);
  else if(clean(supplied.evidence,2000).length<20)reason='Preuve insuffisante ; décrivez précisément l’observation.';
  else if(typeof supplied.start_sec!=='number'||typeof supplied.end_sec!=='number'||!Number.isFinite(supplied.start_sec)||!Number.isFinite(supplied.end_sec)||supplied.start_sec<0||supplied.end_sec<supplied.start_sec||supplied.end_sec>metadata.duration_seconds)reason='Timecodes absents ou hors vidéo.';
  if(reason){excluded_criteria.push({key,weight,reason});continue;}
  criteria[key]={score:supplied.score,weight,evidence:clean(supplied.evidence,2000),source_kind:supplied.source_kind,start_sec:supplied.start_sec,end_sec:supplied.end_sec,verification:'Observation fournie par l’utilisateur ; aucune contre-expertise automatique annoncée.'};
 }
 const coverage=Object.values(criteria).reduce((sum,c)=>sum+c.weight,0);
 const score=coverage>=60?Math.round(Object.values(criteria).reduce((sum,c)=>sum+c.weight*c.score,0)/coverage):null;
 const fixes=reviewEditorialFixes(raw.findings||[],transcript,metadata.duration_seconds);
 const snapshot={fingerprint:raw.fingerprint.toLowerCase(),metadata,context,criteria,excluded_criteria,transcript,findings:fixes.fixes,engine_version:SCORE_VERSION};
 return {...snapshot,input_hash:inputHash(snapshot),score,coverage,coverage_label:`${coverage}/100 points de critères observables`,minimum_coverage:60,findings:fixes.fixes,rejected_findings:fixes.rejected,notice:'Score de préparation éditoriale fondé sur vos observations documentées, sans prédiction de vues ni de viralité. Les métadonnées seules ne démontrent pas la qualité narrative.',native_ratio:metadata.width/metadata.height};
}

async function body(req){
 if(req.body&&typeof req.body==='object')return req.body;
 let value='',bytes=0;
 for await(const chunk of req){bytes+=chunk.length;if(bytes>2_100_000)throw fail('BODY_TOO_LARGE','Requête trop volumineuse.',413);value+=chunk;}
 try{return value?JSON.parse(value):{};}catch{throw fail('INVALID_JSON','JSON invalide.');}
}
const send=(res,status,data)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data));};

export function createStrategy({db,clock=Date.now}){
 db.exec(`CREATE TABLE IF NOT EXISTS strategy_records(id TEXT PRIMARY KEY,user_id TEXT NOT NULL,kind TEXT NOT NULL,data TEXT NOT NULL,checksum TEXT,created_at TEXT NOT NULL,updated_at TEXT NOT NULL,UNIQUE(user_id,kind,checksum));CREATE INDEX IF NOT EXISTS strategy_records_user_kind ON strategy_records(user_id,kind,created_at);CREATE TABLE IF NOT EXISTS strategy_method_state(method_id TEXT PRIMARY KEY,version INTEGER NOT NULL DEFAULT 1,enabled INTEGER NOT NULL DEFAULT 1,data TEXT NOT NULL DEFAULT '{}');`);
 db.exec(`CREATE TABLE IF NOT EXISTS strategy_method_versions(method_id TEXT NOT NULL,version INTEGER NOT NULL,data TEXT NOT NULL,created_by TEXT NOT NULL,created_at TEXT NOT NULL,PRIMARY KEY(method_id,version));CREATE TABLE IF NOT EXISTS strategy_admin_audit(id TEXT PRIMARY KEY,actor_id TEXT NOT NULL,action TEXT NOT NULL,method_id TEXT NOT NULL,version INTEGER NOT NULL,created_at TEXT NOT NULL);`);
 for(const m of METHODS)db.prepare('INSERT OR IGNORE INTO strategy_method_versions(method_id,version,data,created_by,created_at) VALUES(?,?,?,?,?)').run(m.id,1,JSON.stringify(m),'system','2026-10-22T00:00:00.000Z');
 const list=(uid,kind)=>db.prepare('SELECT * FROM strategy_records WHERE user_id=? AND kind=? ORDER BY created_at DESC,id LIMIT 5000').all(uid,kind).map(row=>({...JSON.parse(row.data),id:row.id,created_at:row.created_at,updated_at:row.updated_at}));
 const get=(uid,kind,id)=>{const row=db.prepare('SELECT * FROM strategy_records WHERE user_id=? AND kind=? AND id=?').get(uid,kind,id);return row?{...JSON.parse(row.data),id:row.id,created_at:row.created_at,updated_at:row.updated_at}:null;};
 const put=(uid,kind,data,{id=randomUUID(),checksum=null}={})=>{
  const now=new Date().toISOString();
  db.prepare('INSERT INTO strategy_records(id,user_id,kind,data,checksum,created_at,updated_at) VALUES(?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data,updated_at=excluded.updated_at WHERE strategy_records.user_id=excluded.user_id AND strategy_records.kind=excluded.kind').run(id,uid,kind,JSON.stringify(data),checksum,now,now);
  return get(uid,kind,id);
 };
 const methods=()=>METHODS.map(m=>{const state=db.prepare('SELECT * FROM strategy_method_state WHERE method_id=?').get(m.id);return state?{...m,...JSON.parse(state.data),id:m.id,version:state.version,enabled:!!state.enabled}:m;});
 const metrics=uid=>list(uid,'metric').map(m=>({...m,rates:calculateRates(m)}));
 async function handle(req,res,url,user){
  const path=url.pathname;
  if(!path.startsWith('/api/strategy/'))return false;
  if(!user?.id){send(res,401,{code:'AUTH_REQUIRED',message:'Connexion requise.',retryable:false});return true;}
  try{
   const uid=user.id;
   if(path==='/api/strategy/profile'&&req.method==='GET'){send(res,200,{profile:list(uid,'profile')[0]||{platform:'instagram',goal_type:'awareness'}});return true;}
   if(path==='/api/strategy/profile'&&['PUT','POST'].includes(req.method)){
    const raw=await body(req),profile={};
    for(const key of ['handle','target_audience','niche','offer','bio_text','goal_details'])profile[key]=clean(raw[key],key==='bio_text'?3000:1000);
    profile.platform=platforms.has(raw.platform)?raw.platform:'instagram';
    profile.goal_type=['awareness','leads','community'].includes(raw.goal_type)?raw.goal_type:'awareness';
    send(res,200,{profile:put(uid,'profile',profile,{id:inputHash({uid,kind:'profile'})})});return true;
   }
   if(path==='/api/strategy/methods'&&req.method==='GET'){send(res,200,{methods:methods().filter(m=>m.enabled)});return true;}
   if(path==='/api/strategy/metrics'&&req.method==='GET'){send(res,200,{metrics:metrics(uid),trend:buildMetricTrend(metrics(uid)),notice:NOTICE});return true;}
   if(path==='/api/strategy/metrics'&&req.method==='POST'){
    const metric=normalizeMetric(await body(req));const checksum=inputHash(metric);
    if(list(uid,'metric').some(saved=>metricIdentity(saved)===metricIdentity(metric)&&inputHash(normalizeMetric(saved,{source_kind:saved.source_kind}))!==checksum))throw fail('CONFLICTING_METRIC','Une mesure différente existe pour ce contenu au même instant. Vérifiez la source avant de corriger.',409);
    const existing=db.prepare("SELECT id FROM strategy_records WHERE user_id=? AND kind='metric' AND checksum=?").get(uid,checksum);
    send(res,existing?200:201,{metric:existing?get(uid,'metric',existing.id):put(uid,'metric',metric,{checksum}),duplicate:!!existing});return true;
   }
   if(path==='/api/strategy/imports/preview'&&req.method==='POST'){
    const raw=await body(req),preview=previewCSV(raw),existing=new Map(list(uid,'metric').map(m=>[metricIdentity(m),inputHash(normalizeMetric(m,{source_kind:m.source_kind}))]));
    preview.rows=preview.rows.filter(row=>{const {row:line,...metric}=row,identity=metricIdentity(metric);if(existing.has(identity)&&existing.get(identity)!==inputHash(metric)){preview.errors.push({row:line,field:'CONFLICTING_METRIC',message:'Une mesure contradictoire existe déjà pour ce contenu au même instant.'});return false;}return true;});
    preview.valid_count=preview.rows.length;
    const saved=put(uid,'import_preview',{...preview,checksum:inputHash({csv:raw.csv,platform:raw.platform,column_mapping:raw.column_mapping||{}}),expires_at:new Date(Date.now()+3600000).toISOString()});
    send(res,200,{preview_id:saved.id,...preview,notice:'Vérifiez les lignes et les erreurs avant de confirmer. Les lignes invalides ne seront pas importées.'});return true;
   }
   if(path==='/api/strategy/imports'&&req.method==='POST'){
    const raw=await body(req),preview=get(uid,'import_preview',clean(raw.preview_id));
    if(!preview)throw fail('PREVIEW_NOT_FOUND','Aperçu introuvable.',404);
    if(preview.expires_at<new Date().toISOString())throw fail('PREVIEW_EXPIRED','Aperçu expiré ; importez à nouveau le CSV.');
    let imported=0,skipped=0;
    db.exec('BEGIN IMMEDIATE');
    try{
     const identities=new Map(list(uid,'metric').map(m=>[metricIdentity(m),inputHash(normalizeMetric(m,{source_kind:m.source_kind}))]));
     for(const row of preview.rows){const {row:line,...metric}=row;const checksum=inputHash(metric),identity=metricIdentity(metric);if(identities.has(identity)&&identities.get(identity)!==checksum)throw fail('CONFLICTING_METRIC','Une mesure a changé depuis l’aperçu. Recréez l’aperçu et vérifiez les sources.',409);if(db.prepare("SELECT id FROM strategy_records WHERE user_id=? AND kind='metric' AND checksum=?").get(uid,checksum)){skipped++;continue;}put(uid,'metric',metric,{checksum});identities.set(identity,checksum);imported++;}
     put(uid,'import',{original_name:clean(raw.original_name,200)||'CSV',schema_version:1,checksum:preview.checksum,imported,skipped,errors:preview.errors,state:'completed'});
     db.exec('COMMIT');
    }catch(error){db.exec('ROLLBACK');throw error;}
    send(res,200,{imported,skipped,errors:preview.errors});return true;
   }
   if(path==='/api/strategy/diagnostic'&&req.method==='POST'){
    const profile=list(uid,'profile')[0]||{},allMetrics=list(uid,'metric'),competitors=list(uid,'competitor');
    const diagnostic=buildDiagnostic({profile,metrics:allMetrics,competitors,methods:methods()});
    const existing=db.prepare("SELECT id FROM strategy_records WHERE user_id=? AND kind='diagnostic' AND checksum=?").get(uid,diagnostic.input_hash);
    if(existing){send(res,200,{diagnostic:get(uid,'diagnostic',existing.id)});return true;}
    const saved=put(uid,'diagnostic',{...diagnostic,generated_at:new Date().toISOString()},{checksum:diagnostic.input_hash});
    for(const mission of diagnostic.missions)put(uid,'mission',{...mission,diagnostic_id:saved.id},{id:inputHash({uid,mission_id:mission.id})});
    saved.missions=list(uid,'mission').filter(m=>m.diagnostic_id===saved.id);
    put(uid,'diagnostic',saved,{id:saved.id});
    send(res,201,{diagnostic:saved});return true;
   }
   if(path==='/api/strategy/diagnostics'&&req.method==='GET'){send(res,200,{diagnostics:list(uid,'diagnostic')});return true;}
   if(path==='/api/strategy/missions'&&req.method==='GET'){const current=list(uid,'diagnostic')[0];send(res,200,{missions:list(uid,'mission').filter(m=>!current||m.diagnostic_id===current.id).slice(0,3)});return true;}
   if(/^\/api\/strategy\/missions\/[^/]+$/.test(path)&&req.method==='PATCH'){
    const id=path.split('/').pop(),mission=get(uid,'mission',id);if(!mission)throw fail('NOT_FOUND','Mission introuvable.',404);
    const raw=await body(req);
    if(raw.status!==undefined&&!['active','done'].includes(raw.status))throw fail('STATUS_INVALID','Statut attendu : active ou done.');
    if(raw.steps!==undefined){if(!Array.isArray(raw.steps)||raw.steps.length!==mission.steps.length)throw fail('STEPS_INVALID','Étapes invalides.');mission.steps=mission.steps.map((step,i)=>({...step,completed:raw.steps[i].completed===true}));}
    mission.status=raw.status||mission.status;
    if(Object.hasOwn(raw,'completion_note'))mission.completion_note=clean(raw.completion_note,2000);
    mission.completed_at=mission.status==='done'?new Date().toISOString():null;
    send(res,200,{mission:put(uid,'mission',mission,{id})});return true;
   }
   if(path==='/api/strategy/competitors'&&req.method==='GET'){send(res,200,{competitors:list(uid,'competitor')});return true;}
   if(path==='/api/strategy/competitors'&&req.method==='POST'){
    if(list(uid,'competitor').length>=5)throw fail('COMPETITOR_LIMIT','Maximum cinq profils concurrents.');
    const raw=await body(req);let source;
    try{source=new URL(raw.source_public);}catch{throw fail('SOURCE_REQUIRED','Lien public de la source requis.');}
    if(source.protocol!=='https:'||source.username||source.password)throw fail('SOURCE_INVALID','Source HTTPS publique requise.');
    const competitor={handle:clean(raw.handle,100),platform:platforms.has(raw.platform)?raw.platform:'instagram',source_public:source.toString(),collected_at:date(raw.collected_at,'collected_at',true),relevant_notes:clean(raw.relevant_notes,4000),source_kind:'manual'};
    if(!competitor.handle||!competitor.relevant_notes)throw fail('COMPETITOR_INVALID','Identifiant et observations qualitatives requis.');
    send(res,201,{competitor:put(uid,'competitor',competitor)});return true;
   }
   if(/^\/api\/strategy\/competitors\/[^/]+$/.test(path)&&req.method==='DELETE'){
    const id=path.split('/').pop();if(!get(uid,'competitor',id))throw fail('NOT_FOUND','Profil introuvable.',404);
    db.prepare("DELETE FROM strategy_records WHERE id=? AND user_id=? AND kind='competitor'").run(id,uid);send(res,200,{deleted:true});return true;
   }
   if(path==='/api/strategy/experiments'&&req.method==='GET'){send(res,200,{experiments:list(uid,'experiment'),goal_metrics:EXPERIMENT_METRICS});return true;}
   if(path==='/api/strategy/experiments'&&req.method==='POST'){
    const raw=await body(req),hypothesis=clean(raw.hypothesis,2000),changedVariable=clean(raw.changed_variable,1000);
    if(hypothesis.length<20||changedVariable.length<10)throw fail('EXPERIMENT_INCOMPLETE','Décrivez votre hypothèse (20 caractères) et la seule variable modifiée (10 caractères).');
    if(!Object.hasOwn(EXPERIMENT_METRICS,raw.goal_metric))throw fail('EXPERIMENT_METRIC','Choisissez un indicateur documenté.');
    const baseline=get(uid,'metric',clean(raw.baseline_metric_id,100));
    if(!baseline)throw fail('METRIC_NOT_FOUND','Mesure de référence personnelle introuvable.',404);
    const readiness=compareMetrics(baseline,baseline),value=calculateRates(baseline)[raw.goal_metric],now=new Date(clock()).toISOString();
    if(!readiness.comparable||value===null)throw fail('EXPERIMENT_BASELINE','Complétez le format, la fenêtre, la définition, la durée et les mesures nécessaires à cet indicateur avant de démarrer.');
    if(!baseline.external_post_id||baseline.collected_at>now)throw fail('EXPERIMENT_BASELINE','La référence doit désigner une publication réelle déjà observée.');
    const experiment={hypothesis,changed_variable:changedVariable,goal_metric:raw.goal_metric,goal_direction:'increase',baseline_metric_id:baseline.id,baseline_snapshot:baseline,baseline_value:value,started_at:now,ended_at:null,status:'active',conclusion:null,caveat:EXPERIMENT_CAVEAT};
    send(res,201,{experiment:put(uid,'experiment',experiment)});return true;
   }
   const experimentMatch=/^\/api\/strategy\/experiments\/([^/]+)(?:\/(results))?$/.exec(path);
   if(experimentMatch){
    const experiment=get(uid,'experiment',experimentMatch[1]);
    if(!experiment)throw fail('NOT_FOUND','Expérience introuvable.',404);
    if(req.method==='GET'&&!experimentMatch[2]){send(res,200,{experiment});return true;}
    if(req.method==='POST'&&experimentMatch[2]){
     const raw=await body(req);
     if(experiment.status==='completed'){
      if(raw.after_metric_id!==experiment.after_metric_id)throw fail('EXPERIMENT_COMPLETED','Cette expérience est terminée. Démarrez un nouveau test pour conserver son historique.',409);
      send(res,200,{experiment,duplicate:true});return true;
     }
     const after=get(uid,'metric',clean(raw.after_metric_id,100)),now=new Date(clock()).toISOString();
     if(!after)throw fail('METRIC_NOT_FOUND','Mesure après expérience personnelle introuvable.',404);
     if(!after.external_post_id||after.external_post_id===experiment.baseline_snapshot.external_post_id&&after.platform===experiment.baseline_snapshot.platform||after.publication_at<experiment.started_at||after.collected_at>now)throw fail('EXPERIMENT_CHRONOLOGY','Choisissez une autre publication réalisée après le début du test, avec une collecte déjà effectuée.');
     const note=clean(raw.observation_note,2000);
     if(note.length<20)throw fail('EXPERIMENT_OBSERVATION','Décrivez vos observations et les différences de contexte (20 caractères minimum).');
     const comparison=compareMetrics(experiment.baseline_snapshot,after),afterValue=calculateRates(after)[experiment.goal_metric];
     if(afterValue===null)comparison.reasons.push('Indicateur choisi non évaluable sur la publication après test.');
     const comparable=comparison.comparable&&afterValue!==null,delta=comparable?Number((afterValue-experiment.baseline_value).toFixed(2)):null;
     const completed={...experiment,after_metric_id:after.id,after_snapshot:after,after_value:afterValue,observation_note:note,ended_at:now,status:'completed',comparable,reasons:comparison.reasons,delta_points:delta,conclusion:!comparable?'not_evaluable':delta>0?'improved':delta<0?'worsened':'unclear'};
     const changed=db.prepare("UPDATE strategy_records SET data=?,updated_at=? WHERE id=? AND user_id=? AND kind='experiment' AND json_extract(data,'$.status')='active'").run(JSON.stringify(completed),now,experiment.id,uid);
     if(!changed.changes){
      const persisted=get(uid,'experiment',experiment.id);
      if(!persisted)throw fail('NOT_FOUND','Expérience introuvable.',404);
      if(persisted.after_metric_id!==after.id)throw fail('EXPERIMENT_COMPLETED','Cette expérience est déjà terminée avec une autre publication. Son historique a été conservé.',409);
      send(res,200,{experiment:persisted,duplicate:true});return true;
     }
     send(res,201,{experiment:get(uid,'experiment',experiment.id)});return true;
    }
   }
   if(path==='/api/strategy/results'&&req.method==='GET'){send(res,200,{results:list(uid,'result')});return true;}
   if(path==='/api/strategy/results'&&req.method==='POST'){
    const raw=await body(req),before=get(uid,'metric',raw.before_metric_id),after=get(uid,'metric',raw.after_metric_id);
    if(!before||!after)throw fail('METRIC_NOT_FOUND','Deux mesures personnelles sont requises.',404);
    const analysis=raw.analysis_id?get(uid,'video_analysis',raw.analysis_id):null;
    if(raw.analysis_id&&!analysis)throw fail('ANALYSIS_NOT_FOUND','Analyse introuvable.',404);
    const result={before_metric_id:before.id,after_metric_id:after.id,analysis_id:analysis?.id||null,analysis_snapshot:analysis?{score:analysis.score,coverage:analysis.coverage,engine_version:analysis.engine_version,input_hash:analysis.input_hash}:null,hypothesis:clean(raw.hypothesis,2000),...compareMetrics(before,after),source_kind:'manual'};
    send(res,201,{result:put(uid,'result',result)});return true;
   }
   if(path==='/api/strategy/video-analyses'&&req.method==='GET'){send(res,200,{analyses:list(uid,'video_analysis')});return true;}
   if(path==='/api/strategy/video-analyses'&&req.method==='POST'){
    const analysis=analyzeVideo(await body(req));
    const previous=db.prepare("SELECT id FROM strategy_records WHERE user_id=? AND kind='video_analysis' AND checksum=?").get(uid,analysis.input_hash);
    send(res,previous?200:201,{analysis:previous?get(uid,'video_analysis',previous.id):put(uid,'video_analysis',analysis,{checksum:analysis.input_hash})});return true;
   }
   send(res,404,{code:'NOT_FOUND',message:'Action Stratégie introuvable.',retryable:false});return true;
  }catch(error){send(res,error.status||500,{code:error.code||'STRATEGY_ERROR',message:error.status?error.message:'Impossible de traiter cette action Stratégie.',retryable:!error.status});return true;}
 }
 async function handleAdmin(req,res,url,owner){
  if(!url.pathname.startsWith('/api/admin/method-versions'))return false;
  if(owner?.role!=='owner'||owner?.mfa_verified!==true){send(res,403,{code:'OWNER_REQUIRED',message:'Accès réservé au propriétaire avec MFA.',retryable:false});return true;}
  try{
   if(url.pathname==='/api/admin/method-versions'&&req.method==='GET'){
    send(res,200,{methods:methods(),versions:db.prepare('SELECT method_id,version,created_by,created_at FROM strategy_method_versions ORDER BY method_id,version DESC').all()});return true;
   }
   if(url.pathname==='/api/admin/method-versions'&&req.method==='POST'){
    const raw=await body(req),current=methods().find(m=>m.id===raw.method_id);
    if(!current)throw fail('METHOD_UNKNOWN','Identifiant de méthode inconnu.');
    let source;try{source=new URL(raw.source_url);}catch{throw fail('METHOD_SOURCE','Source HTTPS requise.');}
    if(source.protocol!=='https:'||source.username||source.password)throw fail('METHOD_SOURCE','Source HTTPS publique requise.');
    const steps=Array.isArray(raw.process_steps)?raw.process_steps.map(s=>clean(s,2000)).filter(Boolean):[];
    const measurements=Array.isArray(raw.success_metrics)?raw.success_metrics.map(s=>clean(s,1000)).filter(Boolean):[];
    if(!clean(raw.title,200)||steps.length<2||steps.length>12||!measurements.length||clean(raw.exercise).length<20)throw fail('METHOD_INCOMPLETE','Titre, au moins deux étapes, exercice et indicateurs requis.');
    const published={...current,title:clean(raw.title,200),source_url:source.toString(),source_title:clean(raw.source_title,300)||source.hostname,process_steps:steps,success_metrics:measurements,exercise:clean(raw.exercise,3000),pitfalls:Array.isArray(raw.pitfalls)?raw.pitfalls.map(s=>clean(s,1000)).filter(Boolean).slice(0,10):current.pitfalls,version:current.version+1,enabled:raw.enabled!==false,last_verified_at:raw.source_verified_by_owner===true?new Date().toISOString().slice(0,10):null,source_verification:raw.source_verified_by_owner===true?'Vérification déclarée par le propriétaire':'Lien externe à vérifier'};
    db.exec('BEGIN IMMEDIATE');
    try{
     const now=new Date().toISOString();
     db.prepare('INSERT INTO strategy_method_versions(method_id,version,data,created_by,created_at) VALUES(?,?,?,?,?)').run(published.id,published.version,JSON.stringify(published),owner.id,now);
     db.prepare('INSERT INTO strategy_method_state(method_id,version,enabled,data) VALUES(?,?,?,?) ON CONFLICT(method_id) DO UPDATE SET version=excluded.version,enabled=excluded.enabled,data=excluded.data').run(published.id,published.version,published.enabled?1:0,JSON.stringify(published));
     db.prepare('INSERT INTO strategy_admin_audit(id,actor_id,action,method_id,version,created_at) VALUES(?,?,?,?,?,?)').run(randomUUID(),owner.id,'method.publish',published.id,published.version,now);
     db.exec('COMMIT');
    }catch(error){db.exec('ROLLBACK');throw error;}
    send(res,201,{method:published});return true;
   }
   if(/^\/api\/admin\/method-versions\/M\d{2}$/.test(url.pathname)&&req.method==='PATCH'){
    const id=url.pathname.split('/').pop(),current=methods().find(m=>m.id===id),raw=await body(req);
    if(!current)throw fail('METHOD_UNKNOWN','Méthode introuvable.',404);
    if(typeof raw.enabled!=='boolean')throw fail('METHOD_STATE','État enabled booléen requis.');
    const updated={...current,enabled:raw.enabled};
    db.prepare('INSERT INTO strategy_method_state(method_id,version,enabled,data) VALUES(?,?,?,?) ON CONFLICT(method_id) DO UPDATE SET enabled=excluded.enabled,data=excluded.data').run(id,current.version,raw.enabled?1:0,JSON.stringify(updated));
    db.prepare('INSERT INTO strategy_admin_audit(id,actor_id,action,method_id,version,created_at) VALUES(?,?,?,?,?,?)').run(randomUUID(),owner.id,raw.enabled?'method.enable':'method.disable',id,current.version,new Date().toISOString());
    send(res,200,{method:updated});return true;
   }
   send(res,404,{code:'NOT_FOUND',message:'Version de méthode introuvable.',retryable:false});return true;
  }catch(error){send(res,error.status||500,{code:error.code||'METHOD_ERROR',message:error.status?error.message:'Impossible de modifier cette méthode.',retryable:!error.status});return true;}
 }
 return {handle,handleAdmin,methods,exportData:userId=>db.prepare('SELECT * FROM strategy_records WHERE user_id=? ORDER BY kind,created_at,id').all(userId).map(row=>({...JSON.parse(row.data),id:row.id,kind:row.kind,created_at:row.created_at,updated_at:row.updated_at})),deleteData:userId=>db.prepare('DELETE FROM strategy_records WHERE user_id=?').run(userId)};
}
