const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const HTML_FILES = ['index.html', 'dev.html', 'manual.html', 'gallery.html'];

// Collect all <script src="..."> references from HTML files
function getHtmlScriptRefs() {
  const refs = new Set();
  for (const file of HTML_FILES) {
    const content = fs.readFileSync(path.join(ROOT, file), 'utf8');
    for (const m of content.matchAll(/<script[^>]+src="([^"]+)"/g)) {
      refs.add(m[1]);
    }
  }
  return refs;
}

// Collect all JS files in assets/
function getAssetJsFiles() {
  const assetsDir = path.join(ROOT, 'assets');
  if (!fs.existsSync(assetsDir)) return [];
  return fs.readdirSync(assetsDir)
    .filter(f => f.endsWith('.js'))
    .map(f => 'assets/' + f);
}

describe('orphan detection', () => {
  const htmlRefs = getHtmlScriptRefs();
  const jsFiles = getAssetJsFiles();

  for (const jsFile of jsFiles) {
    it(`${jsFile} is referenced by an HTML page or is an entry point`, () => {
      const isReferenced = htmlRefs.has(jsFile);
      const isEntryPoint = jsFile === 'worker.js'; // wrangler.jsonc main
      assert.ok(isReferenced || isEntryPoint,
        `${jsFile} is not referenced by any HTML page and is not an entry point`);
    });
  }

  it('worker.js is declared as main in wrangler.jsonc', () => {
    const wrangler = JSON.parse(fs.readFileSync(path.join(ROOT, 'wrangler.jsonc'), 'utf8'));
    assert.strictEqual(wrangler.main, 'worker.js', 'wrangler.jsonc main should be worker.js');
  });

  it('all HTML script src references point to existing files', () => {
    for (const ref of htmlRefs) {
      const resolved = path.resolve(ROOT, ref);
      assert.ok(fs.existsSync(resolved), `Referenced script does not exist: ${ref}`);
    }
  });
});
