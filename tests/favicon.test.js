const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const FAVICON_PATH = path.resolve(__dirname, '..', 'assets', 'fluid-favicon.js');
const src = fs.readFileSync(FAVICON_PATH, 'utf8');

describe('fluid-favicon.js', () => {
  it('parses without syntax errors', () => {
    assert.doesNotThrow(() => {
      new Function(src);
    });
  });

  it('is wrapped in an IIFE', () => {
    assert.ok(src.trimStart().startsWith('(function'), 'should start with an IIFE');
  });

  it('uses strict mode', () => {
    assert.ok(src.includes("'use strict'"), "missing 'use strict'");
  });

  it('has no empty catch blocks', () => {
    // Match catch blocks with only whitespace or nothing between braces
    const emptyCatches = src.match(/catch\s*\([^)]*\)\s*\{\s*\}/g);
    assert.strictEqual(emptyCatches, null, `Found empty catch block(s): ${emptyCatches}`);
  });

  it('handles visibility change', () => {
    assert.ok(src.includes('visibilitychange'), 'should listen for visibilitychange to pause/resume');
  });

  it('respects prefers-reduced-motion', () => {
    assert.ok(src.includes('prefers-reduced-motion') || src.includes('prefersReduced'),
      'should respect prefers-reduced-motion');
  });
});
