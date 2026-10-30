/** Pure, dependency-free two-colour image dithering for Fluid. */
export const DITHER_ALGORITHMS = Object.freeze([
  "ordered4", "ordered8", "floyd", "atkinson", "threshold"
]);

export const DITHER_DEFAULTS = Object.freeze({
  algorithm: "ordered4",
  foreground: "#18191b",
  background: "#f1efeb",
  brightness: 0,
  contrast: 0,
  threshold: 128,
  invert: false
});

// Bound output allocation and line buffers, including unusually wide images.
export const MAX_DITHER_PIXELS = 16_777_216;
export const MAX_DITHER_DIMENSION = 32_768;

function bayer(size) {
  let matrix = [0];
  for (let side = 1; side < size; side *= 2) {
    const next = new Array(side * side * 4);
    for (let y = 0; y < side; y++) {
      for (let x = 0; x < side; x++) {
        const value = matrix[y * side + x] * 4;
        next[y * side * 2 + x] = value;
        next[y * side * 2 + x + side] = value + 2;
        next[(y + side) * side * 2 + x] = value + 3;
        next[(y + side) * side * 2 + x + side] = value + 1;
      }
    }
    matrix = next;
  }
  return Object.freeze(matrix);
}

const BAYER_4 = bayer(4);
const BAYER_8 = bayer(8);
const FLOYD = Object.freeze([
  [1, 0, 7 / 16], [-1, 1, 3 / 16], [0, 1, 5 / 16], [1, 1, 1 / 16]
]);
const ATKINSON = Object.freeze([
  [1, 0, 1 / 8], [2, 0, 1 / 8], [-1, 1, 1 / 8],
  [0, 1, 1 / 8], [1, 1, 1 / 8], [0, 2, 1 / 8]
]);
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

function numericOption(options, name, min, max) {
  const value = options[name] === undefined ? DITHER_DEFAULTS[name] : options[name];
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new TypeError(`${name} must be a finite number.`);
  }
  return clamp(value, min, max);
}

function parseHex(value, name) {
  if (typeof value !== "string" || !/^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(value)) {
    throw new TypeError(`${name} must be a #RGB or #RRGGBB colour.`);
  }
  const hex = value.length === 4
    ? value.slice(1).split("").map((channel) => channel + channel).join("")
    : value.slice(1);
  const packed = Number.parseInt(hex, 16);
  return [packed >>> 16, (packed >>> 8) & 255, packed & 255];
}

/**
 * Convert an RGBA byte image into a two-colour image without changing its source.
 *
 * Options: algorithm (ordered4|ordered8|floyd|atkinson|threshold), foreground and
 * background (#RGB or #RRGGBB), brightness / contrast (-100..100), threshold
 * (0..255), invert (boolean). Finite numeric values are clamped to their ranges.
 * Foreground represents dark ink, background represents light paper; invert swaps them.
 *
 * Alpha is copied exactly. Fully transparent pixels use the background RGB and
 * never send or receive diffusion error, so hidden source RGB has no effect.
 * Partial coverage weights diffusion error at both ends to avoid colour fringes.
 * Diffusion uses at most three scanlines, instead of another full image buffer.
 */
export function ditherImage(image, options = {}) {
  if (image === null || typeof image !== "object") {
    throw new TypeError("An RGBA image is required.");
  }
  const { data, width, height } = image;
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1
      || width > MAX_DITHER_DIMENSION || height > MAX_DITHER_DIMENSION
      || width * height > MAX_DITHER_PIXELS) {
    throw new RangeError("Image dimensions must be positive integers within the dithering limit.");
  }
  if (!(data instanceof Uint8Array || data instanceof Uint8ClampedArray)
      || data.length !== width * height * 4) {
    throw new TypeError("Image data must be an RGBA byte buffer matching its dimensions.");
  }
  if (options === null || typeof options !== "object" || Array.isArray(options)) {
    throw new TypeError("Dithering options must be an object.");
  }

  const algorithm = options.algorithm === undefined ? DITHER_DEFAULTS.algorithm : options.algorithm;
  if (!DITHER_ALGORITHMS.includes(algorithm)) {
    throw new RangeError("Unknown dithering algorithm.");
  }
  const foreground = parseHex(options.foreground === undefined ? DITHER_DEFAULTS.foreground : options.foreground, "foreground");
  const background = parseHex(options.background === undefined ? DITHER_DEFAULTS.background : options.background, "background");
  const brightness = numericOption(options, "brightness", -100, 100) * 255 / 100;
  const contrast = numericOption(options, "contrast", -100, 100) * 255 / 100;
  const threshold = numericOption(options, "threshold", 0, 255);
  const invert = options.invert === undefined ? DITHER_DEFAULTS.invert : options.invert;
  if (typeof invert !== "boolean") throw new TypeError("invert must be a boolean.");

  const contrastFactor = (259 * (contrast + 255)) / (255 * (259 - contrast));
  const output = new Uint8ClampedArray(data.length);
  const kernel = algorithm === "floyd" ? FLOYD : algorithm === "atkinson" ? ATKINSON : null;
  const errors = kernel ? new Float32Array(width * 3) : null;
  const matrix = algorithm === "ordered4" ? BAYER_4 : algorithm === "ordered8" ? BAYER_8 : null;
  const matrixSize = algorithm === "ordered4" ? 4 : 8;

  for (let y = 0; y < height; y++) {
    const errorRow = (y % 3) * width;
    for (let x = 0; x < width; x++) {
      const offset = (y * width + x) * 4;
      const alpha = data[offset + 3];
      let light = false;
      if (alpha !== 0) {
        const luma = (data[offset] * 2126 + data[offset + 1] * 7152 + data[offset + 2] * 722) / 10000;
        let adjusted = clamp(contrastFactor * (luma - 128) + 128 + brightness, 0, 255);
        if (errors) adjusted += errors[errorRow + x];
        const localThreshold = matrix
          ? threshold + ((matrix[(y % matrixSize) * matrixSize + (x % matrixSize)] + 0.5)
            / (matrixSize * matrixSize) - 0.5) * 255
          : threshold;
        light = adjusted >= localThreshold;

        if (kernel) {
          const error = (adjusted - (light ? 255 : 0)) * (alpha / 255);
          for (const [dx, dy, weight] of kernel) {
            const nx = x + dx;
            const ny = y + dy;
            if (nx < 0 || nx >= width || ny >= height) continue;
            const targetAlpha = data[(ny * width + nx) * 4 + 3] / 255;
            if (targetAlpha !== 0) errors[(ny % 3) * width + nx] += error * weight * targetAlpha;
          }
        }
      }
      // Transparent pixels remain transparent and cannot leak hidden RGB.
      const colour = alpha === 0 ? background : light !== invert ? background : foreground;
      output[offset] = colour[0];
      output[offset + 1] = colour[1];
      output[offset + 2] = colour[2];
      output[offset + 3] = alpha;
    }
    if (errors) errors.fill(0, errorRow, errorRow + width);
  }
  return { data: output, width, height };
}
