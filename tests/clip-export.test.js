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
const REC_FRAME_MS = 1000 / REC_FPS;   /* index.html derives it the same way from REC_FPS */
const sandbox = new Function(
  'REC_FPS', 'REC_BITRATE', 'REC_FRAME_MS',
  extractFn(indexSrc, 'avcLevelHex') + '\n' +
  extractFn(indexSrc, 'wcConfigOpts') + '\n' +
  extractFn(indexSrc, 'recSizeForMax') + '\n' +
  extractFn(indexSrc, 'recNextCap') + '\n' +
  'return { avcLevelHex:avcLevelHex, wcConfigOpts:wcConfigOpts, recSizeForMax:recSizeForMax, recNextCap:recNextCap };'
)(REC_FPS, REC_BITRATE, REC_FRAME_MS);
const { avcLevelHex, wcConfigOpts, recSizeForMax, recNextCap } = sandbox;

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

    it('live recording asks for realtime latency first, the offline export for quality', () => {
      /* a live take feeds the encoder a frame every 33ms while the GPU draws the piece at clip
         size; in quality mode the queue backs up and captures get dropped — the lag Danial saw */
      const live = wcConfigOpts(size, true);
      assert.strictEqual(live[0].latencyMode, 'realtime');
      assert.strictEqual(live[0].hardwareAcceleration, 'prefer-hardware');
      assert.strictEqual(opts[0].latencyMode, 'quality', 'the offline export must keep quality mode');
      assert.strictEqual(live.length, opts.length, 'live must have the same depth of fallbacks');
      const last = live[live.length - 1];
      assert.ok(!('latencyMode' in last) && !('hardwareAcceleration' in last), 'live must still end on a bare candidate');
      assert.ok(!live.some((c) => c.latencyMode === 'quality' && live.indexOf(c) === 0), 'realtime must come before any quality candidate');
    });
  });

  describe('recNextCap — the live capture cadence', () => {
    /* rAF at 60Hz is 16.667ms; "at least 33.33ms since the last capture" measured from the
       capture itself alternates 2- and 3-frame gaps. The schedule must step, not reset. */
    function simulate(rafMs, frames) {
      const caps = [];
      let last = 0;
      for (let i = 1; i <= frames; i++) {
        const now = i * rafMs;
        const next = recNextCap(last, now);
        if (next >= 0) { caps.push(now); last = next; }
      }
      return caps;
    }
    it('captures every second frame at 60Hz, evenly', () => {
      const caps = simulate(1000 / 60, 120);
      const gaps = caps.slice(1).map((t, i) => t - caps[i]);
      assert.ok(gaps.length > 40, 'too few captures: ' + caps.length);
      for (const g of gaps) { assert.ok(Math.abs(g - 2 * (1000 / 60)) < 0.01, 'uneven gap ' + g); }
    });
    it('captures every fourth frame at 120Hz and every frame at 30Hz', () => {
      const g120 = simulate(1000 / 120, 240).slice(1).map((t, i, a) => t - (i ? a[i - 1] : 0));
      for (const g of g120.slice(1)) { assert.ok(Math.abs(g - 4 * (1000 / 120)) < 0.01, '120Hz gap ' + g); }
      const c30 = simulate(1000 / 30, 60);
      assert.strictEqual(c30.length, 60, 'at 30Hz every frame is due');
    });
    it('resyncs after a stall instead of bursting to catch up', () => {
      const t0 = 1000;
      const next = recNextCap(t0, t0 + 500);              /* half a second of nothing */
      assert.strictEqual(next, t0 + 500, 'the schedule must jump to now');
      assert.strictEqual(recNextCap(next, next + 10), -1, 'and the very next frame is not due');
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
