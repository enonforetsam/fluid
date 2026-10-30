import { useEffect, useState } from 'react';
import { ToolShell, SelectField, ColorField, ImageField, useImageAsset, useExportReady } from './shared/tool-core.jsx';
import { PALETTES, resolvePalette, extractPalette, contrast, readable, themeTokens, tokenCSS } from './shared/tool-art.js';

/** Original Fluid palette generator. Include components/tools.css. Initial palette is a named PALETTES entry. */
export default function PaletteStudio({ palette='Ember', color, secondary, onExportReady }) {
  const initial=PALETTES[palette]?palette:'Ember';
  const [look,setLook]=useState(initial),[colors,setColors]=useState(()=>resolvePalette(initial,color,secondary)),[extractError,setExtractError]=useState('');
  useEffect(()=>{if(/^#[\da-f]{6}$/i.test(color||''))setColors(previous=>previous.map((value,index)=>index===2?color:value));},[color]);
  useEffect(()=>{if(/^#[\da-f]{6}$/i.test(secondary||''))setColors(previous=>previous.map((value,index)=>index===3?secondary:value));},[secondary]);
  const upload=useImageAsset();
  useEffect(()=>{if(!upload.asset)return;try{setColors(extractPalette(upload.asset.image));setLook('Image / custom');setExtractError('');}catch(error){setExtractError(error.message);}},[upload.asset]);
  function choose(name){if(!PALETTES[name])return;setLook(name);setColors([...PALETTES[name]]);setExtractError('');}
  function change(index,value){setColors(previous=>previous.map((color,i)=>i===index?value:color));setLook('Image / custom');}
  const tokens=themeTokens(colors),pairs=[['Body text',tokens.text,tokens.background],['Muted text',tokens.muted,tokens.background],['Card text',tokens.text,tokens.surface],['Button label',tokens['accent-text'],tokens.accent]];
  const exports={
    css:()=>({filename:'fluid-palette.css',mime:'text/css',data:tokenCSS(colors)}),
    json:()=>({filename:'fluid-palette.json',mime:'application/json',data:JSON.stringify({name:look,palette:colors,tokens,contrasts:pairs.map(([label,foreground,background])=>({label,foreground,background,ratio:Number(contrast(foreground,background).toFixed(2)),AA:contrast(foreground,background)>=4.5}))},null,2)})
  };
  useExportReady(onExportReady,exports);
  return <ToolShell title="Palette Studio" description="Start with a Fluid look, or extract five colours from a local image. Every token pair is measured with WCAG relative luminance." exports={exports} controls={<>
    <SelectField label="Starting look" value={look} onChange={choose} options={[...Object.keys(PALETTES),...(look==='Image / custom'?[{value:'Image / custom',label:'Image / custom'}]:[])]}/>
    <ImageField label="Extract from an image" upload={upload}/>
    {extractError?<p className="ft-error" role="alert">{extractError}</p>:null}
    <p className="ft-note">Edit any swatch below the preview. Text colour is selected automatically; the ratio and pass/fail label show what is safe for body copy.</p>
  </>}>
    <div className="ft-palette-preview"><div className="ft-palette-swatches">{colors.map((color,index)=><div className="ft-swatch" key={index} style={{background:color,color:readable(color)}}>{color}</div>)}</div>
      <div className="ft-palette-editor">{colors.map((color,index)=><ColorField key={index} label={'Colour '+(index+1)} value={color} onChange={value=>change(index,value)}/>)}</div>
      <div className="ft-palette-example" style={{background:tokens.background,color:tokens.text}}><strong>A palette with a purpose.</strong><p style={{color:tokens.muted}}>Artwork becomes colours. Colours become a whole website.</p><span style={{display:'inline-block',background:tokens.accent,color:tokens['accent-text'],padding:'10px 16px',borderRadius:24,marginTop:16,fontWeight:600}}>Make something ↗</span></div>
      <div className="ft-contrast-list">{pairs.map(([name,fg,bg])=>{const ratio=contrast(fg,bg);return <div key={name} className="ft-contrast-row"><span>{name} · {fg} on {bg}</span><strong>{ratio.toFixed(2)}:1 · {ratio>=4.5?'AA pass':'AA fail'}</strong></div>;})}</div>
    </div>
  </ToolShell>;
}
