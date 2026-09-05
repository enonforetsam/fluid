'use strict';
/* The ambient presets fluid-bg ships (and /backgrounds shows): every hash must be a piece
   the engine can render, tuned to sit behind a page — slow, soft, one accent — and the
   self-hosted copy of the build at assets/fluid-bg.iife.js (served as /fluid-bg.js) must be
   the build, not a stale one: a preset added in src that never reached assets/ is a
   404-shaped bug on the page that advertises it. */
const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const ROOT = path.resolve(__dirname, '..');
const src = fs.readFileSync(path.join(ROOT, 'fluid-bg', 'src', 'presets.ts'), 'utf8');

/* the TS module is data; read it without a compiler */
function presetsFromSource() {
  const out = {};
  const re = /^\s*(\w+):\s*\{ hash: "([^"]+)", colors: \[([^\]]+)\], tone: "(dark|light)", tip: "([^"]+)" \}/gm;
  let m;
  while ((m = re.exec(src))) {
    out[m[1]] = { hash: m[2], colors: m[3].split(',').map((c) => c.trim().replace(/"/g, '')), tone: m[4], tip: m[5] };
  }
  return out;
}

describe('fluid-bg ambient presets', () => {
  const P = presetsFromSource();
  const names = Object.keys(P);

  it('there are ten, dark bases first, every name lowercase', () => {
    assert.strictEqual(names.length, 10, names.join(','));
    for (const n of names) assert.match(n, /^[a-z]+$/);
    const tones = names.map((n) => P[n].tone);
    assert.strictEqual(tones.indexOf('light'), tones.lastIndexOf('dark') + 1, 'dark first, then light, no interleaving');
  });

  it('every hash parses through fluid-core and is ambient: slow, low warp, little grain, custom stops', async () => {
    const { parseShareHash } = await import(pathToFileURL(path.join(ROOT, 'fluid-core', 'src', 'hash.js')).href);
    for (const n of names) {
      const p = parseShareHash(P[n].hash);
      assert.ok(p, n + ' must parse');
      assert.ok(p.speed > 0 && p.speed <= 0.15, n + ' speed ' + p.speed);
      assert.ok(p.warp <= 3, n + ' warp ' + p.warp);
      assert.ok(p.grain <= 0.03, n + ' grain ' + p.grain);
      assert.ok(p.zoom >= 0.8 && p.zoom <= 1.1, n + ' zoom ' + p.zoom);
      assert.strictEqual(p.pixel, 1, n + ' no pixelation');
      assert.strictEqual(p.dots, 0, n + ' no halftone');
      assert.ok(Array.isArray(p.colors) && p.colors.length === 4, n + ' four custom stops');
      assert.deepStrictEqual(p.colors, P[n].colors, n + ': the stops restated in `colors` must be the ones in the hash');
      assert.ok(!p.layer, n + ' single layer');
    }
  });

  it('the light presets start light and the dark ones start dark', () => {
    const lum = (hex) => { const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
    for (const n of names) {
      const first = lum(P[n].colors[0]);
      if (P[n].tone === 'dark') assert.ok(first < 0.08, n + ' base ' + first);
      else assert.ok(first > 0.85, n + ' base ' + first);
    }
  });

  it('the self-hosted build in assets/ is the current build and carries every preset', () => {
    const dist = path.join(ROOT, 'fluid-bg', 'dist', 'fluid-bg.iife.js');
    const asset = path.join(ROOT, 'assets', 'fluid-bg.iife.js');
    assert.ok(fs.existsSync(asset), 'assets/fluid-bg.iife.js is missing — run `npm run build` in fluid-bg/');
    const a = fs.readFileSync(asset, 'utf8');
    if (fs.existsSync(dist)) assert.strictEqual(a, fs.readFileSync(dist, 'utf8'), 'assets/ copy drifted from dist/ — rebuild fluid-bg');
    for (const n of names) assert.ok(a.includes(P[n].hash), n + ' hash must be in the served build');
    for (const attr of ['preset', 'blur', 'dim', 'dim-color']) assert.ok(a.includes('"' + attr + '"'), 'observed attribute ' + attr);
  });

  it('the backgrounds page loads the served build and names only real presets', () => {
    const html = fs.readFileSync(path.join(ROOT, 'backgrounds.html'), 'utf8');
    assert.ok(html.includes('<script src="assets/fluid-bg.iife.js"></script>'));
    const used = [...html.matchAll(/preset="([a-z]+)"/g)].map((m) => m[1]);
    assert.ok(used.length >= 1);
    for (const u of used) assert.ok(P[u], 'unknown preset in page: ' + u);
    assert.ok(html.includes('https://befluid.xyz/fluid-bg.js'), 'the snippet points at the self-hosted script');
    assert.ok(/html,\s*body\s*\{\s*background:\s*transparent\s*\}/.test(html), 'the page follows its own advice');
  });
});
