import {readFile, writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';

// Offline geometry only. No font, browser, rasterizer or third-party package is needed.
// The supplied vector uses absolute M/L/Z segments; fail rather than silently
// resampling an unsupported future source. Its 7-unit rounded stroke is included.
const root=fileURLToPath(new URL('../', import.meta.url));
const source=await readFile(root+'site/assets/fluid-wordmark.svg','utf8');
const path=source.match(/<path\b[^>]*\bd="([^"]+)"/)?.[1];
if(!path || /[^MLZ\d.,\s-]/.test(path)) throw new Error('Expected the original M/L/Z Fluid wordmark path.');
const tokens=path.match(/[MLZ]|-?\d+(?:\.\d+)?/g), polygons=[];
let polygon=[], i=0;
while(i<tokens.length){
  const command=tokens[i++];
  if(command==='M'){if(polygon.length)polygons.push(polygon);polygon=[[Number(tokens[i++]),Number(tokens[i++])]];}
  else if(command==='L')polygon.push([Number(tokens[i++]),Number(tokens[i++])]);
  else if(command==='Z'){if(polygon.length)polygons.push(polygon);polygon=[];}
  else throw new Error('Unsupported path command.');
}
if(polygon.length)polygons.push(polygon);
const segments=polygons.flatMap(p=>p.map((a,j)=>[...a,...p[(j+1)%p.length]]));
function inWordmark(x,y){
  let winding=0;
  for(const [ax,ay,bx,by] of segments){
    const dx=bx-ax,dy=by-ay,length=dx*dx+dy*dy;
    const t=length?Math.max(0,Math.min(1,((x-ax)*dx+(y-ay)*dy)/length)):0;
    if((x-ax-t*dx)**2+(y-ay-t*dy)**2<=3.5**2)return true;
    const side=dx*(y-ay)-(x-ax)*dy;
    if(ay<=y && by>y && side>0)winding++;
    else if(ay>y && by<=y && side<0)winding--;
  }
  return winding!==0;
}
const WIDTH=1000,HEIGHT=560,COLORS=['#ff916a','#ffad8c','#ffe0cc'];
const scale=840/397.09,pitch=3;
const fluid=[];
for(let y=pitch/2;y<210.71;y+=pitch)for(let x=pitch/2;x<397.09;x+=pitch){
  if(inWordmark(x,y))fluid.push([Number((80+x*scale).toFixed(2)),Number((280+(y-210.71/2)*scale).toFixed(2))]);
}
if(fluid.length<2200 || fluid.length>5000)throw new Error(`Point budget exceeded: ${fluid.length}`);

// All destination forms are designed silhouettes, never random scatter. Their
// regular lattices are selected evenly so density stays legible on small screens.
const inside={
  wave(x,y){
    if(x<72 || x>928)return false;
    const u=(x-72)/856, taper=Math.sin(Math.PI*u)**0.32;
    const mid=280+87*Math.sin(u*Math.PI*2-0.65);
    return Math.abs(y-mid)<83*taper;
  },
  orbit(x,y){
    const dx=x-500,dy=y-280;
    for(const angle of [-0.58,0,0.58]){
      const rx=dx*Math.cos(angle)+dy*Math.sin(angle),ry=-dx*Math.sin(angle)+dy*Math.cos(angle);
      const radius=Math.hypot(rx/310,ry/112);
      if(Math.abs(radius-1)<0.115)return true;
    }
    return false;
  },
  bloom(x,y){
    const dx=(x-500)/1.12,dy=y-280,r=Math.hypot(dx,dy),angle=Math.atan2(dy,dx);
    const edge=175+35*Math.cos(6*angle+0.4)+12*Math.sin(3*angle);
    return r<edge && r>44+10*Math.cos(6*angle+0.4);
  },
};
function lattice(test,pitch){const out=[];for(let y=pitch/2;y<HEIGHT;y+=pitch)for(let x=pitch/2;x<WIDTH;x+=pitch)if(test(x,y))out.push([Number(x.toFixed(2)),Number(y.toFixed(2))]);return out;}
function morton([x,y]){let code=0;const a=Math.floor(x),b=Math.floor(y);for(let n=0;n<10;n++)code|=((a>>n)&1)<<(2*n)|((b>>n)&1)<<(2*n+1);return code;}
function sample(test,count){
  let low=1,high=16,points=[],step=0;
  for(let n=0;n<20;n++){const middle=(low+high)/2,candidate=lattice(test,middle);if(candidate.length>=count){low=middle;points=candidate;step=middle;}else high=middle;}
  points.sort((a,b)=>morton(a)-morton(b));
  const selected=Array.from({length:count},(_,n)=>points[Math.floor((n+0.5)*points.length/count)]);
  if(selected.some(p=>!p))throw new Error('Destination sampling failed.');
  return {points:selected,square:Number((step*0.72).toFixed(2))};
}
// Recursive balanced transport pairs neighboring regions of equal population.
// It preserves each particle's identity and produces short, coherent journeys.
function match(source,target){
  const result=new Array(source.length);
  function partition(a,b,depth){
    if(a.length===1){result[a[0]]=target[b[0]];return;}
    const axis=depth%2;
    a.sort((u,v)=>source[u][axis]-source[v][axis]||source[u][1-axis]-source[v][1-axis]);
    b.sort((u,v)=>target[u][axis]-target[v][axis]||target[u][1-axis]-target[v][1-axis]);
    const half=Math.floor(a.length/2);
    partition(a.slice(0,half),b.slice(0,half),depth+1);partition(a.slice(half),b.slice(half),depth+1);
  }
  partition(source.map((_,n)=>n),target.map((_,n)=>n),0);return result;
}
const forms={},squares={fluid:Number((pitch*scale*0.72).toFixed(2))};
for(const [name,test] of Object.entries(inside)){const target=sample(test,fluid.length);forms[name]=match(fluid,target.points);squares[name]=target.square;}
const points=fluid.map(([x,y],n)=>{
  // Fixed spatial tone bands follow the same squares throughout every morph.
  const tone=(Math.floor(x/35)+Math.floor(y/41)*3)%13<2?2:(Math.floor(x/27)+Math.floor(y/33))%5===0?1:0;
  return [x,y,tone,...forms.wave[n],...forms.orbit[n],...forms.bloom[n]];
});
const meta={width:WIDTH,height:HEIGHT,count:points.length,colors:COLORS,squares,duration:1350,sourceSha256:createHash('sha256').update(source).digest('hex')};
await writeFile(root+'site/pixel-hero-points.js',`// Generated by scripts/generate-pixel-hero.mjs from the original Fluid vector.\n// One persistent square per row: fluid x/y, tone, wave x/y, orbit x/y, bloom x/y.\nexport const PIXEL_META=${JSON.stringify(meta)};\nexport const PIXEL_POINTS=${JSON.stringify(points)};\n`);
const groups=COLORS.map((color,tone)=>`<path fill="${color}" d="${points.filter(p=>p[2]===tone).map(p=>`M${(p[0]-squares.fluid/2).toFixed(3)},${(p[1]-squares.fluid/2).toFixed(3)}h${squares.fluid}v${squares.fluid}h-${squares.fluid}z`).join('')}"/>`).join('');
await writeFile(root+'site/assets/fluid-pixels.svg',`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${WIDTH} ${HEIGHT}" role="img" aria-labelledby="title desc"><title id="title">Fluid</title><desc id="desc">The Fluid wordmark built from ${points.length.toLocaleString('en-US')} tiny peach and cream squares.</desc>${groups}</svg>\n`);
console.log(JSON.stringify(meta,null,2));
