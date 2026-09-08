# fluid-core

Fluid's field engines as a **zero-dependency native canvas library**. No iframe,
no build step, no framework — one ES module that draws the same art the
[studio](https://befluid.xyz) draws, straight onto a canvas in your page.

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

## Install v3.3.0

The release archive contains the new engine. Older npm versions do not include these materials.

```sh
npm install https://github.com/enonforetsam/fluid/releases/download/v3.3.0/fluid-core-3.3.0.tgz
```

…or import it with no npm at all — the module is pure ESM with zero dependencies:

```js
import { createFluid } from 'https://befluid.xyz/fluid-core/src/index.js';
```

TypeScript types ship with the package. Want a drop-in `<fluid-bg>` element or React
component instead of the raw API? That's [fluid-bg](https://www.npmjs.com/package/fluid-bg),
built on this library.

## Use

```html
<div id="bg" style="position:fixed;inset:0;z-index:-1"></div>
<script type="module">
  import { createFluid } from 'fluid-core';
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

Custom 4-stop gradient (dark → light), stacked layers, screens, materials:

```js
createFluid(el, {
  colors: ['#040414', '#0a3a7a', '#0484fc', '#c2dbdc'],
  layer:  { field: 'crystal', blend: 'screen', mix: 0.4 },
  // a third engine, blended onto layer 2's result — it needs `layer` to do anything
  layer2: { field: 'topo', blend: 'multiply', mix: 0.3 },
  screen: 'hex',            // square | hex | ascii | dither | glitch
  material: 'watercolor',   // also glass, metal, sand, liquid, molten, paint, graffiti,
                            // charcoal, pastel, ink, ceramic, or none
  substrate: 'paper',       // none | canvas | paper | concrete | stone | wood | plaster
  materialAmt: 0.9,         // 0–1, default 1
  textureScale: 1.4,        // 0.25–4, larger = larger texture features
  relief: 0.8,              // 0–2, default 1
  substrateAmt: 0.55,       // 0–1, default 0.55
  lens: 'mobius',           // math lens: square | invert | mobius | droste | hyperbolic |
                            //   julia | cube | exp | sine | joukowski | newton | modular | ground
  lensAmt: 0.8              // lens strength 0-1 (default 1)
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

Pure field pieces: all 30 engines, up to three stacked layers, screens, materials, math lenses,
kaleidoscope symmetry, palettes + custom gradients. Studio-only features (image melt, text
masks, cursor effects, recording) intentionally stay in the studio.

## Material Studio

New field names: `wash`, `spray`, `brushwork`, `strata`, `terrazzo`, `woodgrain`.
`FIELDS`, `MATERIALS`, `SUBSTRATES`, `LENSES`, `LOOKS`, and `VERSION` are exported for custom UIs.
Selecting a `look` replaces the previous layers and material settings; pass overrides in the
same call to customize it. See the [complete material guide](../docs/MATERIALS.md).
