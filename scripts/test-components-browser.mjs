import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const target = process.env.FLUID_COMPONENTS_QA_URL || 'http://127.0.0.1:8893/components.html';
const site = new URL('./', target);
const output = process.env.FLUID_COMPONENTS_QA_OUTPUT || '/tmp/fluid-components-qa-20261030';
const dependency = process.env.FLUID_COMPONENTS_PLAYWRIGHT || '/opt/codex-workspaces/jalan-globe06/node_modules/playwright/index.mjs';
const executablePath = process.env.FLUID_COMPONENTS_CHROME || '/root/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome';
const esbuildPath = process.env.FLUID_COMPONENTS_ESBUILD || '/opt/codex-workspaces/jalan-globe06/node_modules/esbuild/lib/main.js';
const reactPath = process.env.FLUID_COMPONENTS_NODE_PATH || '/opt/workspaces/kuih-bright-20261025/node_modules';
const { chromium } = await import(pathToFileURL(dependency));
assert.ok(existsSync(executablePath), 'Existing Chromium binary must be present');
await mkdir(output, { recursive: true });
const report = {
  host:'VPS', observedAt:new Date().toISOString(), target, browser:executablePath,
  checks:[], pageErrors:[], consoleErrors:[], cspViolations:[], screenshots:[],
  limits:['Isolated headless Chromium; no Safari or physical touch device.', 'WebGL/GPU disabled; shared-page verification covers layout/navigation only.']
};
const hash = value => createHash('sha256').update(value).digest('hex');
let browser, context, page, phase='setup';
async function check(name, fn) {
  if(process.env.FLUID_COMPONENTS_QA_ONLY && !name.includes(process.env.FLUID_COMPONENTS_QA_ONLY))return;
  const start=Date.now(); phase=name;
  try { const details=await fn(); report.checks.push({name,pass:true,milliseconds:Date.now()-start,...details}); console.log('PASS '+name); return true; }
  catch(error) { report.checks.push({name,pass:false,milliseconds:Date.now()-start,error:error.stack||error.message}); console.log('FAIL '+name+': '+error.message); return false; }
}
function monitor(p, label) {
  p.on('pageerror', error=>report.pageErrors.push({phase,label,error:error.message}));
  p.on('console', message=>{if(message.type()==='error')report.consoleErrors.push({phase,label,error:message.text().slice(0,400)});});
}
async function newContext(options={}) {
  const c=await browser.newContext({viewport:{width:1440,height:1100},acceptDownloads:true,reducedMotion:'no-preference',...options});
  await c.addInitScript(()=>{
    window.__fluidCsp=[];
    document.addEventListener('securitypolicyviolation',e=>window.__fluidCsp.push({directive:e.effectiveDirective,blocked:e.blockedURI}));
  });
  return c;
}
async function ready(p=page) {
  await p.locator('#componentName').waitFor();
  await p.waitForFunction(()=>document.querySelector('.cp-demo .fb-component') || document.querySelector('#panel-code'));
}
async function openComponent(id,p=page) {
  await p.goto(new URL('components.html?component='+id,site).href,{waitUntil:'networkidle'});
  await ready(p);
  await p.mouse.move(4,4);
}
async function select(name) { await page.getByRole('navigation',{name:'Choose a component'}).getByRole('button',{name,exact:true}).click(); await page.waitForFunction(name=>document.querySelector('#componentName')?.textContent===name,name); }
async function slider(value) {
  await page.locator('#componentAmount').evaluate((input,value)=>{
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,String(value));
    input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));
  },value);
}
async function setPaused(paused,p=page) {
  const button=p.locator('.cp-toolbar-actions button').last();
  if((await button.getAttribute('aria-pressed'))!==String(paused))await button.click();
}
async function codeTab(name,p=page) {
  await p.locator('#view-code').click();
  await p.locator('#source-'+name).click();
  await p.locator('#sourcePanel pre code').waitFor();
}
async function screenshot(name,p=page) {
  const destination=path.join(output,name+'.png');await p.screenshot({path:destination,fullPage:true});report.screenshots.push(destination);
}
async function measureOverflow(p=page) {
  return p.evaluate(()=>({width:innerWidth,client:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth,
    offenders:[...document.querySelectorAll('body *')].filter(el=>{const r=el.getBoundingClientRect();return r.width>0&&(r.right>innerWidth+1||r.left< -1)&&!el.closest('pre,.cp-code-scroll,.fb-marquee,.fb-sr-only');}).slice(0,12).map(el=>({tag:el.tagName,class:el.className,left:el.getBoundingClientRect().left,right:el.getBoundingClientRect().right}))}));
}
async function sourceText(file,p=page) {
  const response=await p.request.get(new URL(file,site).href);assert.equal(response.status(),200,file);
  const body=await response.body();assert.ok(!/^\s*<!doctype/i.test(body.toString()),file+' must not be HTML');
  return body;
}

try {
  browser=await chromium.launch({executablePath,headless:true,args:['--no-sandbox','--disable-gpu','--disable-webgl','--disable-dev-shm-usage']});
  context=await newContext(); await context.grantPermissions(['clipboard-read','clipboard-write'],{origin:new URL(target).origin});
  page=await context.newPage();monitor(page,'main');
  const response=await page.goto(target,{waitUntil:'networkidle'});assert.equal(response.status(),200);await ready();
  report.contentSecurityPolicy=response.headers()['content-security-policy']||null;
  const catalogue=await (await page.request.get(new URL('components/catalogue.json',site).href)).json();
  assert.equal(catalogue.length,6);
  const sources=new Map();
  for(const item of catalogue)sources.set(item.file,await sourceText('components/src/'+item.file+'.jsx'));
  const css=await sourceText('components/components.css');

  await check('initial six-component gallery and usable default preview',async()=>{
    assert.equal(await page.locator('.cp-component-button').count(),6);
    assert.equal(await page.locator('#componentName').textContent(),'Spotlight Card');
    assert.equal(await page.locator('.fb-spotlight').count(),1);
    assert.equal(await page.locator('.components-boot').count(),0);
    await screenshot('desktop-spotlight');
    return {catalogue:catalogue.map(x=>x.id),csp:report.contentSecurityPolicy};
  });

  await check('category filters, search, empty state and reset',async()=>{
    for(const [category,count] of [['Text',2],['Cards',2],['Interaction',1],['Loops',1],['All',6]]) {
      await page.getByRole('group',{name:'Component categories'}).getByRole('button',{name:new RegExp('^'+category)}).click();
      assert.equal(await page.locator('.cp-component-button').count(),count,category);
    }
    await page.locator('#componentSearch').fill('card');assert.equal(await page.locator('.cp-component-button').count(),2);
    await page.locator('#componentSearch').fill('no-such-fluid-component');
    assert.equal(await page.locator('.cp-component-button').count(),0);
    await page.getByRole('button',{name:/Clear search and filters/}).click();
    assert.equal(await page.locator('#componentSearch').inputValue(),'');assert.equal(await page.locator('.cp-component-button').count(),6);
  });

  await check('component selection persists in URL, reload, back and forward',async()=>{
    await select('Split Reveal');const first=page.url();assert.equal(new URL(first).searchParams.get('component'),'split-reveal');
    await select('Wave Text');assert.equal(new URL(page.url()).searchParams.get('component'),'wave-text');
    await page.goBack();await page.waitForFunction(()=>document.querySelector('#componentName')?.textContent==='Split Reveal');
    await page.goForward();await page.waitForFunction(()=>document.querySelector('#componentName')?.textContent==='Wave Text');
    await page.reload({waitUntil:'networkidle'});await ready();assert.equal(await page.locator('#componentName').textContent(),'Wave Text');
    await page.goto(new URL('components.html?component=does-not-exist',site).href,{waitUntil:'networkidle'});await ready();
    assert.equal(await page.locator('#componentName').textContent(),'Spotlight Card');
  });

  await check('Split Reveal text, duration and replay update the live component',async()=>{
    await openComponent('split-reveal');await page.locator('#componentText').fill('Make a little room.');
    await slider(1150);
    assert.equal(await page.locator('.fb-split').evaluate(el=>el.style.getPropertyValue('--fb-reveal-duration')),'1150ms');
    const snapshot=await page.locator('.fb-split').ariaSnapshot();assert.ok(snapshot.includes('Make a little room.'));
    assert.equal(snapshot.split('Make a little room.').length-1,1,'Accessible text must occur once');
    await page.waitForTimeout(200);
    await page.evaluate(()=>window.__oldReveal=document.querySelector('.fb-split'));
    await page.getByRole('button',{name:'Replay component preview'}).click();
    assert.equal(await page.evaluate(()=>window.__oldReveal!==document.querySelector('.fb-split')),true);
    const elapsed=await page.locator('.fb-split-letter').first().evaluate(el=>el.getAnimations()[0]?.currentTime);
    assert.ok(elapsed!==undefined && elapsed<250,'Replay must restart the entrance');
    await page.getByRole('button',{name:/^Reset/}).click();assert.equal(await page.locator('#componentText').inputValue(),'Make room for motion.');
    assert.equal(await page.locator('#componentAmount').inputValue(),'700');
  });

  await check('Wave Text preserves graphemes, changes speed, and pauses/resumes',async()=>{
    await openComponent('wave-text');await page.locator('#componentText').fill('A👩‍🚀éB');await slider(4);
    assert.deepEqual(await page.locator('.fb-wave-letter').allTextContents(),['A','👩‍🚀','é','B']);
    assert.equal(await page.locator('.fb-wave-letter').first().evaluate(el=>getComputedStyle(el).animationDuration),'4s');
    const snapshot=await page.locator('.fb-wave').ariaSnapshot();assert.equal(snapshot.split('A👩‍🚀éB').length-1,1);
    await setPaused(true);
    await page.waitForFunction(()=>[...document.querySelectorAll('.fb-wave-letter')].every(el=>el.getAnimations().every(animation=>animation.playState==='paused'&&!animation.pending)));
    const a=await page.locator('.fb-wave-letter').evaluateAll(els=>els.map(el=>getComputedStyle(el).transform));
    await page.waitForTimeout(180);
    const b=await page.locator('.fb-wave-letter').evaluateAll(els=>els.map(el=>getComputedStyle(el).transform));
    assert.deepEqual(a,b);assert.equal(await page.locator('.fb-wave-letter').first().evaluate(el=>getComputedStyle(el).animationPlayState),'paused');
    await setPaused(false);assert.equal(await page.locator('.fb-wave-letter').first().evaluate(el=>getComputedStyle(el).animationPlayState),'running');
  });

  await check('Magnetic Button responds to pointer, resets on leave/cancel/blur, and activates by keyboard',async()=>{
    await openComponent('magnetic-button');await page.locator('#componentText').fill('Make something lovely');await slider(36);
    await page.getByRole('button',{name:'Lilac accent'}).click();
    assert.equal(await page.locator('.fb-magnetic-button').evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(197, 183, 255)');
    const root=page.locator('.fb-magnetic');const r=await root.boundingBox();
    await page.mouse.move(r.x+r.width*.73,r.y+r.height*.44);
    assert.notEqual(await root.evaluate(el=>el.style.getPropertyValue('--fb-magnet-x')),'0px');
    await root.dispatchEvent('pointercancel',{pointerType:'mouse'});assert.equal(await root.evaluate(el=>el.style.getPropertyValue('--fb-magnet-x')),'0px');
    await page.mouse.move(r.x+r.width*.69,r.y+r.height*.5);await page.evaluate(()=>window.dispatchEvent(new Event('blur')));
    assert.equal(await root.getAttribute('data-active'),'false');
    await page.mouse.move(2,2);assert.equal(await root.evaluate(el=>el.style.getPropertyValue('--fb-magnet-x')),'0px');
    await page.locator('.fb-magnetic-button').focus();await page.keyboard.press('Enter');
    assert.match(await page.locator('.cp-status').textContent(),/yours to keep/);
    const focus=await page.locator('.fb-magnetic-button').evaluate(el=>({style:getComputedStyle(el).outlineStyle,width:getComputedStyle(el).outlineWidth}));
    assert.ok(focus.style!=='none'&&parseFloat(focus.width)>=2);
    return {focus};
  });

  await check('Spotlight Card follows pointer, resets, and lights on real keyboard focus',async()=>{
    await openComponent('spotlight-card');await page.getByRole('button',{name:'Sky accent'}).click();
    const root=page.locator('.fb-spotlight'),r=await root.boundingBox();
    await page.mouse.move(r.x+r.width*.77,r.y+r.height*.7);
    assert.equal(await root.getAttribute('data-active'),'true');
    assert.notEqual(await root.evaluate(el=>el.style.getPropertyValue('--fb-light-x')),'0px');
    await page.mouse.move(2,2);assert.equal(await root.evaluate(el=>el.style.getPropertyValue('--fb-light-x')),'0px');
    const link=root.locator('a').first();assert.ok(await link.count(),'Preview needs a real focusable child');
    await link.focus();await page.waitForTimeout(220);
    assert.equal(await page.locator('.fb-spotlight-light').evaluate(el=>getComputedStyle(el).opacity),'1');
    await screenshot('desktop-spotlight-focused');
  });

  await check('Tilt Card responds to maximum tilt and resets at pointer/window exit',async()=>{
    await openComponent('tilt-card');await slider(20);
    const root=page.locator('.fb-tilt'),r=await root.boundingBox();
    await page.mouse.move(r.x+r.width*.8,r.y+r.height*.3);
    assert.equal(await root.getAttribute('data-active'),'true');
    const tilt=await root.evaluate(el=>({x:parseFloat(el.style.getPropertyValue('--fb-tilt-x')),y:parseFloat(el.style.getPropertyValue('--fb-tilt-y'))}));
    assert.ok(Math.abs(tilt.x)>1&&Math.abs(tilt.x)<=20&&Math.abs(tilt.y)<=20);
    await root.dispatchEvent('pointercancel',{pointerType:'mouse'});assert.equal(await root.evaluate(el=>el.style.getPropertyValue('--fb-tilt-x')),'0deg');
    await page.mouse.move(r.x+r.width*.7,r.y+r.height*.4);await page.evaluate(()=>window.dispatchEvent(new Event('blur')));
    assert.equal(await root.getAttribute('data-active'),'false');
    await page.mouse.move(2,2);assert.equal(await root.evaluate(el=>el.style.getPropertyValue('--fb-tilt-y')),'0deg');
    return {tilt};
  });

  await check('Loop Marquee is seamless, reverses, changes duration and pauses',async()=>{
    await openComponent('loop-marquee');await page.locator('#componentText').fill('MAKE, PLAY, REPEAT');await slider(14);
    await page.mouse.move(2,2);
    assert.equal(await page.locator('.fb-marquee-track').evaluate(el=>getComputedStyle(el).animationDuration),'14s');
    const widths=await page.locator('.fb-marquee-group').evaluateAll(els=>els.map(el=>el.getBoundingClientRect().width));
    assert.ok(Math.abs(widths[0]-widths[1])<.5,'Visual groups must match for a seamless loop');
    const snapshot=await page.locator('.fb-marquee').ariaSnapshot();assert.equal(snapshot.split('MAKE').length-1,1);
    await page.getByRole('checkbox',{name:'Reverse direction'}).check();
    assert.equal(await page.locator('.fb-marquee-track').evaluate(el=>getComputedStyle(el).animationDirection),'reverse');
    await setPaused(true);await page.mouse.move(2,2);
    const a=await page.locator('.fb-marquee-track').evaluate(el=>getComputedStyle(el).transform);await page.waitForTimeout(180);
    assert.equal(await page.locator('.fb-marquee-track').evaluate(el=>getComputedStyle(el).transform),a);
    await setPaused(false);await page.mouse.move(2,2);
    assert.equal(await page.locator('.fb-marquee-track').evaluate(el=>getComputedStyle(el).animationPlayState),'running');
    return {groupWidths:widths};
  });

  await check('view/source tabs support arrows, Home/End and roving tab stops',async()=>{
    await openComponent('split-reveal');await page.locator('#view-preview').focus();await page.keyboard.press('ArrowRight');
    await page.locator('#panel-code').waitFor();assert.equal(await page.locator('#view-code').getAttribute('aria-selected'),'true');
    assert.equal(await page.evaluate(()=>document.activeElement.id),'view-code');
    await page.locator('#source-jsx').focus();await page.keyboard.press('End');assert.equal(await page.evaluate(()=>document.activeElement.id),'source-usage');
    await page.keyboard.press('ArrowRight');assert.equal(await page.evaluate(()=>document.activeElement.id),'source-jsx');
    await page.keyboard.press('ArrowLeft');assert.equal(await page.evaluate(()=>document.activeElement.id),'source-usage');
    await page.keyboard.press('Home');assert.equal(await page.evaluate(()=>document.activeElement.id),'source-jsx');
    for(const label of ['Component view','Source file'])assert.equal(await page.getByRole('tablist',{name:label}).locator('[tabindex="0"]').count(),1);
    assert.equal(await page.locator('.cp-demo').count(),0,'Code view must unmount the live preview');
  });

  await check('every JSX source is copied/downloaded byte-for-byte and CSS/usage are usable',async()=>{
    const receipts=[];
    for(const item of catalogue) {
      await openComponent(item.id);await codeTab('jsx');
      const expected=sources.get(item.file);assert.equal(await page.locator('#sourcePanel pre code').textContent(),expected.toString());
      await page.getByRole('button',{name:'Copy source',exact:true}).click();
      await page.getByRole('button',{name:'Copied ✓',exact:true}).waitFor();
      assert.equal(await page.evaluate(()=>navigator.clipboard.readText()),expected.toString(),item.file+' clipboard');
      const promise=page.waitForEvent('download');await page.getByRole('button',{name:'Download '+item.file+'.jsx',exact:true}).click();const download=await promise;
      assert.equal(download.suggestedFilename(),item.file+'.jsx');const actual=await readFile(await download.path());assert.deepEqual(actual,expected);
      receipts.push({file:download.suggestedFilename(),bytes:actual.length,sha256:hash(actual)});
    }
    await codeTab('css');assert.equal(await page.locator('#sourcePanel pre code').textContent(),css.toString());
    const promise=page.waitForEvent('download');await page.getByRole('button',{name:'Download components.css',exact:true}).click();const download=await promise;assert.deepEqual(await readFile(await download.path()),css);
    await codeTab('usage');const usage=await page.locator('#sourcePanel pre code').textContent();assert.match(usage,/import LoopMarquee/);assert.match(usage,/import '.\/components.css'/);
    await screenshot('desktop-code');
    return {sources:receipts,css:{bytes:css.length,sha256:hash(css)}};
  });

  await check('runtime reduced motion stops all loops and pointer transforms',async()=>{
    await openComponent('wave-text');await page.emulateMedia({reducedMotion:'reduce'});
    await page.locator('.cp-motion-note').waitFor();
    assert.equal(await page.locator('.fb-wave-letter').first().evaluate(el=>getComputedStyle(el).animationName),'none');
    await openComponent('loop-marquee');assert.equal(await page.locator('.fb-marquee-track').evaluate(el=>getComputedStyle(el).animationName),'none');
    assert.equal(await page.locator('.fb-marquee-group[aria-hidden="true"]').isVisible(),false);
    await openComponent('tilt-card');const r=await page.locator('.fb-tilt').boundingBox();await page.mouse.move(r.x+r.width*.8,r.y+r.height*.2);
    assert.equal(await page.locator('.fb-tilt-card').evaluate(el=>getComputedStyle(el).transform),'none');
    await page.setViewportSize({width:390,height:1000});await openComponent('loop-marquee');await screenshot('mobile-reduced-marquee');
    await page.emulateMedia({reducedMotion:'no-preference'});await page.setViewportSize({width:1440,height:1100});
  });

  await check('all six gallery previews handle 80-character unbroken input at 320px',async()=>{
    await page.setViewportSize({width:320,height:1000});
    const results=[];
    for(const item of catalogue) {
      await openComponent(item.id);await page.locator('#componentText').fill('Supercalifragilisticexpialidocious'.repeat(3).slice(0,80));
      await setPaused(true);await page.mouse.move(2,2);const result=await measureOverflow();assert.ok(result.scroll<=result.client+1,item.name+': '+JSON.stringify(result));results.push({id:item.id,...result});
    }
    await screenshot('mobile-long-text-marquee');await page.setViewportSize({width:390,height:1000});await openComponent('spotlight-card');await screenshot('mobile-spotlight');
    await page.setViewportSize({width:1440,height:1100});
    return {previews:results};
  });

  await check('all seven app pages retain Components navigation and avoid overflow at four widths',async()=>{
    const results=[];
    for(const width of [320,390,768,1440]) {
      await page.setViewportSize({width,height:1000});
      for(const file of ['index.html','studio.html','dither.html','components.html','developers.html','photo.html','backgrounds.html']) {
        const response=await page.goto(new URL(file,site).href,{waitUntil:'networkidle'});assert.equal(response.status(),200,file);
        assert.ok(await page.locator('a[href$="components.html"]').count(),file+' Components link');
        const result=await measureOverflow();assert.ok(result.scroll<=result.client+1,file+' '+width+': '+JSON.stringify(result));
        results.push({file,width,client:result.client,scroll:result.scroll});
      }
    }
    return {layouts:results};
  });

  await check('source failure keeps preview working and retry recovers exact source',async()=>{
    const c=await newContext();const p=await c.newPage();monitor(p,'source-failure');let fail=true;
    await p.route('**/components/src/SpotlightCard.jsx',route=>{if(fail){fail=false;return route.fulfill({status:503,body:'QA deliberate source failure'});}return route.continue();});
    await openComponent('spotlight-card',p);assert.equal(await p.locator('.fb-spotlight').count(),1);
    await p.locator('#view-code').click();await p.getByRole('alert').waitFor();assert.equal(await p.getByRole('button',{name:'Copy source',exact:true}).isDisabled(),true);
    await p.locator('#source-usage').click();assert.match(await p.locator('#sourcePanel pre code').textContent(),/<SpotlightCard/);
    await p.locator('#source-jsx').click();await p.getByRole('button',{name:'Try again',exact:true}).click();
    await p.locator('#sourcePanel pre code').waitFor();assert.equal(await p.locator('#sourcePanel pre code').textContent(),sources.get('SpotlightCard').toString());
    await c.close();
  });

  await check('clipboard API failure falls back to selectable native copy',async()=>{
    const c=await newContext();await c.grantPermissions(['clipboard-read','clipboard-write'],{origin:new URL(target).origin});
    await c.addInitScript(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async()=>{throw new Error('Deliberate Clipboard API denial');}}}));
    const p=await c.newPage();monitor(p,'clipboard-fallback');await openComponent('split-reveal',p);await codeTab('jsx',p);
    await p.getByRole('button',{name:'Copy source',exact:true}).click();await p.getByRole('button',{name:'Copied ✓',exact:true}).waitFor();
    assert.equal(await p.locator('.cp-fallback-copy').count(),0);await c.close();
  });

  await check('touch pointer leaves magnetic and tilt art stable',async()=>{
    const c=await newContext({viewport:{width:390,height:1000},hasTouch:true,isMobile:true});const p=await c.newPage();monitor(p,'touch');
    for(const [id,selector,prop] of [['magnetic-button','.fb-magnetic','--fb-magnet-x'],['tilt-card','.fb-tilt','--fb-tilt-x'],['spotlight-card','.fb-spotlight','--fb-light-x']]) {
      await openComponent(id,p);const el=p.locator(selector),r=await el.boundingBox();
      await el.dispatchEvent('pointermove',{pointerType:'touch',clientX:r.x+r.width*.8,clientY:r.y+r.height*.2});
      assert.ok(['0px','0deg'].includes(await el.evaluate((el,prop)=>el.style.getPropertyValue(prop),prop)),id);
    }
    await c.close();
  });

  await check('downloaded standalone sources mount in StrictMode, wrap at 320px, and clean up listeners',async()=>{
    assert.ok(existsSync(esbuildPath),'Existing esbuild compiler must be available');
    const esbuild=await import(pathToFileURL(esbuildPath));const sourceDir=path.join(output,'downloaded-source-fixture');await mkdir(sourceDir,{recursive:true});
    for(const [name,body] of sources)await writeFile(path.join(sourceDir,name+'.jsx'),body);
    const entry=[
      "import React from 'react'; import {createRoot} from 'react-dom/client';",
      ...[...sources.keys()].map(name=>"import "+name+" from './"+name+".jsx';"),
      "function App(){const [mounted,setMounted]=React.useState(true);const [disabled,setDisabled]=React.useState(false);React.useEffect(()=>{window.__fixture={setMounted,setDisabled};window.__fixtureReady=true;return()=>{window.__fixtureReady=false};},[]);const long='Supercalifragilisticexpialidocious'.repeat(4);return <main><button id='toggle' onClick={()=>setMounted(x=>!x)}>Toggle components</button>{mounted?<div id='standalone'><section><SplitReveal>{long}</SplitReveal></section><section><WaveText>{long}</WaveText></section><section><MagneticButton id='standaloneMagnetic' name='native' aria-label='Native forwarded button' disabled={disabled} onClick={()=>window.__nativeClicks++}>{long}</MagneticButton></section><section><SpotlightCard title={long}><a href='#example'>A real child link</a></SpotlightCard></section><section><TiltCard title={long}>{long}</TiltCard></section><section><LoopMarquee items={[long,'MAKE','PLAY']} /></section></div>:null}</main>}window.__nativeClicks=0;createRoot(document.getElementById('root')).render(<React.StrictMode><App/></React.StrictMode>);"
    ].join('\n');
    const compiled=await esbuild.build({stdin:{contents:entry,resolveDir:sourceDir,sourcefile:'fixture.jsx',loader:'jsx'},bundle:true,write:false,format:'esm',platform:'browser',target:['es2020'],jsx:'automatic',nodePaths:[reactPath],define:{'process.env.NODE_ENV':'"development"'}});
    const c=await newContext({viewport:{width:320,height:1000}});
    await c.addInitScript(()=>{
      const add=EventTarget.prototype.addEventListener,remove=EventTarget.prototype.removeEventListener,active=new Map();let adds=0,removes=0;
      function watched(target,type){return (target===window&&type==='blur')||(typeof MediaQueryList!=='undefined'&&target instanceof MediaQueryList&&type==='change');}
      EventTarget.prototype.addEventListener=function(type,listener,options){if(watched(this,type)){let group=active.get(this);if(!group)active.set(this,group=new Map());let listeners=group.get(type);if(!listeners)group.set(type,listeners=new Set());listeners.add(listener);adds++;}return add.call(this,type,listener,options);};
      EventTarget.prototype.removeEventListener=function(type,listener,options){if(watched(this,type)){active.get(this)?.get(type)?.delete(listener);removes++;}return remove.call(this,type,listener,options);};
      window.__listenerStats=()=>({adds,removes,active:[...active.values()].reduce((sum,group)=>sum+[...group.values()].reduce((n,set)=>n+set.size,0),0)});
    });
    const p=await c.newPage();monitor(p,'standalone');
    await p.route('**/__fluid-components-qa__/fixture',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/components/components.css"><style>html,body{margin:0;padding:0;background:#101112;color:#f1efeb;font:16px Arial,sans-serif}main{padding:16px;box-sizing:border-box;width:100%}section{margin:48px 0;max-width:100%;box-sizing:border-box}#toggle{min-height:44px;max-width:100%}</style></head><body><div id="root"></div><script type="module" src="/__fluid-components-qa__/standalone.js"></script></body></html>'}));
    await p.route('**/__fluid-components-qa__/standalone.js',route=>route.fulfill({contentType:'text/javascript',body:compiled.outputFiles[0].text}));
    await p.goto(new URL('__fluid-components-qa__/fixture',site).href,{waitUntil:'networkidle'});await p.waitForFunction(()=>window.__fixtureReady&&document.querySelectorAll('#standalone .fb-component').length===6);
    const mounted=await p.evaluate(()=>window.__listenerStats());assert.equal(mounted.active,6);assert.ok(mounted.adds>=12,'Development StrictMode must run effect cleanup/remount');
    const overflow=await measureOverflow(p);assert.ok(overflow.scroll<=overflow.client+1,JSON.stringify(overflow));
    await screenshot('standalone-long-text-320',p);
    const native=p.locator('#standaloneMagnetic');assert.equal(await native.getAttribute('name'),'native');assert.equal(await native.getAttribute('type'),'button');
    await native.focus();await p.keyboard.press('Enter');assert.equal(await p.evaluate(()=>window.__nativeClicks),1);
    await p.evaluate(()=>window.__fixture.setDisabled(true));await p.waitForFunction(()=>document.querySelector('#standaloneMagnetic').disabled);
    assert.equal(await native.isDisabled(),true);
    await p.locator('#toggle').click();await p.waitForFunction(()=>!document.querySelector('#standalone'));
    const unmounted=await p.evaluate(()=>window.__listenerStats());assert.equal(unmounted.active,0);assert.equal(unmounted.adds,unmounted.removes);
    await p.locator('#toggle').click();await p.waitForFunction(()=>document.querySelectorAll('#standalone .fb-component').length===6);
    await p.waitForFunction(()=>window.__listenerStats().active===6);
    await p.emulateMedia({reducedMotion:'reduce'});await p.waitForTimeout(100);
    const reducedOverflow=await measureOverflow(p);assert.ok(reducedOverflow.scroll<=reducedOverflow.client+1,JSON.stringify(reducedOverflow));
    assert.equal(await p.locator('.fb-wave-letter').first().evaluate(el=>getComputedStyle(el).animationName),'none');
    await p.locator('#toggle').click();await p.waitForFunction(()=>!document.querySelector('#standalone'));
    assert.equal((await p.evaluate(()=>window.__listenerStats())).active,0);
    await c.close();return {mounted,unmounted,overflow,reducedOverflow,compiler:esbuildPath};
  });

  phase='final';
  if(page&&!page.isClosed())report.cspViolations.push(...await page.evaluate(()=>window.__fluidCsp||[]));
  await check('gallery produced no uncaught JavaScript errors or CSP violations',async()=>{
    const relevant=report.pageErrors.filter(x=>x.label!=='shared-nav');assert.deepEqual(relevant,[]);
    assert.deepEqual(report.cspViolations,[]);return {pageErrors:report.pageErrors,consoleErrors:report.consoleErrors};
  });
} catch(error) {
  report.fatal=error.stack||error.message;console.error(report.fatal);
} finally {
  if(browser)await browser.close();
  report.pass=!report.fatal&&report.checks.every(x=>x.pass);
  report.passed=report.checks.filter(x=>x.pass).length;report.failed=report.checks.filter(x=>!x.pass).length;
  await writeFile(path.join(output,'report.json'),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({pass:report.pass,passed:report.passed,failed:report.failed,report:path.join(output,'report.json'),screenshots:report.screenshots}));
  process.exitCode=report.pass?0:1;
}
