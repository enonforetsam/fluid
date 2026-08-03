/* Fluid edge worker.
   Serves /mcp (stateless streamable-HTTP MCP server) and /api/* (plain JSON)
   on top of the static assets. No state, no storage — it only generates
   share links, embed snippets, and parameter JSON; rendering always happens
   on the visitor's GPU. */

/* Every registry the API answers with — engines, screens, finishes, lenses,
   palettes, presets, looks — is GENERATED from index.html by fluid-core/build.mjs.
   The worker keeps no copy of its own, so app and API cannot drift apart.
   After changing the studio's pickers or LOOKS: node fluid-core/build.mjs */
import { FIELDS, SCREENS, FINISHES, LENSES, PALETTES, PRESETS, LOOKS } from './worker-data.js';

var BASE = 'https://fluid.krackeddevs.com';

var ASPECTS = { '1:1': 1, '4:5': 0.8, '5:4': 1.25, '3:2': 1.5, '16:9': 1.7778, '9:16': 0.5625 };
function aspectName(v){
  var best = '1:1', bd = 1e9, k;
  for (k in ASPECTS){ var d = Math.abs(ASPECTS[k] - v); if (d < bd){ bd = d; best = k; } }
  return best;
}

var DEFAULTS = {
  speed: 0.6, zoom: 1.6, warp: 4.5, grain: 0.06,
  pixel: 6, dot: 10, halftone: true, palette: 'aurora',
  seed: null, liquify: 0.8, blend: 0.85, aspect: '1:1', preset: 'none',
  field: 'noise', screen: 'square', threshold: 0.5, finish: 'none',
  lens: 'none', lensAmount: 1
};

function clamp(v, lo, hi){ return Math.max(lo, Math.min(hi, v)); }
function round2(v){ return Math.round(v * 100) / 100; }

/* custom-palette colours: pack/unpack an RGB triple into one hash slot (r*65536+g*256+b) */
function hex2(x){ x = (x & 255).toString(16); return x.length < 2 ? '0' + x : x; }
function unpackHex(v){ v = Math.max(0, Math.round(v)); return '#' + hex2(Math.floor(v / 65536)) + hex2(Math.floor(v / 256)) + hex2(v); }
function packHex(h){
  var m = /^#?([0-9a-f]{6})$/i.exec(String(h));
  if (!m){ throw new Error('bad colour "' + h + '" — use 6-digit hex like #1a2b3c'); }
  var x = parseInt(m[1], 16);
  return (x >> 16 & 255) * 65536 + (x >> 8 & 255) * 256 + (x & 255);
}
/* 2 or 3 colours -> the 4 gradient stops the hash carries (mirrors the app's deriveStops) */
function mixHex(a, b, t){
  var pa = packHex(a), pb = packHex(b);
  var r = Math.round((pa >> 16 & 255) + ((pb >> 16 & 255) - (pa >> 16 & 255)) * t);
  var g = Math.round((pa >> 8 & 255) + ((pb >> 8 & 255) - (pa >> 8 & 255)) * t);
  var bl = Math.round((pa & 255) + ((pb & 255) - (pa & 255)) * t);
  return '#' + hex2(r) + hex2(g) + hex2(bl);
}
function expandColors(cols){
  if (cols.length === 4){ return cols; }
  if (cols.length === 2){ return [cols[0], mixHex(cols[0], cols[1], 1 / 3), mixHex(cols[0], cols[1], 2 / 3), cols[1]]; }
  return [cols[0], mixHex(cols[0], cols[1], 2 / 3), mixHex(cols[1], cols[2], 1 / 3), cols[2]];
}

function buildPiece(input, base){
  input = input || {};
  base = base || BASE;
  var p = Object.assign({}, DEFAULTS);

  var lookName = (input.look || '').toLowerCase();
  if (lookName && Object.prototype.hasOwnProperty.call(LOOKS, lookName)){
    var lk = LOOKS[lookName];
    p.speed = lk.p[0]; p.zoom = lk.p[1]; p.warp = lk.p[2]; p.grain = lk.p[3];
    p.pixel = lk.p[4]; p.dot = lk.p[5]; p.halftone = !!lk.p[6];
    p.palette = PALETTES[lk.p[7]]; p.seed = lk.p[8];
    p.liquify = lk.p[9]; p.blend = lk.p[10];
    p.aspect = aspectName(lk.p[11] || 1);
    p.preset = lk.preset || 'none';
    p.field = FIELDS[lk.field || 0];
    p.screen = SCREENS[lk.screen || 0];
    p.threshold = lk.thresh != null ? lk.thresh : 0.5;
    p.finish = FINISHES[lk.material || 0];
    p.lens = LENSES[lk.lens || 0];
    p.lensAmount = lk.lensAmt != null ? lk.lensAmt : 1;
    if (lk.cols){ p.palette = 'custom'; p.lookCols = lk.cols; }
  } else if (lookName){
    throw new Error('unknown look "' + lookName + '" — valid: ' + Object.keys(LOOKS).join(', '));
  }

  ['speed', 'zoom', 'warp', 'grain', 'pixel', 'dot', 'liquify', 'blend', 'seed', 'threshold'].forEach(function(k){
    if (typeof input[k] === 'number' && isFinite(input[k])){ p[k] = input[k]; }
  });
  if (typeof input.halftone === 'boolean'){ p.halftone = input.halftone; }
  if (typeof input.palette === 'string'){
    var pal = input.palette.toLowerCase();
    if (PALETTES.indexOf(pal) < 0){ throw new Error('unknown palette — valid: ' + PALETTES.join(', ')); }
    p.palette = pal;
  }
  if (typeof input.preset === 'string'){
    var pr = input.preset.toLowerCase();
    if (pr !== 'none' && PRESETS.indexOf(pr) < 0){ throw new Error('unknown preset — valid: none, ' + PRESETS.join(', ')); }
    p.preset = pr;
  }
  if (typeof input.aspect === 'string'){
    if (!(input.aspect in ASPECTS)){ throw new Error('unknown aspect — valid: ' + Object.keys(ASPECTS).join(', ')); }
    p.aspect = input.aspect;
  }
  if (typeof input.field === 'string'){
    var fd = input.field.toLowerCase();
    if (FIELDS.indexOf(fd) < 0){ throw new Error('unknown field — valid: ' + FIELDS.join(', ')); }
    p.field = fd;
  }
  if (typeof input.screen === 'string'){
    var sc = input.screen.toLowerCase();
    if (SCREENS.indexOf(sc) < 0){ throw new Error('unknown screen — valid: ' + SCREENS.join(', ')); }
    p.screen = sc;
  }
  if (typeof input.finish === 'string'){
    var fn = input.finish.toLowerCase();
    if (FINISHES.indexOf(fn) < 0){ throw new Error('unknown finish — valid: ' + FINISHES.join(', ')); }
    p.finish = fn;
  }
  if (typeof input.lens === 'string'){
    var ln = input.lens.toLowerCase();
    if (LENSES.indexOf(ln) < 0){ throw new Error('unknown lens — valid: ' + LENSES.join(', ')); }
    p.lens = ln;
  }
  if (typeof input.lensAmount === 'number' && isFinite(input.lensAmount)){ p.lensAmount = input.lensAmount; }
  p.lensAmount = round2(clamp(p.lensAmount, 0, 1));
  /* custom palette: 2-4 hex colours (dark->light) override the named palette — 2 or 3
     expand to the 4 hash stops by blending, exactly like the app's colour picker.
     A look can ship its own gradient (p.lookCols); an explicit palette/colors wins. */
  var customPacked = null;
  if (Array.isArray(input.colors) && (input.colors.length < 2 || input.colors.length > 4)){
    throw new Error('colors takes 2, 3 or 4 hex values (dark -> light)');
  }
  var srcCols = (Array.isArray(input.colors) && input.colors.length >= 2) ? expandColors(input.colors)
    : (!input.palette && Array.isArray(p.lookCols) && p.lookCols.length === 4 ? p.lookCols : null);
  if (srcCols){
    customPacked = srcCols.map(packHex);
    p.palette = 'custom';
    p.colors = customPacked.map(unpackHex);
  }
  delete p.lookCols;
  if (p.seed === null || input.random === true){ p.seed = round2(3 + Math.random() * 89); }

  p.speed = round2(clamp(p.speed, 0, 3));
  p.zoom = round2(clamp(p.zoom, 0.5, 4));
  p.warp = round2(clamp(p.warp, 0, 9));
  p.grain = round2(clamp(p.grain, 0, 0.3));
  p.pixel = Math.round(clamp(p.pixel, 1, 48));
  p.dot = Math.round(clamp(p.dot, 4, 26));
  p.seed = round2(clamp(p.seed, 3, 92));
  p.liquify = round2(clamp(p.liquify, 0, 2));
  p.blend = round2(clamp(p.blend, 0, 1));
  p.threshold = round2(clamp(p.threshold, 0, 1));

  var presetIdx = p.preset === 'none' ? 0 : PRESETS.indexOf(p.preset) + 1;
  function hashFor(embed){
    var palIdx = customPacked ? 8 : PALETTES.indexOf(p.palette);
    var a = [
      p.speed, p.zoom, p.warp, p.grain, p.pixel, p.dot,
      p.halftone ? 1 : 0, palIdx, p.seed,
      p.liquify, p.blend, ASPECTS[p.aspect], presetIdx,
      embed ? 1 : 0, FIELDS.indexOf(p.field), SCREENS.indexOf(p.screen),
      0, 0,                                  /* [16] panX [17] panY (n/a server-side) */
      0, 0                                   /* [18][19] reserved (was seamless/tile) */
    ];
    if (customPacked){ a.push(customPacked[0], customPacked[1], customPacked[2], customPacked[3]); }
    /* [24] dither threshold as offset from neutral 0.5 (default trims to 0) */
    var dOff = Math.round((p.threshold - 0.5) * 100) / 100;
    if (dOff !== 0){
      while (a.length < 24){ a.push(0); }
      a.push(dOff);
    }
    /* [28] material finish — only when set; pads [19..27] like the app's buildHash */
    var fIdx = FINISHES.indexOf(p.finish);
    if (fIdx > 0){
      while (a.length < 28){ a.push(0); }
      a.push(fIdx);
    }
    /* [29][30] math lens + amount×100 — only when visibly on, like the app's buildHash */
    var lnIdx = LENSES.indexOf(p.lens);
    if (lnIdx > 0 && p.lensAmount > 0.001){
      while (a.length < 29){ a.push(0); }
      a.push(lnIdx, Math.round(p.lensAmount * 100));
    }
    var minLen = customPacked ? 24 : 12;
    while (a.length > minLen && a[a.length - 1] === 0){ a.pop(); }
    return base + '/#p=' + a.join(',');
  }

  var share = hashFor(false);
  var embedSrc = hashFor(true);
  return {
    params: p,
    share_url: share,
    embed_url: embedSrc,
    embed_html: '<iframe src="' + embedSrc + '" style="width:100%;height:480px;border:0" loading="lazy" title="Fluid background"></iframe>',
    gallery_url: base + '/gallery',
    notes: 'share_url opens the studio; embed_url / embed_html render canvas-only and animate live. ' +
      'For copy-paste site code (native <fluid-bg> web component, React, or iframe) call ' +
      'get_embed_code with this share_url. ' +
      'For a STATIC image (PNG/JPG/WebP at wallpaper / OG / social sizes), open ' +
      'share_url and use the Export panel — it renders the file in the visitor’s browser. There is no ' +
      'image-render API: all rendering is client-side on the viewer’s GPU, and a visitor’s own photo ' +
      'can only be loaded in the studio, never via URL.'
  };
}

function decodeLink(url){
  var m = /#p=([0-9.,-]+)/.exec(url || '');
  if (!m){ throw new Error('no #p= hash found in that URL'); }
  var n = m[1].split(',').map(parseFloat);
  if (n.length < 12 || n.some(isNaN)){ throw new Error('malformed #p= hash'); }
  var pi = n.length > 12 ? Math.round(n[12]) : 0;
  var palIdx = clamp(Math.round(n[7]), 0, 8);
  var colors = (palIdx === 8 && n.length > 23)
    ? [unpackHex(n[20]), unpackHex(n[21]), unpackHex(n[22]), unpackHex(n[23])] : null;
  return {
    speed: n[0], zoom: n[1], warp: n[2], grain: n[3],
    pixel: Math.round(n[4]), dot: Math.round(n[5]),
    halftone: Math.round(n[6]) === 1,
    palette: palIdx === 8 ? 'custom' : PALETTES[clamp(palIdx, 0, 7)],
    colors: colors,
    seed: n[8], liquify: n[9], blend: n[10],
    aspect: aspectName(n[11]),
    preset: pi > 0 && pi <= PRESETS.length ? PRESETS[pi - 1] : 'none',
    embed: n.length > 13 && Math.round(n[13]) === 1,
    field: FIELDS[clamp(n.length > 14 ? Math.round(n[14]) : 0, 0, FIELDS.length - 1)],
    screen: SCREENS[clamp(n.length > 15 ? Math.round(n[15]) : 0, 0, SCREENS.length - 1)],
    threshold: n.length > 24 ? clamp(0.5 + n[24], 0, 1) : 0.5,
    finish: FINISHES[clamp(n.length > 28 ? Math.round(n[28]) : 0, 0, FINISHES.length - 1)],
    lens: LENSES[clamp(n.length > 29 ? Math.round(n[29]) : 0, 0, LENSES.length - 1)],
    lensAmount: n.length > 30 ? clamp(n[30] / 100, 0, 1) : 1
  };
}

function looksList(base){
  return Object.keys(LOOKS).map(function(name){
    var piece = buildPiece({ look: name }, base);
    return { look: name, preset: LOOKS[name].preset || 'none',
      share_url: piece.share_url, embed_html: piece.embed_html };
  });
}

/* ---------- embed code (fluid-bg snippets) ---------- */

/* Set/clear the embed flag (slot [13]) directly on the numeric hash so every other
   slot — pan, symmetry, layers, anything future — survives untouched. */
function withEmbedFlag(nums, on){
  var a = nums.slice();
  while (a.length < 14){ a.push(0); }
  a[13] = on ? 1 : 0;
  var minLen = Math.round(a[7]) === 8 ? 24 : 12;
  while (a.length > minLen && a[a.length - 1] === 0){ a.pop(); }
  return a;
}

var FLUID_BG_CDN = 'https://cdn.jsdelivr.net/npm/fluid-bg@0.2';

function embedCode(input, base){
  input = input || {};
  base = base || BASE;
  var nums;
  if (typeof input.url === 'string' && input.url){
    var m = /p=([0-9.,-]+)/.exec(input.url);
    if (!m){ throw new Error('no #p= hash found in that URL — pass a share_url from create_piece'); }
    nums = m[1].split(',').map(parseFloat);
    if (nums.length < 12 || nums.some(function(v){ return isNaN(v); })){ throw new Error('malformed #p= hash'); }
  } else if (typeof input.look === 'string' && input.look){
    var piece = buildPiece({ look: input.look }, base);
    nums = /#p=(.+)$/.exec(piece.share_url)[1].split(',').map(parseFloat);
  } else {
    throw new Error('pass url (a share link — design one with create_piece first) or look (a curated name from list_looks)');
  }

  var shareHash = '#p=' + withEmbedFlag(nums, false).join(',');
  var embedHash = '#p=' + withEmbedFlag(nums, true).join(',');
  var fixed = input.target !== 'element';

  var html = fixed
    ? '<script src="' + FLUID_BG_CDN + '"></script>\n' +
      '<fluid-bg fixed hash="' + shareHash + '"></fluid-bg>'
    : '<script src="' + FLUID_BG_CDN + '"></script>\n' +
      '<div style="position:relative;height:420px">\n' +
      '  <fluid-bg hash="' + shareHash + '"></fluid-bg>\n' +
      '</div>';

  var react = 'npm install fluid-bg\n\n' +
    "import FluidBg from 'fluid-bg/react';\n\n" +
    (fixed
      ? '<FluidBg fixed hash="' + shareHash + '" />'
      : '<div style={{position:"relative",height:420}}>\n' +
        '  <FluidBg hash="' + shareHash + '" />\n' +
        '</div>');

  var iframe = fixed
    ? '<div style="position:fixed;inset:0;z-index:-1;overflow:hidden;pointer-events:none">\n' +
      '  <iframe src="' + base + '/' + embedHash + '" title="Fluid background"' +
      ' style="width:100%;height:100%;border:0;display:block"></iframe>\n' +
      '</div>'
    : '<iframe src="' + base + '/' + embedHash + '" style="width:100%;height:480px;border:0"' +
      ' loading="lazy" title="Fluid background"></iframe>';

  return {
    share_url: base + '/' + shareHash,
    embed_url: base + '/' + embedHash,
    html: html,
    react: react,
    iframe_html: iframe,
    notes: 'html/react use the fluid-bg npm package: it renders NATIVELY on a canvas in the page ' +
      '(~15 KB gz, engines bundled, no iframe) and falls back to a hosted iframe only when WebGL is ' +
      'unavailable. FOOTGUN: a fixed background sits at z-index:-1, so the page/body background must ' +
      'stay transparent or it paints over the art. Non-fixed instances fill their parent — give the ' +
      'parent a size. iframe_html needs no npm dependency at all. Static images are exported in the ' +
      'studio (open share_url → Export panel); there is no server render API.'
  };
}

/* ---------- llms.txt (agent-readable site guide) ---------- */

function llmsTxt(base){
  var text = [
    '# Fluid',
    '',
    '> Fluid is a free, zero-backend generative-art studio at ' + base + '. It designs animated',
    '> WebGL backgrounds, wallpapers and OG images that render on the viewer\'s GPU. Every design',
    '> is a share URL carrying an append-only numeric `#p=` hash — no server rendering, no account,',
    '> no quota. Embeds are free for any site, personal or commercial.',
    '',
    'Key facts:',
    '',
    '- Design in the studio at ' + base + '/, or programmatically via MCP or REST — both return share and embed URLs.',
    '- Embed on any site with the `fluid-bg` npm package (native canvas in the page, ~15 KB gz) or a plain iframe.',
    '- Static images (PNG/JPG/WebP at any size) are exported client-side from the studio\'s Export panel. There is NO image-render API — never promise a server-rendered file.',
    '',
    '## Connect (AI agents)',
    '',
    '- MCP server (streamable HTTP, stateless, no auth): ' + base + '/mcp',
    '  - Claude Code: `claude mcp add --transport http fluid ' + base + '/mcp`',
    '  - claude.ai (web / desktop / mobile): Settings -> Connectors -> Add custom connector -> paste ' + base + '/mcp',
    '  - Tools: `create_piece` (design from params, a look, or 2-4 brand hex colours -> share_url + embed code),',
    '    `get_embed_code` (share_url -> copy-paste native <fluid-bg> / React / iframe snippets),',
    '    `list_looks` (curated starting points), `decode_link` (share URL -> named params, for remixing).',
    '- REST, same generator as plain JSON: GET ' + base + '/api/piece?look=…&field=…&colors=… and GET ' + base + '/api/looks',
    '- Human docs: ' + base + '/dev (integration) and ' + base + '/manual (studio manual); gallery: ' + base + '/gallery',
    '',
    '## Embed on a site (fluid-bg)',
    '',
    '```html',
    '<script src="' + FLUID_BG_CDN + '"></script>',
    '<fluid-bg fixed hash="#p=0.5,1.5,5.5,0.03,1,10,0,0,18,0,0,1.7778"></fluid-bg>',
    '```',
    '',
    '- React: `npm i fluid-bg`, then `import FluidBg from \'fluid-bg/react\'` and `<FluidBg fixed hash="#p=…" />`.',
    '- Raw engine library: `npm i fluid-core` — `createFluid(el, {field, palette|colors, look, …})` + `parseShareHash()`; zero deps, ~21 KB, TypeScript types included. fluid-bg is built on it.',
    '- Native by default (canvas in the page, engines bundled); falls back to a hosted iframe automatically when WebGL is unavailable. `mode="iframe"` forces the old behaviour.',
    '- FOOTGUN: `fixed` sits at z-index -1 — keep the html/body background TRANSPARENT or the page paints over the art.',
    '- A non-fixed `<fluid-bg>` fills its parent: give the parent a size.',
    '',
    '## Recipes',
    '',
    '- Live background for a site: `create_piece` (match the brand with `colors`) -> `get_embed_code` -> paste the html snippet; keep the body background transparent.',
    '- OG image / wallpaper: `create_piece` with `aspect: "16:9"` (OG) or `"9:16"` (phone) -> open share_url in a browser -> Export panel renders the file locally.',
    '- Match brand colours: pass `colors`: 2-4 hex stops dark -> light, e.g. ["#0a0a1a", "#ffe1f5"].',
    '- Remix an existing piece: `decode_link` on any share URL -> tweak the named params -> `create_piece`.',
    '',
    '## Share-hash contract (`#p=`)',
    '',
    'Comma-separated numbers, append-only, trailing zeros trimmed (old links round-trip forever):',
    '[0] speed [1] zoom [2] warp [3] grain [4] pixel [5] dot [6] halftone [7] palette (8 = custom)',
    '[8] seed [9] liquify [10] blend [11] aspect [12] preset [13] embed flag (1 = chrome-less canvas)',
    '[14] field [15] screen [16-17] pan [18] symmetry [20-23] packed custom RGB stops',
    '[24] dither-threshold offset [25-27] layer [28] material finish [29][30] math lens + amount×100.',
    'Values are numeric only; parsers must clamp and reject NaN.',
    ''
  ].join('\n');
  return new Response(text, {
    headers: Object.assign({
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'public, max-age=3600'
    }, CORS)
  });
}

/* ---------- MCP ---------- */

var TOOLS = [
  {
    name: 'create_piece',
    description: 'Create a Fluid generative-art piece (thermal/iridescent photo-melt shader art). ' +
      'Returns a share URL (full tool), an embed URL and a ready <iframe> snippet (canvas-only, ' +
      'animates on the viewer’s GPU, free forever). Start from a named look and/or override ' +
      'any parameter. Omit seed for a random one.',
    inputSchema: {
      type: 'object',
      properties: {
        look: { type: 'string', enum: Object.keys(LOOKS), description: 'curated starting point' },
        field: { type: 'string', enum: FIELDS, description: 'generator: noise (domain-warp), flow (curl/fluid swirl), cellular (Voronoi), gyroid (woven bands), truchet (maze/circuit), interfere (moire rings), kaleido (mandala), lines (rotated bands), grid (lattice), golden (phyllotaxis sunflower spiral), smoke (billowing domain-warped clouds), crystal (quasicrystal plane-waves), honeycomb (hex lattice), bloom (soft colour blobs — a living mesh gradient), sweep (corner-to-corner colour gradient, edges alive), marble (combed ink swirls — paper marbling), plaid (woven tartan bands), curtain (aurora curtains — luminous vertical streaks), stitch (curve-stitching string art — epicycloid caustic), pursuit (whirling polygons — nested spiral chase), chladni (vibrating-plate nodal figures), cassini (lemniscate ovals — equipotential contours), topo (topographic contour map — elevation isolines of a drifting landmass)' },
        screen: { type: 'string', enum: SCREENS, description: 'pixel geometry: square, hex (honeycomb), ascii (glyph ramp), dither (Bayer 2-tone)' },
        finish: { type: 'string', enum: FINISHES, description: 'material relight: glass, metal (chrome), sand (matte), liquid (wet gloss), molten (liquid metal, palette-tinted — gold/chrome logo looks)' },
        lens: { type: 'string', enum: LENSES, description: 'math lens — a named transform of the complex plane the engine is sampled through: square (conformal z^2), invert (circle inversion 1/z), mobius (disk automorphism, orbiting pole), droste (log-polar Escher spiral), hyperbolic (Poincare rim compression), julia (z^2+c orbit sampling), cube (conformal z^3), exp (e^z strip-to-fan), sine (sin z mirror lattice), joukowski (z + 1/z airfoil map), newton (Newton-fractal basins of z^3=1), modular (SL(2,Z) fundamental-domain fold)' },
        lensAmount: { type: 'number', description: 'lens strength 0-1 (default 1): blends flat space toward the transformed domain' },
        preset: { type: 'string', enum: ['none'].concat(PRESETS), description: 'built-in source image to melt' },
        palette: { type: 'string', enum: PALETTES },
        colors: { type: 'array', items: { type: 'string' }, minItems: 2, maxItems: 4, description: 'custom palette: 2-4 hex colours dark->light (2 or 3 blend into a full gradient), e.g. ["#0a0a1a","#ffe1f5"] or ["#0a0a1a","#3a1f7a","#c84fe0","#ffe1f5"] (overrides palette)' },
        seed: { type: 'number', minimum: 3, maximum: 92 },
        speed: { type: 'number', minimum: 0, maximum: 3, description: 'animation speed' },
        zoom: { type: 'number', minimum: 0.5, maximum: 4 },
        warp: { type: 'number', minimum: 0, maximum: 9, description: 'domain-warp strength' },
        grain: { type: 'number', minimum: 0, maximum: 0.3 },
        pixel: { type: 'integer', minimum: 1, maximum: 48, description: 'pixelation block size, 1 = off' },
        dot: { type: 'integer', minimum: 4, maximum: 26, description: 'halftone dot size' },
        threshold: { type: 'number', minimum: 0, maximum: 1, description: 'dither dot density (screen: dither), 0.5 = neutral' },
        halftone: { type: 'boolean' },
        liquify: { type: 'number', minimum: 0, maximum: 2, description: 'photo melt amount (needs preset)' },
        blend: { type: 'number', minimum: 0, maximum: 1, description: 'photo vs noise (needs preset)' },
        aspect: { type: 'string', enum: Object.keys(ASPECTS) },
        random: { type: 'boolean', description: 'force a fresh random seed' }
      }
    }
  },
  {
    name: 'get_embed_code',
    description: 'Turn a Fluid share URL into ready-to-paste site code: a native <fluid-bg> web-component ' +
      'snippet (CDN one-liner, renders on a canvas in the page — no iframe), a React version, and a ' +
      'dependency-free iframe fallback. Design the piece with create_piece first (or pass a curated look), ' +
      'then call this with its share_url.',
    inputSchema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'a Fluid share/embed URL (or bare #p= hash) — e.g. the share_url returned by create_piece' },
        look: { type: 'string', enum: Object.keys(LOOKS), description: 'curated look to embed instead of a url' },
        target: { type: 'string', enum: ['background', 'element'], description: 'background (default): fixed full-page backdrop behind the content. element: fills a sized parent block.' }
      }
    }
  },
  {
    name: 'list_looks',
    description: 'List the curated Fluid looks with their share and embed links.',
    inputSchema: { type: 'object', properties: {} }
  },
  {
    name: 'decode_link',
    description: 'Decode a Fluid share/embed URL into named parameters (for remixing).',
    inputSchema: {
      type: 'object',
      properties: { url: { type: 'string', description: 'a fluid URL containing #p=' } },
      required: ['url']
    }
  }
];

function callTool(name, args, base){
  if (name === 'create_piece'){ return buildPiece(args, base); }
  if (name === 'get_embed_code'){ return embedCode(args, base); }
  if (name === 'list_looks'){ return { looks: looksList(base) }; }
  if (name === 'decode_link'){ return decodeLink(args && args.url); }
  throw new Error('unknown tool: ' + name);
}

var CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, OPTIONS',
  'access-control-allow-headers': 'content-type, mcp-protocol-version, mcp-session-id, authorization'
};

/* security headers applied to every response. frame-ancestors stays open
   because embedding the canvas is the product; everything else is locked down.
   CSP keeps 'unsafe-inline' only because the app is a single inline-script file.
   Cloudflare Web Analytics may be injected at the zone edge; allow only that
   script host so the browser console stays clean without opening arbitrary JS. */
var SEC = {
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'strict-origin-when-cross-origin',
  'strict-transport-security': 'max-age=15552000',
  'permissions-policy': 'camera=(self), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()',
  'content-security-policy': [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' https://static.cloudflareinsights.com",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "media-src 'self' blob:",
    "font-src 'self'",
    "connect-src 'self' https://cloudflareinsights.com https://api.openai.com https://*.openai.azure.com",
    "worker-src 'self' blob:",
    "child-src 'self' blob:",
    "frame-ancestors *",
    "base-uri 'self'",
    "form-action 'none'",
    "object-src 'none'"
  ].join('; ')
};
function withSec(resp){
  var h = new Headers(resp.headers);
  for (var k in SEC){ h.set(k, SEC[k]); }
  return new Response(resp.body, { status: resp.status, statusText: resp.statusText, headers: h });
}

/* staging: keep it out of search indexes and stamp a visible badge so it is never
   mistaken for production. Driven by the STAGE var (set per-env in wrangler.jsonc). */
function markStaging(resp){
  var h = new Headers(resp.headers);
  h.set('x-robots-tag', 'noindex, nofollow');
  var out = new Response(resp.body, { status: resp.status, statusText: resp.statusText, headers: h });
  var ct = h.get('content-type') || '';
  if (ct.indexOf('text/html') >= 0){
    return new HTMLRewriter().on('body', {
      element: function(el){
        el.append(
          '<div style="position:fixed;left:8px;bottom:8px;z-index:99999;' +
          'font:700 9px ui-monospace,monospace;letter-spacing:.16em;background:#b91c1c;' +
          'color:#fff;padding:4px 9px;border-radius:5px;pointer-events:none;opacity:.92">STAGING</div>',
          { html: true }
        );
      }
    }).transform(out);
  }
  return out;
}

function json(obj, status){
  return new Response(JSON.stringify(obj, null, 2), {
    status: status || 200,
    headers: Object.assign({ 'content-type': 'application/json' }, CORS)
  });
}

function rpcResult(id, result){ return { jsonrpc: '2.0', id: id, result: result }; }
function rpcError(id, code, message){ return { jsonrpc: '2.0', id: id, error: { code: code, message: message } }; }

function handleRpc(msg, base){
  var id = (msg && msg.id !== undefined) ? msg.id : null;
  var method = msg && msg.method;
  if (!method){ return rpcError(id, -32600, 'invalid request'); }
  if (method === 'initialize'){
    var pv = (msg.params && msg.params.protocolVersion) || '2025-06-18';
    return rpcResult(id, {
      protocolVersion: pv,
      capabilities: { tools: {} },
      serverInfo: { name: 'fluid', version: '1.0.0' },
      instructions: 'Designs Fluid generative backgrounds / wallpapers / OG images as share links and ' +
        'live embeds. create_piece designs one, get_embed_code turns its share_url into copy-paste ' +
        'site code (native <fluid-bg> web component, React, or iframe), list_looks gives curated ' +
        'starting points, decode_link reads params back out of a URL. ' +
        'Static image files are exported in the visitor’s browser from share_url — there is no render API.'
    });
  }
  if (method === 'ping'){ return rpcResult(id, {}); }
  if (method === 'tools/list'){ return rpcResult(id, { tools: TOOLS }); }
  if (method === 'tools/call'){
    var name = msg.params && msg.params.name;
    var args = (msg.params && msg.params.arguments) || {};
    try {
      var out = callTool(name, args, base);
      return rpcResult(id, { content: [{ type: 'text', text: JSON.stringify(out, null, 2) }] });
    } catch(e){
      return rpcResult(id, { content: [{ type: 'text', text: 'ERR — ' + e.message }], isError: true });
    }
  }
  if (method.indexOf('notifications/') === 0){ return null; } /* fire-and-forget */
  return rpcError(id, -32601, 'method not found: ' + method);
}

async function mcp(req){
  var base = new URL(req.url).origin;
  if (req.method === 'OPTIONS'){ return new Response(null, { status: 204, headers: CORS }); }
  if (req.method === 'GET'){
    /* stateless server: no SSE stream to offer */
    return new Response('fluid MCP — POST JSON-RPC here.\n\n' +
      'Claude Code:  claude mcp add --transport http fluid ' + base + '/mcp\n' +
      'claude.ai:    Settings -> Connectors -> Add custom connector -> ' + base + '/mcp\n\n' +
      'Agent guide:  ' + base + '/llms.txt\n',
      { status: 405, headers: Object.assign({ 'content-type': 'text/plain', allow: 'POST, OPTIONS' }, CORS) });
  }
  if (req.method !== 'POST'){ return new Response('method not allowed', { status: 405, headers: CORS }); }
  var body;
  try { body = await req.json(); }
  catch(e){ return json(rpcError(null, -32700, 'parse error'), 400); }
  if (Array.isArray(body)){
    var replies = body.map(function(msg){ return handleRpc(msg, base); }).filter(function(r){ return r !== null; });
    if (!replies.length){ return new Response(null, { status: 202, headers: CORS }); }
    return json(replies);
  }
  var reply = handleRpc(body, base);
  if (reply === null){ return new Response(null, { status: 202, headers: CORS }); }
  return json(reply);
}

/* ---------- plain REST API ---------- */

function api(req, url){
  var base = url.origin;
  if (req.method === 'OPTIONS'){ return new Response(null, { status: 204, headers: CORS }); }
  if (url.pathname === '/api/looks'){ return json({ looks: looksList(base) }); }
  if (url.pathname === '/api/piece'){
    var q = url.searchParams;
    var input = {};
    ['look', 'preset', 'palette', 'aspect', 'field', 'screen', 'finish', 'lens'].forEach(function(k){
      if (q.has(k)){ input[k] = q.get(k); }
    });
    ['seed', 'speed', 'zoom', 'warp', 'grain', 'pixel', 'dot', 'threshold', 'liquify', 'blend', 'lensAmount'].forEach(function(k){
      if (q.has(k)){ input[k] = parseFloat(q.get(k)); }
    });
    if (q.has('halftone')){ input.halftone = q.get('halftone') !== '0' && q.get('halftone') !== 'false'; }
    if (q.has('colors')){ input.colors = q.get('colors').split(/[\s,\-]+/).filter(Boolean); } /* 4 hex, comma/dash separated */
    try { return json(buildPiece(input, base)); }
    catch(e){ return json({ error: e.message }, 400); }
  }
  return json({
    name: 'fluid api',
    endpoints: {
      'GET /api/piece': 'query params: look, preset, palette, colors (2-4 hex, comma-separated — 2 or 3 blend into a full gradient), seed, speed, zoom, warp, grain, pixel, dot, threshold, halftone, liquify, blend, aspect, field, screen, finish, lens, lensAmount',
      'GET /api/looks': 'curated looks with links',
      'POST /mcp': 'MCP server — claude mcp add --transport http fluid ' + base + '/mcp (or add as a claude.ai custom connector)',
      'GET /llms.txt': 'agent-readable site guide'
    },
    docs: base + '/dev'
  });
}

/* Static social-share image. Crawlers cannot run the app or inspect #p= fragments,
   so /og.jpg serves one checked-in image without server-side rendering. */
async function ogImage(req, env, url){
  var asset = await env.ASSETS.fetch(new Request(new URL('/assets/og.png', url.origin)));
  var h = new Headers(asset.headers);
  h.set('content-type', 'image/png');
  h.set('cache-control', 'public, max-age=86400');
  return new Response(asset.body, { status: asset.status, headers: h });
}

function fluidFavicon(){
  /* Server fallback for the animated browser favicon: a small glossy fluid vortex. */
  var palettes = [
    ['#050713', '#0b2767', '#22d3ee', '#f8c7ff', '#fff7d6'],
    ['#080512', '#371269', '#a855f7', '#fb7185', '#fde68a'],
    ['#030712', '#064e3b', '#34d399', '#a7f3d0', '#ffffff'],
    ['#09090b', '#7f1d1d', '#fb923c', '#fde047', '#fff7ed'],
    ['#020617', '#164e63', '#38bdf8', '#a78bfa', '#fdf2f8'],
    ['#08040f', '#581c87', '#2563eb', '#2dd4bf', '#fef3c7']
  ];
  var p = palettes[Math.floor(Math.random() * palettes.length)];
  var seed = Math.floor(Math.random() * 9999) + 1;
  var angle = Math.floor(Math.random() * 360);
  var f1 = (0.018 + Math.random() * 0.012).toFixed(3);
  var f2 = (0.032 + Math.random() * 0.018).toFixed(3);
  var scale = Math.floor(10 + Math.random() * 8);
  var svg = [
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">',
    '<defs>',
    '<linearGradient id="r" gradientTransform="rotate(' + angle + ')">',
    '<stop offset="0" stop-color="' + p[1] + '"/>',
    '<stop offset=".36" stop-color="' + p[2] + '"/>',
    '<stop offset=".72" stop-color="' + p[3] + '"/>',
    '<stop offset="1" stop-color="' + p[4] + '"/>',
    '</linearGradient>',
    '<filter id="w" x="-30%" y="-30%" width="160%" height="160%">',
    '<feTurbulence type="fractalNoise" baseFrequency="' + f1 + ' ' + f2 + '" numOctaves="3" seed="' + seed + '" result="n"/>',
    '<feDisplacementMap in="SourceGraphic" in2="n" scale="' + scale + '" xChannelSelector="R" yChannelSelector="G"/>',
    '</filter>',
    '</defs>',
    '<g filter="url(#w)">',
    '<path d="M54 8 C33 -3 7 8 7 31 C7 55 37 66 53 47 C65 32 48 18 31 25 C17 31 20 46 34 46 C47 46 52 34 43 29" fill="none" stroke="url(#r)" stroke-width="14" stroke-linecap="round" opacity=".95"/>',
    '<path d="M8 51 C23 65 55 61 60 37 C65 15 42 2 23 12 C7 21 11 39 28 41 C44 43 50 28 39 22" fill="none" stroke="' + p[4] + '" stroke-width="5" stroke-linecap="round" opacity=".72"/>',
    '<path d="M15 16 C32 5 53 14 51 31 C49 47 26 55 18 39 C13 28 23 21 34 25" fill="none" stroke="' + p[2] + '" stroke-width="7" stroke-linecap="round" opacity=".46"/>',
    '</g>',
    '<circle cx="34" cy="34" r="6" fill="' + p[4] + '" opacity=".26"/>',
    '<circle cx="32" cy="32" r="29" fill="none" stroke="#fff" stroke-opacity=".38" stroke-width="1.2"/>',
    '</svg>'
  ].join('');
  return new Response(svg, {
    headers: {
      'content-type': 'image/svg+xml; charset=utf-8',
      'cache-control': 'no-store'
    }
  });
}

export default {
  async fetch(req, env){
    var url = new URL(req.url);
    var resp;
    if (url.pathname === '/mcp'){ resp = await mcp(req); }
    else if (url.pathname === '/llms.txt'){ resp = llmsTxt(url.origin); }
    else if (url.pathname === '/og.jpg'){ resp = await ogImage(req, env, url); }
    else if (url.pathname === '/favicon.ico'){
      resp = fluidFavicon();
    }
    else if (url.pathname === '/api' || url.pathname.indexOf('/api/') === 0){ resp = await api(req, url); }
    else { resp = await env.ASSETS.fetch(req); }
    resp = withSec(resp);
    if (env.STAGE === 'staging'){ resp = markStaging(resp); }
    return resp;
  }
};
