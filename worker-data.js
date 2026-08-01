/* GENERATED from index.html by fluid-core/build.mjs — DO NOT EDIT.
   Regenerate with: node fluid-core/build.mjs */
/* engine slugs by index — index = the #p= hash field id */
export const FIELDS = ["noise","flow","cellular","gyroid","truchet","interfere","kaleido","lines","grid","golden","smoke","crystal","honeycomb","bloom","sweep","marble","plaid","curtain","stitch","pursuit","chladni","cassini"];
export const SCREENS = ["square","hex","ascii","dither","glitch"];
/* material finishes — share-hash slot [28] */
export const FINISHES = ["none","glass","metal","sand","liquid","molten"];
/* math lenses — share-hash slots [29][30] */
export const LENSES = ["none","square","invert","mobius","droste","hyperbolic","julia","cube","exp","sine","joukowski","newton","modular"];
/* named palettes; hash index 8 is the custom-stops slot, not a name */
export const PALETTES = ["aurora","sunset","ocean","dusk","ember","mint","iris","chrome"];
/* built-in source images to melt (hash slot [12], 1-based) */
export const PRESETS = [];
/* curated looks keyed by lowercase name (the API's `look` argument).
   p = [speed,zoom,warp,grain,pixel,dot,dots,pal,seed,liq,mix,ar] */
export const LOOKS = {
  "borealis": {"field":0,"p":[0.4,2,3.5,0.03,1,10,0,0,30,0,0,1]},
  "afterglow": {"field":1,"p":[0.5,1.6,4,0.03,1,10,0,1,21,0,0,1]},
  "tide": {"field":1,"p":[0.5,1.5,5,0.03,1,10,0,2,48,0,0,1]},
  "twilight": {"field":0,"p":[0.35,2.3,3,0.03,1,10,0,3,12,0,0,1]},
  "magma": {"field":0,"p":[0.45,1.8,4.5,0.03,1,10,0,4,52,0,0,1]},
  "meridian": {"field":1,"p":[0.5,1.6,5,0.03,1,10,0,5,66,0,0,1]},
  "nebula": {"field":2,"p":[0.4,1.9,7,0.03,1,8,0,6,40,0,0,1]},
  "plasma": {"field":1,"p":[0.7,1.2,8,0.04,1,10,0,0,71,0,0,1]},
  "velvet": {"field":0,"p":[0.3,2.6,2,0.02,1,10,0,3,18,0,0,1]},
  "coral": {"field":2,"p":[0.45,1.8,7,0.03,1,10,0,1,33,0,0,1]},
  "glacier": {"field":0,"p":[0.4,2.2,3,0.03,1,10,0,2,25,0,0,1]},
  "onyx": {"field":2,"p":[0.4,1.9,8,0.03,1,8,0,7,60,0,0,1]},
  "weave": {"field":3,"p":[0.4,1.6,5,0.03,1,10,0,5,40,0,0,1]},
  "circuit": {"field":4,"p":[0.3,2,4,0.02,1,10,0,7,22,0,0,1]},
  "ripple": {"field":5,"p":[0.5,1.4,5,0.03,1,10,0,2,30,0,0,1]},
  "mandala": {"field":6,"p":[0.35,1.5,6,0.03,1,10,0,6,55,0,0,1]},
  "strata": {"field":7,"p":[0.3,1.6,3,0.02,1,10,0,3,28,0,0,1]},
  "mesh": {"field":8,"p":[0.3,1.8,4,0.02,1,10,0,5,33,0,0,1]},
  "sunflower": {"field":9,"p":[0.3,1.4,5,0.02,1,10,0,4,44,0,0,1]},
  "ribbon": {"field":3,"p":[0.3,1.55,4.8,0.02,4,9,1,2,28,0,0,0.5625]},
  "vortex": {"field":6,"p":[0.34,1.18,7.2,0.02,6,10,1,5,61,0,0,0.5625]},
  "abyss": {"field":0,"p":[0.22,2.25,7.6,0.03,5,8,1,2,87,0,0,0.5625]},
  "nova": {"field":5,"p":[0.32,1.18,6.4,0.02,4,7,1,7,52,0,0,0.5625]},
  "pixelbeam": {"field":1,"screen":3,"thresh":0.46,"p":[0.45,1.6,4,0,7,10,0,4,40,0,0,1]},
  "smoke": {"field":10,"cols":["#040414","#0a3a7a","#0484fc","#c2dbdc"],"p":[0.38,1.3,3,0.015,1,10,0,0,30,0,0,1]},
  "gilded": {"field":0,"material":5,"cols":["#0a0602","#6b3a05","#e8940f","#ffdf8a"],"p":[0.28,0.6,3.5,0.015,1,10,0,0,47,0,0,1]},
  "mercury": {"field":0,"material":5,"cols":["#020204","#1c1a2e","#5a5670","#e8e0f2"],"p":[0.28,0.7,4,0.015,1,10,0,0,61,0,0,1]},
  "bloom": {"field":13,"cols":["#c2b830","#e04a12","#e8489a","#f2ead8"],"p":[0.35,0.95,2.5,0.14,1,10,0,0,24,0,0,1]},
  "horizon": {"field":14,"cols":["#0d0b2e","#552a8a","#f27059","#ffd9a0"],"p":[0.3,1.2,3.2,0.05,1,10,0,0,33,0,0,1]},
  "sumi": {"field":15,"p":[0.3,1.5,5,0.02,1,10,0,6,41,0,0,1]},
  "tartan": {"field":16,"p":[0.35,1.4,3.5,0.02,1,10,0,4,26,0,0,1]},
  "veil": {"field":17,"p":[0.4,1.4,4,0.03,1,10,0,5,63,0,0,1]},
  "filament": {"field":18,"cols":["#070512","#4a1f7a","#e05c10","#ffe8b0"],"p":[0.3,0.95,5,0.02,1,10,0,0,44,0,0,1]},
  "gyre": {"field":19,"cols":["#0a0714","#3a2a7e","#b0489a","#ffe9b0"],"p":[0.35,1.15,4.5,0.02,1,10,0,0,54,0,0,1]},
  "cymatic": {"field":20,"cols":["#0b0907","#4a3418","#c99b3f","#fff4d8"],"p":[0.85,1.3,4.2,0.02,1,10,0,0,57,0,0,1]},
  "cassini": {"field":21,"cols":["#0a0f2e","#274690","#e8a33d","#fdf6e3"],"p":[0.4,1.2,5.5,0.02,1,10,0,0,41,0,0,1]},
  "escher": {"field":4,"lens":4,"cols":["#0c0a08","#4a3b23","#b98a3c","#f5ead2"],"p":[0.3,1.4,3,0.02,1,10,0,0,52,0,0,1]},
  "filigree": {"field":11,"lens":6,"cols":["#07030e","#22084a","#6a2a9c","#f5c34e"],"p":[0.3,1.45,3.5,0.02,1,10,0,0,71,0,0,1]},
  "shoreline": {"field":1,"lens":11,"cols":["#03121c","#0e4664","#4fb3a8","#f2e2b6"],"p":[0.35,2.2,6,0.02,1,10,0,0,18,0,0,1]},
  "rosette": {"field":12,"lens":12,"cols":["#0b0d14","#2f3648","#8a8f99","#efe6d0"],"p":[0.3,0.9,4,0.02,1,10,0,0,63,0,0,1]}
};
