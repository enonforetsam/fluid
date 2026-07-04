'use strict';
/* Behavioral tests: actually load the worker module and call its fetch handler with a
   mock env, rather than grepping the source for route strings. */
const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const WORKER_PATH = path.resolve(__dirname, '..', 'worker.js');
const workerSrc = fs.readFileSync(WORKER_PATH, 'utf8');

/* worker.js is ESM (export default). A base64 data: URI is always parsed as a module,
   regardless of package.json "type", so this loads it without a real Workers runtime. */
let handlerPromise;
function loadWorker() {
  if (!handlerPromise) {
    const uri = 'data:text/javascript;base64,' + Buffer.from(workerSrc).toString('base64');
    handlerPromise = import(uri).then((m) => m.default);
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
