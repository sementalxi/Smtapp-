import { z } from "zod";
import { Prisma } from "@prisma/client";
import { db } from "./db";
import { HttpError } from "./auth";
import { backgroundProvider, BLOCKED, buildPrompt, canRemoveBackground, generatePoster, generateBackground, removeBackground } from "./ai";
import { deleteFile, isStorageUrl, loadBytes, saveFile, sniffImage } from "./storage";
import { changeCredits } from "./credits";
import { BannerInputs, DEFAULT_DESIGN, EMPTY_INPUTS, LayoutKind, TemplateStyle } from "./templates";

const str = (max: number) => z.string().trim().max(max).default("");

export const InputsSchema = z.object({
  name: str(40),
  team: str(40),
  position: str(24),
  number: str(4),
  tagline: str(30),
  subtitle: str(40),
  footer: str(48),
  headline: str(30),
  eventName: str(48),
  roster: z.array(z.string().trim().max(30)).max(30).default([]),
  prize: str(24),
  date: str(30),
  details: str(48),
  extraPrompt: str(200),
});

export const DesignSchema = z.object({
  playerX: z.number().min(-0.6).max(0.6),
  playerY: z.number().min(-0.6).max(0.6),
  playerScale: z.number().min(0.3).max(2),
  ghost: z.boolean(),
  ghostOpacity: z.number().min(0).max(1),
  nameScale: z.number().min(0.4).max(1.6),
  overlay: z.number().min(0).max(1),
  particles: z.boolean(),
  logoScale: z.number().min(0.3).max(2),
  seed: z.number().int().min(0).max(1_000_000),
});

export function normalizeInputs(raw: unknown): BannerInputs {
  return { ...EMPTY_INPUTS, ...InputsSchema.parse(raw ?? {}) };
}

/** Accept only URLs that point at our own storage (prevents SSRF). */
export function assertOwnUrl(url: string | null | undefined) {
  if (!url) return;
  if (!isStorageUrl(url)) throw new HttpError(400, "bad_file_url");
}

export function aiConfigured() {
  return backgroundProvider() !== null;
}

export function titleFor(inputs: BannerInputs) {
  return (inputs.name || inputs.team || inputs.headline || "Banner").slice(0, 60);
}

/**
 * Charges credits, runs the AI steps and stores the results.
 * Refunds automatically if anything fails.
 */
export async function generateForBanner(opts: {
  bannerId: string;
  userId: string;
  cost: number;
  prompt: string;
  extraPrompt: string;
  photoUrl?: string | null;
  isCutout?: boolean;
  backgroundOnly?: boolean;
}) {
  const demo = !aiConfigured();
  const cost = demo ? 0 : opts.cost;

  let prompt: string;
  try {
    prompt = buildPrompt(opts.prompt, opts.extraPrompt);
  } catch {
    throw new HttpError(400, "err_blocked");
  }

  if (cost > 0) {
    await changeCredits({
      userId: opts.userId,
      amount: -cost,
      type: "GENERATION",
      bannerId: opts.bannerId,
      note: opts.backgroundOnly ? "New background" : "Banner generation",
    });
  }

  try {
    const bgTask = demo
      ? Promise.resolve(null)
      : generateBackground(prompt).then((bytes) => saveFile("backgrounds", bytes, sniffImage(bytes) ?? "image/png"));

    let cutTask: Promise<string | null> = Promise.resolve(null);
    if (!opts.backgroundOnly && opts.photoUrl) {
      if (opts.isCutout || demo || !canRemoveBackground()) {
        cutTask = Promise.resolve(opts.photoUrl);
      } else {
        cutTask = (async () => {
          const bytes = await loadBytes(opts.photoUrl!);
          const out = await removeBackground(bytes, sniffImage(bytes) ?? "image/jpeg");
          return saveFile("cutouts", out, "image/png");
        })();
      }
    }

    const [backgroundUrl, cutoutUrl] = await Promise.all([bgTask, cutTask]);

    const data: Prisma.BannerUpdateInput = { status: "READY", error: null, backgroundUrl };
    if (!opts.backgroundOnly) data.cutoutUrl = cutoutUrl;
    return db.banner.update({ where: { id: opts.bannerId }, data });
  } catch (err) {
    console.error("generation failed", err);
    if (cost > 0) {
      await changeCredits({
        userId: opts.userId,
        amount: cost,
        type: "REFUND",
        bannerId: opts.bannerId,
        note: "Automatic refund — generation failed",
      });
    }
    await db.banner.update({
      where: { id: opts.bannerId },
      data: opts.backgroundOnly
        ? { error: String(err instanceof Error ? err.message : err).slice(0, 500) }
        : { status: "FAILED", error: String(err instanceof Error ? err.message : err).slice(0, 500) },
    });
    throw new HttpError(502, "generation_failed");
  }
}

export const defaultDesign = () => ({ ...DEFAULT_DESIGN, seed: Math.floor(Math.random() * 100000) });

/** Prisma's Json input type doesn't accept interfaces directly. */
export const toJson = (v: unknown) => v as Prisma.InputJsonValue;

/**
 * A generation can be killed by the host's time limit before it refunds.
 * This marks such banners as failed and refunds them (once).
 */
export async function reapStale(userId?: string) {
  const stale = await db.banner.findMany({
    where: { status: "PROCESSING", createdAt: { lt: new Date(Date.now() - 8 * 60_000) }, ...(userId ? { userId } : {}) },
    select: { id: true, userId: true },
    take: 50,
  });
  for (const b of stale) {
    const txs = await db.creditTransaction.findMany({ where: { bannerId: b.id }, select: { type: true, amount: true } });
    const charged = -txs.filter((t) => t.type === "GENERATION").reduce((s, t) => s + t.amount, 0);
    const refunded = txs.filter((t) => t.type === "REFUND").reduce((s, t) => s + t.amount, 0);
    await db.banner.update({ where: { id: b.id }, data: { status: "FAILED", error: "Timed out" } });
    if (charged - refunded > 0) {
      await changeCredits({
        userId: b.userId,
        amount: charged - refunded,
        type: "REFUND",
        bannerId: b.id,
        note: "Automatic refund — generation timed out",
      });
    }
  }
}

// ─── Pro AI mode ──────────────────────────────────────────

const q = (s: string) => `"${s.replace(/"/g, "'")}"`;

/** Turns the template + the user's text into a detailed design brief for the image model. */
export function buildProPrompt(opts: {
  layout: LayoutKind;
  templatePrompt: string;
  style: TemplateStyle;
  inputs: BannerInputs;
  hasPhoto: boolean;
  hasLogo: boolean;
}) {
  const { inputs: i, style, layout } = opts;
  const allText = [i.name, i.team, i.position, i.tagline, i.subtitle, i.footer, i.headline, i.eventName, i.prize, i.date, i.details, i.extraPrompt, ...i.roster].join(" ");
  if (BLOCKED.test(allText)) throw new HttpError(400, "err_blocked");

  const refs: string[] = [];
  if (opts.hasPhoto) {
    refs.push(
      `Reference image 1 is the ${layout === "CHAMPIONS" ? "team's main subject (player or mascot)" : "player"}. Keep their face, hair, skin tone and body exactly recognisable — same person, not a lookalike. Keep their clothing/kit as in the photo.`,
    );
  }
  if (opts.hasLogo) {
    refs.push(`Reference image ${opts.hasPhoto ? 2 : 1} is the team crest. Reproduce it faithfully, do not redesign it.`);
  }

  const lines: string[] = [];
  const add = (label: string, v: string) => v && lines.push(`- ${label}: ${q(v)}`);

  let composition: string;
  if (layout === "CHAMPIONS") {
    composition = `A champions celebration poster. Huge 3D metallic title at the top, the team name large in the lower third, the roster as a clean row of names separated by vertical bars below it, a shiny trophy, confetti and sparks.`;
    add("Title (huge, top)", i.headline || "CHAMPIONS");
    add("Small line above the title", i.eventName);
    add("Team name (large)", i.team);
    if (i.roster.length) lines.push(`- Roster, exactly these names separated by " | ": ${q(i.roster.filter(Boolean).join(" | "))}`);
    add("Prize badge (bottom right, gold)", i.prize);
  } else if (layout === "EVENT") {
    composition = `A tournament / event announcement poster. One or two dynamic shots of the subject, a huge glossy 3D headline in the middle, a bold event title under it, a script-font accent line, and a pill-shaped info bar with the date and times.`;
    add("Headline (huge, glossy 3D)", i.headline);
    add("Event title (bold, under the headline)", i.name);
    add("Script accent line", i.subtitle);
    add("Info bar", [i.date, i.details].filter(Boolean).join("  ·  "));
    add("Prize", i.prize);
  } else {
    composition = `A premium esports / football player card poster in the style of pro club social media graphics. Show the player twice: a very large, semi-transparent, colour-tinted close-up portrait of their face in the background (upper area), and a sharp full cut-out of them in front with a glowing rim light. Giant outlined background lettering, light streaks, particles and texture overlays. The player's name in a huge condensed bold font, bottom left, with a small coloured tag box above it for the position.`;
    add("Player name (huge, condensed, bottom left)", i.name);
    add("Position tag box", i.position);
    add("Small elegant word above the name", i.tagline);
    add("Script-font line under the name", i.subtitle);
    add("Team name (small, letter-spaced)", i.team);
    add("Jersey number (large outlined, right side)", i.number);
  }
  add("Letter-spaced footer line at the very bottom", i.footer);

  return [
    `Design a finished, high-end vertical sports social-media poster (4:5).`,
    composition,
    `Visual style: ${opts.templatePrompt}. Main colour ${style.primary}, accent/glow ${style.accent}, deep shadows ${style.dark}.`,
    i.extraPrompt ? `Extra direction from the user: ${i.extraPrompt}.` : "",
    ...refs,
    lines.length ? `Text on the poster — spell EVERY item exactly as written, letter for letter, keep capitalisation and symbols like _ - | $:\n${lines.join("\n")}` : "",
    `Do not add any other text, words, watermarks, sponsor logos, brand names or website addresses. No real company or league logos except the provided crest.`,
    `Professional Photoshop-level composition: dramatic lighting, depth, crisp typography, clean edges, no warped faces or hands.`,
  ]
    .filter(Boolean)
    .join("\n\n");
}

/** Charges credits, asks the model for the full poster, stores it. Refunds on failure. */
export async function generateProForBanner(opts: {
  bannerId: string;
  userId: string;
  cost: number;
  prompt: string;
  photoUrl?: string | null;
  logoUrl?: string | null;
  regenerate?: boolean;
}) {
  if (opts.cost > 0) {
    await changeCredits({
      userId: opts.userId,
      amount: -opts.cost,
      type: "GENERATION",
      bannerId: opts.bannerId,
      note: opts.regenerate ? "Pro AI — new version" : "Pro AI poster",
    });
  }
  try {
    const refs: { bytes: Buffer; type: string }[] = [];
    for (const url of [opts.photoUrl, opts.logoUrl]) {
      if (!url) continue;
      const bytes = await loadBytes(url);
      refs.push({ bytes, type: sniffImage(bytes) ?? "image/png" });
    }
    const out = await generatePoster(opts.prompt, refs);
    const url = await saveFile("banners", out, sniffImage(out) ?? "image/png");
    const old = await db.banner.findUnique({ where: { id: opts.bannerId }, select: { finalUrl: true } });
    const updated = await db.banner.update({ where: { id: opts.bannerId }, data: { status: "READY", error: null, finalUrl: url } });
    if (old?.finalUrl && old.finalUrl !== url) await deleteFile(old.finalUrl);
    return updated;
  } catch (err) {
    console.error("pro generation failed", err);
    if (opts.cost > 0) {
      await changeCredits({
        userId: opts.userId,
        amount: opts.cost,
        type: "REFUND",
        bannerId: opts.bannerId,
        note: "Automatic refund — Pro AI failed",
      });
    }
    const msg = String(err instanceof Error ? err.message : err).slice(0, 500);
    await db.banner.update({
      where: { id: opts.bannerId },
      data: opts.regenerate ? { error: msg } : { status: "FAILED", error: msg },
    });
    // OpenAI's own safety system rejected the request
    if (/moderation|safety|content_policy/i.test(msg)) throw new HttpError(400, "err_blocked");
    throw new HttpError(502, "generation_failed");
  }
}
