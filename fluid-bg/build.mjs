import { build } from "esbuild";

const common = {
  bundle: true,
  format: "esm",
  target: "es2019",
  minify: true,
  sourcemap: true,
  logLevel: "info",
};

// ESM entries
await build({ ...common, entryPoints: ["src/index.ts"], outfile: "dist/index.js" });
await build({ ...common, entryPoints: ["src/core.ts"], outfile: "dist/core.js" });
await build({
  ...common,
  entryPoints: ["src/react.tsx"],
  outfile: "dist/react.js",
  jsx: "automatic",
  external: ["react", "react/jsx-runtime"],
});

// IIFE for the CDN one-liner: registers <fluid-bg> and exposes window.FluidBg
await build({
  bundle: true,
  format: "iife",
  globalName: "FluidBg",
  target: "es2019",
  minify: true,
  sourcemap: true,
  entryPoints: ["src/index.ts"],
  outfile: "dist/fluid-bg.iife.js",
});

console.log("built → dist/");
