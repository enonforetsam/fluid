<div align="center">

# fluid-bg

**Drop a live [Fluid](https://fluid.krackeddevs.com) generative background into any page.**

A `<fluid-bg>` web component, a React wrapper, and a CDN one-liner — one tag, zero setup, GPU-rendered.

**0.2.0: renders natively on a canvas in your page — no iframe.** All 15 engines are bundled
(~15 KB gzipped), generated straight from the studio with a CI drift guard. Zero animation
frames when static, pauses offscreen and in hidden tabs, respects `prefers-reduced-motion`,
works offline. The 0.1.x iframe embed remains as an automatic fallback when WebGL is
unavailable (or on request with `mode="iframe"`).

[![npm](https://img.shields.io/npm/v/fluid-bg.svg)](https://www.npmjs.com/package/fluid-bg)
&nbsp;[![License: MIT](https://img.shields.io/badge/license-MIT-3a1f7a.svg)](LICENSE)
&nbsp;[![Studio](https://img.shields.io/badge/design%20a%20look-fluid.krackeddevs.com-c84fe0.svg)](https://fluid.krackeddevs.com)

</div>

---

## CDN — the one-liner

```html
<script src="https://cdn.jsdelivr.net/npm/fluid-bg"></script>

<fluid-bg fixed></fluid-bg>     <!-- full-viewport background, behind everything -->
```

That's it. Put your content anywhere with `position: relative; z-index: 1` and it sits on top.

> ### Using `fixed`? Keep the page background transparent
>
> A `fixed` background sits **behind** the page at `z-index: -1`. If your `<body>` or
> `<html>` has an **opaque** background colour, it paints right over the background and
> you'll see nothing — usually a black or white screen that looks like `fluid-bg` is broken.
> It isn't; the page is simply in front of it. Keep the page background transparent:
>
> ```css
> html, body { background: transparent; }
> ```
>
> (`fluid-bg` will `console.warn` with this exact fix if it detects an opaque page
> background behind a `fixed` instance.) Alternatively, raise `z` above your page background.

> **No studio flash on load.** Native mode never had one; the `mode="iframe"` fallback
> gets its chrome-less mode decided server-side before first paint, so it doesn't either.

## npm

```sh
npm install fluid-bg
```

```js
import "fluid-bg";            // registers the <fluid-bg> element
```

```html
<fluid-bg hash="#p=0.4,1.9,8,0.03,1,10,0,4,60,0,0,1.7778,0,0,2"></fluid-bg>
```

Design any look in the [studio](https://fluid.krackeddevs.com), hit **Copy share link**, and paste the
hash into `hash`. Or browse the [gallery](https://fluid.krackeddevs.com/gallery) and grab one. The
embed flag is set for you, so a plain share link works.

## React

```sh
npm install fluid-bg react
```

```jsx
import { FluidBg } from "fluid-bg/react";

export default function App() {
  return (
    <>
      <FluidBg fixed hash="#p=0.5,1.5,5.5,0.03,1,10,0,0,18,0,0,1.7778" />
      <main>your content on top</main>
    </>
  );
}
```

## Imperative (vanilla JS)

```js
import { fluidBackground } from "fluid-bg/core";

const bg = fluidBackground(document.querySelector("#hero"), {
  hash: "#p=0.4,1.6,5,0.03,1,10,0,5,40,0,0,1.7778,0,0,3",
});
// later: bg.destroy();
```

---

## Options

| Attribute / prop | Type | Default | What it does |
|---|---|---|---|
| `hash` | string | a calm built-in look | A Fluid share hash (`#p=…`). Embed flag is applied automatically. |
| `fixed` | boolean | `false` | Pin as a fixed, full-viewport background (`z-index:-1`, `pointer-events:none`). Otherwise fills the parent element. |
| `z` | number | `-1` | `z-index` when `fixed`. |
| `mode` | `"native"` \| `"iframe"` | `"native"` | `native` draws on a canvas in your page (bundled engines). `iframe` embeds the hosted studio like 0.1.x. Native falls back to the iframe automatically when WebGL is unavailable. |
| `base` | string | `https://fluid.krackeddevs.com` | Point at your own [self-hosted Fluid](https://github.com/enonforetsam/fluid) instance (`iframe` mode). |

Filling a parent (not `fixed`)? Give the parent a size — the background fills it edge to edge:

```html
<section style="position:relative;height:60vh">
  <fluid-bg></fluid-bg>
  <h1 style="position:relative;z-index:1">Hello</h1>
</section>
```

---

## How it works

`fluid-bg` bundles **fluid-core** — Fluid's engines extracted mechanically from the studio's
source with a CI drift guard, so the package renders exactly what the studio renders. Your
share hash is decoded locally and drawn on a WebGL canvas right in your page: no iframe, no
network dependency, no third-party document.

Embed etiquette is built in:

- **Zero cost when static** — `speed 0` (or `prefers-reduced-motion`) means no
  `requestAnimationFrame` at all, not a hidden 60 fps loop.
- **Pauses when it can't be seen** — scrolled offscreen or a hidden tab.
- **Pixel budget** — renders at devicePixelRatio capped to a 4K budget, so a huge hero
  canvas never melts a laptop.
- **Recovers from GPU context loss** automatically.
- The background is `aria-hidden` and `pointer-events:none` — decorative, never steals
  focus or clicks.

Native mode returns a handle with `pause()` / `play()` if you want to control it.

If WebGL is unavailable, `fluid-bg` automatically falls back to the 0.1.x `<iframe>` embed of
the hosted studio (which has its own 2D fallback) — set `mode="iframe"` to force that path, and
`base` to point it at a [self-hosted Fluid](https://github.com/enonforetsam/fluid).

## License

MIT — free forever, personal or commercial.
