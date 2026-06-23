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

There is no package manifest, build step, framework, database, account system,
or server-side renderer.

## Render Pipeline

The app draws one full-screen triangle into a canvas. The fragment shader:

1. Quantizes screen coordinates when pixel, hex, ASCII, or dither surfaces are active.
2. Builds a scalar field using one of the field engines: noise, flow, cellular,
   gyroid, truchet, interfere, kaleido, lines, grid, golden, or smoke.
3. Optionally uses an uploaded image texture as luminance input for the field.
4. Maps the scalar field through a preset palette or a custom four-stop gradient.
5. Applies the selected surface mode and optional halftone dots.
6. Adds grain and vignette.

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
| 18 | reserved |
| 19 | reserved |
| 20-23 | packed custom gradient colors |
| 24 | dither threshold offset from `0.5` |

Defaults are trimmed from the end so older links stay short and continue to
parse correctly.

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
npx wrangler dev
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
