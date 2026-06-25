/* Phase-1 sanity check: do NOVEL phrasings (zero keyword overlap) land on the right exemplar?
   This is the whole point of going semantic — proving it before wiring into Fluid. */
import { match } from './match.mjs';

const tests = [
  'a tempest brewing over the deep sea',     /* expect ~ stormy ocean */
  'serene meditation space, total stillness',/* ~ calm zen garden */
  'glitchy hacker terminal screen',          /* ~ matrix code rain */
  'a volcano erupting with molten rock',     /* ~ molten lava */
  'gentle purple sunrise haze',              /* ~ calm lavender dawn */
  'sacred geometry, intricate symmetry',     /* ~ a mandala */
  'buzzing beehive full of bees',            /* ~ honeycomb hive */
  'polished liquid mercury',                 /* ~ liquid chrome */
  'the vast starry cosmos',                  /* ~ deep space nebula */
  'an old arcade machine from the 80s'       /* ~ retro arcade */
];

for (const p of tests) {
  const r = await match(p);
  console.log('"' + p + '"  ->  [' + r.text + ']  field=' + r.params.f + ' pal=' + r.params.pal +
    (r.params.sym ? ' sym' + r.params.sym : '') + '   (score ' + r.score.toFixed(2) + ', margin ' + r.margin.toFixed(2) + ')');
}
