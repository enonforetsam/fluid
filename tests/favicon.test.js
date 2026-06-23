'use strict';
/* The animated favicon runs on every page. Guard its shape: parses, self-contained
   IIFE, no silent-swallow catch blocks, and respects user preferences. */
const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const FAVICON_PATH = path.resolve(__dirname, '..', 'assets', 'fluid-favicon.js');
const src = fs.readFileSync(FAVICON_PATH, 'utf8');

describe('fluid-favicon.js', () => {
  it('parses without syntax errors', () => {
    assert.doesNotThrow(() => new Function(src));
  });
  it('is a self-contained IIFE', () => {
    assert.ok(src.trimStart().startsWith('(function'), 'should start with an IIFE');
  });
  it("uses 'use strict'", () => {
    assert.ok(src.includes("'use strict'"), "missing 'use strict'");
  });
  it('has no empty catch blocks (no silent failures)', () => {
    const empties = src.match(/catch\s*\([^)]*\)\s*\{\s*\}/g);
    assert.strictEqual(empties, null, `found empty catch block(s): ${empties}`);
  });
  it('pauses/resumes on visibilitychange', () => {
    assert.ok(src.includes('visibilitychange'), 'should listen for visibilitychange');
  });
  it('respects prefers-reduced-motion', () => {
    assert.ok(src.includes('prefers-reduced-motion') || src.includes('prefersReduced'),
      'should respect reduced-motion');
  });
});
