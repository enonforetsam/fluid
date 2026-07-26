/* Browser entry: transformers.js from a CDN, exemplars + vectors bundled alongside. Exposes
   loadVibe() (lazy model warm, with progress) and match(prompt) → nearest exemplar's params.
   Runs 100% client-side; the model + wasm fetch from CDN on first use and cache in IndexedDB. */
import { pipeline, env } from 'https://esm.sh/@xenova/transformers@2.17.2?bundle';
import { EXEMPLARS } from './exemplars.mjs';
import { VECS } from './vectors.mjs';

env.allowLocalModels = false;            /* load the model from the hub, not a local path */

let extractor = null;
export async function loadVibe(progress) {
  if (!extractor) {
    extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2',
      progress ? { progress_callback: progress } : {});
  }
  return extractor;
}

export async function match(prompt) {
  const ex = await loadVibe();
  const out = await ex(String(prompt || ''), { pooling: 'mean', normalize: true });
  const v = out.data;
  let best = -2, bi = 0, second = -2;
  for (let i = 0; i < VECS.length; i++) {
    const w = VECS[i];
    let d = 0;
    for (let j = 0; j < v.length; j++) { d += v[j] * w[j]; }
    if (d > best) { second = best; best = d; bi = i; }
    else if (d > second) { second = d; }
  }
  return { text: EXEMPLARS[bi].t, params: EXEMPLARS[bi], score: best, margin: best - second };
}
