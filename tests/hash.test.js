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

/* `var NAME = <number>;` — parseHash clamps engine ids against FIELD_MAX and lens ids against
   LENS_MAX, and both have to be literals because this sandbox has no DOM to count the pickers
   with. Each is pinned to its picker by a test below, which is what keeps the literal honest. */
function extractNumber(name) {
  const m = new RegExp('var\\s+' + name + '\\s*=\\s*(-?\\d+(?:\\.\\d+)?)\\s*;').exec(src);
  if (!m) throw new Error('numeric var not found: ' + name);
  return Number(m[1]);
}
const FIELD_MAX = extractNumber('FIELD_MAX');
const LENS_MAX = extractNumber('LENS_MAX');

function makeCtx() {
  const sandbox = {
    PRESETS: [], activePresetId: null, pendingPreset: 0, EMBED: false,
    FIELD_MAX, LENS_MAX,
    Math, parseFloat, parseInt, isNaN, String, Number,
    window: { location: { hash: '' } },
    state: {}
  };
  vm.createContext(sandbox);
  vm.runInContext('var PALETTES_RGB = ' + extractArrayLiteral('PALETTES_RGB') + ';', sandbox);
  ['cloneStops', 'packCol', 'unpackCol', 'buildHash', 'parseHash'].forEach((fn) => vm.runInContext(extractFn(fn), sandbox));
  return sandbox;
}

const BASE = { speed: 0.75, scale: 1.8, warp: 3.9, grain: 0.3, pixel: 15, dot: 13, dots: 1, pal: 4, seed: 37.14, liq: 0.8, mix: 0.85, ar: 1.7778, field: 0, screen: 0, sym: 0, field2: 0, blend: 0, layerMix: 0, field3: 0, blend2: 0, layerMix2: 0, material: 0, lens: 0, lensAmt: 1, panX: 0, panY: 0, thresh: 0.5, cols: null };

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

  it('every field index 0..22 round-trips (incl. stitch, pursuit, chladni, cassini + topo)', () => {
    for (let f = 0; f <= 22; f++) assert.strictEqual(roundtrip({ field: f }).after.field, f, 'field ' + f);
  });

  it('symmetry (kaleido fold) round-trips via the reserved slot [18]', () => {
    for (const sym of [0, 2, 6, 8, 12]) {
      assert.strictEqual(roundtrip({ field: 11, sym }).after.sym, sym, 'sym ' + sym);
    }
    // sym=0 is the default and must trim away (no hash bloat for the common case)
    assert.ok(roundtrip({ sym: 0 }).hash.split(',').length <= 16, 'sym=0 must not pad the hash');
  });

  it('Layers (2nd engine / blend / mix) round-trip via slots [25-27]', () => {
    const { after } = roundtrip({ field2: 7, blend: 2, layerMix: 0.5 });
    assert.strictEqual(after.field2, 7, 'field2 (2nd engine)');
    assert.strictEqual(after.blend, 2, 'blend mode');
    assert.ok(Math.abs(after.layerMix - 0.5) < 0.011, 'layerMix drifted: ' + after.layerMix);
    // no layer (mix 0) must trim away — no hash bloat for the common single-engine case
    assert.ok(roundtrip({ layerMix: 0 }).hash.split(',').length <= 16, 'mix=0 must not pad the hash');
  });

  it('Layer 3 (3rd engine / blend / mix) round-trips via slots [31-33]', () => {
    const { after } = roundtrip({ field2: 7, blend: 2, layerMix: 0.5, field3: 11, blend2: 4, layerMix2: 0.3 });
    assert.strictEqual(after.field3, 11, 'field3 (3rd engine)');
    assert.strictEqual(after.blend2, 4, '3rd engine blend mode');
    assert.ok(Math.abs(after.layerMix2 - 0.3) < 0.011, 'layerMix2 drifted: ' + after.layerMix2);
    /* layer 2 must survive being written before the lens block that layer 3 sits past */
    assert.strictEqual(after.field2, 7, 'layer 2 engine was lost when layer 3 was written');
    assert.ok(Math.abs(after.layerMix - 0.5) < 0.011, 'layer 2 mix drifted');
  });

  it('Layer 3 survives a lens, which lives in the slots between them', () => {
    const { after } = roundtrip({
      field2: 3, blend: 1, layerMix: 0.6, field3: 9, blend2: 5, layerMix2: 0.8, lens: 6, lensAmt: 0.42
    });
    assert.strictEqual(after.lens, 6, 'lens');
    assert.ok(Math.abs(after.lensAmt - 0.42) < 0.011, 'lens amount drifted');
    assert.strictEqual(after.field3, 9, 'layer 3 engine');
    assert.ok(Math.abs(after.layerMix2 - 0.8) < 0.011, 'layer 3 mix drifted');
  });

  it('a 3rd layer without a 2nd decodes as no 3rd layer, not a reordered stack', () => {
    /* the shader blends each layer onto everything under it, so a gap is not a real state.
       A hand-edited or truncated link must degrade to the piece it can actually describe. */
    const { after, hash } = roundtrip({ field3: 9, blend2: 3, layerMix2: 0.7, layerMix: 0 });
    assert.strictEqual(after.layerMix2, 0, 'layer 3 rode along without a layer 2');
    assert.ok(hash.split(',').length <= 16, 'an inactive stack must not pad the hash');
  });

  it('a single-engine piece still trims to a short hash', () => {
    assert.ok(roundtrip({ layerMix: 0, layerMix2: 0 }).hash.split(',').length <= 16,
      'the common no-layers case must not carry empty layer slots');
  });

  it('a 3-layer piece with no lens keeps lensAmt at full, not 0', () => {
    /* Slot [30] is the only slot whose absent-default is 1. Layer 3 lives past it at [31-33],
       so writing layer 3 forces [29][30] to exist — and zero-filling them encoded lensAmt 0
       on every lens-less 3-layer piece. Nothing renders wrong (the shader gates on lens > 0),
       which is exactly why this needs a test rather than an eyeball. */
    const { after, hash } = roundtrip({ field2: 5, blend: 2, layerMix: 0.5, field3: 9, blend2: 3, layerMix2: 0.4, lens: 0 });
    assert.strictEqual(after.lens, 0, 'no lens');
    assert.strictEqual(after.lensAmt, 1, `lensAmt decoded as ${after.lensAmt} — slot [30] was zero-filled: ${hash}`);
    assert.strictEqual(after.field3, 9, 'layer 3 still round-trips');
    assert.ok(Math.abs(after.layerMix2 - 0.4) < 0.011, 'layer 3 mix still round-trips');
  });

  it('FIELD_MAX matches the highest engine in the picker', () => {
    /* parseHash clamps engine ids to FIELD_MAX. If a new engine is added to the markup and
       this literal is not bumped, every share link carrying it silently decodes as the wrong
       engine — exactly how Topo went missing from the layer dropdown. */
    const ids = [...src.matchAll(/data-field="(\d+)"/g)].map((m) => Number(m[1]));
    const highest = Math.max(...ids);
    assert.strictEqual(FIELD_MAX, highest,
      `FIELD_MAX is ${FIELD_MAX} but the picker's highest engine is ${highest} — bump the literal in index.html`);
  });

  it('LENS_MAX matches the highest lens in the picker', () => {
    /* The same failure, one control over, and it had already happened three times in
       miniature: the lens count was written out as a literal 12 in the hash clamp, the
       shuffle roll and fluid-core's decoder, so a 14th lens would have decoded as Modular,
       never been shuffled into a piece, and changed shape in every embed. */
    const ids = [...src.matchAll(/data-lens="(\d+)"/g)].map((m) => Number(m[1]));
    const highest = Math.max(...ids);
    assert.strictEqual(LENS_MAX, highest,
      `LENS_MAX is ${LENS_MAX} but the picker's highest lens is ${highest} — bump the literal in index.html`);
  });

  it('every lens has a status line', () => {
    /* LENS_STATUS is indexed by lens id, so a lens added without one hands setStatus
       undefined — the readout goes blank or literally says "undefined", and that line is the
       only place a lens explains what it does. Ground shipped that way. */
    const m = /var LENS_STATUS = \[([\s\S]*?)\n\];/.exec(src);
    assert.ok(m, 'LENS_STATUS has moved or been renamed');
    const entries = m[1].split('\n').filter((l) => /^\s*'/.test(l)).length;
    assert.strictEqual(entries, LENS_MAX + 1,
      `LENS_STATUS has ${entries} lines for ${LENS_MAX + 1} lenses (ids 0..${LENS_MAX})`);
  });

  it('every screen 0..3 round-trips', () => {
    for (let s = 0; s <= 4; s++) assert.strictEqual(roundtrip({ screen: s }).after.screen, s, 'screen ' + s);
  });

  it('every material finish 0..6 round-trips via slot [28]', () => {
    for (let m = 0; m <= 6; m++) assert.strictEqual(roundtrip({ material: m }).after.material, m, 'material ' + m);
    // no finish (material 0) is the default and must trim away — no hash bloat
    assert.ok(roundtrip({ material: 0 }).hash.split(',').length <= 16, 'material=0 must not pad the hash');
  });

  it('every math lens 0..LENS_MAX round-trips via slots [29][30]', () => {
    for (let l = 0; l <= LENS_MAX; l++) assert.strictEqual(roundtrip({ lens: l }).after.lens, l, 'lens ' + l);
    assert.strictEqual(roundtrip({ lens: 4, lensAmt: 0.65 }).after.lensAmt, 0.65, 'amount survives the ×100 encoding');
    // no lens (or amount 0 = identity) is the default and must trim away — no hash bloat
    assert.ok(roundtrip({ lens: 0 }).hash.split(',').length <= 16, 'lens=0 must not pad the hash');
    assert.ok(roundtrip({ lens: 3, lensAmt: 0 }).hash.split(',').length <= 16, 'amount 0 is identity — writes nothing');
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
