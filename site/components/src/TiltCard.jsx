import { useEffect, useRef } from 'react';

/**
 * Original Fluid component. Import components.css once.
 * maxTilt is degrees. Touch, keyboard and reduced-motion keep the card still.
 */
export default function TiltCard({
  title = 'Look a little closer.',
  children = 'Good things happen when you change your angle.', maxTilt = 12, color = '#c3b5ff'
}) {
  const frame = useRef(null);
  const motionAllowed = useRef(false);
  function reset() {
    const element = frame.current;
    if (!element) return;
    element.style.setProperty('--fb-tilt-x', '0deg');
    element.style.setProperty('--fb-tilt-y', '0deg');
    element.dataset.active = 'false';
  }
  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce), (hover: none)');
    function update() { motionAllowed.current = !preference.matches; reset(); }
    update();
    preference.addEventListener('change', update);
    window.addEventListener('blur', reset);
    return () => {
      preference.removeEventListener('change', update);
      window.removeEventListener('blur', reset);
      motionAllowed.current = false;
    };
  }, []);
  useEffect(reset, [maxTilt]);
  function move(event) {
    if (!motionAllowed.current || event.pointerType === 'touch') return;
    const element = frame.current;
    const bounds = element.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;
    const degrees = Number.isFinite(maxTilt) ? Math.min(25, Math.max(0, maxTilt)) : 12;
    const x = Math.max(-1, Math.min(1, (event.clientX - bounds.left) / bounds.width * 2 - 1));
    const y = Math.max(-1, Math.min(1, (event.clientY - bounds.top) / bounds.height * 2 - 1));
    element.style.setProperty('--fb-tilt-x', -y * degrees + 'deg');
    element.style.setProperty('--fb-tilt-y', x * degrees + 'deg');
    element.dataset.active = 'true';
  }
  return (
    <div className="fb-component fb-tilt" ref={frame} style={{ '--fb-color': color }}
      onPointerMove={move} onPointerLeave={reset} onPointerCancel={reset} onBlur={reset}>
      <article className="fb-tilt-card">
        <span className="fb-card-eyebrow">A CHANGE OF PERSPECTIVE</span>
        <div className="fb-tilt-art" aria-hidden="true">
          <span className="fb-tilt-orbit" /><span className="fb-tilt-disc" />
          <span className="fb-tilt-satellite" /><span className="fb-tilt-caption">FLUID / FORM NO. 06</span>
        </div>
        <h3 className="fb-card-title">{title}</h3>
        <div className="fb-card-body">{children}</div>
      </article>
    </div>
  );
}
