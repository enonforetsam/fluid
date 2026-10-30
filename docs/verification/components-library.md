# Fluid Components — 30 October 2026

The first Fluid component library adds six original React + CSS components: Split Reveal, Wave Text, Magnetic Button, Spotlight Card, Tilt Card, and Loop Marquee. The actual downloadable source powers each preview. The page provides category/search, controls, deep links/history, Preview/Code tabs, JSX/CSS/usage, clipboard and downloads, reduced motion, and touch/keyboard behavior. Existing navigation and home/developer entry points link to Components.

## Build and source

Source lives in site/components/src/ and site/components/gallery.jsx. Shared portable styles are site/components/components.css; page chrome uses site/components.css and existing shared Fluid tokens. The checked-in gallery.js is built from those sources, with complete React MIT notices in gallery.js.LEGAL.txt. The gallery stays a static self-hosted page; downloadable components depend only on React.

Use npm install for the pinned development dependencies on a fresh machine, npm run build:components after changing React source, npm run build:site to create the explicit public package, and npm test. On the existing VPS test lane, FLUID_COMPONENTS_ESBUILD=/opt/codex-workspaces/jalan-globe06/node_modules/esbuild/lib/main.js and FLUID_COMPONENTS_NODE_PATH=/opt/workspaces/kuih-bright-20261025/node_modules reuse installed dependencies without another installation. Build:site packages checked-in output and does not install dependencies.

The asset allowlist intentionally exposes the six JSX sources, shared CSS, catalogue and licenses; gallery.jsx, build/test tooling, notes and QA remain private. No production deployment was performed for this feature.

## Verification

- 167 repository tests passed; final six packaging checks passed.
- Two final builds were byte-identical; bundle syntax valid; 163 public files.
- 19 browser workflow groups passed, including exact clipboard/download source bytes, failure/retry and clipboard fallback.
- All six previews passed long unbroken text at 320px; seven app pages passed layout checks at 320, 390, 768 and 1440px.
- Standalone downloaded source compiled/mounted under development Strict Mode, with balanced listeners and zero active listeners after unmount.
- Reduced-motion, synthetic touch and keyboard workflows passed. No uncaught JavaScript errors; intentionally injected source503 was handled.
- UI audit passed all target/name/image checks. Resting-focus heuristic warnings were checked against the actual 2px focus-visible treatment. Five shared text/background pairs pass WCAG AA. No layout-property transition suspects in new styles.
- Mac Chrome visibly rendered the live component preview and React source tabs. Physical devices and Safari were not tested.

Evidence on VPS: /tmp/fluid-components-qa-20261030/verification.json, /tmp/fluid-components-build-verification-20261030.json, /tmp/fluid-components-tests-20261030.log. Local screenshots/receipts are saved under website/qa/components-20261030 in Danial’s Fluid 2 folder. Worker routing/CSP results are recorded separately.

## Local Worker verification

The actual local Worker passed 25 HTTP/MCP checks and four browser groups under its real CSP: all six preview mounts, exact source/CSS display, copy/download, clean routes, private404s and unchanged API/MCP. No page/console/CSP/request errors. Receipts: /tmp/fluid-components-worker-verification-20261030.json and /tmp/fluid-components-worker-browser-20261030.json. The temporary Worker was task-owned and can be stopped after checks; the Python8893 private preview remains for review.
