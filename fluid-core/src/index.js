/* fluid-core public API.
 *
 * import { createFluid } from 'fluid-core';
 * const art = createFluid(document.querySelector('#bg'), { field: 'flow', palette: 'sunset' });
 */
export { FluidMount, createFluid } from './mount.js';
export { parseShareHash } from './hash.js';
export { VSRC, FSRC } from './generated/shader.js';
export {
  FIELDS, FIELD_TUNE, FIELD_STATUS,
  PALETTES, PALETTES_RGB, SCREENS, MATERIALS, BLENDS, LOOKS
} from './generated/data.js';
export const VERSION = '0.2.0';
