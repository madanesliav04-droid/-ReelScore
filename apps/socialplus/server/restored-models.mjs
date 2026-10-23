import {omniBrandScene} from '../../worker/src/omni-brand-tokens.js';
import {speechCaptionAss} from './speech-captions.mjs';
import {writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import {renderHormoziOmniAss} from '../../worker/src/hormozi-omni-render.js';
import {buildCaptionAss} from '../../worker/src/render.js';
import {captureKinetic} from './kinetic-capture.mjs';
import {buildLocalEdit} from './local-edit.mjs';

export const RESTORED_PREVIEWS=Object.freeze(['codie-omni-v60','leila-hormozi-v53','apple-premium-spatial','alex-hormozi-v16','social-kinetic-v28','cinematic-storytelling-v7']);
const fail=message=>Object.assign(new Error(message),{code:'REFERENCE_INPUT_REQUIRED',status:422});

export function restoredPlan(model,meta,input={}){
 if(!RESTORED_PREVIEWS.includes(model))throw fail('Ce modèle ne dispose pas de ce port de composants.');
 if(input.placementReviewed!==true)throw fail('Validez le placement des graphismes dans les zones libres du rush.');
 if(meta.width*meta.height>1920*1080||meta.durationMs>60_000)throw fail('Le port de composants accepte actuellement des rushs jusqu’à 60 secondes et 1080p natif.');
 if(!meta.hasAudio)throw fail('La voix originale est requise.');
 const base=buildLocalEdit({report:{metadata:meta,suggestions:[]},transcript:input.transcript,captionsReviewed:input.captionsReviewed,previewOnly:input.allowUnreviewedPreview===true});
 const words=input.transcript;
 if(!words?.length)throw fail('Fournissez les mots réels alignés pour déclencher les graphismes sur la parole.');
 if(!Array.isArray(input.events)||input.events.length>(model==='apple-premium-spatial'?3:8))throw fail('Fournissez de 0 à 3 événements Spatial, ou de 0 à 8 événements pour les autres modèles.');
 const events=input.events.map(e=>{
   if(!e||!Number.isInteger(e.wordIndex)||e.wordIndex<0||!Number.isInteger(e.wordCount??1)||(e.wordCount??1)<1||(e.wordCount??1)>(model==='social-kinetic-v28'?12:5))throw fail('Chaque événement doit désigner les mots de la transcription par wordIndex et wordCount.');
   const selected=words.slice(e.wordIndex,e.wordIndex+(e.wordCount??1));
   if(selected.length!==(e.wordCount??1))throw fail('L’événement désigne un mot absent.');
   const startMs=selected[0].startMs??Math.round(selected[0].start*1000);
   const endMs=e.endMs??Math.min(meta.durationMs,startMs+2200);
   if(!Number.isFinite(endMs)||endMs-startMs<500||endMs-startMs>4000||endMs>meta.durationMs)throw fail('Chaque événement dure de 0,5 à 4 secondes dans la source.');
   const fullscreen=model==='cinematic-storytelling-v7'||model==='alex-hormozi-v16'&&e.kind==='fullscreen';
   const rect=fullscreen?[0,0,1,1]:e.rect;
   if(!fullscreen&&(!Array.isArray(rect)||rect.length!==4||rect.some(v=>typeof v!=='number'||!Number.isFinite(v))||rect[0]<.05||rect[1]<.05||rect[2]<.08||rect[3]<.08||rect[0]+rect[2]>.95||rect[1]+rect[3]>.65))throw fail('La zone libre [x,y,largeur,hauteur] doit rester dans les marges de sécurité et au-dessus des sous-titres.');
   const text=selected.map(w=>w.text).join(' ');
   if(text.length>(model==='social-kinetic-v28'?80:22))throw fail('Le titre parlé est trop long pour le composant restauré (22 caractères maximum).');
   const kind=e.kind;
   if(model==='alex-hormozi-v16'&&!fullscreen&&(rect[0]>.2||rect[0]+rect[2]<.8||rect[1]>.05||rect[1]+rect[3]<.25))throw fail('Alex utilise la bande haute centrée : réservez rect [0.15,0.05,0.7,0.2].');
   if(model==='social-kinetic-v28'&&!['bubble','hero'].includes(kind))throw fail('Social Kinetic : choisir le type bubble ou hero.');
   if(model==='codie-omni-v60'&&(!['clock','euro'].includes(kind)||(kind==='clock'?!/\btemps\b/i.test(text):!/\bargent\b/i.test(text))))throw fail('Les icônes V60 sont déclenchées par les mots réellement prononcés « temps » ou « argent ».');
   let secondary=null;
   if(e.secondaryWordIndex!==undefined){const count=e.secondaryWordCount??1;if(!Number.isInteger(e.secondaryWordIndex)||e.secondaryWordIndex<0||!Number.isInteger(count)||count<1||count>5)throw fail('Second groupe de mots invalide.');const group=words.slice(e.secondaryWordIndex,e.secondaryWordIndex+count);if(group.length!==count)throw fail('Second groupe absent de la transcription.');secondary={text:group.map(w=>w.text).join(' '),startMs:group[0].startMs??Math.round(group[0].start*1000)};if(secondary.text.length>35||secondary.startMs<startMs||secondary.startMs>=endMs)throw fail('Le second groupe doit être prononcé pendant la scène.');}
   return {text,startMs,endMs,rect,kind,secondary};
 }).sort((a,b)=>a.startMs-b.startMs);
 if(model==='alex-hormozi-v16'&&events.some(e=>e.kind==='fullscreen')&&events.some(e=>e.kind!=='fullscreen'))throw fail('Choisissez un seul mode Alex : plein écran ou bande haute.');
 for(let i=1;i<events.length;i++)if(events[i].startMs<events[i-1].endMs)throw fail('Les événements se chevauchent. Espacez leur fin pour garder une seule intervention graphique dominante.');

 const captions=model==='social-kinetic-v28'?base.captions.map((c,i)=>({id:'caption-'+i,kind:'caption',text:c.text,startMs:c.startMs,endMs:c.endMs,rect:{x:.1,y:.76,w:.8,h:.15},words:c.words.map(w=>({...w,outputStartMs:w.startMs,outputEndMs:w.endMs}))})):[];
 return {model,width:meta.width,height:meta.height,durationMs:meta.durationMs,events,captions,palette:model==='alex-hormozi-v16'?omniBrandScene({lightBackground:true}):undefined,ass:model==='social-kinetic-v28'?null:speechCaptionAss(base,model,meta,events)};
}

export async function prepareRestoredOverlay({model,meta,input,work,run,signal}){
 const plan=restoredPlan(model,meta,input);
 if(!plan.events.length&&model!=='social-kinetic-v28')return {plan,overlayPath:null};
 if(model==='alex-hormozi-v16'&&!plan.events.some(e=>e.kind==='fullscreen')){
   const graphicAss=renderHormoziOmniAss({graphicCues:plan.events.map(e=>({mode:'hormozi_omni',type:/[0-9€%]/.test(e.text)?'metric':'sequence',text:e.text,items:[e.text],itemStarts:[e.startMs],startMs:e.startMs,endMs:e.endMs}))},meta.width,meta.height);
   return {plan,overlayPath:null,graphicAss};
 }
 const overlayPath=join(work,'original-components.mov'),configPath=join(work,'original-components.json');
 if(model==='social-kinetic-v28'){await captureKinetic(plan,overlayPath,{signal});return {plan,overlayPath};}
 await writeFile(configPath,JSON.stringify({...plan,ass:undefined,output:overlayPath}));
 const script=fileURLToPath(new URL('../engines/render_components.py',import.meta.url));
 await run(process.env.SOCIALPLUS_PYTHON||'python3',[script,configPath],{signal,timeoutMs:180_000});
 return {plan,overlayPath};
}
