import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { collectComponentSources, EXPECTED_COMPONENT_IDS, relativeImports, validateBundledComponentInputs, validateComponentCatalogue, validatePublicComponentPath } from '../scripts/build-components.mjs';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const SITE = path.join(ROOT, 'site');
const json = async name => JSON.parse(await readFile(path.join(SITE, name), 'utf8'));

test('creative catalogue contains the original six and all 33 requested additions with valid controls', async () => {
  const catalogue = await json('components/catalogue.json');
  assert.equal(catalogue.length, 39);
  assert.equal(validateComponentCatalogue(catalogue), catalogue);
  assert.deepEqual(new Set(catalogue.map(item => item.id)), new Set(EXPECTED_COMPONENT_IDS));
  assert.equal(new Set(catalogue.map(item => item.file)).size, 39);
  const legacy = await json('components/manifests/legacy.json');
  assert.equal(legacy.length, 6);
  for (const item of legacy) {
    assert.equal(item.type, 'component'); assert.equal(item.css, 'components/components.css');
    assert.equal(item.defaults.text, item.text); assert.equal(item.defaults.amount, item.amount);
    assert.equal(item.defaults.color, '#ff916a'); assert.equal(item.defaults.reverse, false);
    assert.equal(item.controls[0].key, 'text'); assert.equal(item.controls[0].maxLength, 80);
  }
  for (const item of catalogue) {
    assert.equal(item.file, item.filebasename);
    assert.ok(Array.isArray(item.controls), item.id);
    if (item.type === 'tool') {
      assert.match(item.defaults.color, /^#[0-9a-f]{6}$/i);
      const source = await readFile(path.join(SITE, 'components/src/' + item.file + '.jsx'), 'utf8');
      assert.match(source, /<ToolShell[\s>]/, item.id);
    } else assert.ok(item.controls.length > 0, item.id);
    assert.ok(item.props.length > 0, item.id);
    assert.ok(!item.capabilities.includes('webm'), 'Video is not advertised without a recorder.');
  }
});

test('generated registry imports every exact default source and offers a default ID map', async () => {
  const catalogue = await json('components/catalogue.json');
  const registry = await readFile(path.join(SITE, 'components/registry.jsx'), 'utf8');
  assert.equal((registry.match(/^import Component\d+ from /gm) || []).length, 39);
  assert.match(registry, /export default registry;/);
  for (const [index, item] of catalogue.entries()) {
    assert.ok(registry.includes("import Component" + index + " from './src/" + item.file + ".jsx';"), item.id);
    assert.ok(registry.includes(JSON.stringify(item.id) + ': Component' + index), item.id);
  }
});

test('source manifest is the complete recursive graph with portable CSS and licenses', async () => {
  const catalogue = await json('components/catalogue.json');
  const current = await json('components/source-manifest.json');
  const { manifest, sources } = await collectComponentSources({ siteDir: SITE, catalogue });
  assert.deepEqual(current, manifest);
  for (const item of catalogue) {
    const files = manifest.entries[item.id];
    assert.equal(files[0], 'components/src/' + item.file + '.jsx');
    assert.ok(files.includes(item.css), item.id);
    assert.ok(files.includes('components/LICENSE'), item.id);
    for (const name of files) {
      assert.equal(validatePublicComponentPath(name), name);
      assert.ok(sources.has(name), name);
      assert.ok(!/(?:^|\/)(?:manifests|qa|scripts|node_modules)(?:\/|$)|components\/(?:gallery|registry)/.test(name), name);
      if (/\.(?:js|jsx)$/.test(name)) for (const dependency of relativeImports(sources.get(name).toString('utf8'), name)) assert.ok(files.includes(dependency), item.id + ' misses ' + dependency);
    }
  }
  for (const name of ['components/src/shared/tool-composition.js','components/src/shared/tool-art.js','components/src/shared/tool-upload.js']) assert.ok(manifest.entries['hero-composer'].includes(name), name);
  assert.ok(manifest.entries['animated-poster'].includes('components/src/shared/interaction-poster.js'));
  assert.ok(manifest.entries['fluid-hero'].includes('components/src/shared/art-kit.jsx'));
});

test('metadata validation rejects duplicate IDs, missing requested entries and broken control defaults', async () => {
  const catalogue = await json('components/catalogue.json');
  const copy = () => structuredClone(catalogue);
  let invalid = copy(); invalid[1].id = invalid[0].id;
  assert.throws(() => validateComponentCatalogue(invalid), /Duplicate or invalid component id/);
  invalid = copy(); invalid[0].id = 'unrequested-piece';
  assert.throws(() => validateComponentCatalogue(invalid), /Missing required component/);
  invalid = copy(); invalid.find(item => item.id === 'living-progress').defaults.progress = 101;
  assert.throws(() => validateComponentCatalogue(invalid), /Invalid range default/);
  invalid = copy(); invalid.find(item => item.id === 'animated-poster').defaults.motion = 'unknown';
  assert.throws(() => validateComponentCatalogue(invalid), /Invalid select default/);
  invalid = copy(); invalid[0].capabilities = ['pretend-video'];
  assert.throws(() => validateComponentCatalogue(invalid), /Invalid export capability/);
});

test('source import scanning preserves relative helpers and rejects nonportable imports', () => {
  const source = "import React from 'react';\nimport { helper } from './shared/one.jsx';\nexport { value } from './shared/two.js';\nconst later = import('./shared/three.js');";
  assert.deepEqual(relativeImports(source, 'components/src/Example.jsx'), ['components/src/shared/one.jsx','components/src/shared/two.js','components/src/shared/three.js']);
  for (const source of ["import './.env.js';", "import '../../../private.js';", "import value from 'unlisted-package';", "import '/absolute.js';"]) assert.throws(() => relativeImports(source, 'components/src/Example.jsx'), /component path|Only React/);
  for (const name of ['components/gallery.jsx','components/registry.jsx','components/manifests/legacy.json','components/src/.secret.js','components/src/shared/../secret.js','../secret.js','components/src/shared/credentials.js']) assert.throws(() => validatePublicComponentPath(name), /component path|Private component asset/);
});


test('source graph parser handles same-line imports and ignores string/comment/JSX lookalikes', () => {
  const name = 'components/src/Example.jsx';
  const source = [
    "const flag = true; import { helper } from './shared/one.js'; export { value } from './shared/two.js';",
    "const generated = `import Ghost from '../../private.js';`;",
    'const quoted = "import Fake from \'../../private.js\';";',
    "// import Hidden from '../../private.js';",
    "/* export { hidden } from '../../private.js'; */",
    "const pattern = /import Ghost from ['\"]/;",
    "const content = <p>import Ghost from '../../private.js';</p>;",
    "const interpolated = `actual ${import('./shared/three.js')}`;",
    "export const result = { flag, generated, quoted, pattern, content, interpolated, helper };"
  ].join('\n');
  assert.deepEqual(relativeImports(source, name), ['components/src/shared/one.js','components/src/shared/two.js','components/src/shared/three.js']);
  for (const source of [
    "const flag = true; import Hidden from '../../private.js';",
    "const flag = true; export { hidden } from '../../private.js';",
    "const text = `actual ${import('../../../private.js')}`; export { text };",
    "const flag = true; import value from 'unlisted-package';"
  ]) assert.throws(() => relativeImports(source, name), /component path|Only React/);
});

test('actual bundle inputs cannot bypass the public graph or import gallery authoring modules', () => {
  const rootDir = '/tmp/fluid-source-graph-test';
  const manifest = {entries:{example:['components/src/Example.jsx','components/src/shared/helper.js']}};
  const create = () => ({inputs:{
    'site/components/gallery.jsx':{imports:[{path:'site/components/registry.jsx',original:'./registry.jsx'}]},
    'site/components/gallery-support.js':{imports:[]},
    'site/components/registry.jsx':{imports:[{path:'site/components/src/Example.jsx',original:'./src/Example.jsx'}]},
    'site/components/src/Example.jsx':{imports:[{path:'site/components/src/shared/helper.js',original:'./shared/helper.js'},{path:'node_modules/react/index.js',original:'react'}]},
    'site/components/src/shared/helper.js':{imports:[]},
    'node_modules/react/index.js':{imports:[]}
  }});
  const valid = create();
  assert.equal(validateBundledComponentInputs(valid,manifest,{rootDir}),valid);
  let invalid=create();invalid.inputs['site/components/src/Example.jsx'].imports.push({path:'site/components/gallery-support.js',original:'../gallery-support.js'});
  assert.throws(()=>validateBundledComponentInputs(invalid,manifest,{rootDir}),/component path/);
  invalid=create();invalid.inputs['site/components/src/Example.jsx'].imports.push({path:'private.js',original:'../../../private.js'});
  assert.throws(()=>validateBundledComponentInputs(invalid,manifest,{rootDir}),/leaves the public source graph/);
  invalid=create();invalid.inputs['site/components/src/shared/undeclared.js']={imports:[]};
  assert.throws(()=>validateBundledComponentInputs(invalid,manifest,{rootDir}),/missing from the public graph/);
  invalid=create();invalid.inputs['site/private.js']={imports:[]};
  assert.throws(()=>validateBundledComponentInputs(invalid,manifest,{rootDir}),/component path/);
});
