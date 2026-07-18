/* fluid-core mount: renders a Fluid piece natively into any element.
 *
 * The shader + all engine/palette/look data are GENERATED from the studio
 * (see build.mjs) — this file only owns the runtime: canvas, GL state,
 * uniforms, the animation loop, and the good-citizen behaviours an embed
 * owes its host page (pause offscreen, pause hidden tab, no rAF when
 * static, pixel-count cap, context-loss recovery).
 */
import { VSRC, FSRC } from './generated/shader.js';
import { FIELDS, PALETTES, PALETTES_RGB, SCREENS, MATERIALS, BLENDS, LOOKS } from './generated/data.js';

/* hard cap on physical pixels rendered (a 4K frame); DPR is scaled down past it */
const MAX_PIXEL_COUNT = 3840 * 2160;

function hexToRgb01(h){
  h = String(h).replace('#', '');
  if (h.length === 3){ h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2]; }
  return [parseInt(h.substr(0, 2), 16) / 255, parseInt(h.substr(2, 2), 16) / 255, parseInt(h.substr(4, 2), 16) / 255];
}
function packCol(c){ return Math.round(c[0] * 255) * 65536 + Math.round(c[1] * 255) * 256 + Math.round(c[2] * 255); }

/* accept a slug ('flow') or an index; -1 = not found */
function slugIndex(list, v){
  if (typeof v === 'number'){ return (v >= 0 && v < list.length) ? Math.round(v) : -1; }
  return list.indexOf(String(v).toLowerCase());
}

/* studio defaults (state block in index.html) minus studio-only concerns */
const DEFAULTS = {
  field: 0, field2: 0, blend: 0, layerMix: 0,
  screen: 0, material: 0, sym: 0,
  pal: 0, cols: null,
  speed: 0.6, zoom: 1.6, warp: 4.5, grain: 0.06,
  pixel: 1, dot: 10, dots: 0, thresh: 0.5,
  seed: null
};

/* ASCII screen glyph ramp — same atlas the studio builds */
function buildGlyphAtlas(doc){
  const chars = ' .:-=+*#%@';
  const cell = 28;
  const c = doc.createElement('canvas');
  c.width = cell * chars.length; c.height = cell;
  const x = c.getContext('2d');
  x.fillStyle = '#000'; x.fillRect(0, 0, c.width, c.height);
  x.fillStyle = '#fff';
  x.font = 'bold ' + Math.round(cell * 0.82) + 'px ui-monospace, Menlo, Consolas, monospace';
  x.textAlign = 'center'; x.textBaseline = 'middle';
  for (let i = 0; i < chars.length; i++){
    x.fillText(chars.charAt(i), i * cell + cell / 2, cell / 2 + 1);
  }
  return c;
}

export class FluidMount {
  constructor(container, params = {}){
    if (!container || container.nodeType !== 1){
      throw new Error('fluid-core: container must be an element');
    }
    this.container = container;
    this.doc = container.ownerDocument;
    this.state = Object.assign({}, DEFAULTS);
    this._applyParams(params);
    if (this.state.seed == null){ this.state.seed = 3 + Math.random() * 89; }

    this.canvas = this.doc.createElement('canvas');
    this.canvas.style.cssText = 'display:block;width:100%;height:100%;';
    container.appendChild(this.canvas);

    this.t = 0;
    this._raf = null;
    this._last = 0;
    this._destroyed = false;
    this._visible = true;
    this._needsPaint = true;

    const reduced = typeof matchMedia === 'function' &&
      matchMedia('(prefers-reduced-motion: reduce)').matches &&
      params.respectReducedMotion !== false;
    this._playing = params.paused ? false : !reduced;

    this._initGL();

    /* resize with the container, re-render even when static */
    this._ro = typeof ResizeObserver === 'function' ? new ResizeObserver(() => {
      this._needsPaint = true;
      this._kick();
    }) : null;
    if (this._ro){ this._ro.observe(container); }

    /* pause offscreen */
    this._io = typeof IntersectionObserver === 'function' ? new IntersectionObserver((entries) => {
      this._visible = !!(entries[0] && entries[0].isIntersecting);
      this._kick();
    }) : null;
    if (this._io){ this._io.observe(container); }

    /* pause when the tab is hidden */
    this._onVis = () => this._kick();
    this.doc.addEventListener('visibilitychange', this._onVis);

    /* GPU context loss: freeze, then rebuild on restore */
    this._onLost = (e) => { e.preventDefault(); this._stopLoop(); };
    this._onRestored = () => { this._initGL(); this._needsPaint = true; this._kick(); };
    this.canvas.addEventListener('webglcontextlost', this._onLost);
    this.canvas.addEventListener('webglcontextrestored', this._onRestored);

    this._kick();
  }

  /* ---------- public API ---------- */

  set(params){
    this._applyParams(params);
    this._needsPaint = true;
    this._kick();
    return this;
  }

  play(){ this._playing = true; this._kick(); return this; }
  pause(){ this._playing = false; this._kick(); return this; }
  get playing(){ return this._playing; }

  /** studio share link for the current piece — append-only #p= contract */
  shareUrl(base = 'https://fluid.krackeddevs.com/', embed = false){
    const s = this.state;
    const ar = this.canvas.clientHeight > 0 ? this.canvas.clientWidth / this.canvas.clientHeight : 1;
    const a = [
      +s.speed.toFixed(2), +s.zoom.toFixed(2), +s.warp.toFixed(1),
      +s.grain.toFixed(3), Math.round(s.pixel), Math.round(s.dot),
      s.dots ? 1 : 0, s.pal, +s.seed.toFixed(2),
      0.8, 0.85, +ar.toFixed(4), 0,
      embed ? 1 : 0, s.field, s.screen,
      0, 0, Math.round(s.sym || 0), 0
    ];
    if (s.pal === 8){
      a.push(packCol(s.cols[0]), packCol(s.cols[1]), packCol(s.cols[2]), packCol(s.cols[3]));
    }
    const dOff = +(s.thresh - 0.5).toFixed(2);
    if (dOff !== 0){
      while (a.length < 24){ a.push(0); }
      a.push(dOff);
    }
    if ((s.layerMix || 0) > 0.001){
      while (a.length < 25){ a.push(0); }
      a.push(s.field2 || 0, s.blend || 0, Math.round(s.layerMix * 100));
    }
    if ((s.material || 0) > 0){
      while (a.length < 28){ a.push(0); }
      a.push(Math.round(s.material));
    }
    const minLen = s.pal === 8 ? 24 : 12;
    while (a.length > minLen && a[a.length - 1] === 0){ a.pop(); }
    return base + '#p=' + a.join(',');
  }

  toDataURL(type = 'image/png', quality){
    this._resize();
    this._render();
    return this.canvas.toDataURL(type, quality);
  }

  destroy(){
    this._destroyed = true;
    this._stopLoop();
    if (this._ro){ this._ro.disconnect(); }
    if (this._io){ this._io.disconnect(); }
    this.doc.removeEventListener('visibilitychange', this._onVis);
    this.canvas.removeEventListener('webglcontextlost', this._onLost);
    this.canvas.removeEventListener('webglcontextrestored', this._onRestored);
    const lose = this.gl && this.gl.getExtension('WEBGL_lose_context');
    if (lose){ try { lose.loseContext(); } catch (e){} }
    if (this.canvas.parentNode){ this.canvas.parentNode.removeChild(this.canvas); }
  }

  /* ---------- params ---------- */

  _applyParams(p){
    const s = this.state;
    if (p.look != null){
      const lk = LOOKS.find((l) => l.label.toLowerCase() === String(p.look).toLowerCase());
      if (!lk){ throw new Error('fluid-core: unknown look "' + p.look + '"'); }
      const v = lk.p; /* [speed,zoom,warp,grain,pixel,dot,dots,pal,seed,liq,mix,ar] */
      s.speed = v[0]; s.zoom = v[1]; s.warp = v[2]; s.grain = v[3];
      s.pixel = v[4]; s.dot = v[5]; s.dots = v[6]; s.pal = v[7]; s.seed = v[8];
      s.field = lk.field || 0;
      s.screen = lk.screen || 0;
      s.material = lk.material || 0;
      s.thresh = lk.thresh != null ? lk.thresh : 0.5;
      if (lk.cols){ s.pal = 8; s.cols = lk.cols.map(hexToRgb01); }
    }
    if (p.field != null){
      const f = slugIndex(FIELDS, p.field);
      if (f < 0){ throw new Error('fluid-core: unknown field "' + p.field + '" — valid: ' + FIELDS.join(', ')); }
      s.field = f;
    }
    if (p.layer != null){
      if (p.layer === false || p.layer.mix === 0){ s.field2 = 0; s.blend = 0; s.layerMix = 0; }
      else {
        const f2 = slugIndex(FIELDS, p.layer.field != null ? p.layer.field : 0);
        const bl = slugIndex(BLENDS, p.layer.blend != null ? p.layer.blend : 'screen');
        if (f2 < 0){ throw new Error('fluid-core: unknown layer.field'); }
        if (bl < 0){ throw new Error('fluid-core: unknown layer.blend — valid: ' + BLENDS.join(', ')); }
        s.field2 = f2; s.blend = bl;
        s.layerMix = p.layer.mix != null ? Math.max(0, Math.min(1, p.layer.mix)) : 0.5;
      }
    }
    if (p.colors != null){
      if (!Array.isArray(p.colors) || p.colors.length !== 4){
        throw new Error('fluid-core: colors must be 4 hex stops, dark -> light');
      }
      s.pal = 8; s.cols = p.colors.map(hexToRgb01);
    } else if (p.palette != null){
      const pi = slugIndex(PALETTES, p.palette);
      if (pi < 0){ throw new Error('fluid-core: unknown palette "' + p.palette + '" — valid: ' + PALETTES.join(', ')); }
      s.pal = pi;
    }
    if (p.screen != null){
      const sc = p.screen === 'none' ? 0 : slugIndex(SCREENS, p.screen);
      if (sc < 0){ throw new Error('fluid-core: unknown screen — valid: ' + SCREENS.join(', ')); }
      s.screen = sc;
      /* the square screen only shows once pixel > 1.5 — give it a visible default */
      if (p.pixel == null && p.look == null && sc > 0 && s.pixel <= 1.5){ s.pixel = 6; }
    }
    if (p.material != null){
      const mt = slugIndex(MATERIALS, p.material);
      if (mt < 0){ throw new Error('fluid-core: unknown material — valid: ' + MATERIALS.join(', ')); }
      s.material = mt;
    }
    for (const k of ['speed', 'zoom', 'warp', 'grain', 'pixel', 'dot', 'dots', 'thresh', 'sym', 'seed']){
      if (p[k] != null){ s[k] = +p[k]; }
    }
  }

  /* ---------- GL ---------- */

  _initGL(){
    const gl = this.canvas.getContext('webgl', { preserveDrawingBuffer: true }) ||
               this.canvas.getContext('experimental-webgl', { preserveDrawingBuffer: true });
    if (!gl){ throw new Error('fluid-core: WebGL is not available'); }
    this.gl = gl;
    gl.getExtension('OES_standard_derivatives');

    const compile = (type, src) => {
      const sh = gl.createShader(type);
      gl.shaderSource(sh, src);
      gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)){
        throw new Error('fluid-core shader: ' + gl.getShaderInfoLog(sh));
      }
      return sh;
    };
    const prog = gl.createProgram();
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, VSRC));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FSRC));
    gl.linkProgram(prog);
    gl.useProgram(prog);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const aPos = gl.getAttribLocation(prog, 'a_pos');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    this.U = {};
    ['u_res', 'u_time', 'u_seed', 'u_scale', 'u_warp', 'u_sym', 'u_pixel', 'u_dots', 'u_dot', 'u_dither', 'u_grain',
     'u_pal', 'u_c0', 'u_c1', 'u_c2', 'u_c3', 'u_tex', 'u_hasTex', 'u_texAspect', 'u_liq', 'u_mix', 'u_split',
     'u_field', 'u_field2', 'u_blend', 'u_layerMix', 'u_screen', 'u_material', 'u_glyph', 'u_pan', 'u_mouse',
     'u_mouseAmt', 'u_mouseMode', 'u_rec', 'u_mask', 'u_hasMask', 'u_maskBg', 'u_maskBg2', 'u_maskGrad'
    ].forEach((n) => { this.U[n] = gl.getUniformLocation(prog, n); });

    const flatTex = (unit) => {
      gl.activeTexture(gl.TEXTURE0 + unit);
      const t = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 255]));
      return t;
    };
    flatTex(0);                        /* u_tex placeholder (no image melt in embeds) */
    gl.uniform1i(this.U.u_tex, 0);
    gl.activeTexture(gl.TEXTURE1);     /* glyph atlas for the ASCII screen */
    const glyph = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, glyph);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, buildGlyphAtlas(this.doc));
    gl.uniform1i(this.U.u_glyph, 1);
    flatTex(2);                        /* u_mask placeholder (no text mask in embeds) */
    gl.uniform1i(this.U.u_mask, 2);
    gl.activeTexture(gl.TEXTURE0);
  }

  _resize(){
    const w = this.container.clientWidth || 1;
    const h = this.container.clientHeight || 1;
    let dpr = Math.min((typeof devicePixelRatio === 'number' ? devicePixelRatio : 1) || 1, 2);
    if (w * h * dpr * dpr > MAX_PIXEL_COUNT){
      dpr = Math.max(1, Math.sqrt(MAX_PIXEL_COUNT / (w * h)));
    }
    const pw = Math.max(1, Math.round(w * dpr));
    const ph = Math.max(1, Math.round(h * dpr));
    if (this.canvas.width !== pw || this.canvas.height !== ph){
      this.canvas.width = pw;
      this.canvas.height = ph;
    }
  }

  _render(){
    const gl = this.gl, U = this.U, s = this.state;
    if (!gl || gl.isContextLost()){ return; }
    const k = this.canvas.clientWidth > 0 ? this.canvas.width / this.canvas.clientWidth : 1;
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.uniform2f(U.u_res, this.canvas.width, this.canvas.height);
    gl.uniform1f(U.u_time, this.t);
    gl.uniform1f(U.u_seed, s.seed);
    gl.uniform1f(U.u_scale, s.zoom);
    gl.uniform1f(U.u_warp, s.warp);
    gl.uniform1f(U.u_sym, s.sym);
    gl.uniform1f(U.u_pixel, s.pixel <= 1.5 ? 1.0 : s.pixel * k);
    gl.uniform1f(U.u_dots, s.dots);
    gl.uniform1f(U.u_dot, s.dot * k);
    gl.uniform1f(U.u_dither, s.thresh);
    gl.uniform1f(U.u_grain, s.grain);
    gl.uniform1i(U.u_pal, s.pal);
    const cc = s.pal === 8 && s.cols ? s.cols : (PALETTES_RGB[s.pal] || PALETTES_RGB[0]);
    gl.uniform3f(U.u_c0, cc[0][0], cc[0][1], cc[0][2]);
    gl.uniform3f(U.u_c1, cc[1][0], cc[1][1], cc[1][2]);
    gl.uniform3f(U.u_c2, cc[2][0], cc[2][1], cc[2][2]);
    gl.uniform3f(U.u_c3, cc[3][0], cc[3][1], cc[3][2]);
    gl.uniform1f(U.u_hasTex, 0);
    gl.uniform1f(U.u_texAspect, 1);
    gl.uniform1f(U.u_liq, 0.8);
    gl.uniform1f(U.u_mix, 0.85);
    gl.uniform1f(U.u_split, 0);
    gl.uniform1i(U.u_field, s.field);
    gl.uniform1i(U.u_field2, s.field2 || 0);
    gl.uniform1i(U.u_blend, s.blend || 0);
    gl.uniform1f(U.u_layerMix, s.layerMix || 0);
    gl.uniform1i(U.u_screen, s.screen);
    gl.uniform1i(U.u_material, s.material || 0);
    gl.uniform2f(U.u_pan, 0, 0);
    gl.uniform2f(U.u_mouse, 0.5, 0.5);
    gl.uniform1f(U.u_mouseAmt, 0);
    gl.uniform1i(U.u_mouseMode, 1);
    gl.uniform1f(U.u_rec, 0);
    gl.uniform1f(U.u_hasMask, 0);
    gl.uniform3f(U.u_maskBg, 0.05, 0.05, 0.06);
    gl.uniform3f(U.u_maskBg2, 0.16, 0.16, 0.27);
    gl.uniform1f(U.u_maskGrad, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  /* ---------- loop ---------- */

  _shouldAnimate(){
    return !this._destroyed && this._playing && this.state.speed !== 0 &&
      this._visible && this.doc.visibilityState !== 'hidden';
  }

  /* reconcile the rAF loop with current play/visibility state; paint once if static */
  _kick(){
    if (this._destroyed){ return; }
    if (this._shouldAnimate()){
      if (this._raf == null){
        this._last = 0;
        const step = (now) => {
          this._raf = null;
          if (!this._shouldAnimate()){
            if (this._needsPaint){ this._paintOnce(); }
            return;
          }
          const dt = this._last ? Math.min((now - this._last) / 1000, 0.1) : 0;
          this._last = now;
          this.t += dt * this.state.speed;
          this._resize();
          this._render();
          this._needsPaint = false;
          this._raf = requestAnimationFrame(step);
        };
        this._raf = requestAnimationFrame(step);
      }
    } else if (this._needsPaint){
      this._paintOnce();
    }
  }

  _paintOnce(){
    if (this._destroyed){ return; }
    this._resize();
    this._render();
    this._needsPaint = false;
  }

  _stopLoop(){
    if (this._raf != null){ cancelAnimationFrame(this._raf); this._raf = null; }
  }
}

export function createFluid(container, params){
  return new FluidMount(container, params);
}
