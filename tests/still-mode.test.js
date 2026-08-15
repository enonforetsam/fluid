'use strict';
/* "Still" means the frame is frozen for export. The cursor effect is a live interaction, and
   the loop advances state.t while a ripple is decaying — so if the pointer is allowed to pump
   the ripple in Still, moving the mouse across the artwork animates a piece the user
   deliberately stopped.

   This cannot be checked by rendering: the studio paints on requestAnimationFrame, and a
   headless or backgrounded tab freezes rAF, so the canvas is identical in BOTH modes and a
   pixel comparison passes whether the guard exists or not. It is pinned at the source instead,
   the same way FIELD_MAX and the section map are. */
const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const src = fs.readFileSync(path.resolve(__dirname, '..', 'index.html'), 'utf8');

function fnBody(name) {
  const i = src.indexOf('function ' + name + '(');
  assert.notStrictEqual(i, -1, 'function not found: ' + name);
  let j = src.indexOf('{', i), depth = 0;
  for (; j < src.length; j++) {
    if (src[j] === '{') depth++;
    else if (src[j] === '}') { if (--depth === 0) return src.slice(i, j + 1); }
  }
  throw new Error('unbalanced braces: ' + name);
}

describe('Still mode freezes the piece', () => {
  it('the pointer does not pump the cursor ripple unless the piece is playing', () => {
    const m = /if \(!panning && mouse\.mode > 0([^)]*)\)\{ mouse\.target = 1\.0;/.exec(src);
    assert.ok(m, 'the ripple pump in the canvas pointermove handler has moved or been rewritten');
    assert.match(m[1], /state\.playing/,
      'the ripple pump must be gated on state.playing — without it, hovering in Still advances ' +
      'state.t through the "ripple still decaying" branch of the animation loop and the frozen ' +
      'frame moves under the cursor');
  });

  it('switching to Still drops any ripple already in flight', () => {
    const body = fnBody('setPlaying');
    assert.match(body, /if \(!on\)\{[^}]*mouse\.amt = 0/,
      'setPlaying(false) must zero mouse.amt — otherwise an in-flight ripple keeps the clock ' +
      'advancing while it decays, so the piece carries on moving after being told to stop');
  });

  it('the loop still lets a live ripple settle', () => {
    /* the guard above must not be over-applied: while PLAYING, a decaying ripple still needs
       its frames, and that branch is what draws them */
    assert.match(src, /if \(!state\.playing && mouse\.amt > 0 && !warming && !recHiRes\)\{ state\.t \+= dt; \}/,
      'the decay branch itself should stay — it is reachable only with a ripple in flight, ' +
      'which Still now prevents at the source');
  });

  it('a still frame with nothing in flight asks for no repaints on pointer move', () => {
    assert.match(src, /if \(panning \|\| state\.playing \|\| mouse\.amt > 0\)\{ requestRender\(\); \}/,
      'moving the pointer over a frozen piece should not queue GPU work when nothing can change');
  });
});
