// OMNI Edit+ — metadata-only Pinterest style router. Never emits publishable footage.
// The 327-ref user library is supplied separately as catalog.items, not scraped here.
const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/œ/g,'oe').toLowerCase();
const patterns=[
 ['TIME',/\b(temps|heures?|minutes?|horloge|attente|delai|productivite)\b/],
 ['MONEY',/\b(argent|payer|paiement|euros?|ventes?|revenus?|achat|acheter|contrat paye)\b/],
 ['METRIC',/\b(statistique|graphique|courbe|chiffre|pourcentage|croissance)\b/],
 ['SOCIAL',/\b(instagram|tiktok|reseaux|abonne|likes?|commentaires?|dm|messages?)\b/],
 ['DOC',/\b(contrat|signature|document|facture|dossier|preuves?)\b/],
 ['EDU',/\b(apprendre|competence|formation|cours|enseigner|expliquer)\b/],
 ['PEOPLE',/\b(aider|accompagner|confiance|relation|coeurs?|emotion)\b/],
 ['DEVICE',/\b(telephone|smartphone|ordinateur|iphone|clavier)\b/],
 ['PRODUCTION',/\b(video|tournage|filmer|camera|montage)\b/],
 ['UI',/\b(interface|application|bouton|logiciel|ecran)\b/],
 ['MOTION',/\b(transition|mouvement|reveal|animation)\b/],
 ['TEXT',/\b(typographie|titres?|sous titres)\b/],
 ['BRAND',/\b(marque|branding|design|univers)\b/],
 ['ILLUS',/\b(metaphore|idee|concept)\b/]
];
export function omniReferenceFamilies(spoken){
 const s=norm(spoken);return patterns.filter(([,re])=>re.test(s)).map(([key])=>key);
}
export function selectOmniPinterestReferences({speech,catalog,max=8}={}){
 const rows=Array.isArray(catalog?.items)?catalog.items:Array.isArray(catalog)?catalog:[];
 const families=omniReferenceFamilies(speech);
 if(!families.length)return [];
 const selected=rows.filter(ref=>families.includes(ref.category_id)&&
   ref.source_type==='pinterest_screenshot_reference'&&ref.usable_as_broll===false);
 return selected.sort((a,b)=>
   Number(b.description_verified==='reference_annotee')-
   Number(a.description_verified==='reference_annotee')).slice(0,Math.max(0,Math.min(24,max)))
   .map(ref=>({referenceId:ref.id,category:ref.category_id,referenceImage:ref.file,
     status:'INSPIRATION_ONLY',renderAssetUrl:null,licenseValid:false,
     recreateAsOriginalOMNIGraphic:true}));
}
export function omniBrollAssetCandidates({speech,catalog,max=5}={}){
 const rows=Array.isArray(catalog?.items)?catalog.items:Array.isArray(catalog)?catalog:[];
 const tokens=norm(speech).split(/[^a-z0-9]+/).filter(t=>t.length>3);
 if(!tokens.length)return [];
 return rows.filter(x=>x.status==='asset_ready'&&x.local_mp4_available===true&&
   x.provider==='Mixkit'&&x.file)
  .map(x=>({...x,_score:tokens.filter(t=>norm(x.title).includes(t)).length}))
  .filter(x=>x._score>0).sort((a,b)=>b._score-a._score)
  .slice(0,Math.min(max,8)).map(x=>({id:x.id,assetPath:x.file,
    sourceUrl:x.source_url,editorialApprovalRequired:true,
    licensedUseMustBeChecked:true,automaticallyInsert:false}));
}
