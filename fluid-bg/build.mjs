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

import { copyFileSync, readFileSync, appendFileSync } from "node:fs";
import { createHash } from "node:crypto";
// befluid.xyz serves this copy at /fluid-bg.js, so the site and its snippets never wait on npm
const sourceDigest = createHash("sha256")
  .update(readFileSync("../fluid-core/src/generated/shader.js"))
  .update(readFileSync("../fluid-core/src/generated/data.js"))
  .update(readFileSync("../fluid-core/src/mount.js"))
  .update(readFileSync("../fluid-core/src/hash.js"))
  .digest("hex");
appendFileSync("dist/fluid-bg.iife.js", "\n/* fluid-source-sha256:" + sourceDigest + " */\n");
copyFileSync("dist/fluid-bg.iife.js", "../assets/fluid-bg.iife.js");
console.log("built → dist/ (+ ../assets/fluid-bg.iife.js)");
