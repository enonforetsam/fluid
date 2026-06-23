'use strict';
/* The share-hash (#p=...) is the most fragile code in the app: an append-only, trailing-
   zero-trimmed numeric format that buildHash() writes and parseHash() reads, and a broken
   round-trip silently corrupts every share link. It had zero tests. This extracts the real
   buildHash/parseHash (+ their pure helpers) from index.html and runs them in a sandbox to
   assert encode->decode reproduces the state. */
const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const src = fs.readFileSync(path.resolve(__dirname, '..', 'index.html'), 'utf8');

function extractFn(name) {
  const i = src.indexOf('function ' + name + '(');
  if (i < 0) throw new Error('function not found: ' + name);
  let j = src.indexOf('{', i), depth = 0;
  for (; j < src.length; j++) {
    if (src[j] === '{') depth++;
    else if (src[j] === '}') { if (--depth === 0) return src.slice(i, j + 1); }
  }
  throw new Error('unbalanced braces: ' + name);
}
function extractArrayLiteral(name) {
  const i = src.indexOf('var ' + name + ' = ');
  if (i < 0) throw new Error('var not found: ' + name);
  let j = src.indexOf('[', i), depth = 0;
  const start = j;
  for (; j < src.length; j++) {
    if (src[j] === '[') depth++;
    else if (src[j] === ']') { if (--depth === 0) return src.slice(start, j + 1); }
  }
  throw new Error('unbalanced brackets: ' + name);
}

function makeCtx() {
  const sandbox = {
    PRESETS: [], activePresetId: null, pendingPreset: 0, EMBED: false,
    Math, parseFloat, parseInt, isNaN, String, Number,
    window: { location: { hash: '' } },
    state: {}
  };
  vm.createContext(sandbox);
  vm.runInContext('var PALETTES_RGB = ' + extractArrayLiteral('PALETTES_RGB') + ';', sandbox);
  ['cloneStops', 'packCol', 'unpackCol', 'buildHash', 'parseHash'].forEach((fn) => vm.runInContext(extractFn(fn), sandbox));
  return sandbox;
}

const BASE = { speed: 0.75, scale: 1.8, warp: 3.9, grain: 0.3, pixel: 15, dot: 13, dots: 1, pal: 4, seed: 37.14, liq: 0.8, mix: 0.85, ar: 1.7778, field: 0, screen: 0, panX: 0, panY: 0, thresh: 0.5, cols: null };

function roundtrip(overrides) {
  const enc = makeCtx();
  Object.assign(enc.state, JSON.parse(JSON.stringify(BASE)), overrides);
  enc.state.cols = enc.state.cols || vm.runInContext('cloneStops(PALETTES_RGB[0])', enc);
  const hash = vm.runInContext('buildHash(0)', enc);
  const dec = makeCtx();
  dec.state.cols = vm.runInContext('cloneStops(PALETTES_RGB[0])', dec);
  const ok = vm.runInContext('parseHash(' + JSON.stringify(hash) + ')', dec);
  assert.ok(ok, 'parseHash rejected its own buildHash output: ' + hash);
  return { hash, before: enc.state, after: dec.state };
}

describe('share-hash round-trip (buildHash <-> parseHash)', () => {
  it('default piece round-trips every numeric field', () => {
    const { before, after } = roundtrip({});
    for (const k of ['speed', 'scale', 'warp', 'grain', 'pixel', 'dot', 'dots', 'pal', 'seed', 'liq', 'mix', 'field', 'screen']) {
      assert.strictEqual(after[k], before[k], `"${k}" drifted: ${before[k]} -> ${after[k]}`);
    }
    assert.ok(Math.abs(after.ar - before.ar) < 0.001, 'ar drifted');
  });

  it('every field index 0..10 round-trips', () => {
    for (let f = 0; f <= 10; f++) assert.strictEqual(roundtrip({ field: f }).after.field, f, 'field ' + f);
  });

  it('every screen 0..3 round-trips', () => {
    for (let s = 0; s <= 3; s++) assert.strictEqual(roundtrip({ screen: s }).after.screen, s, 'screen ' + s);
  });

  it('non-default dither threshold round-trips via the trailing slot', () => {
    assert.ok(Math.abs(roundtrip({ screen: 3, thresh: 0.8 }).after.thresh - 0.8) < 0.011);
  });

  it('custom palette (pal=8) round-trips its 4 colour stops within 8-bit quantization', () => {
    const cols = [[0.1, 0.2, 0.3], [0.4, 0.5, 0.6], [0.7, 0.8, 0.9], [0.05, 0.05, 0.05]];
    const { after } = roundtrip({ pal: 8, cols });
    assert.strictEqual(after.pal, 8);
    for (let i = 0; i < 4; i++) for (let c = 0; c < 3; c++) {
      assert.ok(Math.abs(after.cols[i][c] - cols[i][c]) < 0.004, `cols[${i}][${c}] drifted`);
    }
  });

  it('a legacy 12-value link still parses (append-only format)', () => {
    const dec = makeCtx();
    dec.state.cols = vm.runInContext('cloneStops(PALETTES_RGB[0])', dec);
    assert.ok(vm.runInContext("parseHash('#p=0.6,1.6,4.5,0.06,6,10,1,0,42,0.8,0.85,1')", dec), 'legacy 12-field link must parse');
  });

  it('rejects malformed hashes', () => {
    const dec = makeCtx();
    for (const bad of ['', '#p=', '#p=1,2,3', '#x=1,2,3,4,5,6,7,8,9,10,11,12', '#p=a,b,c,d,e,f,g,h,i,j,k,l']) {
      assert.strictEqual(vm.runInContext('parseHash(' + JSON.stringify(bad) + ')', dec), false, 'should reject ' + JSON.stringify(bad));
    }
  });
});
