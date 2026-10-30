import { useCallback, useEffect, useRef, useState } from 'react';

export const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, Number.isFinite(Number(value)) ? Number(value) : min));
export function sampleImage(index = 0) {
  const palettes = [['#ff956f','#53287f','#fae4b5'],['#a5c3f2','#174b57','#f5d585'],['#c0dc95','#643a60','#f1b6ae']];
  const c = palettes[Math.abs(Math.floor(index)) % palettes.length];
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="900" height="600" viewBox="0 0 900 600"><rect width="900" height="600" fill="${c[1]}"/><circle cx="680" cy="130" r="280" fill="${c[0]}"/><path d="M-120 540Q180 20 470 360T1030 290V720H-120Z" fill="${c[2]}"/><path d="M-50 390Q210 100 410 390T950 100" fill="none" stroke="${c[0]}" stroke-width="70"/><circle cx="220" cy="180" r="70" fill="${c[2]}"/></svg>`);
}
export function safeImage(source, fallback = sampleImage()) {
  return typeof source === 'string' && /^data:image\/(png|jpeg|webp|svg\+xml)[;,]/i.test(source) && source.length < 40000000 ? source : fallback;
}
export function useMotion(paused = false) {
  const [active, setActive] = useState(false);
  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setActive(!paused && !query.matches && !document.hidden);
    update(); query.addEventListener('change', update); document.addEventListener('visibilitychange', update);
    return () => { query.removeEventListener('change', update); document.removeEventListener('visibilitychange', update); };
  }, [paused]);
  return active;
}
// A single bounded 30fps loop per active canvas. Each frame reads fresh callbacks.
export function useFrame(draw, active, resetKey = 0) {
  const callback = useRef(draw), elapsed = useRef(0); callback.current = draw;
  useEffect(() => { elapsed.current = 0; }, [resetKey]);
  useEffect(() => {
    if (!active) return;
    let frame = 0, previous = -Infinity;
    const tick = (time) => { if (time - previous >= 1000 / 30) { previous = time; elapsed.current += 1 / 30; callback.current(elapsed.current); } frame = requestAnimationFrame(tick); };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [active]);
}
export function useExports(onExportReady, api) {
  const latest = useRef(api); latest.current = api;
  const keys = Object.keys(api).join(',');
  useEffect(() => {
    if (!onExportReady) return;
    const stable = {};
    keys.split(',').filter(Boolean).forEach((key) => { stable[key] = (...args) => latest.current[key](...args); });
    onExportReady(stable);
    return () => onExportReady(null);
  }, [onExportReady, keys]);
}
export function canvasPNG(canvas, filename) {
  return new Promise((resolve, reject) => {
    if (!canvas) { reject(new Error('The image is still preparing.')); return; }
    try { canvas.toBlob((blob) => blob ? resolve({ filename, mime: 'image/png', data: blob }) : reject(new Error('Could not create PNG.')), 'image/png'); }
    catch (error) { reject(error); }
  });
}
export function useImage(source) {
  const [result, setResult] = useState({ image: null, error: '' });
  useEffect(() => {
    let cancelled = false;
    const image = new Image();
    image.onload = () => {
      if (cancelled) return;
      if (image.naturalWidth * image.naturalHeight > 40000000) { setResult({ image: null, error: 'Choose an image smaller than 40 megapixels.' }); return; }
      setResult({ image, error: '' });
    };
    image.onerror = () => { if (!cancelled) setResult({ image: null, error: 'That image could not be decoded. Choose a PNG, JPG or WebP image.' }); };
    setResult({ image: null, error: '' }); image.src = safeImage(source);
    return () => { cancelled = true; image.onload = null; image.onerror = null; };
  }, [source]);
  return result;
}
export function drawCover(ctx, image, width, height) {
  const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight);
  const w = image.naturalWidth * scale, h = image.naturalHeight * scale;
  ctx.drawImage(image, (width - w) / 2, (height - h) / 2, w, h);
}
export function ImagePicker({ onChange }) {
  const [error, setError] = useState('');
  const pending = useRef(0), mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; pending.current++; }; }, []);
  async function select(event) {
    const file = event.target.files?.[0]; event.target.value = '';
    if (!file) return;
    if (!['image/png','image/jpeg','image/webp'].includes(file.type) || file.size > 10000000) { setError('Choose PNG, JPG or WebP up to 10 MB.'); return; }
    const token = ++pending.current;
    try {
      const data = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(file); });
      const image = new Image(); image.src = data; await image.decode();
      if (image.naturalWidth * image.naturalHeight > 40000000) throw new Error('Choose an image smaller than 40 megapixels.');
      if (mounted.current && token === pending.current) { setError(''); onChange(data); }
    } catch (e) { if (mounted.current && token === pending.current) setError(e.message || 'This image could not be read.'); }
  }
  return <div className="fi-upload"><label className="fi-button">Choose image<input type="file" accept="image/png,image/jpeg,image/webp" onChange={select} /></label>{error ? <p role="alert" className="fi-note">{error}</p> : null}</div>;
}
export function useImageSource(imageSrc) {
  const [local, setLocal] = useState('');
  useEffect(() => setLocal(''), [imageSrc]);
  return [safeImage(local || imageSrc), setLocal];
}
export function useDownload() {
  const [error, setError] = useState('');
  const alive = useRef(true), urls = useRef(new Map());
  useEffect(() => { alive.current = true; return () => { alive.current = false; for (const [url,timer] of urls.current) { clearTimeout(timer); URL.revokeObjectURL(url); } urls.current.clear(); }; }, []);
  const download = useCallback(async (getFile) => {
    try {
      const file = await getFile();
      if (!alive.current) return;
      const blob = file.data instanceof Blob ? file.data : new Blob([file.data], { type: file.mime });
      const url = URL.createObjectURL(blob), link = document.createElement('a');
      link.href = url; link.download = file.filename; document.body.append(link); link.click(); link.remove();
      urls.current.set(url, setTimeout(() => { URL.revokeObjectURL(url); urls.current.delete(url); }, 1000)); setError('');
    } catch (e) { if (alive.current) setError(e.message || 'The export failed. Please try again.'); }
  }, []);
  return [download, error];
}
export function position(event, element, width = 900, height = 600) {
  const r = element.getBoundingClientRect();
  return { x: clamp((event.clientX - r.left) / r.width) * width, y: clamp((event.clientY - r.top) / r.height) * height };
}
