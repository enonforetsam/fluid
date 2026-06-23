'use strict';
/* Structural sanity for the shipped HTML pages: valid head, and no dangling local
   script/asset references (a moved/renamed file is a silent 404 in production). */
const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const HTML_FILES = ['index.html', 'dev.html', 'manual.html', 'gallery.html'];

describe('HTML pages', () => {
  for (const file of HTML_FILES) {
    const full = path.join(ROOT, file);
    if (!fs.existsSync(full)) continue; // tolerate pages being added/removed
    const content = fs.readFileSync(full, 'utf8');

    describe(file, () => {
      it('has a DOCTYPE', () => {
        assert.ok(content.trimStart().toLowerCase().startsWith('<!doctype html>'), `${file} missing <!DOCTYPE html>`);
      });
      it('has a <title>', () => {
        assert.match(content, /<title>[^<]+<\/title>/, `${file} missing <title>`);
      });
      it('has <html lang=...>', () => {
        assert.match(content, /<html\s+lang=/, `${file} missing lang attribute`);
      });
      it('has a meta description', () => {
        assert.match(content, /<meta\s+name="description"/, `${file} missing meta description`);
      });
      it('every <script src> points to an existing local file', () => {
        const srcs = [...content.matchAll(/<script[^>]+src="([^"]+)"/g)].map((m) => m[1]).filter((s) => !/^https?:/.test(s));
        for (const src of srcs) {
          assert.ok(fs.existsSync(path.resolve(ROOT, src)), `${file} references missing script: ${src}`);
        }
      });
      it('every local <link href> points to an existing file', () => {
        const hrefs = [...content.matchAll(/<link[^>]+href="([^"]+)"/g)].map((m) => m[1])
          .filter((h) => !/^(https?:|data:|#|mailto:)/.test(h));
        for (const href of hrefs) {
          assert.ok(fs.existsSync(path.resolve(ROOT, href)), `${file} references missing asset: ${href}`);
        }
      });
    });
  }
});
