/**
 * Pinterest-inspired editorial direction. This module defines visual art direction
 * only: NO retrieval, caching or processing of Pinterest content.
 */
const DIRECTIONS={
  codie:{
    style:'Premium founder documentary',
    composition:'authentic candid business scenes, clean editorial framing, natural imperfect human gestures, useful closeups and negative space',
    light:'natural window light, warm-neutral skin tones, honest contrast',
    avoid:'generic corporate stock photos, smiling posed office teams, glossy CGI, stock-photo handshakes'
  },
  impact:{
    style:'Bold dynamic creator editorial',
    composition:'dramatic macro details, punchy real-world action, bold diagonals, movement implied in still photos, very readable subject',
    light:'high contrast, striking practical lighting, saturated accents without fake neon',
    avoid:'generic futuristic illustrations, fake money graphics, irrelevant light leaks, ornamental stock'
  },
  clean:{
    style:'Minimal modern editorial',
    composition:'one precise object or action per shot, clean backgrounds, generous negative space, clear geometry, polished real-world photography',
    light:'soft diffused daylight, restrained neutral palette',
    avoid:'cluttered office stock, flashy gradients, unnecessary graphics'
  },
  authority:{
    style:'Contemporary premium documentary',
    composition:'credible locations and real subject-matter details, composed documentary photography, depth, human authenticity',
    light:'soft cinematic contrast, desaturated muted colors, subtle grain',
    avoid:'fake experts, dramatized evidence, photos pretending to document a real event'
  },
  explainer:{
    style:'Clear educational product editorial',
    composition:'legible real interfaces, devices, tools and demonstrations specifically named in speech, simple focal hierarchy',
    light:'neutral bright clarity, no filters that obscure instructional detail',
    avoid:'unrelated laptop photos, illegible screenshots, generic people at desks'
  },
  data:{
    style:'Evidence-led editorial',
    composition:'real documents, demonstrable numbers, clear product comparisons, specifically mentioned physical contexts',
    light:'neutral high clarity with restrained accents',
    avoid:'fabricated dashboards, invented charts, fake performance evidence, placeholder financial metrics'
  },
  ugc_native:{
    style:'Authentic phone-native creator',
    composition:'human handheld-feel photography, product in genuine use, home/work settings, imperfect but readable details',
    light:'real available light, believable colors, natural texture',
    avoid:'over-produced corporate images, polished ads that look inauthentic'
  },
  cinematic_story:{
    style:'Emotive indie-film story',
    composition:'observational detail shots and places that match a concrete narrated event, strong depth and meaningful atmosphere',
    light:'natural low-key cinematic lighting, rich shadows, subtle film texture',
    avoid:'meaningless sunsets, disconnected moody landscapes, clichéd drama and fake scenes posed as real footage'
  },
  editorial_breakdown:{
    style:'Business editorial explanation',
    composition:'keep facecam; evidence-led on-screen typography based only on actual spoken numbers',
    light:'restrained clean contrast',
    avoid:'automatic external B-roll'
  }
};

export function brollArtDirection(style){
  const alias={creator_clean:'clean',business_viral:'impact',podcast_authority:'authority'};
  const key=alias[style]||style;
  return DIRECTIONS[key]||DIRECTIONS.clean;
}

export function brollDirectionPrompt(style){
  const dir=brollArtDirection(style);
  return [
    'DIRECTION ARTISTIQUE — esthétique éditoriale haut de gamme inspirée de moodboards visuels (Pinterest comme référence de style, PAS une source de téléchargement):',
    'Univers: '+dir.style,
    'Cadrage / composition: '+dir.composition,
    'Lumière / couleurs: '+dir.light,
    'À éviter: '+dir.avoid,
    'Priorité absolue à la correspondance exacte avec la phrase prononcée. Une jolie image hors sujet est rejetée.',
    'Ne jamais demander de scraper, télécharger ou réutiliser une image de Pinterest. Les ressources doivent provenir de sources autorisées séparément.'
  ].join('\n');
}
