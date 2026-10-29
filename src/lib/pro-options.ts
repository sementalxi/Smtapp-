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
