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
    layout: "RESULT",
    icon: "⚽",
    en: { name: "Result", desc: "Full-time score with both crests and the goal scorers." },
    es: { name: "Resultado", desc: "Marcador final con ambos escudos y los goleadores." },
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
}

export const FONT_STYLES: FontStyle[] = [
  { id: "condensed", label: "Condensed Sport", prompt: "tall ultra-condensed bold sports sans-serif, white with metallic gradient", preview: "anton", previewClass: "uppercase" },
  { id: "futuristic", label: "Futuristic", prompt: "futuristic angular tech display font with sharp cuts and glow", preview: "bebas", previewClass: "uppercase tracking-[0.2em]" },
  { id: "chrome", label: "Chrome 3D", prompt: "thick 3D extruded chrome lettering with reflections and bevels", preview: "anton", previewClass: "uppercase italic" },
  { id: "gold", label: "Gold Metallic Luxury", prompt: "luxurious polished gold metallic serif lettering with sparkles", preview: "bebas", previewClass: "uppercase tracking-widest" },
  { id: "gothic", label: "Gothic Blackletter", prompt: "ornate gothic blackletter (old english) lettering", preview: "gothic", previewClass: "" },
  { id: "grunge", label: "Grunge", prompt: "distressed grunge stencil lettering with scratches and texture", preview: "anton", previewClass: "uppercase opacity-90" },
  { id: "brush", label: "Brush Script", prompt: "energetic hand-painted brush script lettering", preview: "brush", previewClass: "" },
  { id: "neon", label: "Neon", prompt: "glowing neon tube lettering with strong colour glow", preview: "bebas", previewClass: "uppercase tracking-[0.15em]" },
  { id: "clean", label: "Clean Modern", prompt: "clean modern geometric bold sans-serif", preview: "sans", previewClass: "font-extrabold uppercase" },
];

export const TROPHY_STYLES = [
  { id: "globe", label: "Gold globe cup", prompt: "a tall polished gold trophy with a globe on top held by spiralling figures, on a dark base" },
  { id: "bigears", label: "Silver big-ears cup", prompt: "a large polished silver cup with two big curved handles on a round base" },
  { id: "shield", label: "Gold league shield", prompt: "a gold and black league trophy shield with laurel engraving" },
  { id: "crystal", label: "Crystal star", prompt: "a faceted crystal trophy shaped like a star, refracting light" },
  { id: "boot", label: "Golden boot", prompt: "a shiny golden football boot trophy on a black marble base" },
  { id: "chrome", label: "Chrome esports cup", prompt: "a futuristic chrome esports trophy with glowing accents" },
];

export const LANGUAGES = ["English", "Español", "Português", "Français", "Italiano"];

export const fontPrompt = (id: string) => FONT_STYLES.find((f) => f.id === id)?.prompt ?? "";
export const trophyPrompt = (id: string) => TROPHY_STYLES.find((t) => t.id === id)?.prompt ?? "";

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
    motif: pick(MOTIFS),
    composition: pick(COMPOSITIONS),
    lighting: pick(LIGHTING),
    texture: pick(TEXTURES),
    seed: Math.floor(Math.random() * 1_000_000),
  };
}
