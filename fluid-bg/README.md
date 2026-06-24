<div align="center">

# fluid-bg

**Drop a live [Fluid](https://fluid.krackeddevs.com) generative background into any page.**

A `<fluid-bg>` web component, a React wrapper, and a CDN one-liner — one tag, zero setup, GPU-rendered.

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
| `base` | string | `https://fluid.krackeddevs.com` | Point at your own [self-hosted Fluid](https://github.com/enonforetsam/fluid) instance. |

Filling a parent (not `fixed`)? Give the parent a size — the background fills it edge to edge:

```html
<section style="position:relative;height:60vh">
  <fluid-bg></fluid-bg>
  <h1 style="position:relative;z-index:1">Hello</h1>
</section>
```

---

## How it works (and the one caveat)

`fluid-bg` renders an `<iframe>` pointing at the hosted Fluid studio in canvas-only **embed** mode.
The upside: it ships **no shader code**, weighs almost nothing, and always renders the studio's
latest engines. **The caveat:** the background loads from `fluid.krackeddevs.com`, so it needs a
network connection and that host being up. If you need a fully self-contained, offline background,
[self-host Fluid](https://github.com/enonforetsam/fluid) (`npx wrangler deploy`) and pass your own
origin via `base`.

The iframe is `aria-hidden`, `tabindex="-1"`, and `pointer-events:none` — it's decorative and never
steals focus or clicks.

## License

MIT — free forever, personal or commercial.
