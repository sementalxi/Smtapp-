import sharp from "sharp";
import { db } from "./db";
import { refPaletteKey } from "./ref-palette-key";
import { loadBytes } from "./storage";

function hsl(r: number, g: number, b: number) {
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2 / 255;
  const s = max === min ? 0 : (max - min) / 255 / (1 - Math.abs(2 * l - 1));
  let h = 0;
  if (max !== min) {
    if (max === r) h = ((g - b) / (max - min)) % 6;
    else if (max === g) h = (b - r) / (max - min) + 2;
    else h = (r - g) / (max - min) + 4;
    h = (h * 60 + 360) % 360;
  }
  return { h, s, l };
}

/** Rough colour name for the brief (so the AI reads "deep red", not a hex code it may ignore). */
export function colourName(r: number, g: number, b: number): string {
  const { h, s, l } = hsl(r, g, b);
  if (l < 0.12) return "black";
  if (s < 0.15) return l > 0.85 ? "white" : l > 0.6 ? "light grey / silver" : l > 0.3 ? "grey" : "black";
  const base = h < 15 || h >= 345 ? "red" : h < 33 ? "orange" : h < 65 ? "gold / yellow" : h < 160 ? "green" : h < 200 ? "teal / cyan" : h < 250 ? "blue" : h < 290 ? "purple / violet" : h < 330 ? "magenta / pink" : "pink-red";
  return `${l < 0.3 ? "deep " : l > 0.7 ? "light " : ""}${base}`;
}

/** The poster's main colours: its dark base, its light, and its two strongest vivid hues. */
export async function palette(bytes: Buffer): Promise<{ hex: string; name: string; share: number; role: "dark" | "light" | "vivid" }[]> {
  const { data } = await sharp(bytes).resize(120, 120, { fit: "inside" }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const buckets = new Map<string, { n: number; r: number; g: number; b: number }>();
  const total = data.length / 3;
  for (let i = 0; i < data.length; i += 3) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const key = `${r >> 4}-${g >> 4}-${b >> 4}`;
    const e = buckets.get(key) ?? { n: 0, r: 0, g: 0, b: 0 };
    e.n++; e.r += r; e.g += g; e.b += b;
    buckets.set(key, e);
  }
  const all = [...buckets.values()]
    .map((e) => {
      const c = { n: e.n, r: Math.round(e.r / e.n), g: Math.round(e.g / e.n), b: Math.round(e.b / e.n) };
      return { ...c, ...hsl(c.r, c.g, c.b) };
    })
    .sort((a, b) => b.n - a.n);
  const out: { n: number; r: number; g: number; b: number; role: "dark" | "light" | "vivid" }[] = [];
  const dark = all.find((c) => c.s < 0.25 && c.l < 0.35);
  if (dark && dark.n / total > 0.04) out.push({ ...dark, role: "dark" });
  const light = all.find((c) => c.l > 0.8 && c.s < 0.3);
  if (light && light.n / total > 0.04) out.push({ ...light, role: "light" });
  // Vivid colours: saturated buckets grouped by hue (30° bins), weighted by how much and how saturated.
  const hues = new Map<number, { w: number; n: number; r: number; g: number; b: number }>();
  for (const c of all) {
    if (c.s < 0.35 || c.l < 0.12 || c.l > 0.92) continue;
    const k = Math.round(c.h / 30) % 12;
    const e = hues.get(k) ?? { w: 0, n: 0, r: 0, g: 0, b: 0 };
    e.w += c.n * c.s; e.n += c.n; e.r += c.r * c.n; e.g += c.g * c.n; e.b += c.b * c.n;
    hues.set(k, e);
  }
  for (const e of [...hues.values()].sort((a, b) => b.w - a.w).slice(0, 2)) {
    if (e.n / total > 0.015) out.push({ n: e.n, r: Math.round(e.r / e.n), g: Math.round(e.g / e.n), b: Math.round(e.b / e.n), role: "vivid" });
  }
  return out.map((c) => ({ name: colourName(c.r, c.g, c.b), hex: `#${[c.r, c.g, c.b].map((x) => x.toString(16).padStart(2, "0")).join("")}`, share: Math.round((c.n / total) * 100), role: c.role }));
}

export type RefColour = { hex: string; name: string; share: number; role: "dark" | "light" | "vivid" };

/** The COLOURS line for a brief, from a palette. */
export function colourLineFor(cols: RefColour[]): string {
  if (!cols.length) return "";
  const vivid = cols.filter((c) => c.role === "vivid");
  return `COLOURS (read from the reference image — match these exactly): ${cols.map((c) => `${c.name} (${c.hex}, about ${c.share}% of it${c.role === "vivid" ? ", an accent" : c.role === "dark" ? ", the base" : ", the light"})`).join("; ")}.${vivid.length ? ` The main colour is ${vivid[0].name}.` : ""}`;
}

const cacheKey = refPaletteKey;

/**
 * Marks a reference image as one that gets NO colours line: one of the style's OWN posters used as its reference.
 * Such a poster was made from the style's brief, so the brief stays in charge of the colours — a measured palette
 * could call its gold "orange" and have the brief's gold words swapped away (buildProPrompt). Saved as the cached
 * "nothing to say" answer of referenceColourLine, so it holds on every storage driver. Throws if it can't be saved.
 */
export async function noReferenceColours(url: string): Promise<void> {
  const key = cacheKey(url);
  await db.setting.upsert({ where: { key }, create: { key, value: "-" }, update: { value: "-" } });
}

/**
 * The colours of a style's reference image, as a COLOURS line for the prompt — cached per file
 * (Setting "refpal:<hash>") so each reference is analysed once. Returns "" when it cannot be read
 * (and for references marked with noReferenceColours).
 */
export async function referenceColourLine(url: string | null | undefined): Promise<string> {
  if (!url) return "";
  const key = cacheKey(url);
  try {
    const hit = await db.setting.findUnique({ where: { key }, select: { value: true } });
    if (hit) return hit.value === "-" ? "" : hit.value;
  } catch {}
  let line = "";
  try {
    line = colourLineFor(await palette(await loadBytes(url)));
  } catch (e) {
    console.error("referenceColourLine failed", e);
  }
  try {
    await db.setting.upsert({ where: { key }, create: { key, value: line || "-" }, update: { value: line || "-" } });
  } catch {}
  return line;
}

/**
 * The colour KIXO's overlays (standings table, qualifiers table, winners wall) glow in: the finished poster's own
 * strongest vivid hue, so the glow matches the flyer as it came out — not the style's configured accent. Falls
 * back to the given accent when the picture has no vivid colour (black and white, silver).
 */
export async function posterAccent(poster: Buffer, fallback: string): Promise<string> {
  const GOLD = "#ffc83d";
  try {
    const vivid = (await palette(poster)).filter((c) => c.role === "vivid");
    if (!vivid.length) return GOLD;
    const hueOf = (hex: string) => {
      const v = parseInt(hex.slice(1), 16);
      return hsl((v >> 16) & 255, (v >> 8) & 255, v & 255).h;
    };
    const warm = (h: number) => h < 75 || h >= 300; // red, orange, gold, pink / magenta
    const cold = (h: number) => h >= 170 && h < 265; // cyan, blue
    const first = vivid[0];
    const h0 = hueOf(first.hex);
    // A blue poster glows in its warm accent (the gold of its sparks, script and frame), never in more blue;
    // a second warm hue with real presence wins over a dominant cold one.
    const second = vivid.slice(1).find((c) => warm(hueOf(c.hex)) && c.share >= Math.max(2, first.share * 0.2));
    if (cold(h0)) return second?.hex ?? GOLD;
    return first.hex;
  } catch {
    return fallback;
  }
}
