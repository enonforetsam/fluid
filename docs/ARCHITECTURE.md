# Fluid Architecture

Fluid is a dependency-free generative background studio. The app runs in the
browser, renders with WebGL1, and can be hosted as static files. The Cloudflare
Worker adds security headers, Open Graph image rotation, a JSON API, and a
Streamable HTTP MCP endpoint.

## Runtime Files

| File | Purpose |
|---|---|
| `index.html` | Full studio UI, WebGL shader, parameter state, export, recording, sharing |
| `worker.js` | Cloudflare Worker, static asset passthrough, headers, `/api/*`, `/mcp`, `/og.jpg`, `/favicon.ico` |
| `gallery.html` | Curated gallery backed by static images in `assets/gallery/` |
| `manual.html` | End-user reference |
| `dev.html` | Embed, MCP, and JSON API reference |
| `assets/fluid-favicon.js` | Low-rate animated favicon for browser tabs |

The studio needs no build step, framework, database, account system, or server-side renderer.
Package manifests provide verification and the optional native-library/background builds.

## Render Pipeline

The app draws one full-screen triangle into a canvas. The fragment shader:

1. Quantizes screen coordinates when pixel, hex, ASCII, or dither surfaces are active.
2. Builds a scalar field using one of the field engines: noise, flow, cellular,
   gyroid, truchet, interfere, kaleido, lines, grid, golden, smoke, crystal,
   honeycomb, bloom, sweep, marble, plaid, curtain, stitch, pursuit, chladni,
   cassini, topo, eddy, wash, spray, brushwork, strata, terrazzo, or woodgrain.
3. Optionally uses an uploaded image texture as luminance input for the field.
4. Maps the scalar field through a preset palette or a custom four-stop gradient.
5. Shades the finish (including procedural pigment, bristles, overspray, and glaze) and mixes it with the palette using finish strength.
6. Applies the selected screen mode and optional halftone dots.
7. Applies the independent substrate texture, then grain and vignette.

Artistic detail uses height-normalized artwork coordinates, divided by `textureScale`, so a
larger export retains the material’s composition rather than multiplying its texture frequency.
These are procedural visual models, not a simulation of pigment drying or physical paint flow.

Every screen-space shader size is multiplied by the render scale `k` passed to
`render(k)`. This keeps high-resolution exports visually aligned with the live
canvas.

## Share Hash Contract

Share links use `#p=` followed by comma-separated numeric fields. The order is
append-only; new parameters must be appended at the end.

| Index | Value |
|---:|---|
| 0 | speed |
| 1 | scale |
| 2 | warp |
| 3 | grain |
| 4 | pixel size |
| 5 | halftone dot size |
| 6 | halftone enabled |
| 7 | palette |
| 8 | seed |
| 9 | liquify |
| 10 | image blend |
| 11 | aspect ratio |
| 12 | source preset |
| 13 | embed mode |
| 14 | field engine |
| 15 | surface mode |
| 16 | image pan X |
| 17 | image pan Y |
| 18 | symmetry (kaleidoscope fold) |
| 19 | reserved |
| 20-23 | packed custom gradient colors |
| 24 | dither threshold offset from `0.5` |
| 25 | layer 2 field engine |
| 26 | layer 2 blend mode |
| 27 | layer 2 mix × 100 |
| 28 | material finish |
| 29 | math lens |
| 30 | lens amount × 100 |
| 31 | layer 3 field engine |
| 32 | layer 3 blend mode |
| 33 | layer 3 mix × 100 |
| 34 | substrate: 0 none, 1 canvas, 2 paper, 3 concrete, 4 stone, 5 wood, 6 plaster |
| 35 | (finish strength − 1) × 100 |
| 36 | (texture scale − 1) × 100 |
| 37 | (relief − 1) × 100 |
| 38 | (substrate strength − 0.55) × 100 |

Defaults are trimmed from the end so older links stay short and continue to
parse correctly. Slots 34–38 use offsets so default values remain zero; a strength of
zero is explicit, not mistaken for an absent setting. When padding beyond a missing lens
block, slot 30 must be 100 (the historic full-strength lens default). Existing engine and
finish IDs are never reordered; v3.3 appends fields 24–29 and finishes 7–12.

## Worker Mirror

`worker.js` mirrors the app's public parameter model for API and MCP output:

- field names
- surface names
- palette names
- curated looks
- default values
- share-hash encoding and decoding

When adding an app feature that appears in a link or API response, update both
`index.html` and `worker.js`.

## Deployment

Local app-only testing can use `open index.html`. Full Worker behavior uses:

```sh
npm run dev
```

Production deploy:

```sh
npx wrangler deploy
```

Staging deploy:

```sh
npx wrangler deploy --env staging
```

`.assetsignore` excludes repo documentation and development-only files from the
Cloudflare static asset bundle.

## Verification

Before publishing changes:

```sh
node -e "const fs=require('fs');new Function(fs.readFileSync('index.html','utf8').match(/<script>([\\s\\S]*)<\\/script>/)[1]);console.log('script ok')"
node --check worker.js
node --check assets/fluid-favicon.js
```

For UI or rendering changes, verify at desktop and mobile sizes that the canvas
is nonblank, field and surface switches update immediately, share links
round-trip, and image export still matches the live canvas.

## Regeneration and GPU verification

```sh
node fluid-core/build.mjs
npm install --prefix fluid-bg
npm run build --prefix fluid-bg
npm test
python3 -m http.server 8103
# Open http://localhost:8103/tests/browser-art.html in a WebGL-capable browser.
```

The unit suite checks mirror drift, old links, zero-strength controls, recipe/API parity,
and the self-hosted bundle’s source checksum. The browser page checks every engine, finish,
substrate, and screen combination with art materials; it compares each artist recipe with
its share-hash reconstruction pixel-for-pixel. Timings include readback and are hardware-specific.
