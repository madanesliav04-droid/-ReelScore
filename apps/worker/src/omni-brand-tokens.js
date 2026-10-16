/**
 * OMNI official visual reference extracted from the user-provided logo screenshot
 * dated 2026-10-15. Screenshot colors are approximate due to JPEG compression.
 * Logo is metallic/chrome with blue–lavender iridescence on a clean white ground.
 * Use these as an editable starting palette, not a certified Pantone/brand manual.
 * This does NOT grant permission to overlay OMNI lettering on creator videos.
 */
export const OMNI_LOGO_REFERENCE_VERSION='omni-logo-screenshot-20261015-v1';
export const OMNI_BRAND_TOKENS=Object.freeze({
  pearlWhite:'#FEFEFE',
  softWhite:'#F8FAFF',
  chromeLight:'#C1CDEE',
  chromeMid:'#AEB7D5',
  chromeShade:'#8592B5',
  deepChrome:'#59668B',
  iridescentBlue:'#7D91DD',
  iridescentGlow:'#9DB1EC',
  slateNavy:'#1B2234' // accessibility-support dark, not sampled from logo
});
export const OMNI_BRAND_MOTION=Object.freeze({
  timingSource:'verified_spoken_word_event',
  appearance:'progressive_reveal_then_soft_spring',
  durationsMs:{min:90,preferred:170,max:230},
  noDecorativeIridescentGradient:true,
  logoOverlayByDefault:false,
  brandWordmarkOverlayByDefault:false,
  editorialAssetsMustBeOriginal:true,
  pixelSafetyAndWordAlignmentRequired:true
});
export function omniBrandScene({lightBackground=false}={}){
 const t=OMNI_BRAND_TOKENS;
 return lightBackground
   ?Object.freeze({surface:t.pearlWhite,text:t.slateNavy,accent:t.iridescentBlue,
      secondary:t.deepChrome,border:t.chromeMid,glow:t.iridescentGlow})
   :Object.freeze({surface:t.slateNavy,text:t.softWhite,accent:t.chromeLight,
      secondary:t.iridescentGlow,border:t.chromeShade,glow:t.iridescentBlue});
}
