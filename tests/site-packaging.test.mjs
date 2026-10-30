import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { lstat, mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { buildSite, LEGACY_FILES, SITE_FILES } from '../scripts/build-site.mjs';
import { collectComponentSources } from '../scripts/build-components.mjs';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
async function write(root, name, content) {
  const file = path.join(root, name);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, content);
}
function fixtureContent(name) {
  return /\.(?:js|jsx)$/.test(name) ? '// site ' + name + '\nexport const fixture = true;\n' : 'site ' + name;
}
async function fixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'fluid-site-packaging-'));
  for (const file of LEGACY_FILES) await write(root, file, 'legacy ' + file);
  await write(root, 'index.html', 'offline studio source');
  await write(root, 'assets/og.png', new Uint8Array([1, 2, 3]));
  await write(root, 'assets/gallery/example.jpg', new Uint8Array([4, 5, 6]));
  await write(root, 'assets/.env', 'excluded');
  await write(root, 'assets/private.json', 'excluded');
  for (const file of SITE_FILES) await write(root, 'site/' + file, fixtureContent(file));
  const componentCatalogue = JSON.parse(await readFile(path.join(ROOT, 'site/components/catalogue.json'), 'utf8'));
  await write(root, 'site/components/catalogue.json', JSON.stringify(componentCatalogue));
  const sourceFiles = new Set(componentCatalogue.flatMap(item => ['components/src/' + item.file + '.jsx', ...item.dependencies]));
  for (const name of sourceFiles) if (!SITE_FILES.includes(name)) await write(root, 'site/' + name, fixtureContent(name));
  // Exercise a real transitive source graph, not only explicitly declared helpers.
  await write(root, 'site/components/src/WaveText.jsx', "import './shared/packaging-root.js';\nexport default function WaveText() {}\n");
  await write(root, 'site/components/src/shared/packaging-root.js', "export { value } from './packaging-leaf.js';\n");
  await write(root, 'site/components/src/shared/packaging-leaf.js', 'export const value = 42;');
  const { manifest } = await collectComponentSources({ siteDir: path.join(root, 'site'), catalogue: componentCatalogue });
  await write(root, 'site/components/source-manifest.json', JSON.stringify(manifest));
  await write(root, 'site/catalogue.json', JSON.stringify({ looks: [{ thumbnail: 'assets/look-thumbnails/example.webp' }] }));
  await write(root, 'site/assets/look-thumbnails/example.webp', new Uint8Array([7, 8, 9]));
  await write(root, 'site/PROJECT.md', 'private source context /Users/example/project');
  await write(root, 'site/qa/private.json', '{"path":"/opt/private"}');
  await write(root, 'site/scripts/private.js', 'const source = "/root/private";');
  await write(root, 'site/components/gallery.jsx', 'private gallery tooling source');
  await write(root, 'site/components/registry.jsx', 'private registry tooling source');
  await write(root, 'site/components/gallery-support.js', 'private gallery helper source');
  await write(root, 'site/components/manifests/private.json', 'private authoring manifest');
  await write(root, 'site/components/qa/private.json', '{"path":"/opt/private"}');
  return root;
}
async function digest(root, names) {
  const hash = createHash('sha256');
  for (const name of names) hash.update(name).update(await readFile(path.join(root, name)));
  return hash.digest('hex');
}

test('explicit packaging keeps new runtime, public guides and legacy URLs, and excludes private inputs', async () => {
  const root = await fixture();
  try {
    const result = await buildSite({ rootDir: root });
    assert.equal(await readFile(path.join(root, 'index.html'), 'utf8'), 'offline studio source');
    assert.equal(await readFile(path.join(result.directory, 'index.html'), 'utf8'), 'site index.html');
    for (const file of [...SITE_FILES, ...LEGACY_FILES, 'assets/og.png', 'assets/gallery/example.jpg', 'assets/look-thumbnails/example.webp', 'fluid-bg.js', 'assets/fluid-bg.iife.js', 'fluid-core/src/index.js', 'fluid-core/src/index.d.ts', 'docs/MATERIALS.md']) {
      assert.ok((await lstat(path.join(result.directory, file))).isFile(), file);
    }
    for (const file of result.files) {
      assert.ok(!/(?:^|\/)(?:qa|scripts|PROJECT\.md|\.env|private\.json)(?:\/|$)/.test(file), file);
      const text = await readFile(path.join(result.directory, file), 'utf8');
      assert.ok(!/\/Users\/|\/opt\/|\/root\//.test(text), file);
    }
    // Copyable component sources are intentional public assets; gallery tooling is not.
    for (const file of ['components/gallery.jsx', 'components/registry.jsx', 'components/gallery-support.js', 'components/manifests/private.json', 'components/qa/private.json']) {
      assert.ok(!result.files.includes(file), file);
    }
    assert.equal(await readFile(path.join(result.directory, 'components/src/SplitReveal.jsx'), 'utf8'), fixtureContent('components/src/SplitReveal.jsx'));
    assert.equal(await readFile(path.join(result.directory, 'components/src/shared/packaging-leaf.js'), 'utf8'), 'export const value = 42;');
    const sources = JSON.parse(await readFile(path.join(result.directory, 'components/source-manifest.json'), 'utf8'));
    assert.equal(Object.keys(sources.entries).length, 39);
    for (const names of Object.values(sources.entries)) for (const name of names) assert.ok(result.files.includes(name), name);
    assert.equal(await readFile(path.join(result.directory, 'components/gallery.js.LEGAL.txt'), 'utf8'), 'site components/gallery.js.LEGAL.txt');
    assert.equal(await readFile(path.join(result.directory, 'fluid-core/src/index.js'), 'utf8'), fixtureContent('vendor/fluid-core/src/index.js'));
    const first = await digest(result.directory, result.files);
    await write(result.directory, 'stale.js', 'stale output');
    const second = await buildSite({ rootDir: root });
    assert.deepEqual(second.files, result.files);
    assert.equal(await digest(second.directory, second.files), first);
    assert.ok(!(await readdir(second.directory)).includes('stale.js'));
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('invalid public input preserves the previous output', async () => {
  const root = await fixture();
  try {
    await write(root, '.public/previous.txt', 'keep previous build');
    await write(root, 'site/dither.js', 'const leaked = "/Users/example/private";');
    await assert.rejects(buildSite({ rootDir: root }), /Private filesystem reference/);
    assert.equal(await readFile(path.join(root, '.public/previous.txt'), 'utf8'), 'keep previous build');
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('private references in downloadable JSX are rejected before replacing a public build', async () => {
  const root = await fixture();
  try {
    await write(root, '.public/previous.txt', 'keep previous build');
    await write(root, 'site/components/src/SplitReveal.jsx', 'export const privatePath = "/opt/private";');
    await assert.rejects(buildSite({ rootDir: root }), /Private filesystem reference in public input: components\/src\/SplitReveal\.jsx/);
    assert.equal(await readFile(path.join(root, '.public/previous.txt'), 'utf8'), 'keep previous build');
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('symlink output is rejected without deleting its destination', async () => {
  const root = await fixture();
  const outside = await mkdtemp(path.join(os.tmpdir(), 'fluid-unowned-'));
  try {
    await write(outside, 'untouched.txt', 'untouched');
    await symlink(outside, path.join(root, '.public'), 'dir');
    await assert.rejects(buildSite({ rootDir: root }), /Refusing to replace/);
    assert.equal(await readFile(path.join(outside, 'untouched.txt'), 'utf8'), 'untouched');
  } finally {
    await rm(root, { recursive: true, force: true });
    await rm(outside, { recursive: true, force: true });
  }
});

test('legacy bridge preserves complete art hashes and query, while normal section anchors remain on Explore', async () => {
  const code = await readFile(path.join(ROOT, 'site/legacy-links.js'), 'utf8');
  for (const hash of ['#p=0.5,1,2&t=Hello%20world&tf=3&tb=112233', '#e=1,2,3']) {
    const redirects = [];
    const location = { hash, search: '?source=mcp&seed=42', replace: (url) => redirects.push(url) };
    vm.runInNewContext(code, { location });
    assert.deepEqual(redirects, ['/studio?source=mcp&seed=42' + hash]);
  }
  for (const hash of ['', '#collections', '#looks', '#ditherEditor', '#painter', '#example=42']) {
    const redirects = [];
    vm.runInNewContext(code, { location: { hash, search: '', replace: (url) => redirects.push(url) } });
    assert.deepEqual(redirects, [], hash);
  }
  const html = await readFile(path.join(ROOT, 'site/index.html'), 'utf8');
  assert.ok(html.indexOf('src="legacy-links.js"') > html.indexOf('<head>'));
  assert.ok(html.indexOf('src="legacy-links.js"') < html.indexOf('</head>'));
  assert.ok(html.indexOf('src="legacy-links.js"') < html.indexOf('type="module"'));
  assert.match(html, /<script src="legacy-links\.js"><\/script>/);
});

test('published typography uses local variable Latin fonts with source and OFL notices', async () => {
  const css = await readFile(path.join(ROOT, 'site/styles.css'), 'utf8');
  assert.ok(!css.includes('fonts.googleapis.com'));
  assert.match(css, /font-family:\s*['"]DM Sans['"]/);
  assert.match(css, /font-family:\s*['"]Space Grotesk['"]/);
  assert.equal((css.match(/font-weight:\s*400 700/g) || []).length, 2);
  assert.equal((css.match(/font-display:\s*swap/g) || []).length, 2);
  for (const file of ['dm-sans-latin-variable.woff2', 'space-grotesk-latin-variable.woff2']) {
    const data = await readFile(path.join(ROOT, 'site/assets/fonts', file));
    assert.equal(data.subarray(0, 4).toString(), 'wOF2', file);
    assert.ok(data.length > 1000 && data.length < 100000, file);
  }
  for (const name of ['OFL-DM-Sans.txt', 'OFL-Space-Grotesk.txt']) {
    assert.match(await readFile(path.join(ROOT, 'site/assets/fonts', name), 'utf8'), /SIL OPEN FONT LICENSE/);
  }
});


test('source manifest cannot publish authoring files or escape its source tree', async () => {
  for (const forbidden of ['components/gallery.jsx','components/registry.jsx','components/manifests/legacy.json','components/qa/private.js','components/src/../gallery.jsx','../.env','components/src/.env.js']) {
    const root = await fixture();
    try {
      await write(root, '.public/previous.txt', 'keep previous build');
      const file = path.join(root, 'site/components/source-manifest.json');
      const manifest = JSON.parse(await readFile(file, 'utf8'));
      manifest.entries['wave-text'].push(forbidden);
      await writeFile(file, JSON.stringify(manifest));
      await assert.rejects(buildSite({ rootDir: root }), /component path|Private component asset/);
      assert.equal(await readFile(path.join(root, '.public/previous.txt'), 'utf8'), 'keep previous build');
    } finally { await rm(root, { recursive: true, force: true }); }
  }
});

test('a missing recursive helper or widened manifest preserves previous output', async () => {
  const root = await fixture();
  try {
    await write(root, '.public/previous.txt', 'keep previous build');
    const file = path.join(root, 'site/components/source-manifest.json');
    const manifest = JSON.parse(await readFile(file, 'utf8'));
    manifest.entries['wave-text'] = manifest.entries['wave-text'].filter(name => !name.endsWith('packaging-leaf.js'));
    await writeFile(file, JSON.stringify(manifest));
    await assert.rejects(buildSite({ rootDir: root }), /Stale or incomplete component source manifest/);
    assert.equal(await readFile(path.join(root, '.public/previous.txt'), 'utf8'), 'keep previous build');
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('private references and symlinks in recursive helpers are rejected before output replacement', async () => {
  for (const mode of ['private','symlink']) {
    const root = await fixture(), outside = await mkdtemp(path.join(os.tmpdir(), 'fluid-source-outside-'));
    try {
      await write(root, '.public/previous.txt', 'keep previous build');
      const source = 'site/components/src/shared/packaging-leaf.js';
      if (mode === 'private') await write(root, source, 'export const source = "/root/private";');
      else { await write(outside, 'leaf.js', 'export const value = 42;'); await rm(path.join(root, source)); await symlink(path.join(outside, 'leaf.js'), path.join(root, source)); }
      await assert.rejects(buildSite({ rootDir: root }), /Private filesystem reference|ordinary file inside site/);
      assert.equal(await readFile(path.join(root, '.public/previous.txt'), 'utf8'), 'keep previous build');
    } finally { await rm(root, { recursive: true, force: true }); await rm(outside, { recursive: true, force: true }); }
  }
});
