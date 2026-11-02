// Shared (client + server) definitions for banner templates and inputs.

export type LayoutKind = "PLAYER" | "CHAMPIONS" | "EVENT" | "MATCHDAY" | "LINEUP" | "RESULT";

export type FontKey = "anton" | "bebas" | "gothic" | "brush" | "sans";
export type Particles = "sparks" | "embers" | "snow" | "none";

export interface TemplateStyle {
  primary: string; // main brand color of the template
  accent: string; // highlight / glow color
  dark: string; // deep shadow color
  nameFont: FontKey;
  scriptFont: FontKey;
  /** Top → bottom gradient used for the big name / title */
  nameGradient: string[];
  /** Gradient used when no AI background exists (also used for previews) */
  fallback: string[];
  particles: Particles;
  ghost: boolean; // big faded portrait behind the player
  giantText: boolean; // huge outlined team name in the background
  streaks: boolean; // diagonal light streaks
}

export interface BannerInputs {
  name: string; // player / gamertag
  team: string;
  position: string; // "CAM | OM", "DFC", "CB"
  number: string;
  tagline: string; // small text above the name ("WELCOME", "MVP")
  subtitle: string; // script text under the name
  footer: string; // spaced letters at the bottom ("LIGA X EDITION")
  headline: string; // EVENT/CHAMPIONS big word ("CHAMPIONS", "$100")
  eventName: string; // "LPL WINNERS"
  roster: string[]; // CHAMPIONS
  prize: string; // "$200 PRIZE"
  date: string; // EVENT
  details: string; // EVENT ("8 PM · 9 PM · 10 PM")
  extraPrompt: string; // added to the AI background prompt
  // Match day / lineup / result
  homeTeam: string;
  awayTeam: string;
  homeScore: string;
  awayScore: string;
  competition: string;
  venue: string;
  time: string;
  formation: string; // "4-3-3"
  players: string[]; // lineup: "10 Name ST"
  scorers: string[]; // result
  trophy: string; // champions trophy style
  colorMode: string; // "surprise" | "template" | "custom"
  color1: string;
  color2: string;
  aiCopy: string; // "on" lets the AI add a couple of hype words
  aiLogo: string; // "on" = AI redraws the crest in 3D (may change details); default pastes the real logo
  bgPose: string;
  bgScene: string; // background scene id, "" = surprise // player card: pose of the second, AI-made figure in the background
  // Typography (Pro AI)
  language: string; // language for generic words on the poster
  fontPrimary: string; // titles
  fontSecondary: string; // names, numbers
  // Extra reference images (our own storage URLs)
  homeLogoUrl: string;
  awayLogoUrl: string;
  champLogoUrl: string;
  trophyUrl: string;
}

export const EMPTY_INPUTS: BannerInputs = {
  name: "",
  team: "",
  position: "",
  number: "",
  tagline: "",
  subtitle: "",
  footer: "",
  headline: "",
  eventName: "",
  roster: [],
  prize: "",
  date: "",
  details: "",
  extraPrompt: "",
  homeTeam: "",
  awayTeam: "",
  homeScore: "",
  awayScore: "",
  competition: "",
  venue: "",
  time: "",
  formation: "",
  players: [],
  scorers: [],
  trophy: "",
  colorMode: "",
  color1: "",
  color2: "",
  aiCopy: "off",
  aiLogo: "",
  bgPose: "",
  bgScene: "",
  language: "English",
  fontPrimary: "",
  fontSecondary: "",
  homeLogoUrl: "",
  awayLogoUrl: "",
  champLogoUrl: "",
  trophyUrl: "",
};

/** Editor adjustments the user can tweak for free after generating. */
export interface DesignState {
  playerX: number; // -0.5 … 0.5 (fraction of width)
  playerY: number; // -0.5 … 0.5
  playerScale: number; // 0.5 … 1.8
  ghost: boolean;
  ghostOpacity: number; // 0 … 1
  nameScale: number; // 0.6 … 1.4
  overlay: number; // 0 … 1 color grade strength
  particles: boolean;
  logoScale: number; // 0.5 … 1.6
  seed: number;
}

export const DEFAULT_DESIGN: DesignState = {
  playerX: 0,
  playerY: 0,
  playerScale: 1,
  ghost: true,
  ghostOpacity: 0.45,
  nameScale: 1,
  overlay: 0.55,
  particles: true,
  logoScale: 1,
  seed: 7,
};

/** Which form fields each layout shows. */
export const LAYOUT_FIELDS: Record<LayoutKind, (keyof BannerInputs)[]> = {
  PLAYER: ["name", "team", "position", "number", "tagline", "subtitle", "footer"],
  CHAMPIONS: ["headline", "team", "eventName", "roster", "prize", "footer"],
  EVENT: ["headline", "name", "subtitle", "date", "details", "prize", "footer"],
  MATCHDAY: ["homeTeam", "awayTeam", "competition", "date", "time", "venue", "footer"],
  LINEUP: ["team", "formation", "players", "competition", "date", "footer"],
  RESULT: ["homeTeam", "awayTeam", "homeScore", "awayScore", "scorers", "competition", "footer"],
};

export const CANVAS_W = 1080;
export const CANVAS_H = 1350;

// ─── Default templates (seeded into the DB; admins can edit them later) ───

export interface TemplateSeed {
  slug: string;
  name: string;
  nameEs: string;
  layout: LayoutKind;
  prompt: string;
  style: TemplateStyle;
  sort: number;
  /** Sample image shown in the style picker */
  thumbUrl?: string;
}

export const DEFAULT_TEMPLATES: TemplateSeed[] = [
  {
    slug: "glacier",
    name: "Glacier",
    nameEs: "Glaciar",
    layout: "PLAYER",
    sort: 1,
    prompt:
      "shattered blue ice crystals exploding outward, cold electric blue energy, frozen stadium at night, sharp crystal shards flying, deep navy and cyan glow",
    style: {
      primary: "#1d5bff",
      accent: "#7cd6ff",
      dark: "#020718",
      nameFont: "anton",
      scriptFont: "sans",
      nameGradient: ["#ffffff", "#cfe6ff", "#6fa9ff"],
      fallback: ["#020718", "#0b2a8a", "#1d5bff"],
      particles: "snow",
      ghost: true,
      giantText: true,
      streaks: true,
    },
  },
  {
    slug: "neon-gothic",
    name: "Neon Gothic",
    nameEs: "Gótico Neón",
    layout: "PLAYER",
    sort: 2,
    prompt:
      "dark gothic cathedral ornaments in chrome, hot pink and magenta neon lightning, thorny metal spikes, stadium floodlights, cyber gothic aesthetic",
    style: {
      primary: "#ff2d9b",
      accent: "#ff7ad1",
      dark: "#12000c",
      nameFont: "anton",
      scriptFont: "brush",
      nameGradient: ["#ffffff", "#ffe0f3", "#ff9bd6"],
      fallback: ["#12000c", "#5a0638", "#ff2d9b"],
      particles: "sparks",
      ghost: true,
      giantText: false,
      streaks: true,
    },
  },
  {
    slug: "player-shatter",
    name: "Shattered Signing",
    nameEs: "Fichaje Estallido",
    layout: "PLAYER",
    sort: 1,
    prompt:
      "monochrome editorial esports signing graphic: giant close-up of the player behind, full-body shot in front, giant team name letters, shattered glass shards, smoky clouds, brush-script name",
    style: {
      primary: "#e0142b",
      accent: "#ffffff",
      dark: "#0c0204",
      nameFont: "anton",
      scriptFont: "brush",
      nameGradient: ["#ffffff", "#f1f1f1", "#cfcfcf"],
      fallback: ["#0c0204", "#4a0710", "#e0142b"],
      particles: "sparks",
      ghost: true,
      giantText: true,
      streaks: true,
    },
  },
  {
    slug: "inferno",
    name: "Inferno",
    nameEs: "Infierno",
    layout: "PLAYER",
    sort: 3,
    prompt:
      "red inferno, glowing embers and red lightning, dark metal angular panels, stadium lights through red smoke, aggressive esports atmosphere",
    style: {
      primary: "#e3102b",
      accent: "#ff6b3d",
      dark: "#140103",
      nameFont: "anton",
      scriptFont: "brush",
      nameGradient: ["#ffffff", "#ffe2d6", "#ffb199"],
      fallback: ["#140103", "#6b0612", "#e3102b"],
      particles: "embers",
      ghost: true,
      giantText: true,
      streaks: true,
    },
  },
  {
    slug: "royal-violet",
    name: "Royal Violet",
    nameEs: "Violeta Real",
    layout: "PLAYER",
    sort: 4,
    prompt:
      "epic royal throne-room arena in deep purple and gold: towering baroque gold ornaments and pillars, a violent violet lightning storm cracking across a dark sky, golden light beams and lens flares, floating gold particles and shattered amethyst crystal shards flying toward the camera, swirling purple smoke, stadium floodlights far behind, luxurious, powerful, dramatic",
    style: {
      primary: "#8b3dff",
      accent: "#d9a6ff",
      dark: "#0c0218",
      nameFont: "bebas",
      scriptFont: "gothic",
      nameGradient: ["#ffffff", "#f0e4ff", "#c79bff"],
      fallback: ["#0c0218", "#3a0f73", "#8b3dff"],
      particles: "sparks",
      ghost: true,
      giantText: true,
      streaks: false,
    },
  },
  {
    slug: "noir-gold",
    name: "Noir Gold",
    nameEs: "Negro y Oro",
    layout: "PLAYER",
    sort: 5,
    prompt:
      "black and gold luxury texture, golden glitter dust and smoke, dark stadium stands in black and white, gold light leaks, premium welcome poster",
    style: {
      primary: "#d4a64a",
      accent: "#ffd77a",
      dark: "#050403",
      nameFont: "bebas",
      scriptFont: "gothic",
      nameGradient: ["#fff6dc", "#f3d28a", "#b9862d"],
      fallback: ["#050403", "#2a2112", "#7a5a22"],
      particles: "sparks",
      ghost: true,
      giantText: false,
      streaks: false,
    },
  },
  {
    slug: "golden-champions",
    name: "Golden Champions",
    nameEs: "Campeones Dorados",
    layout: "CHAMPIONS",
    sort: 6,
    prompt:
      "golden marble arena, warm golden light rays, gold confetti and sparks, epic trophy ceremony atmosphere",
    style: {
      primary: "#e09a1f",
      accent: "#ffd36b",
      dark: "#1a0f02",
      nameFont: "anton",
      scriptFont: "sans",
      nameGradient: ["#fff3cf", "#f6c35a", "#c7801a"],
      fallback: ["#1a0f02", "#6b4208", "#e09a1f"],
      particles: "embers",
      ghost: false,
      giantText: false,
      streaks: true,
    },
  },
  {
    slug: "violet-champions",
    name: "Violet Champions",
    nameEs: "Campeones Violeta",
    layout: "CHAMPIONS",
    sort: 7,
    prompt:
      "purple stadium at night with violet lightning, silver metallic shield frame, glowing purple floodlights, wet reflective floor, celebration",
    style: {
      primary: "#7a2cff",
      accent: "#c8a2ff",
      dark: "#0a0216",
      nameFont: "anton",
      scriptFont: "sans",
      nameGradient: ["#ffffff", "#e4d6ff", "#a98be0"],
      fallback: ["#0a0216", "#2c0b63", "#7a2cff"],
      particles: "sparks",
      ghost: false,
      giantText: false,
      streaks: true,
    },
  },
  {
    slug: "tournament-night",
    name: "Tournament Night",
    nameEs: "Noche de Torneo",
    layout: "EVENT",
    sort: 8,
    prompt:
      "red stadium at night with steel truss roof, red flares and smoke, fans with flags in the stands, bokeh lights, intense final match atmosphere",
    style: {
      primary: "#d4161f",
      accent: "#ffcf6b",
      dark: "#120202",
      nameFont: "anton",
      scriptFont: "gothic",
      nameGradient: ["#ffffff", "#fbe9c8", "#e8b45a"],
      fallback: ["#120202", "#5c0a0e", "#d4161f"],
      particles: "embers",
      ghost: false,
      giantText: true,
      streaks: true,
    },
  },
  {
    slug: "lightning-cup",
    name: "Lightning Cup",
    nameEs: "Copa Relámpago",
    layout: "EVENT",
    sort: 20,
    prompt:
      "dark stormy stadium at night, violent purple lightning bolts cracking the sky, shattered glass and crystal shards flying, gold sparks, wet reflective ground, epic tournament atmosphere",
    style: {
      primary: "#7b2cff",
      accent: "#f5c542",
      dark: "#07030f",
      nameFont: "anton",
      scriptFont: "brush",
      nameGradient: ["#ffffff", "#e9e3ff", "#b9a6ff"],
      fallback: ["#07030f", "#2a0f5c", "#7b2cff"],
      particles: "sparks",
      ghost: false,
      giantText: true,
      streaks: true,
    },
  },
  {
    slug: "neon-arena",
    name: "Neon Arena",
    nameEs: "Arena Neón",
    layout: "EVENT",
    sort: 21,
    prompt:
      "futuristic esports arena with giant LED screens, cyan and magenta neon light beams, haze, glowing stage floor, crowd silhouettes with phone lights",
    style: {
      primary: "#16e0ff",
      accent: "#ff2bd6",
      dark: "#020611",
      nameFont: "anton",
      scriptFont: "brush",
      nameGradient: ["#ffffff", "#d9fbff", "#7ff0ff"],
      fallback: ["#020611", "#0a2a4a", "#16e0ff"],
      particles: "sparks",
      ghost: false,
      giantText: true,
      streaks: true,
    },
  },
  {
    slug: "gold-showdown",
    name: "Gold Showdown",
    nameEs: "Duelo de Oro",
    layout: "EVENT",
    sort: 22,
    prompt:
      "luxury black and gold arena, golden spotlights from above, falling gold confetti and coins, polished black marble floor with reflections, VIP championship atmosphere",
    style: {
      primary: "#d4a64a",
      accent: "#fff1b8",
      dark: "#050403",
      nameFont: "anton",
      scriptFont: "brush",
      nameGradient: ["#fff8e1", "#ffe08a", "#d4a64a"],
      fallback: ["#050403", "#3a2a0c", "#d4a64a"],
      particles: "sparks",
      ghost: false,
      giantText: true,
      streaks: true,
    },
  },
  {
    slug: "street-cup",
    name: "Street Cup",
    nameEs: "Copa Callejera",
    layout: "EVENT",
    sort: 23,
    prompt:
      "urban street football cage at night under sodium street lights, chain-link fence, graffiti walls, smoke and sparks, gritty concrete, raw underground tournament energy",
    style: {
      primary: "#ff5a1f",
      accent: "#ffd23f",
      dark: "#0b0705",
      nameFont: "anton",
      scriptFont: "brush",
      nameGradient: ["#ffffff", "#ffe7c2", "#ffb36b"],
      fallback: ["#0b0705", "#3d1a0a", "#ff5a1f"],
      particles: "embers",
      ghost: false,
      giantText: true,
      streaks: true,
    },
  },
  {
    slug: "lineup-tunnel",
    name: "Tunnel XI",
    nameEs: "Túnel XI",
    layout: "LINEUP",
    sort: 13,
    prompt:
      "view from a dark concrete players tunnel out to a blazing floodlit pitch, team-colour strip lights, coloured smoke, light rays",
    style: {
      primary: "#e3102b",
      accent: "#ffffff",
      dark: "#05060a",
      nameFont: "anton",
      scriptFont: "brush",
      nameGradient: ["#ffffff", "#e8eef5", "#b9c4d0"],
      fallback: ["#05060a", "#1a1f2b", "#e3102b"],
      particles: "sparks",
      ghost: true,
      giantText: true,
      streaks: true,
    },
  },
  {
    slug: "lineup-ultras",
    name: "Ultras XI",
    nameEs: "Ultras XI",
    layout: "LINEUP",
    sort: 14,
    prompt:
      "stadium end wrapped in team-colour smoke bombs and burning flares, giant waving flags, gritty match-day atmosphere",
    style: {
      primary: "#e3102b",
      accent: "#ffd23f",
      dark: "#0a0505",
      nameFont: "anton",
      scriptFont: "brush",
      nameGradient: ["#ffffff", "#e8eef5", "#b9c4d0"],
      fallback: ["#0a0505", "#1a1f2b", "#e3102b"],
      particles: "embers",
      ghost: true,
      giantText: true,
      streaks: true,
    },
  },
  {
    slug: "lineup-hologram",
    name: "Hologram XI",
    nameEs: "Holograma XI",
    layout: "LINEUP",
    sort: 15,
    prompt:
      "dark night stadium with a giant translucent holographic tactics board projected above the pitch, scan lines, data rings, volumetric haze",
    style: {
      primary: "#16e0ff",
      accent: "#ffffff",
      dark: "#02060c",
      nameFont: "anton",
      scriptFont: "brush",
      nameGradient: ["#ffffff", "#e8eef5", "#b9c4d0"],
      fallback: ["#02060c", "#1a1f2b", "#16e0ff"],
      particles: "sparks",
      ghost: true,
      giantText: true,
      streaks: true,
    },
  },
  {
    slug: "lineup-cinematic",
    name: "Cinematic XI",
    nameEs: "Once Cinemático",
    layout: "LINEUP",
    sort: 10,
    prompt:
      "cinematic night stadium seen from pitch level, volumetric floodlight beams through light haze, wet grass reflections, team-colour grade, the pitch in dramatic perspective with the starting eleven",
    style: {
      primary: "#e3102b",
      accent: "#ffffff",
      dark: "#05070a",
      nameFont: "anton",
      scriptFont: "brush",
      nameGradient: ["#ffffff", "#e8eef5", "#b9c4d0"],
      fallback: ["#05070a", "#1a1f2b", "#e3102b"],
      particles: "sparks",
      ghost: true,
      giantText: true,
      streaks: true,
    },
  },
  {
    slug: "champ-red-arena",
    name: "Red Arena",
    nameEs: "Arena Roja",
    layout: "CHAMPIONS",
    sort: 1,
    thumbUrl: "/samples/champ-red-arena.webp",
    prompt:
      "red and black night stadium, floodlights, silver trophy behind the crest, chrome red title",
    style: {
      primary: "#e01b2b",
      accent: "#ffffff",
      dark: "#070203",
      nameFont: "anton",
      scriptFont: "brush",
      nameGradient: ["#ffffff", "#ffffff", "#e01b2b"],
      fallback: ["#070203", "#1d0b0d", "#e01b2b"],
      particles: "sparks",
      ghost: false,
      giantText: true,
      streaks: true,
    },
  },
  {
    slug: "champ-royal-gold",
    name: "Royal Gold",
    nameEs: "Oro Real",
    layout: "CHAMPIONS",
    sort: 2,
    thumbUrl: "/samples/champ-royal-gold.webp",
    prompt:
      "black and gold royal: gold crown over the crest, gold laurel wreath, gold sparkles, 3D gold title",
    style: {
      primary: "#d9a83a",
      accent: "#fff1b8",
      dark: "#050403",
      nameFont: "anton",
      scriptFont: "brush",
      nameGradient: ["#ffffff", "#fff1b8", "#d9a83a"],
      fallback: ["#050403", "#1d0b0d", "#d9a83a"],
      particles: "sparks",
      ghost: false,
      giantText: true,
      streaks: true,
    },
  },
  {
    slug: "champ-ultras-brush",
    name: "Ultras Brush",
    nameEs: "Ultras Pincel",
    layout: "CHAMPIONS",
    sort: 3,
    thumbUrl: "/samples/champ-ultras-brush.webp",
    prompt:
      "black and white grunge, silver cup above, red brush strokes, ultras crowd silhouettes, brush script title",
    style: {
      primary: "#e01b2b",
      accent: "#ffffff",
      dark: "#0a0a0a",
      nameFont: "anton",
      scriptFont: "brush",
      nameGradient: ["#ffffff", "#ffffff", "#e01b2b"],
      fallback: ["#0a0a0a", "#1d0b0d", "#e01b2b"],
      particles: "sparks",
      ghost: false,
      giantText: true,
      streaks: true,
    },
  },
  {
    slug: "champ-stadium-gold",
    name: "Stadium Gold",
    nameEs: "Estadio Dorado",
    layout: "CHAMPIONS",
    sort: 4,
    thumbUrl: "/samples/champ-stadium-gold.webp",
    prompt:
      "night stadium pitch, gold confetti, tall silver trophy on the right, gold 3D title, red ribbon",
    style: {
      primary: "#e3b04a",
      accent: "#e01b2b",
      dark: "#060605",
      nameFont: "anton",
      scriptFont: "brush",
      nameGradient: ["#ffffff", "#e01b2b", "#e3b04a"],
      fallback: ["#060605", "#1d0b0d", "#e3b04a"],
      particles: "sparks",
      ghost: false,
      giantText: true,
      streaks: true,
    },
  },
  {
    slug: "champ-silk-flag",
    name: "Silk Flag",
    nameEs: "Bandera de Seda",
    layout: "CHAMPIONS",
    sort: 5,
    thumbUrl: "/samples/champ-silk-flag.webp",
    prompt:
      "waving red and black silk flag background, silver star above the crest, gold 3D title",
    style: {
      primary: "#c9192a",
      accent: "#e3b04a",
      dark: "#070203",
      nameFont: "anton",
      scriptFont: "brush",
      nameGradient: ["#ffffff", "#e3b04a", "#c9192a"],
      fallback: ["#070203", "#1d0b0d", "#c9192a"],
      particles: "sparks",
      ghost: false,
      giantText: true,
      streaks: true,
    },
  },
  {
    slug: "champ-net-ball",
    name: "Net & Ball",
    nameEs: "Red y Balón",
    layout: "CHAMPIONS",
    sort: 6,
    thumbUrl: "/samples/champ-net-ball.webp",
    prompt:
      "black and white goal net and old football, red smoke, brush script title",
    style: {
      primary: "#e01b2b",
      accent: "#ffffff",
      dark: "#080808",
      nameFont: "anton",
      scriptFont: "brush",
      nameGradient: ["#ffffff", "#ffffff", "#e01b2b"],
      fallback: ["#080808", "#1d0b0d", "#e01b2b"],
      particles: "sparks",
      ghost: false,
      giantText: true,
      streaks: true,
    },
  },
  {
    slug: "champ-neon-frame",
    name: "Neon Frame",
    nameEs: "Marco Neón",
    layout: "CHAMPIONS",
    sort: 7,
    thumbUrl: "/samples/champ-neon-frame.webp",
    prompt:
      "dark red neon geometric frame, trophy silhouette behind the crest, chrome title",
    style: {
      primary: "#ff1f3a",
      accent: "#ffffff",
      dark: "#050203",
      nameFont: "anton",
      scriptFont: "brush",
      nameGradient: ["#ffffff", "#ffffff", "#ff1f3a"],
      fallback: ["#050203", "#1d0b0d", "#ff1f3a"],
      particles: "sparks",
      ghost: false,
      giantText: true,
      streaks: true,
    },
  },
  {
    slug: "champ-marble-script",
    name: "Marble Script",
    nameEs: "Mármol y Firma",
    layout: "CHAMPIONS",
    sort: 8,
    thumbUrl: "/samples/champ-marble-script.webp",
    prompt:
      "white cracked marble with red paint strokes, gold crown over the crest, gold script title",
    style: {
      primary: "#c9192a",
      accent: "#e3b04a",
      dark: "#f2f0ee",
      nameFont: "anton",
      scriptFont: "brush",
      nameGradient: ["#ffffff", "#e3b04a", "#c9192a"],
      fallback: ["#f2f0ee", "#1d0b0d", "#c9192a"],
      particles: "sparks",
      ghost: false,
      giantText: true,
      streaks: true,
    },
  },
  {
    slug: "champ-lion-crest",
    name: "Lion Crest",
    nameEs: "Escudo de Leones",
    layout: "CHAMPIONS",
    sort: 9,
    thumbUrl: "/samples/champ-lion-crest.webp",
    prompt:
      "black cracked stone, gold shield frame with crown and two golden lions, gold title",
    style: {
      primary: "#d9a83a",
      accent: "#e01b2b",
      dark: "#060505",
      nameFont: "anton",
      scriptFont: "brush",
      nameGradient: ["#ffffff", "#e01b2b", "#d9a83a"],
      fallback: ["#060505", "#1d0b0d", "#d9a83a"],
      particles: "sparks",
      ghost: false,
      giantText: true,
      streaks: true,
    },
  },
  {
    slug: "champ-red-smoke",
    name: "Red Smoke",
    nameEs: "Humo Rojo",
    layout: "CHAMPIONS",
    sort: 10,
    thumbUrl: "/samples/champ-red-smoke.webp",
    prompt:
      "swirling red smoke frame, silver trophy, laurel branches, chrome title",
    style: {
      primary: "#e01b2b",
      accent: "#ffffff",
      dark: "#070203",
      nameFont: "anton",
      scriptFont: "brush",
      nameGradient: ["#ffffff", "#ffffff", "#e01b2b"],
      fallback: ["#070203", "#1d0b0d", "#e01b2b"],
      particles: "sparks",
      ghost: false,
      giantText: true,
      streaks: true,
    },
  },
  {
    slug: "champions-freestyle",
    name: "AI Director",
    nameEs: "Director IA",
    layout: "CHAMPIONS",
    sort: 0,
    prompt:
      "the AI designs the best possible championship poster on its own — its own concept, scene and typography",
    style: {
      primary: "#ff2e88",
      accent: "#2fd8e8",
      dark: "#070507",
      nameFont: "anton",
      scriptFont: "brush",
      nameGradient: ["#ffffff", "#ffd6e8", "#ff2e88"],
      fallback: ["#070507", "#2a0c1c", "#ff2e88"],
      particles: "sparks",
      ghost: false,
      giantText: true,
      streaks: true,
    },
  },
  {
    slug: "champions-victory",
    name: "Victory Night",
    nameEs: "Noche de Gloria",
    layout: "CHAMPIONS",
    sort: 1,
    prompt:
      "real sports photograph of a trophy on the centre circle of a stadium at night under one spotlight, ticker-tape storm, cinematic",
    style: {
      primary: "#f2f2f2",
      accent: "#d4a64a",
      dark: "#050505",
      nameFont: "bebas",
      scriptFont: "sans",
      nameGradient: ["#ffffff", "#e9e9e9", "#bdbdbd"],
      fallback: ["#050505", "#1c1c1c", "#d4a64a"],
      particles: "sparks",
      ghost: false,
      giantText: true,
      streaks: true,
    },
  },
  {
    slug: "champions-blackgold",
    name: "Black & Gold",
    nameEs: "Negro y Oro",
    layout: "CHAMPIONS",
    sort: 2,
    prompt:
      "luxury black studio campaign photo of a trophy with hard product lighting, gold foil typography",
    style: {
      primary: "#d4a64a",
      accent: "#fff1b8",
      dark: "#050403",
      nameFont: "gothic",
      scriptFont: "sans",
      nameGradient: ["#fff3cf", "#e7c46a", "#a87a22"],
      fallback: ["#050403", "#1d160a", "#d4a64a"],
      particles: "embers",
      ghost: false,
      giantText: true,
      streaks: true,
    },
  },
  {
    slug: "champions-cover",
    name: "Magazine Cover",
    nameEs: "Portada de Revista",
    layout: "CHAMPIONS",
    sort: 3,
    prompt:
      "editorial sports magazine cover photograph of a trophy, bold headline typography, clean layout",
    style: {
      primary: "#ffffff",
      accent: "#ff2e2e",
      dark: "#0a0a0a",
      nameFont: "anton",
      scriptFont: "sans",
      nameGradient: ["#ffffff", "#f2f2f2", "#d9d9d9"],
      fallback: ["#0a0a0a", "#2a2a2a", "#ff2e2e"],
      particles: "none",
      ghost: false,
      giantText: true,
      streaks: true,
    },
  },
  {
    slug: "champions-kings",
    name: "Kings of the League",
    nameEs: "Reyes de la Liga",
    layout: "CHAMPIONS",
    sort: 4,
    prompt:
      "dark royal scene: trophy on a black stone throne, crown of fire, smoke and embers, gothic metal typography",
    style: {
      primary: "#c9a14a",
      accent: "#ff4b2b",
      dark: "#060404",
      nameFont: "gothic",
      scriptFont: "gothic",
      nameGradient: ["#f7e3b0", "#c9a14a", "#7a5418"],
      fallback: ["#060404", "#2a0d08", "#c9a14a"],
      particles: "embers",
      ghost: false,
      giantText: true,
      streaks: true,
    },
  },
  {
    slug: "champions-street",
    name: "Street Champs",
    nameEs: "Campeones Callejeros",
    layout: "CHAMPIONS",
    sort: 8,
    prompt:
      "urban night: trophy on concrete in front of a graffiti wall, spray paint, chain-link fence, flares",
    style: {
      primary: "#ffffff",
      accent: "#ffd200",
      dark: "#0b0b0b",
      nameFont: "brush",
      scriptFont: "anton",
      nameGradient: ["#ffffff", "#f4f4f4", "#ffd200"],
      fallback: ["#0b0b0b", "#262626", "#ffd200"],
      particles: "sparks",
      ghost: false,
      giantText: true,
      streaks: true,
    },
  },
  {
    slug: "champions-neon",
    name: "Neon Arena",
    nameEs: "Arena Neón",
    layout: "CHAMPIONS",
    sort: 9,
    prompt:
      "esports championship stage: trophy on a glossy stage, giant LED screens, laser beams through haze, chrome typography",
    style: {
      primary: "#2fd8e8",
      accent: "#ff2e88",
      dark: "#05060a",
      nameFont: "bebas",
      scriptFont: "sans",
      nameGradient: ["#ffffff", "#bff6ff", "#2fd8e8"],
      fallback: ["#05060a", "#0b1a2a", "#2fd8e8"],
      particles: "sparks",
      ghost: false,
      giantText: true,
      streaks: true,
    },
  },
  {
    slug: "champions-pro",
    name: "Champions Pro",
    nameEs: "Campeones Pro",
    layout: "CHAMPIONS",
    sort: 5,
    prompt:
      "championship celebration in a dark stadium: ticker-tape and confetti falling, golden pyro sparks, smoke, floodlights, layered torn poster textures, the team crest and trophy as heroes",
    style: {
      primary: "#d4a64a",
      accent: "#fff1b8",
      dark: "#070605",
      nameFont: "anton",
      scriptFont: "brush",
      nameGradient: ["#fff8e1", "#ffe08a", "#d4a64a"],
      fallback: ["#070605", "#3a2a0c", "#d4a64a"],
      particles: "sparks",
      ghost: true,
      giantText: true,
      streaks: true,
    },
  },
  {
    slug: "grunge-cup",
    name: "Grunge Cup",
    nameEs: "Copa Grunge",
    layout: "EVENT",
    sort: 7,
    prompt:
      "layered torn paper and grunge poster textures, giant distressed lettering, halftone and scratches, stadium lights glowing through, glossy trophy hero",
    style: {
      primary: "#8b3dff",
      accent: "#ffd23f",
      dark: "#0d0518",
      nameFont: "anton",
      scriptFont: "brush",
      nameGradient: ["#ffffff", "#f1e6ff", "#cfa8ff"],
      fallback: ["#0d0518", "#3b1475", "#8b3dff"],
      particles: "sparks",
      ghost: false,
      giantText: true,
      streaks: true,
    },
  },
  ...[
    ["matchday-floodlights", "Floodlights", "Reflectores", "MATCHDAY", 9, "night stadium under blinding floodlights, blue haze and smoke, wet pitch reflections, crowd silhouettes, electric atmosphere", "#1f6bff", "#8fd3ff", "#020816", "anton", "snow"],
    ["matchday-derby", "Derby Fire", "Clásico en Llamas", "MATCHDAY", 10, "two halves split by a jagged lightning crack, red fire on one side and blue ice on the other, stadium behind, rivalry energy", "#e3102b", "#ffb347", "#120203", "anton", "embers"],
    ["lineup-tactics", "Tactics Board", "Pizarra Táctica", "LINEUP", 11, "dark tactical football pitch seen from above with glowing white lines, holographic HUD elements, subtle grid, stadium glow at the edges", "#12c2a0", "#7dffe1", "#02110e", "bebas", "sparks"],
    ["lineup-gold", "Shatter XI", "Once Estallido", "LINEUP", 12, "night stadium seen through a giant sheet of glass shattering toward the camera, shards catching the floodlights, dramatic perspective pitch", "#e3102b", "#ffffff", "#050505", "bebas", "sparks"],
    ["result-fulltime", "Full Time", "Final del Partido", "RESULT", 13, "stadium scoreboard atmosphere at night, confetti and smoke, big screen glow, dramatic spotlight beams", "#7a2cff", "#c8a2ff", "#0a0216", "anton", "sparks"],
    ["result-victory", "Victory", "Victoria", "RESULT", 14, "victory celebration, golden light burst, fireworks over the stadium, sparks and lens flares", "#e09a1f", "#ffd36b", "#1a0f02", "anton", "embers"],
  ].map(([slug, name, nameEs, layout, sort, prompt, primary, accent, dark, nameFont, particles]) => ({
    slug: slug as string,
    name: name as string,
    nameEs: nameEs as string,
    layout: layout as LayoutKind,
    sort: sort as number,
    prompt: prompt as string,
    style: {
      primary: primary as string,
      accent: accent as string,
      dark: dark as string,
      nameFont: nameFont as FontKey,
      scriptFont: "gothic" as FontKey,
      nameGradient: ["#ffffff", "#e9eef7", accent as string],
      fallback: [dark as string, primary as string, accent as string],
      particles: particles as Particles,
      ghost: false,
      giantText: true,
      streaks: true,
    },
  })),
];
