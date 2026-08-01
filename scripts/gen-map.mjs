#!/usr/bin/env node
/* docs/MAP.md generator.
 *
 * index.html is one ~6.6k-line self-contained file, so the ONLY navigation aid is
 * its banner comments. This reads them back out and emits the table of contents.
 * Nothing is written into docs/MAP.md by hand.
 *
 * Run:          node scripts/gen-map.mjs
 * Drift guard:  tests/section-map.test.js regenerates in memory and fails if the
 *               committed MAP.md differs, and holds the canonical ordered list of
 *               banner names so a section cannot be dropped or moved unnoticed.
 *
 * Banner grammar (both comment syntaxes, JS/CSS and HTML):
 *
 *     /* ---------- name: one-line purpose ---------- *\/
 *     <!-- ---------- name: one-line purpose ---------- -->
 *
 * plus the multi-line form, where the extra prose is detail and does NOT reach the map:
 *
 *     /* ---------- name: one-line purpose ----------
 *        the constraint this block protects, the bug it exists because of, etc. *\/
 *
 * `name:` is mandatory and each name must be unique: '---------- name:' is the search
 * anchor MAP.md publishes, and without the colon '---------- export' would also match
 * '---------- export names'. A bare `name` with no colon throws.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/* a banner opens with a comment token followed by a run of at least six dashes */
const BANNER = /^([ \t]*)(\/\*|<!--)[ \t]*-{6,}[ \t]*(.*)$/;
/* the longest a `name:` prefix may be before the colon reads as prose, not a name */
const MAX_NAME = 60;

/* which of the file's five zones a line falls in. Derived from the file's own
   landmarks rather than line numbers, which rot on the first edit. */
function zoneIndex(lines){
  const at = (pred, from) => {
    for (let i = from || 0; i < lines.length; i++){ if (pred(lines[i])) return i; }
    return -1;
  };
  const styleOpen = at((l) => l.trim() === '<style>');
  const styleClose = at((l) => l.trim() === '</style>', styleOpen);
  const scriptOpen = at((l) => l.trim() === '<script>', styleClose);
  const fsrcOpen = at((l) => l.startsWith('var FSRC = ['), scriptOpen);
  const fsrcClose = at((l) => l.trim() === "].join('\\n');", fsrcOpen);
  for (const [name, v] of [['<style>', styleOpen], ['</style>', styleClose],
    ['<script>', scriptOpen], ['var FSRC', fsrcOpen], ['FSRC close', fsrcClose]]){
    if (v < 0) throw new Error('gen-map: landmark not found in index.html: ' + name);
  }
  return (i) => {
    if (i < styleOpen) return 'Head';
    if (i < styleClose) return 'CSS';
    if (i < scriptOpen) return 'Markup';
    if (i > fsrcOpen && i < fsrcClose) return 'GLSL';
    return 'JavaScript';
  };
}

/* Read every banner in file order. Returns [{ zone, name, purpose, anchor, line }]. */
export function readBanners(html){
  const lines = html.split('\n');
  const zoneOf = zoneIndex(lines);
  const out = [];
  const seen = new Map();

  for (let i = 0; i < lines.length; i++){
    const m = BANNER.exec(lines[i]);
    if (!m) continue;
    const closer = m[2] === '<!--' ? '-->' : '*/';
    const parts = [m[3]];
    let j = i;
    while (!parts[parts.length - 1].trimEnd().endsWith(closer)){
      if (++j >= lines.length) throw new Error('gen-map: unterminated banner at line ' + (i + 1));
      parts.push(lines[j].trim());
    }
    /* strip the closer, then the closing dash run, off the LAST fragment only */
    let tail = parts[parts.length - 1].trimEnd();
    tail = tail.slice(0, tail.length - closer.length).trimEnd().replace(/-{6,}$/, '').trimEnd();
    parts[parts.length - 1] = tail;

    /* the first fragment may itself close with dashes (multi-line form) */
    const head = parts[0].replace(/-{6,}\s*$/, '').trim();

    /* `name: purpose` is mandatory. The colon is what makes '---------- name:' an
       UNAMBIGUOUS anchor — without it '---------- export' also matches
       '---------- export names', and every lookup in the map would be a prefix trap. */
    const ci = head.indexOf(':');
    if (ci <= 0 || ci > MAX_NAME || /[.!?]/.test(head.slice(0, ci))){
      throw new Error('gen-map: banner at line ' + (i + 1) + ' (' + JSON.stringify(head.slice(0, 60)) +
        ') is not in `name: what this block is for` form — the name must come first, ' +
        'be at most ' + MAX_NAME + ' characters, and be followed by a colon');
    }
    const name = head.slice(0, ci).trim();
    if (!name) throw new Error('gen-map: nameless banner at line ' + (i + 1));

    /* the lead IS the one-liner; prose on the following lines is detail, not the map */
    let purpose = head.slice(ci + 1).trim();
    if (!purpose){
      throw new Error('gen-map: banner "' + name + '" (line ' + (i + 1) + ') has no purpose — ' +
        'write the one-liner on the banner line itself, after the colon');
    }
    if (purpose.length > 200) purpose = purpose.slice(0, 197).replace(/\s\S*$/, '') + '…';
    purpose = purpose.replace(/[.;,]$/, '');

    if (seen.has(name)){
      throw new Error('gen-map: duplicate banner name "' + name + '" (lines ' +
        seen.get(name) + ' and ' + (i + 1) + ') — banner names are the map anchors and must be unique');
    }
    seen.set(name, i + 1);
    const anchor = '---------- ' + name + ':';
    if (html.split(anchor).length - 1 !== 1){
      throw new Error('gen-map: anchor ' + JSON.stringify(anchor) + ' is not unique in index.html — ' +
        'banner names are how the map is searched, so each must appear exactly once');
    }
    out.push({ zone: zoneOf(i), name, purpose, anchor, line: i + 1 });
    i = j;
  }
  if (!out.length) throw new Error('gen-map: no banners found — has the comment style changed?');
  return out;
}

const ZONE_BLURB = {
  Head: 'before `<style>` — meta, icons and the two pre-paint scripts',
  CSS: 'inside `<style>` — every rule the studio ships',
  Markup: 'inside `<body>` — the stage and the control panel',
  GLSL: 'inside `var FSRC = [ … ]` — the fragment shader, as an array of source lines',
  JavaScript: 'inside the closing `<script>` — one IIFE, data first and boot last',
};

function cell(s){ return String(s).replace(/\|/g, '\\|'); }

export function buildMap(html){
  const banners = readBanners(html);
  const zones = [];
  for (const b of banners){ if (zones.indexOf(b.zone) < 0) zones.push(b.zone); }

  const L = [];
  L.push('# index.html — section map');
  L.push('');
  L.push('<!-- GENERATED by scripts/gen-map.mjs — DO NOT EDIT BY HAND.');
  L.push('     Regenerate with:  node scripts/gen-map.mjs');
  L.push('     Source of truth:  the `/* ---------- name: purpose ---------- */` banner');
  L.push('     comments in index.html. Add a banner there, rerun this, and add the name to');
  L.push('     the canonical list in tests/section-map.test.js. -->');
  L.push('');
  /* deliberately no line count / line numbers here: this file must only change when a
     BANNER changes, so unrelated edits to index.html never make MAP.md stale. */
  L.push('`index.html` is one self-contained file that has to boot from `file://`, so it can never be split into modules.');
  L.push('Its banner comments are the navigation. **Jump by searching for the anchor text**, not by line number:');
  L.push('');
  L.push('```');
  L.push('grep -n "---------- glsl lenses:" index.html');
  L.push('```');
  L.push('');
  L.push('Zones, in file order:');
  L.push('');
  for (const z of zones){ L.push('- **' + z + '** — ' + ZONE_BLURB[z]); }
  L.push('');

  for (const z of zones){
    L.push('## ' + z);
    L.push('');
    L.push('| Section | Purpose | Anchor |');
    L.push('| --- | --- | --- |');
    for (const b of banners){
      if (b.zone !== z) continue;
      L.push('| ' + cell(b.name) + ' | ' + cell(b.purpose) + ' | `' + cell(b.anchor) + '` |');
    }
    L.push('');
  }
  L.push('---');
  L.push('');
  L.push(banners.length + ' sections. Anything unbannered is a gap in the map: add a banner in the');
  L.push('surrounding style rather than growing an orphan block.');
  L.push('');
  return L.join('\n');
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain){
  const html = readFileSync(join(ROOT, 'index.html'), 'utf8');
  const md = buildMap(html);
  writeFileSync(join(ROOT, 'docs', 'MAP.md'), md);
  console.log('docs/MAP.md: ' + readBanners(html).length + ' sections');
}
