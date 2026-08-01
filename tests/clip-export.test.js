'use strict';
/* Pure helpers behind the clip paths. wcConfigOpts is the ONE place both live recording
   and the offline export negotiate H.264 from, so a bad candidate list silently demotes
   every Mac recording to the MediaRecorder fallback (a bitstream X's uploader rejects).
   Read straight out of index.html — the studio ships as one file, so the committed bytes
   are the only source of truth. */
const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const indexSrc = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

/* Body text of `function NAME(...){ … }`, scanned to its matching brace so nested
   blocks and braces inside strings don't cut it short. */
function extractFn(src, name) {
  const m = new RegExp('function\\s+' + name + '\\s*\\(').exec(src);
  if (!m) throw new Error('could not find function ' + name + ' in index.html');
  let i = src.indexOf('{', m.index);
  const start = m.index;
  let depth = 0, q = null;
  for (; i < src.length; i++) {
    const c = src[i];
    if (q) { if (c === '\\') { i++; continue; } if (c === q) q = null; continue; }
    if (c === '"' || c === "'" || c === '`') { q = c; continue; }
    if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) return src.slice(start, i + 1); }
  }
  throw new Error('unterminated function ' + name);
}

/* Value of `var NAME = <literal>;` */
function extractVar(src, name) {
  const m = new RegExp('var\\s+' + name + '\\s*=\\s*([^;]+);').exec(src);
  if (!m) throw new Error('could not find var ' + name + ' in index.html');
  return (new Function('return (' + m[1] + ')'))();
}

const REC_FPS = extractVar(indexSrc, 'REC_FPS');
const REC_BITRATE = extractVar(indexSrc, 'REC_BITRATE');
const CLIP_DURS = extractVar(indexSrc, 'CLIP_DURS');
const sandbox = new Function(
  'REC_FPS', 'REC_BITRATE',
  extractFn(indexSrc, 'avcLevelHex') + '\n' +
  extractFn(indexSrc, 'wcConfigOpts') + '\n' +
  extractFn(indexSrc, 'recSizeForMax') + '\n' +
  'return { avcLevelHex:avcLevelHex, wcConfigOpts:wcConfigOpts, recSizeForMax:recSizeForMax };'
)(REC_FPS, REC_BITRATE);
const { avcLevelHex, wcConfigOpts, recSizeForMax } = sandbox;

describe('clip export helpers', () => {
  describe('avcLevelHex', () => {
    it('picks a level that can actually hold the frame', () => {
      assert.strictEqual(avcLevelHex(1920, 1080), '2A');   /* 4.2 */
      assert.strictEqual(avcLevelHex(2560, 1440), '32');   /* 5.0 */
      assert.strictEqual(avcLevelHex(3840, 2160), '33');   /* 5.1 */
    });
    it('never drops a level as the frame grows', () => {
      let prev = 0;
      for (const side of [640, 1280, 1920, 2560, 3840]) {
        const lvl = parseInt(avcLevelHex(side, side), 16);
        assert.ok(lvl >= prev, side + 'px square negotiated a LOWER level than the size below it');
        prev = lvl;
      }
    });
  });

  describe('wcConfigOpts', () => {
    const size = recSizeForMax(1, 1920);
    const opts = wcConfigOpts(size);

    it('carries the clip size, framerate and bitrate on every candidate', () => {
      assert.ok(opts.length >= 12, 'too few fallback candidates: ' + opts.length);
      for (const cfg of opts) {
        assert.strictEqual(cfg.width, size.w);
        assert.strictEqual(cfg.height, size.h);
        assert.strictEqual(cfg.framerate, REC_FPS);
        assert.strictEqual(cfg.bitrate, REC_BITRATE);
        assert.deepStrictEqual(cfg.avc, { format: 'avc' }, 'avc format must stay annex-b-free for the muxer');
        assert.match(cfg.codec, /^avc1\.[0-9A-F]{6}$/, 'bad codec string: ' + cfg.codec);
      }
    });

    it('tries the richest tuning first and bare config last', () => {
      assert.strictEqual(opts[0].hardwareAcceleration, 'prefer-hardware');
      assert.strictEqual(opts[0].latencyMode, 'quality');
      assert.strictEqual(opts[0].bitrateMode, 'constant');
      const last = opts[opts.length - 1];
      assert.ok(!('hardwareAcceleration' in last) && !('latencyMode' in last) && !('bitrateMode' in last),
        'the final candidate must be bare, or Safari has nothing left to accept');
    });

    it('lists every candidate exactly once', () => {
      const seen = new Set(opts.map((o) => JSON.stringify([o.codec, o.hardwareAcceleration, o.latencyMode, o.bitrateMode])));
      assert.strictEqual(seen.size, opts.length);
    });

    it('encodes the level the resolution needs', () => {
      const uhd = wcConfigOpts(recSizeForMax(1.7778, 3840));
      for (const cfg of uhd) { assert.ok(cfg.codec.endsWith('33'), '4K must negotiate level 5.1: ' + cfg.codec); }
    });
  });

  describe('clip lengths', () => {
    it('offers 4s / 8s / 15s', () => {
      assert.deepStrictEqual(CLIP_DURS, [4, 8, 15]);
    });
    it('every length is a whole number of encoded frames', () => {
      for (const d of CLIP_DURS) { assert.strictEqual((d * REC_FPS) % 1, 0); }
    });
    it('the buttons in the panel match the list', () => {
      const labels = [...indexSrc.matchAll(/data-clipdur="(\d+)"/g)].map((m) => parseInt(m[1], 10));
      assert.deepStrictEqual(labels, CLIP_DURS, 'the Clip buttons and CLIP_DURS have drifted apart');
    });
  });
});
