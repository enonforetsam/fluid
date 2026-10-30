import { useEffect, useRef, useState } from 'react';
import { clamp, useMotion } from './shared/interaction-utils.jsx';
/** Scroll progress follows the real content container, with native keyboard scrolling. */
export default function FlowTimeline({ title = 'From spark to something.', color = '#a8d9cb', paused = false, milestones }) {
  const area = useRef(null), [progress, setProgress] = useState(0), motion = useMotion(paused);
  const values = milestones?.length ? milestones : [{ title: 'A small spark', text: 'Start with the question you keep coming back to. Collect the colours, shapes and stories around it.' },{ title: 'Make it tangible', text: 'Put the idea on the page. Let the rough edges tell you where to look next.' },{ title: 'Find the rhythm', text: 'Try another arrangement. Test the details, listen to the response and give the work time to settle.' },{ title: 'Out into the world', text: 'Share what you have made. The best next chapter starts with someone else experiencing it.' }];
  function update() { const el = area.current; if (el) setProgress(clamp(el.scrollTop / Math.max(1, el.scrollHeight - el.clientHeight))); }
  useEffect(() => { update(); const resize = new ResizeObserver(update); if (area.current) resize.observe(area.current); return () => resize.disconnect(); }, [values.length]);
  return <section className="fi-component fi-timeline" style={{ '--fi-color': color }} data-motion={motion}><div className="fi-toolbar"><h3 className="fi-title">{title}</h3><span className="fi-eyebrow">{Math.round(progress * 100)}%</span></div><p className="fi-note">Scroll through the milestones. The ribbon follows your reading.</p>
    <div className="fi-timeline-scroll" ref={area} tabIndex="0" role="region" aria-label="Project milestones" onScroll={update}><div className="fi-timeline-content"><div className="fi-timeline-track" aria-hidden="true"><span style={{ transform: 'scaleY(' + progress + ')' }}/></div><ol>{values.map((item, index) => <li key={index} data-reached={progress >= index / Math.max(1, values.length - 1)}><span className="fi-timeline-dot" aria-hidden="true">{index + 1}</span><span className="fi-eyebrow">CHAPTER 0{index + 1}</span><h4>{item.title}</h4><p>{item.text}</p></li>)}</ol></div></div>
  </section>;
}
