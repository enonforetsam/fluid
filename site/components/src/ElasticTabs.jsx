import { useId, useRef, useState } from 'react';
import { sampleImage, useMotion } from './shared/interaction-utils.jsx';
/** Keyboard-complete tabs with a shared moving indicator. */
export default function ElasticTabs({ title = 'Find your frequency.', color = '#d0c2ff', paused = false, tabs }) {
  const id = useId(), refs = useRef([]), [active, setActive] = useState(0), motion = useMotion(paused);
  const values = tabs?.length ? tabs : [{ label: 'Form', title: 'Start with a shape.', text: 'Find the rhythm in a simple silhouette.' },{ label: 'Colour', title: 'Turn up the feeling.', text: 'A palette can change the whole atmosphere.' },{ label: 'Motion', title: 'Give the idea room.', text: 'A little movement makes a memorable moment.' }];
  const index = Math.min(active, values.length - 1);
  function keyboard(event, current) {
    const next = event.key === 'ArrowRight' ? (current + 1) % values.length : event.key === 'ArrowLeft' ? (current - 1 + values.length) % values.length : event.key === 'Home' ? 0 : event.key === 'End' ? values.length - 1 : null;
    if (next !== null) { event.preventDefault(); setActive(next); refs.current[next]?.focus(); }
  }
  return <section className="fi-component fi-tabs" style={{ '--fi-color': color }} data-motion={motion}>
    <h3 className="fi-title">{title}</h3>
    <div className="fi-tab-list" role="tablist" aria-label={title} style={{ '--fi-count': values.length, '--fi-active': index }}><span className="fi-tab-indicator" aria-hidden="true"/>{values.map((item, i) => <button type="button" key={i} role="tab" id={id + '-tab-' + i} aria-selected={index === i} aria-controls={id + '-panel-' + i} tabIndex={index === i ? 0 : -1} ref={(node) => { refs.current[i] = node; }} onClick={() => setActive(i)} onKeyDown={(event) => keyboard(event, i)}>{item.label}</button>)}</div>
    {values.map((item, i) => <div className="fi-tab-panel" role="tabpanel" id={id + '-panel-' + i} key={i} aria-labelledby={id + '-tab-' + i} tabIndex="0" hidden={index !== i}><img src={sampleImage(i)} alt=""/><div><h4>{item.title}</h4><p>{item.text}</p>{item.children}</div></div>)}
  </section>;
}
