import { useEffect, useRef } from 'react';

/**
 * Original Fluid component. Import components.css once.
 * The light is decorative. Children keep their native keyboard behavior.
 */
export default function SpotlightCard({
  title = 'A little light. A new perspective.',
  children = 'Follow a feeling and see where it takes you.', color = '#ff916a'
}) {
  const card = useRef(null);
  const motionAllowed = useRef(false);
  function reset() {
    const element = card.current;
    if (!element) return;
    element.style.setProperty('--fb-light-x', '0px');
    element.style.setProperty('--fb-light-y', '0px');
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
  function move(event) {
    if (!motionAllowed.current || event.pointerType === 'touch') return;
    const element = card.current;
    const bounds = element.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;
    element.style.setProperty('--fb-light-x', event.clientX - bounds.left - bounds.width / 2 + 'px');
    element.style.setProperty('--fb-light-y', event.clientY - bounds.top - bounds.height * .35 + 'px');
    element.dataset.active = 'true';
  }
  return (
    <article className="fb-component fb-spotlight" ref={card} style={{ '--fb-color': color }}
      onPointerMove={move} onPointerLeave={reset} onPointerCancel={reset} onBlur={reset}>
      <span className="fb-spotlight-light" aria-hidden="true" />
      <div className="fb-spotlight-content">
        <span className="fb-card-eyebrow">A STUDY IN LIGHT</span>
        <div className="fb-spotlight-art" aria-hidden="true">
          <span /><span /><span /><i className="fb-spotlight-star">✳</i>
        </div>
        <h3 className="fb-card-title">{title}</h3>
        <div className="fb-card-body">{children}</div>
      </div>
    </article>
  );
}
