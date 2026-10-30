import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import SplitReveal from './src/SplitReveal.jsx';
import WaveText from './src/WaveText.jsx';
import MagneticButton from './src/MagneticButton.jsx';
import SpotlightCard from './src/SpotlightCard.jsx';
import TiltCard from './src/TiltCard.jsx';
import LoopMarquee from './src/LoopMarquee.jsx';
import catalogue from './catalogue.json';

const CATEGORIES = ['All', 'Text', 'Cards', 'Interaction', 'Loops'];
const COLOURS = [{name:'Afterglow',value:'#ff916a'},{name:'Lilac',value:'#c5b7ff'},{name:'Leaf',value:'#b6e7bc'},{name:'Sky',value:'#9fcbff'}];
const sourceCache = new Map();
function fromLocation() { return catalogue.find(item => item.id === new URLSearchParams(location.search).get('component')) || catalogue[3]; }
function defaults(item) { return {text:item.text,amount:item.amount,color:COLOURS[0].value,reverse:false}; }
function useReducedMotion() {
  const [reduced,setReduced] = useState(() => matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => { const media=matchMedia('(prefers-reduced-motion: reduce)'); const update=()=>setReduced(media.matches);media.addEventListener('change',update);return()=>media.removeEventListener('change',update); },[]);
  return reduced;
}
function marqueeItems(text) { const items=text.split(/[·,]/).map(item=>item.trim()).filter(Boolean);return items.length?items:['MAKE','PLAY','REPEAT']; }
function usageFor(item,value) {
  const text='{'+JSON.stringify(value.text)+'}'; let body;
  if(item.id==='split-reveal')body=`<SplitReveal duration={${value.amount}}>${text}</SplitReveal>`;
  if(item.id==='wave-text')body=`<WaveText duration={${value.amount}}>${text}</WaveText>`;
  if(item.id==='magnetic-button')body=`<MagneticButton strength={${value.amount}} color="${value.color}"\n      onClick={() => console.log('Make something')}>\n      ${text}\n    </MagneticButton>`;
  if(item.id==='spotlight-card')body=`<SpotlightCard title={${JSON.stringify(value.text)}} color="${value.color}">\n      <p>A little light for your next idea.</p>\n    </SpotlightCard>`;
  if(item.id==='tilt-card')body=`<TiltCard title={${JSON.stringify(value.text)}} maxTilt={${value.amount}} color="${value.color}">\n      <p>See what happens from another angle.</p>\n    </TiltCard>`;
  if(item.id==='loop-marquee')body=`<LoopMarquee items={${JSON.stringify(marqueeItems(value.text))}}\n      duration={${value.amount}} reverse={${value.reverse}} />`;
  return `import ${item.file} from './${item.file}.jsx';\nimport './components.css';\n\nexport default function Example() {\n  return (\n    ${body}\n  );\n}\n`;
}
async function readSource(file,signal) {
  if(sourceCache.has(file))return sourceCache.get(file);
  const response=await fetch(file,{signal}); if(!response.ok)throw new Error('Source unavailable');
  const value=await response.text(); if(/^\s*<!doctype/i.test(value))throw new Error('Source unavailable');
  sourceCache.set(file,value);return value;
}
async function copyText(value) {
  const active=document.activeElement;
  try { if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(value);return;} }catch{}
  const field=document.createElement('textarea');field.value=value;field.className='cp-fallback-copy';field.setAttribute('aria-label','Source to copy');document.body.append(field);field.focus();field.select();
  let copied=false;try {copied=document.execCommand('copy');} finally {field.remove();active?.focus();}
  if(!copied)throw new Error('Clipboard unavailable');
}
function downloadText(name,text) { const url=URL.createObjectURL(new Blob([text],{type:'text/plain;charset=utf-8'}));const link=document.createElement('a');link.href=url;link.download=name;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000); }
function Preview({item,value,replay,paused,onAction}) {
  const props={color:value.color};
  if(item.id==='split-reveal')return <SplitReveal key={replay} duration={value.amount} replayKey={replay}>{value.text}</SplitReveal>;
  if(item.id==='wave-text')return <WaveText duration={value.amount} paused={paused}>{value.text}</WaveText>;
  if(item.id==='magnetic-button')return <MagneticButton {...props} strength={paused?0:value.amount} onClick={onAction}>{value.text}</MagneticButton>;
  if(item.id==='spotlight-card')return <SpotlightCard {...props} title={value.text}><p className="cp-demo-content">A little light for your next idea.<br/>Move closer. There is more to discover.</p><a className="cp-demo-link" href="studio.html">Start exploring <span aria-hidden="true">↗</span></a></SpotlightCard>;
  if(item.id==='tilt-card')return <TiltCard {...props} title={value.text} maxTilt={paused?0:value.amount}><p className="cp-demo-content">A small shift.<br/>A whole new perspective.</p></TiltCard>;
  return <LoopMarquee items={marqueeItems(value.text)} duration={value.amount} reverse={value.reverse} paused={paused}/>;
}
function App() {
  const [item,setItem]=useState(fromLocation), [value,setValue]=useState(()=>defaults(fromLocation()));
  const [category,setCategory]=useState('All'), [query,setQuery]=useState(''), [mode,setMode]=useState('preview'), [codeTab,setCodeTab]=useState('jsx');
  const [source,setSource]=useState({status:'loading'}), [retry,setRetry]=useState(0), [replay,setReplay]=useState(0), [paused,setPaused]=useState(false);
  const [message,setMessage]=useState(''), [copying,setCopying]=useState(false), [copied,setCopied]=useState(false);
  const reduced=useReducedMotion(), requestRef=useRef(0), codePanelRef=useRef(null), currentRef=useRef('');
  currentRef.current=item.id+'|'+codeTab;
  useEffect(()=>{
    const controller=new AbortController(), request=++requestRef.current;
    setSource({status:'loading'});setCopied(false);setMessage('');
    Promise.all([readSource(`components/src/${item.file}.jsx`,controller.signal),readSource('components/components.css',controller.signal)])
      .then(([jsx,css])=>{if(request===requestRef.current)setSource({status:'ready',jsx,css});})
      .catch(error=>{if(error.name!=='AbortError'&&request===requestRef.current)setSource({status:'error'});});
    return()=>controller.abort();
  },[item.id,retry]);
  useEffect(()=>{const back=()=>{const next=fromLocation();setItem(next);setValue(defaults(next));setReplay(x=>x+1);setMessage('');};window.addEventListener('popstate',back);return()=>window.removeEventListener('popstate',back);},[]);
  useEffect(()=>{setCopied(false);},[codeTab,item.id,value.text,value.amount,value.color,value.reverse]);
  const results=catalogue.filter(entry=>(category==='All'||entry.category===category)&&`${entry.name} ${entry.description} ${entry.category}`.toLowerCase().includes(query.trim().toLowerCase()));
  const hasColour=['magnetic-button','spotlight-card','tilt-card'].includes(item.id), text=codeTab==='usage'?usageFor(item,value):source[codeTab]||'';
  const codeReady=codeTab==='usage'||source.status==='ready', fileName=codeTab==='jsx'?`${item.file}.jsx`:codeTab==='css'?'components.css':`${item.file}Example.jsx`;
  function select(next) {setItem(next);setValue(defaults(next));setReplay(x=>x+1);setMessage('');const url=new URL(location.href);url.searchParams.set('component',next.id);history.pushState({},'',url);}
  function update(key,next) {setValue(old=>({...old,[key]:next}));if(item.id==='split-reveal'&&key==='text')setReplay(x=>x+1);}
  function switchTabs(event,names,active,setter,prefix) {
    const index=names.indexOf(active);let next;
    if(event.key==='ArrowRight')next=names[(index+1)%names.length];if(event.key==='ArrowLeft')next=names[(index+names.length-1)%names.length];
    if(event.key==='Home')next=names[0];if(event.key==='End')next=names.at(-1);
    if(next){event.preventDefault();setter(next);document.getElementById(prefix+next)?.focus();}
  }
  async function copy() {
    if(!codeReady||copying)return;setCopying(true);setMessage('');const selected=currentRef.current;
    try{await copyText(text);if(currentRef.current===selected){setCopied(true);setMessage(`${fileName} copied. Add it to your project with the CSS.`);}}
    catch{setMessage('Could not access the clipboard. Download the file, or select the source to copy it.');codePanelRef.current?.focus();}
    finally{setCopying(false);}
  }
  function action() {setMessage('That little pull is yours to keep. Copy MagneticButton.jsx and the CSS to use it.');}
  return <div className="cp-workspace">
    <aside className="cp-sidebar" aria-label="Browse components">
      <label className="cp-search" htmlFor="componentSearch">Find your next detail<input id="componentSearch" type="search" placeholder="Find a component…" value={query} onChange={event=>setQuery(event.target.value)} autoComplete="off"/></label>
      <div className="cp-category" role="group" aria-label="Component categories">{CATEGORIES.map(name=><button key={name} type="button" aria-pressed={category===name} onClick={()=>setCategory(name)}><span>{name}</span><span>{name==='All'?catalogue.length:catalogue.filter(entry=>entry.category===name).length}</span></button>)}</div>
      <div className="cp-list-heading"><span>THE COLLECTION</span><span aria-live="polite">{results.length} / 6</span></div>
      <nav className="cp-list" aria-label="Choose a component">{results.map(entry=><button key={entry.id} className="cp-component-button" type="button" aria-current={item.id===entry.id?'true':undefined} onClick={()=>select(entry)}><span className="cp-symbol" aria-hidden="true">{entry.symbol}</span>{entry.name}</button>)}{results.length===0&&<div className="cp-empty"><p>No components found. Try “card”, “text”, or clear your filters.</p><button className="cp-text-button" type="button" onClick={()=>{setQuery('');setCategory('All');}}>Clear search and filters ↗</button></div>}</nav>
      <p className="cp-sidebar-note">Small pieces. Your own possibilities.<br/>React source + plain CSS.<br/><a href="components/LICENSE">Read the MIT license ↗</a></p>
    </aside>
    <section className="cp-detail" aria-labelledby="componentName">
      <div className="cp-detail-top"><div><p className="eyebrow">{item.category.toUpperCase()} / REACT + CSS</p><h2 id="componentName">{item.name}</h2><p className="cp-description">{item.description}</p></div><span className="cp-index">{String(catalogue.indexOf(item)+1).padStart(2,'0')} / 06</span></div>
      <div className="cp-surface">
        <div className="cp-preview-toolbar"><div className="cp-tabs" role="tablist" aria-label="Component view">{['preview','code'].map(name=><button key={name} id={'view-'+name} type="button" role="tab" aria-selected={mode===name} aria-controls={'panel-'+name} tabIndex={mode===name?0:-1} onClick={()=>setMode(name)} onKeyDown={event=>switchTabs(event,['preview','code'],mode,setMode,'view-')}>{name==='preview'?'Preview':'Code'}</button>)}</div><div className="cp-toolbar-actions"><button className="cp-text-button" type="button" onClick={()=>setReplay(x=>x+1)} aria-label="Replay component preview">↻ Replay</button><button className="cp-text-button" type="button" aria-pressed={paused} onClick={()=>setPaused(x=>!x)}>{paused?'▷ Resume loops':'Ⅱ Pause loops'}</button></div></div>
        {mode==='preview'?<div id="panel-preview" role="tabpanel" aria-labelledby="view-preview">
          <div className="cp-preview"><div key={item.id} className="cp-demo" data-component={item.id} data-paused={paused||reduced}><Preview item={item} value={value} replay={replay} paused={paused||reduced} onAction={action}/></div><p className="cp-preview-hint">{item.hint}</p></div>
          {reduced&&<p className="cp-motion-note">Your device prefers reduced motion. The preview stays still.</p>}
          <div className="cp-controls"><div className="cp-controls-heading"><h3>MAKE IT YOURS</h3><button className="cp-text-button" type="button" onClick={()=>{setValue(defaults(item));setReplay(x=>x+1);setMessage('Controls reset.');}}>Reset ↺</button></div>
            <label className="cp-field" htmlFor="componentText"><span>{item.id==='loop-marquee'?'Words · separate with commas':'Your words'}<output>{value.text.length}/80</output></span><input id="componentText" type="text" maxLength={80} value={value.text} onChange={event=>update('text',event.target.value)}/></label>
            {item.control&&<label className="cp-field" htmlFor="componentAmount"><span>{item.control}<output htmlFor="componentAmount">{value.amount}{item.unit}</output></span><input id="componentAmount" type="range" min={item.min} max={item.max} step={item.step} value={value.amount} onChange={event=>update('amount',Number(event.target.value))}/></label>}
            {hasColour&&<fieldset className="cp-swatches"><legend>Accent colour</legend><div className="cp-swatch-row">{COLOURS.map(colour=><button key={colour.value} className="cp-swatch" type="button" aria-label={colour.name+' accent'} aria-pressed={value.color===colour.value} onClick={()=>update('color',colour.value)} style={{'--swatch':colour.value}}><span aria-hidden="true"/></button>)}</div></fieldset>}
            {item.id==='loop-marquee'&&<label className="cp-check"><input type="checkbox" checked={value.reverse} onChange={event=>update('reverse',event.target.checked)}/>Reverse direction</label>}
          </div>
        </div>:<div id="panel-code" role="tabpanel" aria-labelledby="view-code">
          <div className="cp-code-toolbar"><div className="cp-tabs" role="tablist" aria-label="Source file">{['jsx','css','usage'].map(name=><button key={name} id={'source-'+name} type="button" role="tab" aria-selected={codeTab===name} aria-controls="sourcePanel" tabIndex={codeTab===name?0:-1} onClick={()=>setCodeTab(name)} onKeyDown={event=>switchTabs(event,['jsx','css','usage'],codeTab,setCodeTab,'source-')}>{name==='usage'?'Usage':name.toUpperCase()}</button>)}</div><div className="cp-code-actions"><button className="cp-text-button" type="button" aria-label={'Download '+fileName} disabled={!codeReady} onClick={()=>{downloadText(fileName,text);setMessage(fileName+' download started.');}}>Download ↓</button><button className="cp-copy" type="button" disabled={!codeReady||copying} aria-busy={copying} onClick={copy}>{copying?'Copying…':copied?'Copied ✓':'Copy source'}</button></div></div>
          <div id="sourcePanel" role="tabpanel" aria-labelledby={'source-'+codeTab} className="cp-code-scroll" tabIndex={0} ref={codePanelRef}>
            {codeReady?<pre><code>{text}</code></pre>:source.status==='error'?<div className="cp-source-error" role="alert"><p>We could not load this source file. Your preview still works.</p><button className="cp-copy" type="button" onClick={()=>setRetry(x=>x+1)}>Try again</button></div>:<p className="cp-loading" role="status">Loading the source…</p>}
          </div>
        </div>}
        <div className={'cp-status'+(copied?' cp-copy-feedback':'')} role="status" aria-live="polite">{message||(mode==='code'?'The preview uses this exact React source. Copy the JSX and CSS, then check Usage.':'Original components. Ready for a little experimentation.')}</div>
      </div>
      <div className="cp-setup"><div><h3>01 / Take the source</h3><p>Open Code. Copy the component’s JSX and <code>components.css</code> into your React project. The CSS is shared across this collection.</p></div><div><h3>02 / Make it part of your idea</h3><p>Copy the Usage example and adjust the props. React is the only dependency. Next.js App Router: add <code>'use client';</code> as the first line of the component file.</p></div></div>
      <div className="cp-props"><h3>A few things to play with</h3><table><thead><tr><th scope="col">Prop</th><th scope="col">What it does</th></tr></thead><tbody>{item.props.map(([name,description])=><tr key={name}><td>{name}</td><td>{description}</td></tr>)}</tbody></table></div>
      <p className="cp-footer-note">Built for pointers, keyboards, and quieter motion. MIT licensed — keep the license with the source. No account or API key.</p>
    </section>
  </div>;
}
createRoot(document.getElementById('componentsRoot')).render(<React.StrictMode><App/></React.StrictMode>);
