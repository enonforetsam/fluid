import { useEffect, useId, useState } from 'react';
import { clamp, safeImage, sampleImage } from './shared/interaction-utils.jsx';
/** A native range is the complete pointer, touch and keyboard drag surface. */
export default function BeforeAfterReveal({ title = 'A shift in perspective.', color = '#ffcba6', imageSrc = '', afterSrc = '', initial = 50 }) {
  const id = useId(), [value, setValue] = useState(clamp(initial, 0, 100));
  useEffect(() => setValue(clamp(initial, 0, 100)), [initial]);
  const before = safeImage(imageSrc), after = safeImage(afterSrc, before);
  return <section className="fi-component fi-compare" style={{ '--fi-color': color }}><h3 className="fi-title">{title}</h3>
    <div className="fi-compare-stage"><img src={before} alt="Original abstract artwork"/><img className={afterSrc ? '' : 'fi-compare-treated'} src={after} alt="Artwork after treatment" style={{ clipPath: 'inset(0 ' + (100 - value) + '% 0 0)' }}/><span className="fi-compare-line" style={{ left: value + '%' }} aria-hidden="true"><b>↔</b></span><span className="fi-compare-label">After</span><span className="fi-compare-label fi-right">Before</span><input id={id} className="fi-compare-range" type="range" min="0" max="100" value={value} aria-label="Reveal treated artwork" aria-valuetext={Math.round(value) + '% after'} onChange={(event) => setValue(Number(event.target.value))}/></div>
    <label className="fi-note" htmlFor={id}>Drag the divider or use the arrow keys. {Math.round(value)}% after.</label>
  </section>;
}
