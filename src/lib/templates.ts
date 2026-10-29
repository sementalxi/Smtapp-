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
  colorMode: "surprise",
  color1: "",
  color2: "",
  aiCopy: "off",
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
      "royal purple baroque ornaments, violet lightning storm, golden light flare, stadium spotlights, purple clouds and mist, luxurious dark atmosphere",
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
      "golden marble arena with white feathered wings, warm golden light rays, sparks and confetti, epic trophy ceremony atmosphere",
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
  ...[
    ["matchday-floodlights", "Floodlights", "Reflectores", "MATCHDAY", 9, "night stadium under blinding floodlights, blue haze and smoke, wet pitch reflections, crowd silhouettes, electric atmosphere", "#1f6bff", "#8fd3ff", "#020816", "anton", "snow"],
    ["matchday-derby", "Derby Fire", "Clásico en Llamas", "MATCHDAY", 10, "two halves split by a jagged lightning crack, red fire on one side and blue ice on the other, stadium behind, rivalry energy", "#e3102b", "#ffb347", "#120203", "anton", "embers"],
    ["lineup-tactics", "Tactics Board", "Pizarra Táctica", "LINEUP", 11, "dark tactical football pitch seen from above with glowing white lines, holographic HUD elements, subtle grid, stadium glow at the edges", "#12c2a0", "#7dffe1", "#02110e", "bebas", "sparks"],
    ["lineup-gold", "Gold XI", "Once de Oro", "LINEUP", 12, "black marble and gold luxury pitch, gold foil lines, glitter dust and spotlights, premium starting eleven announcement", "#d4a64a", "#ffd77a", "#050403", "bebas", "sparks"],
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
