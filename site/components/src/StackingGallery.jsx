import { useId, useRef, useState } from 'react';
import { sampleImage, safeImage, useMotion } from './shared/interaction-utils.jsx';
/** A real scroll container with sticky overlapping project cards. */
export default function StackingGallery({ title = 'Collected moments.', color = '#b9cba8', imageSrc = '', paused = false, items }) {
  const id = useId(), scroll = useRef(null), [progress, setProgress] = useState(0);
  const motion = useMotion(paused);
  const cards = items?.length ? items : [{ title: 'Soft architecture', body: 'A study in shape and light.' },{ title: 'The space between', body: 'Familiar forms, unfamiliar angles.' },{ title: 'Somewhere new', body: 'Follow the colour a little further.' }];
  function update() { const el = scroll.current; const total = el.scrollHeight - el.clientHeight; setProgress(total > 0 ? el.scrollTop / total : 0); }
  return <section className="fi-component fi-stack" style={{ '--fi-color': color }} data-motion={motion}>
    <div className="fi-toolbar"><h3 className="fi-title">{title}</h3><span className="fi-eyebrow">{Math.round(progress * 100)}%</span></div>
    <p className="fi-note" id={id}>Scroll inside the gallery. Focus it and use the arrow keys to browse.</p>
    <div className="fi-stack-scroll" ref={scroll} onScroll={update} tabIndex="0" role="region" aria-label="Stacking project gallery" aria-describedby={id}>
      {cards.map((item, index) => <article className="fi-stack-card" key={index} style={{ top: 16 + index * 12, '--fi-order': index }}><img src={safeImage(index === 0 && imageSrc ? imageSrc : item.imageSrc, sampleImage(index))} alt={item.alt || 'Abstract flowing forms in a three-colour composition'} /><div><span className="fi-eyebrow">STUDY / 0{index + 1}</span><h4>{item.title}</h4><p>{item.body}</p></div></article>)}
      <div className="fi-stack-end"><p>End of collection.</p><button className="fi-button" type="button" onClick={() => { scroll.current.scrollTop = 0; }}>Back to first ↑</button></div>
    </div>
  </section>;
}
