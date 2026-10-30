import { useEffect, useRef } from 'react';

/**
 * Original Fluid component. Import components.css once.
 * strength is maximum displacement in px. Native button props are forwarded.
 */
export default function MagneticButton({
  children = 'Find your orbit', strength = 24, color = '#ff916a',
  type = 'button', disabled = false, className = '', style, ...buttonProps
}) {
  const frame = useRef(null);
  const motionAllowed = useRef(false);
  function reset() {
    const element = frame.current;
    if (!element) return;
    element.style.setProperty('--fb-magnet-x', '0px');
    element.style.setProperty('--fb-magnet-y', '0px');
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
  useEffect(reset, [disabled, strength]);
  function move(event) {
    if (!motionAllowed.current || disabled || event.pointerType === 'touch') return;
    const element = frame.current;
    const bounds = element.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;
    const distance = Number.isFinite(strength) ? Math.min(60, Math.max(0, strength)) : 24;
    const x = Math.max(-1, Math.min(1, (event.clientX - bounds.left) / bounds.width * 2 - 1));
    const y = Math.max(-1, Math.min(1, (event.clientY - bounds.top) / bounds.height * 2 - 1));
    element.style.setProperty('--fb-magnet-x', x * distance + 'px');
    element.style.setProperty('--fb-magnet-y', y * distance + 'px');
    element.dataset.active = 'true';
  }
  return (
    <span className="fb-component fb-magnetic" ref={frame} onPointerMove={move}
      onPointerLeave={reset} onPointerCancel={reset} onBlur={reset}>
      <button {...buttonProps} className={'fb-magnetic-button ' + className}
        style={{ ...style, '--fb-color': color }} type={type} disabled={disabled}>
        <span>{children}</span><span className="fb-magnetic-arrow" aria-hidden="true">↗</span>
      </button>
    </span>
  );
}
