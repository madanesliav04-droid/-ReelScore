import test from 'node:test';
import assert from 'node:assert/strict';
import {OMNI_BRAND_TOKENS,OMNI_BRAND_MOTION,OMNI_LOGO_REFERENCE_VERSION,omniBrandScene} from '../src/omni-brand-tokens.js';
import {HORMOZI_OMNI_PALETTE} from '../src/hormozi-omni-director.js';
import {renderHormoziOmniAss} from '../src/hormozi-omni-render.js';
test('the brand palette uses the submitted chrome/iridescent logo reference, not arbitrary neon',()=>{
 assert.equal(OMNI_LOGO_REFERENCE_VERSION,'omni-logo-screenshot-20261015-v1');
 assert.equal(OMNI_BRAND_TOKENS.pearlWhite,'#FEFEFE');
 assert.equal(OMNI_BRAND_TOKENS.chromeLight,'#C1CDEE');
 assert.equal(OMNI_BRAND_TOKENS.iridescentBlue,'#7D91DD');
 assert.equal(HORMOZI_OMNI_PALETTE.cyan,OMNI_BRAND_TOKENS.iridescentBlue);
 assert.equal(HORMOZI_OMNI_PALETTE.violet,OMNI_BRAND_TOKENS.iridescentGlow);
 assert.notEqual(HORMOZI_OMNI_PALETTE.cyan,'#76D7FF');
});
test('dark and light surfaces preserve ink contrast without superfluous gradients',()=>{
 const dark=omniBrandScene(),light=omniBrandScene({lightBackground:true});
 assert.equal(light.surface,OMNI_BRAND_TOKENS.pearlWhite);
 assert.equal(dark.accent,OMNI_BRAND_TOKENS.chromeLight);
 assert.notEqual(dark.text,dark.surface);
 assert.notEqual(light.text,light.surface);
 assert.equal(OMNI_BRAND_MOTION.brandWordmarkOverlayByDefault,false);
 assert.equal(OMNI_BRAND_MOTION.logoOverlayByDefault,false);
 assert.equal(OMNI_BRAND_MOTION.noDecorativeIridescentGradient,true);
});
test('actual subtitle graphics use palette tokens but never add the OMNI wordmark',()=>{
 const ass=renderHormoziOmniAss({graphicCues:[{mode:'hormozi_omni',type:'metric',startMs:1300,endMs:2500,text:'250'}]},910,512);
 assert.ok(ass.includes('&H00')&&ass.includes('250'));
 assert.ok(!ass.includes('OMNI'));
 assert.ok(!ass.includes('76D7FF')&&!ass.includes('A58BFF'));
});
