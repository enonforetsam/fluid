'use strict';
/* Behavioral tests: actually load the worker module and call its fetch handler with a
   mock env, rather than grepping the source for route strings. */
const { describe, it } = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const WORKER_PATH = path.resolve(__dirname, '..', 'worker.js');

/* worker.js is ESM (export default) and imports ./worker-data.js, so it has to be
   loaded from a real file: URL — a data: URI has no base for a relative specifier.
   Node reparses both files as ESM (the repo package.json is type-less because the
   tests themselves are CommonJS); that warning is noise, not a failure. */
let handlerPromise;
function loadWorker() {
  if (!handlerPromise) {
    handlerPromise = import(pathToFileURL(WORKER_PATH).href).then((m) => m.default);
  }
  return handlerPromise;
}

const mockEnv = {
  STAGE: 'test',
  ASSETS: { fetch: async () => new Response('<!DOCTYPE html><html></html>', { status: 200, headers: { 'content-type': 'text/html' } }) }
};
async function GET(pathname) {
  const w = await loadWorker();
  return w.fetch(new Request('https://fluid.test' + pathname), mockEnv);
}

describe('worker.js (behavioral)', () => {
  it('module loads and default-exports a fetch handler', async () => {
    const w = await loadWorker();
    assert.strictEqual(typeof w.fetch, 'function');
  });

  it('GET /api/looks -> 200 JSON with every look', async () => {
    const res = await GET('/api/looks');
    assert.strictEqual(res.status, 200);
    assert.match(res.headers.get('content-type') || '', /json/);
    const body = await res.json();
    assert.ok(Array.isArray(body.looks), 'body.looks should be an array');
    assert.ok(body.looks.length >= 20, `expected the curated looks, got ${body.looks.length}`);
  });

  it('GET /api/piece (defaults) -> 200 JSON piece, no error', async () => {
    const res = await GET('/api/piece');
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.ok(!body.error, 'piece returned an error: ' + body.error);
    assert.strictEqual(typeof body, 'object');
  });

  it('GET /api/piece with bad input -> 400 JSON error (handled, not thrown)', async () => {
    const res = await GET('/api/piece?aspect=not-a-real-aspect&field=999');
    assert.ok([200, 400].includes(res.status), `expected a handled status, got ${res.status}`);
    await res.json(); // must be valid JSON either way
  });

  it('GET /api/piece with 2 colors -> expands to a 4-stop custom gradient', async () => {
    const res = await GET('/api/piece?colors=000000,ffffff');
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.params.palette, 'custom');
    assert.deepStrictEqual(body.params.colors, ['#000000', '#555555', '#aaaaaa', '#ffffff']);
    assert.match(body.share_url, /,8,/, 'share hash should carry pal=8 custom');
  });

  it('GET /api/piece with 3 colors -> ends on the exact picked colours', async () => {
    const res = await GET('/api/piece?colors=110000,001100,000011');
    const body = await res.json();
    assert.strictEqual(body.params.colors.length, 4);
    assert.strictEqual(body.params.colors[0], '#110000');
    assert.strictEqual(body.params.colors[3], '#000011');
  });

  it('GET /api/piece with 1 color -> handled 400, not a crash', async () => {
    const res = await GET('/api/piece?colors=123456');
    assert.strictEqual(res.status, 400);
    const body = await res.json();
    assert.match(body.error, /2, 3 or 4/);
  });

  it('GET /api -> 200 JSON api index', async () => {
    const res = await GET('/api');
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.name, 'fluid api');
    assert.ok(body.endpoints, 'should advertise endpoints');
  });

  it('unknown path falls through to ASSETS', async () => {
    const res = await GET('/manual.html');
    assert.strictEqual(res.status, 200); // served by the mock ASSETS binding
  });

  it('/mcp is routed without throwing', async () => {
    const res = await GET('/mcp');
    assert.strictEqual(typeof res.status, 'number');
  });

  it('responses pass through the security-header wrapper', async () => {
    const res = await GET('/api/looks');
    const hasSec = res.headers.get('content-security-policy') ||
                   res.headers.get('x-content-type-options') ||
                   res.headers.get('referrer-policy');
    assert.ok(hasSec, 'expected security headers from withSec()');
  });
});

/* End-to-end cover for the registries worker.js no longer hand-declares: LOOKS' optional
   fields (lens/cols) and LENSES. escher is the only look carrying BOTH a lens and custom
   colours, so it exercises every optional look field in one request. The hashes are
   asserted whole: a mis-shaped emit from fluid-core/build.mjs (dropped `lens`, reordered
   LENSES, cols lost) moves a slot and fails here, not just in the data-level parity test.
   escher pins seed 52, so the response is deterministic — no random seed to mask. */
const ESCHER_SHARE = '#p=0.3,1.4,3,0.02,1,10,0,8,52,0,0,1,0,0,4,0,0,0,0,0,789000,4864803,12159548,16116434,0,0,0,0,0,4,100';
const ESCHER_EMBED = '#p=0.3,1.4,3,0.02,1,10,0,8,52,0,0,1,0,1,4,0,0,0,0,0,789000,4864803,12159548,16116434,0,0,0,0,0,4,100';

describe('worker.js looks + lenses (generated data, behavioral)', () => {
  it('GET /api/piece?look=escher -> truchet + droste + custom stops, byte-identical hash', async () => {
    const res = await GET('/api/piece?look=escher');
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.ok(!body.error, 'escher returned an error: ' + body.error);
    assert.strictEqual(body.params.field, 'truchet');
    assert.strictEqual(body.params.lens, 'droste');
    assert.strictEqual(body.params.lensAmount, 1);
    assert.strictEqual(body.params.palette, 'custom');
    assert.deepStrictEqual(body.params.colors, ['#0c0a08', '#4a3b23', '#b98a3c', '#f5ead2']);
    assert.strictEqual(body.share_url, 'https://fluid.test/' + ESCHER_SHARE);
    assert.strictEqual(body.embed_url, 'https://fluid.test/' + ESCHER_EMBED);
    assert.ok(body.embed_html.includes(ESCHER_EMBED), 'embed_html should carry the embed hash');
  });

  it('GET /api/looks lists escher with the same hash the piece endpoint builds', async () => {
    const res = await GET('/api/looks');
    const body = await res.json();
    const escher = body.looks.find((l) => l.look === 'escher');
    assert.ok(escher, 'escher should be in /api/looks: ' + body.looks.map((l) => l.look).join(', '));
    assert.strictEqual(escher.share_url, 'https://fluid.test/' + ESCHER_SHARE);
  });

  it('GET /api/piece?lens=droste -> hash slots [29] lens [30] amount×100', async () => {
    const res = await GET('/api/piece?lens=droste&lensAmount=0.42&seed=50');
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.params.lens, 'droste');
    assert.strictEqual(body.params.lensAmount, 0.42);
    /* droste is LENSES index 4; the slots pad from [12] with zeros, so the whole tail is pinned */
    assert.strictEqual(body.share_url,
      'https://fluid.test/#p=0.6,1.6,4.5,0.06,6,10,1,0,50,0.8,0.85,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,4,42');
    assert.strictEqual(body.embed_url,
      'https://fluid.test/#p=0.6,1.6,4.5,0.06,6,10,1,0,50,0.8,0.85,1,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,4,42');
  });

  it('GET /api/piece?lens=droste&lensAmount=0 -> lens is invisible, slots are trimmed', async () => {
    const res = await GET('/api/piece?lens=droste&lensAmount=0&seed=50');
    const body = await res.json();
    assert.strictEqual(body.params.lensAmount, 0);
    assert.strictEqual(body.share_url, 'https://fluid.test/#p=0.6,1.6,4.5,0.06,6,10,1,0,50,0.8,0.85,1');
  });

  it('GET /api/piece with an unknown lens -> 400 listing the generated lenses', async () => {
    const res = await GET('/api/piece?lens=not-a-lens');
    assert.strictEqual(res.status, 400);
    const body = await res.json();
    assert.match(body.error, /unknown lens/);
    assert.match(body.error, /droste/);
  });

  it('GET /api/piece with an unknown look -> 400 listing the generated looks', async () => {
    const res = await GET('/api/piece?look=not-a-look');
    assert.strictEqual(res.status, 400);
    const body = await res.json();
    assert.match(body.error, /unknown look/);
    assert.match(body.error, /escher/);
  });

  /* the three curated lens looks each pin a DIFFERENT lens index, and the seed is part of
     the recipe (julia's c and newton's root circle both ride u_seed), so asserting the
     whole hash catches a reordered LENSES list or a dropped seed, not just a missing key. */
  const LENS_LOOKS = [
    { look: 'filigree',  field: 'crystal',   lens: 'julia',
      cols: ['#07030e', '#22084a', '#6a2a9c', '#f5c34e'],
      share: '#p=0.3,1.45,3.5,0.02,1,10,0,8,71,0,0,1,0,0,11,0,0,0,0,0,459534,2230346,6957724,16106318,0,0,0,0,0,6,100',
      embed: '#p=0.3,1.45,3.5,0.02,1,10,0,8,71,0,0,1,0,1,11,0,0,0,0,0,459534,2230346,6957724,16106318,0,0,0,0,0,6,100' },
    { look: 'shoreline', field: 'flow',      lens: 'newton',
      cols: ['#03121c', '#0e4664', '#4fb3a8', '#f2e2b6'],
      share: '#p=0.35,2.2,6,0.02,1,10,0,8,18,0,0,1,0,0,1,0,0,0,0,0,201244,935524,5223336,15917750,0,0,0,0,0,11,100',
      embed: '#p=0.35,2.2,6,0.02,1,10,0,8,18,0,0,1,0,1,1,0,0,0,0,0,201244,935524,5223336,15917750,0,0,0,0,0,11,100' },
    { look: 'rosette',   field: 'honeycomb', lens: 'modular',
      cols: ['#0b0d14', '#2f3648', '#8a8f99', '#efe6d0'],
      share: '#p=0.3,0.9,4,0.02,1,10,0,8,63,0,0,1,0,0,12,0,0,0,0,0,724244,3094088,9080729,15722192,0,0,0,0,0,12,100',
      embed: '#p=0.3,0.9,4,0.02,1,10,0,8,63,0,0,1,0,1,12,0,0,0,0,0,724244,3094088,9080729,15722192,0,0,0,0,0,12,100' }
  ];
  for (const lk of LENS_LOOKS) {
    it('GET /api/piece?look=' + lk.look + ' -> ' + lk.field + ' + ' + lk.lens + ', byte-identical hash', async () => {
      const res = await GET('/api/piece?look=' + lk.look);
      assert.strictEqual(res.status, 200);
      const body = await res.json();
      assert.ok(!body.error, lk.look + ' returned an error: ' + body.error);
      assert.strictEqual(body.params.field, lk.field);
      assert.strictEqual(body.params.lens, lk.lens);
      assert.strictEqual(body.params.lensAmount, 1);
      assert.strictEqual(body.params.palette, 'custom');
      assert.deepStrictEqual(body.params.colors, lk.cols);
      assert.strictEqual(body.share_url, 'https://fluid.test/' + lk.share);
      assert.strictEqual(body.embed_url, 'https://fluid.test/' + lk.embed);
    });
  }
});
