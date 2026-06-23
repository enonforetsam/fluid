'use strict';
/* The shader has no GPU in CI, so a GLSL/wiring mistake can't be caught by compiling.
   This guards the most common one: every `uniform` declared in the fragment shader must
   get a getUniformLocation entry in the U-map forEach list, and every wired name must be
   a real declared uniform (no typos). This is the exact class of bug that shipped before
   (a uniform added to the shader but missing from the location list renders as a no-op). */
const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const src = fs.readFileSync(path.resolve(__dirname, '..', 'index.html'), 'utf8');

describe('shader uniform wiring', () => {
  it('every declared uniform is wired, and no location is wired without a declaration', () => {
    // declarations inside the GLSL string array: 'uniform <type> u_name;'
    const declared = new Set();
    let m;
    const declRe = /'uniform\s+\w+\s+(u_\w+)\s*;'/g;
    while ((m = declRe.exec(src))) { declared.add(m[1]); }
    assert.ok(declared.size > 5, `expected to find the shader uniforms; found ${declared.size}`);

    // the location list: [ 'u_res', 'u_time', ... ].forEach(function(n){ U[n] = gl.getUniformLocation(prog, n) })
    const block = src.match(/\[([^\]]*?)\]\.forEach\(function\(n\)\{[\s\S]*?U\[n\]\s*=\s*gl\.getUniformLocation/);
    assert.ok(block, 'could not locate the uniform-location forEach list');
    const wired = new Set();
    const wRe = /'(u_\w+)'/g;
    while ((m = wRe.exec(block[1]))) { wired.add(m[1]); }

    const missing = [...declared].filter((u) => !wired.has(u)).sort();
    const phantom = [...wired].filter((u) => !declared.has(u)).sort();
    assert.deepStrictEqual(missing, [], `uniforms declared in the shader but never wired: ${missing.join(', ')}`);
    assert.deepStrictEqual(phantom, [], `locations wired but not declared in the shader (typo?): ${phantom.join(', ')}`);
  });
});
