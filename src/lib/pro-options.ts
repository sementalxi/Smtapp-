// Options for the Pro AI creator (shared by the wizard UI and the prompt builder).
import type { FontKey, LayoutKind } from "./templates";

export interface ArtType {
  layout: LayoutKind;
  icon: string;
  en: { name: string; desc: string };
  es: { name: string; desc: string };
}

export const ART_TYPES: ArtType[] = [
  {
    layout: "PLAYER",
    icon: "🧍",
    en: { name: "Player card", desc: "Signing, MVP or player of the match — photo, name, position, number." },
    es: { name: "Tarjeta de jugador", desc: "Fichaje, MVP o jugador del partido — foto, nombre, posición, número." },
  },
  {
    layout: "CHAMPIONS",
    icon: "🏆",
    en: { name: "Champions", desc: "Title celebration with your squad list, trophy and competition badge." },
    es: { name: "Campeones", desc: "Celebración del título con la plantilla, trofeo y escudo del torneo." },
  },
  {
    layout: "MATCHDAY",
    icon: "📅",
    en: { name: "Match day", desc: "Next match poster: both crests, date, time, venue and competition." },
    es: { name: "Día de partido", desc: "Póster del próximo partido: ambos escudos, fecha, hora, lugar y torneo." },
  },
  {
    layout: "LINEUP",
    icon: "📋",
    en: { name: "Lineup", desc: "Starting XI in your formation with names, numbers and positions." },
    es: { name: "Alineación", desc: "Once inicial en tu formación con nombres, números y posiciones." },
  },
  {
    layout: "TOTW",
    icon: "⭐",
    en: { name: "Team of the week", desc: "Eleven player cards in formation — gamertag, position, points or club, and a photo on every card." },
    es: { name: "Equipo de la semana", desc: "Once tarjetas de jugador en formación — gamertag, posición, puntos o club, y una foto en cada tarjeta." },
  },
  {
    layout: "RESULT",
    icon: "⚽",
    en: { name: "Result", desc: "Full-time score with both crests and the goal scorers." },
    es: { name: "Resultado", desc: "Marcador final con ambos escudos y los goleadores." },
  },
  {
    layout: "STANDINGS",
    icon: "📊",
    en: { name: "Standings", desc: "League table: positions, teams, points and stats." },
    es: { name: "Tabla de posiciones", desc: "Tabla de la liga: posiciones, equipos, puntos y estadísticas." },
  },
  {
    layout: "LOGO",
    icon: "🛡️",
    en: { name: "Team logo", desc: "Create a brand-new team logo, or a cool poster that shows off your logo." },
    es: { name: "Logo del equipo", desc: "Crea un logo nuevo para tu equipo, o un póster épico que presuma tu logo." },
  },
  {
    layout: "EVENT",
    icon: "🎟️",
    en: { name: "Tournament / event", desc: "Announce a tournament: prize, entry, date and times." },
    es: { name: "Torneo / evento", desc: "Anuncia un torneo: premio, inscripción, fecha y horarios." },
  },
];

export interface FontStyle {
  id: string;
  label: string;
  /** How we describe it to the image model */
  prompt: string;
  /** Closest font we have, for the live preview */
  preview: FontKey;
  previewClass: string;
  /** Google Font used only for the picker preview (loaded on demand). */
  css?: string;
}

export const FONT_STYLES: FontStyle[] = [
  { id: "condensed", label: "Condensed Sport", prompt: "tall ultra-condensed heavy sports sans-serif capitals (Nike / Adidas campaign style), white with a gritty texture", preview: "anton", previewClass: "uppercase" },
  { id: "chrome", label: "Chrome 3D", prompt: "thick 3D extruded polished chrome capitals with sharp bevels, real reflections and a team-colour edge glow", preview: "anton", previewClass: "uppercase italic" },
  { id: "forged", label: "Forged Gold", prompt: "massive block capitals forged in dark scratched gold, chiselled bevels, molten glowing cracks, heavy hard shadow", preview: "anton", previewClass: "uppercase" },
  { id: "speed", label: "Speed Italic", prompt: "aggressive wide italic sports capitals with razor-sharp edges and speed streaks tearing off the back", preview: "anton", previewClass: "uppercase italic tracking-tight" },
  { id: "futuristic", label: "Futuristic", prompt: "angular futuristic capitals with cut corners in gunmetal and carbon fibre with thin glowing inlay lines", preview: "bebas", previewClass: "uppercase tracking-[0.2em]" },
  { id: "electric", label: "Electric", prompt: "brushed-steel capitals with lightning crackling across the letters and sparks jumping between them", preview: "bebas", previewClass: "uppercase tracking-widest" },
  { id: "flaming", label: "On Fire", prompt: "jagged burnt-gold capitals with real fire licking off the top edges and embers peeling away", preview: "anton", previewClass: "uppercase" },
  { id: "stone", label: "Cracked Stone", prompt: "monumental cracked stone capitals with molten team-colour light bursting out of the cracks", preview: "anton", previewClass: "uppercase tracking-wide" },
  { id: "gold", label: "Gold Luxury", prompt: "elegant tall high-contrast serif capitals in real embossed gold foil, wide letter-spacing, regal", preview: "bebas", previewClass: "uppercase tracking-widest" },
  { id: "gothic", label: "Gothic Metal", prompt: "brutal gothic blackletter in blackened steel with gold edges, engraved and battle-worn, like a heavy-metal album", preview: "gothic", previewClass: "" },
  { id: "stencil", label: "Military Stencil", prompt: "heavy military stencil capitals in war-torn paint over black metal, chipped and scorched", preview: "anton", previewClass: "uppercase tracking-[0.15em]" },
  { id: "grunge", label: "Grunge Poster", prompt: "ultra-bold grunge capitals ripped and torn like a street poster, halftone and spray-paint texture", preview: "anton", previewClass: "uppercase opacity-90" },
  { id: "brush", label: "Brush Script", prompt: "huge hand-painted brush script with explosive dry-brush strokes and paint splatter, slanted upward", preview: "brush", previewClass: "" },
  { id: "graffiti", label: "Graffiti", prompt: "hand-sprayed graffiti lettering with real drips, overspray and a thick outline", preview: "brush", previewClass: "" },
  { id: "neon", label: "Neon", prompt: "glowing neon tube lettering with a strong colour glow and reflections", preview: "bebas", previewClass: "uppercase tracking-[0.15em]" },
  { id: "clean", label: "Clean Modern", prompt: "clean modern geometric bold sans-serif", preview: "sans", previewClass: "font-extrabold uppercase" },
  // ── Cursive / script ──
  { id: "signature", label: "Signature", prompt: "a flowing elegant signature script, like a pro athlete's autograph signed in thick glossy marker, long confident swashes and a swoosh underline", preview: "brush", previewClass: "", css: "Mr Dafoe" },
  { id: "retro_script", label: "Retro Script", prompt: "a bold connected retro baseball-jersey script with a tail swash underline, thick outline and hard drop shadow, like a vintage team wordmark", preview: "brush", previewClass: "", css: "Yellowtail" },
  { id: "kaushan", label: "Street Script", prompt: "an energetic hand-lettered brush script with sharp dry-brush ends and dynamic slant, street-style and aggressive", preview: "brush", previewClass: "", css: "Kaushan Script" },
  { id: "luxury_script", label: "Luxury Script", prompt: "a luxurious calligraphic copperplate script in real gold foil with fine hairlines, elegant flourishes and a soft glow", preview: "brush", previewClass: "", css: "Great Vibes" },
  { id: "chicano", label: "Chicano Script", prompt: "a classic chicano / lowrider tattoo script with sharp ornate curls, deep black shading and a thin metallic outline", preview: "gothic", previewClass: "", css: "Pirata One" },
  { id: "marker", label: "Marker", prompt: "a thick raw hand-drawn permanent-marker lettering, bold and imperfect like a coach's tactics board", preview: "brush", previewClass: "uppercase", css: "Permanent Marker" },
  { id: "scratch", label: "Scratched", prompt: "a jagged hand-scratched lettering carved fast with a blade, rough edges and sharp strokes, raw and gritty", preview: "brush", previewClass: "", css: "Rock Salt" },
  { id: "tag", label: "Graffiti Tag", prompt: "a wild graffiti handstyle tag sprayed fast with drips, flared ends and an overspray glow, street-art energy", preview: "brush", previewClass: "", css: "Sedgwick Ave Display" },
  // ── Bad-ass display ──
  { id: "blackletter", label: "Old English", prompt: "a sharp classic Old English blackletter with crisp diamond serifs, in deep black with a chrome outline, like a premium streetwear logo", preview: "gothic", previewClass: "", css: "UnifrakturMaguntia" },
  { id: "metal_band", label: "Metal Band", prompt: "a spiky heavy-metal band logo lettering with dagger-like points and symmetrical thorns, forged in dark chrome", preview: "gothic", previewClass: "", css: "Metal Mania" },
  { id: "horror", label: "Horror Drip", prompt: "a horror-movie title lettering dripping thick liquid down from every letter, wet and glossy, menacing", preview: "anton", previewClass: "uppercase", css: "Creepster" },
  { id: "glitch", label: "Glitch", prompt: "a digital glitch lettering with RGB-split chromatic offsets, sliced scan-line displacement and pixel noise, esports-broadcast style", preview: "anton", previewClass: "uppercase", css: "Rubik Glitch" },
  { id: "speedline", label: "Racing", prompt: "an ultra-fast racing lettering with horizontal speed lines cut through the letters, motorsport-livery style, leaning forward", preview: "anton", previewClass: "uppercase italic", css: "Faster One" },
  { id: "army", label: "Black Ops", prompt: "a tactical black-ops lettering with chamfered corners and stencil cuts, battle-worn metal plate texture, call-of-duty style", preview: "anton", previewClass: "uppercase", css: "Black Ops One" },
  { id: "esports", label: "Esports", prompt: "a sharp angular esports team-logo lettering with aggressive cuts, wedges and a double outline, glossy and gaming-premium", preview: "bebas", previewClass: "uppercase", css: "Russo One" },
  { id: "space", label: "Sci-Fi", prompt: "a wide futuristic sci-fi lettering with rounded squares and thin glowing seams, like a space-movie title", preview: "bebas", previewClass: "uppercase tracking-widest", css: "Orbitron" },
  { id: "retro80s", label: "Retro 80s", prompt: "an 80s synthwave chrome lettering with a sunset gradient fill, horizontal chrome bands, sharp reflections and a neon pink glow", preview: "bebas", previewClass: "uppercase", css: "Monoton" },
  { id: "comic", label: "Comic Impact", prompt: "a punchy comic-book impact lettering with a thick black outline, halftone dots and a bold burst behind, slanted and loud", preview: "anton", previewClass: "uppercase", css: "Bangers" },
  { id: "block3d", label: "3D Block", prompt: "chunky 3D block lettering with deep layered extrusion stripes in the team colours, bold arcade sports style", preview: "anton", previewClass: "uppercase", css: "Bungee Shade" },
  { id: "roman", label: "Roman Empire", prompt: "a monumental Roman-empire inscription capitals carved in marble with gold inlay, imperial and legendary", preview: "bebas", previewClass: "uppercase tracking-widest", css: "Cinzel Decorative" },
  { id: "paint_drip", label: "Wet Paint", prompt: "a bold lettering freshly painted with thick wet paint running and dripping, glossy and fresh", preview: "anton", previewClass: "uppercase", css: "Rubik Wet Paint" },
  { id: "pixel", label: "Pixel Arcade", prompt: "a retro 8-bit pixel-arcade lettering with glowing pixels and scan lines, like a classic video-game title screen", preview: "bebas", previewClass: "uppercase text-sm", css: "Press Start 2P" },
];

export const TROPHY_STYLES = [
  { id: "surprise", label: "🎲 Surprise me", prompt: "" },
  { id: "globe", label: "Gold globe cup", prompt: "a tall polished gold trophy with a globe on top held by spiralling figures, on a dark base" },
  { id: "bigears", label: "Silver big-ears cup", prompt: "a large polished silver cup with two big curved handles on a round base" },
  { id: "shield", label: "Gold league shield", prompt: "a gold and black league trophy shield with laurel engraving" },
  { id: "crystal", label: "Crystal star", prompt: "a faceted crystal trophy shaped like a star, refracting light" },
  { id: "boot", label: "Golden boot", prompt: "a shiny golden football boot trophy on a black marble base" },
  { id: "chrome", label: "Chrome esports cup", prompt: "a futuristic chrome esports trophy with glowing accents" },
];

export const LANGUAGES = ["English", "Español", "Português", "Français", "Italiano"];

export const fontPrompt = (id: string) => FONT_STYLES.find((f) => f.id === id)?.prompt ?? "";
/** "Surprise me": a different, original trophy design every time. */
function surpriseTrophy() {
  const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];
  const shape = pick([
    "a tall slender cup with long sweeping handles",
    "a wide, heavy bowl-shaped cup with short angular handles",
    "an hourglass-shaped trophy with twisting ribbons of metal around it",
    "a towering spire-shaped trophy with sharp angular facets",
    "a classic two-handled cup with an ornate lid",
    "a futuristic trophy made of floating metal rings around a glowing core",
    "a laurel-wrapped column trophy topped with a crown",
    "a sculpted trophy shaped like a giant flame",
    "a geometric diamond-cut trophy",
    "a shield-and-sword trophy standing upright",
  ]);
  const top = pick(["a football on top", "a star on top", "a globe on top", "a crown on top", "a lightning bolt on top", "a laurel wreath on top", "nothing on top — a clean rim"]);
  const material = pick([
    "polished 24k gold",
    "mirror-polished silver",
    "black chrome with gold edges",
    "brushed platinum",
    "clear crystal with gold details",
    "dark gunmetal with glowing accents in the team colour",
    "warm gold and white marble",
    "chrome with enamel inlays in the team colours",
  ]);
  const base = pick(["a black marble base", "a stepped gold base", "a tall faceted crystal base", "a dark wooden base with a gold plate", "a glowing illuminated base"]);
  return `an ORIGINAL, unique trophy design: ${shape}, ${top}, made of ${material}, on ${base} — premium, detailed, photographic`;
}

export const trophyPrompt = (id: string) => (id === "surprise" ? surpriseTrophy() : TROPHY_STYLES.find((t) => t.id === id)?.prompt ?? "");

/** Second (AI-made) figure behind the player on player cards. */
export const BG_POSES = [
  { id: "closeup", en: "Close-up portrait", es: "Retrato de cerca", prompt: "a dramatic close-up portrait of the face and shoulders, looking slightly to the side with an intense, focused expression" },
  { id: "celebrate", en: "Celebrating", es: "Celebrando", prompt: "the player celebrating a goal — shouting, fists clenched or arms wide open" },
  { id: "arms", en: "Arms crossed", es: "Brazos cruzados", prompt: "a confident waist-up pose with arms crossed, looking straight at the camera" },
  { id: "lookup", en: "Looking up", es: "Mirando arriba", prompt: "looking up to the sky, pointing upwards, emotional moment, upper body" },
  { id: "profile", en: "Side profile", es: "Perfil", prompt: "a striking side-profile head-and-shoulders shot, serious expression, rim-lit" },
  { id: "silence", en: "Shush celebration", es: "Celebración silencio", prompt: "the player doing a 'shush' celebration, finger on lips, upper body" },
];

export const bgPosePrompt = (id: string) => (BG_POSES.find((p) => p.id === id) ?? BG_POSES[0]).prompt;

/** "Surprise me" (the default): the background figure gets a different angle / pose every poster — never the same straight-on portrait twice. */
export const SURPRISE_POSES = [
  "a close-up portrait turned three-quarters to the left, chin slightly down, eyes to the camera, intense and calm",
  "a striking SIDE PROFILE head-and-shoulders shot looking right, serious, strongly rim-lit along the nose and jaw",
  "looking back OVER THE SHOULDER toward the camera, the far shoulder forward, a cool half-smile",
  "head tilted down with the eyes closed, calm and focused, light falling on the brow and cheekbones",
  "looking UP and away to the right, chin raised, hopeful and proud, light from above",
  "a low-angle waist-up shot from below, arms crossed, looking down at the camera with authority",
  "laughing naturally, head thrown slightly back, eyes crinkled, genuine joy",
  "a quiet three-quarter portrait looking away to the left into the distance, thoughtful, soft side light",
  "a tight close-up of the face cropped at the forehead and chin, straight stare, every detail sharp",
  "turned away from the camera showing the back and the shoulder, head turned to look back at the lens",
  "hands clasped behind the head, elbows wide, chest-up, looking slightly up, relaxed power",
  "adjusting the collar or the sleeve with both hands, looking down at the hands, a calm smirk",
  "pointing at the camera with one hand, the other arm relaxed, confident grin, chest-up",
  "a screaming-free celebration: fists clenched at chest height, eyes shut, teeth clenched in effort",
  "leaning in toward the camera with the shoulders forward, a slight head tilt, playful confidence",
  "chin resting on a fist, elbow on a knee, looking straight at the camera, thinking",
  "walking toward the camera mid-stride, waist-up, looking to the side as if hearing the crowd",
  "a profile looking left with the head slightly bowed, hair and jaw catching a hard rim light",
];
export const surprisePose = (seed: number) => SURPRISE_POSES[Math.abs(seed) % SURPRISE_POSES.length];

/** Detailed background scenes. Users can pick one; otherwise a random one is used. */
export const BG_SCENES = [
  { id: "stadium", icon: "🏟️", en: "Night stadium", es: "Estadio de noche", prompt: "a packed football stadium at night seen from pitch level: blazing floodlights with lens flares, thousands of fans as a bokeh wall, coloured flares and smoke drifting across the stands, wet grass reflecting the lights" },
  { id: "tunnel", icon: "🚪", en: "Players' tunnel", es: "Túnel de jugadores", prompt: "the players' tunnel of a modern stadium: polished concrete walls, LED strip lights in the main colour, bright pitch light blasting in from the end of the tunnel, haze and light rays" },
  { id: "lava", icon: "🌋", en: "Lava & fire", es: "Lava y fuego", prompt: "a volcanic landscape of cracked black obsidian rock with glowing lava veins, rising embers, ash in the air and heat haze, molten light underneath" },
  { id: "storm", icon: "⚡", en: "Thunderstorm", es: "Tormenta eléctrica", prompt: "a violent thunderstorm sky with huge branching lightning bolts, dark rolling clouds, rain streaks lit by flashes, electric arcs crackling around the subject" },
  { id: "city", icon: "🌃", en: "Neon city", es: "Ciudad neón", prompt: "a rainy cyberpunk city street at night: towering buildings, glowing neon signs (no readable words), wet asphalt with mirror reflections, steam rising from the ground" },
  { id: "space", icon: "🌌", en: "Galaxy", es: "Galaxia", prompt: "deep space: a vivid nebula in the main colours, a glowing planet edge, star fields and cosmic dust with light streaks, epic sense of scale" },
  { id: "ice", icon: "❄️", en: "Ice & frost", es: "Hielo y escarcha", prompt: "a frozen arena of giant ice crystals and shattered ice shards, frost particles and cold mist, icy blue light glowing through the ice" },
  { id: "gold", icon: "👑", en: "Luxury gold", es: "Lujo dorado", prompt: "a luxurious black-marble hall with veins of gold, golden light beams, floating gold dust and confetti, polished reflective floor" },
  { id: "street", icon: "🎨", en: "Street graffiti", es: "Grafiti urbano", prompt: "an urban street-football cage at night: chain-link fence, concrete wall covered in colourful spray-paint graffiti (no readable words), street lamps, paint drips and smoke" },
  { id: "glass", icon: "💥", en: "Shattered glass", es: "Vidrio roto", prompt: "an explosion of shattered glass shards frozen mid-air around the subject, each shard catching coloured light, dark backdrop with light streaks" },
  { id: "ultras", icon: "🔥", en: "Ultras & flares", es: "Ultras y bengalas", prompt: "an ultras stand in full fury: red and coloured pyro flares, thick smoke, huge waving flags and tifo banners (no readable words), silhouettes of fans" },
  { id: "esports", icon: "🎮", en: "Esports arena", es: "Arena esports", prompt: "a huge esports arena stage: giant LED screens, laser beams cutting through haze, holographic HUD elements, glossy stage floor reflecting the lights" },
  { id: "liquid", icon: "🌊", en: "Liquid chrome", es: "Cromo líquido", prompt: "abstract waves of flowing liquid chrome and metallic paint in the main colours, splashes frozen in motion, studio reflections" },
  { id: "temple", icon: "🏛️", en: "Ancient arena", es: "Arena antigua", prompt: "an ancient roman colosseum at golden hour: stone columns, laurel and gold details, dust in the sunbeams, dramatic epic atmosphere" },
];
export const bgScenePrompt = (id: string) => BG_SCENES.find((b) => b.id === id)?.prompt ?? "";

// ─── Unique look per poster ────────────────────────────────
// Every Pro generation draws a random combination, so no two posters look alike.

export const PALETTES = [
  ["electric cyan and hot magenta", "#00e5ff", "#ff2bd6", "#05010d"],
  ["blood red and polished gold", "#d10f1f", "#ffcc4d", "#0d0203"],
  ["emerald green and silver chrome", "#0fbf6b", "#dfe7ef", "#02100a"],
  ["royal purple and gold", "#7b2cff", "#ffd35a", "#0a0216"],
  ["ice blue and pure white", "#3fa9ff", "#ffffff", "#020a18"],
  ["sunset orange and deep teal", "#ff7a1a", "#13c2c2", "#07120f"],
  ["neon lime and black", "#b6ff1a", "#f4f4f4", "#030303"],
  ["crimson and black chrome", "#c4102b", "#b9c2cc", "#050506"],
  ["rose gold and black", "#e8a38f", "#fff1e8", "#0b0606"],
  ["toxic green and violet", "#39ff88", "#9b5cff", "#06020c"],
  ["midnight navy and gold", "#1a2f7a", "#e8b84a", "#02040c"],
  ["fire orange and charcoal", "#ff5a1f", "#ffd09e", "#111111"],
  ["arctic white and steel blue", "#e9f1f8", "#5b8db8", "#0b1118"],
  ["hot pink and silver", "#ff3d8b", "#e6e9ef", "#100208"],
  ["deep teal and copper", "#0f8f8a", "#d9824b", "#03100f"],
  ["lava red and obsidian purple", "#ff3b1f", "#5a1f8a", "#08030a"],
] as const;

export const MOTIFS = [
  "exploding shattered glass shards frozen mid-air",
  "a violent lightning storm with electric arcs",
  "flowing liquid chrome and metallic waves",
  "fire, embers and heat distortion",
  "giant ice crystals and frost",
  "thick coloured smoke lit by neon tubes",
  "a cosmic galaxy with nebula clouds and stars",
  "gothic cathedral ornaments and chrome spikes",
  "a graffiti street wall with spray paint drips",
  "black marble veined with gold",
  "a digital glitch / holographic HUD interface",
  "stadium flares, tifo banners and ultras smoke",
  "ancient roman stone columns and laurel",
  "a rainy cyberpunk city skyline with neon signs",
  "huge ink splashes and paint strokes",
  "torn paper and grunge collage layers",
];

export const COMPOSITIONS = [
  "symmetrical, centred hero composition",
  "dynamic diagonal split with angled panels",
  "subject off-centre with bold negative space for type",
  "low-angle heroic perspective looking up",
  "subject framed inside a bold geometric frame or card",
  "split-screen two-tone layout",
];

/** Same style, different arrangement — picked per poster so no two look identical. */
export const ARRANGEMENTS = [
  "the main subject centred and large, the title above it, the details in a clean block at the bottom",
  "the main subject slightly to the LEFT, the title stacked on the RIGHT side, details bottom-right",
  "the main subject slightly to the RIGHT, the title stacked on the LEFT side, details bottom-left",
  "the main subject big in the lower half rising up, the title huge across the top",
  "the title enormous across the middle, the main subject in front overlapping the letters",
  "a diagonal layout: the main subject lower-left, the title upper-right, energy running along the diagonal",
  "a low camera angle: the main subject towering over the viewer, the title across the bottom",
  "a tight, close framing: the main subject filling most of the frame, the text in a clean band along the bottom",
  "the title split in two lines — one above and one below the main subject",
  "the main subject slightly smaller and centred with lots of depth behind, the title big and bold above",
];

export const LIGHTING = [
  "strong backlight with bright rim light",
  "single hard top spotlight in darkness",
  "neon side lighting in two colours",
  "warm golden-hour glow",
  "stroboscopic camera flashes and lens flares",
];

export const TEXTURES = ["fine film grain", "halftone print dots", "scratched brushed metal", "paper and dust", "glitter and sparkle dust"];

export interface Variation {
  palette: { name: string; primary: string; accent: string; dark: string } | null;
  motif: string;
  composition: string;
  arrangement: string;
  lighting: string;
  texture: string;
  seed: number;
}

const pick = <T,>(arr: readonly T[]) => arr[Math.floor(Math.random() * arr.length)];

/** colorMode: "surprise" (random palette), "template" (keep style colours), "custom" (user colours). */
export function createVariation(colorMode: string): Variation {
  const p = pick(PALETTES);
  return {
    palette: colorMode === "surprise" || !colorMode ? { name: p[0], primary: p[1], accent: p[2], dark: p[3] } : null,
    motif: Math.random() < 0.6 ? pick(BG_SCENES).prompt : pick(MOTIFS),
    composition: pick(COMPOSITIONS),
    arrangement: pick(ARRANGEMENTS),
    lighting: pick(LIGHTING),
    texture: pick(TEXTURES),
    seed: Math.floor(Math.random() * 1_000_000),
  };
}
