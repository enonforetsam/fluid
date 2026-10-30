const textCache = new Map();
export async function readSource(file, signal) {
  if (textCache.has(file)) return textCache.get(file);
  const response = await fetch(file, {signal});
  if (!response.ok) throw new Error('Source unavailable');
  const value = await response.text();
  if (/^\s*<!doctype/i.test(value)) throw new Error('Source unavailable');
  textCache.set(file, value);
  return value;
}
export async function copyText(value) {
  const active = document.activeElement;
  try { if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(value); return; } } catch {}
  const field = document.createElement('textarea');
  field.value = value; field.className = 'cp-fallback-copy'; field.setAttribute('aria-label', 'Text to copy');
  document.body.append(field); field.focus(); field.select();
  let copied = false;
  try { copied = document.execCommand('copy'); } finally { field.remove(); active?.focus(); }
  if (!copied) throw new Error('Clipboard unavailable');
}
export function downloadBlob(filename, blob) {
  const url = URL.createObjectURL(blob), link = document.createElement('a');
  link.href = url; link.download = filename.replace(/[^\w. -]/g, '-');
  document.body.append(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}
export function downloadText(filename, text) { downloadBlob(filename, new Blob([text], {type:'text/plain;charset=utf-8'})); }
export async function downloadExport(fn) {
  const result = await fn();
  if (!result || !result.filename || result.data == null) throw new Error('The export is not ready yet. Try again in a moment.');
  const blob = result.data instanceof Blob ? result.data : new Blob([result.data], {type:result.mime || 'application/octet-stream'});
  if (!blob.size) throw new Error('The export was empty. Try again.');
  downloadBlob(result.filename, blob);
  return result.filename;
}
function cleanSvg(source) {
  if (/<!DOCTYPE|<!ENTITY/i.test(source)) throw new Error('Choose an SVG without document types or entities.');
  const doc = new DOMParser().parseFromString(source, 'image/svg+xml');
  if (doc.querySelector('parsererror') || doc.documentElement.localName !== 'svg') throw new Error('That SVG could not be read.');
  for (const node of doc.querySelectorAll('*')) {
    if (['script','foreignobject','iframe','object','embed','audio','video','link','style'].includes(node.localName.toLowerCase())) throw new Error('Choose a simple SVG without scripts, embedded pages or stylesheets.');
    for (const attr of node.attributes) {
      const name = attr.localName.toLowerCase(), value = attr.value.trim();
      if (name.startsWith('on')) throw new Error('Choose an SVG without event handlers.');
      if (['href','src'].includes(name) && value && !value.startsWith('#') && !/^data:image\/(?:png|jpeg|webp);base64,/i.test(value)) throw new Error('Choose an SVG with embedded artwork and no external links.');
      if (/url\s*\(/i.test(value) && !/^((?!url\s*\().|url\(\s*['"]?#[\w:.-]+['"]?\s*\))*$/i.test(value)) throw new Error('Choose an SVG without external image or font references.');
      if (/javascript:|@import|expression\s*\(/i.test(value)) throw new Error('That SVG contains unsupported active content.');
    }
  }
  return new XMLSerializer().serializeToString(doc.documentElement);
}
function dataUrl(file) { return new Promise((resolve,reject) => { const reader = new FileReader(); reader.onload=()=>resolve(reader.result); reader.onerror=()=>reject(new Error('The file could not be read.')); reader.readAsDataURL(file); }); }
export async function readMedia(file, kind) {
  if (!file) return '';
  if (file.size > 25 * 1024 * 1024) throw new Error('Choose a file smaller than 25 MB.');
  if (kind === 'audio') {
    if (!/^audio\//.test(file.type) && !/\.(mp3|wav|ogg|m4a|aac|flac)$/i.test(file.name)) throw new Error('Choose an MP3, WAV, OGG or another supported audio file.');
    return dataUrl(file);
  }
  let url;
  if (file.type === 'image/svg+xml' || /\.svg$/i.test(file.name)) url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(cleanSvg(await file.text()));
  else {
    if (!/^image\/(png|jpeg|webp|gif|avif)$/.test(file.type)) throw new Error('Choose a PNG, JPG, WebP, GIF, AVIF or simple SVG image.');
    url = await dataUrl(file);
  }
  const image = await new Promise((resolve,reject) => {
    const img = new Image(), timeout = setTimeout(()=>{ img.src=''; reject(new Error('The image took too long to decode.')); },15000);
    img.onload=()=>{clearTimeout(timeout);resolve(img);}; img.onerror=()=>{clearTimeout(timeout);reject(new Error('That image could not be decoded.'));}; img.src=url;
  });
  if (!image.naturalWidth || !image.naturalHeight || image.naturalWidth * image.naturalHeight > 40000000) throw new Error('Choose an image with fewer than 40 million pixels.');
  const scale = Math.min(1,2048/Math.max(image.naturalWidth,image.naturalHeight)), canvas=document.createElement('canvas');
  canvas.width=Math.max(1,Math.round(image.naturalWidth*scale)); canvas.height=Math.max(1,Math.round(image.naturalHeight*scale));
  canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);
  return canvas.toDataURL('image/png');
}
export function cleanSettings(item, raw = {}) {
  if(!raw || typeof raw!=='object' || Array.isArray(raw)) raw={};
  const result={...item.defaults};
  for(const key of ['color','secondary']) if(key in result && /^#[\da-f]{6}$/i.test(raw[key]||'')) result[key]=raw[key];
  if('seed' in result && Number.isFinite(Number(raw.seed))) result.seed=Math.max(1,Math.min(999,Math.round(Number(raw.seed))));
  for (const control of item.controls || []) {
    const value=raw[control.key]; if(value==null || ['image','audio'].includes(control.type)) continue;
    if (control.type==='checkbox' && typeof value==='boolean') result[control.key]=value;
    else if (control.type==='range' && Number.isFinite(Number(value))) result[control.key]=Math.max(control.min,Math.min(control.max,Number(value)));
    else if (control.type==='color' && /^#[\da-f]{6}$/i.test(value)) result[control.key]=value;
    else if (control.type==='select' && control.options.some(option=>(option.value??option)===value)) result[control.key]=value;
    else if (['text','textarea'].includes(control.type) && typeof value==='string') result[control.key]=value.slice(0,control.maxLength || (control.type==='textarea'?2400:180));
  }
  return result;
}
export function locationPreset(catalogue) {
  const params=new URLSearchParams(location.search), item=catalogue.find(entry=>entry.id===params.get('component')) || catalogue.find(entry=>entry.id==='fluid-hero') || catalogue[0];
  let settings={}; try {const raw=params.get('settings'); if(raw && raw.length<8000) settings=JSON.parse(raw);} catch {}
  return {item,value:cleanSettings(item,settings)};
}
export function presetUrl(item,value) {
  const url=new URL(location.href), settings={};
  url.hash='';
  for(const key of ['color','secondary','seed']) if(key in item.defaults && value[key]!==item.defaults[key]) settings[key]=value[key];
  for(const control of item.controls || []) if(!['image','audio'].includes(control.type) && value[control.key]!==item.defaults[control.key]) settings[control.key]=value[control.key];
  url.searchParams.set('component',item.id);
  const serialised=JSON.stringify(settings); if(serialised.length>7500) throw new Error('This preset has too much text for a link. Shorten the copy first.');
  if(Object.keys(settings).length) url.searchParams.set('settings',serialised); else url.searchParams.delete('settings');
  return url;
}
const crcTable=Uint32Array.from({length:256},(_,n)=>{for(let j=0;j<8;j++)n=n&1?0xedb88320^(n>>>1):n>>>1;return n>>>0;});
function crc32(data) {let n=0xffffffff;for(const byte of data)n=crcTable[(n^byte)&255]^(n>>>8);return (n^0xffffffff)>>>0;}
export function storedZip(files) {
  const encoder=new TextEncoder(), local=[], central=[]; let offset=0;
  for(const [filename,content] of files) {
    const name=encoder.encode(filename), data=typeof content==='string'?encoder.encode(content):content, crc=crc32(data);
    const header=new Uint8Array(30+name.length), view=new DataView(header.buffer);
    view.setUint32(0,0x04034b50,true); view.setUint16(4,20,true); view.setUint16(6,0x800,true);view.setUint16(12,33,true);
    view.setUint32(14,crc,true);view.setUint32(18,data.length,true);view.setUint32(22,data.length,true);view.setUint16(26,name.length,true);header.set(name,30);
    local.push(header,data);
    const record=new Uint8Array(46+name.length), recordView=new DataView(record.buffer);
    recordView.setUint32(0,0x02014b50,true);recordView.setUint16(4,20,true);recordView.setUint16(6,20,true);recordView.setUint16(8,0x800,true);recordView.setUint16(14,33,true);
    recordView.setUint32(16,crc,true);recordView.setUint32(20,data.length,true);recordView.setUint32(24,data.length,true);recordView.setUint16(28,name.length,true);recordView.setUint32(42,offset,true);record.set(name,46);central.push(record);offset+=header.length+data.length;
  }
  const size=central.reduce((sum,item)=>sum+item.length,0), end=new Uint8Array(22), view=new DataView(end.buffer);
  view.setUint32(0,0x06054b50,true);view.setUint16(8,files.length,true);view.setUint16(10,files.length,true);view.setUint32(12,size,true);view.setUint32(16,offset,true);
  return new Blob([...local,...central,end],{type:'application/zip'});
}
export async function sourceBundle(item, usage) {
  const manifest=JSON.parse(await readSource('components/source-manifest.json'));
  const paths=manifest.entries?.[item.id];
  if(manifest.version!==1 || !Array.isArray(paths) || !paths.length || paths.some(path=>!/^components\/[\w./-]+$/.test(path)||path.includes('..'))) throw new Error('The source bundle is unavailable.');
  const files=await Promise.all(paths.map(async path=>[path,new Uint8Array(await (async()=>{const r=await fetch(path);if(!r.ok)throw new Error('A source file could not be loaded.');return r.arrayBuffer();})())]));
  files.push(['Example.jsx',usage],['README.md',`# ${item.name}\n\nOriginal Fluid React source. Keep the components folder structure so relative helper imports work.\n\nUse in an existing React project (React and React DOM 18+). Copy Example.jsx and the components directory into your source folder, then render Example. No API key or remote service is required.\n\nFor Next.js App Router, add 'use client'; at the start of Example.jsx.\n\n${item.notes||''}\n\nThe MIT license is in components/LICENSE.\n`]);
  return storedZip(files);
}
