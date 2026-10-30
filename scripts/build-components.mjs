import { appendFile, readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = fileURLToPath(new URL('../', import.meta.url));

/**
 * Rebuild the self-hosted gallery. Install the pinned dev dependencies normally,
 * or reuse an existing toolchain without copying dependencies into this repo:
 * FLUID_COMPONENTS_ESBUILD=/absolute/path/to/esbuild/lib/main.js
 * FLUID_COMPONENTS_NODE_PATH=/absolute/path/to/node_modules
 */
export async function buildComponents() {
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
  await esbuild.build({
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
    nodePaths
  });
  // esbuild preserves the original license headers. Include the complete MIT
  // permission text too, because those headers refer to package-root LICENSE files.
  const licenses = [...licenseGroups].map(([license, names]) => names.join(', ') + '\n\n' + license).join('\n\n');
  await appendFile(path.join(ROOT, 'site/components/gallery.js.LEGAL.txt'), '\n\nFull third-party license texts:\n\n' + licenses + '\n');
  return { bundle: 'site/components/gallery.js', legal: 'site/components/gallery.js.LEGAL.txt' };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = await buildComponents();
  console.log('Built ' + result.bundle + ' with third-party notices in ' + result.legal);
}
