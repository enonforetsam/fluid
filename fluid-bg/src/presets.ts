// The ambient presets: looks tuned to sit BEHIND a page rather than be the page —
// slow (speed ≤ 0.15), large soft forms (zoomed in, low warp), little grain, one accent
// on a quiet base. Seven dark bases, three light. Each is an ordinary share hash, so a
// preset can always be opened in the studio and remixed from there.
//
// The hashes are composed from the append-only slot contract (docs/ARCHITECTURE.md):
// [speed, zoom, warp, grain, pixel 1, dot 10, halftone 0, palette 8 (custom), seed,
//  liquify 0, blend 0, aspect 1, preset 0, embed 0, field, screen 0, pan 0 0, sym 0,
//  reserved 0, four packed RGB stops]. `colors` restates the stops for swatches.

export interface FluidBgPreset {
  /** the share hash the preset renders */
  hash: string;
  /** the four gradient stops, dark to light, for swatches and scrims */
  colors: [string, string, string, string];
  /** whether the base reads as a dark or a light page background */
  tone: "dark" | "light";
  /** a few words for a picker */
  tip: string;
}

export const PRESETS: Record<string, FluidBgPreset> = {
  mist:   { hash: "#p=0.12,0.9,2,0.02,1,10,0,8,21,0,0,1,0,0,0,0,0,0,0,0,724242,1712176,3820139,8229045", colors: ["#0b0d12", "#1a2030", "#3a4a6b", "#7d90b5"], tone: "dark", tip: "cool grey-blue haze" },
  ember:  { hash: "#p=0.14,0.85,2.5,0.02,1,10,0,8,33,0,0,1,0,0,13,0,0,0,0,0,919817,2757648,9320994,13926988", colors: ["#0e0909", "#2a1410", "#8e3a22", "#d4824c"], tone: "dark", tip: "warm glow from below" },
  dusk:   { hash: "#p=0.1,1,2,0.02,1,10,0,8,48,0,0,1,0,0,14,0,0,0,0,0,657951,2759242,6963097,12162524", colors: ["#0a0a1f", "#2a1a4a", "#6a3f99", "#b995dc"], tone: "dark", tip: "violet gradient, edges alive" },
  ink:    { hash: "#p=0.12,0.8,3,0.03,1,10,0,8,18,0,0,1,0,0,10,0,0,0,0,0,657930,1579032,3421236,7237230", colors: ["#0a0a0a", "#181818", "#343434", "#6e6e6e"], tone: "dark", tip: "monochrome smoke" },
  glow:   { hash: "#p=0.15,0.9,2.5,0.02,1,10,0,8,60,0,0,1,0,0,13,0,0,0,0,0,397594,734272,1277301,8375743", colors: ["#06111a", "#0b3440", "#137d75", "#7fcdbf"], tone: "dark", tip: "teal light" },
  aurora: { hash: "#p=0.12,1.1,2.5,0.02,1,10,0,8,30,0,0,1,0,0,17,0,0,0,0,0,330002,730676,1732452,7652011", colors: ["#050912", "#0b2634", "#1a6f64", "#74c2ab"], tone: "dark", tip: "a slow curtain" },
  deep:   { hash: "#p=0.15,0.9,2,0.02,1,10,0,8,52,0,0,1,0,0,1,0,0,0,0,0,329485,725542,1715550,4878289", colors: ["#05070d", "#0b1226", "#1a2d5e", "#4a6fd1"], tone: "dark", tip: "blue current" },
  paper:  { hash: "#p=0.1,0.9,2,0.03,1,10,0,8,24,0,0,1,0,0,0,0,0,0,0,0,16250093,15525334,14208181,12168080", colors: ["#f7f4ed", "#ece5d6", "#d8ccb5", "#b9ab90"], tone: "light", tip: "warm paper" },
  lilac:  { hash: "#p=0.12,0.85,2.5,0.02,1,10,0,8,41,0,0,1,0,0,13,0,0,0,0,0,16315900,15459063,13481706,10912984", colors: ["#f8f5fc", "#ebe2f7", "#cdb6ea", "#a684d8"], tone: "light", tip: "soft lilac" },
  shore:  { hash: "#p=0.1,1,2,0.02,1,10,0,8,27,0,0,1,0,0,14,0,0,0,0,0,15988985,14675697,11130076,6269112", colors: ["#f3f8f9", "#dfeef1", "#a9d4dc", "#5fa8b8"], tone: "light", tip: "sea-glass light" }
};

/** Preset names in picker order: dark bases first, then light. */
export const PRESET_NAMES: string[] = Object.keys(PRESETS);
