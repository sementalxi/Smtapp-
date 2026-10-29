import { z } from "zod";
import { Prisma } from "@prisma/client";
import { db } from "./db";
import { HttpError } from "./auth";
import { backgroundProvider, BLOCKED, buildPrompt, canRemoveBackground, generatePoster, generateBackground, removeBackground } from "./ai";
import { deleteFile, isStorageUrl, loadBytes, saveFile, sniffImage } from "./storage";
import { changeCredits } from "./credits";
import { BannerInputs, DEFAULT_DESIGN, EMPTY_INPUTS, LayoutKind, TemplateStyle } from "./templates";
import { bgPosePrompt, createVariation, fontPrompt, trophyPrompt, type Variation } from "./pro-options";
import { stampLogo } from "./stamp";
import { getSettings } from "./settings";

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
  homeTeam: str(40),
  awayTeam: str(40),
  homeScore: str(3),
  awayScore: str(3),
  competition: str(48),
  venue: str(48),
  time: str(20),
  formation: str(12),
  players: z.array(z.string().trim().max(40)).max(18).default([]),
  scorers: z.array(z.string().trim().max(40)).max(12).default([]),
  trophy: str(60),
  bgPose: str(40),
  colorMode: z.enum(["surprise", "template", "custom", ""]).default("surprise"),
  color1: z.string().regex(/^(#[0-9a-fA-F]{6})?$/).default(""),
  color2: z.string().regex(/^(#[0-9a-fA-F]{6})?$/).default(""),
  language: str(20),
  fontPrimary: str(40),
  fontSecondary: str(40),
  homeLogoUrl: str(500),
  awayLogoUrl: str(500),
  champLogoUrl: str(500),
  trophyUrl: str(500),
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
  const vs = inputs.homeTeam && inputs.awayTeam ? `${inputs.homeTeam} vs ${inputs.awayTeam}` : "";
  return (inputs.name || vs || inputs.team || inputs.headline || inputs.homeTeam || "Banner").slice(0, 60);
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

/** A reference image sent to the model, with what it is. */
export interface ProRef {
  url: string;
  label: string;
}

/** Works out which reference images go to the model, in order, with instructions for each. */
export function collectProRefs(opts: {
  layout: LayoutKind;
  inputs: BannerInputs;
  photoUrl?: string | null;
  logoUrl?: string | null;
  styleRefUrl?: string | null;
}): ProRef[] {
  const { inputs: i, layout } = opts;
  const refs: ProRef[] = [];
  if (opts.photoUrl) {
    refs.push({
      url: opts.photoUrl,
      label:
        layout === "LINEUP" || layout === "RESULT" || layout === "MATCHDAY"
          ? "a player photo to feature as the hero image. Keep the face exactly recognisable — same person, not a lookalike."
          : "the main subject. Keep their face, hair, skin tone and body exactly recognisable — same person, not a lookalike. Keep their clothing/kit as in the photo.",
    });
  }
  const crest = (url: string, who: string) =>
    refs.push({ url, label: `the crest of ${who}. Reproduce it faithfully as a glossy chrome/3D emblem with a glow; do not redesign it.` });
  if (layout === "MATCHDAY" || layout === "RESULT") {
    if (i.homeLogoUrl) crest(i.homeLogoUrl, `the home team${i.homeTeam ? ` (${i.homeTeam})` : ""}`);
    if (i.awayLogoUrl) crest(i.awayLogoUrl, `the away team${i.awayTeam ? ` (${i.awayTeam})` : ""}`);
  } else if (opts.logoUrl) {
    crest(opts.logoUrl, `the team${i.team ? ` (${i.team})` : ""}`);
  }
  if (i.champLogoUrl) {
    refs.push({ url: i.champLogoUrl, label: `the competition/championship logo${i.eventName || i.competition ? ` (${i.eventName || i.competition})` : ""}. Place it as a smaller badge; reproduce it faithfully.` });
  }
  if (i.trophyUrl) {
    refs.push({ url: i.trophyUrl, label: "the trophy. Reproduce this exact trophy design, large and shiny, as the centrepiece." });
  }
  if (opts.styleRefUrl) {
    refs.push({
      url: opts.styleRefUrl,
      label:
        "a STYLE reference only. Match its overall look: composition and layering, lighting, colour grading, textures, effects and typography feel. Do NOT copy its people, faces, names, text, logos, badges, stickers or watermarks.",
    });
  }
  return refs;
}

/** Turns the template + the user's text into a detailed design brief for the image model. */
export function buildProPrompt(opts: {
  layout: LayoutKind;
  templatePrompt: string;
  style: TemplateStyle;
  inputs: BannerInputs;
  refs: ProRef[];
  /** Random creative direction so every poster is unique (made fresh on each generation). */
  variation?: Variation;
  /** Admin-written instructions for this style */
  instructions?: string | null;
  /** false = keep the style consistent (no random direction) */
  randomize?: boolean;
}) {
  const { inputs: i, style, layout } = opts;
  const randomize = opts.randomize !== false;
  // With randomize off, "unique colours" falls back to the style's own palette.
  const v = opts.variation ?? createVariation(randomize ? i.colorMode : i.colorMode === "custom" ? "custom" : "template");
  const allText = [
    i.name, i.team, i.position, i.tagline, i.subtitle, i.footer, i.headline, i.eventName, i.prize, i.date, i.details,
    i.extraPrompt, i.homeTeam, i.awayTeam, i.competition, i.venue, ...i.roster, ...i.players, ...i.scorers,
  ].join(" ");
  const hit = allText.match(BLOCKED);
  if (hit) throw Object.assign(new HttpError(400, "err_blocked"), { detail: `Word filter matched "${hit[0]}"` });

  const lines: string[] = [];
  const add = (label: string, v: string) => v && lines.push(`- ${label}: ${q(v)}`);
  const finish = `Finish: dense layered effects (light streaks, sparks, glitter dust, fine grain, haze) and a rich cinematic colour grade.`;
  const frame = `FRAME: thin corner marks and a bottom footer row with three small letter-spaced items.`;

  let composition: string;
  switch (layout) {
    case "CHAMPIONS": {
      const trophy = i.trophyUrl ? "the provided trophy" : trophyPrompt(i.trophy) || "a large shiny trophy";
      composition = [
        `A champions title-celebration poster.`,
        `A huge 3D metallic "${i.headline || "CHAMPIONS"}" title (can repeat or stack for impact), ${trophy} as the centrepiece, the team crest large and glossy, the team name in big metallic letters in the lower third, the squad list as a clean row of names separated by vertical bars, confetti, sparks and spotlight beams.`,
        frame,
        finish,
      ].join(" ");
      add("Title (huge, top)", i.headline || "CHAMPIONS");
      add("Small line above the title (competition)", i.eventName || i.competition);
      add("Team name (large)", i.team);
      const squad = (i.roster.length ? i.roster : i.players).filter(Boolean);
      if (squad.length) lines.push(`- Squad list, exactly these names separated by " | ": ${q(squad.join(" | "))}`);
      add("Date", i.date);
      add("Prize badge (gold)", i.prize);
      break;
    }
    case "MATCHDAY":
      composition = [
        `A match-day announcement poster for a pro-clubs / football match.`,
        `The two team crests big and glossy facing each other with a bold "VS" between them (or the hero player in front if a player photo is given), a huge "${i.headline || "MATCH DAY"}" title, the competition name, and a clear info block with date, kick-off time and venue.`,
        frame,
        finish,
      ].join(" ");
      add("Title (huge)", i.headline || "MATCH DAY");
      add("Home team name", i.homeTeam);
      add("Away team name", i.awayTeam);
      add("Competition", i.competition);
      add("Date", i.date);
      add("Kick-off time", i.time);
      add("Venue", i.venue);
      break;
    case "LINEUP":
      composition = [
        `A "STARTING XI" lineup graphic.`,
        `A stylised football pitch seen from above${i.formation ? ` with the players arranged in a ${i.formation} formation` : ""}: each player shown as a clean badge/marker with their shirt number and name, goalkeeper at the bottom, attackers at the top. The team crest large and glossy, a huge "${i.headline || "STARTING XI"}" title, competition and date. Keep all names perfectly legible.`,
        frame,
        finish,
      ].join(" ");
      add("Title (huge)", i.headline || "STARTING XI");
      add("Team name", i.team);
      add("Formation", i.formation);
      if (i.players.length) lines.push(`- Players (number, name, position) — place every one on the pitch:\n${i.players.filter(Boolean).map((p) => `  • ${q(p)}`).join("\n")}`);
      add("Competition", i.competition);
      add("Date / matchday", i.date);
      break;
    case "RESULT":
      composition = [
        `A full-time result graphic.`,
        `Both team crests big and glossy on either side, a huge score between them, a bold "${i.headline || "FULL TIME"}" label, the goal scorers listed under each side (or under the score), and the competition name.`,
        frame,
        finish,
      ].join(" ");
      add("Label", i.headline || "FULL TIME");
      add("Home team", i.homeTeam);
      add("Away team", i.awayTeam);
      add("Score (huge)", `${i.homeScore || "0"} - ${i.awayScore || "0"}`);
      if (i.scorers.length) lines.push(`- Goal scorers: ${q(i.scorers.filter(Boolean).join(" | "))}`);
      add("Competition", i.competition);
      break;
    case "EVENT":
      composition = `A tournament / event announcement poster. One or two dynamic shots of the subject, a huge glossy 3D headline in the middle, a bold event title under it, a script-font accent line, and a pill-shaped info bar with the date and times. ${frame} ${finish}`;
      add("Headline (huge, glossy 3D)", i.headline);
      add("Event title (bold, under the headline)", i.name);
      add("Script accent line", i.subtitle);
      add("Info bar", [i.date, i.details].filter(Boolean).join("  ·  "));
      add("Prize", i.prize);
      break;
    default:
      composition = [
        `A premium pro-clubs / esports football player announcement poster, the dense layered style of top club social-media designers.`,
        `LAYERING (back to front): 1) a dramatic themed background filling the frame; 2) GIANT background lettering of the team name spanning the whole width — mix a huge blackletter/gothic word with huge condensed outlined letters, partly hidden behind the player;`,
        `3) a SECOND, NEWLY CREATED image of the SAME player, very large in the upper half/behind: ${bgPosePrompt(i.bgPose)}. This must be a genuinely different shot generated by you — different pose, angle and expression from the uploaded photo, NOT a copy, crop or enlargement of it — but clearly the same person (same face, hair, skin tone, beard, kit). Render it in the same style as the rest of the poster: colour-graded and tinted with the main colour, slightly faded/double-exposed into the background, with light rays and texture over it;`,
        `4) in front, the player from the uploaded photo as a sharp full cut-out (same pose as the photo), with a strong rim light and glow separating them from the background; 5) effects on top.`,
        `The two figures must clearly differ (e.g. one a dramatic close-up, the other the action/full-body pose), like a pro designer's double-shot player card.`,
        `TYPOGRAPHY: the player's name huge on the lower left; a small solid coloured tag box above it with the position; a script or gothic accent word; small letter-spaced uppercase text for details. Big outlined jersey number on the right.`,
        `${frame} Tiny decorative "× × × ×" marks.`,
        finish,
      ].join(" ");
      add("Player name (huge, bottom left)", i.name);
      add("Position tag box", i.position);
      add("Small elegant word above the name", i.tagline);
      add("Script-font line under the name", i.subtitle);
      add("Team name (small, letter-spaced)", i.team);
      add("Jersey number (large outlined, right side)", i.number);
  }
  add("Letter-spaced footer line at the very bottom", i.footer);

  const typo = [
    i.fontPrimary && `Titles and the main headline in ${fontPrompt(i.fontPrimary)}.`,
    i.fontSecondary && `Names, numbers and small text in ${fontPrompt(i.fontSecondary)}.`,
    i.language && i.language !== "English"
      ? `Write generic words on the poster (titles like MATCH DAY, FULL TIME, CHAMPIONS, STARTING XI, labels, dates) in ${i.language}. Team names, player names and anything quoted below stay exactly as written.`
      : "",
  ]
    .filter(Boolean)
    .join(" ");

  const refText = opts.refs.map((r, n) => `Reference image ${n + 1} is ${r.label}`);

  return [
    `Design a finished, high-end vertical sports social-media poster (4:5).`,
    composition,
    `Visual style (base): ${opts.templatePrompt}.`,
    colourLine(i, style, v),
    randomize
      ? `UNIQUE CREATIVE DIRECTION for this poster (variation #${v.seed}) — make it look clearly different from other posters in this series: background concept: ${v.motif}; composition: ${v.composition}; lighting: ${v.lighting}; texture: ${v.texture}. Blend these with the base style; invent fresh details rather than a generic template.`
      : `Keep this poster consistent with the base style — same kind of background, layout and mood every time.`,
    opts.instructions?.trim()
      ? `DESIGN INSTRUCTIONS FROM THE ART DIRECTOR — follow these closely; where they conflict with anything above, these win:\n${opts.instructions.trim()}`
      : "",
    typo,
    i.extraPrompt ? `Extra direction from the user: ${i.extraPrompt}.` : "",
    ...refText,
    lines.length ? `Text on the poster — spell EVERY item exactly as written, letter for letter, keep capitalisation and symbols like _ - | $:\n${lines.join("\n")}` : "",
    `REALISM: photorealistic premium sports-advertising quality, like a top designer composited real photography with real 3D renders. Real photographic lighting, real materials (true chrome, polished gold, glass, smoke, wet concrete, stadium floodlights), physically correct reflections and shadows, natural skin texture, shallow depth of field, razor-sharp 4K detail and crisp, perfectly formed lettering. It must NOT look like a cartoon, an illustration or a generic AI image: no plastic skin, no mushy or melted text, no over-smoothed textures, no random symbols, no warped faces or hands.`,
    `Keep the bottom-right corner (about 20% of the width) clear of text and important details — a small brand mark goes there.`,
    `Do not add any other text, words, watermarks, sponsor logos, brand names or website addresses. No real company or league logos except the provided crests and badges.`,
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
  refs: ProRef[];
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
    const images: { bytes: Buffer; type: string }[] = [];
    for (const r of opts.refs) {
      const bytes = await loadBytes(r.url);
      images.push({ bytes, type: sniffImage(bytes) ?? "image/png" });
    }
    const quality = (await getSettings()).pro_quality;
    const out = await stampLogo(await generatePoster(opts.prompt, images, quality));
    const url = await saveFile("banners", out, "image/png");
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
    if (/moderation|safety|content_policy/i.test(msg)) throw Object.assign(new HttpError(400, "err_blocked"), { detail: msg });
    throw new HttpError(502, "generation_failed");
  }
}

/** All image URLs inside inputs must be ours. */
export function assertInputUrls(i: BannerInputs) {
  [i.homeLogoUrl, i.awayLogoUrl, i.champLogoUrl, i.trophyUrl].forEach((u) => assertOwnUrl(u || null));
}

function colourLine(i: BannerInputs, style: TemplateStyle, v: Variation) {
  if (i.colorMode === "custom" && i.color1) {
    return `COLOURS: main colour ${i.color1}${i.color2 ? `, second colour ${i.color2}` : ""}, with deep dark shadows. Use these as the dominant palette.`;
  }
  if (v.palette) {
    return `COLOURS: a ${v.palette.name} palette — main ${v.palette.primary}, accent/glow ${v.palette.accent}, shadows ${v.palette.dark}. Use this palette instead of the base style's colours.`;
  }
  return `COLOURS: main colour ${style.primary}, accent/glow ${style.accent}, deep shadows ${style.dark}.`;
}
