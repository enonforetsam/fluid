import { FireRenderer } from './engine.js';
const $=s=>document.querySelector(s),canvas=$('#art'),original=$('#original');
const defaults={intensity:.65,heat:.55,motion:.4,detail:.75,color:'ember',region:'edges'};
const looks={ember:{...defaults},inferno:{...defaults,intensity:.9,heat:.85,motion:.7,detail:.6,color:'inferno'},blue:{...defaults,intensity:.75,heat:.65,motion:.35,detail:.8,color:'blue'}};
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
let options={...defaults},paused=reduced.matches,ready=false,renderer,raf=0,sourceURL='',sourceName='anthurium',sourceWidth=1448,sourceHeight=1086,requestId=0,lastFrame=0,recording=false,recorder,cancelled=false,recordTimer=0;
function status(message){$('#status').textContent=message}
function error(message){$('#error').textContent=message;$('#error').hidden=!message}
function safeName(name){return (name||'fluid-art').replace(/\.[^.]+$/,'').replace(/[^a-z\d_-]+/gi,'-').slice(0,60)||'fluid-art'}
function download(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),30000)}
function reflect(){
 for(const key of ['intensity','heat','motion','detail']){$('#'+key).value=Math.round(options[key]*100);$('#'+key+'Value').value=Math.round(options[key]*100)}
 $('#region').value=options.region;document.querySelectorAll('[data-look]').forEach(el=>{const active=el.dataset.look===options.color;el.classList.toggle('active',active);el.setAttribute('aria-pressed',active)});
 $('#playText').textContent=paused?'Play':'Pause';$('#playIcon').textContent=paused?'▷':'Ⅱ';$('#play').setAttribute('aria-label',paused?'Play animation':'Pause animation');$('#play').setAttribute('aria-pressed',paused);
}
function paint(time=performance.now()){if(ready){renderer.setOptions({...options,paused});renderer.render(time/1000)}}
function animate(time){raf=0;if(!ready||paused||document.hidden)return;if(time-lastFrame>=1000/30){paint(time);lastFrame=time}raf=requestAnimationFrame(animate)}
function kick(){cancelAnimationFrame(raf);paint();if(!paused&&!document.hidden)raf=requestAnimationFrame(animate)}
function lockControls(locked){document.querySelectorAll('.controls button,.controls input,.controls select,#replace,#saveProject,#openProject,#play,#compare').forEach(el=>el.disabled=locked)}
function fitStage(){const shell=$('#dropZone'),stage=$('#imageStage');const available=shell.clientWidth-(innerWidth<500?24:innerWidth<1100?48:64);const maxHeight=innerWidth<500?400:innerWidth<800?480:600;const width=Math.min(available,maxHeight*sourceWidth/sourceHeight,780);stage.style.width=width+'px';stage.style.aspectRatio=sourceWidth+'/'+sourceHeight;}
async function setImage(url,name,sample=false,projectOptions=null){
 const id=++requestId;$('#loading').hidden=false;$('#loading').textContent='Opening your image…';error('');
 try{
  const image=new Image();image.src=url;await image.decode();if(id!==requestId)return;
  if(image.naturalWidth*image.naturalHeight>100000000)throw Error('This image is too large. Choose an image under 100 megapixels.');
  const scale=Math.min(1,2048/Math.max(image.naturalWidth,image.naturalHeight));
  const working=document.createElement('canvas');working.width=Math.round(image.naturalWidth*scale);working.height=Math.round(image.naturalHeight*scale);working.getContext('2d').drawImage(image,0,0,working.width,working.height);
  await renderer.setSource(working);if(id!==requestId)return;
  sourceWidth=working.width;sourceHeight=working.height;sourceURL=working.toDataURL('image/png');sourceName=safeName(name);original.src=sourceURL;
  const previewScale=Math.min(1,1280/Math.max(sourceWidth,sourceHeight));renderer.resize(Math.round(sourceWidth*previewScale),Math.round(sourceHeight*previewScale));
  if(projectOptions)options=validateOptions(projectOptions);
  $('#fileName').textContent=sample?'Anthurium study':name;$('#fileType').textContent=sample?'SAMPLE':'YOUR IMAGE';$('#dimensions').textContent=`${sourceWidth} × ${sourceHeight}`;
  ready=true;fitStage();reflect();kick();status(sample?'Try a look, or drop in an image of your own.':'Image ready. Your original file is unchanged.');$('#export').disabled=false;
 }catch(e){error(e.message||'Could not open this image. Try a PNG, JPG, or WebP.');if(!ready){$('#loading').textContent='Choose an image to begin.';$('#export').disabled=true}}
 finally{if(id===requestId&&ready)$('#loading').hidden=true}
}
async function loadFile(file){
 if(recording)return;if(!file)return;
 if(!['image/png','image/jpeg','image/webp'].includes(file.type)){error('Choose a PNG, JPG, or WebP image.');return}
 if(file.size>25*1024*1024){error('Choose an image smaller than 25 MB.');return}
 const url=URL.createObjectURL(file);try{await setImage(url,file.name)}finally{URL.revokeObjectURL(url)}
}
function validateOptions(v){const out={...defaults};for(const key of ['intensity','heat','motion','detail']){if(typeof v[key]!=='number'||!Number.isFinite(v[key]))throw Error('This project has invalid effect settings.');out[key]=Math.max(0,Math.min(1,v[key]))}if(!['ember','inferno','blue'].includes(v.color)||!['edges','all'].includes(v.region))throw Error('This project uses an unsupported effect.');out.color=v.color;out.region=v.region;return out}
function setCompare(active){$('#compare').setAttribute('aria-pressed',active);original.hidden=!active;$('#originalLabel').hidden=!active;$('#compareControl').hidden=!active;original.style.clipPath=`inset(0 ${100-+$('#comparison').value}% 0 0)`}
function encodePNG(){return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(Error('The image could not be exported. Try a smaller source.')),'image/png'))}

$('#replace').onclick=()=>$('#imageInput').click();$('#imageInput').onchange=e=>{loadFile(e.target.files[0]);e.target.value=''};
document.addEventListener('paste',e=>{const file=[...e.clipboardData.items].find(x=>x.kind==='file'&&x.type.startsWith('image/'))?.getAsFile();if(file){e.preventDefault();loadFile(file)}});
const dropZone=$('#dropZone');let dragDepth=0;
dropZone.addEventListener('dragenter',e=>{e.preventDefault();dragDepth++;if(!recording)$('#dropHint').hidden=false});dropZone.addEventListener('dragover',e=>e.preventDefault());
dropZone.addEventListener('dragleave',()=>{if(--dragDepth<=0){dragDepth=0;$('#dropHint').hidden=true}});
dropZone.addEventListener('drop',e=>{e.preventDefault();dragDepth=0;$('#dropHint').hidden=true;loadFile(e.dataTransfer.files[0])});
for(const key of ['intensity','heat','motion','detail'])$('#'+key).oninput=e=>{options[key]=+e.target.value/100;$('#'+key+'Value').value=e.target.value;kick()};
$('#region').onchange=e=>{options.region=e.target.value;kick()};
document.querySelectorAll('[data-look]').forEach(el=>el.onclick=()=>{options={...looks[el.dataset.look]};reflect();kick();status(`${el.querySelector('strong').textContent} applied. Make it your own with the controls.`)});
$('#reset').onclick=()=>{options={...looks[options.color]};reflect();kick();status('Look settings reset.')};
$('#play').onclick=()=>{paused=!paused;reflect();kick()};
$('#compare').onclick=()=>setCompare($('#compare').getAttribute('aria-pressed')!=='true');$('#comparison').oninput=()=>setCompare(true);
new ResizeObserver(fitStage).observe(dropZone);
document.addEventListener('visibilitychange',()=>{if(document.hidden){cancelAnimationFrame(raf);renderer?.setOptions({paused:true});if(recording&&recorder?.state==='recording'){cancelled=true;recorder.stop()}}else kick()});
reduced.addEventListener('change',e=>{if(e.matches){paused=true;reflect();kick()}});

$('#saveProject').onclick=()=>{
 if(!ready)return;const data={format:'fluid-fire-project',version:1,name:sourceName,source:sourceURL,width:sourceWidth,height:sourceHeight,options:{...options},paused};
 download(new Blob([JSON.stringify(data)],{type:'application/json'}),sourceName+'.fluid.json');status('Editable project saved, including your source image. Open it here to continue later.');
};
$('#openProject').onclick=()=>$('#projectInput').click();$('#projectInput').onchange=async e=>{
 const file=e.target.files[0];e.target.value='';if(!file)return;
 try{if(file.size>35*1024*1024)throw Error('This project is too large. Choose a project under 35 MB.');const p=JSON.parse(await file.text());if(p.format!=='fluid-fire-project'||p.version!==1||typeof p.source!=='string'||!/^data:image\/(png|jpeg|webp);base64,/.test(p.source))throw Error('Choose a valid Fluid Fire project saved by this editor.');const opts=validateOptions(p.options||{});paused=typeof p.paused==='boolean'?p.paused:reduced.matches;await setImage(p.source,String(p.name||'Fluid project'),false,opts)}catch(e){error(e.message||'This project could not be opened.')}
};

const dialog=$('#exportDialog');$('#export').onclick=()=>{if(!ready)return;$('#exportDescription').textContent=`PNG at ${sourceWidth} × ${sourceHeight}. Motion clips up to 1280 pixels on the long edge.`;$('#exportProgress').textContent='';dialog.showModal()};
$('#closeExport').onclick=()=>{if(recording&&recorder?.state==='recording'){cancelled=true;recorder.stop()}dialog.close()};dialog.addEventListener('cancel',()=>{if(recording&&recorder?.state==='recording'){cancelled=true;recorder.stop()}});
$('#exportPNG').onclick=async()=>{
 const button=$('#exportPNG');button.disabled=true;$('#exportVideo').disabled=true;button.setAttribute('aria-busy','true');$('#exportProgress').textContent='Preparing your image…';cancelAnimationFrame(raf);
 const oldWidth=canvas.width,oldHeight=canvas.height;
 try{renderer.resize(sourceWidth,sourceHeight);paint();const blob=await encodePNG();download(blob,sourceName+'-'+options.color+'.png');$('#exportProgress').textContent='PNG saved. Ready for wherever you take it.'}
 catch(e){$('#exportProgress').textContent=e.message;error(e.message)}
 finally{renderer.resize(oldWidth,oldHeight);kick();button.disabled=false;$('#exportVideo').disabled=!videoType;button.removeAttribute('aria-busy')}
};
const videoType=window.MediaRecorder&&canvas.captureStream?['video/webm;codecs=vp9','video/webm;codecs=vp8','video/webm'].find(type=>MediaRecorder.isTypeSupported(type)):null;
if(!videoType){$('#exportVideo').disabled=true;$('#exportVideo small').textContent='Motion export is unavailable in this browser. PNG works.'}
$('#exportVideo').onclick=()=>{
 if(!ready||recording||!videoType)return;
 const previousPause=paused;const chunks=[];let stream;
 try{
  stream=canvas.captureStream(24);recorder=new MediaRecorder(stream,{mimeType:videoType,videoBitsPerSecond:8000000});
  recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data)};
  recorder.onerror=()=>{cancelled=true;error('Recording failed. Try another browser, or export a PNG.');if(recorder.state!=='inactive')recorder.stop()};
  recorder.onstop=()=>{clearInterval(recordTimer);stream.getTracks().forEach(t=>t.stop());recording=false;lockControls(false);$('#exportPNG').disabled=false;$('#exportVideo').disabled=false;$('#cancelRecording').hidden=true;paused=previousPause;reflect();kick();if(!cancelled&&chunks.length){download(new Blob(chunks,{type:videoType}),sourceName+'-'+options.color+'.webm');$('#exportProgress').textContent='Your 6-second clip is ready.'}else $('#exportProgress').textContent='Recording cancelled.'};
  cancelled=false;recording=true;paused=false;setCompare(false);lockControls(true);$('#exportPNG').disabled=true;$('#exportVideo').disabled=true;$('#cancelRecording').hidden=false;$('#exportProgress').textContent='Recording · 6 seconds remaining';reflect();kick();recorder.start(250);const started=performance.now();recordTimer=setInterval(()=>{const remaining=Math.max(0,6-(performance.now()-started)/1000);$('#exportProgress').textContent=`Recording · ${Math.ceil(remaining)} seconds remaining`;if(remaining<=0&&recorder.state==='recording')recorder.stop()},150);
 }catch(e){stream?.getTracks().forEach(t=>t.stop());recording=false;lockControls(false);paused=previousPause;reflect();kick();$('#exportPNG').disabled=false;$('#exportVideo').disabled=!videoType;$('#cancelRecording').hidden=true;$('#exportProgress').textContent='Could not record this clip. Try another browser or use PNG.'}
};
$('#cancelRecording').onclick=()=>{cancelled=true;if(recorder?.state==='recording')recorder.stop()};

try{renderer=new FireRenderer(canvas);reflect();await setImage('./assets/anthurium.png','Anthurium study',true);window.fluidEditor={get options(){return {...options}},get ready(){return ready},get paused(){return paused},renderer,loadFile}}catch(e){$('#loading').hidden=true;error('Fluid could not start its graphics engine. Enable hardware acceleration or try a different browser.');lockControls(true)}
