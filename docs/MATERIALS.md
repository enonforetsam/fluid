# Material Studio · v3.3

Build a piece in three steps: choose its field, choose its finish, choose its surface.
Every finish can sit on every substrate. The Look tab includes sixteen complete recipes;
select one, then change the palette or material controls to make it yours.

## Fields added in v3.3

| Engine | Character | Start with |
|---|---|---|
| `wash` | Uneven flowing pigment clouds | MONSOON, WILDFLOWER |
| `spray` | Overlapping aerosol strokes | BACK ALLEY, NEON WALL |
| `brushwork` | Broad directional brush marks | OIL STUDY, COBALT CANVAS |
| `strata` | Warped sedimentary bands | CANYON, FRESCO |
| `terrazzo` | Irregular stone chips and mortar | TERRAZZO CLUB |
| `woodgrain` | Distorted growth rings | CEDAR |

The original 24 engines remain available, including flow, marbling, crystal, and topographic contours.

## Finish and surface are independent

| Finish (`material` in the library, `finish` in REST/MCP) | Appearance |
|---|---|
| `none` | Original palette colour |
| `glass`, `metal`, `sand`, `liquid`, `molten` | Existing glassy, reflective, granular, wet, and tinted-metal shading |
| `paint` | Impasto dabs, bristle ridges, directional highlights |
| `watercolor` | Uneven pigment, pooling edges, paper-like granulation |
| `graffiti` | Aerosol speckles, overspray, directional drips |
| `charcoal` | Dark hatch marks and granular drawing texture |
| `pastel` | Soft chalk particles and dry strokes |
| `ink` | Dark strokes and diluted pools |
| `ceramic` | Glazed highlights and crazing |

Substrates: `none`, `canvas` (woven threads), `paper` (fibres), `concrete` (pores),
`stone` (veins), `wood` (grain), and `plaster` (mottled relief). These are procedural
visual textures; the engine does not simulate physical pigment transport or drying.

| Parameter | Range | Default | Effect |
|---|---:|---:|---|
| `materialAmt` | 0–1 | 1 | Mixes finish with the original colour; zero bypasses it |
| `textureScale` | 0.25–4 | 1 | Larger values enlarge artistic texture features |
| `relief` | 0–2 | 1 | Apparent depth of artistic finish and substrate details |
| `substrateAmt` | 0–1 | 0.55 | Surface texture strength; zero bypasses it |

The palette still controls the piece. Charcoal and ink intentionally darken it; ceramic and
paper finishes add their own highlights. Screen modes, lenses, and up to three field layers
remain composable with materials. Substrates are applied after screen modes so dithering does
not erase the selected paper, stone, or canvas texture.

## Native library

```sh
npm install https://github.com/enonforetsam/fluid/releases/download/v3.3.0/fluid-core-3.3.0.tgz
```

```js
import { createFluid, FIELDS, MATERIALS, SUBSTRATES, LOOKS } from 'fluid-core';

const art = createFluid(document.querySelector('#art'), {
  look: 'OIL STUDY',
  substrate: 'canvas',
  materialAmt: 0.9,
  textureScale: 1.3,
  relief: 1.2,
  seed: 42
});
art.set({ material: 'watercolor', substrate: 'paper' });
const link = art.shareUrl();
const png = art.toDataURL();
// On unmount:
art.destroy();
```

Give the mount element a width and height. Look names are case-insensitive; preserve spaces in multiword names. A look replaces old layers and resets material settings before applying
explicit overrides. Exported registries can drive your own pickers.

## REST and MCP

```sh
curl 'https://befluid.xyz/api/piece?look=monsoon&substrate=canvas&materialAmt=0.8&textureScale=1.4'
curl 'https://befluid.xyz/api/piece?field=spray&finish=graffiti&substrate=concrete&relief=1.2&seed=42'
```

The MCP `create_piece` tool accepts the same named finish, substrate, and numeric controls.
Its `get_embed_code` output loads the current engine from `/fluid-bg.js`. Native `<fluid-bg>`
and React embeds consume the resulting share hash, including all material parameters.

## Reproduction and compatibility

v3.3 appends engine IDs 24–29, finish IDs 7–12, and share-hash slots 34–38. Existing IDs and
old links keep their meaning. Strengths of zero survive save, reload, and share. New hashes
need the v3.3 renderer; older npm builds cannot display the new materials. Use the self-hosted
script or the release archives. No npm registry publication is required to use this release.

Texture coordinates follow the artwork rather than the export’s pixel count. Exact-size image
exports and standalone HTML include all material controls. Animation time is not serialized in
a share URL; a reopened animated piece starts its timeline again.

## Further engine directions

The next substantial advances would be pressure-sensitive brush input and masks, layer-specific
materials, tileable texture exports, and an optional stateful wet-paint solver. Those require
new interaction or rendering architecture; this release focuses on procedural materials that
remain compact, deterministic, portable, and compatible with WebGL1.
