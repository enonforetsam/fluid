import { useEffect, useId, useRef, useState } from 'react';
import { readImageFile } from './tool-upload.js';
export function useExportReady(onExportReady, exports) {
  const latest=useRef(exports);latest.current=exports;const keys=Object.keys(exports).join('|');
  useEffect(()=>{if(!onExportReady)return;const api=Object.fromEntries(Object.keys(latest.current).map(key=>[key,(...args)=>latest.current[key](...args)]));onExportReady(api);return()=>onExportReady(null);},[onExportReady,keys]);
}
export async function downloadExport(factory) {
  const result=await factory();if(!result?.data)throw new Error('No export was created.');
  const blob=result.data instanceof Blob?result.data:new Blob([result.data],{type:result.mime||'text/plain'});
  const url=URL.createObjectURL(blob),anchor=document.createElement('a');anchor.href=url;anchor.download=result.filename||'fluid-export';document.body.append(anchor);anchor.click();anchor.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);
}
export function Exports({ exports, labels={} }) {
  const [message,setMessage]=useState(''),[busy,setBusy]=useState(false),alive=useRef(true);
  useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
  async function run(key){setBusy(true);setMessage('Preparing '+key.toUpperCase()+'…');try{await downloadExport(exports[key]);if(alive.current)setMessage(key.toUpperCase()+' downloaded.');}catch(error){if(alive.current)setMessage(error.message||'Export failed. Try again.');}finally{if(alive.current)setBusy(false);}}
  return <div className="ft-export-area"><div className="ft-export-buttons">{Object.keys(exports).map(key=><button key={key} type="button" disabled={busy} onClick={()=>run(key)}>{labels[key]||'Download '+key.toUpperCase()}</button>)}</div><p role="status" className="ft-status">{message||'Your files stay in this browser. No account needed.'}</p></div>;
}
export function ToolShell({title,description,controls,children,exports,labels,className=''}) {
  return <section className={'ft-tool '+className} aria-label={title}><header className="ft-tool-intro"><h3>{title}</h3><p>{description}</p></header><div className="ft-workspace"><div className="ft-preview">{children}</div><div className="ft-settings">{controls}</div></div><Exports exports={exports} labels={labels}/></section>;
}
export function Field({label,children,hint}) { const id=useId();return <div className="ft-field"><label htmlFor={id}>{label}</label>{typeof children==='function'?children(id):children}{hint?<span className="ft-field-hint">{hint}</span>:null}</div>; }
export function TextField({label,value,onChange,maxLength=160,multiline=false}) {return <Field label={label}>{id=>multiline?<textarea id={id} value={value} maxLength={maxLength} rows={3} onChange={e=>onChange(e.target.value)}/>:<input id={id} type="text" value={value} maxLength={maxLength} onChange={e=>onChange(e.target.value)}/>}</Field>;}
export function RangeField({label,value,onChange,min=0,max=100,step=1,unit=''}) {return <Field label={label+' · '+value+unit}>{id=><input id={id} type="range" value={value} min={min} max={max} step={step} onChange={e=>onChange(Number(e.target.value))}/>}</Field>;}
export function SelectField({label,value,onChange,options}) {return <Field label={label}>{id=><select id={id} value={value} onChange={e=>onChange(e.target.value)}>{options.map(option=><option key={typeof option==='string'?option:option.value} value={typeof option==='string'?option:option.value}>{typeof option==='string'?option:option.label}</option>)}</select>}</Field>;}
export function ColorField({label,value,onChange}) {return <Field label={label}><div className="ft-color-row"><input type="color" aria-label={label} value={value} onChange={e=>onChange(e.target.value)}/><code>{value}</code></div></Field>;}
export function useImageAsset() {
  const [asset,setAsset]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),request=useRef(0),alive=useRef(true);
  useEffect(()=>{alive.current=true;return()=>{alive.current=false;request.current++;};},[]);
  async function load(file){if(!file)return;const current=++request.current;setBusy(true);setError('');try{const next=await readImageFile(file);if(alive.current&&current===request.current)setAsset(next);}catch(failure){if(alive.current&&current===request.current)setError(failure.message);}finally{if(alive.current&&current===request.current)setBusy(false);}}
  function clear(){request.current++;setAsset(null);setError('');setBusy(false);}
  return {asset,error,busy,load,clear};
}
export function ImageField({label='Local image',upload}) {const id=useId();return <div className="ft-field"><label htmlFor={id}>{label}</label><input id={id} type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/avif,image/svg+xml" onChange={e=>{upload.load(e.target.files?.[0]);e.target.value='';}}/><span className="ft-field-hint">PNG, JPEG, WebP, AVIF or simple SVG. Up to 25 MB / 40 MP; stored at 2048 px max.</span>{upload.busy?<p role="status">Reading image…</p>:null}{upload.error?<p role="alert" className="ft-error">{upload.error}</p>:null}{upload.asset?<div className="ft-image-info"><span>{upload.asset.name} · {upload.asset.width} × {upload.asset.height}</span><button type="button" onClick={upload.clear}>Remove</button></div>:null}</div>;}
export function useCanvasDraw(draw,deps,width=1024,height=640) {
  const ref=useRef(null);useEffect(()=>{const canvas=ref.current;if(!canvas)return;canvas.width=width;canvas.height=height;const ctx=canvas.getContext('2d');if(ctx)draw(ctx,width,height);},[width,height,...deps]);return ref;
}
export function useAnimatedCanvas(draw,{paused=false,replayKey=0,width=768,height=432}={}) {
  const ref=useRef(null),latest=useRef(draw);latest.current=draw;
  useEffect(()=>{
    const canvas=ref.current;if(!canvas)return;canvas.width=width;canvas.height=height;const ctx=canvas.getContext('2d');if(!ctx)return;
    const motion=window.matchMedia('(prefers-reduced-motion: reduce)');let frame=0,visible=true,time=0,last=0,dead=false;
    function paint(now){frame=0;if(dead)return;if(!last)last=now;const delta=Math.min(.05,(now-last)/1000);last=now;if(!paused&&!motion.matches&&!document.hidden&&visible){time+=delta;latest.current(ctx,width,height,time);frame=requestAnimationFrame(paint);}}
    function update(){cancelAnimationFrame(frame);frame=0;last=0;latest.current(ctx,width,height,time);if(!paused&&!motion.matches&&!document.hidden&&visible)frame=requestAnimationFrame(paint);}
    const observer=typeof IntersectionObserver!=='undefined'?new IntersectionObserver(entries=>{visible=entries[0]?.isIntersecting!==false;update();}):null;observer?.observe(canvas);document.addEventListener('visibilitychange',update);motion.addEventListener('change',update);update();
    return()=>{dead=true;cancelAnimationFrame(frame);observer?.disconnect();document.removeEventListener('visibilitychange',update);motion.removeEventListener('change',update);};
  },[paused,replayKey,width,height,draw]);return ref;
}
