// Holiday / season flyers. The admin picks the current season (or turns it off) in Admin → Styles.
// When on, the Create page shows a season card; posters made with it get the season's theme on top of the normal style.
import { db } from "./db";

export type SeasonDef = { key: string; emoji: string; en: string; es: string; prompt: string };

export const SEASONS: SeasonDef[] = [
  { key: "thanksgiving", emoji: "🦃", en: "Thanksgiving", es: "Día de Acción de Gracias", prompt: "THANKSGIVING edition: warm autumn atmosphere — golden-hour light, falling maple leaves in orange, red and gold, pumpkins, harvest wheat and cornucopia details, cozy amber glow, subtle 'HAPPY THANKSGIVING' feel; rich burnt-orange, deep red, gold and brown accents blended with the poster colours" },
  { key: "christmas", emoji: "🎄", en: "Christmas", es: "Navidad", prompt: "CHRISTMAS edition: festive winter magic — falling snow, frosted surfaces, glowing string lights and warm bokeh, ornaments, pine branches, ribbons, a Christmas tree glow, sparkles; red, emerald green, gold and snowy white accents blended with the poster colours; optional subtle 'MERRY CHRISTMAS' feel" },
  { key: "newyear", emoji: "🎆", en: "New Year", es: "Año Nuevo", prompt: "NEW YEAR edition: midnight celebration — fireworks bursting in the sky, gold and silver confetti, champagne sparkle, glitter, clock/countdown energy, glamorous night light; gold, silver, black and the poster colours; optional subtle 'HAPPY NEW YEAR' feel" },
  { key: "halloween", emoji: "🎃", en: "Halloween", es: "Halloween", prompt: "HALLOWEEN edition: spooky night — full moon, fog, jack-o'-lanterns glowing, bats, dead trees, eerie purple and orange light, cinematic horror-movie mood (not gory); orange, purple, black and the poster colours" },
  { key: "dia_muertos", emoji: "💀", en: "Day of the Dead", es: "Día de Muertos", prompt: "DÍA DE MUERTOS edition: vibrant Mexican celebration — marigold (cempasúchil) petals, papel picado banners, candles, elegant sugar-skull (calavera) patterns and catrina-inspired ornament, warm candlelight glow; marigold orange, magenta, purple, gold and the poster colours (respectful and festive, not scary)" },
  { key: "valentines", emoji: "💘", en: "Valentine's Day", es: "San Valentín", prompt: "VALENTINE'S edition: romantic and stylish — floating hearts, rose petals, soft pink and red glow, glossy chrome hearts, dreamy bokeh; red, pink, white and the poster colours" },
  { key: "easter", emoji: "🐣", en: "Easter", es: "Pascua", prompt: "EASTER / SPRING edition: fresh spring morning — blooming flowers, pastel painted eggs, soft sunlight, light petals in the air; pastel yellow, lilac, mint and the poster colours" },
  { key: "july4", emoji: "🇺🇸", en: "4th of July", es: "4 de Julio", prompt: "4TH OF JULY edition: American celebration — fireworks over the stadium, stars-and-stripes motifs, sparklers, red-white-blue light streaks; red, white, navy blue and the poster colours" },
  { key: "mexico", emoji: "🇲🇽", en: "Mexican Independence", es: "Independencia de México", prompt: "MEXICAN INDEPENDENCE (16 DE SEPTIEMBRE) edition: patriotic fiesta — green-white-red light streaks, fireworks, papel picado, festive 'VIVA MÉXICO' energy; green, white, red and gold accents with the poster colours" },
  { key: "mothers_day", emoji: "💐", en: "Mother's Day", es: "Día de las Madres", prompt: "MOTHER'S DAY edition: elegant and warm — flowers and bouquets, soft glowing light, gentle petals; rose, blush pink, gold and the poster colours" },
  { key: "fathers_day", emoji: "👔", en: "Father's Day", es: "Día del Padre", prompt: "FATHER'S DAY edition: bold and classy — rich dark tones, leather and steel textures, warm spotlight, subtle tie/crown motifs; navy, gold, steel and the poster colours" },
  { key: "black_friday", emoji: "🛍️", en: "Black Friday", es: "Black Friday", prompt: "BLACK FRIDAY edition: hype sale energy — sleek black with neon and gold accents, price-tag and lightning motifs, bold 'SALE' energy, glossy dramatic light" },
  { key: "summer", emoji: "☀️", en: "Summer", es: "Verano", prompt: "SUMMER edition: bright sunny vibes — golden sunlight, sun flares, palm shadows, beach heat haze; warm yellow, turquoise, coral and the poster colours" },
];

export type SeasonState = { key: string; custom?: string; on: boolean };

export async function getSeasonState(): Promise<SeasonState> {
  const row = await db.setting.findUnique({ where: { key: "season" } }).catch(() => null);
  try {
    const v = row ? JSON.parse(row.value) : null;
    if (v && typeof v.key === "string") return { key: v.key, custom: typeof v.custom === "string" ? v.custom : "", on: v.on !== false };
  } catch {}
  return { key: "", custom: "", on: false };
}
export async function saveSeasonState(s: SeasonState) {
  const value = JSON.stringify(s);
  await db.setting.upsert({ where: { key: "season" }, create: { key: "season", value }, update: { value } });
}

/** The season shown on the Create page right now, or null when off. */
export async function activeSeason(): Promise<(SeasonDef & { custom?: string }) | null> {
  const s = await getSeasonState();
  if (!s.on || !s.key) return null;
  return seasonByKey(s.key, s.custom);
}
export function seasonByKey(key: string, custom?: string): (SeasonDef & { custom?: string }) | null {
  if (key === "custom") {
    const c = (custom ?? "").trim();
    return c ? { key: "custom", emoji: "✨", en: c.split(/[:.\n]/)[0].slice(0, 30), es: c.split(/[:.\n]/)[0].slice(0, 30), prompt: `SPECIAL EDITION: ${c}`, custom: c } : null;
  }
  return SEASONS.find((x) => x.key === key) ?? null;
}

/** Text added to the AI brief for a season poster. */
export function seasonPrompt(def: { prompt: string } | null) {
  return def
    ? `SEASON / HOLIDAY THEME (always applies): ${def.prompt}. Keep the chosen style's layout, typography and quality — add the holiday theme through the background, lighting, particles, props and colour accents so the poster clearly feels like this holiday. All required text stays exactly as given and readable.`
    : "";
}
