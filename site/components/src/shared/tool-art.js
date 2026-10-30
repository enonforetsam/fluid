/** Original, deterministic Canvas/SVG artwork; no network assets or runtime dependencies. */
export const PALETTES = {
  Ember: ['#201c22','#fff3df','#fa8356','#a79bfa','#b7d8bd'],
  Monsoon: ['#171d32','#e6efff','#88cbef','#c7a6ed','#e5b2bd'],
  Saffron: ['#fff4d9','#29271f','#bd4e28','#817743','#e6c877'],
  Orchid: ['#291b34','#faecff','#e2a2cf','#bba8fa','#edc886'],
  Moss: ['#15291f','#edf4df','#b6d17e','#e8b58a','#8dcac0']
};
export function resolvePalette(name='Ember',color,secondary) { const colors=[...(PALETTES[name]||PALETTES.Ember)];if(/^#[\da-f]{6}$/i.test(color||''))colors[2]=color;if(/^#[\da-f]{6}$/i.test(secondary||''))colors[3]=secondary;return colors; }
export function clamp(value, min, max) { return Math.max(min, Math.min(max, Number(value) || 0)); }
export function rng(seed = 42) { let state = Number(seed) >>> 0; return () => { state = (state * 1664525 + 1013904223) >>> 0; return state / 4294967296; }; }
export function rgb(hex) { const value = /^#[\da-f]{6}$/i.test(hex) ? hex : '#000000'; return [1,3,5].map(i=>parseInt(value.slice(i,i+2),16)); }
export function hex(channels) { return '#' + channels.map(value=>Math.round(clamp(value,0,255)).toString(16).padStart(2,'0')).join(''); }
export function mix(a,b,amount) { const x=rgb(a), y=rgb(b); return hex(x.map((v,i)=>v+(y[i]-v)*amount)); }
export function luminance(color) { const values=rgb(color).map(v=>{const c=v/255;return c<=.04045?c/12.92:((c+.055)/1.055)**2.4;}); return values[0]*.2126+values[1]*.7152+values[2]*.0722; }
export function contrast(a,b) { const x=luminance(a), y=luminance(b); return (Math.max(x,y)+.05)/(Math.min(x,y)+.05); }
export function readable(bg) { return contrast('#16171b',bg)>=contrast('#ffffff',bg)?'#16171b':'#ffffff'; }
export function themeTokens(palette) {
  const bg=palette[0], text=readable(bg), accent=palette[2], surface=mix(bg,text,.07), muted=mix(bg,text,.72);
  return { background:bg, surface, text, muted, accent, 'accent-text':readable(accent), border:mix(bg,text,.38), secondary:palette[3], highlight:palette[4] };
}
export function tokenCSS(palette, selector=':root') { return selector+' {\n'+Object.entries(themeTokens(palette)).map(([key,value])=>'  --fluid-'+key+': '+value+';').join('\n')+'\n  --fluid-radius: 18px;\n  --fluid-space: 8px;\n  --fluid-font: system-ui, sans-serif;\n}'; }
export function escapeHTML(value) { return String(value).replace(/[&<>"']/g, char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char])); }
export function safeJSON(value) { return JSON.stringify(value).replace(/</g,'\\u003c').replace(/>/g,'\\u003e').replace(/&/g,'\\u0026'); }
export function fullHTML(title, body, css, script='', settings={}) {
  return '<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+escapeHTML(title)+'</title><style>*,*::before,*::after{box-sizing:border-box}body{margin:0;font-family:system-ui,sans-serif}button,input,select{font:inherit}button,a,input,select{min-height:44px}a:focus-visible,button:focus-visible,input:focus-visible,select:focus-visible{outline:3px solid currentColor;outline-offset:4px}'+css+'</style></head><body>'+body+'<script id="fluid-settings" type="application/json">'+safeJSON(settings)+'</script>'+(script?'<script>'+script.replace(/<\/script/gi,'<\\/script')+'</script>':'')+'</body></html>';
}
export function svgURL(svg) { return 'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg); }
export function drawCover(ctx,image,x,y,w,h) { if(!image)return;const ratio=Math.max(w/image.naturalWidth,h/image.naturalHeight),sw=w/ratio,sh=h/ratio;ctx.drawImage(image,(image.naturalWidth-sw)/2,(image.naturalHeight-sh)/2,sw,sh,x,y,w,h); }
export function drawContain(ctx,image,x,y,w,h) { if(!image)return;const ratio=Math.min(w/image.naturalWidth,h/image.naturalHeight),dw=image.naturalWidth*ratio,dh=image.naturalHeight*ratio;ctx.drawImage(image,x+(w-dw)/2,y+(h-dh)/2,dw,dh); }
export function canvasPNG(canvas,filename) { if(!canvas)throw new Error('The preview is still loading. Try again.');return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve({filename,mime:'image/png',data:blob}):reject(new Error('PNG export failed. Try a smaller image.')),'image/png')); }
export function createCanvas(width,height) { const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;return canvas; }
export function textLines(ctx,text,width,maxLines=5) {
  const words=String(text).trim().split(/\s+/), lines=[];let line='';
  for(const word of words){const parts=[];let part='';for(const ch of word){if(ctx.measureText(part+ch).width>width&&part){parts.push(part);part=ch;}else part+=ch;}if(part)parts.push(part);
    for(const chunk of parts){const next=line?line+' '+chunk:chunk;if(ctx.measureText(next).width>width&&line){lines.push(line);line=chunk;}else line=next;}}
  if(line)lines.push(line);if(lines.length>maxLines){lines.length=maxLines;while(ctx.measureText(lines[maxLines-1]+'…').width>width&&lines[maxLines-1].length)lines[maxLines-1]=lines[maxLines-1].slice(0,-1);lines[maxLines-1]+='…';}return lines;
}
export function drawArt(ctx,w,h,{palette=PALETTES.Ember,seed=42,style='bloom',time=0}={}) {
  const random=rng(seed), diagonal=Math.hypot(w,h);ctx.fillStyle=palette[0];ctx.fillRect(0,0,w,h);
  if(style==='contour'){
    ctx.lineWidth=Math.max(1,w/700);for(let layer=0;layer<40;layer++){ctx.beginPath();for(let x=0;x<=w;x+=w/70){const y=h*.5+Math.sin(x/w*8+layer*.14+time*.2)*h*.13+(layer-20)*h/28; x===0?ctx.moveTo(x,y):ctx.lineTo(x,y);}ctx.strokeStyle=palette[2+(layer%3)];ctx.globalAlpha=.35+layer/100;ctx.stroke();}ctx.globalAlpha=1;return;
  }
  if(style==='chrome'){
    const gradient=ctx.createLinearGradient(0,0,w,h);[[0,palette[0]],[.18,palette[2]],[.29,palette[1]],[.33,palette[0]],[.48,palette[3]],[.6,palette[1]],[.64,palette[0]],[.82,palette[2]],[1,palette[1]]].forEach(([stop,color])=>gradient.addColorStop(stop,color));ctx.fillStyle=gradient;ctx.fillRect(0,0,w,h);
    for(let i=0;i<7;i++){ctx.beginPath();ctx.ellipse(w*(i/6)+Math.sin(time*.4+i)*w*.04,h*.52,w*.19,h*.72,.4+Math.sin(time*.2)*.2,0,Math.PI*2);ctx.lineWidth=w*.025;ctx.strokeStyle=i%2?palette[0]+'99':palette[1]+'aa';ctx.stroke();}return;
  }
  for(let i=0;i<7;i++){const x=random()*w+Math.sin(time*.3+i)*w*.12,y=random()*h+Math.cos(time*.25+i)*h*.1,r=diagonal*(.18+random()*.25);const g=ctx.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,palette[2+i%3]+'e0');g.addColorStop(.5,palette[2+i%3]+'70');g.addColorStop(1,palette[2+i%3]+'00');ctx.fillStyle=g;ctx.fillRect(0,0,w,h);}
  if(style==='ink'){ctx.globalCompositeOperation='multiply';for(let i=0;i<12;i++){ctx.beginPath();ctx.ellipse(random()*w,random()*h,w*(.03+random()*.1),h*(.03+random()*.12),random()*Math.PI,0,Math.PI*2);ctx.fillStyle=palette[i%5]+'bb';ctx.fill();}ctx.globalCompositeOperation='source-over';}
  if(style==='grain'||style==='ink'){for(let i=0;i<1600;i++){ctx.fillStyle=i%2?palette[1]+'28':palette[0]+'40';ctx.fillRect(random()*w,random()*h,1+random()*2,1+random()*2);}}
}
export function textureSVG({kind='paper',color='#201c22',background='#fff3df',density=45,scale=12,seed=42,opacity=.24}={}) {
  const random=rng(seed), size=512;let marks='';const count=Math.round(clamp(density,5,100)*14), alpha=clamp(opacity,0,1), step=clamp(scale,4,80);
  if(kind==='paper'){const channels=rgb(color).map(v=>(v/255).toFixed(4));marks='<filter id="paper"><feTurbulence type="fractalNoise" baseFrequency="'+(1/step).toFixed(3)+'" numOctaves="3" seed="'+Math.round(seed)+'" stitchTiles="stitch"/><feColorMatrix type="matrix" values="0 0 0 0 '+channels[0]+' 0 0 0 0 '+channels[1]+' 0 0 0 0 '+channels[2]+' .333 .333 .333 0 0"/></filter><rect width="512" height="512" filter="url(#paper)" opacity="'+(alpha*clamp(density,5,100)/50).toFixed(3)+'"/>'; }
  else if(kind==='grain'){for(let i=0;i<count;i++)marks+='<circle cx="'+(random()*size).toFixed(2)+'" cy="'+(random()*size).toFixed(2)+'" r="'+(.3+random()*step/8).toFixed(2)+'"/>';}
  else if(kind==='halftone'){for(let y=0;y<size;y+=step)for(let x=0;x<size;x+=step)marks+='<circle cx="'+x+'" cy="'+y+'" r="'+(step*clamp(density,5,100)/220).toFixed(2)+'"/>';}
  else if(kind==='contour'){for(let y=-100;y<612;y+=step){let points='';for(let x=-16;x<=528;x+=8)points+=x+','+(y+Math.sin(x/90+seed*.1+y/100)*step*2).toFixed(1)+' ';marks+='<polyline points="'+points+'" fill="none" stroke="'+color+'" stroke-width="'+(density/40).toFixed(2)+'"/>';}}
  else {for(let y=-512;y<1024;y+=step)marks+='<path d="M0 '+y+'L512 '+(y+512)+'" stroke="'+color+'" stroke-width="'+(density/35).toFixed(2)+'"/>';for(let i=0;i<count/2;i++)marks+='<rect x="'+(random()*512).toFixed(1)+'" y="'+(random()*512).toFixed(1)+'" width="2" height="1"/>';}
  return '<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512"><rect width="512" height="512" fill="'+background+'"/><g fill="'+color+'" opacity="'+(kind==='paper'?1:alpha)+'">'+marks+'</g></svg>';
}
export function extractPalette(image,count=5) {
  const canvas=createCanvas(128,128),ctx=canvas.getContext('2d',{willReadFrequently:true});drawCover(ctx,image,0,0,128,128);const bytes=ctx.getImageData(0,0,128,128).data,buckets=new Map();
  for(let i=0;i<bytes.length;i+=4){if(bytes[i+3]<128)continue;const c=[bytes[i],bytes[i+1],bytes[i+2]],key=c.map(v=>Math.round(v/32)*32).join(',');const b=buckets.get(key)||{count:0,sum:[0,0,0]};b.count++;c.forEach((v,j)=>b.sum[j]+=v);buckets.set(key,b);}
  const picked=[];for(const bucket of [...buckets.values()].sort((a,b)=>b.count-a.count)){const c=bucket.sum.map(v=>v/bucket.count);if(picked.every(other=>Math.hypot(...c.map((v,i)=>v-rgb(other)[i]))>55))picked.push(hex(c));if(picked.length===count)break;}
  if(!picked.length)throw new Error('No visible pixels found. Choose an opaque image.');while(picked.length<count)picked.push(mix(picked[0],picked.length%2?'#ffffff':'#000000',.2+picked.length*.12));return picked;
}
