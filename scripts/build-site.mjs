import { lstat, mkdir, readFile, readdir, realpath, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { collectComponentSources, validateComponentCatalogue, validatePublicComponentPath } from './build-components.mjs';

const DEFAULT_ROOT = fileURLToPath(new URL('../', import.meta.url));
export const SITE_FILES = Object.freeze([
  'index.html', 'studio.html', 'photo.html', 'backgrounds.html', 'developers.html', 'dither.html',
  'components.html', 'components.css',
  'components/gallery.js', 'components/gallery.js.LEGAL.txt', 'components/components.css',
  'components/catalogue.json', 'components/source-manifest.json', 'components/LICENSE',
  'components/visual.css', 'components/interactions.css', 'components/tools.css', 'components/sections.css',
  'components/src/SplitReveal.jsx', 'components/src/WaveText.jsx', 'components/src/MagneticButton.jsx',
  'components/src/SpotlightCard.jsx', 'components/src/TiltCard.jsx', 'components/src/LoopMarquee.jsx',
  'styles.css', 'explore.css', 'dither.css',
  'app.js', 'engine.js', 'explore.js', 'pixel-hero.js', 'pixel-hero-points.js', 'catalogue.js', 'studio-bridge.js',
  'dither.js', 'dither-worker.js', 'dither-core.js', 'legacy-links.js',
  'catalogue.json', 'favicon.svg',
  'assets/anthurium.png', 'assets/fluid-wordmark.svg', 'assets/fluid-pixels.svg',
  'assets/fonts/dm-sans-latin-variable.woff2', 'assets/fonts/space-grotesk-latin-variable.woff2',
  'assets/fonts/OFL-DM-Sans.txt', 'assets/fonts/OFL-Space-Grotesk.txt', 'assets/fonts/SOURCES.md',
  'vendor/fluid-core/README.md', 'vendor/fluid-core/LICENSE',
  'vendor/fluid-core/src/index.js', 'vendor/fluid-core/src/mount.js', 'vendor/fluid-core/src/hash.js',
  'vendor/fluid-core/src/index.d.ts', 'vendor/fluid-core/src/generated/data.js', 'vendor/fluid-core/src/generated/shader.js',
  'vendor/docs/MATERIALS.md',
  'vendor/studio-assets/favicon.svg', 'vendor/studio-assets/favicon-32.png',
  'vendor/studio-assets/favicon.png', 'vendor/studio-assets/apple-touch-icon.png',
  'vendor/studio-assets/fluid-favicon.js', 'vendor/studio-assets/fluid-bg.iife.js', 'vendor/studio-assets/LICENSE'
]);
export const LEGACY_FILES = Object.freeze(['dev.html', 'manual.html', 'gallery.html', 'LICENSE']);
const PUBLIC_ASSET_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.svg', '.gif', '.js', '.ico', '.woff', '.woff2']);
const PRIVATE_REFERENCE = /(?:\/Users\/|\/opt\/|\/root\/|\.codex\/|\.claude\/)/;

function publicText(name) {
  return /\.(?:html|css|js|jsx|json|md|txt|ts)$/i.test(name) || path.basename(name) === 'LICENSE';
}
async function safeRead(root, relative) {
  const input = path.join(root, relative);
  const actual = await realpath(input);
  if (!actual.startsWith(root + path.sep) || !(await lstat(input)).isFile()) {
    throw new Error(`Public input must be a regular file inside its source directory: ${relative}`);
  }
  const data = await readFile(input);
  if (publicText(relative) && PRIVATE_REFERENCE.test(data.toString('utf8'))) {
    throw new Error(`Private filesystem reference in public input: ${relative}`);
  }
  return data;
}
async function filesBelow(root, relative) {
  const directory = path.join(root, relative);
  const actual = await realpath(directory);
  if (!actual.startsWith(root + path.sep)) throw new Error(`Public directory leaves its source: ${relative}`);
  const found = [];
  for (const entry of (await readdir(directory, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name, 'en'))) {
    if (entry.name.startsWith('.')) continue;
    const next = relative + '/' + entry.name;
    if (entry.isSymbolicLink()) throw new Error(`Symbolic links are not public assets: ${next}`);
    if (entry.isDirectory()) found.push(...await filesBelow(root, next));
    else if (entry.isFile()) found.push(next);
  }
  return found;
}

/** Build only the repository-owned .public directory; no output-path override is accepted. */
export async function buildSite({ rootDir = DEFAULT_ROOT } = {}) {
  const root = await realpath(rootDir);
  const site = await realpath(path.join(root, 'site'));
  if (!site.startsWith(root + path.sep)) throw new Error('Site source must remain inside the repository.');
  const output = path.join(root, '.public');
  let existing;
  try { existing = await lstat(output); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  if (existing?.isSymbolicLink() || (existing && !existing.isDirectory())) {
    throw new Error('Refusing to replace .public unless it is an ordinary repository-owned directory.');
  }

  // Collect and validate every input before touching a previous public build.
  const files = new Map();
  for (const name of LEGACY_FILES) files.set(name, await safeRead(root, name));
  for (const name of await filesBelow(root, 'assets')) {
    if (PUBLIC_ASSET_EXTENSIONS.has(path.extname(name).toLowerCase())) files.set(name, await safeRead(root, name));
  }
  for (const name of SITE_FILES) files.set(name, await safeRead(site, name));
  const componentCatalogue = validateComponentCatalogue(JSON.parse(files.get('components/catalogue.json').toString('utf8')));
  const declared = JSON.parse(files.get('components/source-manifest.json').toString('utf8'));
  if (declared?.version !== 1 || !declared.entries || typeof declared.entries !== 'object' || Array.isArray(declared.entries)) throw new Error('Invalid component source manifest.');
  const componentIds = componentCatalogue.map(item => item.id);
  if (Object.keys(declared.entries).length !== componentIds.length || Object.keys(declared.entries).some(id => !componentIds.includes(id))) throw new Error('Component source manifest does not match the catalogue.');
  for (const id of componentIds) {
    const entries = declared.entries[id];
    if (!Array.isArray(entries) || !entries.length || new Set(entries).size !== entries.length) throw new Error('Invalid component source entry: ' + id);
    entries.forEach(validatePublicComponentPath);
  }
  // Recompute the graph from source. A stale manifest cannot widen publication.
  const expected = await collectComponentSources({ siteDir: site, catalogue: componentCatalogue });
  for (const id of componentIds) {
    if (JSON.stringify(declared.entries[id]) !== JSON.stringify(expected.manifest.entries[id])) throw new Error('Stale or incomplete component source manifest: ' + id);
    for (const name of declared.entries[id]) if (!files.has(name)) files.set(name, await safeRead(site, name));
  }
  const thumbnails = (await filesBelow(site, 'assets/look-thumbnails')).filter((name) => name.endsWith('.webp'));
  const catalogue = JSON.parse(files.get('catalogue.json').toString('utf8'));
  const looks = catalogue.looks;
  if (!Array.isArray(looks) || !looks.length) throw new Error('Catalogue must contain its look manifest.');
  const requiredThumbnails = new Set(looks.map((look) => typeof look.thumbnail === 'string' ? look.thumbnail.replace(/^\.\//, '') : look.thumbnail));
  for (const thumbnail of requiredThumbnails) {
    if (typeof thumbnail !== 'string' || !/^assets\/look-thumbnails\/[a-z0-9-]+\.webp$/.test(thumbnail) || !thumbnails.includes(thumbnail)) {
      throw new Error(`Missing or invalid catalogue thumbnail: ${thumbnail}`);
    }
    files.set(thumbnail, await safeRead(site, thumbnail));
  }
  // Keep the original public import and self-hosted embedding URLs working.
  for (const name of SITE_FILES.filter((name) => name.startsWith('vendor/fluid-core/src/'))) {
    files.set(name.replace('vendor/', ''), files.get(name));
  }
  files.set('fluid-core/README.md', files.get('vendor/fluid-core/README.md'));
  files.set('fluid-core/LICENSE', files.get('vendor/fluid-core/LICENSE'));
  files.set('docs/MATERIALS.md', files.get('vendor/docs/MATERIALS.md'));
  const embed = files.get('vendor/studio-assets/fluid-bg.iife.js');
  files.set('assets/fluid-bg.iife.js', embed);
  files.set('fluid-bg.js', embed);

  await rm(output, { recursive: true, force: true });
  await mkdir(output, { recursive: true });
  const names = [...files.keys()].sort();
  for (const name of names) {
    const destination = path.join(output, name);
    await mkdir(path.dirname(destination), { recursive: true });
    await writeFile(destination, files.get(name));
  }
  return { directory: output, files: names };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = await buildSite();
  console.log(`Built ${result.files.length} public files in .public/`);
}
