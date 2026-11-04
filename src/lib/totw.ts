// Team of the week helpers: the player-card look the cards borrow, and the sheet of club crests the AI copies from.
import sharp from "sharp";
import { db } from "./db";
import { loadBytes, saveFile } from "./storage";
import type { BannerInputs, TemplateStyle } from "./templates";
import { parseTotwLine } from "./formations";

export type CardTemplate = { id: string; name: string; prompt: string; style: unknown; proInstructions: string | null; audience?: string | null };

/** The player-card style whose look the poster borrows — only when the user picked one (none = the TOTW style's own look). */
export async function pickCardTemplate(viewer: { role?: string; isOrg?: boolean }, id?: string | null): Promise<CardTemplate | null> {
  if (!id) return null;
  const { canUseTemplate } = await import("./queries");
  const t = await db.template.findFirst({ where: { id, active: true, layout: "PLAYER" } });
  return t && canUseTemplate(t, viewer) ? t : null;
}

export type CardLook = { name: string; text: string; colours?: { primary: string; accent: string; dark: string } };

/** The player-card style as a brief: its scene / materials / effects and its colours — the whole TOTW poster takes this look. */
export function cardLookFor(t: CardTemplate | null): CardLook | null {
  if (!t) return null;
  const s = (t.style ?? {}) as Partial<TemplateStyle>;
  const colours = s.primary && s.accent && s.dark ? { primary: s.primary, accent: s.accent, dark: s.dark } : undefined;
  return { name: t.name, text: t.prompt.trim().replace(/\.$/, ""), colours };
}

/**
 * A single reference image with every club crest in a row-by-row grid — one image instead of one per club
 * (the models take a limited number of references). The order of the clubs is told to the AI in the label.
 */
export async function buildCrestSheet(inputs: BannerInputs): Promise<{ url: string; order: string[] } | null> {
  const clubs = new Map<string, { name: string; url: string }>();
  inputs.players.forEach((line, n) => {
    const url = inputs.playerLogos?.[n];
    if (!url) return;
    const { sub } = parseTotwLine(line);
    const club = sub.split("·").map((x) => x.trim()).find((x) => x && !/\d+\s*(?:pts|points|pt)\b/i.test(x) && !/^\d+$/.test(x));
    if (club && !clubs.has(club.toUpperCase())) clubs.set(club.toUpperCase(), { name: club, url });
  });
  if (!clubs.size) return null;
  const list = [...clubs.values()].slice(0, 12);
  const cell = 400;
  const cols = Math.min(4, list.length);
  const rows = Math.ceil(list.length / cols);
  const layers: { input: Buffer; left: number; top: number }[] = [];
  const order: string[] = [];
  for (let i = 0; i < list.length; i++) {
    const x = (i % cols) * cell;
    const y = Math.floor(i / cols) * cell;
    try {
      const img = await sharp(await loadBytes(list[i].url)).resize(cell - 60, cell - 60, { fit: "inside" }).png().toBuffer();
      const meta = await sharp(img).metadata();
      layers.push({ input: img, left: x + Math.round((cell - (meta.width ?? 0)) / 2), top: y + Math.round((cell - (meta.height ?? 0)) / 2) });
      order.push(list[i].name);
    } catch {
      /* a crest that can't be read is left out */
    }
  }
  if (!order.length) return null;
  const sheet = await sharp({ create: { width: cols * cell, height: rows * cell, channels: 4, background: { r: 18, g: 18, b: 22, alpha: 1 } } })
    .composite(layers)
    .png()
    .toBuffer();
  return { url: await saveFile("refs", sheet, "image/png"), order };
}

/** What a team-of-the-week brief needs on top of the usual inputs. */
export async function totwExtras(inputs: BannerInputs, cardTemplateId: string | null | undefined, viewer: { role?: string; isOrg?: boolean }) {
  const [cardTemplate, sheet] = await Promise.all([pickCardTemplate(viewer, cardTemplateId), buildCrestSheet(inputs).catch(() => null)]);
  return { cardTemplate, cardLook: cardLookFor(cardTemplate), crestSheet: sheet };
}
