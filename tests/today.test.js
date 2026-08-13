'use strict';
/* Seed of the day is a promise about SAMENESS: every visitor, every edge location, every
   process must see the same piece on the same UTC day, and yesterday must still be
   reproducible tomorrow. That promise is only worth anything if it is pinned — a stray
   Math.random() or Date.now() in the derivation would break it silently, with the bug
   visible only as two people disagreeing about what today looks like. */
const { describe, it } = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const WORKER_PATH = path.resolve(__dirname, '..', 'worker.js');
let handlerPromise;
function loadWorker() {
  if (!handlerPromise) {
    handlerPromise = import(pathToFileURL(WORKER_PATH).href).then((m) => m.default);
  }
  return handlerPromise;
}
const mockEnv = {
  STAGE: 'test',
  ASSETS: { fetch: async () => new Response('<!DOCTYPE html><html></html>', { status: 200 }) }
};
async function GET(pathname) {
  const w = await loadWorker();
  return w.fetch(new Request('https://fluid.test' + pathname), mockEnv);
}

describe('seed of the day', () => {
  it('GET /api/today -> 200 JSON piece with a share URL and the day it belongs to', async () => {
    const res = await GET('/api/today');
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.ok(!body.error, 'today returned an error: ' + body.error);
    assert.match(body.date, /^\d{4}-\d{2}-\d{2}$/, 'date must be a plain UTC calendar day');
    assert.match(body.share_url, /#p=[\d.,-]+$/, 'share_url must carry a numeric hash');
    assert.ok(body.look, 'the piece should name the curated look it grew from');
  });

  it('the same date always yields a byte-identical hash', async () => {
    const a = await (await GET('/api/today?date=2026-08-13')).json();
    const b = await (await GET('/api/today?date=2026-08-13')).json();
    assert.strictEqual(a.share_url, b.share_url, 'two requests for one day disagreed — the derivation is not pure');
    assert.strictEqual(a.look, b.look);
  });

  it('different dates yield different pieces', async () => {
    const days = ['2026-08-13', '2026-08-14', '2026-08-15', '2026-08-16', '2026-08-17'];
    const seen = new Set();
    for (const d of days) {
      const body = await (await GET('/api/today?date=' + d)).json();
      seen.add(body.share_url);
    }
    assert.strictEqual(seen.size, days.length, 'consecutive days collided — the date is barely reaching the seed');
  });

  it('a year of days spreads across looks rather than sticking on one', async () => {
    const looks = new Set();
    for (let i = 0; i < 120; i++) {
      const d = new Date(Date.UTC(2026, 0, 1) + i * 86400000).toISOString().slice(0, 10);
      const body = await (await GET('/api/today?date=' + d)).json();
      looks.add(body.look);
      assert.ok(body.share_url.includes('#p='), `${d} produced no hash`);
    }
    assert.ok(looks.size >= 15, `120 days only reached ${looks.size} looks — the distribution is lumpy`);
  });

  it('a malformed date is rejected rather than silently treated as today', async () => {
    const res = await GET('/api/today?date=lol');
    assert.strictEqual(res.status, 400);
    const body = await res.json();
    assert.ok(body.error, 'expected an error message naming the expected format');
  });

  it('GET /today -> 302 into the studio on that day piece, not a permanent redirect', async () => {
    const res = await GET('/today');
    assert.strictEqual(res.status, 302, '301 would stick in caches after the day rolls over');
    const loc = res.headers.get('location');
    assert.match(loc, /#p=[\d.,-]+$/, 'should land on a share hash');
    const body = await (await GET('/api/today')).json();
    assert.strictEqual(loc, body.share_url, '/today and /api/today must agree on the piece');
  });

  it('every generated day parses back to a valid piece', async () => {
    /* the hash is the whole contract — a day that produces an unparseable one is a dead link */
    for (let i = 0; i < 40; i++) {
      const d = new Date(Date.UTC(2026, 5, 1) + i * 86400000).toISOString().slice(0, 10);
      const body = await (await GET('/api/today?date=' + d)).json();
      const nums = body.share_url.split('#p=')[1].split(',').map(Number);
      assert.ok(nums.length >= 12, `${d}: hash has ${nums.length} slots, the parser needs 12`);
      assert.ok(!nums.some(Number.isNaN), `${d}: hash carries a non-numeric slot`);
      assert.strictEqual(Math.round(nums[13] || 0), 0, `${d}: the day piece must not be flagged embed-only`);
    }
  });
});
