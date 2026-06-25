/* Fluid edge worker.
   Serves /mcp (stateless streamable-HTTP MCP server) and /api/* (plain JSON)
   on top of the static assets. No state, no storage — it only generates
   share links, embed snippets, and parameter JSON; rendering always happens
   on the visitor's GPU. */

var BASE = 'https://fluid.krackeddevs.com';

var PALETTES = ['aurora', 'sunset', 'ocean', 'dusk', 'ember', 'mint', 'iris', 'chrome'];
var PRESETS = [];
var FIELDS = ['noise', 'flow', 'cellular', 'gyroid', 'truchet', 'interfere', 'kaleido', 'lines', 'grid', 'golden', 'smoke', 'crystal', 'honeycomb'];
var SCREENS = ['square', 'hex', 'ascii', 'dither'];
var ASPECTS = { '1:1': 1, '4:5': 0.8, '5:4': 1.25, '3:2': 1.5, '16:9': 1.7778, '9:16': 0.5625 };
function aspectName(v){
  var best = '1:1', bd = 1e9, k;
  for (k in ASPECTS){ var d = Math.abs(ASPECTS[k] - v); if (d < bd){ bd = d; best = k; } }
  return best;
}

/* mirrors the app's LOOKS array (share-hash value order); field/screen
   default to 0 (noise/square) unless the look sets them */
var LOOKS = {
  borealis: { field: 0,             p: [0.40, 2.0, 3.5, 0.03, 1, 10, 0, 0, 30, 0, 0, 1] },
  afterglow:{ field: 1,             p: [0.50, 1.6, 4.0, 0.03, 1, 10, 0, 1, 21, 0, 0, 1] },
  tide:     { field: 1,             p: [0.50, 1.5, 5.0, 0.03, 1, 10, 0, 2, 48, 0, 0, 1] },
  twilight: { field: 0,             p: [0.35, 2.3, 3.0, 0.03, 1, 10, 0, 3, 12, 0, 0, 1] },
  magma:    { field: 0,             p: [0.45, 1.8, 4.5, 0.03, 1, 10, 0, 4, 52, 0, 0, 1] },
  meridian: { field: 1,             p: [0.50, 1.6, 5.0, 0.03, 1, 10, 0, 5, 66, 0, 0, 1] },
  nebula:   { field: 2,             p: [0.40, 1.9, 7.0, 0.03, 1,  8, 0, 6, 40, 0, 0, 1] },
  plasma:   { field: 1,             p: [0.70, 1.2, 8.0, 0.04, 1, 10, 0, 0, 71, 0, 0, 1] },
  velvet:   { field: 0,             p: [0.30, 2.6, 2.0, 0.02, 1, 10, 0, 3, 18, 0, 0, 1] },
  coral:    { field: 2,             p: [0.45, 1.8, 7.0, 0.03, 1, 10, 0, 1, 33, 0, 0, 1] },
  glacier:  { field: 0,             p: [0.40, 2.2, 3.0, 0.03, 1, 10, 0, 2, 25, 0, 0, 1] },
  onyx:     { field: 2,             p: [0.40, 1.9, 8.0, 0.03, 1,  8, 0, 7, 60, 0, 0, 1] },
  weave:    { field: 3,             p: [0.40, 1.6, 5.0, 0.03, 1, 10, 0, 5, 40, 0, 0, 1] },
  circuit:  { field: 4,             p: [0.30, 2.0, 4.0, 0.02, 1, 10, 0, 7, 22, 0, 0, 1] },
  ripple:   { field: 5,             p: [0.50, 1.4, 5.0, 0.03, 1, 10, 0, 2, 30, 0, 0, 1] },
  mandala:  { field: 6,             p: [0.35, 1.5, 6.0, 0.03, 1, 10, 0, 6, 55, 0, 0, 1] },
  strata:   { field: 7,             p: [0.30, 1.6, 3.0, 0.02, 1, 10, 0, 3, 28, 0, 0, 1] },
  mesh:     { field: 8,             p: [0.30, 1.8, 4.0, 0.02, 1, 10, 0, 5, 33, 0, 0, 1] },
  sunflower:{ field: 9,             p: [0.30, 1.4, 5.0, 0.02, 1, 10, 0, 4, 44, 0, 0, 1] },
  ribbon:   { field: 3,             p: [0.30, 1.55, 4.8, 0.02, 4,  9, 1, 2, 28, 0, 0, 0.5625] },
  vortex:   { field: 6,             p: [0.34, 1.18, 7.2, 0.02, 6, 10, 1, 5, 61, 0, 0, 0.5625] },
  abyss:    { field: 0,             p: [0.22, 2.25, 7.6, 0.03, 5,  8, 1, 2, 87, 0, 0, 0.5625] },
  nova:     { field: 5,             p: [0.32, 1.18, 6.4, 0.02, 4,  7, 1, 7, 52, 0, 0, 0.5625] },
  pixelbeam:{ field: 1, screen: 3, thresh: 0.46, p: [0.45, 1.6, 4.0, 0.0, 7, 10, 0, 4, 40, 0, 0, 1] },
  smoke:    { field: 10, cols: ['#040414', '#0a3a7a', '#0484fc', '#c2dbdc'], p: [0.38, 1.3, 3.0, 0.015, 1, 10, 0, 0, 30, 0, 0, 1] }
};

var DEFAULTS = {
  speed: 0.6, zoom: 1.6, warp: 4.5, grain: 0.06,
  pixel: 6, dot: 10, halftone: true, palette: 'aurora',
  seed: null, liquify: 0.8, blend: 0.85, aspect: '1:1', preset: 'none',
  field: 'noise', screen: 'square', threshold: 0.5
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
  /* custom palette: 4 hex gradient stops (dark->light) override the named palette.
     A look can ship its own gradient (p.lookCols); an explicit palette/colors wins. */
  var customPacked = null;
  var srcCols = (Array.isArray(input.colors) && input.colors.length === 4) ? input.colors
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
    threshold: n.length > 24 ? clamp(0.5 + n[24], 0, 1) : 0.5
  };
}

function looksList(base){
  return Object.keys(LOOKS).map(function(name){
    var piece = buildPiece({ look: name }, base);
    return { look: name, preset: LOOKS[name].preset || 'none',
      share_url: piece.share_url, embed_html: piece.embed_html };
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
        field: { type: 'string', enum: FIELDS, description: 'generator: noise (domain-warp), flow (curl/fluid swirl), cellular (Voronoi), gyroid (woven bands), truchet (maze/circuit), interfere (moire rings), kaleido (mandala), lines (rotated bands), grid (lattice), golden (phyllotaxis sunflower spiral), smoke (billowing domain-warped clouds)' },
        screen: { type: 'string', enum: SCREENS, description: 'pixel geometry: square, hex (honeycomb), ascii (glyph ramp), dither (Bayer 2-tone)' },
        preset: { type: 'string', enum: ['none'].concat(PRESETS), description: 'built-in source image to melt' },
        palette: { type: 'string', enum: PALETTES },
        colors: { type: 'array', items: { type: 'string' }, minItems: 4, maxItems: 4, description: 'custom palette: 4 hex gradient stops dark->light, e.g. ["#0a0a1a","#3a1f7a","#c84fe0","#ffe1f5"] (overrides palette)' },
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
        'live iframe embeds. create_piece designs ' +
        'one, list_looks gives curated starting points, decode_link reads params back out of a URL. ' +
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
    return new Response('fluid MCP — POST JSON-RPC here. Add with:\n' +
      'claude mcp add --transport http fluid ' + base + '/mcp\n',
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
    ['look', 'preset', 'palette', 'aspect', 'field', 'screen'].forEach(function(k){
      if (q.has(k)){ input[k] = q.get(k); }
    });
    ['seed', 'speed', 'zoom', 'warp', 'grain', 'pixel', 'dot', 'threshold', 'liquify', 'blend'].forEach(function(k){
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
      'GET /api/piece': 'query params: look, preset, palette, colors (4 hex, comma-separated, for a custom gradient), seed, speed, zoom, warp, grain, pixel, dot, threshold, halftone, liquify, blend, aspect, field, screen',
      'GET /api/looks': 'curated looks with links',
      'POST /mcp': 'MCP server — claude mcp add --transport http fluid ' + base + '/mcp'
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
