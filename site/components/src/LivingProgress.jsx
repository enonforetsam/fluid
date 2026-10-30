import { useId } from 'react';
import { clamp, useMotion } from './shared/interaction-utils.jsx';
/** Determinate progress: the fill always represents the supplied real progress. */
export default function LivingProgress({ title = 'A little further.', color = '#a8d9cb', progress = 64, paused = false, label = 'Project progress', onProgressChange }) {
  const id = useId(), value = clamp(progress, 0, 100), motion = useMotion(paused);
  return <section className="fi-component fi-progress" style={{ '--fi-color': color, '--fi-progress': value + '%' }} data-motion={motion} data-complete={value === 100}>
    <span className="fi-eyebrow">{label}</span><h3 className="fi-title">{title}</h3><div className="fi-progress-vessel" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow={value} aria-label={label}><div className="fi-progress-liquid"><span/><span/></div><strong>{Math.round(value)}<small>%</small></strong></div>
    <p className="fi-note" aria-live="polite">{value >= 100 ? 'Complete.' : value <= 0 ? 'Ready to begin.' : Math.round(value) + '% complete.'}</p>
    {onProgressChange ? <label htmlFor={id} className="fi-field">Update actual progress<input id={id} type="range" min="0" max="100" value={value} onChange={(event) => onProgressChange(Number(event.target.value))}/></label> : null}
  </section>;
}
