const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const WORKER_PATH = path.resolve(__dirname, '..', 'worker.js');
const workerSrc = fs.readFileSync(WORKER_PATH, 'utf8');

describe('worker.js', () => {
  it('parses without syntax errors', async () => {
    // worker.js uses ESM (export default) so we parse via dynamic import with data URI
    const encoded = Buffer.from(workerSrc).toString('base64');
    // Replace the env.ASSETS.fetch reference so the module can load without a real env
    const patched = workerSrc.replace(/env\.ASSETS\.fetch/g, '(() => { throw new Error("mock") })');
    const encodedPatched = Buffer.from(patched).toString('base64');
    await assert.doesNotReject(() => import('data:text/javascript;base64,' + encodedPatched));
  });

  it('defines LOOKS object with expected keys', () => {
    assert.ok(workerSrc.includes('var LOOKS'), 'LOOKS variable not found');
    assert.ok(workerSrc.includes('borealis'), 'borealis look not found');
    assert.ok(workerSrc.includes('sunset') || workerSrc.includes("palette"), 'palette references not found');
  });

  it('defines FIELDS array', () => {
    assert.ok(workerSrc.includes('var FIELDS'), 'FIELDS variable not found');
    assert.ok(workerSrc.includes("'noise'"), 'noise field not found');
  });

  it('defines PALETTES array', () => {
    assert.ok(workerSrc.includes('var PALETTES'), 'PALETTES variable not found');
    assert.ok(workerSrc.includes("'aurora'"), 'aurora palette not found');
  });

  it('exports a default fetch handler', () => {
    assert.ok(workerSrc.includes('export default'), 'no export default found');
    assert.ok(/async\s+fetch\s*\(/.test(workerSrc), 'no async fetch handler found');
  });

  it('handles /api/looks route', () => {
    assert.ok(workerSrc.includes("'/api/looks'"), 'missing /api/looks route');
  });

  it('handles /api/piece route', () => {
    assert.ok(workerSrc.includes("'/api/piece'"), 'missing /api/piece route');
  });

  it('handles /mcp route', () => {
    assert.ok(workerSrc.includes("'/mcp'"), 'missing /mcp route');
  });

  it('has no hardcoded console.log in production paths', () => {
    // console.log in a Workers handler = billable GB-seconds wasted
    const lines = workerSrc.split('\n');
    const logLines = lines.filter(l => l.includes('console.log') && !l.trim().startsWith('//'));
    assert.strictEqual(logLines.length, 0, `Found console.log in production code: ${logLines.join('; ')}`);
  });
});
