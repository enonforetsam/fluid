/* Curated browsing metadata for the real Fluid 3.3 registry.
 * Native thumbnails: 800 × 500, seed 42, paused at t = 0.
 * Text and logo inputs use the full studio's masks, not native createFluid.
 */
import {
  LOOKS as NATIVE_LOOKS, FIELDS, PALETTES, SCREENS, MATERIALS, SUBSTRATES, LENSES
} from './vendor/fluid-core/src/generated/data.js';

export const COLLECTIONS = [
  {id:'living-gradients',name:'Living gradients',description:'Soft colour fields, luminous curtains, and gradients with a pulse.',featured:['bloom','horizon','borealis','veil'],cover:'bloom'},
  {id:'fluid-forms',name:'Fluid forms',description:'Swirling currents, clouded colour, and organic shapes in motion.',featured:['afterglow','smoke','sumi','nebula'],cover:'afterglow'},
  {id:'liquid-metal',name:'Liquid metal',description:'Molten highlights and reflective surfaces, from gold to cool silver.',featured:['mercury','gilded','onyx'],cover:'mercury'},
  {id:'print-pixels',name:'Print & pixels',description:'Dithered colour, pixel grids, and halftone-like screens.',featured:['pixelbeam','ribbon','nova','vortex'],cover:'pixelbeam'},
  {id:'patterns-rhythm',name:'Patterns & rhythm',description:'Woven lines, repeating geometry, and patterns that find their rhythm.',featured:['filament','cymatic','tartan','mandala'],cover:'filament'},
  {id:'impossible-spaces',name:'Impossible spaces',description:'Folded perspectives and mathematical lenses that bend familiar patterns.',featured:['filigree','escher','shoreline','rosette'],cover:'filigree'},
  {id:'paint-paper',name:'Paint & paper',description:'Pigment washes, bristled strokes, and tactile marks on paper or canvas.',featured:['wildflower','cobalt-canvas','sumi-paper','impasto'],cover:'wildflower'},
  {id:'surfaces-street',name:'Surfaces & street',description:'Sprayed walls, mineral layers, glazed surfaces, and natural grain.',featured:['neon-wall','terrazzo-club','cedar','celadon'],cover:'neon-wall'}
];

// [collection, visual description, discovery tags]
const EDITORIAL = {
  'BOREALIS':['living-gradients','Soft aurora colour drifts through a warped noise field.',['aurora','soft','atmospheric']],
  'AFTERGLOW':['fluid-forms','Warm sunset ribbons curl through a flowing colour field.',['sunset','warm','swirls']],
  'TIDE':['fluid-forms','Deep blue currents open into pale aqua highlights.',['ocean','blue','currents']],
  'TWILIGHT':['living-gradients','Lavender and rose drift across a quiet, clouded field.',['lavender','pastel','soft']],
  'MAGMA':['fluid-forms','Ember reds and warm gold spread through dark organic forms.',['ember','warm','organic']],
  'MERIDIAN':['living-gradients','Fresh mint tones turn through gentle flowing contours.',['mint','green','fresh']],
  'NEBULA':['fluid-forms','Iris-coloured cellular forms gather into luminous clusters.',['violet','cells','luminous']],
  'PLASMA':['fluid-forms','Strongly warped aurora currents coil into energetic swirls.',['aurora','energetic','swirls']],
  'VELVET':['living-gradients','Close, soft dusk tones create a smooth colour haze.',['dusk','soft','muted']],
  'CORAL':['fluid-forms','Sunset-coloured cells stretch into warm organic islands.',['coral','warm','cells']],
  'GLACIER':['living-gradients','Pale ocean tones drift through cool blue folds.',['blue','cool','soft']],
  'ONYX':['liquid-metal','Warped cellular forms carry a reflective chrome palette.',['chrome','reflective','cells']],
  'WEAVE':['patterns-rhythm','Mint-coloured gyroid bands cross into an organic weave.',['woven','mint','bands']],
  'CIRCUIT':['patterns-rhythm','Chrome maze lines weave through a repeating circuit pattern.',['maze','chrome','geometric']],
  'RIPPLE':['patterns-rhythm','Overlapping ocean-blue rings form interference patterns.',['rings','blue','interference']],
  'MANDALA':['patterns-rhythm','Mirrored iris-coloured sectors create a shifting radial pattern.',['radial','violet','symmetry']],
  'STRATA':['patterns-rhythm','Dusk-coloured parallel bands bend into layered rulings.',['stripes','dusk','layered']],
  'MESH':['patterns-rhythm','Crossed mint-coloured rulings form a clean moving lattice.',['grid','mint','lattice']],
  'SUNFLOWER':['patterns-rhythm','Golden spiral geometry gathers into a phyllotaxis pattern.',['spiral','golden','radial']],
  'RIBBON':['print-pixels','Ocean-coloured woven bands break into a dotted pixel screen.',['halftone','blue','woven']],
  'VORTEX':['print-pixels','A mint kaleidoscope pulls a dotted screen into radial motion.',['halftone','mint','radial']],
  'ABYSS':['print-pixels','Deep ocean noise becomes a dense, dark dotted field.',['halftone','dark','blue']],
  'NOVA':['print-pixels','Chrome interference rings meet a crisp dotted screen.',['halftone','chrome','rings']],
  'PIXELBEAM':['print-pixels','Ember-coloured flow resolves into a coarse dithered pattern.',['dither','pixel','ember']],
  'SMOKE':['fluid-forms','Electric blue clouds billow across a deep midnight field.',['blue','clouds','atmospheric']],
  'GILDED':['liquid-metal','Broad molten gold folds catch bright amber highlights.',['gold','molten','reflective']],
  'MERCURY':['liquid-metal','Cool silver and violet folds form a molten metal surface.',['silver','molten','reflective']],
  'IMPASTO':['paint-paper','Warm flowing colour picks up a thick painted surface.',['paint','warm','textured']],
  'BLOOM':['living-gradients','Pink, orange, and yellow colour pools form a grainy mesh gradient.',['mesh-gradient','grain','colourful']],
  'HORIZON':['living-gradients','Violet fades into peach along a gently moving gradient sweep.',['gradient','peach','violet']],
  'SUMI':['fluid-forms','Iris-coloured ink swirls form combed marbling patterns.',['marbling','violet','ink-like']],
  'TARTAN':['patterns-rhythm','Warm crossed stripes create a woven plaid pattern.',['plaid','woven','warm']],
  'VEIL':['living-gradients','Mint light hangs in softly shifting vertical curtains.',['curtains','mint','luminous']],
  'FILAMENT':['patterns-rhythm','Fine amber and violet threads trace times-table string art.',['string-art','threads','amber']],
  'GYRE':['patterns-rhythm','Nested polygons chase one another through a violet spiral.',['polygons','spiral','violet']],
  'CYMATIC':['patterns-rhythm','Golden vibrating-plate figures reveal shifting nodal patterns.',['nodal','golden','symmetry']],
  'CASSINI':['patterns-rhythm','Blue and gold oval contours gather around paired centres.',['contours','ovals','blue']],
  'ESCHER':['impossible-spaces','A golden woven maze folds inward through a Droste lens.',['droste','recursive','maze']],
  'FILIGREE':['impossible-spaces','Violet and gold crystal geometry bends through a Julia lens.',['julia','crystal','ornate']],
  'SHORELINE':['impossible-spaces','A Newton lens turns teal currents into branching coastal shapes.',['newton','teal','branching']],
  'ROSETTE':['impossible-spaces','A modular lens rearranges a pale hexagonal lattice.',['modular','hexagonal','pale']],
  'RELIEF':['fluid-forms','Rose-coloured elevation contours drift across a rugged field.',['topography','contours','rose']],
  'MONSOON':['paint-paper','Blue-grey pigment pools spread over a warm paper surface.',['watercolour','paper','blue-grey']],
  'WILDFLOWER':['paint-paper','Rose and peach watercolour pools bloom across textured paper.',['watercolour','paper','rose']],
  'BACK ALLEY':['surfaces-street','Multicoloured sprayed gestures and drips sit on concrete.',['graffiti','concrete','colourful']],
  'NEON WALL':['surfaces-street','Violet, pink, and yellow spray marks spread across concrete.',['graffiti','concrete','neon']],
  'OIL STUDY':['paint-paper','Teal and ochre bristled strokes overlap on canvas.',['paint','canvas','bristles']],
  'COBALT CANVAS':['paint-paper','Cobalt and pale blue brushwork builds over woven canvas.',['paint','canvas','cobalt']],
  'CHARCOAL STUDY':['paint-paper','Soft grey pigment takes on a charcoal texture over paper.',['charcoal','paper','monochrome']],
  'SOFT CHALK':['paint-paper','Muted peach and slate colour pools carry a pastel paper texture.',['pastel','paper','muted']],
  'SUMI PAPER':['paint-paper','Dark ink marbling moves across a warm paper surface.',['ink','paper','marbling']],
  'CANYON':['surfaces-street','Folded terracotta mineral bands reveal a stone texture.',['stone','terracotta','mineral']],
  'TERRAZZO CLUB':['surfaces-street','Irregular coloured stone chips scatter through pale mortar.',['terrazzo','stone','chips']],
  'CEDAR':['surfaces-street','Warm growth rings and knots follow flowing wood fibres.',['wood','warm','grain']],
  'CELADON':['surfaces-street','Soft green gyroid bands carry a ceramic glaze over plaster.',['ceramic','plaster','green']],
  'FRESCO':['surfaces-street','Muted mineral bands take on a chalky plaster surface.',['pastel','plaster','mineral']],
  'TERRA INK':['surfaces-street','Earth-toned folded strata carry an ink finish over stone.',['ink','stone','earthy']],
  'GALLERY LINEN':['surfaces-street','A warm neutral gradient reveals the weave of canvas.',['canvas','neutral','woven']]
};

const slug = (name) => name.toLowerCase().replace(/\s+/g,'-');
const title = (name) => name.toLowerCase().replace(/\b\w/g, letter => letter.toUpperCase());

function nativeParams(look) {
  const p=look.p;
  return {
    look:look.label, field:FIELDS[look.field],
    speed:p[0],zoom:p[1],warp:p[2],grain:p[3],pixel:p[4],dot:p[5],dots:p[6],seed:p[8],
    ...(look.cols ? {colors:[...look.cols]} : {palette:PALETTES[p[7]]}),
    screen:SCREENS[look.screen??0],material:MATERIALS[look.material??0],
    substrate:SUBSTRATES[look.substrate??0],lens:LENSES[look.lens??0],
    thresh:look.thresh??0.5,lensAmt:look.lensAmt??1,
    materialAmt:look.materialAmt??1,textureScale:look.textureScale??1,
    relief:look.relief??1,substrateAmt:look.substrateAmt??0.55
  };
}

export const LOOKS = NATIVE_LOOKS.map(look => {
  const editorial=EDITORIAL[look.label];
  if(!editorial) throw new Error(`Missing catalogue metadata: ${look.label}`);
  const [collection,description,tags]=editorial;
  const id=slug(look.label);
  return {
    id,name:look.label,humanTitle:title(look.label),collection,description,
    tags:[...new Set([...tags,FIELDS[look.field]])],
    inputs:['generated','text','logo'],
    renderModes:{native:['generated'],studio:['generated','text','logo']},
    params:nativeParams(look),
    preset:structuredClone(look),
    renderer:'v3.3',seed:42,previewTime:0,previewAspect:1.6,
    thumbnail:`./assets/look-thumbnails/${id}.webp`
  };
});

export const LOOK_BY_ID = Object.fromEntries(LOOKS.map(look=>[look.id,look]));
export const COLLECTION_BY_ID = Object.fromEntries(COLLECTIONS.map(collection=>[collection.id,collection]));

if(LOOKS.length!==58 || new Set(LOOKS.map(look=>look.id)).size!==58) {
  throw new Error('Fluid catalogue must contain all 58 unique v3.3 looks.');
}
for(const look of LOOKS) {
  if(!COLLECTION_BY_ID[look.collection]) throw new Error(`Unknown collection: ${look.collection}`);
}
for(const collection of COLLECTIONS) {
  for(const id of [...collection.featured,collection.cover]) {
    if(LOOK_BY_ID[id]?.collection!==collection.id) throw new Error(`Invalid featured look: ${id}`);
  }
}
