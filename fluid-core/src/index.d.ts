/* Hand-written types for fluid-core (the implementation is plain ES modules). */

export interface FluidLayerParams {
  /** engine slug (e.g. 'crystal') or index 0..14 */
  field?: string | number;
  /** 'normal' | 'multiply' | 'screen' | 'add' | 'difference' | 'overlay' or index 0..5 */
  blend?: string | number;
  /** layer strength 0..1 (0 removes the layer) */
  mix?: number;
}

export interface FluidParams {
  /** engine slug (e.g. 'flow') or index 0..14 */
  field?: string | number;
  /** preset palette slug (e.g. 'sunset') or index 0..7 */
  palette?: string | number;
  /** custom 4-stop gradient, dark -> light, hex strings (overrides palette) */
  colors?: string[];
  /** start from a curated studio look by label (e.g. 'BOREALIS') */
  look?: string;
  /** composite a second engine over the first */
  layer?: FluidLayerParams | false;
  /** 'square' | 'hex' | 'ascii' | 'dither' | 'glitch' or index 0..4; 'none' = square-at-rest */
  screen?: string | number;
  /** 'none' | 'glass' | 'metal' | 'sand' | 'liquid' | 'molten' or index 0..5 */
  material?: string | number;
  speed?: number;
  zoom?: number;
  warp?: number;
  grain?: number;
  pixel?: number;
  dot?: number;
  dots?: number;
  thresh?: number;
  /** kaleidoscope fold 0..12 */
  sym?: number;
  seed?: number;
  /** start frozen */
  paused?: boolean;
  /** set false to animate even under prefers-reduced-motion */
  respectReducedMotion?: boolean;
}

export declare class FluidMount {
  constructor(container: Element, params?: FluidParams);
  container: Element;
  canvas: HTMLCanvasElement;
  set(params: FluidParams): this;
  play(): this;
  pause(): this;
  readonly playing: boolean;
  shareUrl(base?: string, embed?: boolean): string;
  toDataURL(type?: string, quality?: number): string;
  destroy(): void;
}

export declare function createFluid(container: Element, params?: FluidParams): FluidMount;

/** Decode a studio `#p=` share hash (or full share URL) into createFluid params; null if invalid. */
export declare function parseShareHash(hash: string): (FluidParams & { ar?: number }) | null;

export declare const VSRC: string;
export declare const FSRC: string;
export declare const FIELDS: string[];
export declare const FIELD_TUNE: number[][];
export declare const FIELD_STATUS: string[];
export declare const PALETTES: string[];
export declare const PALETTES_RGB: number[][][];
export declare const SCREENS: string[];
export declare const MATERIALS: string[];
export declare const BLENDS: string[];
export declare const LOOKS: Array<{ label: string; field?: number; screen?: number; material?: number; thresh?: number; cols?: string[]; p: number[] }>;
export declare const VERSION: string;
