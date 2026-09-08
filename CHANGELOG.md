# Changelog

## 3.3.0 · 2026-09-09 — Material Studio

- Add six field engines: wash, spray, brushwork, strata, terrazzo, woodgrain (30 total).
- Add watercolor, graffiti, charcoal, pastel, ink, and ceramic finishes (12 total, plus none).
- Add independent canvas, paper, concrete, stone, wood, and plaster substrates.
- Add finish strength, texture size, relief, and surface strength controls, including exact zero-strength bypass.
- Add sixteen complete artist recipes and a dedicated recipe shelf in Look; improve material controls for touch and keyboard use.
- Carry materials through studio state, undo/save, share hashes, image and standalone HTML exports, native fluid-core, fluid-bg, REST, and MCP.
- Keep old IDs and share links compatible; append five default-offset material hash slots.
- Preserve artistic texture scale across output sizes.
- Include the Backgrounds page: ten ambient presets, blur/dim controls, and four page templates.
- Serve a matching embed bundle from the site, with a source checksum that prevents stale engine builds.
- Ship installable fluid-core and fluid-bg 3.3.0 archives on GitHub; npm registry publication is separate.
- Gate production deployment on the test suite. Add browser GPU coverage for all fields, finishes, surfaces, screens, and new recipe round-trips.

The existing v4.0.0 tag is retained. v3.3.0 names this requested open-source material-engine release;
the unfinished hosted publishing/community work is not part of it.
