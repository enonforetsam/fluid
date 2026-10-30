/**
 * Original Fluid component. Import components.css once.
 * duration is seconds per loop. The visual duplicate is hidden from assistive tech.
 */
export default function LoopMarquee({
  items = ['MAKE SOMETHING', 'STAY CURIOUS', 'KEEP MOVING'], duration = 22, reverse = false, paused = false
}) {
  const words = Array.isArray(items) ? items.filter(item => typeof item === 'string' && item.trim()) : [];
  const seconds = Number.isFinite(duration) ? Math.min(120, Math.max(4, duration)) : 22;
  function group(duplicate) {
    return (
      <ul className="fb-marquee-group" aria-hidden={duplicate ? 'true' : undefined}>
        {words.map((word, index) => (
          <li className="fb-marquee-item" key={index}>
            <span>{word}</span><span className="fb-marquee-flower" aria-hidden="true">✳</span>
          </li>
        ))}
      </ul>
    );
  }
  return (
    <div className="fb-component fb-marquee" data-paused={paused} data-reverse={reverse}
      style={{ '--fb-marquee-duration': seconds + 's' }}>
      <div className="fb-marquee-track">{group(false)}{group(true)}</div>
    </div>
  );
}
