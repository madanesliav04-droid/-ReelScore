import {createHash} from 'node:crypto';
export const EDITORIAL_VERSION='socialplus-local-editorial-indicators-v1';
const normalize=s=>s.toLowerCase().normalize('NFD').replace(/\p{M}/gu,'');
/** Observable textual/acoustic indicators only. No fabricated understanding or retention data. */
export function editorialIndicators(report,transcript,{goal='awareness'}={}){
 const duration=report.metadata.durationMs;
 const words=(transcript?.words||[]).map(w=>({text:w.text,startMs:w.startMs??Math.round(w.start*1000),endMs:w.endMs??Math.round(w.end*1000),uncertain:w.reviewRequired===true&&w.confirmed!==true||w.probability!==undefined&&w.probability<.75||/\s/.test(w.text)}));
 if(words.some(w=>!w.text||!Number.isFinite(w.startMs)||!Number.isFinite(w.endMs)||w.endMs<=w.startMs||w.startMs<0||w.endMs>duration))throw Object.assign(Error('Horaires éditoriaux invalides.'),{status:422,code:'EDITORIAL_TIMING'});
 const provisional=transcript?.reviewed!==true||words.some(w=>w.uncertain);
 const findings=[];
 const add=(id,criterion,startMs,endMs,what,why,how,verify,evidence,kind='textual_indicator')=>findings.push({id,criterion,startMs,endMs,what,why,how,verify,evidence,kind,provisional:kind==='textual_indicator'&&provisional});
 const quote=group=>group.map(w=>w.text).join(' ');
 const opening=words.filter(w=>w.startMs<3000);
 if(words.length&&words[0].startMs>1500)add('opening-delay','hook',0,words[0].startMs,'La première parole transcrite arrive après 1,5 seconde.','Un temps sans parole au début peut retarder la proposition ; le visuel peut toutefois le justifier.','Écoutez ce début, puis raccourcissez-le seulement si aucun élément narratif utile ne le remplit.','Comparer le début avant/après avec une personne de votre audience.',quote(words.slice(0,6)));
 const openingMarker=opening.some(w=>/^(comment|pourquoi|voici|imagine|decouvre|arrete)\b/.test(normalize(w.text)))||quote(opening).includes('?');
 const tail=words.filter(w=>w.startMs>=Math.max(0,duration-8000));
 const cta=tail.filter(w=>/^(abonne|abonnez|enregistre|enregistrez|partage|partagez|commente|commentez|clique|cliquez|contacte|contactez|essaie|essayez|telecharge|telechargez)\b/.test(normalize(w.text)));
 if(words.length&&!cta.length)add('cta-marker-absent','cta',Math.max(0,duration-8000),duration,'Aucun des marqueurs d’action recherchés n’apparaît dans les huit dernières secondes transcrites.','Ce constat lexical ne prouve pas l’absence de CTA : un appel peut être formulé autrement ou être visuel.','Vérifiez cette fin ; si une action est souhaitée, formulez une seule prochaine étape cohérente avec votre objectif.','Faire reformuler la prochaine action par un lecteur sans lui expliquer votre intention.',quote(tail));
 if(cta.length)add('cta-marker-found','cta',cta[0].startMs,cta.at(-1).endMs,'Un marqueur d’action explicite est présent dans la fin transcrite.','Sa présence ne garantit pas sa pertinence ni son efficacité.','Vérifiez que cette action correspond à votre objectif et reste unique.','Demander à un lecteur ce qu’il ferait après la vidéo.',quote(cta));
 let sentence=[];const longSentences=[];
 for(const w of words){sentence.push(w);if(/[.!?]$/.test(w.text)){if(sentence.length>35)longSentences.push(sentence);sentence=[];}}
 if(sentence.length>35)longSentences.push(sentence);
 for(const [index,group] of longSentences.entries())add('long-sentence-'+index,'clarity',group[0].startMs,group.at(-1).endMs,`Une phrase transcrite contient ${group.length} entrées.`,"Les phrases longues peuvent demander plus d'effort ; la ponctuation ASR peut aussi être incorrecte.",'Vérifiez la ponctuation à l’écoute, puis séparez les idées seulement si cela clarifie le propos.','Comparer la compréhension du message par une personne avant et après la modification.',quote(group));
 const fillers=words.filter(w=>/^(euh|heu|hum)$/.test(normalize(w.text).replace(/[^a-z]/g,'')));
 if(fillers.length>=3)add('filler-repetitions','clarity',fillers[0].startMs,fillers.at(-1).endMs,`${fillers.length} hésitations lexicales sont transcrites.`,'Une répétition peut ralentir la lecture ; certaines hésitations rendent le propos naturel.','Écoutez uniquement ces moments et conservez celles qui servent le ton.','Réécouter les raccords : aucun phonème adjacent ne doit disparaître.',quote(fillers));
 const wpm=words.length?Math.round(words.length/(duration/60000)):null;
 if(wpm!==null&&(wpm>210||wpm<80))add('speech-density','rhythm',words[0].startMs,words.at(-1).endMs,`Densité transcrite : ${wpm} entrées par minute de vidéo.`,"Ce débit approximatif dépend des pauses et des groupes ASR ; il ne mesure pas l'intonation ni la rétention.",'Écouter les passages denses ou espacés et vérifier si le public cible peut suivre.','Faire résumer le contenu sans pause ; ne modifier le rythme que si la compréhension pose problème.',String(wpm));
 for(const [i,pause] of (report.suggestions||[]).entries())add('measured-pause-'+i,'rhythm',pause.startMs,pause.endMs,'Pause acoustique à écouter.','Le signal passe sous −35 dBFS ; une voix faible reste possible.','Utiliser la sélection des pauses de Montage après écoute.','Réécouter les mots voisins et comparer la durée exportée.',`${pause.endMs-pause.startMs} ms`,'measured');
 if(report.meanVolumeDb!==null&&report.meanVolumeDb< -25)add('quiet-audio','audio',0,duration,'Niveau audio moyen faible.',`Mesure FFmpeg : ${report.meanVolumeDb} dBFS. Ce niveau ne mesure pas l’intelligibilité.`,"Comparer la voix à volume d'écoute constant ; ne pas ajouter de doublage.",'Réécouter sur haut-parleur de téléphone et casque.',String(report.meanVolumeDb),'measured');
 if(report.peakVolumeDb!==null&&report.peakVolumeDb>=-.1)add('peak-headroom','audio',0,duration,'Pic proche du plafond numérique.',`Pic mesuré : ${report.peakVolumeDb} dBFS ; cela ne prouve pas une saturation audible.`,'Écouter les passages forts avant toute correction de niveau.','Comparer la présence de distorsion à volume constant.',String(report.peakVolumeDb),'measured');
 const uncertain=words.map((w,index)=>({...w,index})).filter(w=>w.uncertain);
 const connectors=words.filter(w=>/^(ensuite|enfin|premierement|deuxiemement|donc|mais|puis)\b/.test(normalize(w.text)));
 const criteria={
  hook:{status:words.length?'textual_indicator':'not_evaluable',score:null,observation:words.length?`Ouverture transcrite : « ${quote(opening)} ». Marqueur interrogatif/promesse recherché : ${openingMarker?'repéré':'non repéré'}.`:'Transcription locale indisponible.',limit:"La force de la promesse et l’adéquation à l’audience ne sont pas validées automatiquement."},
  clarity:{status:words.length?'textual_indicator':'not_evaluable',score:null,observation:`${longSentences.length} phrase(s) longue(s), ${fillers.length} hésitation(s) repérées.`,limit:'Ce sont des repères lexicaux, pas une certification de clarté du sens.'},
  structure:{status:words.length?'textual_indicator':'not_evaluable',score:null,observation:`${connectors.length} connecteur(s) recherché(s) repéré(s).`,limit:'Aucun jugement automatique introduction/développement/conclusion : un récit peut être structuré sans ces mots.'},
  rhythm:{status:'measured',score:null,observation:`${wpm??'Non disponible'} entrées transcrites/minute ; ${(report.suggestions||[]).length} pause(s) proposée(s).`,limit:'Débit approximatif ; ni intonation ni rétention réelle mesurées.'},
  retention:{status:'not_evaluable',score:null,observation:'Aucune donnée de visionnage ou de rétention réelle fournie.',limit:'Le potentiel dépend du contenu et de l’audience. Ces indices ne permettent pas une estimation chiffrée justifiable.'},
  captions:{status:'not_evaluable',score:null,observation:`${uncertain.length} entrée(s) de transcription à vérifier.`,limit:'Le rush importé ne fournit pas de piste de sous-titres inspectée ; contraste et lisibilité du MP4 final doivent être contrôlés visuellement.'},
  visuals:{status:'not_evaluable',score:null,observation:`Format natif ${report.metadata.width} × ${report.metadata.height}.`,limit:'Pas de compréhension automatique du décor, du visage, des compositions ou de la cohérence visuelle.'},
  audio:{status:'measured',score:report.criteria?.voiceLevel?.score??null,observation:`Moyenne ${report.meanVolumeDb??'indisponible'} dBFS ; pic ${report.peakVolumeDb??'indisponible'} dBFS.`,limit:'Score de niveau technique uniquement, pas une note de qualité de voix.'},
  cta:{status:words.length?'textual_indicator':'not_evaluable',score:null,observation:words.length?`${cta.length} marqueur(s) d’action recherché(s) dans les huit dernières secondes.`:'Transcription absente.',limit:'Une formulation différente ou un CTA visuel peut ne pas être détecté.'},
  originality:{status:'not_evaluable',score:null,observation:'Aucun corpus comparatif autorisé ni preuve d’originalité fourni.',limit:'L’originalité n’est pas déduite d’une seule vidéo.'}
 };
 const reviewItems=uncertain.map(w=>({wordIndex:w.index,startMs:w.startMs,endMs:w.endMs,text:w.text,status:'pending_human_review'}));
 findings.sort((a,b)=>a.startMs-b.startMs||a.id.localeCompare(b.id));
 const snapshot={engineVersion:EDITORIAL_VERSION,acousticVersion:report.engineVersion,asrVersion:transcript?.engineVersion??null,modelSha256:transcript?.modelSha256??null,fingerprint:report.fingerprint,goal,words,criteria,findings};
 return {engineVersion:EDITORIAL_VERSION,inputHash:createHash('sha256').update(JSON.stringify(snapshot)).digest('hex'),fingerprint:report.fingerprint,criteria,findings,reviewItems,transcriptProvisional:provisional,globalEditorialScore:null,cost:{externalPaidCalls:0,execution:'local_cpu',electricityAndHardwareCost:'not_measured'},notice:'Indicateurs locaux déterministes, sans modèle de compréhension du sens ni service externe. Les citations ASR restent provisoires tant que les paroles ne sont pas relues.'};
}
