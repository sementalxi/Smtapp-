// Logo maker: one request → 5 different, original logo options (top esports-org quality). The player sees
// watermarked previews only; the one they pick is unlocked in full size plus a transparent PNG.
import sharp from "sharp";
import { db } from "./db";
import { generatePoster } from "./ai";
import { loadBytes, saveFile } from "./storage";
import { changeCredits } from "./credits";

export const LOGO_STYLES = ["mix", "mascot", "shield", "monogram", "minimal", "beast"] as const;
export type LogoStyle = (typeof LOGO_STYLES)[number];

export type LogoInputs = { name: string; idea: string; colors: string; style: LogoStyle; refUrl: string };
export type LogoOption = { preview: string; full: string } | null;
export const LOGO_COUNT = 5;

/** "Make me a logo SACREDZ X" → "SACREDZ X" (people type the request into the name box). */
export function cleanLogoName(raw: string): string {
  return raw
    .replace(/^\s*(please\s+)?(can you\s+)?(make|create|design|generate|draw|do|give)\s+(me\s+)?(a|an|the)?\s*(new\s+|cool\s+|badass\s+|team\s+|esports?\s+)*logo\s*(for|called|named|of|with)?\s*/i, "")
    .replace(/^\s*(por favor\s+)?(hazme|haz|crea|creame|créame|diseña|diseñame|genera)\s+(me\s+)?(un|una|el)?\s*(nuevo\s+)?logo\s*(para|de|llamado|que diga)?\s*/i, "")
    .replace(/^["'“”]+|["'“”]+$/g, "")
    .trim()
    .slice(0, 40);
}

/** The five directions of a set: different looks when "mix", or five takes on one look. */
const DIRECTIONS: Record<Exclude<LogoStyle, "mix">, string> = {
  mascot: "ESPORTS MASCOT LOGO: a fierce mascot head / bust (the idea below, or a creature or warrior that fits the name) in bold vector-illustration style — thick clean black outlines, 2–3 flat cel-shade tones per colour, sharp highlights, an aggressive expression, the head breaking out of a geometric frame; the team name in a heavy custom athletic wordmark below it with bevel and a thick outline, on a sharp angular banner plate",
  shield: "PREMIUM CLUB CREST: a sharp, modern shield / badge with a strong central symbol (the idea below, or a symbol that fits the name), layered bevelled borders in metal and enamel, a top banner or star detail, the team name in a strong custom serif or block wordmark across or under the crest — like an elite football club or top esports org crest",
  monogram: "LETTERMARK / MONOGRAM: the initials of the team name built into one interlocking, custom geometric monogram with blade-sharp cuts, negative-space tricks and a strong silhouette, set inside or over a sleek angular emblem, with the full team name in a wide, tracked-out modern wordmark under it",
  minimal: "MODERN MINIMAL ICON + WORDMARK: one clever, iconic symbol (the idea below or a symbol that fits the name) drawn with few bold geometric shapes and smart negative space — flat, two or three colours, instantly recognisable at tiny sizes — next to or under a clean, custom, confident wordmark of the team name",
  beast: "AGGRESSIVE BEAST BADGE: a ferocious full mascot (the idea below, or a beast that fits the name) lunging out of a jagged emblem with claws / fangs / horns, heavy dark outlines, intense glowing eyes, dynamic diagonal energy, cracked / shattered accents, the team name in an explosive, sharp-edged gaming wordmark with chrome bevel and a thick dark stroke",
};
const MIX: Exclude<LogoStyle, "mix">[] = ["mascot", "shield", "beast", "monogram", "minimal"];
const TAKES = [
  "Front-facing, perfectly symmetrical composition.",
  "Three-quarter view with more motion and a diagonal energy.",
  "A tighter, bolder, more compact badge with chunkier shapes.",
  "A wider horizontal lockup with the wordmark more dominant.",
  "A darker, edgier treatment with stronger contrast and sharper cuts.",
];

export function logoPrompt(inp: LogoInputs, n: number, withRef: boolean): string {
  const look = inp.style === "mix" ? MIX[n % MIX.length] : inp.style;
  const name = cleanLogoName(inp.name) || "TEAM";
  return [
    `Design ONE original, professional TEAM LOGO for a team called "${name}". It must look like the work of a top esports / sports branding studio — badass, bold, iconic, clean vector-style artwork, never a generic AI image.`,
    `LOOK: ${DIRECTIONS[look]}.`,
    inp.style !== "mix" ? `This is option ${n + 1} of ${LOGO_COUNT} — ${TAKES[n % TAKES.length]}` : "",
    inp.idea.trim() ? `IDEA / MASCOT the owner wants: ${inp.idea.trim().slice(0, 300)}.` : "",
    inp.colors.trim() ? `COLOURS: ${inp.colors.trim().slice(0, 120)} — the logo is built from these colours (plus black / white for outlines and highlights).` : "COLOURS: a strong, limited palette of 2–3 colours plus black / white that fits the name and idea.",
    withRef
      ? `INSPIRATION: the reference image shows the kind of logo the owner likes. Match its style, energy, rendering technique, level of detail and colour feel — but create a NEW, ORIGINAL logo for "${name}": never copy its text, its exact shapes or its symbol, and never reproduce any real brand's logo.`
      : "",
    `TEXT: the only text in the image is the team name "${name}", spelled exactly like that (same letters, same order), lettered as part of the logo. No other words, taglines, slogans, years, "est.", initials lines, website, watermark or signature.`,
    `CRAFT: crisp sharp edges, thick confident outlines, perfect symmetry or deliberate dynamic balance, strong readable silhouette that still works at 64 px, professional custom lettering with clean kerning, no blurry or muddy details, no photo textures, no tiny clutter.`,
    `BACKGROUND: the logo alone, centred with generous margin on a plain, flat, solid near-black background (#0b0b0f) — no scene, no smoke, no sparks, no gradient, no frame, no mockup, so it can be cut out cleanly.`,
  ]
    .filter(Boolean)
    .join("\n\n");
}

/** The watermarked, low-res preview the player sees before picking (useless as a screenshot). */
export async function makePreview(full: Buffer): Promise<Buffer> {
  const S = 560;
  const base = await sharp(full).resize(S, S, { fit: "cover" }).png().toBuffer();
  let marks = "";
  for (let y = -S; y < S * 2; y += 92) for (let x = -S; x < S * 2; x += 300) marks += `<text x="${x}" y="${y}" font-family="DejaVu Sans, Arial, sans-serif" font-weight="bold" font-size="26" letter-spacing="4">KIXO PREVIEW</text>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}">
<g transform="rotate(-28 ${S / 2} ${S / 2})" fill="#ffffff" fill-opacity="0.22" stroke="#000" stroke-opacity="0.18" stroke-width="1">${marks}</g>
<g transform="rotate(-28 ${S / 2} ${S / 2})"><text x="${S / 2}" y="${S / 2 + 22}" text-anchor="middle" font-family="DejaVu Sans, Arial, sans-serif" font-weight="bold" font-size="64" letter-spacing="10" fill="#ffffff" fill-opacity="0.35" stroke="#000" stroke-opacity="0.35" stroke-width="2">PREVIEW</text></g>
<rect x="0" y="${S - 34}" width="${S}" height="34" fill="#000" fill-opacity="0.55"/><text x="${S / 2}" y="${S - 11}" text-anchor="middle" font-family="DejaVu Sans, Arial, sans-serif" font-weight="bold" font-size="15" letter-spacing="3" fill="#ff2e88">PICK IT TO UNLOCK THE FULL LOGO · KIXO.PRO</text></svg>`;
  return sharp(base).composite([{ input: Buffer.from(svg) }]).jpeg({ quality: 62 }).toBuffer();
}

/** Makes the 5 options (in parallel) for a set; refunds the share of any that fail. */
export async function runLogoSet(setId: string) {
  const set = await db.logoSet.findUnique({ where: { id: setId } });
  if (!set) return;
  const inp = set.inputs as unknown as LogoInputs;
  let ref: { bytes: Buffer; type: string } | null = null;
  if (inp.refUrl) {
    try {
      const b = await sharp(await loadBytes(inp.refUrl)).resize(1024, 1024, { fit: "inside", withoutEnlargement: true }).png().toBuffer();
      ref = { bytes: b, type: "image/png" };
    } catch (e) {
      console.error("logo set: reference image unreadable", e);
    }
  }
  const options: LogoOption[] = Array(LOGO_COUNT).fill(null);
  const errors: string[] = [];
  await Promise.all(
    Array.from({ length: LOGO_COUNT }, async (_, n) => {
      try {
        const img = await generatePoster(logoPrompt(inp, n, !!ref), ref ? [ref] : [], "medium", ["1024x1024"], 250_000);
        const [full, preview] = await Promise.all([saveFile("logo-sets", await sharp(img).png().toBuffer(), "image/png"), makePreview(img).then((p) => saveFile("logo-previews", p, "image/jpeg"))]);
        options[n] = { full, preview };
        // show each option as soon as it's ready
        await db.logoSet.update({ where: { id: setId }, data: { options: options as never } });
      } catch (e) {
        errors.push(String(e instanceof Error ? e.message : e).slice(0, 200));
      }
    }),
  );
  const made = options.filter(Boolean).length;
  const failed = LOGO_COUNT - made;
  if (failed && set.cost > 0) {
    const back = made ? Math.floor((set.cost * failed) / LOGO_COUNT) : set.cost;
    if (back > 0) await changeCredits({ userId: set.userId, amount: back, type: "REFUND", note: `Logo maker: ${failed} of ${LOGO_COUNT} options failed` }).catch(() => {});
  }
  await db.logoSet.update({ where: { id: setId }, data: { options: options as never, status: made ? "READY" : "FAILED", error: errors[0] ?? "" } });
}

/** What the browser may see: previews only (and the full logo once picked). */
export function publicSet(set: { id: string; status: string; options: unknown; picked: number; pickedUrl: string; pngUrl: string; inputs: unknown; cost: number; error: string }) {
  const opts = (Array.isArray(set.options) ? set.options : []) as LogoOption[];
  return {
    id: set.id,
    status: set.status,
    previews: Array.from({ length: LOGO_COUNT }, (_, n) => opts[n]?.preview ?? null),
    picked: set.picked,
    pickedUrl: set.picked >= 0 ? set.pickedUrl : "",
    pngUrl: set.picked >= 0 ? set.pngUrl : "",
    inputs: set.inputs,
    cost: set.cost,
    failed: set.status === "FAILED",
  };
}
