import { useEffect, useRef, useState } from 'react';
import { ToolShell, TextField, SelectField, RangeField, useExportReady } from './shared/tool-core.jsx';
import { fullHTML, escapeHTML, readable } from './shared/tool-art.js';

const EASINGS={settle:'cubic-bezier(.2,.8,.2,1)',soft:'cubic-bezier(.4,0,.2,1)',linear:'linear'};
function recipeCSS(settings){const from=settings.entrance==='fade'?'none':settings.entrance==='scale'?'scale(.88)':'translateY('+settings.distance+'px)',hover=settings.hover==='none'?'none':settings.hover==='zoom'?'scale('+(1+settings.lift/100)+')':'translateY(-'+settings.lift+'px)';return '.fluid-recipe{--recipe-duration:'+settings.duration+'ms;--recipe-stagger:'+settings.stagger+'ms;--recipe-from:'+from+';--recipe-hover:'+hover+';--recipe-ease:'+EASINGS[settings.easing]+';background:#17181c;color:#f5f1eb;padding:clamp(20px,5vw,64px);font-family:system-ui,sans-serif}.fluid-recipe h1{font-size:clamp(32px,6vw,64px);line-height:1.05;letter-spacing:-.05em;margin:0 0 24px}.fluid-recipe-scroll{height:440px;max-height:70svh;overflow-y:auto;overscroll-behavior:contain;padding:20px;border:1px solid #52535e;border-radius:16px;scrollbar-gutter:stable}.fluid-recipe-spacer{height:160px;display:flex;align-items:center;color:#bfc0c7;font-size:14px}.fluid-recipe-grid{display:grid;gap:16px}.fluid-recipe-card{border:0;border-radius:16px;background:'+settings.color+';color:'+readable(settings.color)+';padding:28px;opacity:1;transform:none;transition:transform var(--recipe-duration) var(--recipe-ease),opacity var(--recipe-duration) ease;transition-delay:calc(var(--index,0)*var(--recipe-stagger));min-height:160px;outline-offset:4px}.fluid-recipe-card[data-ready=false]{opacity:0;transform:var(--recipe-from)}.fluid-recipe-card:hover,.fluid-recipe-card:focus-visible{transform:var(--recipe-hover);transition-delay:0ms}.fluid-recipe-card:focus-visible{outline:3px solid '+settings.secondary+'}.fluid-recipe-card h2{font-size:28px;line-height:1.1;letter-spacing:-.04em;margin:0 0 12px}.fluid-recipe-card p{font-size:16px;line-height:1.5;margin:0}.fluid-recipe[data-paused=true] .fluid-recipe-card{opacity:1;transform:none;transition:none}@media(prefers-reduced-motion:reduce){.fluid-recipe-card{opacity:1!important;transform:none!important;transition:none!important}}';}
function browserRecipe(){return "var root=document.querySelector('.fluid-recipe'),scroll=root.querySelector('.fluid-recipe-scroll'),cards=Array.from(root.querySelectorAll('.fluid-recipe-card')),motion=matchMedia('(prefers-reduced-motion: reduce)'),observer=null;function update(){if(observer)observer.disconnect();var active=!document.hidden&&!motion.matches;root.dataset.paused=String(!active);cards.forEach(function(card){card.dataset.ready=String(!active);});if(active&&typeof IntersectionObserver!=='undefined'){observer=new IntersectionObserver(function(entries){entries.forEach(function(entry){entry.target.dataset.ready=String(entry.isIntersecting);});},{root:scroll,threshold:.15});cards.forEach(function(card){observer.observe(card);});}else{cards.forEach(function(card){card.dataset.ready='true';});}}motion.addEventListener('change',update);document.addEventListener('visibilitychange',update);addEventListener('pagehide',function(){if(observer)observer.disconnect();motion.removeEventListener('change',update);document.removeEventListener('visibilitychange',update);},{once:true});update();";}
function reactRecipe(settings){return `import { useEffect, useRef } from 'react';
import ${JSON.stringify('./fluid-motion-recipe.css')};

/** Original Fluid motion recipe. Settings: ${JSON.stringify(settings)} */
export default function FluidMotionRecipe({ paused = false }) {
  const root = useRef(null);
  useEffect(() => {
    const element = root.current;
    const scroll = element.querySelector('.fluid-recipe-scroll');
    const cards = [...element.querySelectorAll('.fluid-recipe-card')];
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    let observer;
    function update() {
      observer?.disconnect();
      const active = !paused && !document.hidden && !preference.matches;
      element.dataset.paused = String(!active);
      cards.forEach(card => { card.dataset.ready = String(!active); });
      if (active && typeof IntersectionObserver !== 'undefined') {
        observer = new IntersectionObserver(entries => {
          entries.forEach(entry => { entry.target.dataset.ready = String(entry.isIntersecting); });
        }, { root: scroll, threshold: .15 });
        cards.forEach(card => observer.observe(card));
      } else cards.forEach(card => { card.dataset.ready = 'true'; });
    }
    preference.addEventListener('change', update);
    document.addEventListener('visibilitychange', update);
    update();
    return () => {
      observer?.disconnect();
      preference.removeEventListener('change', update);
      document.removeEventListener('visibilitychange', update);
    };
  }, [paused]);
  const cards = ['Make room.', 'Follow a feeling.', 'Keep moving.'];
  return (
    <section className="fluid-recipe" ref={root}>
      <h1>${escapeHTML(settings.title).replace(/\{/g,'&#123;').replace(/\}/g,'&#125;')}</h1>
      <div className="fluid-recipe-scroll" tabIndex={0} aria-label="Scroll to preview the entrances">
        <div className="fluid-recipe-spacer">Scroll down. Hover or focus a card.</div>
        <div className="fluid-recipe-grid">
          {cards.map((title, index) => (
            <article key={title} className="fluid-recipe-card" tabIndex={0} style={{ '--index': index }}>
              <h2>{title}</h2><p>A little rhythm, across a whole experience.</p>
            </article>
          ))}
        </div>
        <div className="fluid-recipe-spacer">Scroll back to replay.</div>
      </div>
    </section>
  );
}
`;}

/** Coordinated entrance, scroll and hover recipes with complete React/CSS/HTML exports. */
export default function MotionRecipes({paused=false,replayKey=0,color='#e4d2bc',secondary='#ffb189',onExportReady}){
  const [title,setTitle]=useState('Give the page a rhythm.'),[entrance,setEntrance]=useState('rise'),[hover,setHover]=useState('lift'),[distance,setDistance]=useState(28),[lift,setLift]=useState(6),[duration,setDuration]=useState(650),[stagger,setStagger]=useState(90),[easing,setEasing]=useState('settle'),[replay,setReplay]=useState(0),stage=useRef(null),scroll=useRef(null);
  const settings={color,secondary,title,entrance,hover,distance,lift,duration,stagger,easing};
  useEffect(()=>{
    const root=stage.current,scroller=scroll.current,cards=[...root.querySelectorAll('.ft-motion-card')],motion=window.matchMedia('(prefers-reduced-motion: reduce)');let observer;
    function update(){observer?.disconnect();const active=!paused&&!document.hidden&&!motion.matches;root.dataset.paused=String(!active);cards.forEach(card=>card.dataset.ready=String(!active));if(active&&typeof IntersectionObserver!=='undefined'){observer=new IntersectionObserver(entries=>entries.forEach(entry=>entry.target.dataset.ready=String(entry.isIntersecting)),{root:scroller,threshold:.15});cards.forEach(card=>observer.observe(card));}else cards.forEach(card=>card.dataset.ready='true');}
    document.addEventListener('visibilitychange',update);motion.addEventListener('change',update);update();return()=>{observer?.disconnect();document.removeEventListener('visibilitychange',update);motion.removeEventListener('change',update);};
  },[paused,replayKey,replay,entrance,distance,duration,stagger,easing]);
  const css=recipeCSS(settings),exports={
    jsx:()=>({filename:'FluidMotionRecipe.jsx',mime:'text/jsx',data:reactRecipe(settings)}),
    css:()=>({filename:'fluid-motion-recipe.css',mime:'text/css',data:css}),
    html:()=>({filename:'fluid-motion-recipe.html',mime:'text/html',data:fullHTML(title,'<main class="fluid-recipe"><h1>'+escapeHTML(title)+'</h1><div class="fluid-recipe-scroll" tabindex="0" aria-label="Scroll to preview the entrances"><div class="fluid-recipe-spacer">Scroll down. Hover or focus a card.</div><div class="fluid-recipe-grid">'+['Make room.','Follow a feeling.','Keep moving.'].map((text,index)=>'<article class="fluid-recipe-card" tabindex="0" style="--index:'+index+'"><h2>'+text+'</h2><p>A little rhythm, across a whole experience.</p></article>').join('')+'</div><div class="fluid-recipe-spacer">Scroll back to replay.</div></div></main>',css,browserRecipe(),settings)}),
    json:()=>({filename:'fluid-motion-recipe.json',mime:'application/json',data:JSON.stringify(settings,null,2)})
  };useExportReady(onExportReady,exports);
  const from=entrance==='fade'?'none':entrance==='scale'?'scale(.88)':'translateY('+distance+'px)',hoverTransform=hover==='none'?'none':hover==='zoom'?'scale('+(1+lift/100)+')':'translateY(-'+lift+'px)';
  return <ToolShell title="Motion Recipes" description="Coordinate entrance, scroll and hover treatments. Scroll the preview, hover or focus a card, then download a complete recipe." exports={exports} labels={{jsx:'Download React'}} controls={<>
    <TextField label="Recipe heading" value={title} onChange={setTitle} maxLength={100}/><SelectField label="Entrance" value={entrance} onChange={setEntrance} options={['rise','fade','scale']}/><SelectField label="Hover / focus" value={hover} onChange={setHover} options={['lift','zoom','none']}/><RangeField label="Entrance distance" value={distance} onChange={setDistance} min={0} max={60} unit=" px"/><RangeField label="Hover strength" value={lift} onChange={setLift} min={0} max={12}/><RangeField label="Duration" value={duration} onChange={setDuration} min={150} max={1400} step={50} unit=" ms"/><RangeField label="Stagger" value={stagger} onChange={setStagger} min={0} max={200} step={10} unit=" ms"/><SelectField label="Easing" value={easing} onChange={setEasing} options={Object.keys(EASINGS)}/><button type="button" onClick={()=>setReplay(value=>value+1)}>Replay entrances</button><p className="ft-note">React needs the CSS file beside it. HTML is self-contained. Paused, hidden and reduced-motion states keep all content visible.</p>
  </>}><div ref={stage} className="ft-motion-stage" style={{'--ft-accent':secondary,'--ft-duration':duration+'ms','--ft-stagger':stagger+'ms','--ft-ease':EASINGS[easing],'--ft-from':from,'--ft-hover-transform':hoverTransform}}><h3>{title}</h3><div ref={scroll} className="ft-motion-scroll" tabIndex={0} aria-label="Scroll to preview the motion recipe"><div className="ft-motion-spacer">Scroll down. Hover or focus a card.</div><div className="ft-motion-cards">{['Make room.','Follow a feeling.','Keep moving.'].map((text,index)=><article key={text} className="ft-motion-card" tabIndex={0} style={{'--ft-index':index,background:color,color:readable(color)}}><strong>{text}</strong><span>A little rhythm, across a whole experience.</span></article>)}</div><div className="ft-motion-spacer">Scroll back to replay.</div></div></div></ToolShell>;
}
