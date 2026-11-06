import { NextRequest } from "next/server";
import { z } from "zod";
import sharp from "sharp";
import { db } from "@/lib/db";
import { apiAdmin, HttpError } from "@/lib/auth";
import { handle, json } from "@/lib/api";
import { loadBytes, saveFile } from "@/lib/storage";

export const maxDuration = 60;

const Body = z.object({ bannerId: z.string().max(40), name: z.string().trim().min(1).max(40), nameEs: z.string().trim().max(40).optional() });

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
function colourName(r: number, g: number, b: number): string {
  const { h, s, l } = hsl(r, g, b);
  if (l < 0.12) return "black";
  if (s < 0.15) return l > 0.85 ? "white" : l > 0.6 ? "light grey / silver" : l > 0.3 ? "grey" : "black";
  const base = h < 15 || h >= 345 ? "red" : h < 33 ? "orange" : h < 65 ? "gold / yellow" : h < 160 ? "green" : h < 200 ? "teal / cyan" : h < 250 ? "blue" : h < 290 ? "purple / violet" : h < 330 ? "magenta / pink" : "pink-red";
  return `${l < 0.3 ? "deep " : l > 0.7 ? "light " : ""}${base}`;
}

/** The poster's main colours: its dark base, its light, and its two strongest vivid hues. */
async function palette(bytes: Buffer): Promise<{ hex: string; name: string; share: number; role: "dark" | "light" | "vivid" }[]> {
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

const REF_BLOCK = `STYLE REFERENCE (most important): one reference image is labelled a STYLE reference — it is the poster this style copies. Recreate THAT poster as exactly as possible: the same layout and proportions, the same lettering styles, materials, bevels and glows, the same background scene, colours, light and effects, the same crest treatment, the same density and finish — as if the same designer made this one. Change ONLY three things: the PERSON (the uploaded player stands where its person stands, in the same kind of pose and crop), the TEXTS (only the given texts, placed and styled like the reference's texts — never its words, names or numbers) and the CREST (only the given crest, where the reference has its crest — treated the same way). Never copy its name, words, numbers or face.`;

/**
 * Admin: turn a finished poster the admin likes into a NEW STYLE — the poster becomes the style's reference
 * (the AI copies it exactly for the next players) and its cover in the style picker; the brief, boxes, colours
 * and crest settings come from the style the poster was made with.
 */
export const POST = handle(async (req: NextRequest) => {
  await apiAdmin();
  const { bannerId, name, nameEs } = Body.parse(await req.json());
  const banner = await db.banner.findUnique({ where: { id: bannerId }, include: { template: true } });
  if (!banner?.finalUrl) throw new HttpError(404, "not_found");
  const src = banner.template;
  // The poster itself is the reference (copied, so deleting the poster keeps the style) and the cover.
  const bytes = await loadBytes(banner.finalUrl);
  const refUrl = await saveFile("refs", await sharp(bytes).resize({ width: 1400, withoutEnlargement: true }).jpeg({ quality: 90 }).toBuffer(), "image/jpeg");
  const thumbUrl = await saveFile("thumbs", await sharp(bytes).resize({ width: 800, height: 1000, fit: "cover" }).jpeg({ quality: 85 }).toBuffer(), "image/jpeg");
  // A unique slug from the name.
  const base = name.toLowerCase().normalize("NFD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 30) || "style";
  let slug = base;
  for (let n = 2; await db.template.findUnique({ where: { slug } }); n++) slug = `${base}-${n}`;
  // The poster's own colours become the style's colours — the source style's text may describe a different palette
  // (a red poster made with a white-and-gold style), and the AI must follow the reference, not that text.
  const cols = await palette(bytes).catch(() => [] as Awaited<ReturnType<typeof palette>>);
  const vividCols = cols.filter((c) => c.role === "vivid");
  const colourLine = cols.length
    ? `COLOURS (read from the reference poster — use EXACTLY these; they override any colours named below): ${cols.map((c) => `${c.name} (${c.hex}, about ${c.share}% of the poster${c.role === "vivid" ? ", the accent" : c.role === "dark" ? ", the base" : ", the light"})`).join("; ")}. ${vividCols.length ? `The main colour of this style is ${vividCols[0].name}.` : ""}`
    : "";
  // The brief: the source style's own instructions behind a "the reference wins" block, with its COLOURS line replaced.
  const instr = (src.proInstructions ?? "").trim();
  const tags = (instr.match(/^\s*(\[[A-Z0-9 ]+\]\s*)+/)?.[0] ?? "").trim();
  const body = instr
    .slice(tags.length)
    .trim()
    .replace(/^[^\S\n]*COLOURS:[^\n]*\n?/gim, "")
    .replace(/^STYLE REFERENCE \(most important\):[^\n]*\n?/gim, "")
    .trim();
  const head = `${tags ? `${tags} ` : ""}${name.toUpperCase()} — a style copied from a finished KIXO poster the admin chose: the reference image IS this style.`;
  const wins = `THE REFERENCE WINS: the reference poster decides the colours, materials, lettering, background scene and mood. Wherever the instructions below describe different colours, materials or scenes, follow the REFERENCE instead. ${colourLine}`;
  const proInstructions = [head, REF_BLOCK, wins, body].filter(Boolean).join("\n\n");
  // The card and the colour modes use the poster's colours too.
  const style = { ...(src.style as Record<string, unknown>) };
  if (vividCols.length) {
    const dark = cols.find((c) => c.role === "dark")?.hex ?? "#0b0b10";
    style.primary = vividCols[0].hex;
    style.accent = vividCols[1]?.hex ?? cols.find((c) => c.role === "light")?.hex ?? vividCols[0].hex;
    style.dark = dark;
    style.fallback = [dark, vividCols[0].hex, vividCols[1]?.hex ?? vividCols[0].hex];
  }
  const t = await db.template.create({
    data: {
      slug,
      name,
      nameEs: nameEs?.trim() || name,
      layout: src.layout,
      prompt: src.prompt,
      style: style as object,
      cost: src.cost,
      sort: -1,
      active: true,
      styleRefUrl: refUrl,
      thumbUrl,
      proInstructions,
      randomize: src.randomize,
      textSlots: src.textSlots,
      badge: src.badge,
      audience: src.audience,
    },
  });
  await (await import("@/lib/rev")).bumpRev();
  return json({ id: t.id, slug });
});
