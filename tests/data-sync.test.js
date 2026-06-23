'use strict';
/* The highest-value test in the suite. index.html and worker.js each carry their own
   copy of FIELDS / SCREENS / PALETTES / LOOKS. When they drift, share links, OG images
   and the public API quietly return the WRONG render — no error, just wrong. This test
   compares the two sources and fails loudly on any drift. */
const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const indexSrc = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const workerSrc = fs.readFileSync(path.join(ROOT, 'worker.js'), 'utf8');

/* Evaluate the literal assigned to `var NAME = <literal>;`. Scans to the depth-0
   semicolon (respecting strings) so nested braces/brackets don't fool it. */
function extractAssign(src, name) {
  const re = new RegExp('var\\s+' + name + '\\s*=', 'g');
  const m = re.exec(src);
  if (!m) throw new Error('could not find `var ' + name + '` in source');
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
  it('LOOKS match (field index + p[] params), in order', () => {
    const wLooks = extractAssign(workerSrc, 'LOOKS');   // object: { borealis: {field,p}, ... }
    const iLooks = extractAssign(indexSrc, 'LOOKS');    // array:  [ {label,field,p}, ... ]
    const wVals = Object.keys(wLooks).map((k) => wLooks[k]);
    assert.strictEqual(wVals.length, iLooks.length,
      `look count drift: worker ${wVals.length} vs index ${iLooks.length}`);
    for (let i = 0; i < wVals.length; i++) {
      const label = iLooks[i].label || ('#' + i);
      assert.strictEqual(wVals[i].field, iLooks[i].field, `look "${label}" field drift`);
      assert.deepStrictEqual(wVals[i].p, iLooks[i].p, `look "${label}" p[] drift`);
    }
  });

  it('FIELDS match the field buttons', () => {
    const w = extractAssign(workerSrc, 'FIELDS');
    const i = buttonNames('field');
    assert.strictEqual(w.length, i.length, `field count: worker ${w.length} vs buttons ${i.length}`);
    w.forEach((name, k) => assert.strictEqual(name.toLowerCase(), (i[k] || '').toLowerCase(), `field #${k}`));
  });

  it('SCREENS match the screen buttons', () => {
    const w = extractAssign(workerSrc, 'SCREENS');
    const i = buttonNames('screen');
    assert.strictEqual(w.length, i.length, `screen count: worker ${w.length} vs buttons ${i.length}`);
    w.forEach((name, k) => assert.strictEqual(name.toLowerCase(), (i[k] || '').toLowerCase(), `screen #${k}`));
  });

  it('PALETTES match the named palette buttons (0..N)', () => {
    const w = extractAssign(workerSrc, 'PALETTES');
    const named = buttonNames('pal').slice(0, w.length); // button N is the custom slot, excluded
    assert.strictEqual(w.length, named.length, `palette count: worker ${w.length} vs buttons ${named.length}`);
    w.forEach((name, k) => assert.strictEqual(name.toLowerCase(), (named[k] || '').toLowerCase(), `palette #${k}`));
  });
});
