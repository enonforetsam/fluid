'use strict';
/* The eddy engine is a von Karman vortex street, which is a specific object rather than a
   general "swirly" look: two rows of counter-rotating vortices, the lower row displaced half a
   wavelength downstream. Drop that displacement and the rows sit in phase — the wake pairs up,
   the stagger disappears, and what is left is a symmetric ripple that no longer describes
   anything shed by a cylinder.

   It also has to MOVE like a wake. The first cut drew the stream function, which is correct and
   completely dead on screen: a steady field translating is a scrolling wallpaper. The motion
   comes from tracing each pixel backwards along the velocity field, back in time as it goes, and
   sampling the dye it started as — a streakline. Take the time-stepping out and the picture
   goes rigid again while still looking plausible in a screenshot, so it is pinned here.

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
const fnBody = (name, sig) => {
  const re = new RegExp('(?:float|vec2) ' + name + '\\(' + sig + '\\)\\{([\\s\\S]*?)\\n\\}');
  const m = re.exec(glsl);
  assert.ok(m, name + ' has moved or been renamed');
  return m[1];
};

describe('eddy engine — von Karman vortex street', () => {
  it('is registered and reachable from the field switch', () => {
    assert.match(src, /data-field="23"[^>]*title="Eddy"/,
      'the picker needs an Eddy tile at index 23 — the engine list is derived from the markup');
    assert.match(glsl, /else if \(eng == 23\)\{ return fieldEddy\(p, t\); \}/,
      'fieldOf must dispatch 23 to fieldEddy, or the engine is unreachable in every layer');
  });

  it('the two rows are staggered by half a wavelength, with opposite circulation', () => {
    const body = fnBody('fieldEddy', 'vec2 p, float t');
    assert.match(body, /eddyRowVel\(q, vec2\(xs, yc \+ h\), a, gt\);/,
      'the upper row sits half a separation above the centreline, with no phase offset and ' +
      'positive circulation');
    assert.match(body, /eddyRowVel\(q, vec2\(xs \+ a \* 0\.5, yc - h\), a, -gt\);/,
      'the lower row must sit below the centreline, half a wavelength downstream ' +
      '(xs + a * 0.5), and carry -gt. In phase, or co-rotating, the vortices pair instead of ' +
      'staggering and it stops being a Karman street');
  });

  it('holds the von Karman stability ratio', () => {
    assert.match(glsl, /float h = 0\.281 \* a;/,
      'h/a = 0.281 is the one row separation at which the street is neutrally stable; it is a ' +
      'result, not a taste setting');
  });

  it('the dye is advected backwards through the velocity field, and back in time with it', () => {
    const body = fnBody('fieldEddy', 'vec2 p, float t');
    assert.match(body, /for \(int i = 0; i < \d+; i\+\+\)\{/,
      'the streakline needs an integration loop');
    assert.match(body, /q -= v \* dt;/,
      'the trace must step BACKWARDS along the velocity — forwards gives where the fluid is ' +
      'going, which is not what dye already in the frame shows');
    assert.match(body, /tau -= dt;/,
      'time must step back with the position. Freeze tau and the field is steady in the ' +
      'co-moving frame, the trace collapses onto streamlines, and the wake goes back to being ' +
      'a rigid pattern sliding sideways — which still screenshots fine, so nothing else catches it');
    assert.match(body, /float xs = tau \* U;/,
      'the street position has to be evaluated at the stepped-back time, or the history is ' +
      'traced through a wake that never moved');
  });

  it('the wake evolves rather than scrolling rigidly', () => {
    /* Backward tracing alone does not buy motion. With a steady street the induced field is a
       function of (x - U tau) and the dye a function of y alone, so the frame at (p + U dt,
       t + dt) is identical to the one at (p, t) — the piece slides sideways unchanged, which is
       exactly the "it looks static" this engine was rewritten to fix. Two slow modulations
       break that symmetry, and both have to survive: strip either and the picture still looks
       right in a screenshot while going rigid in motion, which no other check would catch. */
    const body = fnBody('fieldEddy', 'vec2 p, float t');
    assert.match(body, /float breathe = 1\.0 \+ [\d.]+ \* sin\(tau \* [\d.]+\);/,
      'circulation must pulse with tau — the shedding rhythm. A constant g leaves the field ' +
      'steady in the co-moving frame');
    assert.match(body, /float yc = [\d.]+ \* a \* sin\(tau \* [\d.]+ \+ q\.x \* [\d.]+\);/,
      'the centreline must wander with both tau and x (vortex wander). A meander in x alone ' +
      'travels with the street and changes nothing');
    assert.match(body, /vec2\(xs, yc \+ h\)/,
      'the meander has to reach the row centres, not just be computed');
    assert.match(body, /vec2\(xs \+ a \* 0\.5, yc - h\)/,
      'both rows ride the same wandering centreline, or the street tears in half');
  });

  it('the induced velocity survives the range zoom reaches', () => {
    const body = fnBody('eddyRowVel', 'vec2 p, vec2 c, float a, float g');
    assert.match(body, /clamp\(\(p\.y - c\.y\) \* k, -8\.0, 8\.0\)/,
      'cosh leaves float range near 88 and zoom gets there. Past the clamp the row is uniform ' +
      'shear, which is what the ratio tends to anyway');
    assert.match(body, /max\(ch - cos\(2\.0 \* xi\), 1e-4\)/,
      'the denominator vanishes at a vortex core, where the induced velocity really is infinite ' +
      '— it needs a floor or the trace launches to infinity and the core renders as a hole');
  });

  it('warp drives circulation, not the wavelength', () => {
    const body = fnBody('fieldEddy', 'vec2 p, float t');
    assert.match(body, /float g = [\d.]+ \+ u_warp \* [\d.]+;/,
      'u_warp should set circulation g');
    assert.ok(!/float a = [^;]*u_warp/.test(body),
      'the wavelength must NOT ride on warp — the spacing of a shed wake is set by the body ' +
      'and the flow speed, and letting warp stretch it turns the control into a zoom');
  });
});
