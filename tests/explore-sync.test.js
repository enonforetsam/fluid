'use strict';
/* The studio's Explore shelf (EXPLORE in index.html) and the /gallery page (GALLERY in
   gallery.html) show the same curated pieces from the same pre-rendered thumbnails. They
   are separate literals — a hash edited in one place and not the other would silently make
   a tile open a different piece than its picture. This test pins them to each other and to
   the thumbnail files on disk. */
const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const indexSrc = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const gallerySrc = fs.readFileSync(path.join(ROOT, 'gallery.html'), 'utf8');

/* Evaluate the literal assigned to `var NAME = <literal>;`, scanning to the depth-0
   semicolon so nested brackets and quoted strings don't fool it. */
function extractAssign(src, name) {
  const m = new RegExp('var\\s+' + name + '\\s*=').exec(src);
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

const EXPLORE = extractAssign(indexSrc, 'EXPLORE');
const GALLERY = extractAssign(gallerySrc, 'GALLERY');

describe('studio Explore shelf <-> /gallery', () => {
  it('every shelf piece exists in the gallery with the same hash', () => {
    const byId = {};
    for (const g of GALLERY) byId[g.id] = g;
    for (const [id, hash] of EXPLORE) {
      assert.ok(byId[id], `Explore piece "${id}" is not in gallery.html — the tile would have no source of truth`);
      assert.strictEqual(hash, byId[id].hash, `hash drift for "${id}": the studio tile and /gallery open different pieces`);
    }
  });

  it('the shelf covers the whole gallery, in the same order', () => {
    assert.deepStrictEqual(EXPLORE.map((e) => e[0]), GALLERY.map((g) => g.id),
      'Explore and /gallery list different pieces (or a different order)');
  });

  it('every tile has its pre-rendered thumbnail on disk', () => {
    for (const [id] of EXPLORE) {
      const thumb = path.join(ROOT, 'assets', 'gallery', 'x-' + id + '.jpg');
      assert.ok(fs.existsSync(thumb), `missing thumbnail assets/gallery/x-${id}.jpg — the tile would render blank`);
    }
  });

  it('every hash is a well-formed numeric share hash', () => {
    for (const [id, hash] of EXPLORE) {
      assert.ok(hash.startsWith('#p='), `"${id}" hash must start with #p=`);
      const n = hash.slice(3).split(',').map(Number);
      assert.ok(n.length >= 12, `"${id}" hash has ${n.length} slots — the parser needs at least 12`);
      assert.ok(!n.some(Number.isNaN), `"${id}" hash carries a non-numeric slot — parseHash would reject it`);
    }
  });
});
