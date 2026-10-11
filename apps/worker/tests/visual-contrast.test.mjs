import test from 'node:test';
import assert from 'node:assert/strict';
import {toneFromMeanLuma,applyAutomaticTextContrast} from '../src/visual-contrast.js';
test('light background chooses dark editorial type',()=>assert.equal(toneFromMeanLuma(188),'dark'));
test('dark background chooses light editorial type',()=>assert.equal(toneFromMeanLuma(85),'light'));
test('unknown luma chooses high-contrast fallback',()=>assert.equal(toneFromMeanLuma(null),'light'));
test('empty graphics no-op',async()=>{await applyAutomaticTextContrast({sourcePath:'missing',timeline:{graphicCues:[]},width:512,height:910})});
