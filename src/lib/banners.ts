import { z } from "zod";
import { Prisma } from "@prisma/client";
import { db } from "./db";
import { HttpError } from "./auth";
import { backgroundProvider, BLOCKED, buildPrompt, canRemoveBackground, generatePoster, generateBackground, removeBackground } from "./ai";
import { deleteFile, isStorageUrl, loadBytes, saveFile, sniffImage } from "./storage";
import { changeCredits } from "./credits";
import { BannerInputs, DEFAULT_DESIGN, EMPTY_INPUTS, LayoutKind, TemplateStyle } from "./templates";
import { bgPosePrompt, bgScenePrompt, createVariation, fontPrompt, trophyPrompt, type Variation } from "./pro-options";
import { placeLogos, stampLogo } from "./stamp";
import { logGeneration } from "./discord";
import { textPoster } from "./twilio";
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
  trophy: str(60),
  bgPose: str(40),
  bgScene: str(40),
  aiCopy: z.enum(["on", "off", ""]).default("off"),
  aiLogo: z.enum(["on", "off", ""]).default(""),
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
/** Where the real (uploaded) logo is pasted on the finished poster. */
export type LogoSpot = "tl" | "tr" | "hero" | "left" | "right";

export interface ProRef {
  url: string;
  label: string;
  /** Exact-logo mode: not sent to the AI — pasted into this corner of the finished poster instead. */
  overlay?: LogoSpot;
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
}): ProRef[] {
  const { inputs: i, layout } = opts;
  const refs: ProRef[] = [];
  if (opts.photoUrl) {
    refs.push({
      url: opts.photoUrl,
      label:
        layout === "LINEUP" || layout === "RESULT" || layout === "MATCHDAY"
          ? "a player photo to feature as the hero image. Keep the face exactly recognisable — same person, not a lookalike."
          : "the main subject. Keep their face, hair, skin tone and body exactly recognisable — same person, not a lookalike. Keep their clothing/kit as in the photo. Retouch it like a pro sports photographer: a clean full cut-out (no traces of the original background), relit to match the poster's lighting with a strong coloured rim light, sharper detail, rich contrast and a cinematic colour grade — even if the uploaded photo is a low-quality phone picture.",
    });
  }
  // Default: the real logo is pasted onto the finished poster (the AI redraws logos inaccurately).
  // Default: the AI builds the crest into the design as a 3D emblem (blends far better). "off" = paste the exact logo.
  const exact = i.aiLogo === "off";
  const crest = (url: string, who: string, corner: LogoSpot = "tl") =>
    exact
      ? refs.push({ url, label: `the crest/logo of ${who} (placed afterwards)`, overlay: corner })
      : refs.push({
      url,
      label: `the crest/logo of ${who}. Keep its exact shape, letters, symbols and layout (do not redesign it, do not add or remove letters), but render it as a BADASS premium 3D emblem: a thick polished-chrome rim with bevelled edges, embossed relief with real depth, enamel or metallic fill in the poster's colours, sharp specular reflections, a coloured rim light and soft glow, slight perspective tilt, sparks or energy around it. Make it a hero element, large and prominent and BUILT INTO the scene — lit by the same lights, casting shadows, with the background's particles and effects around and in front of it, never a flat square or a sticker pasted in a corner. If the logo image has a solid background square, ignore that square and use only the emblem itself. You may also echo it huge and ghosted in the background.`,
    });
  if (layout === "MATCHDAY" || layout === "RESULT") {
    if (i.homeLogoUrl) crest(i.homeLogoUrl, "the home team", "left");
    if (i.awayLogoUrl) crest(i.awayLogoUrl, "the away team", "right");
  } else if (opts.logoUrl) {
    crest(opts.logoUrl, "the team", layout === "CHAMPIONS" ? "hero" : "tl");
    // Exact mode: the sharp logo is pasted on top, but the AI also gets it for a giant faded echo behind everything.
    if (exact && (layout === "CHAMPIONS" || layout === "PLAYER" || layout === "LINEUP")) {
      refs.push({
        url: opts.logoUrl,
        label:
          "the team crest — use it ONLY as one GIANT, faint, ghosted background element: about 90–110% of the poster width, centred behind everything (behind the title, trophy and figures), at roughly 10–15% opacity, blended into the light and atmosphere like a watermark carved in light. Do not draw it anywhere else, at normal opacity, or in the foreground (the real crest is added on top afterwards).",
      });
    }
  }
  if (i.champLogoUrl) {
    refs.push({
      url: i.champLogoUrl,
      label:
        layout === "CHAMPIONS"
          ? "the competition/championship logo. Put it ONLY on the trophy — engraved or embossed on the front of the cup, reproduced faithfully. Do not show it anywhere else and never as a big logo on the poster."
          : layout === "EVENT"
            ? "the league / event logo (the organiser of this tournament). Keep its exact shape, letters, symbols and colours — do not redesign it — and make it a HERO element: a large glossy premium 3D emblem with a polished rim, depth, reflections and a coloured glow, placed prominently near the top centre (if there is a trophy, it can sit just above it or be engraved on it as well), lit by the scene's lights with particles around it — never a flat sticker in a corner. Build the poster's colour palette from this logo's colours (unless the user picked colours). If the logo has a solid background square, ignore the square and use only the emblem."
            : "the competition/championship logo. Place it as a smaller badge; reproduce it faithfully as a glossy 3D badge.",
    });
  }
  if (i.trophyUrl) {
    refs.push({ url: i.trophyUrl, label: "the trophy. Reproduce this exact trophy design, large and shiny, as the centrepiece." });
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
      label:
        "a STYLE reference only. Match its overall look: composition and layering, lighting, colour grading, textures, effects and typography feel. Do NOT copy its people, faces, names, text, logos, badges, stickers or watermarks.",
    });
  }
  return refs;
}

/**
 * Event flyers: a strong layout chosen per poster (so they don't all look the same), an athlete hero,
 * and the quality bar of a top tournament design studio.
 */
function eventDirection(seed: number, hasPhoto: boolean, hasLogo: boolean) {
  const hero = hasPhoto
    ? "the person from the uploaded photo"
    : "an ORIGINAL athlete created by you (a generic pro football / esports player in a plain kit with no real club badges, not a real or famous person, face partly in dramatic shadow)";
  const logo = hasLogo ? "the provided league/team logo as a big glossy 3D emblem" : "a large glossy 3D trophy";
  const layouts = [
    `FACE-OFF: ${hero} on one side and a second original rival athlete on the other, facing each other, big and cropped at the waist, rim-lit in two contrasting colours; ${logo} glowing between and above their heads; the headline across the bottom third in front of both, the prize below it.`,
    `HERO STRIKE: ${hero} in a powerful action pose (striking a ball or celebrating with arms out) bursting toward the camera from the middle, the ball or shockwave exploding with energy and debris; ${logo} at the top; the headline behind the athlete's legs and partly hidden by them, the prize in front at the bottom.`,
    `TROPHY ALTAR: ${logo} on a tall glowing pedestal in the centre, blasted by vertical light beams; ${hero} large and dark-silhouetted on one side, looking up at it; the headline in an arc or angle over the bottom, the prize as a heavy 3D plate on the pedestal.`,
    `MONUMENT: ${logo} turned into a HUGE monument filling the upper half, like a colossal metal sculpture in the stadium with smoke at its base; ${hero} small-to-medium in front, walking toward the camera; the headline as a massive 3D word across the middle, overlapping the base of the monument, the prize glowing below.`,
  ];
  const typeLooks = [
    "headline in thick brushed-chrome 3D letters with a coloured bevel and a hard drop shadow",
    "headline in heavy italic sports letters with a gold edge, inner gradient and motion streaks",
    "headline in condensed letters made of glowing neon tubes inside a dark metal casing",
    "headline in cracked stone / concrete 3D letters with fire or energy glowing through the cracks",
  ];
  const n = Math.abs(seed);
  return [
    `EVENT FLYER — LAYOUT FOR THIS POSTER (follow it unless the art director's instructions above define a different layout): ${layouts[n % layouts.length]}`,
    `TYPOGRAPHY LOOK: ${typeLooks[(n >> 2) % typeLooks.length]}; the event title in a contrasting cleaner style, the accent line in a hand-written brush script, the prize as a premium 3D element. All texts form ONE designed lock-up that interacts with the hero (overlapping, angled, mixed sizes) — never a plain stack of centred lines.`,
    `QUALITY BAR: like a flyer from a top esports / tournament design studio. Real photographic lighting and materials, deep layering (environment → giant faded echo of the headline or logo → hero figures → lettering → foreground sparks, smoke and debris crossing over the letters), a cinematic colour grade, and NO big empty dark areas. The date/time sits on a sleek integrated ribbon or light bar that belongs to the scene (not a flat app-style box). Every text item is written completely — never cut, cropped or abbreviated.`,
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
}) {
  const { inputs: raw, style, layout } = opts;
  // When a team has a logo, the poster shows only the logo — never the team's name as text.
  const hasTeamLogo = opts.refs.some((r) => r.label.startsWith("the crest/logo of the team"));
  const overlays = opts.refs.filter((r) => r.overlay);
  const exactLogos = overlays.length > 0;
  const aiRefs = opts.refs.filter((r) => !r.overlay);
  const i: BannerInputs = {
    ...raw,
    team: hasTeamLogo ? "" : raw.team,
    homeTeam: raw.homeLogoUrl ? "" : raw.homeTeam,
    awayTeam: raw.awayLogoUrl ? "" : raw.awayTeam,
    eventName: raw.champLogoUrl ? "" : raw.eventName,
    competition: raw.champLogoUrl ? "" : raw.competition,
  };
  const randomize = opts.randomize !== false;
  // Colours: "" = automatic — the team crest's colours when the AI can see the crest, otherwise a fresh palette.
  const crestVisible = aiRefs.some((r) => /crest/i.test(r.label));
  if (!i.colorMode) i.colorMode = crestVisible ? "team" : "surprise";
  if (i.colorMode === "team" && !crestVisible) i.colorMode = "surprise";
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
      const pickLayout = exactLogos
        ? `LAYOUT: the "${title}" title in massive 3D letters across the top, ${crestHero}, ${trophy} on the right side on a reflective stage, light beams crossing behind.`
        : champLayouts[Math.abs(v.seed) % champLayouts.length];
      composition = [
        `A premium champions title-celebration poster — the kind a top club's media team posts after winning a trophy.`,
        pickLayout,
        `Also: ${hasTeamLogo || exactLogos ? "no team name text" : "the team name in big metallic letters"}${(i.roster.length || i.players.length) ? ", the squad list on a designed metal nameplate along the bottom" : ""}${i.prize ? ", a gold prize badge" : ""}, confetti, sparks and spotlight beams. ${!(i.roster.length || i.players.length) ? "NO player names or squad list anywhere. " : ""}${!i.prize ? "NO prize, money amount or prize badge. " : ""}`,
        frame,
        finish,
      ].join(" ");
      add("Title (huge)", i.headline || "CHAMPIONS");
      add("Small line above the title (competition)", i.eventName || i.competition);
      add("Team name (large)", i.team);
      const squad = (i.roster.length ? i.roster : i.players).filter(Boolean);
      if (squad.length)
        lines.push(
          `- Squad list, exactly these names separated by " | ": ${q(squad.join(" | "))} — NOT plain text: set them on a designed element (a polished metal nameplate ribbon or glass bar in the poster's colours, with bevel, glow and reflections), bold 3D lettering${squad.length > 6 ? ", split into two neat rows" : ""}`,
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
      if (i.players.length) lines.push(`- Players (number, name, position) — place every one on the pitch:\n${i.players.filter(Boolean).map((p) => `  • ${q(p)}`).join("\n")}`);
      add("Competition", i.competition);
      add("Date / matchday", i.date);
      break;
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
    case "EVENT":
      composition = `A tournament / event announcement poster. One or two dynamic shots of the subject, a huge glossy 3D headline in the middle${i.name ? ", a bold event title under it" : ""}${i.subtitle ? ", a script-font accent line" : ""}${i.date || i.details ? ", and the date and times on a sleek integrated ribbon or glowing light bar (not a flat app-style box)" : ""}${i.prize ? ", a prize badge" : ""}. ${frame} ${finish}`;
      add("Headline (huge, glossy 3D)", i.headline);
      add("Event title (bold, under the headline)", i.name);
      add("Script accent line", i.subtitle);
      add("Date & times (designed lock-up on a ribbon / light bar)", [i.date, i.details].filter(Boolean).join("  ·  "));
      add("Prize", i.prize);
      break;
    default:
      composition = [
        `A premium pro-clubs / esports football player announcement poster, the dense layered style of top club social-media designers.`,
        `LAYERING (back to front): 1) a dramatic themed background filling the frame; 2) ${i.team ? "GIANT background lettering of the team name spanning the whole width — mix a huge blackletter/gothic word with huge condensed outlined letters, partly hidden behind the player" : hasTeamLogo && !exactLogos ? "the team crest echoed HUGE, ghosted and partly hidden behind the player (no team name text)" : "giant abstract graphic shapes and light"};`,
        i.bgPose === "none"
          ? `3) (no second figure — only ONE image of the player on this poster);`
          : i.bgPose === "style"
            ? `3) the background figure / second image exactly as described in the DESIGN INSTRUCTIONS FROM THE ART DIRECTOR below${opts.instructions?.trim() ? "" : " (none were given, so create a dramatic close-up of the SAME player — clearly the same person, a newly generated shot, not a copy of the photo)"};`
            : `3) a SECOND, NEWLY CREATED image of the SAME player, very large in the upper half/behind: ${bgPosePrompt(i.bgPose)}. This must be a genuinely different shot generated by you — different pose, angle and expression from the uploaded photo, NOT a copy, crop or enlargement of it — but clearly the same person (same face, hair, skin tone, beard, kit). Render it in the same style as the rest of the poster: colour-graded and tinted with the main colour, slightly faded/double-exposed into the background, with light rays and texture over it;`,
        `4) in front, the player from the uploaded photo as a sharp full cut-out (same pose as the photo), with a strong rim light and glow separating them from the background; 5) effects on top.`,
        i.bgPose === "none" || i.bgPose === "style"
          ? ""
          : `The two figures must clearly differ (e.g. one a dramatic close-up, the other the action/full-body pose), like a pro designer's double-shot player card.`,
        `TYPOGRAPHY: the player's name huge on the lower left${i.position ? "; a small solid coloured tag box above it with the position" : ""}${i.subtitle || i.tagline ? "; the accent line in a script or gothic style" : ""}${i.number ? "; the jersey number big and outlined on the right" : ""}. Do not add any other words — no invented titles, tags or slogans.`,
        frame,
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

  const typeFx = `TYPOGRAPHY TREATMENT (very important): every title is a designed lettering piece by a pro designer, never plain typed text. The main name/headline: thick 3D extruded letters with bevelled edges, polished chrome or brushed-metal faces with a gradient in the main colour, sharp specular highlights, a coloured outline or inner glow, a hard drop shadow and subtle wear/texture; it may be slightly slanted, tightly kerned and overlap the subject in places. Mix 2–3 contrasting type styles (huge condensed caps + a gothic or brush-script accent + tiny letter-spaced caps) with a clear size hierarchy. Tag boxes and badges look like real graphic elements (bevel, gradient, glow). No flat, thin, default-looking white text.`;
  const typo = [
    fontPrompt(i.fontPrimary) && `Titles and the main headline in ${fontPrompt(i.fontPrimary)}.`,
    fontPrompt(i.fontSecondary) && `Names, numbers and small text in ${fontPrompt(i.fontSecondary)}.`,
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
      : `the top-left corner (a square about 26% of the poster width, plus margin) calm and empty`;
  // Champions posters need a lot of celebration energy — always added, even for admin-led styles.
  const champsEnergy =
    layout === "CHAMPIONS"
      ? `CHAMPIONS ENERGY (dense, maximalist, never sparse): a storm of confetti and streamers in the poster's colours filling the air, fireworks bursting behind, strong light beams/god-rays from above, a packed stadium crowd with phone lights and flags far behind, a glossy reflective floor, ${spots.includes("hero") ? "a raised glowing podium with 3–5 championship stars arching above the crest spot (the crest itself is added afterwards — keep that spot empty), " : ""}the title huge with deep 3D extrusion, bevel and texture${(i.roster.length || i.players.length) ? `. SQUAD NAMES: not plain text — set them on a designed element along the bottom: a polished metal nameplate ribbon (in the poster's colours — chrome, coloured metal, or gold only if the palette is gold) or a glass bar with bevelled edges, glow and reflections, the names in bold 3D metallic lettering with small separators${(i.roster.length || i.players.length) > 6 ? ", split into two neat rows" : ""}, every name perfectly readable` : ""}. Fill the whole frame with layered detail — NO large empty dark areas.`
      : "";
  const logoRule = exactLogos
    ? `LOGO SPACE: leave ${spotText} — no text, faces or objects there — because the official team crest${spots.length > 1 ? "s are" : " is"} placed there afterwards. Do NOT draw, invent or imitate any team crest, club badge or emblem anywhere on the poster.`
    : "";

  // A style with admin design instructions: those describe the whole design; the built-in layout recipe is skipped.
  const adminLed = !!opts.instructions?.trim();
  const kind = { PLAYER: "player card", CHAMPIONS: "champions", MATCHDAY: "match day", LINEUP: "starting lineup", RESULT: "full-time result", EVENT: "tournament / event" }[layout] ?? "sports";
  const directorBlock =
    opts.instructions?.trim()
      ? `DESIGN INSTRUCTIONS FROM THE ART DIRECTOR — ${adminLed ? "these define the whole design; follow them exactly. Where they conflict with anything else in this brief, they win, EXCEPT the text rules, logo space and safety rules below, which always apply" : "follow these closely; where they conflict with anything above, these win"}:\n${opts.instructions.trim().slice(0, 20000)}`
      : "";
  return [
    `Design a finished, high-end vertical sports social-media poster (4:5).`,
    directorBlock,
    adminLed
      ? `This is a ${kind} poster. Its layout, composition, figures, typography and effects are defined by the ART DIRECTOR'S DESIGN INSTRUCTIONS above — follow them exactly. ${layout === "CHAMPIONS" ? `Trophy: ${i.trophyUrl ? "the provided trophy (reference image)" : trophyPrompt(i.trophy) || "a large shiny trophy"}. ` : ""}${layout === "PLAYER" ? (i.bgPose === "none" ? "Show the player only once. " : i.bgPose && i.bgPose !== "style" ? `If the instructions don't describe a second figure, add one behind: ${bgPosePrompt(i.bgPose)} (a newly generated shot of the same person). ` : "") : ""}${frame} Unless the instructions describe the background in detail, use this: ${finish}`
      : composition,
    // With admin instructions, the AI only reads those (the old background description is not sent).
    adminLed ? "" : `Visual style (base${(i.colorMode === "custom" && i.color1) || v.palette || i.colorMode === "team" ? " — keep its mood, scene and materials, but NOT its colours; use the COLOURS line below" : ""}): ${opts.templatePrompt}.`,
    colourLine(i, style, v, adminLed),
    bgScenePrompt(i.bgScene)
      ? `BACKGROUND SCENE (chosen by the user${adminLed ? " — use it unless the art director's instructions define the background" : " — use it"}): ${bgScenePrompt(i.bgScene)}. Render it as a real, detailed, photographic environment with depth, tinted with the poster colours — not a flat or simple backdrop.`
      : "",
    opts.series
      ? `TEAM SET: this card belongs to a matching set for the whole team. Copy the design of the first card (reference image) as closely as possible — same background, colours, layout, fonts and effects — so all cards look like one series. Only the player and the player's text change.`
      : randomize && adminLed
      ? `Make this poster feel fresh (variation #${v.seed}) with new small details, but keep the layout, concept and style the art director defined.`
      : randomize
      ? `UNIQUE CREATIVE DIRECTION for this poster (variation #${v.seed}) — make it look clearly different from other posters in this series: background concept: ${bgScenePrompt(i.bgScene) ? "the chosen scene above, with touches of " : ""}${v.motif};${adminLed ? "" : ` composition: ${v.composition};`} lighting: ${v.lighting}; texture: ${v.texture}. Blend these with the base style${adminLed ? " without changing the layout the art director defined" : ""}; invent fresh details rather than a generic template.`
      : `Keep this poster consistent with the base style — same kind of background, layout and mood every time.`,
    adminLed ? "" : typeFx,
    typo,
    i.extraPrompt ? `Extra direction from the user: ${i.extraPrompt}.` : "",
    ...refText,
    logoRule,
    adminLed ? "" : champsEnergy,
    layout === "EVENT" ? eventDirection(v.seed, !!opts.refs.some((r) => r.label.startsWith("the main subject")), !!i.champLogoUrl || hasTeamLogo) : "",
    `NEVER include animals, birds, eagles, wings, mascots or creatures of any kind unless ${adminLed ? "the art director's instructions or " : ""}the user's extra direction explicitly asks for one.`,
    `STRICT TEXT RULE: the poster may only contain the text items listed below${i.aiCopy === "on" ? " (plus the optional hype words)" : ""}. If something has no text listed (squad names, prize, date, venue, scorers, competition…), leave that element out completely — never invent names, prizes, money amounts, dates, places or titles.`,
    lines.length ? `Text on the poster — spell EVERY item exactly as written, letter for letter, keep capitalisation and symbols like _ - | $:\n${lines.join("\n")}` : "",
    `REALISM${adminLed ? " (unless the art director's instructions ask for a different look)" : ""}: photorealistic premium sports-advertising quality, like a top designer composited real photography with real 3D renders. Real photographic lighting, real materials (true chrome, polished gold, glass, smoke, wet concrete, stadium floodlights), physically correct reflections and shadows, natural skin texture, shallow depth of field, razor-sharp 4K detail and crisp, perfectly formed lettering. It must NOT look like a cartoon, an illustration or a generic AI image: no plastic skin, no mushy or melted text, no over-smoothed textures, no random symbols, no warped faces or hands.`,
    `Keep ${exactLogos ? "one of the bottom corners" : "at least one corner of the poster"} calm (no text or faces) — a small brand mark goes there. Never draw borders, frame lines, corner brackets, crop marks or "× × ×" decorations.`,
    i.aiCopy === "on"
      ? `You MAY add 1–2 short, punchy hype words that fit this poster (e.g. NEW SIGNING, WELCOME, MVP, GAME DAY, LET'S GO, CAMPEONES), written${i.language && i.language !== "English" ? ` in ${i.language}` : ""} and styled as part of the design. Never change, translate or misspell the listed names.`
      : "",
    adminLed
      ? `FINAL REMINDER: the layout, composition, figures, style and effects must follow the ART DIRECTOR'S DESIGN INSTRUCTIONS at the top of this brief.`
      : "",
    `Only write the text items listed above${i.aiCopy === "on" ? " (plus those optional hype words)" : ""}. Never write labels or field names such as "LOGO", "CREST", "POSITION", "TEAM", "NAME" or "PHOTO" unless they are part of a listed item. Do not add any other text, words, watermarks, sponsor logos, brand names or website addresses. No real company or league logos except the provided crests and badges.`,
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
    for (const r of opts.refs.filter((x) => !x.overlay)) {
      const bytes = await loadBytes(r.url);
      images.push({ bytes, type: sniffImage(bytes) ?? "image/png" });
    }
    const quality = (await getSettings()).pro_quality;
    let poster: Buffer;
    try {
      poster = await generatePoster(opts.prompt, images, quality);
    } catch (e) {
      const m = e instanceof Error ? e.message : String(e);
      // Still blocked after the text retries: one of the extra images (style reference, logo, trophy)
      // may be what the filter dislikes — try once more with only the first image (the photo).
      if (!/moderation_blocked|safety system/i.test(m)) throw e;
      if (images.length <= 1) throw new Error(`PHOTO_BLOCKED: the photo was rejected by OpenAI's safety filter. ${m}`);
      const onlyFirst = opts.prompt
        .split("\n\n")
        .filter((sec) => !/^Reference image (?!1 )\d+ is /.test(sec.trim()))
        .join("\n\n");
      try {
        poster = await generatePoster(onlyFirst, images.slice(0, 1), quality);
      } catch (e2) {
        const m2 = e2 instanceof Error ? e2.message : String(e2);
        if (/moderation_blocked|safety system/i.test(m2)) throw new Error(`PHOTO_BLOCKED: the photo was rejected by OpenAI's safety filter. ${m2}`);
        throw e2;
      }
    }
    const overlays = opts.refs.filter((x) => x.overlay);
    if (overlays.length) {
      const logos: { bytes: Buffer; corner: LogoSpot }[] = [];
      for (const o of overlays) logos.push({ bytes: await loadBytes(o.url), corner: o.overlay! });
      poster = await placeLogos(poster, logos);
    }
    const avoid = overlays.map((o) => o.overlay).filter((c): c is "tl" | "tr" => c === "tl" || c === "tr");
    const out = await stampLogo(poster, avoid);
    const url = await saveFile("banners", out, "image/png");
    const old = await db.banner.findUnique({ where: { id: opts.bannerId }, select: { finalUrl: true } });
    const updated = await db.banner.update({ where: { id: opts.bannerId }, data: { status: "READY", error: null, finalUrl: url, prompt: opts.prompt.slice(0, 40000) } });
    if (old?.finalUrl && old.finalUrl !== url) await deleteFile(old.finalUrl);
    await logGeneration({ bannerId: opts.bannerId, userId: opts.userId, cost: opts.cost, ok: true, regenerate: opts.regenerate, image: out });
    await textPoster({ userId: opts.userId, imageUrl: url, bannerId: opts.bannerId });
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
