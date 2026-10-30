import { useEffect, useRef, useState } from 'react';
import { position, sampleImage, safeImage, useMotion } from './shared/interaction-utils.jsx';
/** Bounded original image trail. Pointer, tap and keyboard all leave a mark. */
export default function ImageTrail({ title = 'Leave a little colour.', color = '#e4b3d1', imageSrc = '', paused = false, replayKey = 0 }) {
  const area = useRef(null), last = useRef({ x: -1000, y: -1000, time: 0 }), count = useRef(0);
  const [marks, setMarks] = useState([]), motion = useMotion(paused);
  useEffect(() => { setMarks([]); count.current = 0; }, [replayKey]);
  function leave(event, force = false) {
    if (!area.current) return;
    const p = event ? position(event, area.current, 100, 100) : { x: 20 + (count.current * 19 % 65), y: 25 + (count.current * 23 % 50) };
    const now = performance.now();
    if (!force && (now - last.current.time < 80 || Math.hypot(p.x - last.current.x, p.y - last.current.y) < 8)) return;
    last.current = { ...p, time: now }; const index = count.current++;
    setMarks((current) => [...current.slice(-7), { ...p, index }]);
  }
  return <section className="fi-component fi-trail" style={{ '--fi-color': color }} data-motion={motion}>
    <div className="fi-trail-area" ref={area} onPointerMove={(event) => { if (motion && event.pointerType !== 'touch') leave(event); }} onPointerDown={(event) => leave(event, true)}>
      <h3 className="fi-title">{title}</h3><p>Move, tap or add a frame.</p>
      {marks.map((mark) => <img key={mark.index} className="fi-trail-image" src={safeImage(imageSrc, sampleImage(mark.index))} alt="" style={{ left: mark.x + '%', top: mark.y + '%', '--fi-rotate': ((mark.index % 5) - 2) * 8 + 'deg' }} />)}
    </div>
    <div className="fi-toolbar"><button className="fi-button" type="button" onClick={() => leave(null, true)}>Add a frame +</button><button className="fi-button" type="button" onClick={() => setMarks([])}>Clear trail</button><span className="fi-note" aria-live="polite">{marks.length} of 8 frames</span></div>
  </section>;
}
