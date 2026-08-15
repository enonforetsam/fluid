'use strict';
/* The eddy engine is a von Karman vortex street, which is a specific object rather than a
   general "swirly" look: two rows of counter-rotating vortices, the lower row displaced half a
   wavelength downstream. Drop that displacement and the rows sit in phase — the wake pairs up,
   the stagger disappears, and what is left is a symmetric ripple that no longer describes
   anything shed by a cylinder. The same is true of the stability ratio and of the overflow-safe
   log: each is load-bearing, and each is a single constant that a later tidy-up could "simplify"
   without the picture obviously breaking on the screen it was tested at.

   Pinned at the source, like FIELD_MAX and the Still guard: the field is GLSL evaluated on the
   GPU, so there is no way to assert on its output from node. */
const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const src = fs.readFileSync(path.resolve(__dirname, '..', 'index.html'), 'utf8');
/* the shader lives as an array of quoted JS lines; unwrap so the GLSL can be matched directly */
const glsl = src.split('\n')
  .map((l) => { const m = /^\s*'(.*)',?\s*$/.exec(l); return m ? m[1].replace(/\\'/g, "'") : ''; })
  .join('\n');

describe('eddy engine — von Karman vortex street', () => {
  it('is registered and reachable from the field switch', () => {
    assert.match(src, /data-field="23"[^>]*title="Eddy"/,
      'the picker needs an Eddy tile at index 23 — the engine list is derived from the markup');
    assert.match(glsl, /else if \(eng == 23\)\{ return fieldEddy\(p, t\); \}/,
      'fieldOf must dispatch 23 to fieldEddy, or the engine is unreachable in every layer');
  });

  it('the two rows are staggered by half a wavelength', () => {
    const body = /float fieldEddy\(vec2 p, float t\)\{([\s\S]*?)\n\}/.exec(glsl);
    assert.ok(body, 'fieldEddy has moved or been renamed');
    const upper = /float up = lnCoshCos\(\(p\.y - h\) \* k, cos\(x \* k\)\);/.test(body[1]);
    const lower = /float lo = lnCoshCos\(\(p\.y \+ h\) \* k, cos\(\(x - a \* 0\.5\) \* k\)\);/.test(body[1]);
    assert.ok(upper, 'the upper row should sample at +h with no phase offset');
    assert.ok(lower,
      'the lower row must sit at -h AND half a wavelength downstream (x - a * 0.5). Without ' +
      'that offset the rows are in phase, the vortices pair instead of staggering, and it is ' +
      'no longer a Karman street');
    assert.match(body[1], /float psi = g \* \(up - lo\);/,
      'the rows carry opposite circulation — psi is their difference, not their sum');
  });

  it('holds the von Karman stability ratio', () => {
    assert.match(glsl, /float h = 0\.281 \* a;/,
      'h/a = 0.281 is the one row separation at which the street is neutrally stable; it is a ' +
      'result, not a taste setting');
  });

  it('the log cannot overflow at the zoom levels the studio reaches', () => {
    const body = /float lnCoshCos\(float y, float cx\)\{([\s\S]*?)\n\}/.exec(glsl);
    assert.ok(body, 'lnCoshCos has moved or been renamed');
    assert.match(body[1], /float e = exp\(-ay\);/,
      'the identity must be evaluated with exp(-|y|), which is bounded by 1. Writing it the ' +
      'direct way as log(cosh(y) - cos(x)) leaves float range near |y| = 88, and zoom gets there');
    assert.match(body[1], /max\(1\.0 \+ e \* e - 2\.0 \* cx \* e, 1e-5\)/,
      'the remainder is zero exactly at a vortex core, so it needs a floor before the log — ' +
      'that singularity is the eye of the eddy and must clamp, not go infinite');
  });

  it('warp drives circulation, not the wavelength', () => {
    const body = /float fieldEddy\(vec2 p, float t\)\{([\s\S]*?)\n\}/.exec(glsl);
    assert.match(body[1], /float g = [\d.]+ \+ u_warp \* [\d.]+;/,
      'u_warp should set circulation g');
    assert.ok(!/float a = [^;]*u_warp/.test(body[1]),
      'the wavelength must NOT ride on warp — the spacing of a shed wake is set by the body ' +
      'and the flow speed, and letting warp stretch it turns the control into a zoom');
  });
});
