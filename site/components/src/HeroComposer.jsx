import { useEffect, useState } from 'react';
import { ToolShell, TextField, SelectField, RangeField, ImageField, useImageAsset, useCanvasDraw, useExportReady } from './shared/tool-core.jsx';
import { PALETTES, canvasPNG } from './shared/tool-art.js';
import { drawComposition, renderComposition, heroHTML } from './shared/tool-composition.js';

/** All images are embedded in the offline HTML; no account, bundler or CDN is required. */
export default function HeroComposer({seed:initialSeed=42,color,secondary,onExportReady}){
  const [title,setTitle]=useState('Make something that feels like you.'),[subtitle,setSubtitle]=useState('A space for your next idea. A little art, a little motion, a whole lot of possibility.'),[label,setLabel]=useState('FLUID / YOUR NEXT IDEA'),[cta,setCTA]=useState('Explore the possibilities'),[href,setHref]=useState('#details'),[palette,setPalette]=useState('Ember'),[art,setArt]=useState('bloom'),[layout,setLayout]=useState('split'),[font,setFont]=useState('sans'),[fontSize,setFontSize]=useState(80),[seed,setSeed]=useState(initialSeed);
  useEffect(()=>setSeed(initialSeed),[initialSeed]);
  const image=useImageAsset(),logo=useImageAsset(),settings={type:'hero',color,secondary,title,subtitle,label,cta,href,palette,art,layout,font,fontSize,seed};
  const canvas=useCanvasDraw((ctx,w,h)=>drawComposition(ctx,w,h,settings,image.asset?.image,logo.asset?.image),[color,secondary,title,subtitle,label,cta,palette,art,layout,font,fontSize,seed,image.asset,logo.asset],1024,640);
  const exports={
    html:()=>({filename:'fluid-hero.html',mime:'text/html',data:heroHTML({...settings,sourceImage:image.asset?.src||null,logo:logo.asset?.src||null},image.asset?.image,logo.asset?.src)}),
    png:()=>canvasPNG(renderComposition(settings,image.asset?.image,logo.asset?.image,1440,900),'fluid-hero-1440x900.png'),
    json:()=>({filename:'fluid-hero.json',mime:'application/json',data:JSON.stringify({...settings,sourceImage:image.asset?.src||null,logo:logo.asset?.src||null},null,2)})
  };useExportReady(onExportReady,exports);
  return <ToolShell title="Hero Composer" description="Compose artwork, a logo, words and a call to action. Take a full offline HTML section with embedded images, or a 1440 × 900 PNG." exports={exports} controls={<>
    <TextField label="Headline" value={title} onChange={setTitle} maxLength={120} multiline/><TextField label="Supporting text" value={subtitle} onChange={setSubtitle} maxLength={200} multiline/><TextField label="Project label / logo description" value={label} onChange={setLabel} maxLength={56}/><TextField label="Button label" value={cta} onChange={setCTA} maxLength={40}/><TextField label="Button link" value={href} onChange={setHref} maxLength={500}/>
    <SelectField label="Layout" value={layout} onChange={setLayout} options={['split','center','corner']}/><SelectField label="Palette" value={palette} onChange={setPalette} options={Object.keys(PALETTES)}/><SelectField label="Artwork" value={art} onChange={setArt} options={['bloom','ink','chrome','contour','grain']}/><SelectField label="Headline type" value={font} onChange={setFont} options={['sans','serif']}/><RangeField label="Headline maximum size" value={fontSize} onChange={setFontSize} min={48} max={100} unit=" px"/><RangeField label="Artwork seed" value={seed} onChange={setSeed} min={1} max={999}/><ImageField label="Background image (optional)" upload={image}/><ImageField label="Logo (optional, transparent preferred)" upload={logo}/>
  </>}><canvas ref={canvas} aria-label="Composed hero preview" role="img"/><p className="ft-preview-caption">PNG: 1440 × 900 · HTML: semantic text, embedded artwork and a working button link</p></ToolShell>;
}
