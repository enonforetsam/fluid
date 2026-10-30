import { useEffect, useRef, useState } from 'react';

/** Original bounded Canvas2D materials, independent of FluidCore. */
export const clamp = (v, min=0, max=1) => Math.min(max,Math.max(min,Number(v)||0));
export const svgURL = svg => 'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg);
export const SAMPLE_IMAGE = svgURL(`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800"><defs><linearGradient id="s" x2="0" y2="1"><stop stop-color="#dc9b86"/><stop offset="1" stop-color="#e9d8bc"/></linearGradient><linearGradient id="m"><stop stop-color="#5c735f"/><stop offset="1" stop-color="#203e37"/></linearGradient></defs><path fill="url(#s)" d="M0 0h1200v800H0z"/><circle cx="842" cy="224" r="98" fill="#f6e4ba"/><path fill="#9d9c7b" d="M0 582 280 237l260 370 260-265 400 290v168H0z"/><path fill="url(#m)" d="M0 670 270 460l263 290 270-195 397 165v80H0z"/><path fill="#d1bc99" d="M500 800 638 650h75l-99 150z"/></svg>`);
export function useReducedMotion(){
  const [reduced,setReduced]=useState(()=>typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(()=>{const media=matchMedia('(prefers-reduced-motion: reduce)');const update=()=>setReduced(media.matches);update();media.addEventListener('change',update);return()=>media.removeEventListener('change',update);},[]);return reduced;
}
export function useImage(src=SAMPLE_IMAGE){
  const [state,setState]=useState({image:null,error:''});
  useEffect(()=>{let current=true;const image=new Image(),source=src||SAMPLE_IMAGE;setState({image:null,error:''});
    if(typeof source!=='string'||source.length>24000000||/^(javascript|vbscript|data:(?!image\/(png|jpeg|webp|gif|avif|svg\+xml)))/i.test(source)){setState({image:null,error:'Use a PNG, JPEG, WebP or SVG image.'});return;}
    if(/^https?:/i.test(source))image.crossOrigin='anonymous';
    image.onload=()=>{if(current)setState({image,error:''});};image.onerror=()=>{if(current)setState({image:null,error:'This image could not be decoded. Try a local PNG, JPEG or SVG.'});};image.src=source;
    return()=>{current=false;image.onload=image.onerror=null;};
  },[src]);return state;
}
export function useExportReady(onExportReady,api){
  const latest=useRef(api);latest.current=api;const keys=Object.keys(api).sort().join(',');
  useEffect(()=>{if(!onExportReady)return;const bridge=Object.fromEntries(keys.split(',').filter(Boolean).map(key=>[key,(...args)=>latest.current[key](...args)]));onExportReady(bridge);return()=>onExportReady(null);},[onExportReady,keys]);
}
export async function canvasPNG(canvas,filename='fluid-art.png'){
  if(!canvas?.width||!canvas?.height)throw new Error('The canvas is not ready yet.');
  const blob=await new Promise((resolve,reject)=>{try{canvas.toBlob(value=>value?resolve(value):reject(new Error('PNG export failed.')),'image/png');}catch(error){reject(error);}});return{filename,mime:'image/png',data:blob};
}
export const asset=(filename,mime,data)=>({filename,mime,data});
export const escapeHTML=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function useAnimatedCanvas(ref,draw,{paused=false,replayKey=0}={}){
  const reduced=useReducedMotion(),time=useRef(0),replay=useRef(replayKey),latest=useRef(draw);latest.current=draw;
  useEffect(()=>{const canvas=ref.current;if(!canvas)return;const ctx=canvas.getContext('2d');if(!ctx)return;let frame=0,last=0,visible=true,alive=true;if(replay.current!==replayKey){time.current=0;replay.current=replayKey;}
    const paint=()=>{if(alive)latest.current(ctx,canvas.width,canvas.height,time.current,reduced);};
    const running=()=>!paused&&!reduced&&visible&&!document.hidden;
    const tick=now=>{frame=0;if(!alive||!running())return;if(!last||now-last>=32){time.current+=last?Math.min(.1,(now-last)/1000):0;last=now;paint();}frame=requestAnimationFrame(tick);};
    const sync=()=>{cancelAnimationFrame(frame);frame=0;last=0;paint();if(running())frame=requestAnimationFrame(tick);};
    const resize=()=>{const r=canvas.getBoundingClientRect(),scale=Math.min(1.5,devicePixelRatio||1),w=Math.max(1,Math.round(r.width*scale)),h=Math.max(1,Math.round(r.height*scale)),factor=Math.min(1,1200/w,1200/h);canvas.width=Math.max(1,Math.round(w*factor));canvas.height=Math.max(1,Math.round(h*factor));paint();};
    const ro=new ResizeObserver(resize);ro.observe(canvas);const io=new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;sync();});io.observe(canvas);document.addEventListener('visibilitychange',sync);resize();sync();
    return()=>{alive=false;cancelAnimationFrame(frame);ro.disconnect();io.disconnect();document.removeEventListener('visibilitychange',sync);};
  },[ref,paused,reduced,replayKey]);
  useEffect(()=>{const c=ref.current,ctx=c?.getContext('2d');if(ctx)draw(ctx,c.width,c.height,time.current,reduced);},[draw,ref,reduced]);return reduced;
}
export function cover(ctx,image,x,y,width,height,zoom=1){if(!image?.naturalWidth)return;const scale=Math.max(width/image.naturalWidth,height/image.naturalHeight)*zoom,w=image.naturalWidth*scale,h=image.naturalHeight*scale;ctx.drawImage(image,x+(width-w)/2,y+(height-h)/2,w,h);}
export function drawArt(ctx,w,h,t=0,{color='#f2aa86',secondary='#a799e1',seed=42,look='ink',intensity=1}={}){
  ctx.save();ctx.globalCompositeOperation='source-over';ctx.globalAlpha=1;const phase=Number(seed||42)*.137,chrome=look==='chrome',grain=look==='grain';
  ctx.fillStyle=chrome?'#151a20':'#172c2a';ctx.fillRect(0,0,w,h);const base=ctx.createLinearGradient(0,0,w,h);base.addColorStop(0,chrome?'#bec5cd':color);base.addColorStop(.52,chrome?'#1c2431':'#223d3a');base.addColorStop(1,chrome?'#e1e7eb':secondary);ctx.fillStyle=base;ctx.fillRect(0,0,w,h);
  for(let i=0;i<7;i++){const f=i/6,wave=Math.sin(t*.2+phase+i*1.7),x=w*(.1+.8*f),y=h*(.38+.25*Math.sin(phase+i+t*.13)),glow=ctx.createRadialGradient(x,y,1,x,y,Math.max(w,h)*(.27+f*.12));glow.addColorStop(0,chrome?(i%2?'#f1f5f7':'#495569'):i%2?secondary:color);glow.addColorStop(1,'transparent');ctx.globalAlpha=.65*intensity;ctx.fillStyle=glow;ctx.fillRect(0,0,w,h);ctx.globalAlpha=chrome?.65:.24;ctx.strokeStyle=chrome?(i%2?'#f4f7fa':'#11151d'):i%2?secondary:color;ctx.lineWidth=h*(.035+f*.035);ctx.beginPath();ctx.moveTo(-w*.1,h*(f+.1));ctx.bezierCurveTo(w*.25,h*(1.05-f+wave*.2),w*.65,h*(f+wave*.22),w*1.1,h*(.9-f));ctx.stroke();}
  if(grain){ctx.globalAlpha=.15;ctx.fillStyle='#fff';for(let i=0;i<950;i++){const x=((Math.sin(i*48.13+phase)*43758.5453)%1+1)%1*w,y=((Math.sin(i*31.7+phase)*9133.33)%1+1)%1*h;ctx.fillRect(x,y,1.5,1.5);}}ctx.restore();
}
export function fittedText(ctx,text,maxWidth,initialSize,weight=800){let size=initialSize;ctx.font=`${weight} ${size}px Arial,sans-serif`;while(ctx.measureText(text).width>maxWidth&&size>14){size-=2;ctx.font=`${weight} ${size}px Arial,sans-serif`;}return size;}

/** Converts local data URLs to CSP-compatible object URLs; each URL has one owner. */
export function useLocalAudio(input=''){
 const [state,setState]=useState({url:'',error:''});
 useEffect(()=>{
  let objectURL='';
  try{
   if(!input){setState({url:'',error:''});return;}
   if(typeof input!=='string'||input.length>36000000)throw new Error('Choose an audio file smaller than 25 MB.');
   if(input.startsWith('data:')){
    const match=/^data:([^;,]*)(;base64)?,([\s\S]*)$/.exec(input);
    if(!match||!/^audio\//i.test(match[1]))throw new Error('Choose a supported local audio file.');
    const raw=match[2]?atob(match[3]):decodeURIComponent(match[3]),bytes=new Uint8Array(raw.length);
    for(let i=0;i<raw.length;i++)bytes[i]=raw.charCodeAt(i);
    objectURL=URL.createObjectURL(new Blob([bytes],{type:match[1]}));setState({url:objectURL,error:''});
   }else{
    const url=new URL(input,location.href);
    if(url.protocol!=='blob:'&&url.origin!==location.origin)throw new Error('Use a local file or a same-origin audio URL.');
    setState({url:input,error:''});
   }
  }catch(error){setState({url:'',error:error.message||'This audio file could not be prepared.'});}
  return()=>{if(objectURL)URL.revokeObjectURL(objectURL);};
 },[input]);
 return state;
}
