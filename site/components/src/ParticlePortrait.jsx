import { useEffect, useRef, useState } from 'react';
import { canvasPNG, clamp, drawCover, ImagePicker, position, useDownload, useExports, useFrame, useImage, useImageSource, useMotion } from './shared/interaction-utils.jsx';
/** Sample actual image pixels, then scatter and reassemble those coloured particles. */
export default function ParticlePortrait({ title = 'A thousand little possibilities.', color = '#e5c2ff', imageSrc = '', density = 44, scatter = 24, paused = false, replayKey = 0, onExportReady }) {
  const canvas = useRef(null), points = useRef([]), pointer = useRef(null), phase = useRef(0);
  const [source, setSource] = useImageSource(imageSrc), { image, error } = useImage(source);
  const [separated, setSeparated] = useState(false), [pointCount, setPointCount] = useState(0), [download, downloadError] = useDownload();
  const motion = useMotion(paused), amount = clamp(scatter, 0, 100), columns = Math.round(clamp(density, 18, 65));
  function draw(time = phase.current) {
    const el = canvas.current; if (!el) return; const ctx = el.getContext('2d');
    ctx.fillStyle = '#111417'; ctx.fillRect(0, 0, 900, 600);
    for (const p of points.current) {
      const dx = p.x - (pointer.current?.x ?? -1000), dy = p.y - (pointer.current?.y ?? -1000), distance = Math.hypot(dx, dy);
      const force = pointer.current && distance < 150 ? (1 - distance / 150) * 80 : 0;
      const ambient = separated ? amount * 2.2 : amount * .08;
      const x = p.x + Math.cos(p.angle + time * .35) * ambient + dx / Math.max(1, distance) * force;
      const y = p.y + Math.sin(p.angle * 1.7 + time * .35) * ambient + dy / Math.max(1, distance) * force;
      ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(x, y, p.radius * (separated ? .75 : 1), 0, Math.PI * 2); ctx.fill();
    }
    phase.current = time;
  }
  useEffect(() => {
    if (!image) { points.current = []; draw(); return; }
    const sample = document.createElement('canvas'); sample.width = 900; sample.height = 600;
    const ctx = sample.getContext('2d', { willReadFrequently: true }); drawCover(ctx, image, 900, 600);
    const data = ctx.getImageData(0, 0, 900, 600).data, step = 900 / columns, next = [];
    for (let y = step / 2; y < 600; y += step) for (let x = step / 2; x < 900; x += step) {
      const i = (Math.floor(y) * 900 + Math.floor(x)) * 4;
      if (data[i + 3] < 20) continue;
      next.push({ x, y, color: 'rgba(' + data[i] + ',' + data[i+1] + ',' + data[i+2] + ',' + data[i+3]/255 + ')', radius: step * .45, angle: x * .017 + y * .031 });
    }
    points.current = next; setPointCount(next.length); draw();
  }, [image, columns]);
  useEffect(() => { draw(); }, [amount, separated, motion]);
  useEffect(() => { setSeparated(false); pointer.current = null; phase.current = 0; draw(0); }, [replayKey]);
  useFrame(draw, motion && Boolean(image), replayKey);
  const png = () => canvasPNG(canvas.current, 'fluid-particle-portrait.png');
  useExports(onExportReady, { png });
  return <section className="fi-component fi-particles" style={{ '--fi-color': color }} data-motion={motion}><h3 className="fi-title">{title}</h3><canvas ref={canvas} width="900" height="600" className="fi-canvas" role="img" aria-label="An image formed from coloured particles; use Scatter and Reform to change it" onPointerMove={(event) => { pointer.current = position(event, event.currentTarget); if (!motion) draw(); }} onPointerLeave={() => { pointer.current = null; if (!motion) draw(); }} onPointerCancel={() => { pointer.current = null; draw(); }}/><div className="fi-toolbar"><button type="button" className="fi-button fi-primary" aria-pressed={separated} onClick={() => setSeparated(!separated)}>{separated ? 'Reform image' : 'Scatter particles'}</button><ImagePicker onChange={setSource}/><button className="fi-button" type="button" disabled={!image} onClick={() => download(png)}>Save PNG ↓</button></div><p className="fi-note">{image ? pointCount + ' particles sampled from your image. Move across them or use Scatter.' : 'Preparing image…'} Uploads stay in your browser.</p>{error || downloadError ? <p className="fi-note" role="alert">{error || downloadError}</p> : null}</section>;
}
