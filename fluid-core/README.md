# fluid-core

Fluid's field engines as a **zero-dependency native canvas library**. No iframe,
no build step, no framework — one ES module that draws the same art the
[studio](https://fluid.krackeddevs.com) draws, straight onto a canvas in your page.

## How it stays honest

The studio's `index.html` is the single source of truth. `build.mjs` mechanically
extracts the shader and every engine/palette/look table into `src/generated/`,
and `tests/fluid-core.test.js` (run by CI) fails if the generated files ever
differ from the studio. The package cannot drift.

```
index.html  ──(node fluid-core/build.mjs)──▶  src/generated/{shader,data}.js
                                              src/mount.js   (runtime, hand-written)
                                              src/index.js   (public API)
```

After changing engines/palettes/looks in `index.html`, re-run
`node fluid-core/build.mjs` and commit — the drift test enforces it.

## Use

```html
<div id="bg" style="position:fixed;inset:0;z-index:-1"></div>
<script type="module">
  import { createFluid } from './fluid-core/src/index.js';
  const art = createFluid(document.getElementById('bg'), {
    field: 'flow',          // noise | flow | cellular | gyroid | truchet | interfere | kaleido
                            // lines | grid | golden | smoke | crystal | honeycomb | bloom | sweep
    palette: 'sunset',      // aurora | sunset | ocean | dusk | ember | mint | iris | chrome
    speed: 0.6, zoom: 1.6, warp: 4.5, grain: 0.06,
    seed: 42                // omit for a fresh piece every load
  });
</script>
```

Or start from a curated studio look and override:

```js
createFluid(el, { look: 'BOREALIS', speed: 0.3 });
```

Custom 4-stop gradient (dark → light), a second layer, screens, materials:

```js
createFluid(el, {
  colors: ['#040414', '#0a3a7a', '#0484fc', '#c2dbdc'],
  layer: { field: 'crystal', blend: 'screen', mix: 0.4 },
  screen: 'hex',            // square | hex | ascii | dither | glitch
  material: 'molten'        // none | glass | metal | sand | liquid | molten
});
```

Instance API: `set(params)`, `play()`, `pause()`, `seed`, `toDataURL()`,
`shareUrl()` (opens the exact piece in the studio), `destroy()`.

## Good-citizen behaviours (built in)

- No `requestAnimationFrame` when static (`speed: 0`, `paused: true`, or
  `prefers-reduced-motion`) — a still piece costs nothing.
- Pauses when scrolled offscreen and when the tab is hidden.
- Renders at devicePixelRatio capped to a 4K pixel budget — big canvases
  never melt a GPU.
- Recovers from GPU context loss automatically.

## Scope

Pure field pieces: all 15 engines, layers, screens, materials, kaleidoscope
symmetry, palettes + custom gradients. Studio-only features (image melt, text
masks, cursor effects, recording) intentionally stay in the studio.
