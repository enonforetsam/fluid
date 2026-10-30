// Original Fluid poster renderer. Pure Canvas2D; also embedded verbatim in standalone HTML.
export function drawPoster(ctx, config, time = 0, image = null) {
  const w = ctx.canvas.width, h = ctx.canvas.height, sx = w / 900, sy = h / 600;
  ctx.save(); ctx.scale(sx, sy); ctx.fillStyle = config.background; ctx.fillRect(0, 0, 900, 600);
  const speed = Number(config.speed) || 1, phase = time * speed;
  ctx.save(); ctx.beginPath(); ctx.rect(350, 36, 514, 528); ctx.clip();
  if (image) {
    ctx.save(); ctx.translate(607, 300); ctx.rotate(config.motion === 'orbit' ? Math.sin(phase * .4) * .12 : 0);
    const zoom = config.motion === 'pulse' ? 1.06 + Math.sin(phase) * .045 : 1.08;
    const ratio = Math.max(514 / image.naturalWidth, 528 / image.naturalHeight) * zoom;
    const iw = image.naturalWidth * ratio, ih = image.naturalHeight * ratio;
    ctx.drawImage(image, -iw / 2 + (config.motion === 'drift' ? Math.sin(phase * .5) * 18 : 0), -ih / 2, iw, ih); ctx.restore();
  }
  ctx.globalCompositeOperation = 'screen';
  for (let i = 0; i < 5; i++) {
    const x = 590 + Math.cos(phase * .35 + i * 1.25) * 140, y = 300 + Math.sin(phase * .5 + i * 1.25) * 150;
    ctx.strokeStyle = i % 2 ? config.color : config.secondary; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(x, y, 120 + i * 18, 55 + i * 8, phase * .12 + i, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.restore(); ctx.fillStyle = config.color; ctx.textAlign = 'left';
  ctx.font = '600 12px sans-serif'; ctx.fillText('FLUID / INDEPENDENT EXPRESSION', 40, 54);
  ctx.font = '800 85px sans-serif'; ctx.textBaseline = 'top';
  const words = String(config.title || 'STAY CURIOUS').slice(0, 120).split(/\s+/); let line = '', y = 155, lines = 0;
  for (const word of words) {
    const candidate = line ? line + ' ' + word : word;
    if (ctx.measureText(candidate).width > 750 && line) { ctx.fillText(line, 36, y, 800); y += 82; lines++; line = word; if (lines >= 3) break; }
    else line = candidate;
  }
  if (lines < 3) ctx.fillText(line, 36, y, 800);
  ctx.font = '400 18px sans-serif'; ctx.fillStyle = config.secondary;
  const text = String(config.text || '').slice(0, 180); let body = '', bodyY = 458;
  for (const word of text.split(/\s+/)) { const candidate = body ? body + ' ' + word : word; if (ctx.measureText(candidate).width > 270 && body) { ctx.fillText(body, 40, bodyY, 270); bodyY += 25; body = word; if (bodyY > 530) break; } else body = candidate; }
  if (bodyY <= 530) ctx.fillText(body, 40, bodyY, 270);
  ctx.font = '500 12px sans-serif'; ctx.fillStyle = config.color; ctx.fillText('EDITION 001', 40, 562); ctx.textAlign = 'right'; ctx.fillText('MAKE SOMETHING MOVE ↗', 860, 562); ctx.restore();
}
export function posterHTML(config) {
  const settings = JSON.stringify(config).replace(/</g, '\\u003c');
  return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Fluid animated poster</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#101114;color:#fff;font:16px system-ui}main{width:min(100%,1100px)}canvas{display:block;width:100%;height:auto}button{margin:16px;padding:12px 20px;border:1px solid #888;border-radius:24px;background:#222;color:#fff;font:inherit;cursor:pointer;min-height:44px}button:focus-visible{outline:3px solid #fff;outline-offset:3px}</style><main><canvas width="900" height="600" role="img" aria-label="Animated typographic poster"></canvas><button type="button">Pause motion</button></main><script>const draw=${drawPoster.toString()};const config=${settings};const canvas=document.querySelector('canvas'),ctx=canvas.getContext('2d'),button=document.querySelector('button'),query=matchMedia('(prefers-reduced-motion: reduce)');const image=new Image();let frame=0,last=-Infinity,paused=query.matches,time=0;function render(){draw(ctx,config,time,image.complete&&image.naturalWidth?image:null)}function tick(now){if(now-last>=1000/30){time+=1/30;last=now;render()}frame=requestAnimationFrame(tick)}function update(){cancelAnimationFrame(frame);button.textContent=paused?'Play motion':'Pause motion';if(!paused&&!document.hidden)frame=requestAnimationFrame(tick);render()}image.onload=update;image.src=config.imageSrc;button.onclick=()=>{paused=!paused;update()};document.addEventListener('visibilitychange',update);query.addEventListener('change',()=>{paused=query.matches;update()});window.addEventListener('pagehide',()=>cancelAnimationFrame(frame));update();<\/script></html>`;
}
