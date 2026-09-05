"use strict";var FluidBg=(()=>{var A=Object.defineProperty;var Q=Object.getOwnPropertyDescriptor;var ee=Object.getOwnPropertyNames;var ne=Object.prototype.hasOwnProperty;var te=(i,e)=>{for(var t in e)A(i,t,{get:e[t],enumerable:!0})},ae=(i,e,t,n)=>{if(e&&typeof e=="object"||typeof e=="function")for(let a of ee(e))!ne.call(i,a)&&a!==t&&A(i,a,{get:()=>e[a],enumerable:!(n=Q(e,a))||n.enumerable});return i};var ie=i=>ae(A({},"__esModule",{value:!0}),i);var fe={};te(fe,{DEFAULT_BASE:()=>q,DEFAULT_HASH:()=>v,FluidBgElement:()=>E,PRESETS:()=>g,buildSrc:()=>Y,defineFluidBg:()=>Z,ensureEmbed:()=>I,fluidBackground:()=>C,mountNative:()=>$,resolveHash:()=>D,warnIfBackgroundHidden:()=>x});var B=`attribute vec2 a_pos;
void main(){ gl_Position = vec4(a_pos, 0.0, 1.0); }`,P=`#extension GL_OES_standard_derivatives : enable
precision highp float;
uniform vec2  u_res;
uniform float u_time;
uniform float u_seed;
uniform float u_scale;
uniform float u_warp;
uniform int u_lens;
uniform float u_lensAmt;
uniform float u_sym;
uniform float u_pixel;
uniform float u_dots;
uniform float u_dot;
uniform float u_dither;
uniform float u_grain;
uniform int   u_pal;
uniform vec3  u_c0;
uniform vec3  u_c1;
uniform vec3  u_c2;
uniform vec3  u_c3;
uniform sampler2D u_tex;
uniform float u_hasTex;
uniform float u_texAspect;
uniform float u_liq;
uniform float u_mix;
uniform float u_split;
uniform int   u_field;
uniform int   u_field2;
uniform int   u_blend;
uniform float u_layerMix;
uniform int   u_field3;
uniform int   u_blend2;
uniform float u_layerMix2;
uniform int   u_screen;
uniform int   u_material;
uniform sampler2D u_glyph;
uniform sampler2D u_mask;
uniform float u_hasMask;
uniform vec3  u_maskBg;
uniform vec3  u_maskBg2;
uniform float u_maskGrad;
uniform vec2  u_pan;
uniform vec2  u_mouse;
uniform float u_mouseAmt;
uniform int   u_mouseMode;
uniform float u_rec;

float hash(vec2 p){
  /* precision-safe: no huge sin args, stable on mobile GPUs + long sessions */
  p = fract(p * 0.3183099 + fract(u_seed * 0.1031) + 0.1);
  p *= 17.0;
  return fract(p.x * p.y * (p.x + p.y));
}
float vnoise(vec2 p){
  vec2 i = floor(p); vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}
float fbm(vec2 p){
  float v = 0.0; float a = 0.5;
  for(int i = 0; i < 5; i++){
    v += a * vnoise(p);
    p = p * 2.03 + vec2(11.7, 5.9);
    a *= 0.5;
  }
  return v;
}


vec2 hash22(vec2 p){
  return vec2(hash(p), hash(p + vec2(37.2, 17.3)));
}

/* hex cell center for the point p (in cell units) */
vec2 hexCenter(vec2 p){
  vec2 r = vec2(1.0, 1.7320508);
  vec2 h = r * 0.5;
  vec2 a = mod(p, r) - h;
  vec2 b = mod(p - h, r) - h;
  vec2 gv = dot(a, a) < dot(b, b) ? a : b;
  return p - gv;
}

/* field B: curl of a noise potential -> divergence-free flow (fluid swirl).
   drift is the same bounded (d1,d2) the noise field uses, applied to the
   potential domain so the swirl morphs at the same visible rate. */
vec2 fgrad(vec2 p, vec2 off){
  float e = 0.06;
  float gx = fbm(p + vec2(e, 0.0) + off) - fbm(p - vec2(e, 0.0) + off);
  float gy = fbm(p + vec2(0.0, e) + off) - fbm(p - vec2(0.0, e) + off);
  return vec2(gx, gy) / (2.0 * e);
}
/* spread: push a mid-clustered field value out toward 0 and 1 around its midpoint, so a
   custom palette uses its FULL range. fbm/sum fields pile up near 0.5 and otherwise hide
   the end stops; geometric fields already span the range and are left alone. */
float spreadF(float v, float g){ return clamp((v - 0.5) * g + 0.5, 0.0, 1.0); }
/* complex arithmetic on vec2 (x + iy) \u2014 the math-lens layer works on the complex plane */
vec2 cmul(vec2 a, vec2 b){ return vec2(a.x * b.x - a.y * b.y, a.x * b.y + a.y * b.x); }
vec2 cdiv(vec2 a, vec2 b){ float d = dot(b, b) + 1e-6; return vec2(dot(a, b), a.y * b.x - a.x * b.y) / d; }
float fieldFlow(vec2 p, float t){
  /* curl-noise flow that reorganizes in place. Two spatially-varying warps,
     modulated by different time frequencies, reshape the flow potential locally
     (never a uniform translation), and there is no global drift on the output \u2014
     so the streams keep reforming instead of the whole field panning. */
  float amt = 0.6 + u_warp * 0.25;
  vec2 wa = vec2(fbm(p * 0.6 + 11.0), fbm(p * 0.6 + 27.0)) - 0.5;
  vec2 wb = vec2(fbm(p * 0.9 + 41.0), fbm(p * 0.9 + 63.0)) - 0.5;
  vec2 sp = p + wa * (1.1 * sin(t * 0.13)) + wb * (1.0 * cos(t * 0.091));
  vec2 g = fgrad(sp, vec2(0.0));
  vec2 curl = vec2(g.y, -g.x);
  return spreadF(fbm(p + curl * amt), 2.0);
}

/* field C: Worley/Voronoi cellular noise (warp blends cells <-> edges) */
float fieldCellular(vec2 p, float t){
  vec2 ip = floor(p);
  vec2 fp = fract(p);
  float f1 = 9.0; float f2 = 9.0;
  for (int j = -1; j <= 1; j++){
    for (int i = -1; i <= 1; i++){
      vec2 g = vec2(float(i), float(j));
      vec2 o = hash22(ip + g);
      o = 0.5 + 0.5 * sin(t * 0.5 + 6.2831 * o);
      vec2 d = g + o - fp;
      float dd = dot(d, d);
      if (dd < f1){ f2 = f1; f1 = dd; }
      else if (dd < f2){ f2 = dd; }
    }
  }
  f1 = sqrt(f1); f2 = sqrt(f2);
  float cells = 1.0 - f1;
  float edges = f2 - f1;
  return mix(cells, edges, clamp(u_warp / 9.0, 0.0, 1.0));
}
/* field D: gyroid \u2014 a 3D gyroid sliced through time; interwoven organic bands.
   warp adds a self-fold so the weave thickens/curls. */
float fieldGyroid(vec2 p, float t){
  vec3 q = vec3(p * 1.4, t * 0.3);
  float g = sin(q.x) * cos(q.y) + sin(q.y) * cos(q.z) + sin(q.z) * cos(q.x);
  g += (0.15 + u_warp * 0.12) * sin(2.0 * g + length(p));
  return 0.5 + 0.5 * sin(g * 1.6);
}

/* field E: truchet \u2014 random corner arcs per cell -> woven maze / circuit lines.
   bands follow the 0.5-radius arcs; warp packs them tighter. */
float truchetCell(vec2 p, float h){
  vec2 fp = fract(p);
  if (h < 0.5){ fp.x = 1.0 - fp.x; }
  float d = min(length(fp), length(fp - 1.0));
  d = abs(d - 0.5);
  float bands = 4.0 + u_warp * 2.5;
  return 0.5 + 0.5 * cos(d * bands * 6.2831853 - u_time * 1.5);
}
float fieldTruchet(vec2 p, float t){ return truchetCell(p, hash(floor(p))); }

/* field F: interference \u2014 overlapping ripple sources -> moire rings.
   warp raises the ripple frequency (denser moire). */
float fieldInterf(vec2 p, float t){
  float v = 0.0;
  for (int i = 0; i < 4; i++){
    float fi = float(i);
    vec2 c = 1.2 * vec2(sin(t * 0.2 + fi * 1.7), cos(t * 0.17 + fi * 2.3));
    float freq = 5.0 + u_warp * 2.0 + fi * 1.6;
    v += sin(length(p - c) * freq - t * 1.2 + fi);
  }
  return 0.5 + 0.5 * (v / 4.0);
}

/* field G: kaleidoscope \u2014 fold the angle into mirrored sectors over fbm.
   warp adds sectors (3 -> ~9) for a denser mandala. */
float fieldKaleido(vec2 p, float t){
  float ang = atan(p.y, p.x);
  float rad = length(p);
  float sectors = 3.0 + floor(u_warp * 0.7);
  float seg = 6.2831853 / sectors;
  ang = mod(ang, seg);
  ang = abs(ang - 0.5 * seg);
  vec2 q = vec2(cos(ang), sin(ang)) * rad;
  return spreadF(fbm(q * 1.6 + vec2(t * 0.35, t * 0.12)), 1.6);
}

/* field H: lines \u2014 rotated parallel bands; warp rotates + tightens them, a gentle
   wave keeps them from being dead-straight */
float fieldLines(vec2 p, float t){
  float ang = u_warp * 0.35;
  float c = cos(ang), s = sin(ang);
  vec2 q = vec2(c * p.x - s * p.y, s * p.x + c * p.y);
  float freq = 5.0 + u_warp * 1.4;
  return 0.5 + 0.5 * sin(q.x * freq + t * 0.6 + 0.6 * sin(q.y * 0.7 + t * 0.5));
}

/* field I: grid \u2014 two crossed sine rulings -> a clean lattice; warp sets density */
float fieldGrid(vec2 p, float t){
  float freq = 4.0 + u_warp * 1.4;
  float gx = sin(p.x * freq + t * 0.5);
  float gy = sin(p.y * freq - t * 0.5);
  float lines = max(gx, gy);            /* bright where either ruling peaks */
  float nodes = gx * gy;                /* brightest at the crossings */
  return spreadF(0.5 + 0.5 * mix(lines, nodes, 0.35), 1.5);
}

/* field J: golden \u2014 phyllotaxis / sunflower via the Vogel model (golden angle).
   seed index ~ r^2; the golden angle 2.39996 rad spaces the spiral arms. */
float fieldGolden(vec2 p, float t){
  float r = length(p) * (1.3 + u_warp * 0.18);
  float a = atan(p.y, p.x);
  float n = r * r;
  float spiral = cos(a - n * 2.39996323 + t * 0.55);
  float rings = cos(n * 3.14159265 - t * 0.28);
  return 0.5 + 0.5 * spiral * rings;
}
float fieldSmoke(vec2 p, float t){
  /* volumetric smoke: two-step domain-warped fbm for billowing bodies + finer
     wisps, dark-biased so the bulk falls into shadow. The warp layers are driven
     by small bounded multi-phase sways at different rates, so the body churns in
     place instead of sliding as a sheet; precision-safe. */
  float w = max(u_warp, 1.0);
  vec2 a1 = vec2(sin(t * 0.2), cos(t * 0.17)) * 0.8;
  vec2 a2 = vec2(cos(t * 0.15), sin(t * 0.24)) * 0.8;
  vec2 q = vec2(fbm(p + a1), fbm(p + vec2(5.2, 1.3) - a2));
  vec2 r = vec2(fbm(p + w * 0.42 * q + vec2(1.7, 9.2) + a2),
               fbm(p + w * 0.42 * q + vec2(8.3, 2.8) - a1));
  float body = fbm(p + w * 0.5 * r);
  float fine = fbm(p * 2.4 + r * 1.6 + a1 * 0.4);
  float d = body * 0.72 + fine * 0.28;
  return pow(clamp((d - 0.15) * 1.65, 0.0, 1.0), 1.6);
}

/* field L: quasicrystal \u2014 sum of plane-wave gratings at evenly spaced angles gives crisp
   N-fold rotational symmetry (the classic 5-fold quasicrystal). warp picks the order. */
float fieldQuasi(vec2 p, float t){
  float n = 5.0 + floor(u_warp * 0.6);
  float v = 0.0;
  for (int i = 0; i < 12; i++){
    float on = step(float(i), n - 0.5);
    float a = 3.14159265 * float(i) / max(n, 1.0);
    v += on * cos((p.x * cos(a) + p.y * sin(a)) * 8.0 + t * 0.65);
  }
  return spreadF(0.5 + 0.5 * (v / n), 1.5);
}

/* field M: honeycomb \u2014 a true hexagonal lattice (reuses hexCenter from the hex screen).
   each cell pulses from its own hash, with crisp hexagonal walls between cells. warp = density. */
float fieldHoneycomb(vec2 p, float t){
  vec2 hp = p * (1.3 + u_warp * 0.35);
  vec2 c = hexCenter(hp);
  vec2 gv = hp - c;
  float hd = max(abs(gv.x), max(abs(0.5 * gv.x + 0.8660254 * gv.y), abs(-0.5 * gv.x + 0.8660254 * gv.y)));
  float cell = 0.5 + 0.5 * sin(hash(c) * 6.2831853 + t * 0.7);
  float wall = smoothstep(0.40, 0.48, hd);
  return mix(cell, 0.04, wall);
}

/* smooth 4-stop designer gradient (dark -> light) */
vec3 ramp4(float t, vec3 a, vec3 b, vec3 c, vec3 d){
  t = clamp(t, 0.0, 1.0);
  vec3 col = mix(a, b, smoothstep(0.0, 0.34, t));
  col = mix(col, c, smoothstep(0.33, 0.67, t));
  col = mix(col, d, smoothstep(0.66, 1.0, t));
  return col;
}
vec3 palChrome(float f){
  float band = sin(f * 22.0);
  vec3 c = vec3(0.10 + 0.82 * f) * (0.78 + 0.22 * band);
  float edge = pow(1.0 - abs(band), 4.0);
  vec3 sheen = 0.5 + 0.5 * cos(6.28318 * (f * 3.0 + vec3(0.0, 0.33, 0.67)));
  return c + sheen * edge * 0.22;
}

/* bloom engine (13): a true mesh gradient \u2014 the 4 palette stops live at drifting 2D
   anchor points and blend by distance, instead of riding the 1D ramp. bloomW returns
   the 4 normalized blob weights; the scalar field (for dither/material/mask edges) is
   the weighted ramp position, the colour stage blends the stop colours directly. */
vec2 bloomAnchor(int i, float t){
  float fi = float(i);
  float aa = u_seed * 0.61803 + fi * 2.399963;              /* golden-angle ring: guaranteed spread */
  float rr = 1.05 + 0.35 * sin(u_seed * 1.3 + fi * 2.1);
  vec2 base = vec2(cos(aa), sin(aa)) * rr;
  float w1 = 0.05 + 0.023 * fi;                             /* non-commensurate drift rates */
  float w2 = 0.041 + 0.017 * fi;
  return base + vec2(sin(t * w1 + aa * 3.0), cos(t * w2 + aa * 1.7)) * 0.45;
}
vec4 bloomW(vec2 p, float t){
  /* wobble the domain so blob edges go organic instead of perfectly radial */
  vec2 q = p + (vec2(fbm(p * 0.7 + t * 0.04), fbm(p * 0.7 + vec2(4.1, 7.7) - t * 0.03)) - 0.5) * u_warp * 0.35;
  vec4 w;
  w.x = exp(-dot(q - bloomAnchor(0, t), q - bloomAnchor(0, t)) * 1.4);
  w.y = exp(-dot(q - bloomAnchor(1, t), q - bloomAnchor(1, t)) * 1.4);
  w.z = exp(-dot(q - bloomAnchor(2, t), q - bloomAnchor(2, t)) * 1.4);
  w.w = exp(-dot(q - bloomAnchor(3, t), q - bloomAnchor(3, t)) * 1.4);
  return w / max(w.x + w.y + w.z + w.w, 0.0008);
}
float fieldBloom(vec2 p, float t){
  vec4 w = bloomW(p, t);
  return dot(w, vec4(0.02, 0.35, 0.68, 0.98));
}
/* sweep engine (14): the colour ramp laid CORNER-TO-CORNER across the frame -
   dark stop top-left, light stop bottom-right - with the boundary wobbled by
   drifting noise so it stays alive. Warp = wobble depth, Zoom = wobble size. */
float fieldSweep(vec2 p, float t){
  vec2 uv = p / (u_scale * 3.0);            /* undo the domain scale: frame coords */
  float tt = dot(uv, vec2(0.7071, -0.7071)) / 1.4142 + 0.5;
  float wob = (fbm(p * 0.9 + vec2(t * 0.05, 3.7 - t * 0.04)) - 0.5) * u_warp * 0.12;
  return clamp(tt + wob, 0.0, 1.0);
}
/* marble engine (15): paper marbling \u2014 horizontal ink bands dragged through two
   passes of combed fbm swirls (suminagashi). Warp = drag depth; the bands stay
   readable as stripes while the swirls churn them. */
float fieldMarble(vec2 p, float t){
  vec2 a = vec2(sin(t * 0.11), cos(t * 0.09)) * 0.6;
  vec2 q = vec2(fbm(p * 0.9 + a), fbm(p * 0.9 + vec2(3.1, 7.3) - a));
  vec2 r = vec2(fbm(p * 1.3 + 2.2 * q + vec2(6.4, 1.9)),
               fbm(p * 1.3 + 2.2 * q + vec2(0.7, 8.8)));
  float band = sin((p.y + (r.x - 0.5) * u_warp * 1.6) * 5.0 + r.y * 4.0 + t * 0.15);
  return 0.5 + 0.5 * band;
}
/* plaid engine (16): woven tartan \u2014 a three-frequency stripe sett per axis, crossed
   like grid but richer, with an over/under weave shimmer at the thread crossings.
   Warp = thread density. */
float plaidSett(float x, float t){
  float s = 0.45 * sin(x + t) + 0.35 * sin(x * 3.0 - t * 0.7) + 0.20 * sin(x * 7.0 + t * 0.4);
  return 0.5 + 0.5 * s;
}
float fieldPlaid(vec2 p, float t){
  vec2 q = p * (1.4 + u_warp * 0.35);
  float sx = plaidSett(q.x, t * 0.25);
  float sy = plaidSett(q.y, t * 0.20);
  float over = 0.5 + 0.5 * sin(q.x * 6.0) * sin(q.y * 6.0);   /* weave: which thread is on top */
  float v = mix(max(sx, sy), sx * sy, 0.4) * (0.82 + 0.18 * over);
  return spreadF(clamp(v, 0.0, 1.0), 1.3);
}
/* curtain engine (17): aurora curtains \u2014 thin luminous verticals from ridged folds,
   ruffled sideways by fbm and swaying, over a soft backglow. Warp = ruffle depth. */
float fieldCurtain(vec2 p, float t){
  vec2 q = vec2(p.x * 1.6, p.y * 0.35);              /* stretch: verticals dominate */
  float ruff = fbm(vec2(q.x * 1.8 + t * 0.10, q.y + t * 0.05)) - 0.5;
  float x = q.x + ruff * u_warp * 0.5 + sin(q.y * 1.3 + t * 0.22) * 0.35;
  float ridge = pow(1.0 - abs(sin(x * 2.2 + t * 0.10)), 2.2);
  float glow = fbm(vec2(x * 0.7, q.y * 0.8 - t * 0.07));
  return clamp(ridge * 0.85 + glow * 0.35, 0.0, 1.0);
}
/* stitch engine (18): curve stitching \u2014 the Boole / Cremona times-table. 64 pegs on a
   ring of radius 1.1; the peg at angle a is threaded to angle k*a. The chord family
   envelope is the epicycloid with k-1 cusps (k=2 cardioid, k=3 nephroid). Threads =
   min distance to any chord; the caustic glow is the chord-density sum, brightest
   where chords crowd \u2014 so the cusped envelope emerges exactly like physical string
   art. The exterior is circle-inverted through the peg ring, so the web reflects
   into a full-frame halo of circular arcs \u2014 a rose window. Warp = k (2 -> 8: the
   species changes entirely); k also drifts with t so the figure morphs live while
   the ring slowly turns. */
float stitchSegD(vec2 p, vec2 a, vec2 b){
  vec2 pa = p - a; vec2 ba = b - a;
  float h = clamp(dot(pa, ba) / max(dot(ba, ba), 0.0001), 0.0, 1.0);
  return length(pa - ba * h);
}
float fieldStitch(vec2 p, float t){
  float rot = t * 0.05 + u_seed * 0.13;
  float k = 0.85 + u_warp * 0.9 + fract(u_seed * 0.377) * 0.7 + 0.6 * sin(t * 0.07);
  float lenO = length(p);
  if (lenO > 1.1){ p *= 1.21 / dot(p, p); }          /* circle-invert the exterior: the web reflects into a halo */
  float minD = 9.0; float glow = 0.0;
  for (int i = 0; i < 64; i++){
    float a = float(i) * 0.09817477;         /* 2*pi/64 */
    vec2 A = 1.1 * vec2(cos(a + rot), sin(a + rot));
    vec2 B = 1.1 * vec2(cos(k * a + rot), sin(k * a + rot));
    float d = stitchSegD(p, A, B);
    minD = min(minD, d);
    glow += exp(-d * 22.0);
  }
  float thread = 1.0 - smoothstep(0.0, 0.045, minD); /* the strings themselves */
  float caust = 1.0 - exp(-glow * 0.3);              /* density caustic: the envelope */
  float v = 0.12 + 0.62 * caust + 0.34 * thread;     /* lit floor + caustic + strings */
  float rim = exp(-abs(lenO - 1.1) * 24.0);          /* the peg ring */
  v = max(v, rim * 0.9);
  return clamp(v, 0.0, 1.0);
}
/* pursuit engine (19): whirling polygons - Lucas mice. Ring j+1 joins the points a
   fraction f along ring j edges: one step = rotate phi + shrink s about the centroid,
   a discrete similarity whose orbit closure is a logarithmic spiral. Warp = f (chase
   fraction); seed picks n in {3..6} + orientation; deep rings spin faster (inward whirl). */
float fieldPursuit(vec2 p, float t){
  float nf = 3.0 + mod(floor(u_seed + 0.5), 4.0);              /* polygon order n */
  float an = 3.14159265 / nf;                                   /* half face-sector angle */
  float c = cos(2.0 * an), sn = sin(2.0 * an);
  float fr = 0.03 + u_warp * 0.04;                              /* pursuit fraction from Warp */
  float fmax = 0.5 - sqrt(max(0.25 - 0.1638 / (1.0 - c), 0.0)); /* keep shrink s >= 0.82 */
  float f = min(fr, fmax);
  float phi = atan(f * sn / (1.0 - f + f * c));                 /* per-ring whirl angle */
  float s = sqrt(1.0 - 2.0 * f * (1.0 - f) * (1.0 - c));        /* per-ring shrink */
  float r = length(p), a0 = atan(p.y, p.x);
  float th = u_seed * 0.7853 + t * 0.12;                        /* whole-nest precession */
  float dth = phi + (fr - f) * 1.2 + t * 0.0072;                /* deep rings spin faster */
  float A = 2.3 * cos(an);                                      /* outer apothem: equal circumradius */
  float minD = 1000.0, depth = 0.0;
  for (int j = 0; j < 22; j++){
    float b = mod(a0 - th + an, 2.0 * an) - an;                 /* fold angle into one face sector */
    float sd = r * cos(b) - A;                                  /* regular n-gon outline SDF */
    minD = min(minD, abs(sd));
    depth += step(sd, 0.0);                                     /* rings containing p -> terraced ground */
    th += dth; A *= s;
  }
  float v = 0.05 + 0.028 * depth + 0.20 * exp(-minD * 6.0) + 0.22 * exp(-r * r * 1.5);
  return clamp(mix(v, 1.0, smoothstep(0.05, 0.012, minD) * 0.95), 0.0, 1.0);
}
/* chladni engine (20): square-plate eigenmodes \u2014 the sand figures of a vibrating
   plate. u_mn(x,y) = cos(m pi x)cos(n pi y) - cos(n pi x)cos(m pi y); sand collects
   on the nodal set u = 0, drawn as thin bright lines. A resonance sweep crossfades
   two adjacent mode pairs so the nodal web migrates and reconnects through avoided
   crossings, like sand sliding between resonances.
   Warp = eigenmode order: line count and topology change, not just density. */
float chlPlate(vec2 q, float m, float n, float s){
  float a = cos(m * 3.14159265 * q.x) * cos(n * 3.14159265 * q.y);
  float b = cos(n * 3.14159265 * q.x) * cos(m * 3.14159265 * q.y);
  return (a - b) + s * (a + b);   /* classic "-" family + a seed pinch of "+" */
}
float fieldChladni(vec2 p, float t){
  vec2 q = p * 0.5 + vec2(fract(u_seed * 0.127), fract(u_seed * 0.211)); /* plate coords; seed shifts origin */
  float m = 1.0 + floor(u_warp * 0.6);       /* warp = mode order (m <= 6, n <= 9: precision-safe) */
  float n = m + 2.0;                         /* n != m or the "-" family vanishes identically */
  float s = 0.35 * fract(u_seed * 0.61);     /* per-seed mix of the symmetric family */
  float a = t * 0.13 + u_seed * 0.9;         /* resonance sweep phase */
  float u = cos(a) * chlPlate(q, m, n, s) + sin(a) * chlPlate(q, m + 1.0, n + 1.0, s);
  float L = 1.0 - smoothstep(0.0, 0.07 + 0.05 * m, abs(u)); /* sand: bright where u ~ 0; width tracks |grad| ~ pi m */
  return clamp(L * 0.80 + 0.40 * (0.5 + 0.45 * u), 0.0, 1.0);
}
/* cassini engine (21): polynomial lemniscates \u2014 the level sets of the 2D log-
   potential Phi(p) = (1/4) sum log|p - c_k| of four drifting foci (|P(z)| = c for
   P(z) = prod(z - z_k): Cassini ovals, pinching through Bernoulli figure-eights at
   the saddles as levels cross the zeros of P prime). Foci orbit on non-commensurate
   ellipses so ovals merge and split; Warp = contour density + constellation spread. */
vec2 casFocus(int i, float t){
  float fi = float(i);
  float aa = u_seed * 0.7853 + fi * 2.399963;               /* golden-angle ring: never collinear */
  float rr = (0.5 + 0.3 * sin(u_seed * 1.7 + fi * 2.6)) * (0.8 + u_warp * 0.06);
  float w1 = 0.083 + 0.034 * fi;                            /* non-commensurate orbit rates */
  float w2 = 0.107 + 0.027 * fi;
  return vec2(cos(aa), sin(aa)) * rr + vec2(sin(t * w1 + aa * 2.1), cos(t * w2 + aa * 1.3)) * 0.4;
}
float fieldCassini(vec2 p, float t){
  /* harmonic away from the foci; the 0.05 epsilon caps the log singularity */
  float phi = log(length(p - casFocus(0, t)) + 0.05)
            + log(length(p - casFocus(1, t)) + 0.05)
            + log(length(p - casFocus(2, t)) + 0.05)
            + log(length(p - casFocus(3, t)) + 0.05);
  phi *= 0.25;
  float v = 0.5 + 0.5 * cos(phi * (0.6 + u_warp * 1.8) - t * 0.55);   /* shells radiate steadily outward */
  return spreadF(v, 1.4);
}
/* topo engine (22): topographic contour map \u2014 an fbm heightfield sliced into N
   elevation isolines, per-pixel (fract of the level index, fwidth-antialiased) so
   no marching squares is needed. Every 5th line is a major contour: thicker and
   brighter, like a survey map. Line brightness rides the elevation, so the palette
   light stops crown the peaks while the basin floor stays at stop 0. Warp = terrain
   ruggedness (domain warp); the landmass drifts slowly under the frame. */
float fieldTopo(vec2 p, float t){
  vec2 drift = vec2(t * 0.035, -t * 0.022);
  vec2 q = vec2(fbm(p * 0.8 + drift), fbm(p * 0.8 + vec2(4.7, 2.3) - drift));
  float h = fbm(p * 0.85 + (q - 0.5) * (u_warp * 0.55) + drift * 0.6);
  /* stretch fbm mid-pile into a full elevation range. NOT clamped: a clamp flattens the
     extremes onto exactly one level, and a plateau sitting on a contour fills solid. */
  float e = (h - 0.18) * 1.55;
  float lv = e * 14.0;
  float fr = fract(lv);
  float dist = min(fr, 1.0 - fr);                /* distance to the nearest contour, in level units */
  float w = max(fwidth(lv), 0.0008);
  float line = 1.0 - smoothstep(0.0, w * 1.4, dist);
  float major = step(mod(floor(lv + 0.5), 5.0), 0.5);   /* every 5th level: survey-map accent */
  line = max(line, (1.0 - smoothstep(0.0, w * 2.6, dist)) * (0.75 * major));
  /* cliffs pack more contours than a pixel can resolve \u2014 fade them out instead of
     letting the lines merge into a solid blob (a survey map thins out on scarps) */
  line *= 1.0 - smoothstep(0.22, 0.5, w);
  return clamp(line * (0.30 + 0.70 * clamp(e, 0.0, 1.0)), 0.0, 1.0);
}
/* velocity induced by one infinite row of vortices, exact. The complex potential of a row
   is w(z) = (G / 2pi i) ln sin(pi (z - z0) / a), so the velocity is its derivative,
     u - iv = (G / 2ia) cot(pi (z - z0) / a),
   and splitting cot(xi + i eta) into real and imaginary parts gives the pair below over a
   shared denominator cosh(2 eta) - cos(2 xi). ES 1.00 has no hyperbolics, so they are built
   from one exp. eta is clamped because cosh runs out of float range around 88 and zoom gets
   there; past the clamp a row reads as uniform shear anyway, which is exactly what the
   ratio tends to. The denominator is floored: it vanishes at a core, where the induced
   velocity is genuinely infinite. */
vec2 eddyRowVel(vec2 p, vec2 c, float a, float g){
  float k = 3.14159265 / a;
  float xi = (p.x - c.x) * k;
  float eta = clamp((p.y - c.y) * k, -8.0, 8.0);
  float e = exp(2.0 * eta), ei = 1.0 / e;
  float sh = 0.5 * (e - ei), ch = 0.5 * (e + ei);
  float d = max(ch - cos(2.0 * xi), 1e-4);
  float s = g / (2.0 * a);
  return vec2(-s * sh / d, s * sin(2.0 * xi) / d);
}
/* eddy engine (23): a von Karman vortex street \u2014 the staggered double row of counter-
   rotating vortices that sheds behind a cylinder between Reynolds ~40 and ~1000, which is
   the pattern in every photograph of flow past a bluff body.
   The rows are the real thing: separation held at h/a = 0.281, the von Karman stability
   ratio, and the lower row placed HALF A WAVELENGTH downstream with opposite circulation.
   That offset is the whole street \u2014 in phase the rows pair up and the wake stops staggering.
   What is drawn is not the stream function but DYE. Painting psi directly gave a rigid
   pattern sliding sideways: correct, and dead, because a steady field translating is a
   scrolling wallpaper. A wake looks alive because fluid is carried THROUGH the vortices,
   stretching and folding as it goes. So each pixel is traced BACKWARDS along the velocity
   field, stepping back in time as it goes, and the dye it started as is sampled at the far
   end. That is a streakline, and it is what the dye in the photograph actually is. Two dye
   streams either side of the wake get wound into the cores, thin into filaments, and spiral
   \u2014 motion that comes out of the integration rather than being animated on top.
   Warp = circulation: eddies roll tighter and entrain harder while the spacing stays put.
   Spacing in a real wake is set by the body and the flow speed, so letting warp stretch it
   would only be a second zoom. */
float fieldEddy(vec2 p, float t){
  float a = 1.15;                                  /* wavelength: gap between same-row cores */
  float h = 0.281 * a;                             /* von Karman stability ratio */
  float g = 0.22 + u_warp * 0.10;                  /* circulation */
  float U = 0.55;                                  /* free stream: the wake convects downstream */
  vec2 q = p;
  float tau = t;
  float dt = 0.20;
  /* backward integration. Eight steps is where the filaments stop visibly gaining length
     for the cost; the loop bound is constant because ES 1.00 requires it. */
  for (int i = 0; i < 8; i++){
    float xs = tau * U;                            /* how far the street has convected by tau */
    /* Without these two the wake is still a rigid scroll, however intricate it looks: the
       induced field depends only on (x - U tau) and the dye only on y, so advancing t by dt
       and x by U dt reproduces the frame exactly. Both are real wake behaviour rather than
       animation sprinkled on top \u2014 shedding strength pulses at the Strouhal rhythm, and a
       street meanders as it travels (vortex wander). They are applied quasi-steadily: the
       rows are exact vortex rows at each instant, slowly changing strength and position. */
    float breathe = 1.0 + 0.22 * sin(tau * 0.85);  /* shedding pulse */
    float yc = 0.13 * a * sin(tau * 0.55 + q.x * 0.6);   /* the street wanders */
    float gt = g * breathe;
    vec2 v = vec2(U, 0.0);
    v += eddyRowVel(q, vec2(xs, yc + h), a, gt);
    v += eddyRowVel(q, vec2(xs + a * 0.5, yc - h), a, -gt);
    q -= v * dt;
    tau -= dt;
  }
  /* what the fluid was before the wake got hold of it: two dye streams meeting at the
     centreline, with fine striations so stretching is visible as the filaments thin */
  float streams = 0.5 + 0.5 * (q.y * 2.2 / (1.0 + abs(q.y * 2.2)));
  float striae = 0.5 + 0.5 * cos(q.y * 9.0);
  return clamp(mix(streams, striae, 0.30), 0.0, 1.0);
}

/* ordered (Bayer) dither thresholds, recursive 2x2 -> 4x4 -> 8x8, WebGL1-safe */
float bayer2(vec2 a){ a = floor(a); return fract(a.x * 0.5 + a.y * a.y * 0.75); }
float bayer4(vec2 a){ return bayer2(0.5 * a) * 0.25 + bayer2(a); }
float bayer8(vec2 a){ return bayer4(0.5 * a) * 0.25 + bayer2(a); }
/* evaluate any engine by index \u2014 lets the base + a second Layer share the field switch.
   out disp = noise-domain displacement (only the noise engine fills it; used by the photo melt). */
float fieldOf(int eng, vec2 p, float t, out vec2 disp){
  float d1 = 1.8 * sin(t * 0.12) + 1.2 * cos(t * 0.067);
  float d2 = 1.8 * cos(t * 0.10) + 1.2 * sin(t * 0.084);
  disp = vec2(0.5);
  if (eng == 1){ return fieldFlow(p, t); }
  else if (eng == 2){ return fieldCellular(p, t); }
  else if (eng == 3){ return fieldGyroid(p, t); }
  else if (eng == 4){ return fieldTruchet(p, t); }
  else if (eng == 5){ return fieldInterf(p, t); }
  else if (eng == 6){ return fieldKaleido(p, t); }
  else if (eng == 7){ return fieldLines(p, t); }
  else if (eng == 8){ return fieldGrid(p, t); }
  else if (eng == 9){ return fieldGolden(p, t); }
  else if (eng == 10){ return fieldSmoke(p, t); }
  else if (eng == 11){ return fieldQuasi(p, t); }
  else if (eng == 12){ return fieldHoneycomb(p, t); }
  else if (eng == 13){ return fieldBloom(p, t); }
  else if (eng == 14){ return fieldSweep(p, t); }
  else if (eng == 15){ return fieldMarble(p, t); }
  else if (eng == 16){ return fieldPlaid(p, t); }
  else if (eng == 17){ return fieldCurtain(p, t); }
  else if (eng == 18){ return fieldStitch(p, t); }
  else if (eng == 19){ return fieldPursuit(p, t); }
  else if (eng == 20){ return fieldChladni(p, t); }
  else if (eng == 21){ return fieldCassini(p, t); }
  else if (eng == 22){ return fieldTopo(p, t); }
  else if (eng == 23){ return fieldEddy(p, t); }
  vec2 m1 = vec2(d1, d2);
  vec2 m2 = vec2(d2, -d1);
  vec2 q = vec2(fbm(p + m1 * 0.5), fbm(p + vec2(5.2, 1.3) + m2 * 0.5));
  disp = vec2(
    fbm(p + u_warp * q + vec2(1.7, 9.2) + m1),
    fbm(p + u_warp * q + vec2(8.3, 2.8) + m2)
  );
  return spreadF(fbm(p + u_warp * disp), 1.5);
}
/* field-level layer blend: composite engine b over engine a. amt = layer strength. */
float blendField(float a, float b, int mode, float amt){
  float r;
  if (mode == 1){ r = a * b; }                                            /* multiply */
  else if (mode == 2){ r = 1.0 - (1.0 - a) * (1.0 - b); }                 /* screen */
  else if (mode == 3){ r = min(a + b, 1.0); }                            /* add */
  else if (mode == 4){ r = abs(a - b); }                                 /* difference */
  else if (mode == 5){ r = a < 0.5 ? 2.0 * a * b : 1.0 - 2.0 * (1.0 - a) * (1.0 - b); } /* overlay */
  else { r = b; }                                                        /* 0 = normal */
  return mix(a, r, amt);
}
/* material finish: treat the field as a height map (screen-space gradient -> normal) and
   re-light the palette colour as glass / metal / sand / liquid / molten / paint. mat 0 = off.
   fv = the raw field value \u2014 molten draws its ribbons on its level sets. */
vec3 shadeMaterial(int mat, vec3 base, vec3 N, float fv){
  vec3 L = normalize(vec3(0.4, 0.7, 0.6));
  vec3 H = normalize(L + vec3(0.0, 0.0, 1.0));
  float ndl = max(dot(N, L), 0.0);
  float ndh = max(dot(N, H), 0.0);
  float fres = pow(1.0 - max(N.z, 0.0), 2.5);
  vec3 col = base;
  if (mat == 1){          /* glass \u2014 dark refractive body, bright fresnel rim + sharp spec */
    col = base * (0.35 + 0.25 * ndl) + fres * (base + 0.7) + pow(ndh, 80.0) * 1.5;
  } else if (mat == 2){   /* metal \u2014 chrome: env reflection (sky/ground by N.y) + hot spec */
    vec3 env = mix(base * 0.15 + 0.02, base * 0.7 + 0.55, smoothstep(-0.6, 0.6, N.y));
    col = env + pow(ndh, 40.0) * 2.0 + fres * 0.5;
  } else if (mat == 3){   /* sand \u2014 matte grain + soft ambient occlusion, no spec */
    float ao = clamp(0.5 + 0.5 * N.z, 0.0, 1.0);
    col = base * (0.4 + 0.6 * ndl) * ao + (hash(gl_FragCoord.xy * 1.91) - 0.5) * 0.18;
  } else if (mat == 4){   /* liquid \u2014 wet sheen: glossy spec + fresnel highlights */
    col = base * (0.5 + 0.4 * ndl) + pow(ndh, 28.0) * 1.3 + fres * 0.4 * (base + 0.3);
  } else if (mat == 5){   /* molten \u2014 liquid metal: near-black body, luminous ribbons riding
                             the fold CONTOURS (level sets of the field \u2014 smooth curves even
                             where the per-pixel normals are noisy), hot specular core */
    float ph = fv * 12.56637;                               /* ~2 ribbons per field octave */
    float s1 = 0.5 + 0.5 * sin(ph);
    float s2 = 0.5 + 0.5 * sin(ph * 2.618 + 1.7);
    float bands = pow(s1, 12.0) * 1.35 + pow(s2, 34.0) * 0.85;
    float sheen = pow(s1, 3.0) * 0.20;                      /* wide under-glow so the body reads as metal */
    vec3 tint = base / max(max(base.r, max(base.g, base.b)), 0.12);  /* palette hue at full brightness */
    col = base * 0.12 + 0.012
        + tint * (bands + sheen) * (0.75 + 0.25 * ndl)
        + tint * pow(ndh, 60.0) * 1.6
        + fres * tint * 0.15;
  } else if (mat == 6){   /* paint \u2014 impasto oil. Dabs of thick paint laid ALONG the field
                             contours (a painter follows the form), each with its own load
                             and bristle ridges, lit as glossy paint standing off a toned
                             canvas. Screen-space and height-normalised, so an export at any
                             size gets the same brushwork as the live canvas. */
    vec2 g = N.xy;                                   /* points down the field gradient */
    float gm = length(g);
    vec2 q = gl_FragCoord.xy / u_res.y;
    /* stroke direction: tangent to the contour where the field has form; where it is flat
       (gm ~ 0) there is nothing to follow, so a slow noise field decides \u2014 otherwise the
       tangent is undefined there and the dabs break into per-pixel confetti */
    float da = fbm(q * 1.4 + 3.1) * 6.2832;
    vec2 tng = vec2(-g.y, g.x) / max(gm, 1e-4);
    vec2 dir = normalize(mix(vec2(cos(da), sin(da)), tng, smoothstep(0.03, 0.18, gm)));
    vec2 prp = vec2(-dir.y, dir.x);
    /* Dabs hang off a jittered grid \u2014 two grids, the finer laid over the coarser \u2014 and
       each is measured in a frame anchored at ITS OWN centre. That anchoring is the whole
       trick: measured from the screen origin instead, a one-degree turn of the stroke
       direction slides the pattern by a whole stroke width, and a direction that follows
       the form turns everywhere, so the dabs dissolved into per-pixel grain. Anchored,
       the direction can only bend a dab across its own length. The pixel walks the 3x3
       cells around it, since a neighbour's dab may reach over. */
    float h = 0.0, id = 0.0, rim = 0.0;
    vec2 hgl = vec2(0.0);                              /* slope of the winning dab, its own frame */
    for (int lyr = 0; lyr < 2; lyr++){
      /* the under-layer is long strokes (so it walks 5x5 \u2014 they reach two cells), the
         over-layer short dabs on a finer grid (3x3 is enough) */
      float cs = lyr == 0 ? 0.060 : 0.040;                      /* dab spacing, per layer */
      vec2 cq = q / cs + float(lyr) * 0.37;
      vec2 ci = floor(cq);
      for (int j = -2; j <= 2; j++){
        for (int i = -2; i <= 2; i++){
          if (lyr == 1 && (i < -1 || i > 1 || j < -1 || j > 1)){ continue; }
          vec2 cell = ci + vec2(float(i), float(j));
          vec2 rn = hash22(cell + float(lyr) * 71.0);
          vec2 d = q - (cell + 0.25 + 0.5 * rn) * cs;         /* to this dab's centre */
          float x = dot(d, dir), y = dot(d, prp);
          float hl = lyr == 0 ? cs * (1.3 + 0.7 * rn.x) : cs * (0.8 + 0.3 * rn.x);
          float hw = cs * (0.34 + 0.14 * rn.y);
          float ex = abs(x) / hl, ey = abs(y) / hw;
          if (ex > 1.0 || ey > 1.0){ continue; }
          float di = hash(cell * 1.7 + float(lyr) * 13.0);
          /* a dab is a rounded mound of paint: an elliptical profile across, tapered ends,
             and a few soft bristle ridges along its length (noise-wobbled so they never
             read as a ruler). The mound is what the light catches \u2014 one lit edge, one
             shadowed \u2014 and that is what makes a stroke read as a stroke. */
          float ends = 1.0 - smoothstep(0.7, 1.0, ex);
          float prof = sqrt(max(1.0 - ey * ey, 0.0));
          float wob = vnoise(vec2(x / cs * 3.0 + di * 50.0, y / cs * 6.0 + di * 20.0));
          float rph = (y / hw * 1.5 + wob * 1.2) * 6.2832;
          float rid = 0.5 + 0.5 * sin(rph);
          float amp = 0.6 + 0.7 * di;                            /* thin dab, thick dab */
          float tex = 0.8 + 0.2 * rid;
          float hc = ends * prof * tex * amp;
          if (hc > h){
            h = hc; id = di; rim = max(ex, ey);
            /* the slope by hand: dFdx of a max() over overlapping dabs spikes at every
               overlap edge, and every spike caught the specular as a white speck */
            float te = ex > 0.7 ? -222.2 * (ex - 0.7) * (1.0 - ex) : 0.0;
            float dEdx = te * sign(x) / hl;
            float dPdy = -ey / max(prof, 0.15) * sign(y) / hw;
            float dRdy = 0.2 * 0.5 * cos(rph) * 6.2832 * 1.5 / hw;
            hgl = amp * vec2(dEdx * prof * tex, ends * (dPdy * tex + prof * dRdy));
          }
        }
      }
    }
    vec2 hg = (hgl.x * dir + hgl.y * prp) * 0.012;      /* back into screen space */
    vec3 Np = normalize(vec3(-hg, 1.0));
    float pdl = max(dot(Np, L), 0.0);
    float pdh = max(dot(Np, H), 0.0);
    float cover = smoothstep(0.04, 0.22, h);
    /* the ground between dabs: the palette colour toned down over a canvas weave */
    vec2 wv = q * u_res.y * 0.38;
    float weave = 0.5 + 0.25 * (sin(wv.x * 6.2832) + sin(wv.y * 6.2832)) * (0.7 + 0.3 * vnoise(wv));
    vec3 ground = base * (0.30 + 0.16 * weave) + 0.015;
    /* each dab is its own load of paint: a little lighter or darker, tilted a little warm
       or cool, and shadowed at its rim where it stands off its neighbours \u2014 that rim is
       what lets the eye separate one stroke from the next */
    float id2 = fract(id * 57.3);
    vec3 pc = base * (0.74 + 0.5 * id) * vec3(1.0 + 0.12 * (id2 - 0.5), 1.0 - 0.05 * (id2 - 0.5), 1.0 - 0.12 * (id2 - 0.5));
    float ao = 1.0 - 0.32 * smoothstep(0.55, 1.0, rim);
    col = mix(ground, pc, cover) * ao;
    col = col * (0.62 + 0.42 * pdl) * (0.85 + 0.15 * ndl) * (0.72 + 0.28 * min(h * 1.6, 1.0))
        + cover * pow(pdh, 30.0) * 0.34 * ao + fres * 0.04;
  }
  return col;
}
void main(){
  /* 0 - before/after: left of the split shows the untouched source */
  if (u_hasTex > 0.5 && u_split > 0.001 && gl_FragCoord.x < u_res.x * u_split){
    vec2 st0 = gl_FragCoord.xy / u_res;
    float ca0 = u_res.x / u_res.y;
    vec2 t0 = st0 - 0.5;
    if (ca0 > u_texAspect){ t0.y *= u_texAspect / ca0; }
    else { t0.x *= ca0 / u_texAspect; }
    t0 += 0.5 + u_pan;
    gl_FragColor = vec4(texture2D(u_tex, clamp(t0, 0.0, 1.0)).rgb, 1.0);
    return;
  }

  /* 1 - screen geometry: square (default) / hex / ascii \u2014 quantize coords */
  float csA = max(u_pixel, 8.0);
  vec2 fc = gl_FragCoord.xy;
  if (u_screen == 1){
    float cs = max(u_pixel, 3.0);
    fc = hexCenter(fc / cs) * cs;
  } else if (u_screen == 2){
    fc = (floor(fc / csA) + 0.5) * csA;
  } else if (u_screen == 3){
    float cd = max(u_pixel, 3.0);
    fc = (floor(fc / cd) + 0.5) * cd;
  } else if (u_screen == 4){
    float cg = max(u_pixel, 4.0);
    fc = (floor(fc / cg) + 0.5) * cg;
  } else if (u_pixel > 1.5){
    fc = (floor(fc / u_pixel) + 0.5) * u_pixel;
  }

  /* 2 - field: centered uv normalized by the geometric mean of w,h so forms stay
     isotropic (square stays square) AND the SAME amount of field shows at every
     aspect ratio \u2014 a portrait reveals more vertically instead of zooming in.
     (1:1 is unchanged: sqrt(s*s) == s) */
  float mn = sqrt(u_res.x * u_res.y);
  vec2 uv = (fc - 0.5 * u_res) / mn;
  vec2 p = uv * u_scale * 3.0;
  /* cursor effect: mode 1=ripple 2=lens 3=vortex 4=push */
  if (u_mouseAmt > 0.001 && u_mouseMode > 0){
    vec2 mUv = (u_mouse * u_res - 0.5 * u_res) / mn;
    vec2 dv = uv - mUv;
    float md = length(dv);
    if (u_mouseMode == 1){
      vec2 nz = vec2(fbm(dv * 6.0 + u_time * 0.3), fbm(dv * 6.0 + vec2(7.3, 2.1) - u_time * 0.25)) - 0.5;
      float env = exp(-md * 9.0);
      float wave = cos((md + nz.x * 0.12) * 30.0 - u_time * 2.0);
      vec2 dir = normalize(dv / max(md, 0.0008) + nz * 0.9);
      p += dir * wave * env * u_mouseAmt * 0.08;
    } else if (u_mouseMode == 2){
      float env = exp(-md * 5.0);
      p -= dv * env * u_mouseAmt * 0.5;
    } else if (u_mouseMode == 3){
      float angle = u_mouseAmt * 3.0 * exp(-md * 4.0);
      float ca = cos(angle), sa = sin(angle);
      p += vec2(dv.x * ca - dv.y * sa, dv.x * sa + dv.y * ca) - dv;
    } else if (u_mouseMode == 4){
      float env = exp(-md * 5.0);
      p += normalize(dv / max(md, 0.0008)) * env * u_mouseAmt * 0.28;
    }
  }
  /* time evolution: small, bounded, multi-frequency sway. The old large single-
     frequency offset translated the whole field like a rigid sheet; mixing low
     amplitudes at non-commensurate rates makes the field churn in place instead,
     and staying sin-bounded keeps it precision-safe over long sessions. */
  vec2 disp = vec2(0.5);
  float f;
  /* symmetry modifier: fold the field coordinate into N mirrored wedges -> instant mandala
     of whatever engine is selected. u_sym < 2 leaves it untouched. */
  if (u_sym >= 1.5){
    float ka = atan(p.y, p.x);
    float kr = length(p);
    float kseg = 6.2831853 / u_sym;
    ka = mod(ka, kseg);
    ka = abs(ka - 0.5 * kseg);
    p = vec2(cos(ka), sin(ka)) * kr;
  }
  /* math lens: named transforms of the complex plane, applied to the domain BOTH
     engine layers sample \u2014 any engine seen through curved space. Normalized to the
     zoom (w ~ unit disk) so a lens reads the same at every scale; u_lensAmt blends
     identity -> transformed coords. All outputs are magnitude-bounded so precision
     survives long sessions. */
  if (u_lens > 0 && u_lensAmt > 0.001){
    float lsc = u_scale * 1.5;
    vec2 w = p / lsc;
    vec2 lw = w;
    if (u_lens == 1){
      /* square: conformal power map z^2 renormalized to |z| \u2014 angles double, the
         plane wraps twice around the origin, radii keep their scale */
      lw = cmul(w, w) / max(length(w), 0.001);
    } else if (u_lens == 2){
      /* invert: circle inversion z -> R^2 z / |z|^2 \u2014 inside and outside of the
         R-ring trade places (an anticonformal involution) */
      lw = w * (0.30 / max(dot(w, w), 0.004));
    } else if (u_lens == 3){
      /* mobius: disk automorphism z -> (z - a)/(1 - conj(a) z); the pole a orbits
         slowly, so the whole space breathes hyperbolically around it */
      vec2 a = vec2(cos(u_time * 0.07), sin(u_time * 0.09)) * 0.45;
      lw = cdiv(w - a, vec2(1.0, 0.0) - cmul(vec2(a.x, -a.y), w));
      lw = clamp(lw, -8.0, 8.0);   /* the pole at 1/conj(a) is reachable with cursor warps */
    } else if (u_lens == 4){
      /* droste: log-polar spiral self-similarity (Escher). exp(rot(log z)) with a
         22.5-degree twist couples radius to angle; a slow post-rotation animates
         the spiral without unbounded zoom (log-radius stays in a fixed band) */
      vec2 lg = vec2(log(max(length(w), 0.003)), atan(w.y, w.x));
      lg = cmul(lg, vec2(0.92388, 0.38268));
      float dr = lg.y + u_time * 0.04;
      lw = exp(lg.x) * vec2(cos(dr), sin(dr));
    } else if (u_lens == 5){
      /* hyperbolic: radial blow-up of the Poincare-disk metric factor 1/(1 - |z|^2)
         \u2014 the pattern compresses without limit toward a circular horizon */
      lw = w / (1.06 - min(dot(w, w), 1.0));
    } else if (u_lens == 6){
      /* julia: iterate z -> z^2 + c and sample the engine at the folded orbit; c
         rides the |c| = 0.7885 circle (seed picks the spot, drifting through the
         Mandelbrot boundary) so the folding is always near-chaotic */
      float cp = u_seed * 2.4 + u_time * 0.02;
      vec2 c = vec2(cos(cp), sin(cp)) * 0.7885;
      vec2 z = w * 0.8;
      for (int k = 0; k < 7; k++){
        if (dot(z, z) > 4.0){ break; }
        z = cmul(z, z) + c;
      }
      lw = clamp(z, -2.0, 2.0);
    } else if (u_lens == 7){
      /* cube: conformal power map z^3 renormalized to |z| \u2014 angles triple, the
         plane wraps three times around the origin */
      lw = cmul(cmul(w, w), w) / max(dot(w, w), 0.001);
    } else if (u_lens == 8){
      /* exp: the exponential map \u2014 vertical lines become circles, horizontal
         strips unroll into radial fans; a slow x-drift breathes the radius */
      float ex = exp((w.x + 0.15 * sin(u_time * 0.09)) * 1.1) * 0.5;
      float ey = w.y * 2.0 + u_time * 0.03;
      lw = ex * vec2(cos(ey), sin(ey));
    } else if (u_lens == 9){
      /* sine: sin(z) = sin x cosh y + i cos x sinh y \u2014 a doubly-folded conformal
         lattice; every engine gains mirror periodicity (no cosh/sinh in ES 1.00)  */
      vec2 q = vec2(w.x * 2.5, w.y * 1.6);
      float chy = (exp(q.y) + exp(-q.y)) * 0.5;
      float shy = (exp(q.y) - exp(-q.y)) * 0.5;
      lw = vec2(sin(q.x) * chy, cos(q.x) * shy) * 0.55;
    } else if (u_lens == 10){
      /* joukowski: z + c^2/z \u2014 the airfoil transform of aerodynamics; circles
         near the pole become wing profiles, far field stays put */
      lw = w + 0.30 * w / max(dot(w, w), 0.02);
    } else if (u_lens == 11){
      /* newton: basins of the Newton iteration for z^3 = r \u2014 the fractal shores where
         three attractors meet; the target root-circle slowly rotates */
      float nph = u_seed * 1.3 + u_time * 0.05;
      vec2 nr = vec2(cos(nph), sin(nph));
      vec2 z = w * 1.4;
      for (int k = 0; k < 5; k++){
        vec2 z2 = cmul(z, z);
        z = z - cdiv(cmul(z, z2) - nr, 3.0 * z2);
        z = clamp(z, -3.0, 3.0);
      }
      lw = z;
    } else if (u_lens == 12){
      /* modular: fold into the SL(2,Z) fundamental domain (|Re z| < 1/2, |z| > 1
         via T: z->z+1 and S: z->-1/z) \u2014 the hyperbolic tessellation of number theory */
      vec2 z = vec2(w.x * 1.4 + u_time * 0.02, abs(w.y * 1.4) + 0.08);
      for (int k = 0; k < 6; k++){
        z.x = z.x - floor(z.x + 0.5);
        float zz = dot(z, z);
        if (zz < 1.0){ z = vec2(-z.x, z.y) / max(zz, 0.01); }
      }
      lw = clamp(z, -4.0, 4.0);
    } else {
      /* ground: the only lens that is not a map of the plane onto itself but a CAMERA.
         Every other lens here bends a flat piece; this one tips it away from you. The
         screen row is read as a ray angle and intersected with a horizontal plane, so
         depth goes as 1/(horizon - y): equal steps up the frame become ever larger steps
         into the distance, texture compresses toward the horizon, and any of the engines
         becomes a floor stretching to it.
         Above the horizon a ray never meets the plane at all, and a lens has to return
         SOMETHING \u2014 so the far side is mirrored, giving a sky that reflects the floor
         rather than a dead half-frame. abs() is what does it, and it also keeps the
         divide off zero at the horizon line itself.
         Bounded like the others: the divide is floored, which caps depth at ~27 and
         limits how finely the field is sampled at the vanishing line. It still aliases
         there, as any perspective plane does without mip-mapping, and the horizon is the
         one place a moire is honest.
         Which way the plane lies matters, and not for symmetric engines: depth is the
         engine X here, not its Y. Both are ground planes \u2014 they differ by a 90 degree turn \u2014
         but an engine with a grain reads completely differently through them. Eddy runs its
         dye along Y, so with depth on Y its whole structure collapses into horizontal bands;
         turned this way the street recedes along its own length instead. Grid renders
         identically either way, being symmetric, so nothing is given up for it. */
      float hz = 0.34;                                  /* horizon height, normalized */
      float depth = 0.55 / max(abs(hz - w.y), 0.02);
      lw = clamp(vec2(depth, w.x * depth), -60.0, 60.0);
    }
    p = mix(p, lw * lsc, u_lensAmt);
  }
  /* base layer, then optionally composite a 2nd and 3rd engine on the same domain
     (Layers). Each blends onto the accumulated result, not onto the base, so the stack
     reads top-down exactly as the tray draws it. */
  f = fieldOf(u_field, p, u_time, disp);
  float fb = f;                                    /* the base engine alone \u2014 paint reads its slope */
  if (u_layerMix > 0.001){
    vec2 disp2;
    f = blendField(f, fieldOf(u_field2, p, u_time, disp2), u_blend, u_layerMix);
  }
  if (u_layerMix2 > 0.001){
    vec2 disp3;
    f = blendField(f, fieldOf(u_field3, p, u_time, disp3), u_blend2, u_layerMix2);
  }
  if (u_hasTex > 0.5 && u_field != 0){
    float d1 = 1.8 * sin(u_time * 0.12) + 1.2 * cos(u_time * 0.067);
    float d2 = 1.8 * cos(u_time * 0.10) + 1.2 * sin(u_time * 0.084);
    disp = vec2(fbm(p + vec2(1.7, 9.2) + d1), fbm(p + vec2(8.3, 2.8) + d2));
  }
  f = smoothstep(0.08, 0.92, f); /* gentle spread \u2014 keep gradients smooth */

  /* 3 - photo blend: cover-fit, liquified by disp, luminance into f */
  if (u_hasTex > 0.5){
    vec2 st = fc / u_res;
    float ca = u_res.x / u_res.y;
    vec2 tuv = st - 0.5;
    if (ca > u_texAspect){ tuv.y *= u_texAspect / ca; }
    else { tuv.x *= ca / u_texAspect; }
    tuv += 0.5 + u_pan;
    tuv += (disp - 0.5) * u_liq * 0.25;
    vec3 ts = texture2D(u_tex, clamp(tuv, 0.0, 1.0)).rgb;
    float lum = dot(ts, vec3(0.299, 0.587, 0.114));
    f = mix(f, lum, u_mix);
  }

  /* 4 - palette: Chrome is procedural; every other palette (presets + custom)
       is a 4-stop ramp fed by colour uniforms set on the JS side.
       Bloom (13) blends the stop COLOURS by blob weight \u2014 orange meets blue
       directly instead of detouring through the middle of the ramp. */
  vec3 col;
  if (u_field == 13 && u_hasTex < 0.5 && u_pal != 7){
    vec4 bw = bloomW(p, u_time);
    col = bw.x * u_c0 + bw.y * u_c1 + bw.z * u_c2 + bw.w * u_c3;
  }
  else if (u_pal == 7){ col = palChrome(f); }
  else           { col = ramp4(f, u_c0, u_c1, u_c2, u_c3); }
  /* soft highlight bloom for a premium glow */
  col += smoothstep(0.72, 1.0, f) * 0.12;
  /* 4b - material finish: field gradient -> normal, re-light as glass/metal/sand/liquid/molten/paint */
  if (u_material > 0){
    vec2 grd = vec2(dFdx(f), dFdy(f)) * u_res.y * 0.06;
    if (u_material == 6){
      /* paint needs a direction that holds across a whole dab. The per-pixel dFdx gradient
         of a warped field turns every few pixels and shreds the strokes into confetti, so
         the base engine is re-read on a wide stencil (~1% of the frame): a low-pass
         gradient that follows the FORM of the piece, not its grain. Base engine only \u2014
         the layers add detail, not shape. Behind the uniform, so every other finish pays
         nothing for it. Forward differences off the value the main pass already has, so
         it is two extra engine reads, not four. */
      vec2 dd; float pe = 0.05 * u_scale;
      float fx1 = fieldOf(u_field, p + vec2(pe, 0.0), u_time, dd);
      float fy1 = fieldOf(u_field, p + vec2(0.0, pe), u_time, dd);
      grd = vec2(fx1 - fb, fy1 - fb) * 6.0;
    }
    col = shadeMaterial(u_material, col, normalize(vec3(-grd, 1.0)), f);
  }

  /* 5 - halftone in real (un-pixelated) coords (square screen only) */
  if (u_dots > 0.5 && u_screen == 0){
    vec2 g = mod(gl_FragCoord.xy, u_dot) - 0.5 * u_dot;
    float lum = dot(col, vec3(0.299, 0.587, 0.114));
    float radius = 0.5 * u_dot * sqrt(clamp(lum, 0.0, 1.0)) * 0.92;
    float dm = 1.0 - smoothstep(radius - 0.8, radius + 0.8, length(g));
    col = mix(col * 0.12, col * 1.12, dm);
  }

  /* 5b - ascii: cell brightness picks a glyph from the atlas */
  if (u_screen == 2){
    float lum = clamp(dot(col, vec3(0.299, 0.587, 0.114)), 0.0, 1.0);
    float gi = floor(lum * 9.999);
    vec2 cl = fract(gl_FragCoord.xy / csA);
    vec2 guv = vec2((gi + cl.x) / 10.0, 1.0 - cl.y);
    col *= texture2D(u_glyph, guv).r;
  }

  /* 5c - ordered dither: quantize the field to a 2-tone palette (c1 -> c3).
     Threshold biases the field so the bright dots grow denser or sparser. */
  if (u_screen == 3){
    float cd = max(u_pixel, 3.0);
    float bit = step(bayer8(gl_FragCoord.xy / cd), clamp(f + (u_dither - 0.5), 0.0, 1.0));
    col = mix(u_c1, u_c3, bit);
  }

  /* 5d - glitch: chromatic-aberration on the field contours, black elsewhere (RGB channel split) */
  if (u_screen == 4){
    float lev = clamp(0.5 + (u_dither - 0.5) * 0.6, 0.18, 0.82);  /* Threshold shifts which contour shows */
    float bw = 0.018;                                            /* narrow band -> thin sparse contours on black */
    col = vec3(
      1.0 - smoothstep(bw, bw * 2.6, abs(f - (lev - 0.05))),
      1.0 - smoothstep(bw, bw * 2.6, abs(f - lev)),
      1.0 - smoothstep(bw, bw * 2.6, abs(f - (lev + 0.05)))
    );
  }

  /* 6 - grain + vignette */
  float grPhase = mix(mod(floor(u_time * 10.0), 61.0) * 1.7, 23.0, u_rec);
  float gr = hash(gl_FragCoord.xy * 0.731 + grPhase) - 0.5;
  col += gr * u_grain * mix(1.0, 0.28, u_rec);
  col *= 1.0 - 0.22 * dot(uv, uv);

  /* 7 - text/logo mask: the living field fills the letters, clean bg outside.
       The background is solid u_maskBg, or a vertical A->B gradient when u_maskGrad. */
  if (u_hasMask > 0.5){
    float mk = texture2D(u_mask, vec2(gl_FragCoord.x / u_res.x, 1.0 - gl_FragCoord.y / u_res.y)).r;
    vec3 mbg = mix(u_maskBg, u_maskBg2, u_maskGrad * (1.0 - gl_FragCoord.y / u_res.y));
    col = mix(mbg, col, smoothstep(0.42, 0.58, mk));
  }

  gl_FragColor = vec4(col, 1.0);
}`;var h=["noise","flow","cellular","gyroid","truchet","interfere","kaleido","lines","grid","golden","smoke","crystal","honeycomb","bloom","sweep","marble","plaid","curtain","stitch","pursuit","chladni","cassini","topo","eddy"];var T=["aurora","sunset","ocean","dusk","ember","mint","iris","chrome"],p=[[[.035,.063,.16],[.05,.42,.45],[.27,.78,.55],[.96,.74,.84]],[[.1,.045,.18],[.52,.12,.42],[.93,.4,.25],[.99,.84,.52]],[[.02,.05,.14],[.04,.29,.5],[.18,.66,.76],[.78,.96,.91]],[[.085,.078,.2],[.35,.22,.55],[.7,.49,.77],[.97,.8,.87]],[[.035,.02,.02],[.49,.1,.1],[.9,.45,.13],[.98,.9,.72]],[[.03,.13,.11],[.12,.43,.35],[.45,.83,.67],[.93,.99,.95]],[[.04,.03,.1],[.27,.14,.62],[.4,.62,.95],[.92,.86,.99]]],L=["square","hex","ascii","dither","glitch"],M=["none","glass","metal","sand","liquid","molten","paint"],m=["none","square","invert","mobius","droste","hyperbolic","julia","cube","exp","sine","joukowski","newton","modular","ground"],z=["normal","multiply","screen","add","difference","overlay"],U=[{label:"BOREALIS",field:0,p:[.4,2,3.5,.03,1,10,0,0,30,0,0,1]},{label:"AFTERGLOW",field:1,p:[.5,1.6,4,.03,1,10,0,1,21,0,0,1]},{label:"TIDE",field:1,p:[.5,1.5,5,.03,1,10,0,2,48,0,0,1]},{label:"TWILIGHT",field:0,p:[.35,2.3,3,.03,1,10,0,3,12,0,0,1]},{label:"MAGMA",field:0,p:[.45,1.8,4.5,.03,1,10,0,4,52,0,0,1]},{label:"MERIDIAN",field:1,p:[.5,1.6,5,.03,1,10,0,5,66,0,0,1]},{label:"NEBULA",field:2,p:[.4,1.9,7,.03,1,8,0,6,40,0,0,1]},{label:"PLASMA",field:1,p:[.7,1.2,8,.04,1,10,0,0,71,0,0,1]},{label:"VELVET",field:0,p:[.3,2.6,2,.02,1,10,0,3,18,0,0,1]},{label:"CORAL",field:2,p:[.45,1.8,7,.03,1,10,0,1,33,0,0,1]},{label:"GLACIER",field:0,p:[.4,2.2,3,.03,1,10,0,2,25,0,0,1]},{label:"ONYX",field:2,p:[.4,1.9,8,.03,1,8,0,7,60,0,0,1]},{label:"WEAVE",field:3,p:[.4,1.6,5,.03,1,10,0,5,40,0,0,1]},{label:"CIRCUIT",field:4,p:[.3,2,4,.02,1,10,0,7,22,0,0,1]},{label:"RIPPLE",field:5,p:[.5,1.4,5,.03,1,10,0,2,30,0,0,1]},{label:"MANDALA",field:6,p:[.35,1.5,6,.03,1,10,0,6,55,0,0,1]},{label:"STRATA",field:7,p:[.3,1.6,3,.02,1,10,0,3,28,0,0,1]},{label:"MESH",field:8,p:[.3,1.8,4,.02,1,10,0,5,33,0,0,1]},{label:"SUNFLOWER",field:9,p:[.3,1.4,5,.02,1,10,0,4,44,0,0,1]},{label:"RIBBON",field:3,p:[.3,1.55,4.8,.02,4,9,1,2,28,0,0,.5625]},{label:"VORTEX",field:6,p:[.34,1.18,7.2,.02,6,10,1,5,61,0,0,.5625]},{label:"ABYSS",field:0,p:[.22,2.25,7.6,.03,5,8,1,2,87,0,0,.5625]},{label:"NOVA",field:5,p:[.32,1.18,6.4,.02,4,7,1,7,52,0,0,.5625]},{label:"PIXELBEAM",field:1,screen:3,thresh:.46,p:[.45,1.6,4,0,7,10,0,4,40,0,0,1]},{label:"SMOKE",field:10,cols:["#040414","#0a3a7a","#0484fc","#c2dbdc"],p:[.38,1.3,3,.015,1,10,0,0,30,0,0,1]},{label:"GILDED",field:0,material:5,cols:["#0a0602","#6b3a05","#e8940f","#ffdf8a"],p:[.28,.6,3.5,.015,1,10,0,0,47,0,0,1]},{label:"MERCURY",field:0,material:5,cols:["#020204","#1c1a2e","#5a5670","#e8e0f2"],p:[.28,.7,4,.015,1,10,0,0,61,0,0,1]},{label:"IMPASTO",field:1,material:6,cols:["#1a0f2e","#7a2a4a","#e8763a","#f6e3b4"],p:[.22,1.3,4.2,0,1,10,0,0,38,0,0,1]},{label:"BLOOM",field:13,cols:["#c2b830","#e04a12","#e8489a","#f2ead8"],p:[.35,.95,2.5,.14,1,10,0,0,24,0,0,1]},{label:"HORIZON",field:14,cols:["#0d0b2e","#552a8a","#f27059","#ffd9a0"],p:[.3,1.2,3.2,.05,1,10,0,0,33,0,0,1]},{label:"SUMI",field:15,p:[.3,1.5,5,.02,1,10,0,6,41,0,0,1]},{label:"TARTAN",field:16,p:[.35,1.4,3.5,.02,1,10,0,4,26,0,0,1]},{label:"VEIL",field:17,p:[.4,1.4,4,.03,1,10,0,5,63,0,0,1]},{label:"FILAMENT",field:18,cols:["#070512","#4a1f7a","#e05c10","#ffe8b0"],p:[.3,.95,5,.02,1,10,0,0,44,0,0,1]},{label:"GYRE",field:19,cols:["#0a0714","#3a2a7e","#b0489a","#ffe9b0"],p:[.35,1.15,4.5,.02,1,10,0,0,54,0,0,1]},{label:"CYMATIC",field:20,cols:["#0b0907","#4a3418","#c99b3f","#fff4d8"],p:[.85,1.3,4.2,.02,1,10,0,0,57,0,0,1]},{label:"CASSINI",field:21,cols:["#0a0f2e","#274690","#e8a33d","#fdf6e3"],p:[.4,1.2,5.5,.02,1,10,0,0,41,0,0,1]},{label:"ESCHER",field:4,lens:4,cols:["#0c0a08","#4a3b23","#b98a3c","#f5ead2"],p:[.3,1.4,3,.02,1,10,0,0,52,0,0,1]},{label:"FILIGREE",field:11,lens:6,cols:["#07030e","#22084a","#6a2a9c","#f5c34e"],p:[.3,1.45,3.5,.02,1,10,0,0,71,0,0,1]},{label:"SHORELINE",field:1,lens:11,cols:["#03121c","#0e4664","#4fb3a8","#f2e2b6"],p:[.35,2.2,6,.02,1,10,0,0,18,0,0,1]},{label:"ROSETTE",field:12,lens:12,cols:["#0b0d14","#2f3648","#8a8f99","#efe6d0"],p:[.3,.9,4,.02,1,10,0,0,63,0,0,1]},{label:"RELIEF",field:22,cols:["#0b0709","#3d1c2a","#c2557e","#f6d5e2"],p:[.45,1.6,4,.02,1,10,0,0,34,0,0,1]}];var G=3840*2160;function H(i){return i=String(i).replace("#",""),i.length===3&&(i=i[0]+i[0]+i[1]+i[1]+i[2]+i[2]),[parseInt(i.substr(0,2),16)/255,parseInt(i.substr(2,2),16)/255,parseInt(i.substr(4,2),16)/255]}function b(i){return Math.round(i[0]*255)*65536+Math.round(i[1]*255)*256+Math.round(i[2]*255)}function u(i,e){return typeof e=="number"?e>=0&&e<i.length?Math.round(e):-1:i.indexOf(String(e).toLowerCase())}var oe={field:0,field2:0,blend:0,layerMix:0,field3:0,blend2:0,layerMix2:0,screen:0,material:0,sym:0,lens:0,lensAmt:1,pal:0,cols:null,speed:.6,zoom:1.6,warp:4.5,grain:.06,pixel:1,dot:10,dots:0,thresh:.5,seed:null};function se(i){let e=" .:-=+*#%@",n=i.createElement("canvas");n.width=28*e.length,n.height=28;let a=n.getContext("2d");a.fillStyle="#000",a.fillRect(0,0,n.width,n.height),a.fillStyle="#fff",a.font="bold "+Math.round(28*.82)+"px ui-monospace, Menlo, Consolas, monospace",a.textAlign="center",a.textBaseline="middle";for(let o=0;o<e.length;o++)a.fillText(e.charAt(o),o*28+28/2,28/2+1);return n}var w=class{constructor(e,t={}){if(!e||e.nodeType!==1)throw new Error("fluid-core: container must be an element");this.container=e,this.doc=e.ownerDocument,this.state=Object.assign({},oe),this._applyParams(t),this.state.seed==null&&(this.state.seed=3+Math.random()*89),this.canvas=this.doc.createElement("canvas"),this.canvas.style.cssText="display:block;width:100%;height:100%;",e.appendChild(this.canvas),this.t=0,this._raf=null,this._last=0,this._destroyed=!1,this._visible=!0,this._needsPaint=!0;let n=typeof matchMedia=="function"&&matchMedia("(prefers-reduced-motion: reduce)").matches&&t.respectReducedMotion!==!1;this._playing=t.paused?!1:!n,this._initGL(),this._ro=typeof ResizeObserver=="function"?new ResizeObserver(()=>{this._needsPaint=!0,this._kick()}):null,this._ro&&this._ro.observe(e),this._io=typeof IntersectionObserver=="function"?new IntersectionObserver(a=>{this._visible=!!(a[0]&&a[0].isIntersecting),this._kick()}):null,this._io&&this._io.observe(e),this._onVis=()=>this._kick(),this.doc.addEventListener("visibilitychange",this._onVis),this._onLost=a=>{a.preventDefault(),this._stopLoop()},this._onRestored=()=>{this._initGL(),this._needsPaint=!0,this._kick()},this.canvas.addEventListener("webglcontextlost",this._onLost),this.canvas.addEventListener("webglcontextrestored",this._onRestored),this._kick()}set(e){return this._applyParams(e),this._needsPaint=!0,this._kick(),this}play(){return this._playing=!0,this._kick(),this}pause(){return this._playing=!1,this._kick(),this}get playing(){return this._playing}shareUrl(e="https://befluid.xyz/",t=!1){let n=this.state,a=this.canvas.clientHeight>0?this.canvas.clientWidth/this.canvas.clientHeight:1,o=[+n.speed.toFixed(2),+n.zoom.toFixed(2),+n.warp.toFixed(1),+n.grain.toFixed(3),Math.round(n.pixel),Math.round(n.dot),n.dots?1:0,n.pal,+n.seed.toFixed(2),.8,.85,+a.toFixed(4),0,t?1:0,n.field,n.screen,0,0,Math.round(n.sym||0),0];n.pal===8&&o.push(b(n.cols[0]),b(n.cols[1]),b(n.cols[2]),b(n.cols[3]));let s=+(n.thresh-.5).toFixed(2);if(s!==0){for(;o.length<24;)o.push(0);o.push(s)}if((n.layerMix||0)>.001){for(;o.length<25;)o.push(0);o.push(n.field2||0,n.blend||0,Math.round(n.layerMix*100))}let r=(n.layerMix||0)>.001&&(n.layerMix2||0)>.001;if((n.material||0)>0){for(;o.length<28;)o.push(0);o.push(Math.round(n.material))}if((n.lens||0)>0&&Math.round((n.lensAmt==null?1:n.lensAmt)*100)>=1){for(;o.length<29;)o.push(0);o.push(Math.round(n.lens),Math.round((n.lensAmt==null?1:n.lensAmt)*100))}if(r){for(;o.length<29;)o.push(0);o.length===29&&o.push(0,100),o.push(n.field3||0,n.blend2||0,Math.round(n.layerMix2*100))}let l=n.pal===8?24:12;for(;o.length>l&&o[o.length-1]===0;)o.pop();return e+"#p="+o.join(",")}toDataURL(e="image/png",t){return this._resize(),this._render(),this.canvas.toDataURL(e,t)}destroy(){this._destroyed=!0,this._stopLoop(),this._ro&&this._ro.disconnect(),this._io&&this._io.disconnect(),this.doc.removeEventListener("visibilitychange",this._onVis),this.canvas.removeEventListener("webglcontextlost",this._onLost),this.canvas.removeEventListener("webglcontextrestored",this._onRestored);let e=this.gl&&this.gl.getExtension("WEBGL_lose_context");if(e)try{e.loseContext()}catch{}this.canvas.parentNode&&this.canvas.parentNode.removeChild(this.canvas)}_applyParams(e){let t=this.state;if(e.look!=null){let a=U.find(s=>s.label.toLowerCase()===String(e.look).toLowerCase());if(!a)throw new Error('fluid-core: unknown look "'+e.look+'"');let o=a.p;t.speed=o[0],t.zoom=o[1],t.warp=o[2],t.grain=o[3],t.pixel=o[4],t.dot=o[5],t.dots=o[6],t.pal=o[7],t.seed=o[8],t.field=a.field||0,t.screen=a.screen||0,t.material=a.material||0,t.lens=a.lens||0,t.lensAmt=a.lensAmt!=null?a.lensAmt:1,t.thresh=a.thresh!=null?a.thresh:.5,a.cols&&(t.pal=8,t.cols=a.cols.map(H))}if(e.field!=null){let a=u(h,e.field);if(a<0)throw new Error('fluid-core: unknown field "'+e.field+'" \u2014 valid: '+h.join(", "));t.field=a}function n(a,o,s,r,l){if(a===!1||a&&a.mix===0){t[s]=0,t[r]=0,t[l]=0;return}let c=u(h,a.field!=null?a.field:0),d=u(z,a.blend!=null?a.blend:"screen");if(c<0)throw new Error("fluid-core: unknown "+o+".field \u2014 valid: "+h.join(", "));if(d<0)throw new Error("fluid-core: unknown "+o+".blend \u2014 valid: "+z.join(", "));t[s]=c,t[r]=d,t[l]=a.mix!=null?Math.max(0,Math.min(1,a.mix)):.5}if(e.layer!=null&&n(e.layer,"layer","field2","blend","layerMix"),e.layer2!=null&&n(e.layer2,"layer2","field3","blend2","layerMix2"),e.colors!=null){if(!Array.isArray(e.colors)||e.colors.length!==4)throw new Error("fluid-core: colors must be 4 hex stops, dark -> light");t.pal=8,t.cols=e.colors.map(H)}else if(e.palette!=null){let a=u(T,e.palette);if(a<0)throw new Error('fluid-core: unknown palette "'+e.palette+'" \u2014 valid: '+T.join(", "));t.pal=a}if(e.screen!=null){let a=e.screen==="none"?0:u(L,e.screen);if(a<0)throw new Error("fluid-core: unknown screen \u2014 valid: "+L.join(", "));t.screen=a,e.pixel==null&&e.look==null&&a>0&&t.pixel<=1.5&&(t.pixel=6)}if(e.material!=null){let a=u(M,e.material);if(a<0)throw new Error("fluid-core: unknown material \u2014 valid: "+M.join(", "));t.material=a}if(e.lens!=null){let a=u(m,e.lens);if(a<0)throw new Error("fluid-core: unknown lens \u2014 valid: "+m.join(", "));t.lens=a}for(let a of["speed","zoom","warp","grain","pixel","dot","dots","thresh","sym","seed","lensAmt"])e[a]!=null&&(t[a]=+e[a]);(t.lens||0)>0&&!(t.lensAmt>0)&&(t.lensAmt=1)}_initGL(){let e=this.canvas.getContext("webgl",{preserveDrawingBuffer:!0})||this.canvas.getContext("experimental-webgl",{preserveDrawingBuffer:!0});if(!e)throw new Error("fluid-core: WebGL is not available");this.gl=e,e.getExtension("OES_standard_derivatives");let t=(l,c)=>{let d=e.createShader(l);if(e.shaderSource(d,c),e.compileShader(d),!e.getShaderParameter(d,e.COMPILE_STATUS))throw new Error("fluid-core shader: "+e.getShaderInfoLog(d));return d},n=e.createProgram();e.attachShader(n,t(e.VERTEX_SHADER,B)),e.attachShader(n,t(e.FRAGMENT_SHADER,P)),e.linkProgram(n),e.useProgram(n);let a=e.createBuffer();e.bindBuffer(e.ARRAY_BUFFER,a),e.bufferData(e.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),e.STATIC_DRAW);let o=e.getAttribLocation(n,"a_pos");e.enableVertexAttribArray(o),e.vertexAttribPointer(o,2,e.FLOAT,!1,0,0),this.U={},["u_res","u_time","u_seed","u_scale","u_warp","u_sym","u_pixel","u_dots","u_dot","u_dither","u_grain","u_pal","u_c0","u_c1","u_c2","u_c3","u_tex","u_hasTex","u_texAspect","u_liq","u_mix","u_split","u_field","u_field2","u_blend","u_layerMix","u_field3","u_blend2","u_layerMix2","u_screen","u_material","u_lens","u_lensAmt","u_glyph","u_pan","u_mouse","u_mouseAmt","u_mouseMode","u_rec","u_mask","u_hasMask","u_maskBg","u_maskBg2","u_maskGrad"].forEach(l=>{this.U[l]=e.getUniformLocation(n,l)});let s=l=>{e.activeTexture(e.TEXTURE0+l);let c=e.createTexture();return e.bindTexture(e.TEXTURE_2D,c),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_S,e.CLAMP_TO_EDGE),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_T,e.CLAMP_TO_EDGE),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MIN_FILTER,e.LINEAR),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MAG_FILTER,e.LINEAR),e.texImage2D(e.TEXTURE_2D,0,e.RGBA,1,1,0,e.RGBA,e.UNSIGNED_BYTE,new Uint8Array([0,0,0,255])),c};s(0),e.uniform1i(this.U.u_tex,0),e.activeTexture(e.TEXTURE1);let r=e.createTexture();e.bindTexture(e.TEXTURE_2D,r),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_S,e.CLAMP_TO_EDGE),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_T,e.CLAMP_TO_EDGE),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MIN_FILTER,e.LINEAR),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MAG_FILTER,e.LINEAR),e.pixelStorei(e.UNPACK_FLIP_Y_WEBGL,!1),e.texImage2D(e.TEXTURE_2D,0,e.RGBA,e.RGBA,e.UNSIGNED_BYTE,se(this.doc)),e.uniform1i(this.U.u_glyph,1),s(2),e.uniform1i(this.U.u_mask,2),e.activeTexture(e.TEXTURE0)}_resize(){let e=this.container.clientWidth||1,t=this.container.clientHeight||1,n=Math.min((typeof devicePixelRatio=="number"?devicePixelRatio:1)||1,2);e*t*n*n>G&&(n=Math.max(1,Math.sqrt(G/(e*t))));let a=Math.max(1,Math.round(e*n)),o=Math.max(1,Math.round(t*n));(this.canvas.width!==a||this.canvas.height!==o)&&(this.canvas.width=a,this.canvas.height=o)}_render(){let e=this.gl,t=this.U,n=this.state;if(!e||e.isContextLost())return;let a=this.canvas.clientWidth>0?this.canvas.width/this.canvas.clientWidth:1;e.viewport(0,0,this.canvas.width,this.canvas.height),e.uniform2f(t.u_res,this.canvas.width,this.canvas.height),e.uniform1f(t.u_time,this.t),e.uniform1f(t.u_seed,n.seed),e.uniform1f(t.u_scale,n.zoom),e.uniform1f(t.u_warp,n.warp),e.uniform1f(t.u_sym,n.sym),e.uniform1i(t.u_lens,Math.round(n.lens||0)),e.uniform1f(t.u_lensAmt,n.lensAmt==null?1:n.lensAmt),e.uniform1f(t.u_pixel,n.pixel<=1.5?1:n.pixel*a),e.uniform1f(t.u_dots,n.dots),e.uniform1f(t.u_dot,n.dot*a),e.uniform1f(t.u_dither,n.thresh),e.uniform1f(t.u_grain,n.grain),e.uniform1i(t.u_pal,n.pal);let o=n.pal===8&&n.cols?n.cols:p[n.pal]||p[0];e.uniform3f(t.u_c0,o[0][0],o[0][1],o[0][2]),e.uniform3f(t.u_c1,o[1][0],o[1][1],o[1][2]),e.uniform3f(t.u_c2,o[2][0],o[2][1],o[2][2]),e.uniform3f(t.u_c3,o[3][0],o[3][1],o[3][2]),e.uniform1f(t.u_hasTex,0),e.uniform1f(t.u_texAspect,1),e.uniform1f(t.u_liq,.8),e.uniform1f(t.u_mix,.85),e.uniform1f(t.u_split,0),e.uniform1i(t.u_field,n.field),e.uniform1i(t.u_field2,n.field2||0),e.uniform1i(t.u_blend,n.blend||0),e.uniform1f(t.u_layerMix,n.layerMix||0),e.uniform1i(t.u_field3,n.field3||0),e.uniform1i(t.u_blend2,n.blend2||0),e.uniform1f(t.u_layerMix2,(n.layerMix||0)>.001&&n.layerMix2||0),e.uniform1i(t.u_screen,n.screen),e.uniform1i(t.u_material,n.material||0),e.uniform2f(t.u_pan,0,0),e.uniform2f(t.u_mouse,.5,.5),e.uniform1f(t.u_mouseAmt,0),e.uniform1i(t.u_mouseMode,1),e.uniform1f(t.u_rec,0),e.uniform1f(t.u_hasMask,0),e.uniform3f(t.u_maskBg,.05,.05,.06),e.uniform3f(t.u_maskBg2,.16,.16,.27),e.uniform1f(t.u_maskGrad,0),e.drawArrays(e.TRIANGLES,0,3)}_shouldAnimate(){return!this._destroyed&&this._playing&&this.state.speed!==0&&this._visible&&this.doc.visibilityState!=="hidden"}_kick(){if(!this._destroyed)if(this._shouldAnimate()){if(this._raf==null){this._last=0;let e=t=>{if(this._raf=null,!this._shouldAnimate()){this._needsPaint&&this._paintOnce();return}let n=this._last?Math.min((t-this._last)/1e3,.1):0;this._last=t,this.t+=n*this.state.speed,this._resize(),this._render(),this._needsPaint=!1,this._raf=requestAnimationFrame(e)};this._raf=requestAnimationFrame(e)}}else this._needsPaint&&this._paintOnce()}_paintOnce(){this._destroyed||(this._resize(),this._render(),this._needsPaint=!1)}_stopLoop(){this._raf!=null&&(cancelAnimationFrame(this._raf),this._raf=null)}};function S(i,e){return new w(i,e)}function y(i){return i=Math.max(0,Math.round(i)),[Math.floor(i/65536)%256/255,Math.floor(i/256)%256/255,i%256/255]}function re(i){let e=t=>{let n=Math.max(0,Math.min(255,Math.round(t*255))).toString(16);return n.length<2?"0"+n:n};return"#"+e(i[0])+e(i[1])+e(i[2])}var f=(i,e,t)=>Math.min(t,Math.max(e,Math.round(i))),R=h.length-1,le=m.length-1;function _(i){let e=String(i||""),t=e.indexOf("#p=");t>=0?e=e.slice(t+3):e.indexOf("p=")===0?e=e.slice(2):e.charAt(0)==="#"&&(e=e.slice(1));let n=e.split(",").map(parseFloat);if(n.length<12||n.some(isNaN))return null;let a={speed:n[0],zoom:n[1],warp:n[2],grain:n[3],pixel:Math.round(n[4]),dot:Math.round(n[5]),dots:Math.round(n[6])?1:0,seed:n[8],ar:n[11]>=.3&&n[11]<=3?n[11]:1,field:n.length>14?f(n[14],0,R):0,screen:n.length>15?f(n[15],0,4):0,sym:n.length>18?f(n[18],0,12):0,thresh:n.length>24?Math.max(0,Math.min(1,.5+n[24])):.5,material:n.length>28?f(n[28],0,6):0,lens:n.length>29?f(n[29],0,le):0,lensAmt:n.length>30?Math.max(0,Math.min(1,n[30]/100)):1},o=f(n[7],0,8);if(o===8){let r=n.length>23?[y(n[20]),y(n[21]),y(n[22]),y(n[23])]:p[0];a.colors=r.map(re)}else a.palette=o;let s=n.length>27?Math.max(0,Math.min(1,n[27]/100)):0;if(s>.001){a.layer={field:n.length>25?f(n[25],0,R):0,blend:n.length>26?f(n[26],0,5):0,mix:s};let r=n.length>33?Math.max(0,Math.min(1,n[33]/100)):0;r>.001&&(a.layer2={field:n.length>31?f(n[31],0,R):0,blend:n.length>32?f(n[32],0,5):0,mix:r})}return a}var g={mist:{hash:"#p=0.12,0.9,2,0.02,1,10,0,8,21,0,0,1,0,0,0,0,0,0,0,0,724242,1712176,3820139,8229045",colors:["#0b0d12","#1a2030","#3a4a6b","#7d90b5"],tone:"dark",tip:"cool grey-blue haze"},ember:{hash:"#p=0.14,0.85,2.5,0.02,1,10,0,8,33,0,0,1,0,0,13,0,0,0,0,0,919817,2757648,9320994,13926988",colors:["#0e0909","#2a1410","#8e3a22","#d4824c"],tone:"dark",tip:"warm glow from below"},dusk:{hash:"#p=0.1,1,2,0.02,1,10,0,8,48,0,0,1,0,0,14,0,0,0,0,0,657951,2759242,6963097,12162524",colors:["#0a0a1f","#2a1a4a","#6a3f99","#b995dc"],tone:"dark",tip:"violet gradient, edges alive"},ink:{hash:"#p=0.12,0.8,3,0.03,1,10,0,8,18,0,0,1,0,0,10,0,0,0,0,0,657930,1579032,3421236,7237230",colors:["#0a0a0a","#181818","#343434","#6e6e6e"],tone:"dark",tip:"monochrome smoke"},glow:{hash:"#p=0.15,0.9,2.5,0.02,1,10,0,8,60,0,0,1,0,0,13,0,0,0,0,0,397594,734272,1277301,8375743",colors:["#06111a","#0b3440","#137d75","#7fcdbf"],tone:"dark",tip:"teal light"},aurora:{hash:"#p=0.12,1.1,2.5,0.02,1,10,0,8,30,0,0,1,0,0,17,0,0,0,0,0,330002,730676,1732452,7652011",colors:["#050912","#0b2634","#1a6f64","#74c2ab"],tone:"dark",tip:"a slow curtain"},deep:{hash:"#p=0.15,0.9,2,0.02,1,10,0,8,52,0,0,1,0,0,1,0,0,0,0,0,329485,725542,1715550,4878289",colors:["#05070d","#0b1226","#1a2d5e","#4a6fd1"],tone:"dark",tip:"blue current"},paper:{hash:"#p=0.1,0.9,2,0.03,1,10,0,8,24,0,0,1,0,0,0,0,0,0,0,0,16250093,15525334,14208181,12168080",colors:["#f7f4ed","#ece5d6","#d8ccb5","#b9ab90"],tone:"light",tip:"warm paper"},lilac:{hash:"#p=0.12,0.85,2.5,0.02,1,10,0,8,41,0,0,1,0,0,13,0,0,0,0,0,16315900,15459063,13481706,10912984",colors:["#f8f5fc","#ebe2f7","#cdb6ea","#a684d8"],tone:"light",tip:"soft lilac"},shore:{hash:"#p=0.1,1,2,0.02,1,10,0,8,27,0,0,1,0,0,14,0,0,0,0,0,15988985,14675697,11130076,6269112",colors:["#f3f8f9","#dfeef1","#a9d4dc","#5fa8b8"],tone:"light",tip:"sea-glass light"}},Ee=Object.keys(g);var q="https://befluid.xyz",v="#p=0.5,1.5,5.5,0.03,1,10,0,0,18,0,0,1.7778,0,1,1",j=13;function I(i){let e=i||v;e.charAt(0)==="#"&&(e=e.slice(1)),e.indexOf("p=")===0&&(e=e.slice(2)),/^[0-9.,\-]*$/.test(e)||(e=v.replace(/^#p=/,""));let t=e.split(",");for(;t.length<=j;)t.push("0");return t[j]="1","#p="+t.join(",")}function D(i={}){if(i.hash)return i.hash;let e=i.preset?g[String(i.preset).toLowerCase()]:void 0;return e?e.hash:v}function Y(i={}){let e=(i.base||q).replace(/\/+$/,"");return/^https?:\/\//i.test(e)||(e=q.replace(/\/+$/,"")),e+"/"+I(D(i))}function W(i,e,t,n){let a=Number(i);return isNaN(a)?n:Math.min(t,Math.max(e,a))}function de(i){return i&&/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(i)?i:"#000"}function F(i,e,t){let n=W(t.blur,0,120,0),a=W(t.dim,0,1,0),o=Math.ceil(n*2);e.style.cssText="position:absolute;top:-"+o+"px;left:-"+o+"px;right:-"+o+"px;bottom:-"+o+"px;"+(n>0?"filter:blur("+n+"px);":"");let s=i.querySelector(":scope > [data-fluid-dim]");a>0?(s||(s=document.createElement("div"),s.setAttribute("data-fluid-dim",""),i.appendChild(s)),s.style.cssText="position:absolute;inset:0;pointer-events:none;background:"+de(t.dimColor)+";opacity:"+a+";"):s&&s.remove()}function X(i){if(!i)return!1;let e=getComputedStyle(i).backgroundColor;if(!e||e==="transparent")return!1;let t=e.match(/^rgba?\(([^)]+)\)/i);if(!t)return!0;let n=t[1].split(",");return(n.length>=4?parseFloat(n[3]):1)>0}var V=!1;function x(i){V||typeof document=="undefined"||typeof getComputedStyle=="undefined"||i>=0||(X(document.body)||X(document.documentElement))&&(V=!0,console.warn("[fluid-bg] A `fixed` background sits at z-index "+i+", but the page background (on <body>/<html>) is opaque and paints over it, so you'll see nothing (often a black screen). Make the page background transparent \u2014 e.g. `html, body { background: transparent }` \u2014 or raise the z-index above your page background. See https://github.com/enonforetsam/fluid/tree/master/fluid-bg#using-fixed-keep-the-page-background-transparent"))}function ce(i){let e=document.createElement("iframe");return e.src=i,e.title="Fluid background",e.loading="lazy",e.setAttribute("aria-hidden","true"),e.setAttribute("tabindex","-1"),e.style.cssText="border:0;display:block;width:100%;height:100%;pointer-events:none;",e}function $(i,e){let t=_(I(e))||_(v);return S(i,t)}function K(i,e){let t=document.createElement("div");if(i.appendChild(t),F(i,t,e),e.mode!=="iframe")try{let a=$(t,D(e));return{mode:"native",cleanup:()=>a.destroy(),mount:a,treat:o=>F(i,t,o)}}catch{}let n=ce(Y(e));return t.appendChild(n),{mode:"iframe",cleanup:()=>n.remove(),treat:a=>F(i,t,a)}}function C(i,e={}){if(e.fixed){let o=e.z==null||isNaN(Number(e.z))?-1:Number(e.z);x(o);let s=document.createElement("div");s.style.cssText="position:fixed;inset:0;overflow:hidden;pointer-events:none;z-index:"+o+";",(i||document.body).appendChild(s);let r=K(s,e);return{el:s,mode:r.mode,destroy:()=>{r.cleanup(),s.remove()},pause:r.mount?()=>{r.mount.pause()}:void 0,play:r.mount?()=>{r.mount.play()}:void 0,treat:r.treat}}let t=i||document.body;getComputedStyle(t).position==="static"&&(t.style.position="relative");let n=document.createElement("div");n.style.cssText="position:absolute;inset:0;width:100%;height:100%;overflow:hidden;pointer-events:none;",t.appendChild(n);let a=K(n,e);return{el:t,mode:a.mode,destroy:()=>{a.cleanup(),n.remove()},pause:a.mount?()=>{a.mount.pause()}:void 0,play:a.mount?()=>{a.mount.play()}:void 0,treat:a.treat}}var E=class extends HTMLElement{constructor(){super(...arguments);this.handle=null;this.renderedKey="";this.treatKey=""}static get observedAttributes(){return["hash","preset","blur","dim","dim-color","fixed","z","base","mode"]}connectedCallback(){if(this.render(),this.hasAttribute("fixed")){let t=this.getAttribute("z");x(t==null?-1:Number(t))}}disconnectedCallback(){this.handle&&(this.handle.destroy(),this.handle=null),this.renderedKey=""}attributeChangedCallback(){this.isConnected&&this.render()}render(){let t=this.getAttribute("z"),n=t==null||isNaN(Number(t))?-1:Number(t),a=this.getAttribute("hash")||void 0,o=this.getAttribute("preset")||void 0,s=this.hasAttribute("blur")?Number(this.getAttribute("blur")):void 0,r=this.hasAttribute("dim")?Number(this.getAttribute("dim")):void 0,l=this.getAttribute("dim-color")||void 0,c=this.getAttribute("base")||void 0,d=this.getAttribute("mode")==="iframe"?"iframe":"native",N=[a,o,c,d,n,this.hasAttribute("fixed")].join("|"),k=[s,r,l].join("|");if(N===this.renderedKey){k!==this.treatKey&&this.handle&&(this.handle.treat({blur:s,dim:r,dimColor:l}),this.treatKey=k);return}this.renderedKey=N,this.treatKey=k;let O=this.shadowRoot||this.attachShadow({mode:"open"});this.handle&&(this.handle.destroy(),this.handle=null),O.innerHTML="<style>:host{display:block;position:relative;width:100%;height:100%}:host([fixed]){position:fixed;inset:0;width:100vw;height:100vh;pointer-events:none;overflow:hidden;z-index:"+n+'}</style><div style="position:absolute;inset:0"></div>';let J=O.lastElementChild;this.handle=C(J,{hash:a,preset:o,blur:s,dim:r,dimColor:l,base:c,mode:d})}};function Z(i="fluid-bg"){typeof customElements!="undefined"&&!customElements.get(i)&&customElements.define(i,E)}typeof window!="undefined"&&typeof customElements!="undefined"&&Z();return ie(fe);})();
//# sourceMappingURL=fluid-bg.iife.js.map
