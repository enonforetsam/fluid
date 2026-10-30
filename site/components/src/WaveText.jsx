/**
 * Original Fluid component. Import components.css once.
 * duration is seconds. paused freezes the current wave position.
 */
const graphemes = typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function'
  ? new Intl.Segmenter(undefined, { granularity: 'grapheme' }) : null;

function letters(text) {
  return graphemes ? Array.from(graphemes.segment(text), part => part.segment) : Array.from(text);
}

export default function WaveText({ children = 'STAY CURIOUS.', duration = 2.4, paused = false }) {
  const text = typeof children === 'string' ? children : String(children ?? '');
  const seconds = Number.isFinite(duration) ? Math.min(20, Math.max(0.6, duration)) : 2.4;
  let character = 0;
  return (
    <span className="fb-component fb-wave" data-paused={paused} style={{ '--fb-wave-duration': seconds + 's' }}>
      <span className="fb-sr-only">{text}</span>
      <span className="fb-wave-visual" aria-hidden="true">
        {text.split(/(\s+)/).map((part, word) => /\s/.test(part) || !part ? part : (
          <span className="fb-wave-word" key={word}>
            {letters(part).map((letter, index) => (
              <span className="fb-wave-letter" key={index} style={{ '--fb-order': character++ }}>{letter}</span>
            ))}
          </span>
        ))}
      </span>
    </span>
  );
}
