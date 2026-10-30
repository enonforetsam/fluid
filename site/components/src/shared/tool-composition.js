import { PALETTES, resolvePalette, drawArt, drawCover, drawContain, readable, textLines, createCanvas, fullHTML, escapeHTML } from './tool-art.js';
export function safeLink(value) { const link=String(value||'#details').trim();return /^(?:https?:\/\/|mailto:|#|\/(?!\/)|\.\.?\/)/i.test(link)?link:'#details'; }
export function compositionBackground(ctx,w,h,settings,image){drawArt(ctx,w,h,{palette:resolvePalette(settings.palette,settings.color,settings.secondary),seed:settings.seed,style:settings.art});if(image){ctx.globalAlpha=.72;drawCover(ctx,image,0,0,w,h);ctx.globalAlpha=1;}}
export function drawComposition(ctx,w,h,settings,image,logo){
  const palette=resolvePalette(settings.palette,settings.color,settings.secondary),bg=palette[0],ink=readable(bg),scale=w/1200,pad=72*scale,center=settings.layout==='center',corner=settings.layout==='corner';
  compositionBackground(ctx,w,h,settings,image);
  ctx.fillStyle=bg+(center?'df':corner?'ed':'f2');
  if(center)ctx.fillRect(pad*.5,pad*.5,w-pad,h-pad);
  else if(corner)ctx.fillRect(0,h*.32,w*.82,h*.68);
  else ctx.fillRect(0,0,w*.65,h);
  const left=center?pad:pad, textWidth=center?w-pad*2:w*(corner?.7:.52),top=corner?h*.4:pad;
  ctx.fillStyle=ink;ctx.textAlign=center?'center':'left';const anchor=center?w/2:left;
  if(logo){ctx.save();drawContain(ctx,logo,center?w/2-80*scale:left,top-12*scale,160*scale,44*scale);ctx.restore();}
  else{ctx.font='650 '+(14*scale)+'px system-ui,sans-serif';ctx.fillText(String(settings.label||'FLUID / MAKE SOMETHING').slice(0,56),anchor,top+16*scale);}
  let fontSize=(Number(settings.fontSize)||80)*scale;const fontFamily=settings.font==='serif'?'Georgia,serif':'system-ui,sans-serif',maxTitleLines=settings.type==='hero'?4:3;
  ctx.font='700 '+fontSize+'px '+fontFamily;
  let lines=textLines(ctx,settings.title||'Make something that feels like you.',textWidth,99);
  while(lines.length>maxTitleLines&&fontSize>18*scale){fontSize-=scale;ctx.font='700 '+fontSize+'px '+fontFamily;lines=textLines(ctx,settings.title||'Make something that feels like you.',textWidth,99);}
  const lineHeight=fontSize*1.04,titleTop=top+fontSize+42*scale;ctx.fillStyle=ink;
  lines.forEach((line,index)=>ctx.fillText(line,anchor,titleTop+index*lineHeight));
  let nextY=titleTop+(lines.length-1)*lineHeight+38*scale;ctx.font='400 '+(20*scale)+'px system-ui,sans-serif';
  const sublines=textLines(ctx,settings.subtitle||'',textWidth,settings.type==='hero'?3:2);ctx.globalAlpha=.82;sublines.forEach((line,index)=>ctx.fillText(line,anchor,nextY+index*28*scale));ctx.globalAlpha=1;nextY+=sublines.length*28*scale;
  if(settings.type==='hero'&&settings.cta){const buttonText=String(settings.cta).slice(0,40);ctx.font='650 '+(17*scale)+'px system-ui,sans-serif';const buttonW=Math.min(textWidth,ctx.measureText(buttonText+' ↗').width+44*scale),buttonX=center?w/2-buttonW/2:left,buttonY=Math.min(h-80*scale,nextY+22*scale);ctx.fillStyle=palette[2];ctx.beginPath();ctx.roundRect(buttonX,buttonY,buttonW,52*scale,26*scale);ctx.fill();ctx.fillStyle=readable(palette[2]);ctx.textAlign='center';ctx.fillText(buttonText+' ↗',buttonX+buttonW/2,buttonY+33*scale);}
  else if(settings.type==='social'){ctx.textAlign='right';ctx.fillStyle=ink;ctx.font='600 '+(14*scale)+'px system-ui,sans-serif';ctx.fillText(String(settings.footer||'befluid.xyz').slice(0,60),w-pad,h-pad*.6);}
  ctx.textAlign='left';
}
export function renderComposition(settings,image,logo,width,height){const canvas=createCanvas(width,height);drawComposition(canvas.getContext('2d'),width,height,settings,image,logo);return canvas;}
export function heroHTML(settings,image,logoSrc){
  const palette=resolvePalette(settings.palette,settings.color,settings.secondary),bg=palette[0],ink=readable(bg),art=createCanvas(1440,900);compositionBackground(art.getContext('2d'),1440,900,settings,image);
  const centered=settings.layout==='center',corner=settings.layout==='corner';
  const css='body{background:'+bg+';color:'+ink+'}.hero{position:relative;min-height:760px;min-height:min(960px,100svh);display:flex;align-items:'+(corner?'end':'center')+';justify-content:'+(centered?'center':'start')+';background:url("'+art.toDataURL('image/png')+'") center/cover;padding:clamp(20px,5vw,72px)}.hero-content{position:relative;width:'+(centered?'min(100%,900px)':corner?'min(100%,1000px)':'min(65%,820px)')+';background:'+bg+'eb;padding:clamp(24px,4vw,56px);border-radius:24px;text-align:'+(centered?'center':'left')+'}.hero-logo{display:block;width:160px;height:44px;object-fit:contain;margin:'+(centered?'0 auto 28px':'0 0 28px')+'}.label{font-size:12px;letter-spacing:.14em;font-weight:650}h1{font-family:'+(settings.font==='serif'?'Georgia,serif':'system-ui,sans-serif')+';font-size:clamp(36px,6.2vw,'+settings.fontSize+'px);line-height:1.04;letter-spacing:-.05em;margin:30px 0 22px;overflow-wrap:anywhere}p{font-size:clamp(16px,2vw,20px);line-height:1.6;max-width:60ch;margin:'+(centered?'0 auto':'0')+'}.cta{display:inline-flex;align-items:center;justify-content:center;min-height:52px;margin-top:32px;max-width:100%;padding:14px 24px;border-radius:99px;text-decoration:none;overflow-wrap:anywhere;background:'+palette[2]+';color:'+readable(palette[2])+';font-weight:650}.details{padding:clamp(24px,6vw,80px);max-width:1100px;margin:auto}.details h2{font-size:clamp(28px,5vw,48px);letter-spacing:-.04em;line-height:1.1}@media(max-width:700px){.hero{min-height:760px;align-items:center}.hero-content{width:100%}}';
  const body='<main><section class="hero"><div class="hero-content">'+(logoSrc?'<img class="hero-logo" src="'+escapeHTML(logoSrc)+'" alt="'+escapeHTML(settings.label||'Project logo')+'">':'<span class="label">'+escapeHTML(settings.label)+'</span>')+'<h1>'+escapeHTML(settings.title)+'</h1><p>'+escapeHTML(settings.subtitle)+'</p><a class="cta" href="'+escapeHTML(safeLink(settings.href))+'">'+escapeHTML(settings.cta)+' ↗</a></div></section><section id="details" class="details"><h2>Make room for what comes next.</h2><p>This is your next section. The hero, artwork, typography and button above work offline and are ready to become your own page.</p></section></main>';
  return fullHTML(settings.title,body,css,'',settings);
}
