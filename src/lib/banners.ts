import { z } from "zod";
import { cleanLogoName } from "./logo-maker";
import { Prisma } from "@prisma/client";
import { db } from "./db";
import { HttpError } from "./auth";
import { backgroundProvider, BLOCKED, buildPrompt, canRemoveBackground, generatePoster, generateBackground, removeBackground } from "./ai";
import { deleteFile, isStorageUrl, loadBytes, saveFile, sniffImage } from "./storage";
import { textSlotsFor } from "./text-slots";
import { qualTableAreaText } from "./qualifiers-box";
import { winnersAreaText, winnersGrid } from "./winners-box";
import { tableAreaText } from "./standings-box";
import { changeCredits } from "./credits";
import { BannerInputs, DEFAULT_DESIGN, EMPTY_INPUTS, LayoutKind, TemplateStyle } from "./templates";
import { bgPosePrompt, bgScenePrompt, createVariation, fontPrompt, trophyPrompt, type Variation, surprisePose } from "./pro-options";
import sharp from "sharp";
import { placeLogos, stampLogo } from "./stamp";
import { logGeneration } from "./discord";
import { FORMATION_ROWS, parseTotwLine } from "./formations";
import { getSettings } from "./settings";
import { resolveConditionals, stripSmallTeamName } from "./style-presets";

const str = (max: number) => z.string().trim().max(max).default("");

export const InputsSchema = z.object({
  name: str(40),
  team: str(40),
  position: str(24),
  number: str(4),
  tagline: str(30),
  subtitle: str(40),
  footer: str(120),
  headline: str(40),
  eventName: str(48),
  roster: z.array(z.string().trim().max(30)).max(30).default([]),
  prize: str(24),
  date: str(30),
  details: str(48),
  rule: str(30),
  ruleNote: str(60),
  entry: str(24),
  regions: z.array(z.string().trim().max(60)).max(12).default([]),
  unit: str(20),
  total: str(40),
  winners: z.array(z.string().trim().max(40)).max(40).default([]),
  winnerLogos: z.array(z.string().trim().max(500)).max(40).default([]),
  boxes: z.string().trim().regex(/^\d{0,2}$/).default(""),
  extraPrompt: str(1500),
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
  standings: z.array(z.string().trim().max(90)).max(32).default([]),
  qualify: z.string().trim().regex(/^\d{0,2}$/).default(""),
  relegate: z.string().trim().regex(/^\d{0,2}$/).default(""),
  tableLogos: z.array(z.string().trim().max(500)).max(32).default([]),
  playerPhotos: z.array(z.string().trim().max(500)).max(18).default([]),
  playerLogos: z.array(z.string().trim().max(500)).max(18).default([]),
  partnerLogos: z.array(z.string().trim().max(500)).max(4).default([]),
  partnerNames: z.array(z.string().trim().max(40)).max(4).default([]),
  refImageUrl: str(500),
  photo2Url: str(500),
  slots: z.record(z.string().max(32), z.string().max(120)).optional().default({}),
  trophy: str(60),
  bgPose: str(40),
  bgScene: str(40),
  aiCopy: z.enum(["on", "off", ""]).default("off"),
  aiLogo: z.enum(["on", "off", "exact", "both", "exact3d", ""]).default(""),
  colorMode: z.enum(["surprise", "template", "custom", "team", ""]).default(""),
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
          try {
            const out = await removeBackground(bytes, sniffImage(bytes) ?? "image/jpeg");
            return saveFile("cutouts", out, "image/png");
          } catch (e) {
            console.error("background removal failed — using the photo as-is", e);
            return opts.photoUrl!;
          }
        })();
      }
    }

    const [backgroundUrl, cutoutUrl] = await Promise.all([bgTask, cutTask]);

    const data: Prisma.BannerUpdateInput = { status: "READY", error: null, backgroundUrl };
    await (await import("./rev")).bumpRev();
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
/** Where the real (uploaded) logo is pasted on the finished poster. */
export type LogoSpot = "tl" | "tr" | "tc" | "bc" | "hero" | "left" | "right";

export interface ProRef {
  url: string;
  label: string;
  /** Exact-logo mode: not sent to the AI — pasted into this corner of the finished poster instead. */
  overlay?: LogoSpot;
  /** "3d": the pasted file gets the code-made 3D emblem treatment (extrusion, bevel, gloss, glow). */
  fx?: "3d";
}

/** Works out which reference images go to the model, in order, with instructions for each. */
export function collectProRefs(opts: {
  layout: LayoutKind;
  inputs: BannerInputs;
  photoUrl?: string | null;
  logoUrl?: string | null;
  styleRefUrl?: string | null;
  /** Team set: the first card of the set, whose design must be copied. */
  seriesRefUrl?: string | null;
  /** Team of the week: one sheet with every club crest, in this order (left to right, top to bottom, four per row). */
  crestSheet?: { url: string; order: string[] } | null;
  /** Standings with the exact table: the crests are pasted by KIXO, so they are not sent to the AI. */
  skipTableCrests?: boolean;
  /** The style's design instructions (for the [CREST SPOT …] tag of the exact-3D crest). */
  instructions?: string | null;
  /** What the crest contains (letters, symbols, arrangement, colours) — read by the vision model so the 3D remake keeps every part. */
  crestNote?: string | null;
}): ProRef[] {
  const { inputs: i, layout } = opts;
  const refs: ProRef[] = [];
  if (opts.photoUrl) {
    refs.push({
      url: opts.photoUrl,
      label:
        layout === "LINEUP" || layout === "RESULT" || layout === "MATCHDAY"
          ? "a player photo to feature as the hero image. Keep the face exactly recognisable — same person, not a lookalike."
          : "the main subject. Keep their face, hair, skin tone and body exactly recognisable — same person, not a lookalike. Keep their clothing/kit as in the photo (any badge, sponsor or words printed on it stay only on the kit, at its natural size — never reuse them anywhere else on the poster). If you recognise this person as a known footballer, IGNORE their real club: never add that club's crest, name, colours or badge — this card is for the team given in this brief only. Retouch it like a pro sports photographer: a clean full cut-out (no traces of the original background), relit to match the poster's lighting with a strong coloured rim light, sharper detail, rich contrast and a cinematic colour grade — even if the uploaded photo is a low-quality phone picture.",
    });
  }
  if (opts.photoUrl && i.photo2Url && layout === "PLAYER") {
    refs.push({
      url: i.photo2Url,
      label:
        "a SECOND photo of the SAME person, uploaded by the user — this picture IS the second figure of the player (the big portrait / background image): use it exactly as photographed — same pose, angle, expression and framing (crop it chest-up if the style asks for a portrait) — only cut out, enlarged, relit and colour-graded into the poster's style. Do NOT generate a different pose for the background figure. The first photo stays the main figure in front. Anything printed on its kit is not text for the poster.",
    });
  }
  // Crest modes: "" / "exact" (default) = the AI places the real crest faithfully, built into the design but never redrawn;
  // "on" = the AI remakes it as a 3D chrome emblem (can add details); "off" = the exact file is pasted in a corner afterwards.
  // "exact3d" = the exact file pasted afterwards WITH a code-made 3D emblem finish, at the style's crest spot (tag [CREST SPOT tl|tr|tc|bc], default top centre).
  const exact = i.aiLogo === "off" || i.aiLogo === "exact3d";
  const remake = i.aiLogo === "on" || i.aiLogo === "both";
  const spotTag = /\[CREST SPOT (tl|tr|tc|bc)\]/i.exec(opts.instructions ?? "")?.[1]?.toLowerCase() as LogoSpot | undefined;
  const crest = (url: string, who: string, corner: LogoSpot = "tl") => {
    // "both" (admin): the AI's 3D remake in the design AND the real file pasted in a corner afterwards.
    if (i.aiLogo === "both") refs.push({ url, label: `the crest/logo of ${who} (placed afterwards)`, overlay: corner });
    if (i.aiLogo === "exact3d" && (corner === "tl" || corner === "tr")) return refs.push({ url, label: `the crest/logo of ${who} (placed afterwards as a 3D emblem)`, overlay: spotTag ?? "tc", fx: "3d" });
    if (i.aiLogo === "exact3d") return refs.push({ url, label: `the crest/logo of ${who} (placed afterwards as a 3D emblem)`, overlay: corner, fx: "3d" });
    return exact
      ? refs.push({ url, label: `the crest/logo of ${who} (placed afterwards)`, overlay: corner })
      : remake
        ? refs.push({
            url,
            label: `the crest/logo of ${who} — the ONLY crest for this poster (if the shirt in the photo shows another club's badge, ignore that badge; this reference is the team). Keep its exact shape, letters, symbols and layout (do not redesign it, do not add or remove letters). ${opts.crestNote ? `IT CONTAINS: ${opts.crestNote} — EVERY one of these letters, words, symbols and parts must appear in the emblem, spelled exactly, in the same arrangement; count the letters before finishing. ` : ""}The reference shows WHAT the crest is — its letters, symbols and arrangement — NOT how it should look: do NOT copy the file's own colours, finish or flat look. REBUILD it as a BADASS premium 3D emblem that belongs to THIS poster: the SAME silhouette, extruded with real thickness and bevelled edges, made of the SAME material as the poster's main title (its chrome, gold, glass, candy, liquid metal or neon — the same finish, the same bevel style, the same extrusion depth and extrusion colours, the same reflections) in the POSTER'S colour palette, as if the same designer built the title and the crest from one material. The scene's lights reflect on it, a rim light in the poster's accent colour, a soft glow, a few of the scene's particles and some of its smoke or light beams passing in front of it, a real cast shadow — fully part of the artwork, never a flat 2D sticker, never the file pasted as it is. The emblem floats DIRECTLY on the poster: do NOT add any plate, disc, circle, shield, badge, panel, frame, ring, halo-shape, banner, ribbon or box behind or around it, no extra shapes, symbols, letters, stars or wings. Its outline is its own outline; the scene shows through everywhere around it. Make it large and prominent, lit by the same lights and casting a soft shadow. Besides this main emblem, the same crest appears ONCE more as a giant faded GHOST ECHO blended into the background (about 10–25% opacity, tinted into the scene's colours, partly behind the title and the figure) — no other copies. If the logo image has a solid background square, ignore that square and use only the emblem itself.`,
          })
        : refs.push({
            url,
            label: `the crest/logo of ${who} — the ONLY crest for this poster (if the shirt in the photo shows another club's badge, ignore that badge; this reference is the team). Copy it EXACTLY as it is: the identical outline, shapes, letters, symbols, proportions and colours — as if the real crest file were placed into the design and lit by the scene (a soft cast shadow, a subtle sheen or a slight thickness at most). Do NOT redesign it in any way: no added shield, badge, circle, ring, rim, frame, banner, ribbon, laurel, stars, wings or sparks inside it, no extra words or letters, no recolouring, no 3D remake, nothing removed. If the logo image has a solid background square, ignore that square and use only the emblem itself. Place it large and prominent where this style puts the crest, built into the layout (not a pasted sticker); it may also appear huge and ghosted in the background — still the exact artwork.`,
          });
  };
  if (layout === "LOGO") {
    if (opts.logoUrl)
      refs.push({
        url: opts.logoUrl,
        label: "the team's LOGO — the HERO of this poster. Reproduce it EXACTLY: same shapes, symbols, letters and colours (do not redesign, add or remove anything). You may render it as a premium physical 3D emblem (real metal / enamel, bevels, reflections, rim light) built into the scene. If the logo image has a solid background square, ignore the square.",
      });
  } else if (layout === "TOTW") {
    // One photo per card: the person goes inside their own card.
    i.players.forEach((line, n) => {
      const url = i.playerPhotos?.[n];
      if (!url || n >= 11) return;
      const { name, pos } = parseTotwLine(line);
      refs.push({ url, label: `the player for the card of ${q(name)}${pos ? ` (${pos})` : ""}: this exact person goes inside THAT card — same face, hair, skin tone and build (recognisable, not a lookalike), cut out cleanly from the photo's background, chest-up or full body, relit to match the card's lighting with a rim light. Any badge, sponsor or words on their clothes stay on the clothes only.` });
    });
    if (opts.crestSheet)
      refs.push({
        url: opts.crestSheet.url,
        label: `a SHEET of club crests on a dark grid, four per row, read left to right then top to bottom: ${opts.crestSheet.order.map((n, k) => `crest ${k + 1} = ${q(n)}`).join(", ")}. On every card whose sub line names one of these clubs, show THAT club's crest SMALL — a glossy badge beside the gamertag plate — faithful to its shape, symbols and colours. Copy nothing else from the sheet (not the dark grid).`,
      });
  } else if (layout === "STANDINGS" && opts.crestSheet && !opts.skipTableCrests) {
    // All the table's crests on ONE sheet, so the only standalone emblem image the AI gets is the league logo.
    refs.push({
      url: opts.crestSheet.url,
      label: `a SHEET of the TEAM crests for the table rows (dark grid, read left to right then top to bottom): ${opts.crestSheet.order.map((n, k) => `crest ${k + 1} = ${n}`).join(", ")}. Each crest appears ONLY tiny inside its own table row(s), left of the team name, faithful to the sheet — NEVER beside the title, never big, never as a background watermark or giant faded echo, and NEVER as the league / organization logo (that is reference image 1). Do not draw the sheet itself.`,
    });
  } else if (layout === "STANDINGS") {
    // One reference per distinct crest (two teams can share one), each naming every row it belongs to.
    const byUrl = new Map<string, string[]>();
    i.standings.forEach((row, n) => {
      const url = i.tableLogos?.[n];
      if (!url || n >= 10 || opts.skipTableCrests) return;
      byUrl.set(url, [...(byUrl.get(url) ?? []), `row ${n + 1} (${row.split(/\s+·\s+|\s+[—-]\s+|\s+P\s/)[0]})`]);
    });
    for (const [url, rows] of byUrl) refs.push({ url, label: `the crest of the TEAM in table ${rows.join(" and ")}. Show it SMALL next to that team's name in its row ONLY — never enlarged, never beside the title, never as a background watermark and never as the league / organization logo.` });
  } else if (layout === "WINNERS") {
    // KIXO places the real crests in the frames itself; the AI only gets them when it draws the wall (setting off).
    if (!opts.skipTableCrests)
      (i.winners ?? []).forEach((name, n) => {
        const url = i.winnerLogos?.[n];
        if (!url || !name.trim() || n >= 8) return;
        refs.push({ url, label: `the crest of ${q(name.trim())} — the winner in frame ${n + 1}. Show it inside THAT frame only, centred above the name plate, faithful to the image (same shape, letters, symbols and colours) — never enlarged elsewhere, never as the league logo.` });
      });
  } else if (layout === "MATCHDAY" || layout === "RESULT") {
    if (i.homeLogoUrl) crest(i.homeLogoUrl, "the home team", "left");
    if (i.awayLogoUrl) crest(i.awayLogoUrl, "the away team", "right");
  } else if (opts.logoUrl) {
    crest(opts.logoUrl, "the team", layout === "CHAMPIONS" ? "hero" : "tl");
    // Exact mode: the sharp logo is pasted on top, but the AI also gets it for a giant faded echo behind everything.
    if (exact && (layout === "CHAMPIONS" || layout === "PLAYER" || layout === "LINEUP") && !/\[NO ECHO\]/.test(opts.instructions ?? "")) {
      refs.push({
        url: opts.logoUrl,
        label:
          "the team crest — use it ONLY as one GIANT, faint, ghosted background element: about 90–110% of the poster width, centred behind everything (behind the title, trophy and figures), at roughly 10–15% opacity, blended into the light and atmosphere like a watermark carved in light. Do not draw it anywhere else, at normal opacity, or in the foreground (the real crest is added on top afterwards).",
      });
    }
  }
  if (i.champLogoUrl) {
    const champRef = {
      url: i.champLogoUrl,
      label:
        layout === "CHAMPIONS"
          ? "the competition/championship logo. Put it ONLY on the trophy — engraved or embossed on the front of the cup, reproduced faithfully. Do not show it anywhere else and never as a big logo on the poster."
          : layout === "STANDINGS"
            ? "the LEAGUE / ORGANIZATION logo — THIS image, reference image 1, and no other (the team crests that follow are NOT it) — it MUST appear, in TWO places: (1) crisp and clearly visible beside the title, about 14% of the poster width, as a glossy premium 3D emblem faithful to the reference (same shape, letters, symbols and colours — never redesigned); (2) echoed GIANT behind the table — about 90% of the poster width, centred — faded to roughly 20–25% opacity so it clearly reads through the table rows, blended into the light like a watermark carved in light. If the logo image has a solid background square, ignore the square."
          : layout === "TOTW"
            ? "the league / competition logo. Reproduce it faithfully (same shape, letters, symbols and colours — do not redesign it) as a clean glossy badge next to the title, at a size that reads clearly — never covering the cards. If the logo image has a solid background square, ignore the square."
          : layout === "WINNERS"
            ? "the LEAGUE / ORGANIZATION logo — THIS image and no other. Keep its exact shape, letters, symbols and colours (do not redesign it) and show it as a glossy premium 3D emblem with a polished rim at the LOWER RIGHT corner, beside the bottom title, about 12% of the poster width; it may also appear once more giant and faded behind everything. Never inside the grid of frames."
          : layout === "EVENT" || layout === "QUALIFIERS"
            ? "the league / event logo (the organiser of this tournament). Keep its exact shape, letters, symbols and colours — do not redesign it — and make it a HERO element: a large glossy premium 3D emblem with a polished rim, depth, reflections and a coloured glow, placed prominently near the top centre (if there is a trophy, it can sit just above it or be engraved on it as well), lit by the scene's lights with particles around it — never a flat sticker in a corner. Build the poster's colour palette from this logo's colours (unless the user picked colours). If the logo has a solid background square, ignore the square and use only the emblem."
            : "the competition/championship logo. Place it as a smaller badge; reproduce it faithfully as a glossy 3D badge.",
    };
    // Standings / team of the week: the league logo is reference image 1 — the first thing the model sees — so a team crest never takes its place.
    if (layout === "STANDINGS" || layout === "TOTW") refs.unshift(champRef);
    else refs.push(champRef);
  }
  if (i.trophyUrl) {
    refs.push({ url: i.trophyUrl, label: "the trophy. Reproduce this exact trophy design, large and shiny, as the centrepiece." });
  }
  if (layout === "EVENT") {
    const partners = (i.partnerLogos ?? []).filter(Boolean).slice(0, 4);
    partners.forEach((url, n) => {
      const name = (i.partnerNames ?? [])[n] || `collaborator ${n + 1}`;
      refs.push({
        url,
        label: `the logo of a COLLABORATOR / co-organizer of this event (${q(name)}). Reproduce it faithfully (same shape, letters, symbols and colours — never redesigned) as a clean glossy badge in the ROW OF PARTNER LOGOS: all ${partners.length} collaborator logo${partners.length > 1 ? "s" : ""} the same height, evenly spaced on one line (${i.champLogoUrl ? "below or beside the main organizer logo, smaller than it" : "near the bottom or beside the title"}), under a tiny letter-spaced label. If the logo image has a solid background square, ignore the square.`,
      });
    });
  }
  if (i.refImageUrl) {
    refs.push({
      url: i.refImageUrl,
      label:
        "an INSPIRATION image from the user — a STYLE reference only. Match its overall look: composition and layering, lighting, colour grading, textures, effects, materials and typography feel, while keeping this poster's own layout rules and every listed element. Do NOT copy its people, faces, names, text, numbers, logos, badges, stickers or watermarks — none of them belong on this poster.",
    });
  }
  if (opts.seriesRefUrl) {
    refs.push({
      url: opts.seriesRefUrl,
      label:
        "the FIRST CARD of this team set. Recreate THIS EXACT DESIGN as the next card in the same series: same layout and element positions, same background scene, colours, lighting, effects, typography styles, crest treatment and extra words (if a crest sits in a top corner of that card, leave that corner empty — the real crest is added afterwards; do not redraw it). Only the player changes: use the person from the new player photo (never the person in this card) and the new player's name, number and position.",
    });
  } else if (opts.styleRefUrl) {
    refs.push({
      url: opts.styleRefUrl,
      // [EXACT REF] styles copy their reference poster as it is — only the player, the texts and the crest are swapped.
      label: /\[EXACT REF\]/.test(opts.instructions ?? "")
        ? "a STYLE reference only — the finished poster this style copies. Recreate its DESIGN exactly: the same layout with every element in the same place and at the same size, the same background scene, colours, lighting, effects, lettering styles and crest treatment (see STYLE REFERENCE in the art director's instructions). Its person, words, digits and emblem are placeholders: do NOT copy its people, faces, names, text, logos, badges, stickers or watermarks — the uploaded player, the given texts and the given crest take their places."
        : "a STYLE reference only. Match its overall look: composition and layering, lighting, colour grading, textures, effects and typography feel. Do NOT copy its people, faces, names, text, logos, badges, stickers or watermarks.",
    });
  }
  return refs;
}

/**
 * Event flyers: a strong layout chosen per poster (so they don't all look the same), an athlete hero,
 * and the quality bar of a top tournament design studio.
 */
/** A different title typography for every Champions poster. */
const CHAMP_TITLE_TYPES = [
  "massive condensed block capitals forged in dark scratched gold, sharp chiselled bevels, molten edges glowing at the cracks, heavy hard shadow",
  "aggressive wide italic sports capitals in polished chrome with razor-sharp edges, a team-colour glow inside the bevel and speed streaks tearing off the back",
  "brutal gothic / blackletter capitals in blackened steel with gold edges, engraved and battle-worn, like a heavy-metal album title",
  "cracked stone monument capitals splitting apart, molten team-colour light and sparks bursting out of the cracks",
  "huge hand-painted brush script in thick gold paint with explosive dry-brush strokes and splatter, slanted upward, aggressive and alive",
  "angular futuristic capitals with cut corners in gunmetal and carbon fibre, glowing team-colour circuit lines, sharp and lethal",
  "tall razor serif capitals in polished silver with gold rims and engraving, regal and powerful, like a championship monument",
  "heavy stencil / military capitals in war-torn gold over black armour plate, bullet-chipped and scorched",
  "gigantic chunky 3D capitals in deep team-colour enamel with thick gold outlines and a long hard extrusion, glossy and punchy",
  "ultra-bold grunge capitals ripped and torn like a street poster, white and team colour, halftone and spray-paint drips",
  "jagged flaming capitals in burnt gold, fire licking off the top edges, embers peeling away",
  "electric capitals made of brushed steel with lightning crackling across the letters and sparks jumping between them",
];
/** A different epic scene for every Champions poster. */
const CHAMP_SCENES = [
  "INFERNO: the trophy rises out of a sea of fire — walls of flames on both sides, molten cracks glowing in the ground under the pedestal, embers and ash swirling up, heat haze bending the light",
  "THUNDERSTRIKE: a violent storm over the stadium — giant lightning bolts striking behind the trophy, electric arcs crackling across the metal, rain lashing through the floodlights, the ground shattered where the lightning hit",
  "SHATTERED: the scene explodes outward — glass and stone shards frozen mid-air around the trophy, a shock-wave ring of dust and light, cracked ground, sparks flying",
  "ULTRAS WAR: the stands are on fire with coloured flares in the team colours — thick pyro smoke rolling over the pitch, giant waving flags and banners as silhouettes, a wall of red-hot light behind the trophy",
  "GLADIATOR: an ancient arena reborn — the trophy on a cracked stone altar, colossal broken stone columns and arches in the smoke, braziers burning, dust in god-rays, epic and brutal",
  "MOLTEN GOLD: rivers of liquid gold and lava flowing around the pedestal, gold splashes frozen in the air, sparks raining down, steam and smoke, the light glowing up from below",
  "SPOTLIGHT WAR: dozens of stadium spotlights cutting razor-sharp beams through thick haze, crossing behind the trophy like swords, gold pyro fountains erupting in a row, confetti cannons blasting",
  "DARK THRONE: the trophy on a throne-like black stone pedestal with chains and a crown of fire behind it, black smoke, red embers, menacing royal power",
  "FROZEN STORM: an ice storm — jagged ice crystals erupting from the ground around the pedestal, frost smoke, blizzard snow in the beams, cold blue rim light against warm gold",
  "BEAST MODE: the team colours explode as raw energy — a shock-wave of coloured smoke and light bursting behind the trophy, sparks spraying sideways, debris, motion streaks, like a giant impact",
];
/** Victory Night keeps its look but gets a different background every time. */
const VICTORY_BGS = [
  "the classic: smoke-filled dark stadium, one hard spotlight from above",
  "a rainstorm: heavy rain lit by the floodlights, streaks in the beams, puddles mirroring the trophy",
  "fireworks: gold and team-colour fireworks bursting high over the dark stadium roof, smoke drifting",
  "ultras: red and team-colour flares burning in the dark stands, thick pyro smoke rolling over the pitch",
  "snow night: heavy snowfall glowing in the spotlight, frost on the grass, cold breath of haze",
  "the tunnel: the trophy at the mouth of the players' tunnel, blinding pitch light behind, concrete walls in shadow",
  "cathedral of light: dozens of thin white searchlight beams fanning up into the night sky behind the trophy",
  "storm sky: an open stadium under a dark storm sky with distant lightning flashing behind the stands",
  "confetti cannon: a single explosive burst of gold ticker-tape frozen mid-air in the spotlight beam, the rest of the stadium black",
  "empty stadium: rows of empty seats fading into darkness, a few floodlights on, dust floating in the beam — lonely and powerful",
];
const victoryBg = () => VICTORY_BGS[Math.floor(Math.random() * VICTORY_BGS.length)];
const champScene = () => CHAMP_SCENES[Math.floor(Math.random() * CHAMP_SCENES.length)];
const champTitleType = () => CHAMP_TITLE_TYPES[Math.floor(Math.random() * CHAMP_TITLE_TYPES.length)];

function eventDirection(seed: number, fixedLayout: boolean, hasPhoto: boolean, hasLogo: boolean) {
  // No invented people: only the uploaded photo's person may appear.
  const person = hasPhoto ? " The person from the uploaded photo appears once, cut out and rim-lit, to one side of the centrepiece." : " NO people, players, athletes, faces or silhouettes anywhere on the poster.";
  const logo = hasLogo ? "the provided league/team logo as a big glossy 3D emblem" : "a large glossy 3D trophy";
  const layouts = [
    `EMBLEM HERO: ${logo} big in the upper half, floating, with a polished metal rim, deep reflections and a glowing energy ring behind it; light beams fanning out behind; the headline as a massive 3D word across the middle, slightly overlapping the bottom of the emblem; the prize huge and glossy below; the date on a sleek ribbon at the bottom.${person}`,
    `SHATTER BURST: ${logo} in the centre breaking through a wall of shattering glass/crystal, shards flying toward the camera, an energy shockwave ring around it; the headline angled across the lower third with shards passing in front of the letters; the prize below; the date on an angled light bar.${person}`,
    `PEDESTAL: ${logo} standing on a tall dark glossy pedestal in the centre, hit by vertical spotlights and smoke rolling around the base; the headline arcing over the bottom of the pedestal; the prize engraved as a heavy gold 3D plate on the pedestal front; the date at the very bottom.${person}`,
    `MONUMENT: ${logo} turned into a HUGE sculpture filling the upper half, like colossal metal art standing in the stadium, smoke and sparks at its base; the headline as a massive 3D word across the middle overlapping the sculpture's base; the prize glowing below; the date on a ribbon.${person}`,
  ];
  const typeLooks = [
    "headline in thick brushed-chrome 3D letters with a coloured bevel and a hard drop shadow",
    "headline in heavy italic sports letters with a gold edge, inner gradient and motion streaks",
    "headline in condensed letters made of glowing neon tubes inside a dark metal casing",
    "headline in cracked stone / concrete 3D letters with fire or energy glowing through the cracks",
  ];
  const n = Math.abs(seed);
  if (fixedLayout)
    return `QUALITY BAR: like a flyer from a top esports / tournament design studio — follow the art director's FIXED LAYOUT exactly. Real lighting and materials, deep layering, rich textures, a cinematic colour grade, and NO big empty areas. Every text item is written completely — never cut, cropped or abbreviated.${hasPhoto ? "" : " NO people, players, faces or silhouettes."}`;
  return [
    `EVENT FLYER — LAYOUT FOR THIS POSTER (follow it unless the art director's instructions above define a different layout): ${layouts[n % layouts.length]}`,
    `TYPOGRAPHY LOOK: ${typeLooks[(n >> 2) % typeLooks.length]}; the event title in a contrasting cleaner style, the accent line in a hand-written brush script, the prize as a premium 3D element. All texts form ONE designed lock-up that interacts with the centrepiece (overlapping, angled, mixed sizes) — never a plain stack of centred lines.`,
    `QUALITY BAR: like a flyer from a top esports / tournament design studio. Real photographic lighting and materials, deep layering (environment → giant faded echo of the headline or logo → centrepiece → lettering → foreground sparks, smoke and debris crossing over the letters), a cinematic colour grade, and NO big empty dark areas. The date/time sits on a sleek integrated ribbon or light bar that belongs to the scene (not a flat app-style box). Every text item is written completely — never cut, cropped or abbreviated.`,
  ].join("\n");
}

/** Flag emojis the regions rows may start with → what to draw. */
const FLAGS: Record<string, string> = {
  "🇪🇺": "the European Union flag", "🇺🇸": "the USA flag", "🇲🇽": "the Mexico flag", "🇧🇷": "the Brazil flag", "🇦🇷": "the Argentina flag", "🇨🇴": "the Colombia flag", "🇨🇱": "the Chile flag", "🇵🇪": "the Peru flag",
  "🇪🇸": "the Spain flag", "🇫🇷": "the France flag", "🇩🇪": "the Germany flag", "🇮🇹": "the Italy flag", "🇵🇹": "the Portugal flag", "🇬🇧": "the UK flag", "🏴󠁧󠁢󠁥󠁮󠁧󠁿": "the England flag", "🇳🇱": "the Netherlands flag",
  "🇿🇦": "the South Africa flag", "🇳🇬": "the Nigeria flag", "🇪🇬": "the Egypt flag", "🇲🇦": "the Morocco flag", "🇸🇦": "the Saudi Arabia flag", "🇯🇵": "the Japan flag", "🇰🇷": "the South Korea flag", "🇨🇳": "the China flag",
  "🇮🇳": "the India flag", "🇦🇺": "the Australia flag", "🇳🇿": "the New Zealand flag", "🇨🇦": "the Canada flag", "🇩🇴": "the Dominican Republic flag", "🇻🇪": "the Venezuela flag", "🇺🇾": "the Uruguay flag", "🇪🇨": "the Ecuador flag",
  "🇭🇳": "the Honduras flag", "🇬🇹": "the Guatemala flag", "🇸🇻": "the El Salvador flag", "🇨🇷": "the Costa Rica flag", "🇵🇦": "the Panama flag", "🇨🇺": "the Cuba flag", "🇵🇷": "the Puerto Rico flag", "🇹🇷": "the Türkiye flag",
  "🌍": "a globe showing Africa and Europe", "🌎": "a globe showing the Americas", "🌏": "a globe showing Asia and Oceania", "🌐": "a globe icon", "🏆": "a small trophy icon", "⚽": "a small football icon",
};
const EMOJI_RE = /^(?:\p{Regional_Indicator}{2}|[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}](?:\uFE0F)?(?:[\u{E0020}-\u{E007F}]+)?)/u;

/** "🇪🇺 Europe · 24" → { icon: "the European Union flag", name: "Europe", count: "24" }. */
export function parseRegionRow(line: string): { icon: string; name: string; count: string } {
  let s = line.trim();
  let icon = "";
  const m = EMOJI_RE.exec(s);
  if (m) {
    icon = FLAGS[m[0]] ?? "a small flag";
    s = s.slice(m[0].length).trim();
  }
  const parts = s.split(/\s*[·|:\-–—]\s*|\s{2,}/).map((x) => x.trim()).filter(Boolean);
  let name = s, count = "";
  if (parts.length >= 2 && /^[\d.,]+\+?$/.test(parts[parts.length - 1])) {
    count = parts[parts.length - 1];
    name = parts.slice(0, -1).join(" ");
  } else {
    const t = s.match(/^(.*?)[\s·:]+([\d.,]+\+?)$/);
    if (t) {
      name = t[1].trim();
      count = t[2];
    }
  }
  return { icon, name, count };
}

/** Qualifiers posters: where the table, the trophy and the emblem sit — a different arrangement per poster. */
function qualifiersDirection(seed: number, fixedLayout: boolean, hasPhoto: boolean, hasLogo: boolean, exactArea?: string) {
  const person = hasPhoto ? " The person from the uploaded photo appears once, cut out and rim-lit, beside the centrepiece." : " NO people, players, athletes, faces, hands, crowds or silhouettes anywhere — the stands far behind are only lights and bokeh.";
  const emblem = hasLogo ? "the league logo as a BIG glossy 3D emblem (reference image), with a crown or laurel accent" : "a big glossy 3D laurel-and-crown emblem (no words on it)";
  const layouts = [
    `PODIUM & PANEL: the headline huge across the top; ${emblem} at the upper left; a giant trophy on a round podium at the lower left with a football beside it; the REGIONS TABLE as a tall framed panel on the RIGHT half (top ~30% to ~72%), the TOTAL bar at its foot; the footer line along the bottom.`,
    `CENTRE STAGE: the headline huge across the top; the giant trophy dead centre on a lit podium with ${emblem} floating above it; the REGIONS TABLE as a wide framed panel across the LOWER third (two columns of rows if more than six), the TOTAL bar under it; the footer along the bottom.`,
    `SPLIT: ${emblem} big at the upper centre under the headline; the REGIONS TABLE as a tall panel on the LEFT half; the giant trophy on the RIGHT half standing on a podium with light rays behind, slightly cropped by the edge; the TOTAL bar under the panel; the footer along the bottom.`,
  ];
  const n = Math.abs(seed);
  if (exactArea) {
    // KIXO draws the table afterwards: one arrangement (table at the right), and that area stays empty.
    const empty = `TABLE AREA — LEAVE IT EMPTY: ${exactArea}. Draw NOTHING inside that area: no panel, no frame, no rows, no names, no numbers, no flags, no text — only the background scene continuing through it, slightly darker and calmer, so the table KIXO places there afterwards sits on it. The headline stays at the top, the league emblem at the upper left, the trophy on its podium at the lower left — all outside that area.`;
    if (fixedLayout) return `QUALITY BAR: like the official graphic of a top competition's media team — follow the art director's FIXED LAYOUT, except the table: ${empty}${person}`;
    return [
      `QUALIFIERS POSTER — LAYOUT FOR THIS POSTER: the headline huge across the top; ${emblem} at the upper left under it; a giant trophy on a round lit podium at the lower left with a football beside it and laurels at its base, light rays behind; the footer line along the bottom. ${empty}`,
      `BACKDROP: a faint world map or globe lines etched into the background behind everything (no country names), stadium floodlights and a packed-stand bokeh far behind, light beams, particles, smoke at the floor, dark silk or banners in the poster's colours at the bottom corners.${person}`,
      `QUALITY BAR: like a flyer from a top esports / tournament design studio. Real photographic lighting and materials, deep layering (environment → faint map → centrepiece → lettering → foreground particles), rich textures, a cinematic colour grade — never flat.`,
    ].join("\n");
  }
  const table = `THE REGIONS TABLE is a DESIGNED panel in the poster's materials (a bevelled metal / glass frame with a glowing inner edge, a darker translucent body, a header bar, thin divider lines): one row per region in the given order — a small glossy FLAG or globe icon at the left, the region name in clean capitals, the NUMBER big and bold at the right in the accent metal; the header bar has the two small labels; the TOTAL bar is a wider plate in the accent metal under the last row. Numbers and names spelled EXACTLY as given — nothing added, no extra rows.`;
  if (fixedLayout) return `QUALITY BAR: like the official graphic of a top competition's media team — follow the art director's FIXED LAYOUT exactly. ${table}${person}`;
  return [
    `QUALIFIERS POSTER — LAYOUT FOR THIS POSTER (follow it unless the art director's instructions above define a different layout): ${layouts[n % layouts.length]}`,
    table,
    `BACKDROP: a faint world map or globe lines etched into the background behind everything (no country names), stadium floodlights and a packed-stand bokeh far behind, light beams, particles, smoke at the floor, dark silk or banners in the poster's colours at the bottom corners.${person}`,
    `QUALITY BAR: like a flyer from a top esports / tournament design studio. Real photographic lighting and materials, deep layering (environment → faint map → centrepiece → lettering → table panel → foreground particles), rich textures, a cinematic colour grade — never flat, never plain text on a gradient.`,
  ].join("\n");
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
  /** Team set card: copy the first card's design instead of a new random direction. */
  series?: boolean;
  /** Holiday/season theme text (from lib/seasons) — added on top of the style. */
  season?: string;
  /** Output format chosen by the user: post 4:5 (default), story 9:16, banner 16:9. */
  format?: "post" | "story" | "banner" | "square";
  /** Team of the week: the player-card style the WHOLE poster takes — background, title and cards (from lib/totw cardLookFor). */
  cardLook?: { name: string; text: string; colours?: { primary: string; accent: string; dark: string } } | null;
  /** Standings: KIXO draws the table afterwards — the AI leaves the table area empty. */
  exactTable?: boolean;
  /** Style slug — flyer styles have their own text slots (lib/text-slots). */
  slug?: string | null;
  /** The admin's box settings for this style (Template.textSlots JSON). */
  textSlotsJson?: string | null;
  /** What the crest contains (see collectProRefs.crestNote). */
  crestNote?: string | null;
  /** The colours of the style's reference image (lib/ref-palette), when the user kept the style's own colours. */
  refColours?: string | null;
}) {
  // Older saved styles may still carry a "team name small and letter-spaced" line — the owner wants none on any poster.
  const hasPhoto = opts.refs.some((r) => r.label.startsWith("the main subject"));
  const matchPhoto = opts.refs.some((r) => r.label.startsWith("a player photo"));
  if (opts.instructions) opts = { ...opts, instructions: resolveConditionals(stripSmallTeamName(opts.instructions), { photo: hasPhoto }) };
  // A style copied from another one can still say "gold" in its text while its own reference is red (or silver):
  // the text would win and the poster turns gold. When the user keeps the style's own colours, gold words in the
  // text follow the reference instead.
  if (opts.instructions && opts.refColours && (!opts.inputs.colorMode || opts.inputs.colorMode === "template") && !/gold|yellow/i.test(opts.refColours)) {
    const main = /The main colour is ([^.]+)\./.exec(opts.refColours)?.[1]?.replace(/^(deep|light) /, "").split(" / ")[0] ?? "silver";
    opts = { ...opts, instructions: opts.instructions.replace(/\b(rose[- ])?gold(en)?\b|\bdorad[oa]s?\b|\boro\b/gi, (_m, rose) => (rose ? `${main}` : main)) };
  }
  const { inputs: raw, style, layout } = opts;
  // The team name is typed to save the team (and its crest) — it is NOT a caption for the poster.
  // Player cards never print it: the crest shows the team, and any giant background lettering spells the
  // player's name / gamertag. Other layouts (lineups, champions…) use it as a title element — unless a crest
  // is given and the style's design doesn't mention it. It is never a small letter-spaced line.
  const hasTeamLogo = opts.refs.some((r) => r.label.startsWith("the crest/logo of the team"));
  const styleUsesTeamName = /team name|team's name|nombre del equipo/i.test(opts.instructions ?? "");
  const teamNameInDesign = layout !== "PLAYER" && (hasTeamLogo ? styleUsesTeamName : true);
  const overlays = opts.refs.filter((r) => r.overlay);
  // "both": the pasted file sits in a corner while the AI still draws its 3D crest in the design.
  const exactLogos = overlays.length > 0 && raw.aiLogo !== "both";
  const aiRefs = opts.refs.filter((r) => !r.overlay);
  const i: BannerInputs = {
    ...raw,
    team: teamNameInDesign ? raw.team : "",
    homeTeam: raw.homeLogoUrl ? "" : raw.homeTeam,
    awayTeam: raw.awayLogoUrl ? "" : raw.awayTeam,
    eventName: raw.champLogoUrl ? "" : raw.eventName,
    // Standings: the organization's name stays as a line next to its logo; elsewhere the logo carries the name.
    competition: raw.champLogoUrl && layout !== "STANDINGS" ? "" : raw.competition,
  };
  const randomize = opts.randomize !== false;
  // Colours: "" = automatic — the team crest's colours when the AI can see the crest, otherwise a fresh palette.
  const crestVisible = aiRefs.some((r) => /crest/i.test(r.label));
  if (!i.colorMode) i.colorMode = crestVisible ? "team" : "surprise";
  if (i.colorMode === "team" && !crestVisible) i.colorMode = "surprise";
  // With randomize off, "unique colours" falls back to the style's own palette.
  const v = opts.variation ?? createVariation(randomize ? i.colorMode : i.colorMode === "custom" ? "custom" : "template");
  const allText = [
    i.name, i.team, i.position, i.tagline, i.subtitle, i.footer, i.headline, i.eventName, i.prize, i.date, i.details, i.rule, i.ruleNote, i.entry,
    i.extraPrompt, i.homeTeam, i.awayTeam, i.competition, i.venue, i.unit, i.total, ...i.regions, ...(i.winners ?? []), ...i.roster, ...i.players, ...i.scorers, ...Object.values(i.slots ?? {}),
  ].join(" ");
  const hit = allText.match(BLOCKED);
  if (hit) throw Object.assign(new HttpError(400, "err_blocked"), { detail: `Word filter matched "${hit[0]}"` });

  const lines: string[] = [];
  // Every plain text item (for the final "nothing else on the poster" check). Structured lists (lineups, tables) are not counted.
  const inventory: string[] = [];
  const add = (label: string, v: string) => {
    if (!v) return;
    lines.push(`- ${label}: ${q(v)}`);
    inventory.push(v);
  };
  const flyerSlots = textSlotsFor(opts.slug, opts.textSlotsJson);
  const finish = `BACKGROUND & FINISH (must be epic, never simple): build at least three layers of depth — 1) a detailed, dramatic environment far behind (stadium, sky, architecture or a themed scene, with bokeh and atmosphere), 2) big bold graphic energy in the middle (light beams, lightning, smoke, shattered shards, flowing liquid metal or fire — matching the theme), 3) sharp foreground particles and debris flying toward the camera. Dense layered effects (light streaks, sparks, embers, glitter dust, lens flares, fine grain, haze) and a rich, contrasty cinematic colour grade. A plain gradient, flat colour, soft blur or simple texture is NOT acceptable.`;
  const frame = `FULL-BLEED: the artwork runs edge to edge — no border, no frame lines, no corner marks, no crop marks, no decorative lines along the edges.`;

  let composition: string;
  switch (layout) {
    case "CHAMPIONS": {
      const trophy = i.trophyUrl ? "the provided trophy" : trophyPrompt(i.trophy) || "a large shiny trophy";
      const title = i.headline || "CHAMPIONS";
      const crestHero = exactLogos
        ? "the glowing focal spot in the lower centre for the team crest (added afterwards — draw no crest)"
        : hasTeamLogo
          ? "the TEAM CREST as the hero: a huge, flawless 3D chrome-and-enamel emblem faithful to the reference (same shape, letters and symbols), with deep bevels, reflections and a powerful glow"
          : "the team name as a huge 3D metallic emblem";
      // Four distinct layouts so champions posters don't all look like one template (stable per variation).
      const champLayouts = [
        `LAYOUT — "Crest on top": ${crestHero} large in the centre, the "${title}" title in massive 3D letters across the top, ${trophy} standing beside the crest on a reflective stage, light beams crossing behind.`,
        `LAYOUT — "Trophy hero": ${trophy} huge in the centre foreground with light exploding behind it, ${exactLogos ? "the glowing crest spot just above the trophy (crest added afterwards — draw none)" : hasTeamLogo ? "the team crest as a big glowing 3D chrome emblem floating above/behind the trophy, faithful to the reference" : "the team name glowing above the trophy"}, the "${title}" title stacked in giant letters behind, partly hidden by the trophy.`,
        `LAYOUT — "Big title": the "${title}" title enormous and slightly angled across the middle of the poster with sparks bursting through the letters, ${crestHero} above it, ${trophy} at the bottom in front of the title.`,
        `LAYOUT — "Diagonal energy": a dynamic diagonal composition — ${crestHero} upper-left, ${trophy} lower-right, the "${title}" title running diagonally between them with motion streaks, light trails and shards of light along the diagonal.`,
      ];
      // Exact-logo mode pastes the crest in the lower centre, so it needs the matching layout.
      const champHero = hasPhoto
        ? `LAYOUT — "Champion hero" (like a KIXO player card): the PLAYER from the photo is the hero, big in the centre (about 45% of the frame, full body or three-quarter, face exactly recognisable), celebrating the title — ${trophy} lifted high above the head or held to the chest, roaring with pride — rim-lit and razor sharp; behind them a giant calm, intense portrait of the SAME person, faded into the smoke as a background echo; the "${title}" title in massive 3D letters ${exactLogos ? "across the top" : "behind and above the player, partly hidden by them"}; ${exactLogos ? "the glowing focal spot in the lower centre for the team crest (added afterwards — draw no crest)" : hasTeamLogo ? "the team crest as a crisp 3D chrome emblem beside the player, faithful to the reference" : "the team name in big metallic letters"}.`
        : "";
      const pickLayout = champHero
        ? champHero
        : exactLogos
        ? `LAYOUT: the "${title}" title in massive 3D letters across the top, ${crestHero}, ${trophy} on the right side on a reflective stage, light beams crossing behind.`
        : champLayouts[Math.abs(v.seed) % champLayouts.length];
      composition = [
        `A premium champions title-celebration poster — the kind a top club's media team posts after winning a trophy.`,
        pickLayout,
        `Also: ${hasTeamLogo || exactLogos ? "no team name text" : "the team name in big metallic letters"}${(i.roster.length || i.players.length) ? ", the squad list in clean aligned columns along the bottom" : ""}${i.prize ? ", a gold prize badge" : ""}, confetti, sparks and spotlight beams. ${!(i.roster.length || i.players.length) ? "NO player names or squad list anywhere. " : ""}${!i.prize ? "NO prize, money amount or prize badge. " : ""}`,
        frame,
        finish,
      ].join(" ");
      add("Title (huge)", i.headline || "CHAMPIONS");
      add("Small line above the title (competition)", i.eventName || i.competition);
      add("Team name (large)", i.team);
      const squad = (i.roster.length ? i.roster : i.players).filter(Boolean);
      if (squad.length && /\[SQUAD LABEL\]/.test(opts.instructions ?? ""))
        add("Small letter-spaced label right above the squad list", i.language === "Español" ? "JUGADORES QUE PARTICIPARON" : i.language === "Português" ? "JOGADORES QUE PARTICIPARAM" : "PLAYERS WHO PARTICIPATED");
      if (squad.length)
        lines.push(
          `- Squad list — exactly these ${squad.length} names (the commas only separate them, never draw commas or bars): ${q(squad.join(", "))} — near the bottom, styled EXACTLY as the art direction's squad design describes (if it describes none: a premium condensed sans-serif, uniform size, ${squad.length > 6 ? "in 2–3 aligned columns" : "in one centred row"}); no "|" bars unless the art direction asks for them`,
        );
      add("Date", i.date);
      add("Prize badge (gold)", i.prize);
      break;
    }
    case "MATCHDAY":
      composition = [
        `A match-day announcement poster for a pro-clubs / football match.`,
        `${exactLogos ? `A bold "VS" in the centre between two glowing spots for the crests (do not draw any crests — the two official crests are added afterwards)` : `The two team crests big and glossy facing each other with a bold "VS" between them`} (or the hero player in front if a player photo is given), a huge "${i.headline || "MATCH DAY"}" title, ${i.competition ? "the competition name, " : ""}${[i.date, i.time, i.venue].some(Boolean) ? "and the listed date/time/venue as designed 3D lettering with glow and thin dividers (no boxes, panels or icons)" : "no info block"}.`,
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
        `A stylised football pitch seen from above${i.formation ? ` with the players arranged in a ${i.formation} formation` : ""}: each player shown as a clean badge/marker with their shirt number and name, goalkeeper at the bottom, attackers at the top. ${exactLogos ? "No crest drawn (the official crest is added afterwards)," : "The team crest large and glossy,"} a huge "${i.headline || "STARTING XI"}" title${i.competition ? ", the competition" : ""}${i.date ? ", the date" : ""}. Keep all names perfectly legible.`,
        frame,
        finish,
      ].join(" ");
      add("Title (huge)", i.headline || "STARTING XI");
      add("Team name", i.team);
      add("Formation", i.formation);
      if (i.players.length) {
        const rows = FORMATION_ROWS[i.formation];
        const lineLabel = (n: number, total: number) => (n === 0 ? "goalkeeper (nearest / bottom)" : n === total - 1 ? "attack (furthest / top)" : n === 1 ? "defence" : "midfield");
        if (rows) {
          const ps = i.players.filter(Boolean);
          const used = new Set<number>();
          const pick = (pos: string) => {
            const j = ps.findIndex((p, n) => !used.has(n) && p.trim().split(/\s+/).pop()?.toUpperCase() === pos);
            if (j < 0) return null;
            used.add(j);
            return ps[j];
          };
          // Rows are stored right-to-left (RB first); on the graphic the right back is on the right.
          const rowText = rows
            .map((r, n) => `  ${lineLabel(n, rows.length)} — left to right: ${r.map((pos) => ({ pos, pl: pick(pos) })).reverse().map(({ pos, pl }) => (pl ? q(pl) : `(empty ${pos} spot — leave it out)`)).join("  |  ")}`)
            .join("\n");
          lines.push(`- Players placed row by row in the ${i.formation} formation (the word in each item ending in a position code is the position — show the number and the name; the position code may be shown small):\n${rowText}`);
        } else {
          lines.push(`- Players (number, name, position) — place every one on the pitch:\n${i.players.filter(Boolean).map((p) => `  • ${q(p)}`).join("\n")}`);
        }
      }
      add("Competition", i.competition);
      add("Date / matchday", i.date);
      break;
    case "LOGO": {
      const create = /\[LOGO CREATE\]/.test(opts.instructions ?? "");
      // people type "make me a logo SACREDZ X" into the name — only the name goes on the logo, and no extra lines
      if (create) {
        i.team = cleanLogoName(i.team) || i.team;
        i.footer = "";
      }
      composition = create
        ? `A brand-new, professional TEAM LOGO (crest / emblem) for a team called ${q(i.team || "the team")}${i.subtitle ? `, built around this mascot / idea: ${q(i.subtitle)}` : ""}. One centred emblem on a clean dark background with generous margin, bold and readable at small sizes, crisp edges, balanced symmetry, strong silhouette — like the logo of a top esports org or football club. The team name lettered as part of the emblem.`
        : `A premium LOGO SHOWCASE poster: the team's own logo (reference image) is the hero, big in the centre, faithfully reproduced, in an epic scene${i.headline ? `, with the short headline` : ""}. No people or players.`;
      if (create) add("Team name (lettered inside the logo)", i.team); // a showcase never repeats the name — the logo already carries it
      if (!create) add("Headline", i.headline);
      add("Small line", i.footer);
      break;
    }
    case "TOTW": {
      const cards = i.players.filter(Boolean).map((line, n) => ({ ...parseTotwLine(line), n, photo: !!i.playerPhotos?.[n] }));
      const best = cards.reduce<(typeof cards)[number] | null>((b, c) => (c.pts !== null && (b === null || c.pts > (b.pts ?? -1)) ? c : b), null);
      composition = [
        `A premium "TEAM OF THE WEEK" graphic — the kind a top Pro Clubs league posts every week: ${cards.length === 11 || !cards.length ? "ELEVEN" : `${cards.length} (only these)`} PLAYER CARDS standing in the ${i.formation || "4-3-3"} formation on a football pitch (goalkeeper at the bottom, attackers at the top), seen from a slightly raised angle.`,
        `Each card is a MINI KIXO PLAYER CARD — NOT a video-game trading card: a tall rounded panel (about 2:3) with a SLIM frame glowing in the accent colour, filled edge to edge with ${opts.cardLook ? `the "${opts.cardLook.name}" player-card look (${opts.cardLook.text}) — its dramatic background, lighting and effects —` : "a dramatic dark background with cinematic lighting, smoke and sparks,"} and the player LARGE (waist-up, cut out razor-sharp with a strong coloured rim light, popping over the top edge of the frame). Across the bottom of the card the GAMERTAG in heavy condensed chrome / 3D capitals, tight under it the sub line (club · points) in small letter-spaced caps, a small solid position tag in the top-left corner${opts.refs.some((r) => /SHEET of club crests/.test(r.label)) ? " and the club's crest small in the top-right corner" : ""}. The cards are BIG — together the eleven FILL the card area, rows close together (a card may slightly overlap the row behind it, never another card's text), the pitch only a subtle backdrop under them. One identical card design, size and text layout for all eleven.`,
        best ? `The PLAYER OF THE WEEK card (${q(best.name)}) is the largest, with a brighter frame and a small crown — the rest are identical in size and style.` : "",
        `A huge "${i.headline || "TEAM OF THE WEEK"}" title at the top${i.date ? `, the week / division line under it` : ""}${i.champLogoUrl ? ", the league logo beside the title" : i.competition ? ", the league name" : ""}, clear of the cards; every name perfectly legible.`,
        cards.some((c) => c.photo) ? `Cards with a reference photo show THAT person. ` : "",
        cards.some((c) => !c.photo)
          ? `Cards without a photo show a footballer who looks like a REAL PROFESSIONAL — the standard of a La Liga / Champions League player: photographic (never cartoon or 3D-game), athletic build, sharp real skin, hair, sweat and fabric detail, lit like a stadium photo shoot — and CLEARLY DIFFERENT on every card: vary hair (short, long, curly, braids, shaved), skin tone, beard, age, build, expression and pose (arms crossed, pointing, celebrating, looking over the shoulder, ball under the arm, shouting); a pro-style kit ${opts.refs.some((r) => /SHEET of club crests/.test(r.label)) ? "in that card's club colours, plain, with no badge or words" : "in plain colours with no badge, sponsor, name or number"} — never eleven clones in the same dark shirt. Invented people: not a real famous player, not a lookalike of one.`
          : "",
        frame,
        finish,
      ].join(" ");
      add("Title (huge)", i.headline || "TEAM OF THE WEEK");
      add("Week / division line (under the title)", i.date);
      add("League / competition", i.competition);
      if (cards.length) {
        const rows = FORMATION_ROWS[i.formation];
        const lineLabel = (n: number, total: number) => (n === 0 ? "goalkeeper (bottom)" : n === total - 1 ? "attack (top)" : n === 1 ? "defence" : "midfield");
        const card = (c: (typeof cards)[number]) => `${q(c.name)}${c.pos ? ` [${c.pos}]` : ""}${c.sub ? ` sub line ${q(c.sub)}` : ""}${best && c.n === best.n ? " ★ PLAYER OF THE WEEK card" : ""}${c.photo ? " (photo given)" : ""}`;
        if (rows) {
          const used = new Set<number>();
          const pick = (pos: string) => {
            const j = cards.findIndex((c, n) => !used.has(n) && c.pos === pos);
            if (j < 0) return null;
            used.add(j);
            return cards[j];
          };
          const rowText = rows.map((r, n) => `  ${lineLabel(n, rows.length)} — left to right: ${r.map((pos) => ({ pos, c: pick(pos) })).reverse().map(({ pos, c }) => (c ? card(c) : `(empty ${pos} spot — leave it out)`)).join("  |  ")}`).join("\n");
          const left = cards.filter((_, n) => !used.has(n));
          lines.push(`- The eleven cards, row by row in the ${i.formation} formation — on each card: the gamertag big, the position code in its small badge, the sub line small under the gamertag (write them exactly; never the words "sub line" or "card"):\n${rowText}${left.length ? `\n  extra cards (place where they fit): ${left.map(card).join("  |  ")}` : ""}`);
        } else {
          lines.push(`- The player cards — on each card: the gamertag big, the position code in its small badge, the sub line small under the gamertag (write them exactly; never the words "sub line" or "card"):\n${cards.map((c) => `  • ${card(c)}`).join("\n")}`);
        }
      }
      break;
    }
    case "STANDINGS": {
      const rows = i.standings.filter(Boolean);
      const up = Math.min(rows.length, parseInt(i.qualify, 10) || 0);
      const esLang = i.language === "Español";
      // Only the advancing rows are marked — in the poster's own accent colour, never green or red.
      const zones = up ? [`the top ${up} row${up > 1 ? "s" : ""} (positions 1–${up}) marked as ADVANCING with a glowing edge and a faint tint in the poster's own accent colour (the same colour as the title's highlights — NOT green, NOT red); the other rows plain`] : [];
      const areaText = tableAreaText(opts.format === "banner");
      composition = opts.exactTable
        ? [
            `The BACKGROUND and title of a premium league STANDINGS graphic — like an official league / TV broadcast table. The table itself is placed afterwards, so this image has NO TABLE.`,
            `A huge "${i.headline || "STANDINGS"}" title${i.tagline ? ", a small letter-spaced word right above it" : ""}${i.subtitle ? ", a script / accent line right under it" : ""}${i.champLogoUrl ? ", the league logo beside the title" : ""}${i.date ? ", the matchday / week" : ""}.`,
            `TABLE AREA — LEAVE IT EMPTY: ${areaText}. Draw NOTHING inside that area: no table, no rows, no lines, no boxes, no numbers, no crests, no text — only the background scene continuing through it, slightly darker and calmer (the real table goes on top). ${i.champLogoUrl ? "The league logo echoed GIANT and faded may run behind that area." : ""} NO people, players, faces or figures anywhere.`,
            frame,
            finish,
          ].join(" ")
        : [
        `A premium league STANDINGS table graphic — like an official league / TV broadcast table posted by a top competition's media team.`,
        `A huge "${i.headline || "STANDINGS"}" title at the top${i.tagline ? ", a small letter-spaced word right above it" : ""}${i.subtitle ? ", a script / accent line right under it" : ""}${i.champLogoUrl ? ", the league logo beside the title" : ""}${i.date ? ", the matchday / week" : ""}. Below it a clean, perfectly aligned TABLE with ${rows.length} rows: position number, ${i.tableLogos.some(Boolean) ? "a small crest, " : ""}team name, then the stats in neat columns with small column headers (only the stats given). The leader (1st) row highlighted${zones.length ? `; ${zones.join(", and ")}, with a tiny legend under the table` : ", the bottom rows subtly marked"}. Every row the same height, every number lined up in its column, all text perfectly legible. NO people, players, faces or figures anywhere — the background is the scene plus ${i.champLogoUrl ? "the league / organization logo echoed GIANT and faded behind the table (clearly visible), with the same logo crisp beside the title" : "big graphic energy (light, texture, atmosphere) — no league logo was given, so NO logo beside the title and NO watermark: team crests stay small inside their rows"}.`,
        frame,
        finish,
      ].join(" ");
      add("Small letter-spaced word right ABOVE the title", i.tagline);
      add("Title (huge)", i.headline || "STANDINGS");
      add("Accent line right UNDER the title (script or condensed style)", i.subtitle);
      // No league / organization name line on standings — the logo represents the league (owner's request).
      add("Matchday / week", i.date);
      if (zones.length && !opts.exactTable)
        lines.push(`- Zone legend (tiny, under the table, one line): ${q(`● ${esLang ? `TOP ${up} AVANZAN` : `TOP ${up} ADVANCE`}`)} — the dot in the same accent colour as the marked rows`);
      if (rows.length && !opts.exactTable)
        lines.push(`- Table rows, in this exact order (top to bottom) — keep every team name and number exactly; the labels P W D L GD PTS are the column headers (translate these short headers into the poster text language if it is not English, e.g. PJ G E P DG PTS in Spanish), show each number in its column. The "·" only separates the items — never draw a dot, bullet or separator after the team name:\n${rows.map((r) => `  ${q(r)}`).join("\n")}`);
      break;
    }
    case "RESULT":
      composition = [
        `A full-time result graphic.`,
        `${exactLogos ? "Two glowing spots on the left and right for the crests (do not draw any crests — the official crests are added afterwards)" : "Both team crests big and glossy on either side"}, a huge score between them, a bold "${i.headline || "FULL TIME"}" label, ${i.scorers.length ? "the goal scorers listed under each side (or under the score)" : "no goal scorers"}${i.competition ? ", and the competition name" : ""}.`,
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
    case "QUALIFIERS": {
      const rows = i.regions.map(parseRegionRow).filter((r) => r.name);
      const esLang = i.language === "Español";
      const unit = (i.unit || (esLang ? "Managers" : "Managers")).trim();
      const nums = rows.map((r) => Number(String(r.count).replace(/[^\d.]/g, "")));
      const sum = rows.length && nums.every((n) => Number.isFinite(n) && String(rows[0].count) !== "") ? nums.reduce((a, b) => a + b, 0) : null;
      const totalText = i.total.trim() || (sum !== null && sum > 0 ? `${esLang ? "TOTAL" : "TOTAL"} — ${sum} ${unit.toUpperCase()}` : "");
      composition = opts.exactTable
        ? `The BACKGROUND, headline, emblem and trophy of a WORLD CUP QUALIFIERS announcement poster for a pro-clubs / esports league — like the official graphic of a top competition's media team. The regions table is placed afterwards by KIXO, so this image has NO TABLE: ${qualTableAreaText(opts.format)} stays EMPTY (only the background continuing, slightly darker and calmer). The headline huge at the top as a glossy 3D lettering piece${i.subtitle ? ", a ribbon line under it" : ""}; ${i.champLogoUrl ? "the league logo as a big hero 3D emblem at the upper left; " : ""}a giant polished trophy (${i.trophyUrl ? "the provided trophy" : trophyPrompt(i.trophy) || "a tall gold world-cup style trophy with a globe on top"}) on a podium with a football at the lower left; a faint world map behind; stadium lights, laurels, particles. ${frame} ${finish}`
        : `A WORLD CUP QUALIFIERS announcement poster for a pro-clubs / esports league — like the official graphic of a top competition's media team. The headline huge at the top as a glossy 3D lettering piece${i.subtitle ? ", a ribbon line under it" : ""}; ${i.champLogoUrl ? "the league logo as a big hero 3D emblem; " : ""}a giant polished trophy (${i.trophyUrl ? "the provided trophy" : trophyPrompt(i.trophy) || "a tall gold world-cup style trophy with a globe on top"}) as the centrepiece on a podium with a football; the REGIONS TABLE panel with one row per region (icon, name, number), a TOTAL bar; a faint world map behind; stadium lights, laurels, particles. ${frame} ${finish}`;
      add("Headline (huge, glossy 3D, at the top)", i.headline || "QUALIFIERS");
      add("Ribbon line under the headline", i.subtitle);
      add(i.champLogoUrl ? "League name (small, beside the emblem — only if it is not already written on the logo)" : "League / competition name", i.competition);
      if (!opts.exactTable) {
        lines.push(`- Table header (two small labels on the panel's top bar): ${q(esLang ? "Región" : "Region")} at the left and ${q(unit)} at the right`);
        if (rows.length)
          lines.push(`- Table rows, in this exact order (one per line — the icon, then the name, then the number at the right): \n${rows.map((r) => `  • ${r.icon ? `[${r.icon}] ` : "[a small globe icon] "}${q(r.name)}${r.count ? ` … ${q(r.count)}` : ""}`).join("\n")}`);
        if (totalText) add("TOTAL bar under the rows (wider plate, bold)", totalText);
      }
      add("Season / date line (small)", i.date);
      break;
    }
    case "WINNERS": {
      const esLang = i.language === "Español";
      const winners = (i.winners ?? []).map((w) => w.trim()).filter(Boolean);
      const grid = winnersGrid(opts.format ?? "post", Math.max(parseInt(i.boxes, 10) || 15, winners.length));
      const bottomTitle = i.subtitle.trim() || (esLang ? "VITRINA DE CAMPEONES" : "CHAMPIONS SHOWCASE");
      const emblem = i.champLogoUrl ? "the league logo as a glossy 3D emblem at the lower right corner beside the bottom title" : "";
      composition = opts.exactTable
        ? `The BACKGROUND and titles of a CHAMPIONS SHOWCASE graphic for a pro-clubs / esports league — a trophy-cabinet wall where every winning team gets its own display frame — like the official graphic of a top competition's media team. The wall of frames is placed afterwards by KIXO, so this image has NO FRAMES, NO BOXES, NO GRID and NO CRESTS: ${winnersAreaText(opts.format)} stays EMPTY — only the background continuing through it, darker and calmer, a soft spotlight glow falling from above. The headline big across the TOP BAND (ending well above the empty rectangle) as a glossy 3D lettering piece in the poster's title materials${i.tagline ? ", a small letter-spaced word above it" : ""}; the bottom title "${bottomTitle}" as a SMALL 3D lettering piece (about a third of the headline's size, one line, at most 9% of the height) centred along the very bottom edge in the BOTTOM BAND (starting below the empty rectangle) with a small crown / laurel accent${emblem ? `; ${emblem}` : ""}; light streaks, rays and particles down both sides; the poster's scene behind. NO people, players, faces or figures anywhere. ${frame} ${finish}`
        : `A CHAMPIONS SHOWCASE graphic for a pro-clubs / esports league — a trophy-cabinet wall where every winning team gets its own display frame — like the official graphic of a top competition's media team. The headline huge across the top as a glossy 3D lettering piece${i.tagline ? ", a small letter-spaced word above it" : ""}; in the middle a neat GRID of ${grid.cells} identical bevelled display frames (${grid.cols} across, ${grid.rows} down) in the poster's metal, each lit by a small spotlight from its top edge, with an empty name plate along its bottom; the first ${winners.length} frame${winners.length === 1 ? "" : "s"} (left to right, top to bottom) hold the winners — each one's crest (the reference images) above its name on the plate — and the other frames stay EMPTY (no crest, no name, no placeholder); the bottom title "${bottomTitle}" as a smaller 3D lettering piece centred along the bottom with a small crown / laurel accent${emblem ? `; ${emblem}` : ""}; light streaks, rays and particles down both sides. NO people, players, faces or figures anywhere. ${frame} ${finish}`;
      add("Small letter-spaced word above the headline", i.tagline);
      add("Headline (huge, glossy 3D, across the top)", i.headline || (esLang ? "CAMPEONES" : "CHAMPIONS"));
      add("Bottom title (3D lettering, centred along the bottom)", bottomTitle);
      add(i.champLogoUrl ? "League name (tiny, under the emblem — only if it is not already written on the logo)" : "League / competition name (small)", i.competition);
      // Unusual words (league names, Spanish) get misspelled in big 3D lettering — spell them out letter by letter.
      const spell = (t: string) => t.trim().split(/\s+/).map((w) => (w.length >= 5 ? `${w} (${[...w].join("-")})` : w)).join(" ");
      lines.push(`- Spelling check: the headline reads exactly ${q(i.headline || (esLang ? "CAMPEONES" : "CHAMPIONS"))} — ${spell(i.headline || (esLang ? "CAMPEONES" : "CHAMPIONS"))}; the bottom title reads exactly ${q(bottomTitle)} — ${spell(bottomTitle)}. Check every letter before finishing.`);
      if (!opts.exactTable && winners.length)
        lines.push(`- Winners, in this exact order — frame 1 first (left to right, top to bottom), each name on its frame's plate, spelled exactly; every other frame EMPTY:\n${winners.map((w, k) => `  ${k + 1}. ${q(w)}`).join("\n")}`);
      add("Season / date line (small)", i.date);
      break;
    }
    case "EVENT": {
      const nPartners = (i.partnerLogos ?? []).filter(Boolean).length;
      composition = `A tournament / event announcement poster. One or two dynamic shots of the subject, a huge glossy 3D headline in the middle${i.name ? ", a bold event title under it" : ""}${i.subtitle ? ", a script-font accent line" : ""}${i.date || i.details ? ", and the date and times on a sleek integrated ribbon or glowing light bar (not a flat app-style box)" : ""}${i.prize ? ", a prize badge" : ""}${i.rule ? ", a boxed rule line" + (i.ruleNote ? " with a small note under it" : "") : ""}${i.entry ? ", a boxed entry-fee line" : ""}${nPartners ? `, and a neat ROW OF ${nPartners} COLLABORATOR LOGO${nPartners > 1 ? "S" : ""} (the partner logos given as reference images — same height, evenly spaced, under a tiny letter-spaced label) that never covers the headline or the subject` : ""}. ${frame} ${finish}`;
      if (nPartners) add("Tiny letter-spaced label above the collaborator logos", i.language === "Español" ? "EN COLABORACIÓN CON" : i.language === "Português" ? "EM COLABORAÇÃO COM" : "IN COLLABORATION WITH");
      add("Headline (huge, glossy 3D)", i.headline);
      add("Event title (bold, under the headline)", i.name);
      add("Script accent line", i.subtitle);
      add("Rule / requirement (bold, in its own box)", i.rule);
      add("Rule note (small, right under the rule)", i.ruleNote);
      add("Date & times (designed lock-up on a ribbon / light bar)", [i.date, i.details].filter(Boolean).join("  ·  "));
      add("Prize", i.prize);
      add("Entry fee (big, in its own box)", i.entry);
      break;
    }
    default:
      composition = [
        `A premium pro-clubs / esports football player announcement poster, the dense layered style of top club social-media designers.`,
        `LAYERING (back to front): 1) a dramatic themed background filling the frame; 2) ${i.name ? `GIANT background lettering of the player's name ${q(i.name)} spanning the whole width — mix a huge blackletter/gothic word with huge condensed outlined letters, partly hidden behind the player (a graphic echo of the name — never the team name)` : "giant abstract graphic shapes and light"}${hasTeamLogo && !exactLogos ? ", plus the team crest echoed large, ghosted and partly hidden behind the player (no team name text)" : ""};`,
        i.photo2Url && aiRefs.some((r) => r.label.startsWith("a SECOND photo"))
          ? `3) the SECOND PHOTO of the player (reference image ${aiRefs.findIndex((r) => r.label.startsWith("a SECOND photo")) + 1}) very large in the upper half / behind, exactly as photographed — cut out, enlarged, colour-graded and tinted with the main colour, slightly faded / double-exposed into the background with light rays and texture over it;`
          : (i.bgPose === "none" || /\[ONE FIGURE\]/.test(opts.instructions ?? ""))
          ? `3) (no second figure — only ONE image of the player on this poster);`
          : !i.bgPose || i.bgPose === "surprise"
            ? `3) a SECOND, NEWLY CREATED image of the SAME player, very large in the upper half/behind: ${surprisePose(v.seed)}. A genuinely different shot generated by you — a different angle, pose and expression from the uploaded photo, NOT a copy, crop or enlargement of it — but clearly the same person (same face, hair, skin tone, beard, kit), colour-graded and tinted with the main colour, slightly faded / double-exposed into the background with light rays and texture over it;`
          : i.bgPose === "style"
            ? `3) the background figure / second image exactly as described in the DESIGN INSTRUCTIONS FROM THE ART DIRECTOR below${opts.instructions?.trim() ? "" : " (none were given, so create a dramatic close-up of the SAME player — clearly the same person, a newly generated shot, not a copy of the photo)"};`
              : `3) a SECOND, NEWLY CREATED image of the SAME player, very large in the upper half/behind: ${bgPosePrompt(i.bgPose)}. This must be a genuinely different shot generated by you — different pose, angle and expression from the uploaded photo, NOT a copy, crop or enlargement of it — but clearly the same person (same face, hair, skin tone, beard, kit). Render it in the same style as the rest of the poster: colour-graded and tinted with the main colour, slightly faded/double-exposed into the background, with light rays and texture over it;`,
        `4) in front, the player from the uploaded photo as a sharp full cut-out (same pose as the photo), with a strong rim light and glow separating them from the background; 5) effects on top.`,
        (i.bgPose === "none" || /\[ONE FIGURE\]/.test(opts.instructions ?? "")) || i.bgPose === "style"
          ? ""
          : `The two figures must clearly differ (e.g. one a dramatic close-up, the other the action/full-body pose), like a pro designer's double-shot player card.`,
        `TYPOGRAPHY: the player's name huge on the lower left${i.position ? "; a small solid coloured tag box above it with the position" : ""}${i.subtitle || i.tagline ? "; the accent line in a script or gothic style" : ""}${i.number ? "; the jersey number big and outlined on the right" : ""}. Do not add any other words — no invented titles, tags or slogans.`,
        frame,
        finish,
      ].join(" ");
      add("Player name (huge, bottom left)", i.name);
      add("Position tag box", i.position);
      add("Jersey number (large outlined, right side)", i.number);
      if (!flyerSlots.length) {
        add("Small elegant word above the name", i.tagline);
        add("Script-font line under the name", i.subtitle);
      }
  }
  // The style's added boxes (any poster type): one line per box, each at that line's spot and in its lettering.
  for (const sl of flyerSlots) {
    const v = (i.slots?.[sl.key] ?? "").trim();
    if (v) {
      lines.push(`- ${sl.label} — ${sl.where}: ${q(v)}`);
      inventory.push(v);
    }
  }
  if (!flyerSlots.length) add("Letter-spaced footer line at the very bottom", i.footer);

  const typeFx = `TYPOGRAPHY TREATMENT (very important): every title is a designed lettering piece by a pro designer, never plain typed text. The main name/headline: thick 3D extruded letters with bevelled edges, polished chrome or brushed-metal faces with a gradient in the main colour, sharp specular highlights, a coloured outline or inner glow, a hard drop shadow and subtle wear/texture; it may be slightly slanted, tightly kerned and overlap the subject in places. Mix 2–3 contrasting type styles (huge condensed caps + a gothic or brush-script accent + tiny letter-spaced caps) with a clear size hierarchy. Tag boxes and badges look like real graphic elements (bevel, gradient, glow). No flat, thin, default-looking white text.`;
  const typo = [
    fontPrompt(i.fontPrimary) && `TITLE FONT chosen by the user (overrides the style's default title lettering): titles and the main headline in ${fontPrompt(i.fontPrimary)}.`,
    fontPrompt(i.fontSecondary) && `NAMES FONT chosen by the user (overrides the style's default): player names, numbers and small text in ${fontPrompt(i.fontSecondary)}.`,
    i.language && i.language !== "English"
      ? `Write generic words on the poster (titles like MATCH DAY, FULL TIME, CHAMPIONS, STARTING XI, labels, dates) in ${i.language}. Team names, player names and anything quoted below stay exactly as written.`
      : "",
  ]
    .filter(Boolean)
    .join(" ");

  const refText = aiRefs.map((r, n) => `Reference image ${n + 1} is ${r.label}`);
  const spots = [...new Set(overlays.map((o) => o.overlay))];
  const spotText = spots.includes("hero")
    ? "a large glowing circular spotlight / halo area in the lower-centre of the poster (about 48% of the poster width, centred, its middle at roughly 62% of the height) — make it the visual focal point — a glowing podium with light rays, glow and particles radiating around it, but the centre clean (just glowing light) — and keep the trophy to the right side and the squad names below it"
    : spots.includes("left")
      ? `two glowing circular spotlight areas at mid-height — one on the left (centred at ~25% width, ~40% height) and one on the right (~75% width, ~40% height), each about 32% of the poster width, with the "VS" between them; keep their centres clean (just glowing light)`
      : spots.includes("tc")
        ? `the TOP CENTRE (a square about 28% of the poster width, centred, just under the top edge) calm — a soft glowing light spot or halo there is welcome, but no text, faces, objects, crest or emblem`
        : spots.includes("bc")
          ? `the BOTTOM CENTRE (a square about 24% of the poster width, centred, just above the bottom edge) calm — a soft glowing light spot there is welcome, but no text, faces, objects, crest or emblem`
          : `the top-left corner (a square about 26% of the poster width, plus margin) calm and empty`;
  // Champions posters need a lot of celebration energy — always added, even for admin-led styles.
  const champsEnergy =
    layout === "CHAMPIONS" && !/^CHAMPIONS VERSION OF THE/.test(opts.instructions ?? "")
      ? `CHAMPIONS ENERGY (dense, maximalist, never sparse): a storm of confetti and streamers in the poster's colours filling the air, fireworks bursting behind, strong light beams/god-rays from above, a packed stadium crowd with phone lights and flags far behind, a glossy reflective floor, ${spots.includes("hero") ? "a raised glowing podium with 3–5 championship stars arching above the crest spot (the crest itself is added afterwards — keep that spot empty), " : ""}the title huge with deep 3D extrusion, bevel and texture${(i.roster.length || i.players.length) ? `. SQUAD NAMES: premium and clean — bold condensed sans-serif, uniform size, generous letter-spacing, in perfectly aligned columns near the bottom, no separators or chunky boxes, every name perfectly readable` : ""}. Fill the whole frame with layered detail — NO large empty dark areas.`
      : "";
  const logoRule = overlays.length && raw.aiLogo === "both"
    ? `LOGO SPACE: also leave ${spotText} — no text, faces or objects there — because the official crest FILE is placed there afterwards, in addition to the 3D crest emblem you build into the design.`
    : exactLogos
    ? `LOGO SPACE: leave ${spotText} — no text, faces or objects there — because the official team crest${spots.length > 1 ? "s are" : " is"} placed there afterwards${overlays.some((o) => o.fx === "3d") ? " as a 3D emblem built from the real file" : ""}. Do NOT draw, invent or imitate any team crest, club badge or emblem anywhere on the poster — wherever the instructions above describe a crest or emblem, skip it and leave only the glowing light spot where it will go.`
    : "";

  // A style with admin design instructions: those describe the whole design; the built-in layout recipe is skipped.
  const adminLed = !!opts.instructions?.trim();
  // A style with its own reference flyer or an explicit [OWN LOOK] tag keeps its look instead of the generic layout rules.
  const ownLook = adminLed && (opts.refs.some((r) => r.label.startsWith("a STYLE reference only")) || /\[OWN LOOK\]|STYLE REFERENCE/.test(opts.instructions ?? ""));
  // [EXACT REF]: the style copies its reference poster exactly — no new arrangement, no surprise pose, the crest where the reference has it.
  const exactRef = /\[EXACT REF\]/.test(opts.instructions ?? "") && opts.refs.some((r) => r.label.startsWith("a STYLE reference only"));
  // [NO ECHO]: the style shows the crest once — no giant faded copy of it in the background. (Exact-copy styles
  // repeat their reference's background, and a faded emblem there is the reference's test crest, not the user's.)
  const noEcho = /\[NO ECHO\]/.test(opts.instructions ?? "");
  const kind = { PLAYER: "player card", CHAMPIONS: "champions", MATCHDAY: "match day", LINEUP: "starting lineup", TOTW: "team of the week", RESULT: "full-time result", EVENT: "tournament / event", STANDINGS: "league standings table", LOGO: "team logo", QUALIFIERS: "world cup qualifiers announcement", WINNERS: "champions showcase wall" }[layout] ?? "sports";
  const directorBlock =
    opts.instructions?.trim()
      ? `DESIGN INSTRUCTIONS FROM THE ART DIRECTOR — ${adminLed ? "these define the whole design; follow them exactly. Where they conflict with anything else in this brief, they win, EXCEPT the text rules, logo space and safety rules below, which always apply" : "follow these closely; where they conflict with anything above, these win"}:\n${opts.instructions.trim().slice(0, 20000)}`
      : "";
  // What the user picked in the creator — always applied, even over a style's own instructions.
  const picks = [
    bgScenePrompt(i.bgScene) ? `- BACKGROUND SCENE: ${bgScenePrompt(i.bgScene)}. Replace the style's own background with this scene (real, detailed, photographic, with depth) — keep the style's layout, figures and typography.` : "",
    i.colorMode === "custom" && i.color1 ? `- COLOURS: main ${i.color1}${i.color2 ? `, second ${i.color2}` : ""} — recolour the lighting, background, title, effects and metals to these colours instead of the style's colours.` : "",
    i.colorMode === "team" ? `- COLOURS: taken from the TEAM CREST's own main colours — they replace the style's colours in the lighting, background, title and effects.` : "",
    fontPrompt(i.fontPrimary) ? `- TITLE FONT: titles and the main headline in ${fontPrompt(i.fontPrimary)}.` : "",
    fontPrompt(i.fontSecondary) ? `- NAMES FONT: names, numbers and small text in ${fontPrompt(i.fontSecondary)}.` : "",
    i.language && i.language !== "English" ? `- LANGUAGE: generic words (titles, labels) written in ${i.language}; names stay exactly as typed.` : "",
    layout === "PLAYER" && i.bgPose && !["style", "none", "surprise", ""].includes(i.bgPose) && bgPosePrompt(i.bgPose) ? `- SECOND FIGURE POSE: ${bgPosePrompt(i.bgPose)}.` : "",
    layout === "PLAYER" && (!i.bgPose || i.bgPose === "surprise") && !i.photo2Url && !/\[FIXED POSES\]|\[EXACT REF\]/.test(opts.instructions ?? "")
      ? `- SECOND FIGURE POSE (surprise #${v.seed % 1000}): the background / portrait figure of the player is NOT a straight-on portrait this time — it is ${surprisePose(v.seed)}. Same person, same face, hair, skin tone and outfit as the photo, NEWLY CREATED in this pose (a different angle, crop and expression — never a copy, duplicate, mirror or re-crop of the uploaded photo) and rendered in the style's treatment (its duotone, grade, blend and placement). Where the style asks for an up-close portrait too, that portrait is also newly generated: a tight crop of the face at a different angle. The main figure in front keeps the photo's own pose.`
      : "",
    layout === "PLAYER" && i.bgPose === "none" && !i.photo2Url ? `- Show the player only ONCE (no second figure).` : "",
    !exactLogos && hasTeamLogo
      ? `- THE TEAM CREST: the ONLY crest on this poster is the one in the reference image labelled "the crest/logo of the team"${(i.aiLogo === "on" || i.aiLogo === "both") && opts.crestNote ? ` (it contains: ${opts.crestNote})` : ""} — copy THAT artwork ${i.aiLogo === "on" || i.aiLogo === "both" ? `(its exact shape, letters, symbols and arrangement, REBUILT as the badass 3D emblem described — in THIS poster's title materials and colour palette, never the file's own colours or flat finish, with the scene's light, glow, particles and smoke on and around it, fully blended into the design — floating directly on the poster with NO plate, disc, shield, panel, frame or extra shape behind or around it; ${noEcho ? "ONE emblem only — no second, giant, faded or ghosted copy of it anywhere" : "one main emblem plus one giant faded background echo, no other copies"}). Wherever the instructions above say the crest is crisp, flat, pasted, copied faithfully or keeps its colours, read it as: the SAME artwork rebuilt as this 3D emblem in the poster's materials` : "EXACTLY: identical outline, shapes, letters, symbols, proportions and colours, with only the scene's light and shadow on it. Wherever this brief says emblem, badge, medallion or 3D crest, it means this exact artwork — never a redesign: no added shield, ring, frame, ribbon, stars, wings, extra words, no recolouring"}. ${layout === "PLAYER" ? "The badge printed on the shirt in the photo is NOT the crest (it may even be a different club): leave it on the shirt at its natural size and never redraw, enlarge or echo it. " : ""}Before finishing, compare your crest with that reference image side by side — same letters (count them), same words, same symbols, same arrangement${i.aiLogo === "on" || i.aiLogo === "both" ? " (the materials and colours are the poster's, not the file's — that is correct)" : ""}; if anything was added, changed or removed, fix it.`
      : layout === "PLAYER" && !exactLogos
        ? `- NO CREST: no team crest was given, so draw NO crest, badge, emblem or club name anywhere — the badge on the shirt stays only on the shirt at its natural size.`
        : "",
    layout === "PLAYER" && hasTeamLogo && !exactLogos && (i.aiLogo === "on" || i.aiLogo === "both") && exactRef
      ? `- CREST PLACEMENT: the 3D emblem sits exactly where the STYLE reference has its emblem, at the same size; ${noEcho ? "this style shows the crest ONCE — no giant, faded or ghosted copy of it in the background (if the reference's background shows a faint emblem, leave that out)." : "a giant faded echo of it only where the reference has one. No other copies unless the reference shows them."}`
      : layout === "PLAYER" && hasTeamLogo && !exactLogos && (i.aiLogo === "on" || i.aiLogo === "both") && noEcho
      ? `- CREST PLACEMENT: the 3D emblem sits where the art director's instructions put the crest, at that size — big enough to matter, never over a face. ONE emblem only: no second, giant, faded or ghosted copy of it anywhere in the background.`
      : layout === "PLAYER" && hasTeamLogo && !exactLogos && (i.aiLogo === "on" || i.aiLogo === "both")
      ? `- CREST PLACEMENT & ECHO (overrides any crest position in the instructions above): the main 3D emblem goes wherever it looks BEST in this composition — the spot the style names is only a suggestion: a top corner, the top centre, beside or under the name, a mid-side or a lower corner — balanced against the figure and the title, big enough to matter, never over a face, and in a different place from poster to poster (variation #${v.seed % 7}). PLUS a second copy: the same crest HUGE and ghosted in the background (about 10–25% opacity, tinted into the scene's colours, softened or textured like the backdrop, partly behind the title and the figure) — blended, never a sticker. No other copies.`
      : "",
    layout === "PLAYER" && i.photo2Url && aiRefs.some((r) => r.label.startsWith("a SECOND photo"))
      ? `- SECOND PICTURE (mandatory): the second figure of the player — the big portrait / background image — is reference image ${aiRefs.findIndex((r) => r.label.startsWith("a SECOND photo")) + 1} EXACTLY as photographed (same pose, angle, expression and framing; cropped chest-up if the style wants a portrait), only cut out, enlarged and graded into the style. Never generate another pose, angle or expression for that figure. The main figure in front stays the first photo. THIS OVERRIDES THE STYLE: the second picture must be clearly visible on the finished poster. It takes the place of the style's (and the STYLE reference's) second / background figure of the player; if the style has only ONE figure — even if it says "one figure only" — add it anyway, large and slightly faded BEHIND the main figure (upper half, beside or above the head), blended into the background, without moving the lettering or the crest.`
      : "",
    i.extraPrompt ? `- EXTRA IDEA: ${i.extraPrompt}.` : "",
    layout === "MATCHDAY" || layout === "RESULT"
      ? `- PEOPLE RULE (always applies, overrides the style): ${matchPhoto ? "the ONLY person on this poster is the one from the uploaded photo, once, in the centre foreground." : "no player photo was uploaded, so there are NO people, players, athletes, faces, bodies, hands, crowds or silhouettes anywhere — not even blurred, ghosted or duotone in the background. Leave the centre foreground OPEN (just the scene and lighting continuing through it, as if a player could be dropped in later)."} Wherever this style would put a player, portrait or figure${matchPhoto ? " other than the uploaded person" : ""} — especially the big duotone / ghosted portraits in the back halves — put the TEAM CRESTS instead: the home crest huge and faded (ghosted, 15–30% opacity, tinted into that half's colour) on the LEFT half and the away crest the same on the RIGHT half, behind everything, plus the two crests normal-size where the style places them. Never invent a player.`
      : "",
    layout === "QUALIFIERS" && opts.exactTable
      ? `- TABLE AREA (overrides any table in the instructions above): KIXO places the regions table afterwards — leave ${qualTableAreaText(opts.format)} completely EMPTY: no panel, no frame, no rows, no names, no numbers, no flags, no text there, only the background scene continuing (slightly darker and calmer). The headline stays at the top, the league emblem at the upper left, the trophy on its podium at the lower left — all outside that area. Do not draw the regions table anywhere else either.`
      : "",
    layout === "WINNERS" && opts.exactTable
      ? `- GRID AREA (overrides any frames, boxes or grid in the instructions above): KIXO places the wall of frames with the real crests afterwards — leave ${winnersAreaText(opts.format)} completely EMPTY: no frames, no boxes, no panels, no crests, no names, no text there, only the background scene continuing (darker and calmer, a soft spotlight glow from above). The headline stays at the top, the bottom title and the league emblem along the bottom — all outside that area. Do not draw the frames anywhere else either.`
      : "",
    // Admin style test without a photo (the automatic previews of new styles): an invented test player, never a real person.
    layout === "PLAYER" && !hasPhoto
      ? `- NO PHOTO (style preview): no player photo was given, so the player is an INVENTED footballer — photographic and real-looking, but NOT a real or famous person and not a lookalike of one. Every figure this design shows is that SAME invented person (same face, hair, skin tone and build). The kit is plain, in the poster's colours, with no club badge, sponsor or brand mark on it.`
      : "",
    (layout === "EVENT" || layout === "QUALIFIERS" || layout === "WINNERS") && !hasPhoto ? `- NO PEOPLE: no photo was uploaded — this announcement has NO people, players, athletes, faces, bodies, hands, crowds or silhouettes anywhere, not even blurred in the background. The hero spot is taken by a big photoreal centrepiece (a giant trophy or the organizer logo as a 3D emblem, or the style's own centrepiece), dramatically lit, and the poster stays dense and layered like a top studio flyer — never a plain text stack.` : "",
    opts.cardLook
      ? `- LOOK OF THE WHOLE POSTER: the "${opts.cardLook.name}" player-card look — ${opts.cardLook.text}. The background, atmosphere, lighting, effects, materials and title typography of the entire poster (not only the cards) use this look${opts.cardLook.colours ? ` and these colours: main ${opts.cardLook.colours.primary}, accent / glow ${opts.cardLook.colours.accent}, deep shadows ${opts.cardLook.colours.dark}` : ""}. Keep this style's LAYOUT (where the title block sits, ${layout === "STANDINGS" ? "the table and its rows" : layout === "EVENT" ? "the hero, the prize and the information lines" : layout === "WINNERS" ? "the wall of frames, the headline and the bottom title" : "the pitch and the formation of the cards"}) but replace its own scene, materials and colours with this look.${layout === "STANDINGS" ? " Take ONLY the look's scene, lighting, effects, colours and typography — NOT its player: a standings poster has no people, players, faces or figures at all; the league logo giant and faded in the background is the hero instead." : layout === "WINNERS" ? " Take ONLY the look's scene, lighting, effects, colours and typography — NOT its player: a champions showcase has no people, players, faces or figures at all; the headline and the wall of frames are the heroes instead." : layout === "EVENT" ? " The look's player treatment applies to the uploaded photo only (the person shown exactly as that card style shows its player); without a photo take ONLY the scene, lighting, effects, colours and typography — no people or faces." : ""}`
      : "",
  ].filter(Boolean);
  const userChoices = picks.length
    ? `USER CHOICES — the customer picked these in the creator. They ALWAYS apply and override the matching parts of the style (and of the art director's instructions); everything else in the style stays the same:\n${picks.join("\n")}`
    : "";
  return [
    opts.format === "square"
      ? `Design a finished, high-end SQUARE (1:1) image.`
      : opts.format === "story"
      ? `Design a finished, high-end TALL vertical sports poster for Instagram / TikTok STORIES (9:16). Use the whole tall canvas — extend the background and scene to fill it top to bottom (no empty bands, no borders); recompose the layout for the tall frame and keep all text and the player inside the middle 80% (away from the very top and bottom where the phone's buttons sit).`
      : opts.format === "banner" || /\[WIDE\]/.test(opts.instructions ?? "")
        ? `Design a finished, high-end WIDE landscape sports banner (16:9). Use the whole wide canvas — extend the background and scene edge to edge (no empty sides, no borders); recompose the layout for the wide frame: player on one side, title and details on the other.`
        : `Design a finished, high-end vertical sports social-media poster (4:5).`,
    directorBlock,
    userChoices,
    opts.season ?? "",
    adminLed
      ? `This is a ${kind} poster. Its layout, composition, figures, typography and effects are defined by the ART DIRECTOR'S DESIGN INSTRUCTIONS above — follow them exactly. ${layout === "CHAMPIONS" ? `Trophy: ${i.trophyUrl ? "the provided trophy (reference image)" : trophyPrompt(i.trophy) || "a large shiny trophy"}. ` : ""}${layout === "PLAYER" ? (i.photo2Url && aiRefs.some((r) => r.label.startsWith("a SECOND photo")) ? `Wherever the instructions describe a second image / portrait of the player, that figure is the user's SECOND photo (reference image ${aiRefs.findIndex((r) => r.label.startsWith("a SECOND photo")) + 1}) used exactly as photographed — not a pose you invent. ` : i.bgPose === "none" || /\[ONE FIGURE\]/.test(opts.instructions ?? "") ? "Show the player only once. " : (!i.bgPose || i.bgPose === "surprise") && !/\[FIXED POSES\]|\[EXACT REF\]/.test(opts.instructions ?? "") ? `The second figure / portrait of the player the instructions describe takes THIS pose instead of a straight-on portrait: ${surprisePose(v.seed)} (a newly generated shot of the same person, in the style's treatment). ` : i.bgPose !== "style" ? `If the instructions don't describe a second figure, add one behind: ${bgPosePrompt(i.bgPose)} (a newly generated shot of the same person). ` : "") : ""}${frame} Unless the instructions describe the background in detail, use this: ${finish}`
      : composition,
    // With admin instructions, the AI only reads those (the old background description is not sent).
    adminLed ? "" : opts.cardLook ? `Layout base (its scene and colours are replaced by the LOOK in the user choices): ${opts.templatePrompt}.` : `Visual style (base${(i.colorMode === "custom" && i.color1) || v.palette || i.colorMode === "team" ? " — keep its mood, scene and materials, but NOT its colours; use the COLOURS line below" : ""}): ${opts.templatePrompt}.`,
    opts.cardLook?.colours
      ? `COLOURS: main colour ${opts.cardLook.colours.primary}, accent / glow ${opts.cardLook.colours.accent}, deep shadows ${opts.cardLook.colours.dark} — the colours of the chosen "${opts.cardLook.name}" look, for the whole poster.`
      : colourLine(i, style, v, adminLed),
    bgScenePrompt(i.bgScene)
      ? `BACKGROUND SCENE (chosen by the user${adminLed ? " — use it unless the art director's instructions define the background" : " — use it"}): ${bgScenePrompt(i.bgScene)}. Render it as a real, detailed, photographic environment with depth, tinted with the poster colours — not a flat or simple backdrop.`
      : "",
    opts.series
      ? `TEAM SET: this card belongs to a matching set for the whole team. Copy the design of the first card (reference image) as closely as possible — same background, colours, layout, fonts and effects — so all cards look like one series. Only the player and the player's text change.`
      : exactRef
      ? `EXACT STYLE (no variation): this poster is the SAME DESIGN as the STYLE reference image — the same layout with every element in the same place and at the same size, the same background scene, colours, lighting, effects and lettering styles. Nothing is rearranged, mirrored, restyled or added; only the player, the texts and the crest are swapped, plus whatever the USER CHOICES name.`
      : randomize && (layout === "LINEUP" || layout === "TOTW" || /\[FIXED LAYOUT\]/.test(opts.instructions ?? ""))
      ? `Make this poster feel fresh (variation #${v.seed}) with new small details, but keep the layout, concept and style ${adminLed ? "the art director defined" : "of the base style"}.`
      : randomize
      ? `SAME STYLE, NEW ARRANGEMENT (variation #${v.seed}): keep EXACTLY the ${adminLed ? "art director's" : "base"} style — the same kind of scene and background, the same colours, materials, typography, effects and quality — so it clearly belongs to this style. Only the POSITIONS change this time: ${v.arrangement ?? "a fresh arrangement of the same elements"}. Keep every required element and all text readable, and keep the brand-mark corner calm.`
      : `Keep this poster consistent with the base style — same kind of background, layout and mood every time.`,
    adminLed ? "" : typeFx,
    typo,
    i.extraPrompt ? `Extra direction from the user: ${i.extraPrompt}.` : "",
    ...refText,
    logoRule,
    adminLed ? "" : champsEnergy,
    layout === "LINEUP" && !/PHOTOSHOP LOOK/.test(opts.instructions ?? "")
      ? `PHOTOREAL CINEMATIC LINEUP (always applies, whatever the style): it must look like a REAL photograph composited by a top club's design team — like a still from a cinematic stadium film shot on a full-frame cinema camera with an anamorphic lens — NOT a video-game render, NOT cartoon, NOT a generic AI image. Physically correct lighting: real stadium floodlights with volumetric beams through real haze, true shadows, natural falloff, wet grass/pitch with real reflections, shallow depth of field with creamy bokeh, subtle anamorphic flares, fine film grain, a restrained teal-and-team-colour grade, deep but detailed blacks. Real materials only: brushed and polished metal, glass, enamel, concrete, grass. Neon and glow kept subtle and believable (real light sources, not cartoon outlines). The team crest crisp and faithful as a premium physical emblem with real reflections and a soft contact shadow. The pitch photographic with depth and crisp real pitch lines. Players as refined, sleek markers: slim glossy glass-and-metal badges in the team colour with the shirt number big, the name underneath on a clean thin dark tag — smaller and more elegant than chunky game icons, every name perfectly legible and spelled exactly, all eleven in their rows. Title in heavy slanted sports type with real metal/print texture and a hard shadow (not cartoon outlines); formation in a bold brush-marker script; competition and date small and letter-spaced. NO people, players or faces — only the markers.`
      : "",
    layout === "WINNERS"
      ? `CHAMPIONS SHOWCASE RULE (always applies, whatever the style or look): NO people, players, faces, silhouettes or figures anywhere. ${opts.exactTable ? "Draw NO frames, boxes, grid, crests or names — the grid area described above stays EMPTY (the real wall of frames with the real crests is placed there afterwards)." : "The grid of frames is neat and perfectly aligned — identical frames, equal gaps — and ONLY the listed winners appear in it, in order; every other frame is empty."} ${i.champLogoUrl ? "The league / organization logo (its own reference image) appears crisp as a 3D emblem at the lower right and may echo giant and faded behind everything." : ""}`
      : "",
    layout === "STANDINGS" && opts.exactTable
      ? `STANDINGS RULE (always applies, whatever the style or look): NO people, players, faces, silhouettes or figures anywhere. Draw NO table, rows, numbers or team crests — and NO empty panel, frame, box, glass plate or border either, even where the style describes a table panel: the table area described above holds ONLY the background scene (the table KIXO places there brings its own frame). The whole title block — the title, the league line and the week / date line — sits in the band ABOVE the table area and ENDS above it (make the title smaller if it must): nothing written inside that area, nothing written below it except the footer line along the very bottom. ${i.champLogoUrl ? "The league / organization logo (reference image 1) appears crisp beside the title and giant, faded, behind everything." : ""} Do NOT write the league / organization name anywhere (no plate, ribbon or caption with it).`
      : layout === "STANDINGS"
      ? `STANDINGS RULE (always applies, whatever the style or look): NO people, players, faces, silhouettes or figures anywhere on the poster. ${i.champLogoUrl ? "The league / organization logo (its own reference image) MUST be on the poster twice: crisp and clearly visible beside the title (about 14% of the width), and as the background hero — GIANT, centred, at roughly 20–25% opacity behind the table, clearly readable through the rows. Team crests from the table are NOT the league logo: they stay small in their rows — never beside the title, never big, never faded in the background. Do NOT write the league / organization name anywhere (no plate, ribbon or caption with it under or beside the logo)." : "No league / organization logo was given: draw NO logo beside the title and NO giant watermark — never promote a team's crest from the table to that role; team crests stay small inside their rows. The background is scene, light and texture only."} The table stays perfectly aligned and readable on top of it.`
      : "",
    layout === "TOTW"
      ? `TEAM OF THE WEEK CARDS (always applies, whatever the style): EXACTLY ${i.players.filter(Boolean).length || 11} card${(i.players.filter(Boolean).length || 11) === 1 ? "" : "s"} — the ones in the text list, with their names — and NOT ONE MORE: never invent extra players, gamertags, clubs or points to fill the formation; empty spots simply stay empty. It must look like a REAL premium graphic composited by a top league's design team — the same quality and energy as a KIXO player card: the players big and dramatic inside the cards, photoreal lighting, real materials, smoke / sparks / light effects, a real photographic pitch and stadium, film grain, a cinematic grade — NOT a video-game screenshot, NOT a FIFA-style gold trading card, NOT a cartoon. The cards are BIG and fill the card area. ALL cards share ONE design (same slim frame, same size, same text layout) so the eleven read as one set; only the player-of-the-week card may differ (largest, brighter frame, crown). Each card holds exactly: the player figure, the position tag, the gamertag, its sub line${opts.refs.some((r) => /SHEET of club crests/.test(r.label)) ? " and (where the sheet has it) the club's small crest" : ""} — nothing else: no ratings, no numbers that were not given, no invented club names, no other logos. Faces from the reference photos must be recognisable; invented figures must look like different real people — different hair, skin tones, beards and poses — never clones. Keep every card fully inside the frame and keep the title clear of the cards. Razor-sharp detail, crisp perfectly formed lettering.`
      : "",
    layout === "CHAMPIONS"
      ? /\[FREESTYLE\]/.test(opts.instructions ?? "")
        ? `FREESTYLE: the art director's instructions above give you full creative control — invent your own concept for THIS poster (variation #${v.seed}-${Math.floor(Math.random() * 1e6)}); make it photoreal, cinematic and premium.`
        : /^CHAMPIONS VERSION OF THE/.test(opts.instructions ?? "")
        ? `PLAYER-CARD QUALITY: this champions poster is made in a KIXO player-card style — match that style's look, layout and typography exactly (no other scene concept, no other title font). It must look like a REAL premium composite by a top club's design team: photoreal lighting, real materials, real smoke / sparks / confetti, film grain, a cinematic grade, razor-sharp 4K detail, crisp perfectly formed lettering.${hasPhoto ? " The player is big and dramatic — the sharpest element — with the face exactly recognisable." : ""} SQUAD NAMES (if given): premium bold condensed sans-serif, uniform size, perfectly aligned, every name spelled exactly.`
        : /\[OWN LOOK\]/.test(opts.instructions ?? "")
        ? `This Champions style has its OWN LOOK defined by the art director's instructions above — follow its scene, palette and typography exactly (do not add other scene concepts).${/VICTORY NIGHT/.test(opts.instructions ?? "") ? ` BACKGROUND VARIATION for THIS poster (keep the dark cinematic spotlight look, the trophy, crest, title and names exactly as described — only the setting changes): ${victoryBg()}.` : ""} Make it a REAL cinematic photograph: physically correct light, true reflections on real metal, real smoke and paper, film grain, shallow depth of field, razor-sharp detail. SQUAD NAMES (if given, unless the style describes its own squad design): premium bold condensed sans-serif, uniform size, generous letter-spacing, in 2–3 perfectly aligned columns or one centred block — no \"|\" separators unless the style asks for them, no chunky boxed frame — every name spelled exactly.`
        : `PHOTOREAL CINEMATIC CHAMPIONS (always applies, whatever the style): it must look like a REAL photograph — the key art of a sports movie or a Nike / Adidas campaign, shot on a full-frame cinema camera with an anamorphic lens from a low angle — NOT a video-game render, NOT a cartoon or illustration, NOT a generic AI image. BAD-ASS and EPIC like the final frame of a championship movie trailer: dark, aggressive and explosive, deep crushed blacks, high contrast, hard rim lights outlining the trophy, real volumetric beams through thick smoke, sparks, embers and debris flying, heavy fine film grain and a cinematic grade in the team colours — rich and layered, never plain or empty, but always premium and controlled. SCENE CONCEPT for THIS poster (every poster gets a different one): ${champScene()}. Blend the scene into the stadium night and keep the team colours dominant.${hasPhoto ? " THE PLAYER (a photo is given): that person is the hero like on a KIXO player card — big, dramatic, the sharpest element, face exactly recognisable, celebrating with the trophy (lifting it or holding it to the chest), hard rim light, plus a giant calm portrait of the same person faded behind as an echo." : ""} The TROPHY is a real photographed object: genuine polished metal with true mirror reflections of the floodlights, tiny real-world imperfections, correct proportions and a contact shadow. The team crest crisp and faithful (its own artwork and colours unchanged) as a physical metal-and-enamel emblem with real bevels and a rim light. TITLE TYPOGRAPHY for THIS poster (overrides any other title font/material described above — every poster uses a different one): ${fontPrompt(i.fontPrimary) || champTitleType()}. The team name (if given) in a clean bold font that matches it. Letters crisp, perfectly formed and fully readable. Background echoes (faded crests / repeated title words) stay very subtle inside the smoke. Razor-sharp 4K detail. SQUAD NAMES (if given, unless the style describes its own squad design): premium bold condensed sans-serif, uniform size, generous letter-spacing, in 2–3 perfectly aligned columns or one centred block — no \"|\" separators unless the style asks for them, no chunky boxed frame — every name spelled exactly.`
      : "",
    (layout === "MATCHDAY" || layout === "RESULT") && ownLook
      ? `OWN LOOK: this style has its own look — the art director's instructions above and the STYLE reference image. Recreate that flyer's layout, lettering, materials, scene, colours and effects as exactly as possible, only with this match's crests and texts; ignore any generic match-graphic conventions that would change its look. The "${i.headline || "MATCH DAY"}" title, the two crests and the date/time are styled the way THAT flyer styles its title, logos and info.`
      : layout === "MATCHDAY" || layout === "RESULT"
      ? `SPORTS DESIGN LOOK (always applies): it must look made by a pro sports graphic designer, not a generic AI image — bold, graphic and clean like official club / EA FC / Nike match graphics: diagonal shapes and stripes, solid colour blocks, halftone and grunge print textures, film grain, a real photographic stadium (slightly desaturated, high contrast). Restraint: no glowing fog everywhere, no neon haze, no excessive sparks or lightning, no plastic chrome on everything; deep blacks and crisp edges. Crests crisp and faithful with a clean drop shadow. TYPOGRAPHY: heavy slanted sports type with solid fills, a thick outline, a short hard 3D extrusion and a hard offset shadow with a grain texture; the title's second word in a bold brush-marker script crossing the first. Match info at the bottom with no bar or box: the time big in the same sports type (left half home colour, right half away colour), the date above in bold wide letter-spaced white caps, the venue below. Never rewrite text that appears inside a logo; write each text item only once.`
      : "",
    layout === "QUALIFIERS" ? qualifiersDirection(v.seed, /\[FIXED LAYOUT\]/.test(opts.instructions ?? ""), !!opts.refs.some((r) => r.label.startsWith("the main subject")), !!i.champLogoUrl, opts.exactTable ? qualTableAreaText(opts.format) : undefined) : "",
    layout === "EVENT" ? eventDirection(v.seed, /\[FIXED LAYOUT\]/.test(opts.instructions ?? ""), !!opts.refs.some((r) => r.label.startsWith("the main subject")), !!i.champLogoUrl || hasTeamLogo) : "",
    layout === "LOGO" ? "" : `NEVER include animals, birds, eagles, wings, mascots or creatures of any kind unless ${adminLed ? "the art director's instructions or " : ""}the user's extra direction explicitly asks for one.`,
    `STRICT TEXT RULE: the poster may only contain the text items listed below${i.aiCopy === "on" ? " (plus the optional hype words)" : ""}. If something has no text listed (squad names, prize, date, venue, scorers, competition…), leave that element out completely — never invent names, prizes, money amounts, dates, places or titles.`,
    flyerSlots.length ? `FLYER TEXT LINES (very important): this style copies a reference flyer, and each text item below names the flyer line it replaces and where that line sits. Put each text EXACTLY there and letter it EXACTLY like that line in the reference flyer — the SAME TYPEFACE STYLE (the same letterforms: heavy condensed caps, brush/handwritten script, serif, outlined, letter-spaced…), the SAME SIZE and alignment, the SAME COLOUR, and the SAME 3D TREATMENT and EFFECTS (chrome or gold extrusion with bevels, neon tube glow, outline, hard drop shadow, gradient faces, fading echo…). The player's NAME takes the flyer's big title lettering: the same font style and the same 3D/chrome/neon build, only the letters change. Look at the flyer line by line and reproduce its lettering craft for the matching text — never substitute a plain or different font. Flyer lines whose text is not given stay EMPTY (no placeholder, no invented words) — the layout simply closes up. These placements override any tagline / subtitle / footer mentions in the instructions above.` : "",
    flyerSlots.length && flyerSlots.some((sl) => !(i.slots?.[sl.key] ?? "").trim())
      ? `EMPTY FLYER LINES — these lines of the flyer have NO text this time, so draw NOTHING for them: no text, no placeholder, no label, no filler, not the flyer's own words — just the scene continuing there: ${flyerSlots
          .filter((sl) => !(i.slots?.[sl.key] ?? "").trim())
          .map((sl) => sl.label)
          .join("; ")}.`
      : "",
    lines.length ? `Text on the poster — spell EVERY item exactly as written, letter for letter, keep capitalisation and symbols like _ - | $:\n${lines.join("\n")}` : "",
    lines.length && inventory.length === lines.length
      ? `TEXT INVENTORY (final check): the finished poster contains EXACTLY ${inventory.length === 1 ? "this one text item" : `these ${inventory.length} text items`}: ${inventory.map(q).join(", ")}${i.aiCopy === "on" ? " (plus the optional hype words)" : ""} — and NO other words, letters, numbers, labels, names, lines, hashtags, dates, prices, addresses, watermarks, team or league names anywhere: not the reference flyer's words, not labels like "HOSTED BY" or "MUSIC BY", not the letters of the crest written out. Before finishing, read every piece of text on the poster — anything not in this list must be removed.`
      : "",
    `REALISM${adminLed ? " (unless the art director's instructions ask for a different look)" : ""}: photorealistic premium sports-advertising quality, like a top designer composited real photography with real 3D renders. Real photographic lighting, real materials (true chrome, polished gold, glass, smoke, wet concrete, stadium floodlights), physically correct reflections and shadows, natural skin texture, shallow depth of field, razor-sharp 4K detail and crisp, perfectly formed lettering. It must NOT look like a cartoon, an illustration or a generic AI image: no plastic skin, no mushy or melted text, no over-smoothed textures, no random symbols, no warped faces or hands.`,
    opts.refColours && (!i.colorMode || i.colorMode === "template")
      ? `REFERENCE COLOURS (this style copies its reference image, and the user kept the style's own colours): ${opts.refColours} Keep the whole poster in this palette — background, lighting, lettering materials and effects — exactly as the reference shows it; do not drift to other colours — these colours beat any colour word anywhere else in this brief (no gold unless the reference is gold).`
      : "",
    layout === "LOGO"
      ? ""
      : `KIXO DESIGN STANDARD (always applies, whatever the style — in the style's own materials and mood): the poster must stand next to the work of the top esports / club design studios, never look like a simple AI image.
- DEPTH & DENSITY: at least six visible layers front to back — a real environment with depth → ${noEcho ? "big graphic lettering, shapes or light behind the centrepiece (never a faded copy of the crest)" : "a giant faded echo (lettering or logo)"} → the centrepiece (the figure, trophy, table or emblem: about 40% of the frame, the sharpest element) → the main lettering pieces → the designed information lock-up → foreground particles slightly out of focus. Every area of the frame carries something (texture, light, graphic marks such as thin lines, brackets, small letter-spaced repeats of the given texts, dots or halftone) — no big empty areas, no plain text sitting on a flat gradient${opts.exactTable ? " (except the table area a rule above says to leave empty)" : ""}.
- LETTERING: titles are designed lettering pieces, not typed text — real materials (chrome, gold, glass, stone, neon, paper — whatever the style uses), thick bevels, hard shadows, perfect kerning, razor-sharp edges, a clear hierarchy (one hero word, one secondary line, small letter-spaced details); every information line sits inside a designed lock-up (plates, bars, boxes, ribbons, icons, dividers) and stays perfectly legible.
- LIGHT & GRADE: one key light with real falloff, coloured rim lights separating every layer, real reflections and contact shadows, volumetric beams through haze, lens flare only where light hits the lens; one cohesive cinematic grade, deep but detailed blacks, controlled highlights, fine film grain, crisp micro-contrast.
- CRAFT: razor-sharp 4K detail, clean cut-outs with natural edges, physically real effects (sparks, smoke, shards, paper, water), no plastic CGI, no over-smoothing, no HDR halos, no melted shapes, no clutter that hurts legibility.`,
    userChoices ? `FINAL CHECK — make sure every USER CHOICE above is visible in the poster (background scene, colours, fonts, language, extra idea).` : "",
    `Keep ${exactLogos ? "one of the bottom corners" : "at least one corner of the poster (ideally the bottom-right)"} calm — no text, no face, no important detail there — a small brand mark goes there. Never draw borders, frame lines, corner brackets, crop marks or "× × ×" decorations.`,
    i.aiCopy === "on"
      ? `You MAY add 1–2 short, punchy hype words that fit this poster (e.g. NEW SIGNING, WELCOME, MVP, GAME DAY, LET'S GO, CAMPEONES), written${i.language && i.language !== "English" ? ` in ${i.language}` : ""} and styled as part of the design. Never change, translate or misspell the listed names.`
      : "",
    adminLed
      ? `FINAL REMINDER: the layout, composition, figures, style and effects must follow the ART DIRECTOR'S DESIGN INSTRUCTIONS at the top of this brief.`
      : "",
    `THE PHOTO IS NOT CONTENT (very important): the uploaded photo is only a picture of the PERSON. Anything printed on their kit — a club badge, sponsor names, brand marks, words, numbers — belongs to that kit and is NOT the team, NOT a logo for this poster and NOT text for this poster. Never read, copy, echo, enlarge or rewrite any word, letter, number or badge that appears in the photo: not as giant background letters, not as a crest or emblem, not as a name, tagline or team name. ${i.team ? `The team is ${q(i.team)} — that is the only team name on this poster.` : layout === "TOTW" ? "Club names appear only as the small sub line on the cards that list one." : "No team name was given — so no team name or club letters anywhere."} ${hasTeamLogo ? "The team crest is ONLY the crest given as its own reference image — the badge on the shirt in the photo is a different kit; leave it where it is on the shirt and never draw it as a separate element." : "No crest was given — draw no crest, badge or emblem anywhere (the badge on the shirt stays only on the shirt)."}`,
    layout === "PLAYER" && i.bgPose !== "silence"
      ? [
          `POSES: do NOT use the finger-on-lips "shush" gesture on any figure — it is banned (overused).`,
          // A fixed layout names every figure's pose itself: the general "action moment" advice must not override it.
          /\[FIXED LAYOUT\]/.test(opts.instructions ?? "")
            ? "The design instructions above describe every figure's pose — follow them exactly: no kicking, no ball and no running unless they say so."
            : "Unless the design instructions describe the poses, the main full-body figure is a real ACTION moment (sprinting, dribbling, striking, leaping, a knee-slide, a celebration with arms out) — never a stiff standing pose — and the second figure is a calm, intense portrait with a closed mouth (no screaming).",
          exactRef
            ? `The figures take the poses of the STYLE reference's figures — the same on every poster${i.photo2Url ? " (except the figure made from the user's SECOND photo: that one keeps its photographed pose)" : ""}.`
            : /\[FIXED LAYOUT\]/.test(opts.instructions ?? "")
              ? ""
              : "Vary the pose from poster to poster.",
        ]
          .filter(Boolean)
          .join(" ")
      : "",
    layout === "PLAYER"
      ? `GIANT BACKGROUND LETTERS: wherever this design has huge background / graphic lettering, it spells the PLAYER'S NAME (gamertag) ${i.name ? q(i.name) : ""} — never the team name, never a word from the photo or the crest. The player's name may therefore appear twice: once as the main title and once as that graphic echo.`
      : "",
    layout === "STANDINGS" || layout === "MATCHDAY" || layout === "CHAMPIONS" || layout === "TOTW"
      ? ""
      : `NO SMALL TEAM-NAME LINE: never print a team name as a small caption, label, tag or tiny letter-spaced line — not at the top, not at the bottom, not under the player's name, not beside the crest and never in the calm brand-mark corner. ${i.team ? `The team name ${q(i.team)} appears ONLY as the big design element this brief describes for it, once.` : "The team is shown by its crest only (if one was given) — no team name text anywhere."}`,
    `Only write the text items listed above${i.aiCopy === "on" ? " (plus those optional hype words)" : ""}. Never write labels or field names such as "LOGO", "CREST", "POSITION", "TEAM", "NAME" or "PHOTO" unless they are part of a listed item. Do not add any other text, words, watermarks, sponsor logos, brand names or website addresses. Words that appear INSIDE a logo or crest (club names, "ESPORTS", "EST. 2023", mottos) stay only inside that logo — never copy them out as a title, name, tagline or any separate text. Never invent club info, years, slogans or "edition" lines. No real company or league logos except the provided crests and badges. NEVER take a crest, badge or logo from the player's photo (e.g. the club badge or sponsor on their shirt) and place it on the poster as a separate logo or emblem — the only crests/logos allowed as poster elements are the ones given as their own reference images. If no crest image is given, draw no crest at all.`,
  ]
    .filter(Boolean)
    .join("\n\n");
}

/** Pro AI quality: subscribers get their plan's quality, everyone else the global setting. */
export async function qualityFor(userId: string) {
  const fallback = (await getSettings()).pro_quality;
  try {
    const u = await db.user.findUnique({ where: { id: userId }, select: { planId: true, subscriptionStatus: true, currentPeriodEnd: true } });
    const comp = u?.subscriptionStatus === "comp" && !!u.currentPeriodEnd && u.currentPeriodEnd.getTime() > Date.now();
    if (u?.planId && (comp || ["active", "canceling", "pending", "trialing", "past_due"].includes(u.subscriptionStatus ?? ""))) {
      const { loadPricing } = await import("./pricing");
      const plan = (await loadPricing()).plans.find((p) => p.id === u.planId);
      if (plan?.quality) return plan.quality;
    }
  } catch {
    /* fall back */
  }
  return fallback;
}

/** Charges credits, asks the model for the full poster, stores it. Refunds on failure. */
export async function generateProForBanner(opts: {
  bannerId: string;
  userId: string;
  cost: number;
  prompt: string;
  refs: ProRef[];
  regenerate?: boolean;
  format?: "post" | "story" | "banner" | "square";
  /** Edits of a finished poster: Nano Banana Pro keeps the image identical best. */
  edit?: boolean;
  /** The style's "Design instructions for the AI" — given in full to every step of the mixes. */
  instructions?: string | null;
  /** One pass at 4K by Nano Banana Pro, text included (team of the week: eleven small faces would soften in a re-render). */
  onePass?: boolean;
  /** OpenAI GPT Image only — no fal.ai steps at all (the admin's choice for the team of the week). */
  openaiOnly?: boolean;
  /** Standings: the exact table KIXO draws on the finished background. */
  tableOverlay?: import("./standings-table").TableSpec | null;
  /** Qualifiers: KIXO draws the regions table (real flags, exact numbers) on the finished background. */
  qualOverlay?: import("./qualifiers-table").QualTableSpec | null;
  /** Winners showcase: KIXO draws the wall of frames (real crests, exact names) on the finished background. */
  winnersOverlay?: import("./winners-grid").WinnersSpec | null;
  /** Admin comparison: force one poster generator instead of the Settings choice. */
  modelOverride?: string;
}) {
  // Big sizes first so the poster keeps its detail; smaller ones are only used if the model rejects the size.
  const fmtSizes =
    opts.format === "story" ? ["1440x2560", "1152x2048", "1024x1536"]
    : opts.format === "banner" ? ["2560x1440", "2048x1152", "1536x1024"]
    : opts.format === "square" ? ["2048x2048", "1536x1536", "1024x1024"]
    : undefined;
  if (opts.cost > 0) {
    await changeCredits({
      userId: opts.userId,
      amount: -opts.cost,
      type: "GENERATION",
      bannerId: opts.bannerId,
      note: opts.regenerate ? "Pro AI — new version" : "Pro AI poster",
    });
  }
  // Saved right away (also when it fails) so admins can read exactly what the AI was asked.
  await db.banner.update({ where: { id: opts.bannerId }, data: { prompt: opts.prompt.slice(0, 40000) } }).catch(() => {});
  let usedModel = "OpenAI GPT Image";
  // The whole job must finish inside the server's 300 s limit — every AI step gets a share of the time
  // that is left, so a slow step never leaves the poster stuck "Generating…" (it fails and refunds instead).
  const started = Date.now();
  const stage = (s: string) => db.banner.update({ where: { id: opts.bannerId }, data: { stage: s } }).catch(() => {});
  const TOTAL_MS = 272_000;
  const left = () => TOTAL_MS - (Date.now() - started);
  const clamp = (ms: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, ms));
  try {
    const images: { bytes: Buffer; type: string }[] = [];
    for (const r of opts.refs.filter((x) => !x.overlay)) {
      const bytes = await loadBytes(r.url);
      images.push({ bytes, type: sniffImage(bytes) ?? "image/png" });
    }
    const quality = await qualityFor(opts.userId);
    let poster!: Buffer;
    const isWide = /\[WIDE\]/.test(opts.prompt);
    const refUrls = opts.refs.filter((x) => !x.overlay).map((x) => x.url);
    // Main generator chosen by the admin: Nano Banana Pro (default, best) or OpenAI. If Nano Banana fails, OpenAI takes over.
    let made = false;
    const posterModel = opts.modelOverride ?? (opts.openaiOnly ? "openai" : (await getSettings()).poster_model);
    // One pass at 4K (team of the week): Nano Banana Pro paints AND writes everything; nothing re-renders it afterwards.
    // Hedged against the 300 s limit: if the 4K pass hasn't answered after ~105 s, an OpenAI backup starts alongside
    // it, so the poster still lands in time if the 4K pass is slow or fails.
    if (opts.onePass && !opts.edit && posterModel !== "openai") {
      const fb = await import("./ai-fallback");
      if (fb.fallbackReady()) {
        await stage("art");
        let nanoDone = false;
        let hedgeStarted = false;
        let timer: ReturnType<typeof setTimeout> | null = null;
        const nano = fb
          .nanoBananaDirect(opts.prompt, refUrls, opts.format, isWide, clamp(left() - 65_000, 60_000, 205_000))
          .then((buf) => ({ buf, model: "Nano Banana Pro 4K (one pass)" }))
          .catch((e) => ({ error: e instanceof Error ? e.message : String(e) }))
          .finally(() => (nanoDone = true));
        const hedge = new Promise<{ buf: Buffer; model: string } | { error: string } | null>((resolve) => {
          timer = setTimeout(async () => {
            if (nanoDone) return resolve(null);
            hedgeStarted = true;
            try {
              const sizes = fmtSizes ?? (isWide ? ["2304x1536", "1536x1024"] : ["1600x2000", "1088x1360", "1024x1536"]);
              const buf = await generatePoster(opts.prompt, images, "medium", sizes, left() - 5_000);
              resolve({ buf, model: "OpenAI GPT Image (backup — the 4K pass was slow)" });
            } catch (e) {
              resolve({ error: e instanceof Error ? e.message : String(e) });
            }
          }, Math.max(10_000, Math.min(105_000, left() - 160_000)));
        });
        const first = await nano;
        if ("buf" in first) {
          poster = first.buf;
          made = true;
          usedModel = first.model;
          await import("./ai-alerts").then((a) => a.clearDegraded()).catch(() => {});
        } else {
          await import("./activity").then((mm) => mm.logActivity("site", "mix", `⚠️ Nano Banana Pro 4K one-pass failed — using the OpenAI backup: ${first.error.slice(0, 200)}`, "warn")).catch(() => {});
          await import("./ai-alerts").then(async (a) => {
            await a.noteDegraded(first.error);
            const kind = a.providerOutage(first.error);
            if (kind === "fal_billing") await a.alertAdminsOutage(kind, first.error);
          }).catch(() => {});
          if (hedgeStarted) {
            const backup = await hedge;
            if (backup && "buf" in backup) {
              poster = backup.buf;
              made = true;
              usedModel = backup.model;
            } else if (backup && "error" in backup) {
              throw new Error(`The 4K pass failed (${first.error.slice(0, 120)}) and the backup too (${backup.error.slice(0, 120)})`);
            }
          } else if (timer) clearTimeout(timer); // it failed early — the normal path below has plenty of time
        }
      }
    }
    // MIX: Nano Banana Pro paints the artwork (people, background, crests, effects) with NO text,
    // then OpenAI adds the exact text on top — Nano's look + OpenAI's exact spelling.
    const mixModes = ["mix", "mix3", "flux-mix", "seedream-mix"];
    if (!made && !opts.edit && mixModes.includes(posterModel)) {
      const fb = await import("./ai-fallback");
      if (fb.fallbackReady()) {
        try {
          // The admin's "Design instructions for the AI" — every step of the mix reads them.
          const director = resolveConditionals(opts.instructions ?? "", { photo: opts.refs.some((r) => r.label.startsWith("the main subject")) }).slice(0, 20000);
          const artStep = posterModel === "flux-mix" ? fb.fluxPoster : posterModel === "seedream-mix" ? fb.seedreamArt : fb.nanoBananaArt;
          // Art step: leave at least ~105 s for the text step (and FLUX in between).
          await stage("art");
          let artRes = await artStep(
            `${opts.prompt}\n\nIMPORTANT — THIS STEP IS ARTWORK ONLY: create the complete finished poster artwork exactly as described (people, background, crests, trophy, effects, lighting, colours, layout) but with ABSOLUTELY NO TEXT, letters, numbers or words anywhere (logos/crests keep their own artwork). Leave clean, well-composed empty space where each text item listed above will be placed (the big title, the name, the number, the small lines). The text is added in a second step.${/TEAM OF THE WEEK CARDS/.test(opts.prompt) ? " For the player cards: draw every card complete with its frame, its player and an EMPTY dark plate at the bottom (the gamertag and sub line go there next) and an empty small badge in the corner (the position goes there) — all eleven cards the same size, nothing written on them yet." : ""}`,
            refUrls,
            opts.format,
            isWide,
            clamp(left() - 105_000, 45_000, 160_000),
          );
          // ALL 3: FLUX.2 makes Nano Banana's art look like a real photo shoot (keeps it identical).
          // Only when there is still time for it AND the text step afterwards.
          if ((posterModel === "mix3" || posterModel === "seedream-mix") && left() > 135_000) {
            try {
              await stage("realism");
              artRes = await fb.fluxRealism(artRes.url, opts.format, isWide, director, clamp(left() - 85_000, 40_000, 120_000));
            } catch (e) {
              await import("./activity").then((mm) => mm.logActivity("site", "mix3", `⚠️ FLUX.2 realism step skipped: ${(e instanceof Error ? e.message : String(e)).slice(0, 160)}`, "warn")).catch(() => {});
            }
          } else if (posterModel === "mix3" || posterModel === "seedream-mix") {
            await import("./activity").then((mm) => mm.logActivity("site", "mix3", "⏱️ FLUX.2 realism step skipped — not enough time left (the art step was slow)", "warn")).catch(() => {});
          }
          // The text model works at the poster's output size — send it the art at that size (faster upload, same detail).
          const sizesForText = fmtSizes ?? (isWide ? ["2304x1536", "1536x1024"] : ["1600x2000", "1088x1360", "1024x1536"]);
          const [tw, th] = sizesForText[0].split("x").map(Number);
          const art = await sharp(artRes.buf).resize({ width: tw, height: th, fit: "inside", withoutEnlargement: true }).png().toBuffer().catch(() => artRes.buf);
          const keep = opts.prompt
            .split("\n\n")
            .filter((sec) => /^(USER CHOICES|TITLE FONT|NAMES FONT|Write generic words|TYPOGRAPHY|Typography|STRICT TEXT RULE|Text on the poster|Only write the text|You MAY add)/.test(sec.trim()))
            .join("\n\n");
          const textPrompt = [
            director
              ? `ART DIRECTOR'S DESIGN INSTRUCTIONS for this poster (read ALL of them — the artwork already follows them; now place and style EVERY text item exactly as they describe: positions, fonts, sizes, materials, effects and colours):\n${director}`
              : "",
            `Reference image 1 is a finished poster artwork that has NO TEXT yet. Keep EVERYTHING in it exactly as it is — the same people and faces, poses, background, crests, trophy, colours, lighting, effects, composition and framing. Do not redraw, move or restyle anything.`,
            `Your only job: ADD the text items listed below onto it, designed as premium, bad-ass sports typography that matches the artwork (real materials, depth, glow and shadows that fit its lighting), placed in the clean empty spaces — title big and bold, the name prominent, the number huge, small lines small and letter-spaced. Text must never cover faces.`,
            keep,
            `Spell every item exactly, letter for letter, each once. Add no other words.`,
          ].filter(Boolean).join("\n\n");
          // Text step: full quality when there is time; a faster pass (medium quality, standard size) when the art steps were slow.
          const textBudget = left() - 6_000;
          if (textBudget < 50_000) throw new Error(`out of time before the text step (${Math.round((Date.now() - started) / 1000)} s used)`);
          const fast = textBudget < 115_000;
          await stage("text");
          poster = await generatePoster(textPrompt, [{ bytes: art, type: sniffImage(art) ?? "image/png" }], fast ? "medium" : quality, fast ? [...sizesForText].reverse() : sizesForText, textBudget);
          if (fast) await import("./activity").then((mm) => mm.logActivity("site", "mix", "⏱️ Text step ran in fast mode (the art steps used most of the time)", "warn")).catch(() => {});
          made = true;
          usedModel = posterModel === "seedream-mix" ? "Seedream Mix: Seedream art + FLUX.2 realism + OpenAI text" : posterModel === "mix3" ? "All 3: Nano Banana art + FLUX.2 realism + OpenAI text" : posterModel === "flux-mix" ? "Mix: FLUX.2 Pro art + OpenAI text" : "Mix: Nano Banana Pro art + OpenAI text";
          await import("./ai-alerts").then((a) => a.clearDegraded()).catch(() => {});
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          await import("./activity").then((mm) => mm.logActivity("site", "mix", `⚠️ Mix generator failed — using OpenAI alone (lower quality): ${msg.slice(0, 200)}`, "warn")).catch(() => {});
          // The admin should know the posters just lost the 4K mix — above all when it's the fal.ai balance.
          await import("./ai-alerts").then(async (a) => {
            await a.noteDegraded(msg);
            const kind = a.providerOutage(msg);
            if (kind === "fal_billing") await a.alertAdminsOutage(kind, msg);
          }).catch(() => {});
        }
      }
    }
    if (!made && !opts.edit && posterModel === "flux") {
      const fb = await import("./ai-fallback");
      if (fb.fallbackReady()) {
        try {
          await stage("art");
          poster = (await fb.fluxPoster(opts.prompt, refUrls, opts.format, isWide)).buf;
          made = true;
          usedModel = "FLUX.2 Pro";
        } catch (e) {
          await import("./activity").then((mm) => mm.logActivity("site", "flux", `⚠️ FLUX.2 Pro failed — using OpenAI instead: ${(e instanceof Error ? e.message : String(e)).slice(0, 200)}`, "warn")).catch(() => {});
        }
      }
    }
    if (!made && (opts.edit || posterModel === "nano-pro") && images.length) {
      const fb = await import("./ai-fallback");
      if (fb.fallbackReady()) {
        try {
          await stage(opts.edit ? "edit" : "art");
          poster = await fb.nanoBananaPoster(opts.prompt, refUrls, opts.format, isWide);
          made = true;
          usedModel = "Nano Banana Pro";
        } catch (e) {
          await import("./activity").then((mm) => mm.logActivity("site", "nano_banana", `⚠️ Nano Banana Pro failed — using OpenAI instead: ${(e instanceof Error ? e.message : String(e)).slice(0, 200)}`, "warn")).catch(() => {});
        }
      }
    }
    if (!made && left() < 75_000) throw new Error(`The AI steps took too long (${Math.round((Date.now() - started) / 1000)} s) — please try again.`);
    if (!made) try {
      // Wide styles ([WIDE] in the art director's instructions) are made in landscape.
      const wide = fmtSizes ?? (/\[WIDE\]/.test(opts.prompt) ? ["2304x1536", "1536x1024"] : undefined);
      await stage("openai");
      poster = await generatePoster(opts.prompt, images, left() < 115_000 ? "medium" : quality, wide, left() - 5_000);
    } catch (e) {
      const m = e instanceof Error ? e.message : String(e);
      // Still blocked after the text retries: one of the extra images (style reference, logo, trophy)
      // may be what the filter dislikes — try once more with only the first image (the photo).
      if (!/moderation_blocked|safety system/i.test(m)) throw e;
      if (images.length <= 1) {
        const fb = await import("./ai-fallback");
        if (!fb.fallbackReady() || !images.length) throw new Error(`PHOTO_BLOCKED: the photo was rejected by OpenAI's safety filter. ${m}`);
        try {
          const b = await fb.backupPoster(opts.prompt, refUrls, opts.format, isWide);
          poster = b.buf;
          usedModel = `${b.model} (backup)`;
          await import("./activity").then((mm) => mm.logActivity("site", "fallback", `🛟 OpenAI refused the photo — made with the backup generator (${b.model}) instead`)).catch(() => {});
        } catch (e3) {
          throw new Error(`PHOTO_BLOCKED: the photo was rejected by OpenAI's safety filter and the backup generator. ${m} | ${e3 instanceof Error ? e3.message : e3}`);
        }
      } else {
      const onlyFirst = opts.prompt
        .split("\n\n")
        .filter((sec) => !/^Reference image (?!1 )\d+ is /.test(sec.trim()))
        .join("\n\n");
      try {
        if (left() < 60_000) throw e;
        poster = await generatePoster(onlyFirst, images.slice(0, 1), left() < 115_000 ? "medium" : quality, fmtSizes ?? (/\[WIDE\]/.test(opts.prompt) ? ["2304x1536", "1536x1024"] : undefined), left() - 5_000);
      } catch (e2) {
        const m2 = e2 instanceof Error ? e2.message : String(e2);
        if (/moderation_blocked|safety system/i.test(m2)) {
          // OpenAI refused (often a false alarm, e.g. a shirtless player) — try the backup generator.
          const fb = await import("./ai-fallback");
          if (!fb.fallbackReady()) throw new Error(`PHOTO_BLOCKED: the photo was rejected by OpenAI's safety filter. ${m2}`);
          try {
            const b = await fb.backupPoster(opts.prompt, refUrls, opts.format, isWide);
            poster = b.buf;
            usedModel = `${b.model} (backup)`;
            await import("./activity").then((m) => m.logActivity("site", "fallback", `🛟 OpenAI refused the photo — made with the backup generator (${b.model}) instead`)).catch(() => {});
          } catch (e3) {
            throw new Error(`PHOTO_BLOCKED: the photo was rejected by OpenAI's safety filter and the backup generator. ${m2} | ${e3 instanceof Error ? e3.message : e3}`);
          }
        } else throw e2;
      }
      }
    }
    await stage("finishing");
    if (opts.tableOverlay) {
      const { overlayStandingsTable } = await import("./standings-table");
      poster = await overlayStandingsTable(poster, opts.tableOverlay);
    }
    if (opts.qualOverlay) {
      try {
        const { overlayQualTable } = await import("./qualifiers-table");
        poster = await overlayQualTable(poster, opts.qualOverlay);
      } catch (e) {
        console.error("qualifiers table overlay failed (poster kept without it)", e);
      }
    }
    if (opts.winnersOverlay) {
      try {
        const { overlayWinnersGrid } = await import("./winners-grid");
        poster = await overlayWinnersGrid(poster, opts.winnersOverlay);
      } catch (e) {
        console.error("winners grid overlay failed (poster kept without it)", e);
      }
    }
    const overlays = opts.refs.filter((x) => x.overlay);
    if (overlays.length) {
      const logos: { bytes: Buffer; corner: LogoSpot; fx?: "3d" }[] = [];
      for (const o of overlays) logos.push({ bytes: await loadBytes(o.url), corner: o.overlay!, fx: o.fx });
      poster = await placeLogos(poster, logos);
    }
    // The brand mark stays away from the pasted crests: top corners, and the bottom centre under a hero crest.
    const avoid = overlays.flatMap((o): ("tl" | "tr" | "tc" | "bc")[] => (o.overlay === "tl" || o.overlay === "tr" || o.overlay === "tc" || o.overlay === "bc" ? [o.overlay] : o.overlay === "hero" ? ["bc"] : []));
    let out = await stampLogo(poster, avoid);
    // A 4K one-pass render is a 20+ MB PNG: keep it crisp but phone-friendly as a top-quality JPEG.
    let type = "image/png";
    if (out.length > 9 * 1024 * 1024) {
      out = await sharp(out).jpeg({ quality: 94, chromaSubsampling: "4:4:4", mozjpeg: true }).toBuffer();
      type = "image/jpeg";
    }
    const url = await saveFile("banners", out, type);
    const old = await db.banner.findUnique({ where: { id: opts.bannerId }, select: { finalUrl: true } });
    const updated = await db.banner.update({ where: { id: opts.bannerId }, data: { status: "READY", error: null, finalUrl: url, prompt: `[Made with: ${usedModel}]\n\n${opts.prompt}`.slice(0, 40000) } });
    if (old?.finalUrl && old.finalUrl !== url) await deleteFile(old.finalUrl);
    await (await import("./rev")).bumpRev();
    await logGeneration({ bannerId: opts.bannerId, userId: opts.userId, cost: opts.cost, ok: true, regenerate: opts.regenerate, image: out });
    { const { postShowcase } = await import("./discord-logs"); await postShowcase({ bannerId: opts.bannerId, userId: opts.userId, image: out }); }
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
    await logGeneration({ bannerId: opts.bannerId, userId: opts.userId, cost: opts.cost, ok: false, regenerate: opts.regenerate, error: msg });
    // Provider out of credits / locked? Tell the admins (DM + live log), once an hour.
    try {
      const { providerOutage, alertAdminsOutage } = await import("./ai-alerts");
      const kind = providerOutage(msg);
      if (kind) await alertAdminsOutage(kind, msg);
    } catch {
      /* never block the refund path */
    }
    await db.banner.update({
      where: { id: opts.bannerId },
      data: { status: "FAILED", error: msg },
    });
    if (/moderation|safety|content_policy/i.test(msg)) {
      let detail = msg;
      try {
        const { explainModeration, moderationAdvice } = await import("./moderation-check");
        const parts: { what: string; text?: string; image?: Buffer }[] = [{ what: "the brief", text: opts.prompt }];
        const picRefs = opts.refs.filter((x) => !x.overlay);
        for (const [n, r] of picRefs.entries()) parts.push({ what: `reference image ${n + 1} (${r.label.slice(0, 40)})`, image: await loadBytes(r.url).catch(() => undefined) });
        detail = `${msg.slice(0, 160)} — ${moderationAdvice(await explainModeration(parts.filter((x) => x.text || x.image)))}`;
        await db.banner.update({ where: { id: opts.bannerId }, data: { error: detail.slice(0, 500) } }).catch(() => {});
      } catch {
        /* keep OpenAI's message */
      }
      throw Object.assign(new HttpError(400, "err_blocked"), { detail });
    }
    throw new HttpError(502, "generation_failed");
  }
}

/** All image URLs inside inputs must be ours. */
export function assertInputUrls(i: BannerInputs) {
  [i.homeLogoUrl, i.awayLogoUrl, i.champLogoUrl, i.trophyUrl, ...(i.tableLogos ?? []), ...(i.winnerLogos ?? []), ...(i.playerPhotos ?? []), ...(i.playerLogos ?? []), ...(i.partnerLogos ?? []), i.refImageUrl, i.photo2Url].forEach((u) => assertOwnUrl(u || null));
}

function colourLine(i: BannerInputs, style: TemplateStyle, v: Variation, adminLed = false) {
  if (i.colorMode === "custom" && i.color1) {
    return `COLOURS: main colour ${i.color1}${i.color2 ? `, second colour ${i.color2}` : ""}, with deep dark shadows. Recolour EVERYTHING to this palette — lighting, background, title, confetti, effects and metals. Do not default to gold unless it is one of these colours.`;
  }
  if (i.colorMode === "team") {
    return `COLOURS: take the palette from the TEAM CREST (reference image) — its own main colours dominate the lighting, background glow, title, confetti and effects, with deep dark shadows${adminLed ? " (unless the art director's instructions specify colours)" : ""}. Do not default to gold unless gold is one of the crest's main colours.`;
  }
  if (v.palette && adminLed) {
    // The art director's colours win over the random palette.
    return `COLOURS: use the colours the art director's instructions describe. Only if they don't mention colours, use a ${v.palette.name} palette (main ${v.palette.primary}, accent ${v.palette.accent}, shadows ${v.palette.dark}).`;
  }
  if (v.palette) {
    return `COLOURS: a ${v.palette.name} palette — main ${v.palette.primary}, accent/glow ${v.palette.accent}, shadows ${v.palette.dark}. Recolour EVERYTHING to this palette — lighting, background, title, confetti, effects and metals — instead of the base style's colours. Do not default to gold unless gold is in this palette.`;
  }
  return `COLOURS: main colour ${style.primary}, accent/glow ${style.accent}, deep shadows ${style.dark}.`;
}

/** Team-set info kept in a banner's design JSON. */
export function seriesInfo(design: unknown): { seriesRootId?: string; variation?: Variation } {
  const d = (design ?? {}) as { seriesRootId?: unknown; variation?: unknown };
  return {
    seriesRootId: typeof d.seriesRootId === "string" ? d.seriesRootId : undefined,
    variation: d.variation && typeof d.variation === "object" ? (d.variation as Variation) : undefined,
  };
}

/** The current image of a team set's first card (it can change if that card is regenerated). */
export async function seriesRefUrl(userId: string, rootId: string | undefined) {
  if (!rootId) return null;
  const root = await db.banner.findFirst({ where: { id: rootId, userId, status: "READY" }, select: { finalUrl: true } });
  return root?.finalUrl ?? null;
}
