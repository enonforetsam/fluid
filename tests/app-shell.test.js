'use strict';
/* The app shell (portrait phones + small tablets) is pure state: a bottom nav names a panel
   section, CSS shows that one section as a sheet. Three things can drift apart silently and
   each would show up only on a phone: a nav button with no section behind it (a dead tab), a
   section with no button (unreachable controls), and the media query the CSS block uses
   diverging from the one the JS asks (`not (...)` is level-4 syntax — if the two strings differ
   the shell can switch on in JS where its CSS did not). */
const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

describe('app shell (portrait phones)', () => {
  const navKeys = [...html.matchAll(/<button[^>]*class="navBtn"[^>]*data-nav="([a-z]+)"/g)].map(m => m[1]);
  const sectionKeys = [...html.matchAll(/<section[^>]*data-nav="([a-z]+)"/g)].map(m => m[1]);

  it('has the five doors, in the agreed order', () => {
    assert.deepStrictEqual(navKeys, ['colour', 'engine', 'look', 'export']);
  });

  it('every door leads somewhere, and every navigable section has a door', () => {
    /* image is opened by the chip bar's image chip, not a tab — deliberate, pinned here so it
       cannot drift; the stage tray has no tab on phones at all */
    const navSet = new Set(navKeys), secSet = new Set(sectionKeys);
    for (const k of navSet) assert.ok(secSet.has(k), `nav "${k}" has no section[data-nav="${k}"]`);
    for (const k of secSet) if (k !== 'image') assert.ok(navSet.has(k), `section[data-nav="${k}"] has no nav button`);
    assert.ok(html.includes('<button id="imageChip"'), 'the image chip opens the Source section');
    assert.ok(sectionKeys.filter(k => k === 'export').length === 2, 'Size and Output share the Export sheet');
  });

  it('the CSS shows each navigable section under its own data-sheet state', () => {
    for (const k of new Set(sectionKeys)) {
      assert.ok(html.includes(`.wrap[data-sheet="${k}"] .panel section[data-nav="${k}"]`), `no display rule for sheet "${k}"`);
    }
  });

  it('the shell media query is one string, used verbatim by CSS and JS', () => {
    const css = html.match(/@media (\(max-width:879px\) and \(not \(\(orientation:landscape\) and \(min-aspect-ratio:4\/3\)\)\))\)?\{/);
    const js = html.match(/var APP_Q = '([^']+)';/);
    assert.ok(css, 'CSS shell block not found');
    assert.ok(js, 'APP_Q not found');
    assert.strictEqual(js[1], css[1]);
  });

  it('the sheet chrome and the toast exist once', () => {
    for (const id of ['appNav', 'sheetHead', 'sheetTitle', 'sheetClose', 'toast']) {
      assert.strictEqual((html.match(new RegExp(`id="${id}"`, 'g')) || []).length, 1, `#${id}`);
    }
  });

  it('revealSection routes through the shell so tray rows can still jump to a section', () => {
    assert.ok(/function revealSection[\s\S]{0,1200}openSheetFor\(sec\)/.test(html));
  });
});
