'use strict';
/* Coverage for the text-in-living-colour feature: the controls + their a11y attributes,
   the font table, the persistence/share functions, and the decode hardening (so a stored
   or shared value can't blow up the mask or inject). */
const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const src = fs.readFileSync(path.resolve(__dirname, '..', 'index.html'), 'utf8');
const worker = fs.readFileSync(path.resolve(__dirname, '..', 'worker.js'), 'utf8');

describe('text-in-living-colour feature', () => {
  it('TEXT_FONTS has 9 entries, each with label / stack / weight', () => {
    const i = src.indexOf('var TEXT_FONTS = ');
    assert.ok(i >= 0, 'TEXT_FONTS not found');
    let j = src.indexOf('[', i), depth = 0;
    const start = j;
    for (; j < src.length; j++) { if (src[j] === '[') depth++; else if (src[j] === ']') { if (--depth === 0) break; } }
    const fonts = (new Function('return ' + src.slice(start, j + 1)))();
    assert.strictEqual(fonts.length, 9, 'expected 9 fonts');
    fonts.forEach((f, k) => {
      assert.ok(f.label, `font ${k} missing label`);
      assert.ok(f.stack, `font ${k} missing stack`);
      assert.ok(f.weight, `font ${k} missing weight`);
    });
  });

  it('the text controls exist with accessibility attributes', () => {
    assert.match(src, /id="textInput"[^>]*maxlength="\d+"/, 'textInput needs maxlength');
    assert.match(src, /id="textInput"[^>]*aria-label=/, 'textInput needs aria-label');
    assert.ok(src.includes('id="fontGrid"'), 'fontGrid missing');
    assert.ok(src.includes('id="maskBgInput"'), 'maskBgInput missing');
    assert.ok(src.includes('id="textClear"'), 'clear button missing');
    assert.match(src, /id="maskBgDark"[^>]*aria-pressed=/, 'Dark button needs aria-pressed');
  });

  it('persistence, sharing, and safe-decode helpers are present', () => {
    for (const fn of ['persistText', 'restoreTextFromStorage', 'parseTextFromHash', 'shareTextSuffix', 'applyTextState', 'maskActive']) {
      assert.ok(src.includes('function ' + fn), 'missing function ' + fn);
    }
  });

  it('applyTextState clamps text length and validates the bg hex (decode hardening)', () => {
    const i = src.indexOf('function applyTextState');
    const body = src.slice(i, i + 700);
    assert.match(body, /\.slice\(0,\s*48\)/, 'text must be clamped to 48 chars');
    assert.match(body, /\[0-9a-fA-F\]\{6\}/, 'bg must be hex-validated before use');
  });

  it('share-text params do not affect the worker (decodeLink captures only numbers)', () => {
    // /#p=([0-9.,-]+)/ stops at '&', so &t=&tf=&tb= can never reach the worker decoder
    assert.match(worker, /#p=\(\[0-9\.,-\]\+\)/, 'decodeLink must capture only the numeric hash');
  });
});
