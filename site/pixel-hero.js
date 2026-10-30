import {PIXEL_META, PIXEL_POINTS} from './pixel-hero-points.js';

const mounted = new WeakMap();
const SHAPES = Object.freeze({fluid: 0, wave: 3, orbit: 5, bloom: 7});
const NAMES = Object.freeze({fluid: 'Fluid', wave: 'Wave', orbit: 'Orbit', bloom: 'Bloom'});
const DESCRIPTIONS = Object.freeze({
  fluid: 'The Fluid wordmark made from tiny peach and cream squares.',
  wave: 'The same squares gathered into a flowing ribbon.',
  orbit: 'The same squares gathered into three intersecting tilted orbits.',
  bloom: 'The same squares gathered into a six-petal bloom.',
});
const smootherstep = t => t * t * t * (t * (t * 6 - 15) + 10);

/**
 * One bounded Canvas2D artwork. Every frame is caused by a form selection.
 * Squares stay entirely still at rest. Hidden/offscreen time is excluded from
 * the transition; reduced motion swaps directly to the chosen endpoint.
 */
export function mountPixelHero(root) {
  if (!root) return () => {};
  mounted.get(root)?.();
  const canvas = root.querySelector('#pixelHeroCanvas');
  const controls = root.querySelector('.pixel-hero-controls');
  const buttons = Array.from(root.querySelectorAll('[data-pixel-shape]'));
  const status = root.querySelector('#pixelHeroStatus');
  let context;
  try { context = canvas?.getContext('2d', {alpha: true}); } catch {}
  let disposed = false;
  let failed = false;
  let frame = 0;
  let selected = 'fluid';
  let morphing = false;
  let elapsed = 0;
  let lastTime = 0;
  let width = 0;
  let height = 0;
  let dpr = 1;
  let inView = false;
  let pageSuspended = false;
  let square = PIXEL_META.squares.fluid;
  let fromSquare = square;
  let toSquare = square;
  const media = window.matchMedia?.('(prefers-reduced-motion: reduce)');
  let reduced = Boolean(media?.matches);
  const count = PIXEL_POINTS.length;
  const current = new Float32Array(count * 2);
  const from = new Float32Array(count * 2);
  const target = new Float32Array(count * 2);
  const groups = PIXEL_META.colors.map((_, tone) =>
    PIXEL_POINTS.reduce((indices, point, index) => {
      if (point[2] === tone) indices.push(index);
      return indices;
    }, []));
  for (let n = 0; n < count; n++) {
    current[n * 2] = PIXEL_POINTS[n][0];
    current[n * 2 + 1] = PIXEL_POINTS[n][1];
  }

  function stop() {
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    lastTime = 0;
  }
  function syncState() {
    root.dataset.shape = selected;
    root.dataset.animating = String(morphing);
    for (const button of buttons) {
      button.setAttribute('aria-pressed', String(button.dataset.pixelShape === selected));
    }
    if (canvas) canvas.setAttribute('aria-label', DESCRIPTIONS[selected]);
  }
  function fallback() {
    failed = true;
    stop();
    morphing = false;
    selected = 'fluid';
    root.dataset.ready = 'false';
    root.dataset.renderer = 'static';
    if (controls) controls.hidden = true;
    for (const button of buttons) button.disabled = true;
    if (status) status.textContent = 'Static Fluid artwork. Interactive forms are unavailable in this browser.';
    syncState();
  }
  if (!canvas || !context || !count) {
    fallback();
    return () => { disposed = true; };
  }

  function canAnimate() {
    return !disposed && !failed && !reduced && !pageSuspended &&
      !document.hidden && inView && width > 0 && height > 0;
  }
  function draw() {
    if (disposed || failed || !width || !height) return;
    try {
      context.setTransform(1, 0, 0, 1, 0, 0);
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.setTransform(dpr * width / PIXEL_META.width, 0, 0,
        dpr * height / PIXEL_META.height, 0, 0);
      context.imageSmoothingEnabled = false;
      const half = square / 2;
      for (let tone = 0; tone < groups.length; tone++) {
        context.fillStyle = PIXEL_META.colors[tone];
        for (const n of groups[tone]) {
          context.fillRect(current[n * 2] - half, current[n * 2 + 1] - half, square, square);
        }
      }
      if (root.dataset.ready !== 'true') root.dataset.ready = 'true';
      if (root.dataset.renderer !== 'canvas') root.dataset.renderer = 'canvas';
      if (controls?.hidden) controls.hidden = false;
    } catch {
      fallback();
    }
  }
  function finish() {
    current.set(target);
    square = toSquare;
    morphing = false;
    elapsed = PIXEL_META.duration;
    stop();
    syncState();
    if (status) status.textContent = `${NAMES[selected]} form. Choose another to keep exploring.`;
    draw();
  }
  function advance(now) {
    if (!morphing) return;
    if (lastTime) elapsed = Math.min(PIXEL_META.duration, elapsed + Math.max(0, now - lastTime));
    lastTime = now;
    const ease = smootherstep(elapsed / PIXEL_META.duration);
    for (let n = 0; n < current.length; n++) current[n] = from[n] + (target[n] - from[n]) * ease;
    square = fromSquare + (toSquare - fromSquare) * ease;
    if (elapsed >= PIXEL_META.duration) finish();
  }
  function tick(now) {
    frame = 0;
    if (!canAnimate() || !morphing) { lastTime = 0; return; }
    advance(now);
    if (!morphing || failed) return;
    draw();
    if (canAnimate() && morphing) frame = requestAnimationFrame(tick);
  }
  function resume() {
    if (canAnimate() && morphing && !frame) {
      lastTime = 0;
      frame = requestAnimationFrame(tick);
    }
  }
  function choose(name) {
    if (disposed || failed || !Object.hasOwn(SHAPES, name) || name === selected) return;
    // Capture the exact current interpolation before replacing its destination.
    // Retargeting never jumps back to the previous endpoint.
    if (morphing && canAnimate()) advance(performance.now());
    stop();
    if (failed) return;
    selected = name;
    const offset = SHAPES[name];
    from.set(current);
    fromSquare = square;
    toSquare = PIXEL_META.squares[name];
    for (let n = 0; n < count; n++) {
      target[n * 2] = PIXEL_POINTS[n][offset];
      target[n * 2 + 1] = PIXEL_POINTS[n][offset + 1];
    }
    elapsed = 0;
    morphing = true;
    syncState();
    if (status) status.textContent = `Becoming ${NAMES[name].toLowerCase()}…`;
    if (reduced) finish();
    else resume();
  }
  function onClick(event) { choose(event.currentTarget.dataset.pixelShape); }
  function boundsVisible(rect) {
    return rect.bottom > 0 && rect.right > 0 && rect.top < window.innerHeight && rect.left < window.innerWidth;
  }
  function measure() {
    if (disposed || failed) return;
    const rect = canvas.getBoundingClientRect();
    const nextWidth = Math.max(0, rect.width);
    const nextHeight = Math.max(0, rect.height);
    const nextDpr = Math.min(1.5, Math.max(1, window.devicePixelRatio || 1));
    inView = boundsVisible(rect);
    if (nextWidth !== width || nextHeight !== height || nextDpr !== dpr) {
      width = nextWidth;
      height = nextHeight;
      dpr = nextDpr;
      if (width && height) {
        canvas.width = Math.max(1, Math.round(width * dpr));
        canvas.height = Math.max(1, Math.round(height * dpr));
        draw();
      }
    }
    if (!canAnimate()) stop();
    else resume();
  }
  function onVisibility() {
    if (document.hidden) stop();
    else { measure(); resume(); }
  }
  function onMotion(event) {
    reduced = event.matches;
    if (reduced && morphing) finish();
    else if (!reduced) resume();
  }
  function onPageHide() { pageSuspended = true; stop(); }
  function onPageShow() { pageSuspended = false; measure(); resume(); }
  function onScrollFallback() {
    inView = boundsVisible(canvas.getBoundingClientRect());
    if (!inView) stop();
    else resume();
  }
  const resizeObserver = typeof ResizeObserver === 'function' ? new ResizeObserver(measure) : null;
  const intersectionObserver = typeof IntersectionObserver === 'function' ? new IntersectionObserver(entries => {
    if (disposed || failed) return;
    inView = entries.some(entry => entry.isIntersecting && entry.intersectionRatio > 0);
    if (!inView) stop();
    else resume();
  }, {threshold: 0}) : null;

  root.dataset.ready = 'false';
  root.dataset.renderer = 'static';
  syncState();
  for (const button of buttons) { button.disabled = false; button.addEventListener('click', onClick); }
  if (status) status.textContent = 'Choose a form. See where it takes you.';
  resizeObserver?.observe(canvas);
  intersectionObserver?.observe(canvas);
  window.addEventListener('resize', measure, {passive: true});
  if (!intersectionObserver) window.addEventListener('scroll', onScrollFallback, {passive: true});
  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('pagehide', onPageHide);
  window.addEventListener('pageshow', onPageShow);
  if (media?.addEventListener) media.addEventListener('change', onMotion);
  else media?.addListener?.(onMotion);
  measure();

  function cleanup() {
    if (disposed) return;
    disposed = true;
    stop();
    resizeObserver?.disconnect();
    intersectionObserver?.disconnect();
    window.removeEventListener('resize', measure);
    window.removeEventListener('scroll', onScrollFallback);
    document.removeEventListener('visibilitychange', onVisibility);
    window.removeEventListener('pagehide', onPageHide);
    window.removeEventListener('pageshow', onPageShow);
    if (media?.removeEventListener) media.removeEventListener('change', onMotion);
    else media?.removeListener?.(onMotion);
    for (const button of buttons) { button.removeEventListener('click', onClick); button.disabled = true; }
    root.dataset.ready = 'false';
    root.dataset.renderer = 'static';
    root.dataset.animating = 'false';
    root.dataset.shape = 'fluid';
    if (controls) controls.hidden = true;
    mounted.delete(root);
  }
  mounted.set(root, cleanup);
  return cleanup;
}
