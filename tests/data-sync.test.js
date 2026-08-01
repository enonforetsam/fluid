'use strict';
/* The highest-value test in the suite. The API's registry (worker-data.js) is GENERATED
   from index.html by fluid-core/build.mjs; worker.js only imports it. When the committed
   copy goes stale, share links, OG images and the public API quietly return the WRONG
   render — no error, just wrong. These tests re-run the extraction in memory, compare it
   to the committed file, and check the emitted registry against the studio's own markup
   (an independent path, so a bug in the extractor cannot vouch for itself). */
const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const indexSrc = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const workerSrc = fs.readFileSync(path.join(ROOT, 'worker.js'), 'utf8');
const dataSrc = fs.readFileSync(path.join(ROOT, 'worker-data.js'), 'utf8');

/* Evaluate the literal assigned to `var NAME = <literal>;` / `export const NAME = …`.
   Scans to the depth-0 semicolon (respecting strings) so nested braces/brackets don't
   fool it. Text, not import(), so the test reads exactly the committed bytes. */
function extractAssign(src, name) {
  const re = new RegExp('(?:var|export const)\\s+' + name + '\\s*=', 'g');
  const m = re.exec(src);
  if (!m) throw new Error('could not find `' + name + '` in source');
  let i = m.index + m[0].length;
  while (/\s/.test(src[i])) i++;
  const start = i;
  let depth = 0, q = null;
  for (; i < src.length; i++) {
    const c = src[i];
    if (q) { if (c === '\\') { i++; continue; } if (c === q) q = null; continue; }
    if (c === '"' || c === "'" || c === '`') { q = c; continue; }
    if (c === '{' || c === '[' || c === '(') depth++;
    else if (c === '}' || c === ']' || c === ')') depth--;
    else if (c === ';' && depth === 0) break;
  }
  return (new Function('return (' + src.slice(start, i) + ')'))();
}

/* The app's real source of truth for fields/screens/palettes: the control buttons. */
function buttonNames(attr) {
  const re = new RegExp('data-' + attr + '="(\\d+)"[^>]*?(?:title|aria-label)="([^"]+)"', 'g');
  const out = [];
  let m;
  while ((m = re.exec(indexSrc))) out[parseInt(m[1], 10)] = m[2];
  return out;
}

describe('app <-> worker data sync', () => {
  it('worker-data.js is freshly generated from index.html (no drift)', async () => {
    const { emitWorkerData } = await import('../fluid-core/build.mjs');
    assert.strictEqual(dataSrc, emitWorkerData(),
      'worker-data.js is stale — run: node fluid-core/build.mjs');
  });

  it('worker.js hand-declares no registry of its own', () => {
    for (const name of ['FIELDS', 'SCREENS', 'FINISHES', 'LENSES', 'PALETTES', 'PRESETS', 'LOOKS']) {
      assert.ok(!new RegExp('var\\s+' + name + '\\s*=').test(workerSrc),
        name + ' is declared in worker.js — it must be imported from worker-data.js');
      assert.ok(new RegExp('\\b' + name + '\\b').test(workerSrc), name + ' is not used by worker.js');
    }
    assert.match(workerSrc, /import \{[^}]+\} from '\.\/worker-data\.js';/,
      'worker.js must import its registry from ./worker-data.js');
  });

  it('LOOKS match (field index + p[] params), in order', () => {
    const wLooks = extractAssign(dataSrc, 'LOOKS');     // object: { borealis: {field,p}, ... }
    const iLooks = extractAssign(indexSrc, 'LOOKS');    // array:  [ {label,field,p}, ... ]
    const wKeys = Object.keys(wLooks);
    assert.strictEqual(wKeys.length, iLooks.length,
      `look count drift: worker ${wKeys.length} vs index ${iLooks.length}`);
    for (let i = 0; i < wKeys.length; i++) {
      const label = iLooks[i].label || ('#' + i);
      const w = wLooks[wKeys[i]];
      assert.strictEqual(wKeys[i], label.toLowerCase(), `look #${i} name drift`);
      assert.strictEqual(w.field, iLooks[i].field, `look "${label}" field drift`);
      assert.deepStrictEqual(w.p, iLooks[i].p, `look "${label}" p[] drift`);
      assert.strictEqual(w.lens, iLooks[i].lens, `look "${label}" lens drift`);
      assert.deepStrictEqual(w.cols, iLooks[i].cols, `look "${label}" cols drift`);
      assert.strictEqual(w.screen, iLooks[i].screen, `look "${label}" screen drift`);
      assert.strictEqual(w.material, iLooks[i].material, `look "${label}" material drift`);
      assert.strictEqual(w.thresh, iLooks[i].thresh, `look "${label}" thresh drift`);
    }
  });

  it('LENSES match across worker-data, fluid-core mount, and the lens buttons', () => {
    const wLenses = extractAssign(dataSrc, 'LENSES');
    const mountSrc = fs.readFileSync(path.join(ROOT, 'fluid-core', 'src', 'mount.js'), 'utf8');
    const mm = /const LENSES = (\[[^\]]+\])/.exec(mountSrc);
    assert.ok(mm, 'LENSES array not found in fluid-core/src/mount.js');
    const cLenses = (new Function('return (' + mm[1] + ')'))();
    assert.deepStrictEqual(cLenses, wLenses, 'LENSES drift: fluid-core mount vs worker');
    /* the studio's picker: data-lens indices must be exactly 0..LENSES-1, contiguous */
    const idx = [];
    const re = /data-lens="(\d+)"/g;
    let m;
    while ((m = re.exec(indexSrc))) idx.push(parseInt(m[1], 10));
    idx.sort((a, b) => a - b);
    assert.deepStrictEqual(idx, wLenses.map((_, i) => i),
      `lens buttons drift: studio has [${idx}] vs worker's ${wLenses.length} lenses`);
  });

  it('FIELDS match the field buttons', () => {
    const w = extractAssign(dataSrc, 'FIELDS');
    const i = buttonNames('field');
    assert.strictEqual(w.length, i.length, `field count: worker ${w.length} vs buttons ${i.length}`);
    w.forEach((name, k) => assert.strictEqual(name.toLowerCase(), (i[k] || '').toLowerCase(), `field #${k}`));
  });

  it('SCREENS match the screen buttons', () => {
    const w = extractAssign(dataSrc, 'SCREENS');
    const i = buttonNames('screen');
    assert.strictEqual(w.length, i.length, `screen count: worker ${w.length} vs buttons ${i.length}`);
    w.forEach((name, k) => assert.strictEqual(name.toLowerCase(), (i[k] || '').toLowerCase(), `screen #${k}`));
  });

  it('PALETTES match the named palette buttons (0..N)', () => {
    const w = extractAssign(dataSrc, 'PALETTES');
    const named = buttonNames('pal').slice(0, w.length); // button N is the custom slot, excluded
    assert.strictEqual(w.length, named.length, `palette count: worker ${w.length} vs buttons ${named.length}`);
    w.forEach((name, k) => assert.strictEqual(name.toLowerCase(), (named[k] || '').toLowerCase(), `palette #${k}`));
  });

  it('FINISHES match the material buttons', () => {
    const w = extractAssign(dataSrc, 'FINISHES');
    const idx = [];
    const re = /data-material="(\d+)"[^>]*><span>([^<]+)<\/span>/g;
    let m;
    while ((m = re.exec(indexSrc))) idx[parseInt(m[1], 10)] = m[2].toLowerCase();
    assert.deepStrictEqual(w, idx, 'finish drift: worker vs the studio material buttons');
  });
});
