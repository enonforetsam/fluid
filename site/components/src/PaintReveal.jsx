import { useEffect, useRef, useState } from 'react';
import { canvasPNG, clamp, drawCover, ImagePicker, position, useDownload, useExports, useImage, useImageSource } from './shared/interaction-utils.jsx';
/** Local-image brush mask. Pointer capture preserves touch strokes; buttons provide a keyboard path. */
export default function PaintReveal({ title = 'Make a mark.', color = '#7cc3b1', imageSrc = '', brush = 60, replayKey = 0, onExportReady }) {
  const canvas = useRef(null), mask = useRef(null), layer = useRef(null), last = useRef(null), strokeCount = useRef(0);
  const [source, setSource] = useImageSource(imageSrc), { image, error } = useImage(source), [marks, setMarks] = useState(0), [download, downloadError] = useDownload();
  const size = clamp(brush, 12, 180);
  function render() {
    if (!canvas.current) return;
    const ctx = canvas.current.getContext('2d'); ctx.fillStyle = '#172a2c'; ctx.fillRect(0, 0, 900, 600);
    if (image && mask.current && layer.current) {
      const out = layer.current.getContext('2d'); out.clearRect(0, 0, 900, 600); out.globalCompositeOperation = 'source-over'; drawCover(out, image, 900, 600);
      out.globalCompositeOperation = 'destination-in'; out.drawImage(mask.current, 0, 0); out.globalCompositeOperation = 'source-over'; ctx.drawImage(layer.current, 0, 0);
    }
    if (!strokeCount.current) { ctx.fillStyle = '#b7d6cd'; ctx.textAlign = 'center'; ctx.font = '500 30px sans-serif'; ctx.fillText('Paint to reveal', 450, 300); }
  }
  function reset() { mask.current?.getContext('2d').clearRect(0, 0, 900, 600); strokeCount.current = 0; last.current = null; setMarks(0); render(); }
  useEffect(() => {
    mask.current = document.createElement('canvas'); layer.current = document.createElement('canvas');
    mask.current.width = layer.current.width = 900; mask.current.height = layer.current.height = 600;
    render(); return () => { mask.current = null; layer.current = null; };
  }, []);
  useEffect(reset, [image, replayKey]);
  function stroke(point, previous = point) {
    if (!mask.current || !image) return;
    const ctx = mask.current.getContext('2d'); ctx.strokeStyle = '#fff'; ctx.fillStyle = '#fff'; ctx.lineWidth = size; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(previous.x, previous.y); ctx.lineTo(point.x, point.y); ctx.stroke(); ctx.beginPath(); ctx.arc(point.x, point.y, size / 2, 0, Math.PI * 2); ctx.fill();
    strokeCount.current++; render();
  }
  function move(event) { if (!event.currentTarget.hasPointerCapture(event.pointerId)) return; const point = position(event, event.currentTarget); stroke(point, last.current || point); last.current = point; }
  function end(event) { if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); last.current = null; setMarks(strokeCount.current); }
  function stamp() { const index = strokeCount.current; stroke({ x: 140 + (index * 137) % 620, y: 120 + (index * 83) % 360 }); setMarks(strokeCount.current); }
  function all() { if (!mask.current) return; const ctx = mask.current.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, 900, 600); strokeCount.current++; setMarks(strokeCount.current); render(); }
  const png = () => canvasPNG(canvas.current, 'fluid-paint-reveal.png'); useExports(onExportReady, { png });
  return <section className="fi-component fi-paint" style={{ '--fi-color': color }}><h3 className="fi-title">{title}</h3><canvas ref={canvas} width="900" height="600" className="fi-canvas fi-paint-canvas" role="img" aria-label="Paintable image reveal. Use Add a brush mark or Reveal all for keyboard access." onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); move(event); }} onPointerMove={move} onPointerUp={end} onPointerCancel={end}/><div className="fi-toolbar"><button className="fi-button fi-primary" type="button" onClick={stamp} disabled={!image}>Add a brush mark +</button><button className="fi-button" type="button" onClick={all} disabled={!image}>Reveal all</button><button className="fi-button" type="button" onClick={reset}>Reset</button><ImagePicker onChange={setSource}/><button className="fi-button" type="button" onClick={() => download(png)} disabled={!image}>Save PNG ↓</button></div><p className="fi-note" aria-live="polite">{image ? marks + ' brush marks. Drag across the image or add marks with the button.' : 'Preparing image…'} Uploads stay in your browser.</p>{error || downloadError ? <p className="fi-note" role="alert">{error || downloadError}</p> : null}</section>;
}
