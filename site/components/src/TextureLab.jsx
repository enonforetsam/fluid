import { useEffect, useMemo, useState } from 'react';
import { ToolShell, SelectField, RangeField, ColorField, useExportReady } from './shared/tool-core.jsx';
import { textureSVG, svgURL, createCanvas, canvasPNG } from './shared/tool-art.js';
import { decodeImage } from './shared/tool-upload.js';

/** Original, repeatable textures. SVG/CSS remain resolution independent; PNG is rendered at the selected size. */
export default function TextureLab({ seed:initialSeed=42, color:initialColor='#201c22', secondary='#fff3df', onExportReady }) {
  const [kind,setKind]=useState('paper'),[color,setColor]=useState(initialColor),[background,setBackground]=useState(secondary),[density,setDensity]=useState(45),[scale,setScale]=useState(12),[opacity,setOpacity]=useState(.24),[seed,setSeed]=useState(initialSeed),[resolution,setResolution]=useState('1024');
  useEffect(()=>setColor(initialColor),[initialColor]);
  useEffect(()=>setBackground(secondary),[secondary]);
  useEffect(()=>setSeed(initialSeed),[initialSeed]);
  const settings={kind,color,background,density,scale,opacity,seed,resolution:Number(resolution)};
  const svg=useMemo(()=>textureSVG(settings),[kind,color,background,density,scale,opacity,seed]),url=svgURL(svg);
  const sizedSVG=svg.replace('width="512" height="512"','width="'+resolution+'" height="'+resolution+'"');
  const exports={
    png:async()=>{const image=await decodeImage(svgURL(sizedSVG)),canvas=createCanvas(Number(resolution),Number(resolution));canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);return canvasPNG(canvas,'fluid-'+kind+'-'+resolution+'.png');},
    svg:()=>({filename:'fluid-'+kind+'.svg',mime:'image/svg+xml',data:sizedSVG}),
    css:()=>({filename:'fluid-'+kind+'.css',mime:'text/css',data:'/* Fluid Texture Lab '+JSON.stringify(settings)+' */\n.fluid-texture {\n  background-color: '+background+';\n  background-image: url("'+url+'");\n  background-repeat: repeat;\n  background-size: 512px 512px;\n}\n'}),
    json:()=>({filename:'fluid-texture.json',mime:'application/json',data:JSON.stringify(settings,null,2)})
  };
  useExportReady(onExportReady,exports);
  return <ToolShell title="Texture Lab" description="Make tactile paper, grain, halftone, contour and print textures. Export a repeatable SVG/CSS tile or a full-size PNG." exports={exports} controls={<>
    <SelectField label="Texture" value={kind} onChange={setKind} options={['paper','grain','halftone','contour','print']}/>
    <ColorField label="Ink" value={color} onChange={setColor}/><ColorField label="Paper" value={background} onChange={setBackground}/>
    <RangeField label="Density" value={density} onChange={setDensity} min={5} max={100}/><RangeField label="Mark scale" value={scale} onChange={setScale} min={4} max={48} unit=" px"/>
    <RangeField label="Ink opacity" value={opacity} onChange={setOpacity} min={.05} max={1} step={.05}/><RangeField label="Seed" value={seed} onChange={setSeed} min={1} max={999}/>
    <SelectField label="PNG / SVG size" value={resolution} onChange={setResolution} options={['512','1024','2048']}/>
  </>}><img src={url} width="512" height="512" alt={kind+' texture in '+color+' on '+background}/><p className="ft-preview-caption">Repeatable 512 × 512 tile · PNG export {resolution} × {resolution}</p></ToolShell>;
}
