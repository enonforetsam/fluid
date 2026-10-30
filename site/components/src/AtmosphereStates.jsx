import { useState } from 'react';
import { useMotion } from './shared/interaction-utils.jsx';
/** Explicit UI states. onAction receives create/retry/done; no pretend network request. */
export default function AtmosphereStates({ title = 'Space for what is next.', color = '#b8c7fc', state = 'empty', paused = false, onAction }) {
  const [override, setOverride] = useState(null), motion = useMotion(paused), current = override || state;
  const [previous, setPrevious] = useState(state);
  if (previous !== state) { setPrevious(state); setOverride(null); }
  const copy = { empty: ['◇','Your next idea starts here.','Add a first piece to your collection.','Create a piece','create'], loading: ['◌','Making room for the good stuff.','This is an indeterminate loading state.','Cancel','cancel'], success: ['✓','Everything is in place.','Your piece is ready for its next chapter.','Make another','create'], error: ['!','Something needs another try.','The piece could not be loaded. Your existing work is safe.','Try again','retry'] };
  const entry = copy[current] || copy.empty;
  const next = current === 'empty' || current === 'error' ? 'loading' : 'empty';
  return <section className="fi-component fi-states" style={{ '--fi-color': color }} data-motion={motion}><h3 className="fi-title">{title}</h3><div className="fi-state-choices" role="group" aria-label="Preview interface state">{Object.keys(copy).map((item) => <button className="fi-button" type="button" key={item} aria-pressed={current === item} onClick={() => setOverride(item)}>{item}</button>)}</div>
    <div className="fi-state-scene" data-state={current} role={current === 'error' ? 'alert' : 'status'} aria-live="polite" aria-busy={current === 'loading'}><span className="fi-state-orbit" aria-hidden="true"/><span className="fi-state-symbol" aria-hidden="true">{entry[0]}</span><h4>{entry[1]}</h4><p>{entry[2]}</p><button type="button" className="fi-button fi-primary" onClick={() => { if (onAction) onAction(entry[4]); else setOverride(next); }}>{onAction ? entry[3] : 'Preview ' + next}</button></div>
    <p className="fi-note">Choose a state to preview it. Connect onAction to your application.</p>
  </section>;
}
