import { appendFile, lstat, readFile, realpath, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = fileURLToPath(new URL('../', import.meta.url));

export const COMPONENT_MANIFESTS = Object.freeze(['legacy', 'visual', 'interactions', 'tools', 'sections']);
export const EXPECTED_COMPONENT_IDS = Object.freeze([
  'split-reveal','wave-text','magnetic-button','spotlight-card','tilt-card','loop-marquee',
  'fluid-hero','living-logo','texture-text','ink-reveal','living-border','glass-lens','scroll-scenes','artful-dividers','audio-reactive-art',
  'morphing-menu','stacking-gallery','elastic-tabs','image-trail','before-after-reveal','flow-timeline','living-progress','atmosphere-states','peelable-sticker','particle-portrait','paint-reveal','animated-poster',
  'palette-studio','texture-lab','divider-builder','hero-composer','logo-motion-studio','motion-recipes','social-preview-maker','material-theme-pack',
  'creator-portfolio','product-launch','music-release','editorial-story'
]);
const GROUP_CSS = new Set(['components/components.css','components/visual.css','components/interactions.css','components/tools.css','components/sections.css']);
const CONTROL_TYPES = new Set(['text','textarea','range','color','select','image','audio','checkbox']);
const CAPABILITIES = new Set(['png','svg','html','webm','css','json','jsx']);
const PRIVATE_REFERENCE = /(?:\/Users\/|\/opt\/|\/root\/|\.codex\/|\.claude\/)/;
export function validatePublicComponentPath(value) {
  if (typeof value !== 'string' || value.includes('\\') || value.includes('\0') || value.startsWith('/') || path.posix.normalize(value) !== value || value.split('/').some(part => part.startsWith('.'))) {
    throw new Error('Invalid public component path: ' + value);
  }
  if (value === 'components/LICENSE' || GROUP_CSS.has(value)) return value;
  if (!/^components\/(?:src|assets)\/(?:[A-Za-z0-9][A-Za-z0-9_-]*\/)*[A-Za-z0-9][A-Za-z0-9_-]*\.(?:jsx|js|css|svg|png|jpe?g|webp|woff2?)$/.test(value)) {
    throw new Error('Forbidden public component path: ' + value);
  }
  if (/(?:^|\/)(?:qa|scripts|manifests|node_modules|backups|credentials|secrets|gallery|registry)(?:\/|\.)/i.test(value)) throw new Error('Private component asset: ' + value);
  return value;
}
export function validateComponentCatalogue(catalogue) {
  if (!Array.isArray(catalogue) || catalogue.length !== EXPECTED_COMPONENT_IDS.length) throw new Error('Component catalogue must contain exactly 39 entries.');
  const ids = new Set(), files = new Set();
  for (const item of catalogue) {
    if (!item || !/^[a-z][a-z0-9-]+$/.test(item.id) || ids.has(item.id)) throw new Error('Duplicate or invalid component id: ' + item?.id);
    ids.add(item.id);
    const file = item.file || item.filebasename;
    if (!/^[A-Z][A-Za-z0-9]*$/.test(file) || files.has(file) || (item.file && item.filebasename && item.file !== item.filebasename)) throw new Error('Duplicate or invalid component source: ' + file);
    files.add(file); validatePublicComponentPath('components/src/' + file + '.jsx');
    if (!['component','experiment','tool','section'].includes(item.type)) throw new Error('Invalid component type: ' + item.id);
    for (const key of ['name','category','symbol','description','hint']) if (typeof item[key] !== 'string' || !item[key]) throw new Error('Missing component ' + key + ': ' + item.id);
    if (!GROUP_CSS.has(item.css)) throw new Error('Invalid component stylesheet: ' + item.id);
    if (!item.defaults || typeof item.defaults !== 'object' || Array.isArray(item.defaults) || !Array.isArray(item.controls) || !Array.isArray(item.props) || !Array.isArray(item.dependencies) || !Array.isArray(item.capabilities)) throw new Error('Invalid component metadata: ' + item.id);
    if (item.capabilities.some(value => !CAPABILITIES.has(value)) || new Set(item.capabilities).size !== item.capabilities.length) throw new Error('Invalid export capability: ' + item.id);
    const keys = new Set();
    for (const control of item.controls) {
      const value = item.defaults[control.key];
      if (!control || !/^[A-Za-z][A-Za-z0-9]*$/.test(control.key) || keys.has(control.key) || typeof control.label !== 'string' || !CONTROL_TYPES.has(control.type) || !Object.hasOwn(item.defaults, control.key)) throw new Error('Invalid control: ' + item.id);
      keys.add(control.key);
      if (control.type === 'range' && (![control.min,control.max,control.step,value].every(Number.isFinite) || control.min > control.max || control.step <= 0 || value < control.min || value > control.max)) throw new Error('Invalid range default: ' + item.id + '.' + control.key);
      if (control.type === 'checkbox' && typeof value !== 'boolean') throw new Error('Invalid checkbox default: ' + item.id);
      if (control.type === 'color' && !/^#[0-9a-f]{6}$/i.test(value)) throw new Error('Invalid colour default: ' + item.id);
      if (['text','textarea','image','audio'].includes(control.type) && typeof value !== 'string') throw new Error('Invalid text/media default: ' + item.id);
      if (control.type === 'select' && (!Array.isArray(control.options) || !control.options.length || control.options.some(option => typeof option.value !== 'string' || typeof option.label !== 'string') || !control.options.some(option => option.value === value))) throw new Error('Invalid select default: ' + item.id);
    }
    if (item.props.some(prop => !Array.isArray(prop) || prop.length !== 2 || prop.some(value => typeof value !== 'string'))) throw new Error('Invalid prop guidance: ' + item.id);
    item.dependencies.forEach(validatePublicComponentPath);
  }
  for (const id of EXPECTED_COMPONENT_IDS) if (!ids.has(id)) throw new Error('Missing required component: ' + id);
  return catalogue;
}
async function readSourceFile(site, name) {
  validatePublicComponentPath(name);
  const input = path.join(site, name), actual = await realpath(input);
  if (!actual.startsWith(site + path.sep) || !(await lstat(input)).isFile()) throw new Error('Component source must be an ordinary file inside site: ' + name);
  const data = await readFile(input);
  if (/\.(?:js|jsx|css|svg)$/.test(name) && PRIVATE_REFERENCE.test(data.toString('utf8'))) throw new Error('Private filesystem reference in public input: ' + name);
  return data;
}
let importParser;
function sourceImportParser() {
  if (importParser) return importParser;
  try {
    const require = createRequire(import.meta.url);
    importParser = require(process.env.FLUID_COMPONENTS_ESBUILD ? path.resolve(process.env.FLUID_COMPONENTS_ESBUILD) : 'esbuild');
    if (typeof importParser.buildSync !== 'function') throw new Error('The compiler does not expose buildSync.');
    return importParser;
  } catch (error) {
    throw new Error('Source graph validation requires the pinned esbuild dev dependency. Install dev dependencies or set FLUID_COMPONENTS_ESBUILD to an existing esbuild module.', { cause: error });
  }
}
/** Parse real module imports without resolving or reading any dependency files. */
export function relativeImports(source, name) {
  const parsed = sourceImportParser().buildSync({
    stdin: { contents: source, sourcefile: name, loader: name.endsWith('.jsx') ? 'jsx' : 'js' },
    bundle: false, write: false, metafile: true, format: 'esm', platform: 'browser',
    jsx: 'automatic', treeShaking: false, logLevel: 'silent'
  });
  // In an unbundled parse, esbuild reports the exact preserved imports as
  // external output imports. Strings, comments, regex and JSX text are not imports;
  // real imports inside template interpolations remain in this parsed graph.
  const found = Object.values(parsed.metafile.outputs).flatMap(output => output.imports.map(dependency => dependency.path));
  const paths = [];
  for (const specifier of found) {
    if (specifier === 'react' || specifier === 'react/jsx-runtime') continue;
    if (!specifier.startsWith('./') && !specifier.startsWith('../')) throw new Error('Only React and relative source imports are supported: ' + name + ' -> ' + specifier);
    const target = path.posix.normalize(path.posix.join(path.posix.dirname(name), specifier));
    validatePublicComponentPath(target); paths.push(target);
  }
  return paths;
}
/** Defense in depth: every actual bundled component module/edge must be public. */
export function validateBundledComponentInputs(metafile, manifest, { rootDir = ROOT } = {}) {
  const root = path.resolve(rootDir), site = path.join(root, 'site');
  const publicSources = new Set(Object.values(manifest.entries).flat());
  const authoring = new Set(['components/gallery.jsx','components/gallery-support.js','components/registry.jsx','components/catalogue.json']);
  function siteRelative(input) {
    const absolute = path.resolve(root, input);
    return absolute.startsWith(site + path.sep) ? path.relative(site, absolute).split(path.sep).join('/') : null;
  }
  for (const [input, metadata] of Object.entries(metafile.inputs)) {
    const name = siteRelative(input);
    if (name == null) continue; // React's own dependency tree is outside site/.
    if (authoring.has(name)) continue; // Allowed only as gallery authoring inputs.
    validatePublicComponentPath(name);
    if (!publicSources.has(name)) throw new Error('Bundled component source is missing from the public graph: ' + name);
    for (const dependency of metadata.imports || []) {
      const original = dependency.original || dependency.path;
      if (original === 'react' || original === 'react/jsx-runtime') continue;
      const target = dependency.external ? null : siteRelative(dependency.path);
      if (target == null) throw new Error('Bundled component dependency leaves the public source graph: ' + name + ' -> ' + original);
      // Authoring modules are never an exception for reusable source imports.
      validatePublicComponentPath(target);
      if (!publicSources.has(target)) throw new Error('Bundled component dependency is missing from the public graph: ' + name + ' -> ' + target);
    }
  }
  return metafile;
}
/** Build an exact per-entry recursive graph. Every path remains relative to site/. */
export async function collectComponentSources({ siteDir, catalogue }) {
  validateComponentCatalogue(catalogue);
  const site = await realpath(siteDir), sources = new Map(), entries = {};
  async function visit(name, ordered) {
    validatePublicComponentPath(name);
    if (ordered.has(name)) return;
    ordered.add(name);
    if (!sources.has(name)) sources.set(name, await readSourceFile(site, name));
    if (/\.(?:js|jsx)$/.test(name)) for (const dependency of relativeImports(sources.get(name).toString('utf8'), name)) await visit(dependency, ordered);
  }
  for (const item of catalogue) {
    const ordered = new Set();
    await visit('components/src/' + (item.file || item.filebasename) + '.jsx', ordered);
    for (const dependency of item.dependencies) await visit(dependency, ordered);
    await visit(item.css, ordered); await visit('components/LICENSE', ordered);
    entries[item.id] = [...ordered];
  }
  return { manifest: { version: 1, entries }, sources };
}
export async function generateComponentCatalogue({ rootDir = ROOT } = {}) {
  const root = await realpath(rootDir), site = await realpath(path.join(root, 'site'));
  if (!site.startsWith(root + path.sep)) throw new Error('Site source must remain inside the repository.');
  const catalogue = [];
  for (const group of COMPONENT_MANIFESTS) {
    const entries = JSON.parse(await readFile(path.join(site, 'components/manifests/' + group + '.json'), 'utf8'));
    if (!Array.isArray(entries)) throw new Error('Component manifest must be an array: ' + group);
    catalogue.push(...entries.map(item => ({ ...item, file: item.file || item.filebasename, filebasename: item.filebasename || item.file })));
  }
  validateComponentCatalogue(catalogue);
  const { manifest } = await collectComponentSources({ siteDir: site, catalogue });
  const imports = catalogue.map((item, index) => 'import Component' + index + " from './src/" + item.file + ".jsx';").join('\n');
  const entries = catalogue.map((item, index) => '  ' + JSON.stringify(item.id) + ': Component' + index).join(',\n');
  const registry = '// Generated source registry. Authoring only; never a public asset.\n' + imports + '\nconst registry = {\n' + entries + '\n};\nexport { registry };\nexport default registry;\n';
  await writeFile(path.join(site, 'components/catalogue.json'), JSON.stringify(catalogue, null, 2) + '\n');
  await writeFile(path.join(site, 'components/source-manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  await writeFile(path.join(site, 'components/registry.jsx'), registry);
  return { catalogue, manifest };
}


/**
 * Rebuild the self-hosted gallery. Install the pinned dev dependencies normally,
 * or reuse an existing toolchain without copying dependencies into this repo:
 * FLUID_COMPONENTS_ESBUILD=/absolute/path/to/esbuild/lib/main.js
 * FLUID_COMPONENTS_NODE_PATH=/absolute/path/to/node_modules
 */
export async function buildComponents() {
  const generated = await generateComponentCatalogue();
  let esbuild;
  try {
    esbuild = process.env.FLUID_COMPONENTS_ESBUILD
      ? await import(pathToFileURL(path.resolve(process.env.FLUID_COMPONENTS_ESBUILD)).href)
      : await import('esbuild');
  } catch (error) {
    throw new Error('Install the pinned dev dependencies or set FLUID_COMPONENTS_ESBUILD to an existing esbuild module.', { cause: error });
  }
  const nodePaths = (process.env.FLUID_COMPONENTS_NODE_PATH || '')
    .split(path.delimiter).filter(Boolean).map((directory) => path.resolve(directory));
  const projectRequire = createRequire(path.join(ROOT, 'package.json'));
  const resolutionPaths = [ROOT, ...nodePaths];
  const reactPackage = projectRequire.resolve('react/package.json', { paths: resolutionPaths });
  const reactDomPackage = projectRequire.resolve('react-dom/package.json', { paths: resolutionPaths });
  const schedulerPackage = createRequire(reactDomPackage).resolve('scheduler/package.json');
  const licenseGroups = new Map();
  for (const [name, packageFile] of [['React', reactPackage], ['React DOM', reactDomPackage], ['Scheduler', schedulerPackage]]) {
    const license = (await readFile(path.join(path.dirname(packageFile), 'LICENSE'), 'utf8')).trim();
    const names = licenseGroups.get(license) || [];
    names.push(name);
    licenseGroups.set(license, names);
  }
  const result = await esbuild.build({
    absWorkingDir: ROOT,
    entryPoints: ['site/components/gallery.jsx'],
    outfile: 'site/components/gallery.js',
    bundle: true,
    format: 'esm',
    platform: 'browser',
    target: ['es2020'],
    jsx: 'automatic',
    minify: true,
    define: { 'process.env.NODE_ENV': '"production"' },
    legalComments: 'external',
    sourcemap: false,
    metafile: true,
    nodePaths
  });
  validateBundledComponentInputs(result.metafile, generated.manifest);
  for (const item of generated.catalogue) {
    if (!Object.hasOwn(result.metafile.inputs, 'site/components/src/' + item.file + '.jsx')) throw new Error('Gallery did not bundle the component registry: ' + item.id);
  }
  for (const source of new Set(Object.values(generated.manifest.entries).flat())) {
    if (/\.(?:js|jsx)$/.test(source) && !Object.hasOwn(result.metafile.inputs, 'site/' + source)) throw new Error('Gallery did not bundle a recursive source dependency: ' + source);
  }
  // esbuild preserves the original license headers. Include the complete MIT
  // permission text too, because those headers refer to package-root LICENSE files.
  const licenses = [...licenseGroups].map(([license, names]) => names.join(', ') + '\n\n' + license).join('\n\n');
  await appendFile(path.join(ROOT, 'site/components/gallery.js.LEGAL.txt'), '\n\nFull third-party license texts:\n\n' + licenses + '\n');
  return { bundle: 'site/components/gallery.js', legal: 'site/components/gallery.js.LEGAL.txt', count: generated.catalogue.length, inputs: Object.keys(result.metafile.inputs) };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = await buildComponents();
  console.log('Built ' + result.bundle + ' with third-party notices in ' + result.legal);
}
