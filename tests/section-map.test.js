'use strict';
/* index.html is one ~6.6k-line self-contained file that can never be split into
   modules (it has to boot from file://), so its banner comments ARE the navigation.
   This test is the map's contract:

     1. SECTIONS below is the canonical ordered list of banner names. Every one must
        exist in index.html, in exactly this order — a deleted, renamed or moved
        section fails loudly by name instead of silently rotting the map.
     2. index.html must carry no banner that is NOT in the list (an unlisted section
        is invisible to anyone reading docs/MAP.md).
     3. docs/MAP.md must be freshly generated from those banners.

   Adding a section: add the banner in index.html, add its name here in file order,
   then run `node scripts/gen-map.mjs`. */
const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const ROOT = path.resolve(__dirname, '..');
const INDEX = path.join(ROOT, 'index.html');
const MAP = path.join(ROOT, 'docs', 'MAP.md');
const GEN = path.join(ROOT, 'scripts', 'gen-map.mjs');

/* the map, in file order. Anchor text = '---------- ' + name + ':' — the colon is what
   keeps 'export' from also matching 'export names'. */
const SECTIONS = [
  /* head */
  'head',
  'pre-paint boot',
  /* css */
  'root tokens',
  'layout',
  'panel chrome',
  'stage',
  'canvas chips',
  'before/after overlay',
  'docks',
  'embed mode',
  'panel sections',
  'controls',
  'buttons',
  'knobs',
  'pickers',
  'shelves and footer',
  'mobile layout',
  'panel themes',
  'per-theme materials',
  'per-theme dial rings, pucks and the aspect slider',
  /* markup */
  'stage markup',
  'panel markup',
  'Templates section',
  'Source section',
  'Size section',
  'Colours section',
  'Field section',
  'Math section',
  'Layers section',
  'Surface section',
  'Frame section',
  'Output section',
  'Text section',
  /* js: data tables and state */
  'studio script',
  'export targets',
  'built-in source library',
  'looks and palettes',
  'state',
  'shader',
  /* glsl, inside var FSRC = [ ... ] */
  'glsl helpers',
  'glsl engines 0-12',
  'glsl colour ramps',
  'glsl engines 13-21',
  'glsl dispatch',
  'glsl materials',
  'glsl main',
  'glsl lenses',
  'glsl screens',
  /* js: gl, render loop */
  'gl setup',
  'text and logo masks',
  '2D fallback',
  'sizing',
  'render',
  'cursor ripple state',
  'animation loop',
  /* js: control wiring */
  'sliders',
  'layers UI',
  'text controls',
  'logo upload',
  'mask background',
  'rotary knobs',
  'control sync',
  'toggles / palettes / aspect',
  'custom gradient',
  'field picker',
  'picker strips',
  'theme picker',
  'math lens UI',
  'cursor impact',
  'aspect ratio',
  'shuffle',
  'canvas pointer',
  /* js: sources */
  'preset shelf',
  'user sources',
  'looks shelf',
  'own photo',
  'camera',
  'before/after split',
  'clear',
  'source disclosure',
  'mobile panel sheet',
  /* js: sharing and persistence */
  'share links',
  'persistence',
  'local saved designs',
  'embed popover',
  'cursor-effect dock',
  'claude payload',
  'copy-as',
  /* js: export and recording */
  'export filename source',
  'export names',
  'share sheet',
  'export',
  'Frame',
  'clip recording',
  'mp4 muxing',
  'recording resolution',
  'offline clip export',
  'export targets UI',
  'format',
  /* js: panel behaviour, vibe, boot, thumbnails */
  'info tooltips',
  'section collapse',
  'refresh palette',
  'Vibe (Pro · bring-your-own-key)',
  'boot',
  'field picker thumbnails',
  'thumbnails',
];

/* every zone in BENCHMARKS must be reachable from the map, so the file can never
   grow a large unbannered region that MAP.md quietly stops describing */
const REQUIRED_ZONES = [
  'pre-paint boot', 'root tokens', 'panel chrome', 'stage', 'docks', 'panel themes',
  'Templates section', 'Output section',
  'glsl helpers', 'glsl engines 0-12', 'glsl lenses', 'glsl materials', 'glsl screens',
  'state', 'looks and palettes', 'render', 'share links', 'persistence', 'picker strips',
  'theme picker', 'export', 'clip recording', 'thumbnails', 'claude payload',
];

const html = fs.readFileSync(INDEX, 'utf8');

describe('index.html section map', () => {
  it('every canonical banner exists, in order', () => {
    /* first occurrence, NOT a forward scan from the last hit: a banner that moved
       backwards past its neighbour has to fail, not quietly re-anchor */
    let previousAt = -1;
    let previous = '(start of file)';
    for (const name of SECTIONS) {
      const anchor = '---------- ' + name + ':';
      const at = html.indexOf(anchor);
      assert.notStrictEqual(at, -1,
        `index.html has no banner for "${name}" — expected a comment containing "${anchor}". ` +
        'Restore the banner, or drop the name from SECTIONS in tests/section-map.test.js.');
      assert.ok(at > previousAt,
        `banner "${name}" is out of order: it sits at offset ${at}, before "${previous}" ` +
        `(offset ${previousAt}). SECTIONS must list banners in file order.`);
      previousAt = at;
      previous = name;
    }
  });

  it('SECTIONS covers the zones the map has to describe', () => {
    const missing = REQUIRED_ZONES.filter((z) => SECTIONS.indexOf(z) < 0);
    assert.deepStrictEqual(missing, [],
      `these zones must stay on the map: ${missing.join(', ')}`);
  });

  it('index.html carries no banner that is missing from SECTIONS', async () => {
    const { readBanners } = await import(pathToFileURL(GEN).href);
    const found = readBanners(html).map((b) => b.name);
    const extra = found.filter((n) => SECTIONS.indexOf(n) < 0);
    assert.deepStrictEqual(extra, [],
      `index.html has banner(s) the map does not list: ${extra.join(', ')}. ` +
      'Add them to SECTIONS (in file order) and rerun `node scripts/gen-map.mjs`.');
    /* deepStrictEqual gives the exact divergence when order or wording drifts */
    assert.deepStrictEqual(found, SECTIONS, 'banner order in index.html differs from SECTIONS');
  });

  it('every banner carries a one-line purpose', async () => {
    const { readBanners } = await import(pathToFileURL(GEN).href);
    for (const b of readBanners(html)) {
      assert.ok(b.purpose && b.purpose.length > 8,
        `banner "${b.name}" (line ${b.line}) needs a purpose: write it as ` +
        '`name: what this block is for`');
    }
  });

  it('docs/MAP.md is freshly generated', async () => {
    const { buildMap } = await import(pathToFileURL(GEN).href);
    const committed = fs.readFileSync(MAP, 'utf8');
    assert.strictEqual(committed, buildMap(html),
      'docs/MAP.md is stale — run `node scripts/gen-map.mjs`');
  });
});
