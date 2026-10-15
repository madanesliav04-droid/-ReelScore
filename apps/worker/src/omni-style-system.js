// Edit+ — editorial typography references selected from user's Pinterest board.
// Font names in a screenshot are references, not licensed/bundled binaries.
// Previews use explicit, shipped-compatible substitutes until exact fonts are verified.
export const OMNI_STYLE_TYPOGRAPHY_VERSION='omni-type-v1';
export const OMNI_TYPE_STYLES=Object.freeze({
 codie:{reference:'Avenir',preview:'Inter Display',weight:650,size:66,maxWords:4,stroke:2,position:'middle_low',intent:'natural premium business'},
 impact:{reference:'Futura',preview:'URW Gothic',weight:850,size:77,maxWords:3,stroke:3,position:'middle_low',intent:'short geometric energetic'},
 clean:{reference:'Optima',preview:'Lato',weight:600,size:61,maxWords:5,stroke:2,position:'lower_third',intent:'open understated humanist'},
 authority:{reference:'Baskerville',preview:'Bitstream Charter',weight:600,size:64,maxWords:5,stroke:2,position:'lower_third',intent:'serif editorial expert'},
 explainer:{reference:'Century Gothic',preview:'URW Gothic',weight:650,size:66,maxWords:4,stroke:2,position:'middle_low',intent:'legible instructional'},
 data:{reference:'Lubalin',preview:'Roboto Slab',weight:750,size:66,maxWords:4,stroke:2,position:'lower_middle',intent:'slab structured evidence'},
 ugc_native:{reference:'Museo',preview:'Cabin',weight:650,size:66,maxWords:4,stroke:2,position:'middle_low',intent:'personal and native'},
 cinematic_story:{reference:'Didot',preview:'GFS Didot',weight:550,size:60,maxWords:6,stroke:1,position:'lower_third',intent:'quiet high-contrast editorial'}
});
const aliases={creator_clean:'clean',business_viral:'impact',podcast_authority:'authority',ugc:'ugc_native',cinematic:'cinematic_story'};
export function resolveOmniTypography(style,current={}){
 const name=aliases[style]||style,selected=OMNI_TYPE_STYLES[name];
 if(!selected)return {...current};
 return {...current,fontFamily:selected.preview,fontWeight:selected.weight,fontSize:selected.size,
  maxWordsPerLine:selected.maxWords,stroke:selected.stroke,position:selected.position,
  background:false,referenceTypeface:selected.reference,renderedTypeface:selected.preview,
  typefaceVerification:'preview_substitute_not_exact_reference',
  typographyPolicy:OMNI_STYLE_TYPOGRAPHY_VERSION,
  safeCaptionPlacement:name==='codie'?'omni_bottom_center_adaptive':null};
}
// Silence beats decoration. Emit a pair only for an unambiguous spoken concept.
const accents=[
 {kind:'zero',pattern:/\b(?:zero|aucun|rien)\b/i,icons:['spark','zero']},
 {kind:'solution',pattern:/\b(?:resoudre|resolution|resout)\b/i,icons:['question','check']},
 {kind:'heart',pattern:/\b(?:coeur|coeurs)\b/i,icons:['heart_outline','heart_solid']}
];
const normalized=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/œ/g,'oe').toLowerCase();
export function proposeOmniBubblePairs({words=[],durationMs=0,sourceAspect=1,enabled=false,maxPer30s=2.5}={}){
 if(!enabled||!(Number(durationMs)>=3000)||!(Number(sourceAspect)>=1.25)||!Array.isArray(words)||!words.length)return [];
 // A centred facecam in portrait does not guarantee clear lateral space. Hold.
 const available=Math.min(3,Math.floor(durationMs/30000*maxPer30s)+1),out=[],seen=new Set();
 const sorted=[...words].filter(w=>Number.isFinite(Number(w.startMs))&&Number.isFinite(Number(w.endMs))&&Number(w.endMs)>Number(w.startMs)).sort((a,b)=>Number(a.startMs)-Number(b.startMs));
 for(let i=0;i<sorted.length;i++){
  const phrase=normalized(sorted[i].text);
  const entry=accents.find(a=>a.pattern.test(phrase)&&!seen.has(a.kind));
  if(!entry)continue;
  const at=Number(sorted[i].startMs);
  if(at<900||at>durationMs-900||out.some(x=>at<x.endMs+3200))continue;
  const spokenEnd=Math.min(durationMs,Number(sorted[Math.min(i+6,sorted.length-1)].endMs));
  out.push({mode:'omni_bubbles',kind:entry.kind,icons:entry.icons,
    startMs:at,endMs:Math.min(durationMs,Math.max(at+850,Math.min(at+1550,spokenEnd))),
    evidence:'timed_transcript',spoken_anchor:sorted.slice(i,Math.min(i+7,sorted.length)).map(w=>w.text).join(' '),
    layout:'lateral_symmetric',noStockEmoji:true,sfxPermission:'semantic_micro_accent_only'});
  seen.add(entry.kind);
  if(out.length>=available)break;
 }
 return out;
}
