'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const env={STAGE:'test',ASSETS:{fetch:async()=>new Response('')}};
async function api(query){const {default:w}=await import('../worker.js');return w.fetch(new Request('https://fluid.test/api/piece?'+query),env);}

test('every artist recipe survives the public API and native-library decoder',async()=>{
  const {LOOKS,MATERIALS,SUBSTRATES,FIELDS,parseShareHash}=await import('../fluid-core/src/index.js');
  const recipes=LOOKS.filter(l=>l.substrate!=null);
  assert.equal(recipes.length,16);
  for(const look of recipes){
    const response=await api('look='+encodeURIComponent(look.label.toLowerCase()));
    assert.equal(response.status,200,look.label);
    const piece=await response.json();const decoded=parseShareHash(piece.share_url);
    assert.equal(piece.params.field,FIELDS[look.field]);
    assert.equal(piece.params.finish,MATERIALS[look.material]);
    assert.equal(piece.params.substrate,SUBSTRATES[look.substrate]);
    assert.equal(decoded.material,look.material);assert.equal(decoded.substrate,look.substrate);
    assert.equal(decoded.textureScale,look.textureScale);assert.equal(decoded.substrateAmt,look.substrateAmt);
    assert.deepEqual(decoded.colors,look.cols);
  }
});
test('REST exposes artistic options and keeps disabled strengths at zero',async()=>{
  const response=await api('field=spray&finish=graffiti&substrate=concrete&materialAmt=0&textureScale=2.5&relief=0&substrateAmt=0');
  assert.equal(response.status,200);
  const {parseShareHash}=await import('../fluid-core/src/index.js');
  const p=parseShareHash((await response.json()).share_url);
  assert.equal(p.field,25);assert.equal(p.material,8);assert.equal(p.substrate,3);
  assert.equal(p.materialAmt,0);assert.equal(p.relief,0);assert.equal(p.substrateAmt,0);assert.equal(p.textureScale,2.5);
});
test('API rejects unknown substrates and invalid artistic numeric values',async()=>{
  for(const query of ['substrate=missing','textureScale=NaN','materialAmt=Infinity'])assert.equal((await api(query)).status,400,query);
});
test('old hashes receive neutral material extension defaults',async()=>{
  const {parseShareHash}=await import('../fluid-core/src/index.js');
  const p=parseShareHash('#p=0.5,1.5,5.5,0.03,1,10,0,0,18,0,0,1.7778,0,0,1');
  assert.deepEqual([p.substrate,p.materialAmt,p.textureScale,p.relief,p.substrateAmt],[0,1,1,1,.55]);
});

test('the deployed embed bundle was built from the current engine, registries and codecs',()=>{
  const fs=require('node:fs');const path=require('node:path');const {createHash}=require('node:crypto');
  const root=path.join(__dirname,'..');const hash=createHash('sha256');
  for(const file of ['generated/shader.js','generated/data.js','mount.js','hash.js'])hash.update(fs.readFileSync(path.join(root,'fluid-core/src',file)));
  const bundle=fs.readFileSync(path.join(root,'assets/fluid-bg.iife.js'),'utf8');
  assert.ok(bundle.includes('fluid-source-sha256:'+hash.digest('hex')),'Run npm run build inside fluid-bg; embeds must use the current renderer');
});
