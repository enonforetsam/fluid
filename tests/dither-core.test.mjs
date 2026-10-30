import assert from "node:assert/strict";
import test from "node:test";
import {
  ditherImage, DITHER_ALGORITHMS, DITHER_DEFAULTS,
  MAX_DITHER_PIXELS, MAX_DITHER_DIMENSION
} from "../site/dither-core.js";

const MONO = { foreground: "#000000", background: "#ffffff" };
function image(width, height, pixel) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) data.set(pixel(x, y), (y * width + x) * 4);
  }
  return { data, width, height };
}
const solid = (value, width = 16, height = 16) => image(width, height, () => [value, value, value, 255]);
const gradient = (width = 256, height = 32) => image(width, height, (x) => {
  const value = Math.round(x * 255 / (width - 1));
  return [value, value, value, 255];
});
function whiteFraction(result, start = 0, end = result.width) {
  let count = 0;
  for (let y = 0; y < result.height; y++) {
    for (let x = start; x < end; x++) count += result.data[(y * result.width + x) * 4] === 255;
  }
  return count / ((end - start) * result.height);
}
const renderMono = (source, options = {}) => ditherImage(source, { ...MONO, ...options });
const rgb = (result, pixel = 0) => Array.from(result.data.slice(pixel * 4, pixel * 4 + 3));

for (const algorithm of DITHER_ALGORITHMS) {
  test(`${algorithm}: deterministic palette output, copied alpha, untouched input`, () => {
    const source = image(53, 29, (x, y) => [
      (x * 11 + y * 7) % 256, (x * 19 + y * 3) % 256,
      (x * 5 + y * 23) % 256, (x + y) % 4 === 0 ? 0 : (x + y) % 4 === 1 ? 96 : 255
    ]);
    const before = source.data.slice();
    const options = { algorithm, foreground: "#123456", background: "#fedcba" };
    const result = ditherImage(source, options);
    assert.equal(result.width, source.width);
    assert.equal(result.height, source.height);
    assert.ok(result.data instanceof Uint8ClampedArray);
    assert.notEqual(result.data, source.data);
    assert.deepEqual(source.data, before);
    assert.deepEqual(ditherImage(source, options).data, result.data);
    for (let p = 0; p < result.data.length; p += 4) {
      const colour = Array.from(result.data.slice(p, p + 3)).join(",");
      assert.ok(colour === "18,52,86" || colour === "254,220,186");
      assert.equal(result.data[p + 3], source.data[p + 3]);
    }
  });
}

test("the five algorithms produce distinct patterns on a gradient", () => {
  const source = gradient(97, 37);
  const patterns = DITHER_ALGORITHMS.map((algorithm) =>
    Buffer.from(renderMono(source, { algorithm }).data).toString("base64"));
  assert.equal(new Set(patterns).size, DITHER_ALGORITHMS.length);
});

test("ordered4 matches the Bayer matrix and repeats every four pixels", () => {
  const result = renderMono(solid(80, 8, 4), { algorithm: "ordered4" });
  const expected = [
    [255, 0, 255, 0], [0, 255, 0, 0],
    [255, 0, 255, 0], [0, 0, 0, 0]
  ];
  for (let y = 0; y < 4; y++) {
    for (let x = 0; x < 8; x++) assert.equal(result.data[(y * 8 + x) * 4], expected[y][x % 4]);
  }
});

test("dithering retains increasing gradient tone density", () => {
  const source = gradient();
  for (const algorithm of DITHER_ALGORITHMS.filter((id) => id !== "threshold")) {
    const result = renderMono(source, { algorithm });
    const dark = whiteFraction(result, 0, 64);
    const middle = whiteFraction(result, 96, 160);
    const light = whiteFraction(result, 192, 256);
    assert.ok(dark < middle && middle < light, `${algorithm}: ${dark}, ${middle}, ${light}`);
    assert.ok(dark < 0.22 && light > 0.78, algorithm);
    assert.ok(Math.abs(whiteFraction(result) - 0.5) < 0.04, algorithm);
    assert.equal(whiteFraction(renderMono(solid(0), { algorithm })), 0);
    assert.equal(whiteFraction(renderMono(solid(255), { algorithm })), 1);
  }
});

test("dark pixels use ink, light pixels use paper, short hex colours work", () => {
  const source = image(2, 1, (x) => x ? [255, 255, 255, 255] : [0, 0, 0, 255]);
  const result = ditherImage(source, { algorithm: "threshold", foreground: "#123", background: "#abc" });
  assert.deepEqual(rgb(result), [17, 34, 51]);
  assert.deepEqual(rgb(result, 1), [170, 187, 204]);
  assert.equal(DITHER_DEFAULTS.foreground, "#18191b");
  assert.equal(DITHER_DEFAULTS.background, "#f1efeb");
});

test("invert swaps every visible palette decision without changing alpha", () => {
  const source = gradient(29, 17);
  for (const algorithm of DITHER_ALGORITHMS) {
    const normal = renderMono(source, { algorithm });
    const inverted = renderMono(source, { algorithm, invert: true });
    for (let p = 0; p < normal.data.length; p += 4) {
      for (let c = 0; c < 3; c++) assert.equal(inverted.data[p + c], 255 - normal.data[p + c]);
      assert.equal(inverted.data[p + 3], normal.data[p + 3]);
    }
  }
});

test("brightness, contrast and threshold have observable independent effects", () => {
  const source = solid(120);
  const options = { algorithm: "threshold" };
  assert.equal(whiteFraction(renderMono(source, options)), 0);
  assert.equal(whiteFraction(renderMono(source, { ...options, brightness: 10 })), 1);
  assert.equal(whiteFraction(renderMono(source, { ...options, threshold: 100 })), 1);
  assert.equal(whiteFraction(renderMono(solid(255), { ...options, threshold: 255 })), 1);
  assert.equal(whiteFraction(renderMono(solid(0), { ...options, threshold: 255, brightness: 100 })), 1);
  assert.equal(whiteFraction(renderMono(solid(0), { ...options, threshold: 0 })), 1);
  const mid = solid(140);
  assert.equal(whiteFraction(renderMono(mid, { ...options, threshold: 150 })), 0);
  assert.equal(whiteFraction(renderMono(mid, { ...options, threshold: 150, contrast: 50 })), 1);
  assert.equal(whiteFraction(renderMono(mid, { ...options, threshold: 150, contrast: -100 })), 0);
  assert.deepEqual(renderMono(source, { brightness: 1000 }).data, renderMono(source, { brightness: 100 }).data);
  assert.deepEqual(renderMono(source, { contrast: -1000 }).data, renderMono(source, { contrast: -100 }).data);
  assert.deepEqual(renderMono(source, { threshold: 1000 }).data, renderMono(source, { threshold: 255 }).data);
});

test("hidden transparent RGB never affects any visible dithering", () => {
  const a = image(31, 13, (x, y) => (x + y) % 3 === 0 ? [0, 0, 0, 0] : [110, 110, 110, 255]);
  const b = image(31, 13, (x, y) => (x + y) % 3 === 0 ? [255, 91, 203, 0] : [110, 110, 110, 255]);
  for (const algorithm of DITHER_ALGORITHMS) {
    assert.deepEqual(renderMono(a, { algorithm }).data, renderMono(b, { algorithm }).data);
  }
});

test("transparent pixels do not relay error across a transparent gap", () => {
  const source = image(3, 1, (x) => [[100, 100, 100, 255], [100, 100, 100, 0], [120, 120, 120, 255]][x]);
  const result = renderMono(source, { algorithm: "floyd" });
  assert.deepEqual(Array.from(result.data), [0, 0, 0, 255, 255, 255, 255, 0, 0, 0, 0, 255]);
});

test("partial alpha attenuates diffusion while retaining the source coverage", () => {
  const opaque = image(2, 1, (x) => x ? [120, 120, 120, 255] : [100, 100, 100, 255]);
  const partial = image(2, 1, (x) => x ? [120, 120, 120, 255] : [100, 100, 100, 1]);
  const a = renderMono(opaque, { algorithm: "floyd" });
  const b = renderMono(partial, { algorithm: "floyd" });
  assert.deepEqual(rgb(a, 1), [255, 255, 255]);
  assert.deepEqual(rgb(b, 1), [0, 0, 0]);
  assert.equal(b.data[3], 1);
});

test("single pixels, narrow lines and nonmultiple dimensions work", () => {
  for (const [width, height] of [[1, 1], [1, 19], [19, 1], [3, 5], [9, 7]]) {
    const source = image(width, height, (x, y) => [x * 31, y * 27, 100, 255]);
    for (const algorithm of DITHER_ALGORITHMS) {
      const result = renderMono(source, { algorithm });
      assert.equal(result.data.length, width * height * 4);
      assert.ok(result.data.every((channel) => channel === 0 || channel === 255));
    }
  }
  assert.deepEqual(renderMono(solid(0, 1, 1), { algorithm: "threshold" }).data, new Uint8ClampedArray([0, 0, 0, 255]));
  assert.deepEqual(renderMono(solid(255, 1, 1), { algorithm: "threshold" }).data, new Uint8ClampedArray([255, 255, 255, 255]));
});

test("rejects malformed images and bounds dimensions before allocating", () => {
  for (const source of [null, undefined, 1, {},
    { width: 0, height: 1, data: new Uint8Array() },
    { width: 1.5, height: 1, data: new Uint8Array(4) },
    { width: NaN, height: 1, data: new Uint8Array(4) },
    { width: 1, height: Infinity, data: new Uint8Array(4) },
    { width: 1, height: -1, data: new Uint8Array(4) },
    { width: 1, height: 1, data: new Uint8Array(3) },
    { width: 1, height: 1, data: new Uint8Array(5) },
    { width: 1, height: 1, data: [0, 0, 0, 255] },
    { width: 1, height: 1, data: new Float32Array(4) },
    { width: MAX_DITHER_DIMENSION + 1, height: 1, data: new Uint8Array() },
    { width: MAX_DITHER_DIMENSION, height: MAX_DITHER_DIMENSION, data: new Uint8Array() }
  ]) assert.throws(() => ditherImage(source));
  assert.ok(MAX_DITHER_PIXELS > 0);
  assert.equal(ditherImage({ width: 1, height: 1, data: new Uint8Array([0, 0, 0, 255]) }).data.length, 4);
});

test("rejects unknown algorithms, malformed colours and nonfinite controls", () => {
  const source = solid(128, 1, 1);
  for (const options of [null, [], "ordered4", { algorithm: "random" }, { algorithm: null },
    { foreground: "red" }, { background: "#12345g" }, { foreground: null },
    { foreground: "#1234" }, { invert: 1 }, { invert: null },
    ...["brightness", "contrast", "threshold"].flatMap((name) => [NaN, Infinity, -Infinity, "50", null]
      .map((value) => ({ [name]: value })))
  ]) assert.throws(() => ditherImage(source, options));
});
