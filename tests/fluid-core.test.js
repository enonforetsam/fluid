/* fluid-core drift guard + shape checks.
 *
 * The package's src/generated/ files are emitted from index.html + worker.js by
 * fluid-core/build.mjs. These tests re-run the extraction in memory and fail if
 * the committed files differ — so an engine/palette/look change in the studio
 * without `node fluid-core/build.mjs` cannot land.
 */
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const GEN = path.join(ROOT, 'fluid-core', 'src', 'generated');

test('fluid-core generated files match the studio (no drift)', async () => {
  const { emitShader, emitData } = await import('../fluid-core/build.mjs');
  const shader = fs.readFileSync(path.join(GEN, 'shader.js'), 'utf8');
  const data = fs.readFileSync(path.join(GEN, 'data.js'), 'utf8');
  assert.strictEqual(shader, emitShader(),
    'fluid-core/src/generated/shader.js is stale — run: node fluid-core/build.mjs');
  assert.strictEqual(data, emitData(),
    'fluid-core/src/generated/data.js is stale — run: node fluid-core/build.mjs');
});

test('fluid-core registry shape', async () => {
  const data = await import('../fluid-core/src/generated/data.js');
  assert.strictEqual(data.FIELDS.length, 23, 'expected 23 field engines');
  assert.strictEqual(data.FIELDS[0], 'noise');
  assert.strictEqual(data.FIELDS[21], 'cassini');
  assert.strictEqual(data.FIELD_TUNE.length, data.FIELDS.length, 'FIELD_TUNE covers every engine');
  assert.strictEqual(data.PALETTES.length, 8, 'expected 8 palette slugs (7 rgb + chrome)');
  assert.strictEqual(data.PALETTES_RGB.length, 7, 'chrome is procedural, so 7 stop sets');
  for (const p of data.PALETTES_RGB){
    assert.strictEqual(p.length, 4, 'palette has 4 stops');
    for (const stop of p){ assert.strictEqual(stop.length, 3, 'stop is RGB'); }
  }
  assert.deepStrictEqual(data.SCREENS, ['square', 'hex', 'ascii', 'dither', 'glitch']);
  assert.strictEqual(data.MATERIALS.length, 6, 'none + 5 finishes');
  assert.strictEqual(data.MATERIALS[0], 'none');
  assert.strictEqual(data.BLENDS.length, 6);
  assert.ok(data.LOOKS.length >= 25, 'curated looks present');
  for (const lk of data.LOOKS){
    assert.strictEqual(lk.p.length, 12, 'look "' + lk.label + '" has the 12 base hash values');
  }
});

test('fluid-core shader carries every engine dispatch branch', async () => {
  const { FSRC, VSRC } = await import('../fluid-core/src/generated/shader.js');
  const { FIELDS } = await import('../fluid-core/src/generated/data.js');
  assert.ok(VSRC.indexOf('a_pos') >= 0);
  for (const fn of ['fieldOf', 'blendField', 'ramp4', 'fieldSweep', 'fieldBloom']){
    assert.ok(FSRC.indexOf(fn) >= 0, 'FSRC missing ' + fn);
  }
  for (let i = 1; i < FIELDS.length; i++){
    assert.ok(FSRC.indexOf('eng == ' + i) >= 0, 'no dispatch for engine ' + i + ' (' + FIELDS[i] + ')');
  }
});
