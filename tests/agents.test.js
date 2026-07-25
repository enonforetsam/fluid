'use strict';
/* The agent-distribution surface: /llms.txt and the get_embed_code MCP tool.
   Behavioral — loads worker.js and calls its fetch handler like worker.test.js does. */
const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const WORKER_PATH = path.resolve(__dirname, '..', 'worker.js');
const workerSrc = fs.readFileSync(WORKER_PATH, 'utf8');

let handlerPromise;
function loadWorker() {
  if (!handlerPromise) {
    const uri = 'data:text/javascript;base64,' + Buffer.from(workerSrc).toString('base64');
    handlerPromise = import(uri).then((m) => m.default);
  }
  return handlerPromise;
}

const mockEnv = {
  STAGE: 'test',
  ASSETS: { fetch: async () => new Response('<!DOCTYPE html><html></html>', { status: 200, headers: { 'content-type': 'text/html' } }) }
};
async function GET(pathname) {
  const w = await loadWorker();
  return w.fetch(new Request('https://fluid.test' + pathname), mockEnv);
}
async function rpc(method, params) {
  const w = await loadWorker();
  const res = await w.fetch(new Request('https://fluid.test/mcp', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params })
  }), mockEnv);
  return res.json();
}
async function callTool(name, args) {
  const reply = await rpc('tools/call', { name, arguments: args });
  const text = reply.result.content[0].text;
  return { isError: !!reply.result.isError, text, json: reply.result.isError ? null : JSON.parse(text) };
}

describe('/llms.txt', () => {
  it('serves a plain-text agent guide with the whole integration surface', async () => {
    const res = await GET('/llms.txt');
    assert.strictEqual(res.status, 200);
    assert.match(res.headers.get('content-type'), /text\/plain/);
    const body = await res.text();
    assert.match(body, /^# Fluid/);
    for (const needle of [
      '/mcp', 'create_piece', 'get_embed_code', 'list_looks', 'decode_link',
      'fluid-bg', 'cdn.jsdelivr.net/npm/fluid-bg', '<fluid-bg fixed',
      '/api/piece', 'Share-hash contract', '[13] embed flag',
      'custom connector', 'transparent'
    ]) {
      assert.ok(body.includes(needle), 'llms.txt should mention ' + needle);
    }
    /* the guide is origin-relative so staging serves staging URLs */
    assert.ok(body.includes('https://fluid.test/mcp'), 'links must use the request origin');
  });
});

describe('get_embed_code', () => {
  it('is listed in tools/list', async () => {
    const reply = await rpc('tools/list', {});
    const names = reply.result.tools.map((t) => t.name);
    assert.ok(names.includes('get_embed_code'), 'tools/list should include get_embed_code, got ' + names);
  });

  it('share URL -> native, react and iframe snippets with the right embed flags', async () => {
    const piece = (await callTool('create_piece', { look: 'borealis', seed: 30 })).json;
    const out = (await callTool('get_embed_code', { url: piece.share_url })).json;

    /* native + react carry the SHARE hash (flag 0) — fluid-bg applies the embed flag itself */
    const shareHash = piece.share_url.slice(piece.share_url.indexOf('#'));
    assert.ok(out.html.includes('cdn.jsdelivr.net/npm/fluid-bg'), 'html should load fluid-bg from CDN');
    assert.ok(out.html.includes('<fluid-bg fixed hash="' + shareHash + '"'), 'html should use the share hash');
    assert.ok(out.react.includes("import FluidBg from 'fluid-bg/react'"), 'react import');
    assert.ok(out.react.includes('<FluidBg fixed hash="' + shareHash + '"'), 'react share hash');

    /* iframe carries the EMBED url (flag 1) */
    assert.ok(out.iframe_html.includes(piece.embed_url), 'iframe should use the embed url');
    assert.ok(out.notes.includes('transparent'), 'notes must carry the opaque-background footgun');
  });

  it('clears the embed flag when handed an embed URL, and preserves later slots', async () => {
    /* slots: …[13]=1 embed, [14]=2 field, …[18]=6 symmetry */
    const out = (await callTool('get_embed_code', {
      url: 'https://fluid.test/#p=0.4,1.9,8,0.03,1,10,0,4,60,0,0,1,0,1,2,0,0,0,6'
    })).json;
    assert.ok(out.html.includes('hash="#p=0.4,1.9,8,0.03,1,10,0,4,60,0,0,1,0,0,2,0,0,0,6"'),
      'flag cleared to 0, field + symmetry slots intact: ' + out.html);
    assert.ok(out.embed_url.endsWith('#p=0.4,1.9,8,0.03,1,10,0,4,60,0,0,1,0,1,2,0,0,0,6'),
      'embed url keeps flag 1: ' + out.embed_url);
  });

  it('custom-palette hashes keep their packed colour slots through the flag flip', async () => {
    const piece = (await callTool('create_piece', { colors: ['#0a0a1a', '#ffe1f5'], seed: 30 })).json;
    const out = (await callTool('get_embed_code', { url: piece.embed_url })).json;
    const shareHash = piece.share_url.slice(piece.share_url.indexOf('#'));
    assert.ok(out.html.includes('hash="' + shareHash + '"'),
      'embed->share round-trip must preserve the 24-slot custom palette: ' + out.html);
  });

  it('accepts a curated look and an element target', async () => {
    const out = (await callTool('get_embed_code', { look: 'gilded', target: 'element' })).json;
    assert.ok(out.html.includes('<fluid-bg hash='), 'element target drops the fixed attribute');
    assert.ok(!out.html.includes('<fluid-bg fixed'), 'element target must not be fixed');
    assert.ok(out.html.includes('height:420px'), 'element snippet shows a sized parent');
  });

  it('rejects urls without a hash, malformed hashes, and empty input', async () => {
    for (const args of [{ url: 'https://example.com/' }, { url: 'https://fluid.test/#p=1,2,junk' }, {}]) {
      const out = await callTool('get_embed_code', args);
      assert.ok(out.isError, 'should error on ' + JSON.stringify(args));
      assert.match(out.text, /^ERR/);
    }
  });
});
