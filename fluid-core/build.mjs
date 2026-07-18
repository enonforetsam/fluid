#!/usr/bin/env node
/* fluid-core extractor.
 *
 * The studio (../index.html) is the single source of truth for every engine,
 * palette, and look. This script mechanically extracts those blocks and emits
 * them as ES modules under src/generated/. Nothing is written by hand there.
 *
 * Run:            node fluid-core/build.mjs
 * Drift guard:    tests/fluid-core.test.js re-runs the extraction in memory and
 *                 fails if the committed generated files differ — so index.html
 *                 and the package can never drift apart on CI.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'fluid-core', 'src', 'generated');

const studio = readFileSync(join(ROOT, 'index.html'), 'utf8');
const worker = readFileSync(join(ROOT, 'worker.js'), 'utf8');

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

/* studio data blocks */
const PALETTES_RGB = extractArray(studio, 'PALETTES_RGB');
const LOOKS = extractArray(studio, 'LOOKS');
const FIELD_TUNE = extractArray(studio, 'FIELD_TUNE');
const FIELD_STATUS = extractArray(studio, 'FIELD_STATUS');

/* worker slug lists (already the studio's public API names) */
const FIELDS = extractArray(worker, 'FIELDS');
const PALETTES = extractArray(worker, 'PALETTES');
const SCREENS = extractArray(worker, 'SCREENS');

/* material names from the studio's own buttons */
const MATERIALS = [];
for (const m of studio.matchAll(/data-material="(\d+)"[^>]*><span>([^<]+)<\/span>/g)){
  MATERIALS[+m[1]] = m[2].toLowerCase();
}

/* blend slugs follow the blendField() mode order inside FSRC (0..5) */
const BLENDS = ['normal', 'multiply', 'screen', 'add', 'difference', 'overlay'];

/* sanity: the studio and worker must agree before we emit anything */
if (FIELDS.length !== FIELD_TUNE.length){
  throw new Error('field count mismatch: worker FIELDS=' + FIELDS.length + ' vs FIELD_TUNE=' + FIELD_TUNE.length);
}
for (const name of ['fieldOf', 'blendField', 'ramp4']){
  if (FSRC.indexOf(name) < 0) throw new Error('FSRC missing ' + name + ' — extraction is stale or index.html changed shape');
}
for (let i = 0; i < FIELDS.length; i++){
  if (i > 0 && FSRC.indexOf('eng == ' + i) < 0){
    throw new Error('FSRC has no dispatch branch for field ' + i + ' (' + FIELDS[i] + ')');
  }
}

const HEADER = '/* GENERATED from index.html + worker.js by fluid-core/build.mjs — DO NOT EDIT.\n' +
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

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain){
  mkdirSync(OUT, { recursive: true });
  writeFileSync(join(OUT, 'shader.js'), emitShader());
  writeFileSync(join(OUT, 'data.js'), emitData());
  console.log('fluid-core: generated src/generated/shader.js (' + FSRC.length + ' bytes of GLSL) and data.js');
  console.log('engines: ' + FIELDS.join(', '));
}
