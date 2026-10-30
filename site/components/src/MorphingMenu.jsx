import { useEffect, useId, useRef, useState } from 'react';
import { sampleImage, useMotion } from './shared/interaction-utils.jsx';
/** Original Fluid visual navigation. Import interactions.css. Links are ordinary anchors. */
export default function MorphingMenu({ title = 'A different point of view.', color = '#ff956f', paused = false, items, replayKey = 0 }) {
  const id = useId(), trigger = useRef(null), panel = useRef(null);
  const [open, setOpen] = useState(false), [selected, setSelected] = useState('');
  const motion = useMotion(paused);
  const links = items?.length ? items : [{ label: 'Objects', href: '#' + id + '-objects' }, { label: 'Places', href: '#' + id + '-places' }, { label: 'People', href: '#' + id + '-people' }];
  useEffect(() => setOpen(false), [replayKey]);
  useEffect(() => { if (open) panel.current?.querySelector('a')?.focus(); }, [open]);
  function close() { setOpen(false); trigger.current?.focus(); }
  function keyboard(event) {
    if (event.key === 'Escape') { event.preventDefault(); close(); }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault(); const nodes = [...panel.current.querySelectorAll('a')];
      const index = nodes.indexOf(document.activeElement); nodes[(index + (event.key === 'ArrowDown' ? 1 : -1) + nodes.length) % nodes.length]?.focus();
    }
  }
  return <section className="fi-component fi-menu" style={{ '--fi-color': color }} data-motion={motion}>
    <div className="fi-toolbar"><span className="fi-eyebrow">FLUID / INDEX</span><button ref={trigger} type="button" className="fi-button" aria-expanded={open} aria-controls={id + '-panel'} onClick={() => setOpen(!open)}> {open ? 'Close' : 'Explore'} <span aria-hidden="true">{open ? '−' : '+'}</span></button></div>
    <h3 className="fi-title">{title}</h3>
    <nav id={id + '-panel'} ref={panel} className="fi-menu-panel" aria-label="Visual collection" hidden={!open} onKeyDown={keyboard} onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget) && event.relatedTarget !== trigger.current) setOpen(false); }}>
      {links.map((item, index) => <a key={item.href + index} href={item.href} onClick={() => { setOpen(false); setSelected(item.label); }}><img src={sampleImage(index)} alt=""/><span><small>0{index + 1}</small>{item.label}<b aria-hidden="true">↗</b></span></a>)}
    </nav>
    {!items?.length ? <div className="fi-menu-destinations" aria-live="polite">{links.map((item, index) => <section key={item.href} id={id + '-' + ['objects','places','people'][index]} hidden={selected !== item.label}><p className="fi-eyebrow">COLLECTION 0{index + 1}</p><h4>{item.label}</h4><p>A space for the {item.label.toLowerCase()} that move you.</p><a className="fi-text-link" href={'#' + id + '-panel'} onClick={(event) => { event.preventDefault(); setOpen(true); }}>Back to collections ↑</a></section>)}</div> : null}
  </section>;
}
