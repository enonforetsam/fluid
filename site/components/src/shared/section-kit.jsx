import {useEffect,useId,useRef,useState} from 'react';
export function colour(value,fallback='#ff916a'){return /^#[0-9a-f]{6}$/i.test(value||'')?value:fallback;}
export function artData(seed=42,color='#ff916a',secondary='#9fcbff'){
 const a=colour(color),b=colour(secondary,'#9fcbff'),n=Math.abs(Number(seed)||42)%360;
 return 'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="800" viewBox="0 0 1000 800"><defs><linearGradient id="a" x2="1" y2="1"><stop stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient><radialGradient id="b"><stop stop-color="${b}"/><stop offset="1" stop-color="${a}"/></radialGradient></defs><rect width="1000" height="800" fill="#17181b"/><g transform="rotate(${n} 500 400)"><ellipse cx="510" cy="410" rx="560" ry="200" fill="url(#a)"/><ellipse cx="380" cy="400" rx="300" ry="160" fill="#17181b"/><ellipse cx="560" cy="420" rx="200" ry="100" fill="url(#b)"/><path d="M-50 220Q400 700 1050 240M-50 280Q430 730 1050 300M-50 340Q460 760 1050 360" fill="none" stroke="${b}" stroke-width="2" opacity=".45"/></g><circle cx="800" cy="130" r="38" fill="${b}"/></svg>`);
}
export function SectionHeader({brand,links}){
 const [open,setOpen]=useState(false),button=useRef(null),navId='section-nav-'+useId().replace(/[^a-zA-Z0-9_-]/g,'');
 function follow(event){setOpen(false);const id=event.currentTarget.hash.slice(1),target=document.getElementById(id);if(target){target.setAttribute('tabindex','-1');target.focus({preventScroll:true});}}
 useEffect(()=>{if(!open)return;function close(e){if(e.key==='Escape'){setOpen(false);button.current?.focus();}}window.addEventListener('keydown',close);return()=>window.removeEventListener('keydown',close);},[open]);
 return <header className="fs-header" data-open={open}><a className="fs-brand" href={links[0]?.href||'#'}>{brand}</a><button type="button" className="fs-menu-button" data-fs-toggle="menu" aria-expanded={open} aria-controls={navId} ref={button} onClick={()=>setOpen(x=>!x)}>Menu <span aria-hidden="true">{open?'−':'+'}</span></button><nav id={navId} className="fs-nav" aria-label={brand+' section navigation'}>{links.map(link=><a key={link.href} href={link.href} onClick={follow}>{link.label}</a>)}</nav></header>;
}
function escape(value){return String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
export function useSectionExport(ref,title,onExportReady,media={}){
 const originalMedia=useRef(media);originalMedia.current=media;
 useEffect(()=>{if(!onExportReady)return;onExportReady({html:async()=>{
  const node=ref.current;if(!node)throw new Error('The section is not ready.');
  const clone=node.cloneNode(true);if(originalMedia.current.audioSrc)clone.querySelectorAll('audio').forEach(a=>{a.removeAttribute('src');a.setAttribute('data-fs-export-audio','local')});clone.dataset.playing='false';clone.style.setProperty('--fs-audio-level','0');clone.querySelectorAll('.fs-spectrum i').forEach(b=>b.style.transform='scaleY(.08)');clone.removeAttribute('style');clone.setAttribute('style',node.getAttribute('style')||'');clone.style.setProperty('--fs-audio-level','0');clone.style.maxHeight='none';clone.style.height='auto';clone.style.overflow='visible';
  let css='';for(const sheet of document.styleSheets){try{for(const rule of sheet.cssRules||[]){if(rule.cssText.includes('.fs-')||/^@keyframes fs-/.test(rule.cssText))css+=rule.cssText+'\n';}}catch{}}
  const markup=clone.outerHTML.replace(/data-fs-export-audio="local"/g,()=> 'src="'+escape(originalMedia.current.audioSrc||'')+'"');
  const script=`
document.querySelectorAll('[data-fs-toggle="menu"]').forEach(b=>{b.addEventListener('click',()=>{const h=b.closest('header'),v=h.dataset.open!=='true';h.dataset.open=v;b.setAttribute('aria-expanded',v)});document.addEventListener('keydown',e=>{if(e.key==='Escape'&&b.closest('header').dataset.open==='true'){b.closest('header').dataset.open='false';b.setAttribute('aria-expanded','false');b.focus()}})});
document.querySelectorAll('.fs-nav a').forEach(a=>a.addEventListener('click',()=>{const h=a.closest('header');h.dataset.open='false';h.querySelector('button')?.setAttribute('aria-expanded','false');const target=document.getElementById(a.hash.slice(1));if(target){target.tabIndex=-1;target.focus({preventScroll:true})}}));
const audioGraphs=[];
document.querySelectorAll('audio').forEach(audio=>{let graph=null,frame=0;const root=audio.closest('[data-fs-root]'),media=matchMedia('(prefers-reduced-motion: reduce)'),bars=[...root.querySelectorAll('.fs-spectrum i')];function reset(){cancelAnimationFrame(frame);frame=0;root.style.setProperty('--fs-audio-level','0');bars.forEach(b=>b.style.transform='scaleY(.08)')}function tick(){if(audio.paused||media.matches||document.hidden){reset();return}if(graph){graph.analyser.getByteFrequencyData(graph.data);let sum=0;bars.forEach((b,i)=>{const v=graph.data[i*4] /255;sum+=v;b.style.transform='scaleY('+Math.max(.08,v)+')'});root.style.setProperty('--fs-audio-level',String(sum/Math.max(1,bars.length)))}frame=requestAnimationFrame(tick)}async function start(){root.dataset.playing='true';root.dataset.paused='false';try{if(!graph){const A=window.AudioContext||window.webkitAudioContext;if(!A)return;const ctx=new A,analyser=ctx.createAnalyser(),source=ctx.createMediaElementSource(audio);analyser.fftSize=256;source.connect(analyser);analyser.connect(ctx.destination);graph={ctx,analyser,source,data:new Uint8Array(analyser.frequencyBinCount)};audioGraphs.push(graph)}await graph.ctx.resume();reset();tick()}catch{}}audio.addEventListener('play',start);audio.addEventListener('pause',()=>{root.dataset.playing='false';reset();graph?.ctx.suspend().catch(()=>{})});audio.addEventListener('ended',reset);media.addEventListener('change',()=>{if(media.matches)reset();else if(!audio.paused)tick()});document.addEventListener('visibilitychange',()=>{if(document.hidden)reset();else if(!audio.paused)tick()})});
addEventListener('pagehide',()=>audioGraphs.forEach(g=>{g.source.disconnect();g.analyser.disconnect();g.ctx.close().catch(()=>{})}));
function progress(){document.querySelectorAll('[data-fs-reading]').forEach(p=>{const root=p.closest('[data-fs-root]'),rect=root.getBoundingClientRect(),total=root.scrollHeight-innerHeight,value=Math.max(0,Math.min(1,-rect.top/Math.max(1,total)));p.style.transform='scaleX('+value+')';let chapter=0;root.querySelectorAll('[data-fs-chapter]').forEach((node,i)=>{if(node.getBoundingClientRect().top<innerHeight*.5)chapter=i});root.dataset.chapter=chapter})}addEventListener('scroll',progress,{passive:true});addEventListener('resize',progress);progress();`;
  return{filename:'fluid-'+String(title).toLowerCase().replace(/[^a-z0-9]+/g,'-').slice(0,45)+'.html',mime:'text/html',data:'<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+escape(title)+'</title><style>html{scroll-behavior:smooth}@media(prefers-reduced-motion:reduce){html{scroll-behavior:auto}}body{margin:0;background:#101112}*{box-sizing:border-box}'+css+'</style></head><body>'+markup+'<script>'+script+'<'+'/script></body></html>'};
 }});return()=>onExportReady(null);},[ref,title,onExportReady]);
}
export function SectionImage({src,seed,color,secondary,alt,className=''}){return <img className={'fs-image '+className} src={src||artData(seed,color,secondary)} alt={alt} loading="lazy"/>;}
export function sectionStyle(color,secondary){return{'--fs-accent':colour(color),'--fs-secondary':colour(secondary,'#9fcbff')};}

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
