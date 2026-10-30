/**
 * Original Fluid component. Import components.css once.
 * duration is milliseconds. Change replayKey to replay the entrance.
 */
export default function SplitReveal({ children = 'Make room for wonder.', duration = 700, replayKey = 0 }) {
  const text = typeof children === 'string' ? children : String(children ?? '');
  const milliseconds = Number.isFinite(duration) ? Math.min(3000, Math.max(100, duration)) : 700;
  let word = 0;
  return (
    <span className="fb-component fb-split" style={{ '--fb-reveal-duration': milliseconds + 'ms' }}>
      <span className="fb-sr-only">{text}</span>
      <span className="fb-split-visual" key={replayKey} aria-hidden="true">
        {text.split(/(\s+)/).map((part, index) => /\s/.test(part) || !part ? part : (
          <span className="fb-split-word" key={index}>
            <span className="fb-split-letter" style={{ '--fb-order': word++ }}>{part}</span>
          </span>
        ))}
      </span>
    </span>
  );
}
