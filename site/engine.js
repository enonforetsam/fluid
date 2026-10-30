/*
 * Fluid FireRenderer — original image compositing shader and renderer.
 * Copyright (c) 2026 Fluid contributors. SPDX-License-Identifier: MIT
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies
 * of the Software, and to permit persons to whom the Software is furnished to do
 * so, subject to the following conditions:
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

const VERTEX = `
attribute vec2 a_position;
varying vec2 v_uv;
void main() {
  v_uv = a_position * 0.5 + 0.5;
  gl_Position = vec4(a_position, 0.0, 1.0);
}`;

// Fire is composited above the original RGB image. It is never a replacement
// palette. "Edges" means local luminance/alpha contours, not subject detection.
const FRAGMENT = `
precision highp float;
varying vec2 v_uv;
uniform sampler2D u_source;
uniform vec2 u_resolution;
uniform vec2 u_sourceSize;
uniform float u_time;
uniform float u_intensity;
uniform float u_heat;
uniform float u_motion;
uniform float u_detail;
uniform float u_color;
uniform float u_edges;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0)), f.x), f.y);
}
float fbm(vec2 p) {
  float n = 0.0, a = 0.57;
  for (int i = 0; i < 4; i++) {
    n += a * noise(p);
    p = mat2(1.63, -1.17, 1.17, 1.63) * p + vec2(3.7, 9.2);
    a *= 0.48;
  }
  return n;
}
vec2 imageUv(vec2 p) {
  float viewAspect = u_resolution.x / u_resolution.y;
  float sourceAspect = u_sourceSize.x / u_sourceSize.y;
  vec2 scale = vec2(max(viewAspect / sourceAspect, 1.0),
                    max(sourceAspect / viewAspect, 1.0));
  return (p - 0.5) * scale + 0.5;
}
vec4 sourceAt(vec2 p) {
  vec2 q = imageUv(p);
  float inside = step(0.0, q.x) * step(q.x, 1.0)
               * step(0.0, q.y) * step(q.y, 1.0);
  vec4 s = texture2D(u_source, clamp(q, 0.0, 1.0));
  s.a *= inside;
  return s;
}
float luma(vec4 c) { return dot(c.rgb, vec3(0.299, 0.587, 0.114)) * c.a; }
float imageInterior(vec2 p) {
  vec2 q = imageUv(p);
  float edge = min(min(q.x, 1.0 - q.x), min(q.y, 1.0 - q.y));
  // Physical image boundaries are not burning contours. This guard also stops
  // the transparent contain-fit area from creating a rectangular flame frame.
  return smoothstep(0.002, 0.018, edge);
}

vec3 fireColor(float temperature) {
  vec3 low = vec3(0.93, 0.105, 0.015);
  vec3 mid = vec3(1.0, 0.43, 0.035);
  vec3 high = vec3(1.0, 0.91, 0.52);
  if (u_color > 0.5 && u_color < 1.5) {
    low = vec3(0.95, 0.025, 0.018);
    mid = vec3(1.0, 0.22, 0.018);
    high = vec3(1.0, 0.79, 0.22);
  } else if (u_color > 1.5) {
    low = vec3(0.13, 0.12, 0.95);
    mid = vec3(0.05, 0.63, 1.0);
    high = vec3(0.76, 0.97, 1.0);
  }
  return mix(mix(low, mid, smoothstep(0.0, 0.55, temperature)),
             high, smoothstep(0.5, 1.0, temperature));
}

void main() {
  vec2 uv = v_uv;
  vec4 original = sourceAt(uv);
  if (u_intensity <= 0.00001) {
    gl_FragColor = original;
    return;
  }
  float aspect = u_resolution.x / u_resolution.y;
  vec2 p = vec2(uv.x * aspect, uv.y);
  float t = u_time;
  float drift = fbm(p * vec2(8.0, 3.5) - vec2(0.0, t * 0.7));
  float column = noise(vec2(p.x * 21.0 + drift * 1.5, t * 0.47));
  // Neighboring columns burn to different heights, so a curved photo contour
  // cannot turn into a uniformly extruded silhouette.
  float rise = mix(0.055, 0.27, u_intensity) * mix(0.38, 1.24, column);
  float transport = 0.0;
  float baseLum = luma(original);
  // Keep every octave vertically stretched. Rotating the FBM domain here
  // would turn flame tongues into isotropic clouds and soften away the gaps.
  float curl = sin(p.y * 15.0 - t * 1.6) * 0.65 + (drift - 0.5) * 3.7;
  vec2 flow = vec2(p.x * 32.0 + curl, p.y * 6.0 - t * 1.9);
  float turbulence = noise(flow) * 0.62
                   + noise(flow * vec2(2.07, 1.91) + vec2(5.7, t * 0.35)) * 0.27
                   + noise(flow * vec2(4.13, 3.83) + vec2(17.3, 8.1)) * 0.11;
  // Integrate a continuous vertical plume instead of repeating sharp gradient
  // outlines at several heights. Differences between the current image value
  // and the image below it make light spill beyond contours. These are image
  // contrasts, not an inferred foreground subject or segmentation mask.
  for (int i = 0; i < 16; i++) {
    float h = (float(i) + 0.5) / 16.0;
    vec2 q = uv - vec2(0.0, h * rise);
    q.x += ((drift - 0.5) * 0.085 * h
          + sin(p.y * 18.0 - t * 1.7 + h * 3.0) * 0.009 * h) / aspect;
    vec4 s = sourceAt(q);
    float contrast = max(abs(luma(s) - baseLum) - 0.035, 0.0) * 1.9;
    float alphaEdge = max(s.a - original.a, 0.0);
    float contour = max(contrast, alphaEdge);
    float whole = s.a * (0.3 + luma(s) * 0.45);
    float emission = mix(whole, contour, u_edges);
    float taper = pow(1.0 - h, 1.15);
    transport += emission * taper * imageInterior(q);
  }
  float plume = clamp(transport / 7.2, 0.0, 1.0);
  // Erode the transport aggressively rather than slightly modulating opacity.
  // Only low-noise channels survive aloft: narrow tongues, dark gaps, and
  // occasional white-hot cores close to the emission contour.
  float body = plume * 0.94 - (0.13 + turbulence * 0.92);
  float flame = smoothstep(-0.018, 0.14, body) * smoothstep(0.015, 0.25, plume);
  float core = smoothstep(0.14, 0.43, body);
  float aura = smoothstep(0.0, 0.8, plume) * 0.7;
  float frameGuard = imageInterior(uv);
  // Bright photographic interiors stay legible while the strongest fire sits
  // in darker space outside them. Keep-image-detail controls this protection.
  float interiorProtection = mix(1.0, 1.0 - smoothstep(0.28, 0.8, baseLum) * 0.90, u_detail);
  flame *= frameGuard * interiorProtection;
  aura *= frameGuard * interiorProtection;

  // A small refraction of the photograph itself sells heat while detail keeps
  // it restrained. The untouched photograph remains the compositing base.
  vec2 heatWarp = vec2(noise(p * 34.0 - vec2(0.0, t * 2.0)) - 0.5,
                      noise(p * 27.0 + vec2(t, 9.3)) - 0.5);
  heatWarp *= u_heat * u_intensity * aura * mix(0.012, 0.003, u_detail);
  heatWarp.x /= aspect;
  vec4 source = sourceAt(uv + heatWarp);
  source = mix(original, source, 0.8);

  // Sparse glowing flecks travel upward; source fuel limits emission to the
  // image region and contours. Alpha is retained for transparent sources.
  vec2 particleP = vec2(p.x * 96.0 + sin(t + p.y * 8.0) * 0.28,
                        p.y * 78.0 - t * 4.5);
  vec2 cell = floor(particleP), local = fract(particleP) - 0.5;
  float alive = step(0.976, hash(cell));
  float spark = exp(-dot(local * vec2(1.0, 0.65), local * vec2(1.0, 0.65)) * 125.0);
  spark *= alive * (0.35 + 0.65 * sin(hash(cell + 1.7) * 6.28 + t) * sin(hash(cell + 1.7) * 6.28 + t));
  spark *= clamp(aura * 3.0, 0.0, 1.0);

  float preserve = mix(1.0, 0.86, u_detail);
  float flameAlpha = flame * u_intensity * preserve;
  float glowAlpha = aura * u_intensity * u_heat * mix(0.095, 0.035, u_detail);
  float sparkAlpha = spark * u_intensity * 0.9;
  float effectAlpha = clamp(flameAlpha + glowAlpha + sparkAlpha, 0.0, 0.88);
  vec3 burning = fireColor(clamp(0.11 + core * 0.85 + flame * 0.12 + spark, 0.0, 1.0));
  vec3 hot = burning * (flameAlpha + glowAlpha) + fireColor(1.0) * sparkAlpha;

  // Screen the light over opaque photographs, retaining local detail. Use
  // proper straight-alpha composition for the empty areas around a logo.
  vec3 screened = 1.0 - (1.0 - source.rgb) * (1.0 - clamp(hot, 0.0, 1.0));
  float outAlpha = source.a + effectAlpha * (1.0 - source.a);
  vec3 rgb = (screened * source.a + hot * (1.0 - source.a)) / max(outAlpha, 0.0001);
  gl_FragColor = vec4(clamp(rgb, 0.0, 1.0), outAlpha);
}`;

const DEFAULTS = Object.freeze({
  intensity: 0.72, heat: 0.55, motion: 0.55, detail: 0.8,
  color: 'ember', region: 'edges', paused: false,
});
const MAX_SIDE = 4096;
const MAX_PIXELS = 8_388_608;
const finite = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const unit = (value, fallback) => Math.max(0, Math.min(1, finite(value, fallback)));

function dimensions(width, height, sideLimit = MAX_SIDE) {
  let w = Math.max(1, Math.round(finite(width, 1)));
  let h = Math.max(1, Math.round(finite(height, 1)));
  const scale = Math.min(1, sideLimit / w, sideLimit / h, Math.sqrt(MAX_PIXELS / (w * h)));
  return [Math.max(1, Math.floor(w * scale)), Math.max(1, Math.floor(h * scale))];
}

/**
 * An image-preserving, manually driven WebGL1 effects renderer.
 *
 * await renderer.setSource(img); renderer.resize(w, h);
 * renderer.setOptions({ intensity: .7 }); renderer.render(seconds);
 *
 * render() consumes a monotonic external clock. Pause preserves animation time;
 * no RAF loop is created. canvas can be exported using toBlob/captureStream.
 * setSource snapshots pixels locally, so callers may release an ImageBitmap.
 * Cross-origin images require CORS permission. A fluid-renderer-error event on
 * the canvas reports asynchronous context-restore errors (detail.error).
 */
export class FireRenderer {
  constructor(canvas) {
    if (!canvas || typeof canvas.getContext !== 'function') {
      throw new TypeError('FireRenderer needs a canvas element.');
    }
    this.canvas = canvas;
    this.options = { ...DEFAULTS };
    this.sourceWidth = 1;
    this.sourceHeight = 1;
    this._source = null;
    this._disposed = false;
    this._lost = false;
    this._lastTime = null;
    this._sceneTime = 0;
    this._sourceRequest = 0;
    this._contextLost = (event) => { event.preventDefault(); this._lost = true; };
    this._contextRestored = () => {
      if (this._disposed) return;
      try {
        this._init();
        if (this._source) this._upload();
        this._lost = false;
        this.render(this._lastTime ?? 0);
      } catch (error) {
        this._lost = true;
        this.canvas.dispatchEvent(new CustomEvent('fluid-renderer-error', { detail: { error } }));
      }
    };
    canvas.addEventListener('webglcontextlost', this._contextLost);
    canvas.addEventListener('webglcontextrestored', this._contextRestored);
    try {
      this._init();
      this.resize(canvas.width || 1, canvas.height || 1);
    } catch (error) {
      this.destroy();
      throw error;
    }
  }

  _init() {
    const gl = this.canvas.getContext('webgl', {
      alpha: true, premultipliedAlpha: false, antialias: false,
      preserveDrawingBuffer: true, depth: false, stencil: false,
    });
    if (!gl) throw new Error('WebGL is unavailable. Fluid needs GPU rendering to preview this effect.');
    this.gl = gl;
    const compile = (type, source) => {
      const shader = gl.createShader(type);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        const message = gl.getShaderInfoLog(shader);
        gl.deleteShader(shader);
        throw new Error(`Fluid shader could not compile: ${message}`);
      }
      return shader;
    };
    const highp = gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, gl.HIGH_FLOAT);
    const fragmentSource = highp?.precision ? FRAGMENT : FRAGMENT.replace('precision highp float;', 'precision mediump float;');
    const vertex = compile(gl.VERTEX_SHADER, VERTEX);
    let fragment;
    try { fragment = compile(gl.FRAGMENT_SHADER, fragmentSource); }
    catch (error) { gl.deleteShader(vertex); throw error; }
    const program = gl.createProgram();
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
    gl.deleteShader(vertex);
    gl.deleteShader(fragment);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      const message = gl.getProgramInfoLog(program);
      gl.deleteProgram(program);
      throw new Error(`Fluid shader could not link: ${message}`);
    }
    this.program = program;
    this.buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
    this.position = gl.getAttribLocation(program, 'a_position');
    this.uniforms = {};
    for (const name of ['source', 'resolution', 'sourceSize', 'time', 'intensity', 'heat', 'motion', 'detail', 'color', 'edges']) {
      this.uniforms[name] = gl.getUniformLocation(program, `u_${name}`);
    }
    this.texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 0]));
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.BLEND);
    this._maxTextureSide = Math.min(MAX_SIDE, gl.getParameter(gl.MAX_TEXTURE_SIZE));
    this._maxRenderSide = Math.min(MAX_SIDE, gl.getParameter(gl.MAX_RENDERBUFFER_SIZE), ...gl.getParameter(gl.MAX_VIEWPORT_DIMS));
  }

  async setSource(image) {
    this._assertAlive();
    const request = ++this._sourceRequest;
    if (!image) throw new TypeError('Choose an image before applying an effect.');
    if (typeof image.decode === 'function') await image.decode();
    this._assertAlive();
    if (request !== this._sourceRequest) return false;
    const originalWidth = image.naturalWidth || image.width;
    const originalHeight = image.naturalHeight || image.height;
    if (!originalWidth || !originalHeight) throw new Error('The image has no readable pixels.');
    const [width, height] = dimensions(originalWidth, originalHeight, this._maxTextureSide);
    const copy = document.createElement('canvas');
    copy.width = width;
    copy.height = height;
    const context = copy.getContext('2d');
    if (!context) throw new Error('Could not prepare the source image.');
    context.drawImage(image, 0, 0, width, height);
    // Surface CORS errors before replacing a previously working source.
    context.getImageData(0, 0, 1, 1);
    const previous = this._source;
    this._source = copy;
    try { if (!this._lost) this._upload(); }
    catch (error) { this._source = previous; throw error; }
    this.sourceWidth = width;
    this.sourceHeight = height;
    return true;
  }

  _upload() {
    const gl = this.gl;
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this._source);
    const error = gl.getError();
    if (error !== gl.NO_ERROR && error !== gl.CONTEXT_LOST_WEBGL) {
      throw new Error(`The GPU could not load this image (WebGL error ${error}). Try a smaller image.`);
    }
  }

  setOptions(options = {}) {
    this._assertAlive();
    for (const key of ['intensity', 'heat', 'motion', 'detail']) {
      if (key in options) this.options[key] = unit(options[key], this.options[key]);
    }
    if (['ember', 'inferno', 'blue'].includes(options.color)) this.options.color = options.color;
    if (['edges', 'all'].includes(options.region)) this.options.region = options.region;
    if ('paused' in options && Boolean(options.paused) !== this.options.paused) {
      this.options.paused = Boolean(options.paused);
      // The caller may stop its RAF while paused. Reset the external-clock
      // baseline so that time spent paused never advances the simulation.
      this._lastTime = null;
    }
    return this;
  }

  resize(width, height) {
    this._assertAlive();
    const [w, h] = dimensions(width, height, this._maxRenderSide);
    if (this.canvas.width !== w) this.canvas.width = w;
    if (this.canvas.height !== h) this.canvas.height = h;
    return { width: w, height: h };
  }

  render(timeSeconds = 0) {
    this._assertAlive();
    const time = Math.max(0, finite(timeSeconds, this._lastTime ?? 0));
    if (this._lastTime === null) this._lastTime = time;
    if (!this.options.paused) this._sceneTime += Math.max(0, time - this._lastTime) * this.options.motion * 1.8;
    this._lastTime = time;
    if (this._lost || this.gl.isContextLost()) return false;
    const gl = this.gl, u = this.uniforms, o = this.options;
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.useProgram(this.program);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
    gl.enableVertexAttribArray(this.position);
    gl.vertexAttribPointer(this.position, 2, gl.FLOAT, false, 0, 0);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.uniform1i(u.source, 0);
    gl.uniform2f(u.resolution, this.canvas.width, this.canvas.height);
    gl.uniform2f(u.sourceSize, this.sourceWidth, this.sourceHeight);
    gl.uniform1f(u.time, this._sceneTime);
    for (const key of ['intensity', 'heat', 'motion', 'detail']) gl.uniform1f(u[key], o[key]);
    gl.uniform1f(u.color, { ember: 0, inferno: 1, blue: 2 }[o.color]);
    gl.uniform1f(u.edges, o.region === 'edges' ? 1 : 0);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    return true;
  }

  _assertAlive() {
    if (this._disposed) throw new Error('This Fluid renderer has been destroyed.');
  }

  destroy() {
    if (this._disposed) return;
    this._disposed = true;
    this._sourceRequest++;
    this.canvas.removeEventListener('webglcontextlost', this._contextLost);
    this.canvas.removeEventListener('webglcontextrestored', this._contextRestored);
    const gl = this.gl;
    if (gl && !gl.isContextLost()) {
      if (this.texture) gl.deleteTexture(this.texture);
      if (this.buffer) gl.deleteBuffer(this.buffer);
      if (this.program) gl.deleteProgram(this.program);
    }
    this._source = null;
  }
}
