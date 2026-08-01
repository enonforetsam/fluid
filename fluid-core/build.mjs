#!/usr/bin/env node
/* fluid-core + worker extractor.
 *
 * The studio (../index.html) is the single source of truth for every engine,
 * palette, lens, and look. This script mechanically extracts those blocks and
 * emits them as ES modules: src/generated/ for the fluid-core package and
 * ../worker-data.js for the edge worker. Nothing is written by hand there.
 *
 * Run:            node fluid-core/build.mjs
 * Drift guard:    tests/fluid-core.test.js and tests/data-sync.test.js re-run the
 *                 extraction in memory and fail if the committed generated files
 *                 differ — so index.html, the package and the API can never drift
 *                 apart on CI.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'fluid-core', 'src', 'generated');

const studio = readFileSync(join(ROOT, 'index.html'), 'utf8');

/* Capture the full `[ ... ]` literal after `var NAME = ` with a quote-aware
   bracket scan, then evaluate it in an empty sandbox (the blocks are pure
   literals — strings, numbers, nested arrays/objects). */
function extractArray(src, name){
  const startRe = new RegExp('^var ' + name + ' = \\[', 'm');
  const m = startRe.exec(src);
  if (!m) throw new Error('extract: `var ' + name + ' = [` not found');
  const open = m.index + m[0].length - 1;   /* position of the `[` */
  let depth = 0, quote = null, esc = false, end = -1;
  for (let i = open; i < src.length; i++){
    const ch = src[i];
    if (esc){ esc = false; continue; }
    if (quote){
      if (ch === '\\') esc = true;
      else if (ch === quote) quote = null;
      continue;
    }
    if (ch === "'" || ch === '"') quote = ch;
    else if (ch === '[' || ch === '{') depth++;
    else if (ch === ']' || ch === '}'){ depth--; if (depth === 0){ end = i; break; } }
    else if (ch === '/' && src[i + 1] === '*'){ i = src.indexOf('*/', i + 2) + 1; }
  }
  if (end < 0) throw new Error('extract: unbalanced brackets for ' + name);
  const literal = src.slice(open, end + 1);
  return vm.runInNewContext('(' + literal + ')', {}, { timeout: 2000 });
}

/* shader sources: joined string arrays (README invariant) */
const VSRC = extractArray(studio, 'VSRC').join('\n');
const FSRC = extractArray(studio, 'FSRC').join('\n');

/* Button label -> public slug: decode the numeric entities the markup uses and
   drop diacritics, so `M&#246;bius` lands on `mobius` and `ASCII` on `ascii`. */
function slugify(label){
  return String(label)
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(+d))
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

/* The studio's own control buttons are the registry: their data-* index IS the
   share-hash value, so reading them keeps slug order and hash order identical.
   `capture` continues the pattern after data-ATTR="N" up to the label group. */
function buttonSlugs(attr, capture){
  const out = [];
  for (const m of studio.matchAll(new RegExp('data-' + attr + '="(\\d+)"' + capture, 'g'))){
    out[+m[1]] = slugify(m[2]);
  }
  if (!out.length) throw new Error('extract: no data-' + attr + ' buttons found');
  for (let i = 0; i < out.length; i++){
    if (out[i] === undefined) throw new Error('extract: data-' + attr + ' buttons skip index ' + i);
  }
  return out;
}
const TITLED = '[^>]*title="([^"]+)"';
const LABELLED = '[^>]*aria-label="([^"]+)"';
const SPANNED = '[^>]*><span>([^<]+)<\\/span>';

/* studio data blocks */
const PALETTES_RGB = extractArray(studio, 'PALETTES_RGB');
const LOOKS = extractArray(studio, 'LOOKS');
const FIELD_TUNE = extractArray(studio, 'FIELD_TUNE');
const FIELD_STATUS = extractArray(studio, 'FIELD_STATUS');
const PRESETS = extractArray(studio, 'PRESETS');

/* slug lists, straight off the pickers */
const FIELDS = buttonSlugs('field', TITLED);
const SCREENS = buttonSlugs('screen', TITLED);
const MATERIALS = buttonSlugs('material', SPANNED);
/* lens buttons spell the map out ("Square z²", "Invert 1/z"); the slug is the name */
const LENSES = buttonSlugs('lens', SPANNED).map((s) => s.split(' ')[0]);
/* the last palette button is the custom-stops slot (hash palette index 8), which
   is a mode rather than a named palette */
const PAL_BUTTONS = buttonSlugs('pal', LABELLED);
if (PAL_BUTTONS[PAL_BUTTONS.length - 1] !== 'custom'){
  throw new Error('extract: last palette button should be the custom slot, got ' + PAL_BUTTONS[PAL_BUTTONS.length - 1]);
}
const PALETTES = PAL_BUTTONS.slice(0, -1);

/* worker-shaped looks: the studio array keyed by lowercase name. Only the keys the
   worker actually reads are carried over — a new studio-side key would otherwise be
   dropped in silence and the API would render something else, so it hard-fails. */
const LOOK_KEYS = ['field', 'screen', 'thresh', 'material', 'lens', 'lensAmt', 'preset', 'cols'];
const WORKER_LOOKS = {};
for (const lk of LOOKS){
  const name = slugify(lk.label || '');
  if (!name) throw new Error('extract: a look has no label');
  if (WORKER_LOOKS[name]) throw new Error('extract: duplicate look name "' + name + '"');
  for (const k of Object.keys(lk)){
    if (k !== 'label' && k !== 'p' && LOOK_KEYS.indexOf(k) < 0){
      throw new Error('look "' + name + '" carries "' + k + '", which the worker cannot express — ' +
        'teach worker.js + LOOK_KEYS about it, or the API will render a different piece');
    }
  }
  const out = {};
  for (const k of LOOK_KEYS){ if (lk[k] !== undefined) out[k] = lk[k]; }
  out.p = lk.p;
  WORKER_LOOKS[name] = out;
}

/* blend slugs follow the blendField() mode order inside FSRC (0..5) */
const BLENDS = ['normal', 'multiply', 'screen', 'add', 'difference', 'overlay'];

/* sanity: the pickers, the tuning table and the shader must agree before we emit */
if (FIELDS.length !== FIELD_TUNE.length){
  throw new Error('field count mismatch: field buttons=' + FIELDS.length + ' vs FIELD_TUNE=' + FIELD_TUNE.length);
}
for (const name of ['fieldOf', 'blendField', 'ramp4']){
  if (FSRC.indexOf(name) < 0) throw new Error('FSRC missing ' + name + ' — extraction is stale or index.html changed shape');
}
for (let i = 0; i < FIELDS.length; i++){
  if (i > 0 && FSRC.indexOf('eng == ' + i) < 0){
    throw new Error('FSRC has no dispatch branch for field ' + i + ' (' + FIELDS[i] + ')');
  }
}

/* HEADER's wording is frozen: it is the first line of the committed src/generated/
   files, so any edit marks them stale until they are regenerated. (index.html is now
   the only input — the slug lists used to be read back out of worker.js.) */
const HEADER = '/* GENERATED from index.html + worker.js by fluid-core/build.mjs — DO NOT EDIT.\n' +
  '   Regenerate with: node fluid-core/build.mjs */\n';
const WORKER_HEADER = '/* GENERATED from index.html by fluid-core/build.mjs — DO NOT EDIT.\n' +
  '   Regenerate with: node fluid-core/build.mjs */\n';

export function emitShader(){
  return HEADER +
    'export const VSRC = ' + JSON.stringify(VSRC) + ';\n' +
    'export const FSRC = ' + JSON.stringify(FSRC) + ';\n';
}

export function emitData(){
  const j = (v) => JSON.stringify(v);
  return HEADER +
    '/* engine slugs by index — index = u_field value and the #p= hash field id */\n' +
    'export const FIELDS = ' + j(FIELDS) + ';\n' +
    '/* per-engine [zoomMin, zoomMax, warpMin, warpMax] sweet spots */\n' +
    'export const FIELD_TUNE = ' + j(FIELD_TUNE) + ';\n' +
    '/* one-line description per engine (studio status bar) */\n' +
    'export const FIELD_STATUS = ' + j(FIELD_STATUS) + ';\n' +
    '/* palette slugs by index; 7 (chrome) is procedural, 8 = custom stops */\n' +
    'export const PALETTES = ' + j(PALETTES) + ';\n' +
    '/* 4 gradient stops (dark -> light) per preset palette, RGB 0..1 */\n' +
    'export const PALETTES_RGB = ' + j(PALETTES_RGB) + ';\n' +
    'export const SCREENS = ' + j(SCREENS) + ';\n' +
    'export const MATERIALS = ' + j(MATERIALS) + ';\n' +
    'export const BLENDS = ' + j(BLENDS) + ';\n' +
    '/* curated studio looks. p = [speed,zoom,warp,grain,pixel,dot,dots,pal,seed,liq,mix,ar] */\n' +
    'export const LOOKS = ' + JSON.stringify(LOOKS, null, 0) + ';\n';
}

/* The edge worker's registry. Same slugs, same order, same share-hash indices as
   the studio — worker.js imports this instead of keeping its own copy, so the API
   cannot answer with an engine/lens/look the app does not have. */
export function emitWorkerData(){
  const j = (v) => JSON.stringify(v);
  const looks = Object.keys(WORKER_LOOKS)
    .map((name) => '  ' + j(name) + ': ' + j(WORKER_LOOKS[name]))
    .join(',\n');
  return WORKER_HEADER +
    '/* engine slugs by index — index = the #p= hash field id */\n' +
    'export const FIELDS = ' + j(FIELDS) + ';\n' +
    'export const SCREENS = ' + j(SCREENS) + ';\n' +
    '/* material finishes — share-hash slot [28] */\n' +
    'export const FINISHES = ' + j(MATERIALS) + ';\n' +
    '/* math lenses — share-hash slots [29][30] */\n' +
    'export const LENSES = ' + j(LENSES) + ';\n' +
    '/* named palettes; hash index 8 is the custom-stops slot, not a name */\n' +
    'export const PALETTES = ' + j(PALETTES) + ';\n' +
    '/* built-in source images to melt (hash slot [12], 1-based) */\n' +
    'export const PRESETS = ' + j(PRESETS) + ';\n' +
    '/* curated looks keyed by lowercase name (the API\'s `look` argument).\n' +
    '   p = [speed,zoom,warp,grain,pixel,dot,dots,pal,seed,liq,mix,ar] */\n' +
    'export const LOOKS = {\n' + looks + '\n};\n';
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain){
  mkdirSync(OUT, { recursive: true });
  writeFileSync(join(OUT, 'shader.js'), emitShader());
  writeFileSync(join(OUT, 'data.js'), emitData());
  writeFileSync(join(ROOT, 'worker-data.js'), emitWorkerData());
  console.log('fluid-core: generated src/generated/shader.js (' + FSRC.length + ' bytes of GLSL) and data.js');
  console.log('worker: generated worker-data.js (' + Object.keys(WORKER_LOOKS).length + ' looks)');
  console.log('engines: ' + FIELDS.join(', '));
}
