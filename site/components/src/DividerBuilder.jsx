import { useEffect, useId, useState } from 'react';
import { ToolShell, SelectField, RangeField, ColorField, useExportReady } from './shared/tool-core.jsx';
import { rng, readable } from './shared/tool-art.js';

function dividerPath(shape,height,complexity,amplitude,seed,flip=false){
  const w=1200,mid=height*.48,range=height*amplitude/100*.42,random=rng(seed),y=value=>(flip?height-value:value).toFixed(2);let d='M0 '+y(mid);
  if(shape==='arc')d+=' Q600 '+y(mid-range*2)+' 1200 '+y(mid);
  else if(shape==='steps'){const step=w/complexity;for(let i=1;i<=complexity;i++)d+=' H'+(step*i).toFixed(2)+' V'+y(mid+(i%2?range:-range));}
  else if(shape==='torn'){for(let i=1;i<=complexity*8;i++)d+=' L'+(w*i/(complexity*8)).toFixed(2)+' '+y(mid+(random()-.5)*range*2);}
  else {const step=w/complexity;for(let i=0;i<complexity;i++)d+=' C'+(step*(i+.3)).toFixed(2)+' '+y(mid+(i%2?-range:range)*2)+' '+(step*(i+.7)).toFixed(2)+' '+y(mid+(i%2?-range:range)*2)+' '+(step*(i+1)).toFixed(2)+' '+y(mid);}
  return d+' L1200 '+height+' L0 '+height+' Z';
}
/** Exports a real SVG plus a standalone React component using exactly the current geometry. */
export default function DividerBuilder({seed:initialSeed=42,color:initialColor='#a79bfa',secondary='#fff3df',onExportReady}){
  const [shape,setShape]=useState('wave'),[height,setHeight]=useState(180),[complexity,setComplexity]=useState(4),[amplitude,setAmplitude]=useState(70),[seed,setSeed]=useState(initialSeed),[color,setColor]=useState(initialColor),[background,setBackground]=useState(secondary),[flip,setFlip]=useState(false);const id=useId(),d=dividerPath(shape,height,complexity,amplitude,seed,flip),transform=undefined;
  useEffect(()=>setColor(initialColor),[initialColor]);
  useEffect(()=>setBackground(secondary),[secondary]);
  useEffect(()=>setSeed(initialSeed),[initialSeed]);
  const settings={shape,height,complexity,amplitude,seed,color,background,flip};
  const svg='<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="'+height+'" viewBox="0 0 1200 '+height+'" preserveAspectRatio="none" role="img" aria-label="'+shape+' section divider"><rect width="1200" height="'+height+'" fill="'+background+'"/><path d="'+d+'" fill="'+color+'"'+(transform?' transform="'+transform+'"':'')+'/></svg>';
  const jsx='/** Fluid Divider Builder settings: '+JSON.stringify(settings)+' */\nexport default function FluidDivider({ className = "" }) {\n  return (\n    <svg className={className} viewBox="0 0 1200 '+height+'" preserveAspectRatio="none" aria-hidden="true" style={{ display: "block", width: "100%", height: '+height+' }}>\n      <rect width="1200" height="'+height+'" fill="'+background+'" />\n      <path d="'+d+'" fill="'+color+'"'+(transform?' transform="'+transform+'"':'')+' />\n    </svg>\n  );\n}\n';
  const exports={svg:()=>({filename:'fluid-'+shape+'-divider.svg',mime:'image/svg+xml',data:svg}),jsx:()=>({filename:'FluidDivider.jsx',mime:'text/jsx',data:jsx}),json:()=>({filename:'fluid-divider.json',mime:'application/json',data:JSON.stringify(settings,null,2)})};useExportReady(onExportReady,exports);
  return <ToolShell title="Divider Builder" description="Shape the transition between two sections. Tune the height, rhythm and edge, then take the exact SVG or React component." exports={exports} labels={{jsx:'Download React'}} controls={<>
    <SelectField label="Shape" value={shape} onChange={setShape} options={['wave','arc','torn','steps']}/><RangeField label="Height" value={height} onChange={setHeight} min={48} max={300} step={4} unit=" px"/><RangeField label="Complexity" value={complexity} onChange={setComplexity} min={2} max={16}/><RangeField label="Amplitude" value={amplitude} onChange={setAmplitude} min={0} max={100}/><ColorField label="Next section" value={color} onChange={setColor}/><ColorField label="Previous section" value={background} onChange={setBackground}/><RangeField label="Seed" value={seed} onChange={setSeed} min={1} max={999}/><label className="ft-checkbox" htmlFor={id}><input id={id} type="checkbox" checked={flip} onChange={e=>setFlip(e.target.checked)}/>Flip vertically</label>
  </>}><div className="ft-divider-preview" style={{background}}><div className="ft-divider-top" style={{color:readable(background)}}>Previous section</div><svg viewBox={'0 0 1200 '+height} preserveAspectRatio="none" aria-hidden="true"><rect width="1200" height={height} fill={background}/><path d={d} fill={color} transform={transform}/></svg><div className="ft-divider-bottom" style={{background:color,color:readable(color)}}>Next section</div></div></ToolShell>;
}
