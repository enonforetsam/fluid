/* Runtime matcher — works in Node (this test) and the browser (Phase 2). Embeds the prompt
   with MiniLM, cosine-matches it to the precomputed exemplar vectors (normalized -> dot product),
   returns the nearest exemplar's params. The heavy model loads lazily + caches. */
import { pipeline } from '@xenova/transformers';
import { EXEMPLARS } from './exemplars.mjs';
import { VECS } from './vectors.mjs';

let extractor = null;
export async function loadVibe() {
  if (!extractor) { extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2'); }
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
