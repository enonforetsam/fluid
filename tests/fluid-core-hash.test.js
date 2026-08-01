/* parseShareHash: studio share links -> createFluid params.
 * The #p= contract is append-only (README invariant); these tests pin the
 * decoder to real hashes from README.md / gallery plus edge cases.
 */
const { test } = require('node:test');
const assert = require('node:assert');

test('parseShareHash decodes a README gallery hash', async () => {
  const { parseShareHash } = await import('../fluid-core/src/hash.js');
  /* "Aurora Flow" from README examples */
  const p = parseShareHash('#p=0.5,1.5,5.5,0.03,1,10,0,0,18,0,0,1.7778,0,0,1');
  assert.ok(p, 'valid hash parses');
  assert.strictEqual(p.field, 1, 'field slot [14]');
  assert.strictEqual(p.palette, 0);
  assert.strictEqual(p.speed, 0.5);
  assert.strictEqual(p.zoom, 1.5);
  assert.strictEqual(p.warp, 5.5);
  assert.strictEqual(p.seed, 18);
  assert.strictEqual(p.dots, 0);
  assert.ok(Math.abs(p.ar - 1.7778) < 1e-9);
  assert.strictEqual(p.layer, undefined, 'no layer when mix is 0');
  assert.strictEqual(p.colors, undefined, 'preset palette, no custom stops');
});

test('parseShareHash accepts full URLs and bare forms', async () => {
  const { parseShareHash } = await import('../fluid-core/src/hash.js');
  const forms = [
    'https://fluid.krackeddevs.com/#p=0.4,1.5,5,0.03,1,10,0,1,33,0,0,1,0,0,6',
    '#p=0.4,1.5,5,0.03,1,10,0,1,33,0,0,1,0,0,6',
    'p=0.4,1.5,5,0.03,1,10,0,1,33,0,0,1,0,0,6',
    '0.4,1.5,5,0.03,1,10,0,1,33,0,0,1,0,0,6'
  ];
  for (const f of forms){
    const p = parseShareHash(f);
    assert.ok(p, 'parses: ' + f);
    assert.strictEqual(p.field, 6);
    assert.strictEqual(p.palette, 1);
  }
});

test('parseShareHash rejects invalid input', async () => {
  const { parseShareHash } = await import('../fluid-core/src/hash.js');
  assert.strictEqual(parseShareHash(''), null);
  assert.strictEqual(parseShareHash('#p=1,2,3'), null, 'fewer than 12 slots');
  assert.strictEqual(parseShareHash('#p=a,b,c,d,e,f,g,h,i,j,k,l'), null, 'NaN slots');
  assert.strictEqual(parseShareHash('javascript:alert(1)'), null);
});

test('parseShareHash decodes custom colours, layer, material, thresh', async () => {
  const { parseShareHash } = await import('../fluid-core/src/hash.js');
  /* pal 8; packed stops for #040414,#0a3a7a,#0484fc,#c2dbdc at [20..23];
     thresh offset [24]; layer crystal/screen/40 at [25..27]; molten [28] */
  const pack = (hex) => {
    const h = hex.slice(1);
    return parseInt(h.slice(0, 2), 16) * 65536 + parseInt(h.slice(2, 4), 16) * 256 + parseInt(h.slice(4, 6), 16);
  };
  const cols = ['#040414', '#0a3a7a', '#0484fc', '#c2dbdc'];
  const a = [0.38, 1.3, 3.0, 0.015, 1, 10, 0, 8, 30, 0, 0, 1, 0, 0, 10, 0, 0, 0, 4, 0,
    pack(cols[0]), pack(cols[1]), pack(cols[2]), pack(cols[3]), -0.04, 11, 2, 40, 5, 4, 65];
  const p = parseShareHash('#p=' + a.join(','));
  assert.ok(p);
  assert.deepStrictEqual(p.colors, cols, 'packed stops round-trip to hex');
  assert.strictEqual(p.palette, undefined, 'custom colours replace palette');
  assert.strictEqual(p.field, 10);
  assert.strictEqual(p.sym, 4);
  assert.ok(Math.abs(p.thresh - 0.46) < 1e-9, 'thresh = 0.5 + offset');
  assert.deepStrictEqual(p.layer, { field: 11, blend: 2, mix: 0.4 });
  assert.strictEqual(p.material, 5);
  assert.strictEqual(p.lens, 4, 'math lens at slot [29]');
  assert.strictEqual(p.lensAmt, 0.65, 'lens amount at slot [30], ×100 encoded');
});

test('parseShareHash clamps out-of-range values like the studio', async () => {
  const { parseShareHash } = await import('../fluid-core/src/hash.js');
  const p = parseShareHash('#p=0.5,1.5,5,0.03,1,10,0,99,18,0,0,9,0,0,99,99,0,0,99');
  assert.ok(p);
  assert.strictEqual(p.field, 21, 'field clamped to 21');
  assert.strictEqual(p.screen, 4, 'screen clamped to 4');
  assert.strictEqual(p.sym, 12, 'sym clamped to 12');
  assert.strictEqual(p.ar, 1, 'silly aspect falls back to 1');
  assert.ok(p.colors, 'pal clamped to 8 -> custom (aurora fallback stops)');
});
