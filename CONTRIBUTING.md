# Contributing to Fluid

Fluid is a single HTML file running WebGL1 GLSL. There's no build step, no bundler, no framework.
Everything that needs to run in the browser is vanilla ES5. Read `docs/ARCHITECTURE.md` before you start;
it documents the runtime files, share-hash contract, and Worker mirror invariants.

---

## Ways to contribute

### New field engine

This is the most impactful contribution. A field engine is a GLSL function that takes a UV
coordinate and time and returns a scalar in roughly `[0, 1]`. The palette and surface pipeline
handle everything else.

**Step 1 — write the function.** Add it to the `FSRC` string array in `index.html`, after the existing engines:

```glsl
float fieldMyEngine(vec2 p, float t) {
  // p is the warped UV (already domain-warped by u_warp); t is time in seconds
  // return a value in roughly [0.0, 1.0]
  return ...;
}
```

**Step 2 — dispatch it.** In `getField(p, t)`, add a branch:

```glsl
if(u_field == N) return fieldMyEngine(p, t);
```

**Step 3 — add the UI button.** In `index.html`, copy an existing `.fieldBtn` and give it the next index:

```html
<button class="fieldBtn" data-f="N">myengine</button>
```

**Step 4 — extend the hash parser.** Find the field clamp in `parseHash` and raise the maximum index to `N`.

**Step 5 — mirror in `worker.js`.** Add the name to the `FIELDS` array at index `N`.

**Step 6 — add looks.** Add 1–2 entries to the `LOOKS` table that show off what the engine does best.
A look is `{name, tip, p}` where `p` is a `buildHash(0)` string for that parameter set.

**Include in your PR:** a screenshot or share link from the live site, and a one-sentence description
of what the math does (it goes in `manual.html` under `04 — Field`).

---

### New palette preset

Palettes are 4 RGB stops (dark → light) in `PALETTES_RGB` in `index.html` and a name in `PALETTES`
in `worker.js`. Also add a `.palBtn` in the UI and a name in `SECTION_TIPS`.

Custom palettes (pal=8) already work — this is only for built-in named presets.

---

### Gallery piece

Add a piece to `gallery.html`:

1. Design it in the studio and copy the share link
2. Add an entry to the `PIECES` array: `{id, hash, title, tags, engine}`
3. Generate the thumbnail: load the share URL in a browser, export at 800×600, save to `assets/gallery/x-<id>.jpg`
4. Tags should be one or more of: `warm cool dark vibrant soft mono abstract portrait`

---

### Bug reports

Open an issue with:
- Browser and OS
- Steps to reproduce
- What you expected vs what happened
- Share link if the bug is visual (`#p=…`)

---

### Manual / docs corrections

`manual.html` is the user-facing reference. `dev.html` covers embeds, MCP, and the API.
Both are plain HTML — edit directly.

---

## Code style

- ES5 only in `index.html` — no `const`/`let`, no arrow functions, no template literals in the shader
- GLSL floats always have explicit decimals: `1.0` not `1`, `0.5` not `.5`
- No comments explaining *what* the code does — variable names do that. Comments only for non-obvious *why*
- The `#p=` share-hash key order is **append-only** — new parameters go at the end; never reorder

## Running locally

```sh
open index.html          # app only — no MCP/API
npx wrangler dev         # full stack including worker
```

No install step needed for the app. `wrangler` is the only dev dependency.
