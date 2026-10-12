// Viral Studio Edit+ — staging-only ranked local stock library.
// A Pinterest reference is never an uploadable video asset.
const fold=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9 ]+/g,' ').replace(/\s+/g,' ').trim();
const ontology=[
 {intent:'interaction',cue:/\b(like|likes|resea|reseaux|instagram|tiktok|social|scroll|abonne|followers|vues|publication|publier|contenu)\b/,shot:/scroll|social media|cell phone|smartphone|mobile phone/},
 {intent:'interaction',cue:/\b(whatsapp|message|messages|repondre|reponse|question|questions|dm|discussion|conversation|ecrit|ecrire)\b/,shot:/whatsapp|texting|typing on a phone|cell phone|smartphone/},
 {intent:'execution',cue:/\b(ordinateur|laptop|pc|clavier|travailler|travail|monter|montage|coder|edition|ecran|edit)\b/,shot:/typing|laptop|computer|working|screen|programmer/},
 {intent:'business',cue:/\b(contrat|signer|signature|client|collaborateur|partenaire|entreprise|reunion|equipe|bureau)\b/,shot:/contract|signing|meeting|coworkers|office|work/},
 {intent:'finance',cue:/\b(argent|euros?|dollars?|revenu|payer|prix|cout|cash|profit|economie|bourse|trading)\b/,shot:/cash|money|bill|dollar|profit|stock market/},
 {intent:'finance',cue:/\b(trading|bourse|forex|marche|graphique|chart)\b/,shot:/stock market|profit|chart/},
 {intent:'ambience',cue:/\b(ville|rue|voyage|deplacement|metro|route|cafe)\b/,shot:/city|street|coffee|train|cafe/},
 {intent:'collaboration',cue:/\b(reunion|equipe|discuter|partenaire|ensemble|collaborer|meeting)\b/,shot:/meeting|coworkers|colleagues/}
];
const styleCaps={codie:2,impact:4,clean:1,authority:2,explainer:3,data:3,ugc_native:1,cinematic:3};
export function rankDownloadedBroll({text,items,limit=5,vertical=false}={}){
 const speech=fold(text),matches=ontology.filter(o=>o.cue.test(speech));
 if(!speech||!matches.length)return [];
 const found=[];
 for(const a of Array.isArray(items)?items:[]){
  if(a.status!=='asset_ready'||!a.asset_path||!a.sha256||!(Number(a.duration_sec)>1.3))continue;
  const title=fold(a.title),intents=Array.isArray(a.intent)?a.intent:[];
  let best=0,anchor='';
  for(const m of matches){
   const score=(m.shot.test(title)?.69:0)+(intents.includes(m.intent)?.16:0);
   if(score>best){best=score;anchor=m.intent;}
  }
  if(best<.69)continue;
  const confidence=Math.min(1,best+(vertical&&Number(a.height)>Number(a.width)?.04:0));
  found.push({id:a.id,title:a.title,asset_path:a.asset_path,source_url:a.source_url,
   sha256:a.sha256,confidence:Number(confidence.toFixed(2)),narrative_intent:anchor,
   decision:'eligible_asset_not_visual_qa_approved'});
 }
 return found.sort((a,b)=>b.confidence-a.confidence||a.id.localeCompare(b.id)).slice(0,Math.max(0,limit));
}
export function planLocalBrollInserts({segments=[],items=[],style='codie',durationMs=30000}={}){
 const cap=styleCaps[style]??2;
 if(!Number.isFinite(durationMs)||durationMs<1500||!Array.isArray(segments))return {cues:[],held:[{reason:'INVALID_INPUT'}]};
 const max=Math.max(0,Math.ceil(durationMs/30000*cap)),cues=[],held=[],used=new Set();
 let end=-Infinity;
 for(const seg of segments){
  const st=Number(seg.startMs),ed=Number(seg.endMs);
  if(!Number.isFinite(st)||!Number.isFinite(ed)||ed<=st||st<950||ed>durationMs+250)continue;
  if(st-end<3500)continue;
  const candidates=rankDownloadedBroll({text:seg.text,items,limit:8});
  const pick=candidates.find(x=>!used.has(x.id));
  if(!pick){held.push({startMs:st,reason:'NO_CONCRETE_MATCH_OR_DOWNLOADED_ASSET'});continue;}
  const endMs=Math.min(durationMs,st+Math.min(2700,Math.max(1600,ed-st)));
  if(endMs-st<1300)continue;
  cues.push({...pick,startMs:st,endMs,spoken_anchor:String(seg.text),creative_review_required:true});
  used.add(pick.id);end=endMs;
  if(cues.length>=max)break;
 }
 return {policy:'editplus-asset-library-staging-v1',cues,held};
}
