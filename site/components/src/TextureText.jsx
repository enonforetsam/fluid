import React,{useCallback,useRef} from 'react';
import {useAnimatedCanvas,useExportReady,drawArt,canvasPNG,fittedText,clamp} from './shared/art-kit.jsx';
export default function TextureText({text='FEEL\nSOMETHING.',color='#f2aa86',secondary='#a799e1',seed=42,look='grain',weight=900,paused=false,replayKey=0,onExportReady}){
  const canvas=useRef(null),mask=useRef(null);
  const draw=useCallback((ctx,w,h,t)=>{
    const key=[w,h,text,weight].join('|');
    if(mask.current?.key!==key){const layer=document.createElement('canvas');layer.width=w;layer.height=h;const c=layer.getContext('2d');c.fillStyle='#fff';c.textBaseline='middle';c.textAlign='center';const lines=String(text).split('\n').slice(0,4),lh=Math.min(h*.7/lines.length,w*.22);for(let i=0;i<lines.length;i++){fittedText(c,lines[i],w*.94,lh,clamp(weight,400,900));c.fillText(lines[i],w/2,h/2+(i-(lines.length-1)/2)*lh*1.05,w*.94);}mask.current={key,canvas:layer};}
    ctx.clearRect(0,0,w,h);drawArt(ctx,w,h,t,{color,secondary,seed,look});ctx.globalCompositeOperation='destination-in';ctx.drawImage(mask.current.canvas,0,0);ctx.globalCompositeOperation='source-over';
  },[text,color,secondary,seed,look,weight]);
  useAnimatedCanvas(canvas,draw,{paused,replayKey});useExportReady(onExportReady,{png:()=>{const out=document.createElement('canvas');out.width=1200;out.height=800;draw(out.getContext('2d'),1200,800,0);return canvasPNG(out,'texture-text.png');}});
  return <div className="fv-root fv-texture"><span className="fv-eyebrow">WORDS WITH A LITTLE MORE FEELING</span><canvas ref={canvas} className="fv-texture-canvas" role="img" aria-label={String(text).replace(/\n/g,' ')}/><p className="fv-caption">Make your words a material.</p></div>;
}
