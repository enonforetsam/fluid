const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const HTML_FILES = ['index.html', 'dev.html', 'manual.html', 'gallery.html'];

describe('HTML pages', () => {
  for (const file of HTML_FILES) {
    describe(file, () => {
      const content = fs.readFileSync(path.join(ROOT, file), 'utf8');

      it('has DOCTYPE declaration', () => {
        assert.ok(content.startsWith('<!DOCTYPE html>'), `${file} missing <!DOCTYPE html>`);
      });

      it('has a <title> tag', () => {
        assert.ok(/<title>.+<\/title>/.test(content), `${file} missing <title>`);
      });

      it('has lang attribute on <html>', () => {
        assert.ok(/<html\s+lang=/.test(content), `${file} missing lang attribute`);
      });

      it('has a meta description', () => {
        assert.ok(/<meta\s+name="description"/.test(content), `${file} missing meta description`);
      });

      it('has no broken script src tags', () => {
        const srcs = [...content.matchAll(/<script[^>]+src="([^"]+)"/g)].map(m => m[1]);
        for (const src of srcs) {
          const resolved = path.resolve(ROOT, src);
          assert.ok(fs.existsSync(resolved), `${file} references missing script: ${src}`);
        }
      });

      it('has no broken link href tags (local only)', () => {
        const hrefs = [...content.matchAll(/<link[^>]+href="([^"]+)"/g)]
          .map(m => m[1])
          .filter(h => !h.startsWith('http'));
        for (const href of hrefs) {
          const resolved = path.resolve(ROOT, href);
          assert.ok(fs.existsSync(resolved), `${file} references missing asset: ${href}`);
        }
      });
    });
  }
});
