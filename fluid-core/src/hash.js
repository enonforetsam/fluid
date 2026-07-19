/* Share-hash decoder: a studio `#p=` link -> createFluid() params.
 *
 * Mirrors the studio's parseHash() accept rules and clamps exactly
 * (append-only contract — see docs/ARCHITECTURE.md). The inverse of
 * FluidMount.shareUrl(); tests/fluid-core-hash.test.js round-trips both.
 * Studio-only slots (preset [12], embed [13], pan [16,17], image liq/mix
 * [9,10], aspect [11]) don't affect a mounted piece and are not returned,
 * except `ar`, which callers may use to size their container.
 */
import { PALETTES_RGB } from './generated/data.js';

function unpackCol(v){
  v = Math.max(0, Math.round(v));
  return [Math.floor(v / 65536) % 256 / 255, Math.floor(v / 256) % 256 / 255, (v % 256) / 255];
}
function rgb01ToHex(c){
  const p = (x) => {
    const s = Math.max(0, Math.min(255, Math.round(x * 255))).toString(16);
    return s.length < 2 ? '0' + s : s;
  };
  return '#' + p(c[0]) + p(c[1]) + p(c[2]);
}
const clampInt = (v, lo, hi) => Math.min(hi, Math.max(lo, Math.round(v)));

/**
 * Parse a Fluid share hash (or a full share URL) into createFluid() params.
 * Returns null when the hash is not a valid `#p=` piece.
 */
export function parseShareHash(hash){
  let h = String(hash || '');
  const at = h.indexOf('#p=');
  if (at >= 0){ h = h.slice(at + 3); }
  else if (h.indexOf('p=') === 0){ h = h.slice(2); }
  else if (h.charAt(0) === '#'){ h = h.slice(1); }
  const n = h.split(',').map(parseFloat);
  if (n.length < 12 || n.some(isNaN)){ return null; }

  const params = {
    speed: n[0], zoom: n[1], warp: n[2], grain: n[3],
    pixel: Math.round(n[4]), dot: Math.round(n[5]),
    dots: Math.round(n[6]) ? 1 : 0,
    seed: n[8],
    ar: (n[11] >= 0.3 && n[11] <= 3) ? n[11] : 1,
    field: n.length > 14 ? clampInt(n[14], 0, 14) : 0,
    screen: n.length > 15 ? clampInt(n[15], 0, 4) : 0,
    sym: n.length > 18 ? clampInt(n[18], 0, 12) : 0,
    thresh: n.length > 24 ? Math.max(0, Math.min(1, 0.5 + n[24])) : 0.5,
    material: n.length > 28 ? clampInt(n[28], 0, 5) : 0
  };

  const pal = clampInt(n[7], 0, 8);
  if (pal === 8){
    const stops = n.length > 23
      ? [unpackCol(n[20]), unpackCol(n[21]), unpackCol(n[22]), unpackCol(n[23])]
      : PALETTES_RGB[0];
    params.colors = stops.map(rgb01ToHex);
  } else {
    params.palette = pal;
  }

  const layerMix = n.length > 27 ? Math.max(0, Math.min(1, n[27] / 100)) : 0;
  if (layerMix > 0.001){
    params.layer = {
      field: n.length > 25 ? clampInt(n[25], 0, 14) : 0,
      blend: n.length > 26 ? clampInt(n[26], 0, 5) : 0,
      mix: layerMix
    };
  }
  return params;
}
