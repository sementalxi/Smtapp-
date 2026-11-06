// Twins: every player-card style labelled 🎨 Photoshop (plus the owner's flyer styles) gets a QUALIFIERS style
// and a WINNERS (champions showcase) style with the same look — same reference image, colours, materials and
// lettering — but that layout instead of a player.
import type { PrismaClient } from "@prisma/client";
import { QUALIFIERS_BODY, WINNERS_BODY } from "./style-presets";

/** The owner's flyer-copied player styles — always twinned, labelled or not. */
export const FLYER_PLAYER_SLUGS = [
  "player-copa-final", "player-split-duotone", "player-white-gold", "player-orange-stripes", "player-chrome-lasers", "player-green-gothic-chrome", "player-purple-gold-chrome", "player-duotone-trio", "player-neon-club", "player-carnival",
  "player-red-echo-frames", "player-neon-palms", "player-neon-echo", "player-face-off", "player-neon-garden", "player-neon-flowers", "player-brush-wall", "player-inferno-neon", "player-gold-throne", "player-desert-chrome",
  "player-chrome-blocks", "player-red-glass", "player-candy-chrome", "player-purple-glass", "player-ice-chrome", "player-white-block", "player-liquid-script",
];

type Family = {
  layout: "QUALIFIERS" | "WINNERS";
  prefix: string;
  mark: string;
  body: string;
  /** The first line of the twin's brief. */
  head: (name: string) => string;
  /** What takes the person's place (for the reference paragraph rewrite and the reference note). */
  instead: string;
  /** Added to the player style's short prompt (the creator's card text). */
  promptSuffix: string;
};

const FAMILIES: Record<Family["layout"], Family> = {
  QUALIFIERS: {
    layout: "QUALIFIERS",
    prefix: "qual-",
    mark: "[AUTO QUALIFIERS FROM ",
    body: QUALIFIERS_BODY,
    head: (name) => `${name.toUpperCase()} QUALIFIERS — the "${name}" player-card look as a World Cup Qualifiers announcement: the same scene, colours, materials and lettering craft, but NO player — the headline, the league emblem, a giant trophy and the regions table take the stage.`,
    instead: "the trophy, the league emblem and the regions table",
    promptSuffix: "as a world cup qualifiers graphic: no player; a giant trophy on a podium, the league emblem and a framed regions table in the same materials",
  },
  WINNERS: {
    layout: "WINNERS",
    prefix: "win-",
    mark: "[AUTO WINNERS FROM ",
    body: WINNERS_BODY,
    head: (name) => `${name.toUpperCase()} SHOWCASE — the "${name}" player-card look as a champions showcase wall: the same scene, colours, materials and lettering craft, but NO player — the headline across the top, the wall of display frames in the middle and the bottom title take the stage.`,
    instead: "the headline, the wall of frames and the bottom title",
    promptSuffix: "as a champions showcase wall: no player; a huge headline, a trophy-cabinet wall of bevelled frames with the winners' crests, a bottom title and the league emblem in the same materials",
  },
};

/** Paragraphs of a player brief that describe its LOOK (colours, background, the title's lettering) — the rest is about the player. */
function lookParagraphs(brief: string, instead: string): string[] {
  const paras = brief.replace(/\r/g, "").split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  const keep = paras.filter((p) => /^(COLOURS\b|BACKGROUND\b|MAIN TITLE\b|TYPOGRAPHY\b|TITLE LETTERING\b|STYLE REFERENCE)/i.test(p));
  return keep.map((p) =>
    p
      // the reference paragraph: it shows a player card; this poster has no player
      .replace(/Change ONLY three things:[^\n]*/i, `This poster has NO player: ${instead} take the place of the person. Change the TEXTS (only the given texts, styled like the reference's) and the LOGO (only the given league logo) — never its words, names, numbers, faces or logos.`)
      // the title paragraphs talk about the player's name — here it is the headline
      .replace(/the player'?s? (NAME|name) ?\/? ?(gamertag)?/gi, "the HEADLINE")
      .replace(/gamertag \/ name|gamertag|the NAME\b/gi, "the HEADLINE")
      .replace(/THE PLAYER'S NAME/gi, "THE HEADLINE"),
  );
}

/** The twin's brief: a head, the look paragraphs of the player brief, then the shared body of that layout. */
function twinBriefFrom(fam: Family, playerSlug: string, playerName: string, playerBrief: string | null | undefined): string {
  const look = lookParagraphs(playerBrief ?? "", fam.instead);
  const head = `${fam.mark}${playerSlug}] [FIXED LAYOUT] ${fam.head(playerName)}`;
  const refNote = `THE REFERENCE SHOWS A PLAYER CARD in this style: copy its background scene, colours, materials, lighting, lettering styles (its big title's 3D build becomes the headline's), effects, density and finish — as if the same designer made this poster. Do NOT copy its person, words, numbers or logos.`;
  return [head, refNote, ...look, fam.body].join("\n\n");
}

export const qualifiersBriefFrom = (playerSlug: string, playerName: string, playerBrief: string | null | undefined) => twinBriefFrom(FAMILIES.QUALIFIERS, playerSlug, playerName, playerBrief);
export const winnersBriefFrom = (playerSlug: string, playerName: string, playerBrief: string | null | undefined) => twinBriefFrom(FAMILIES.WINNERS, playerSlug, playerName, playerBrief);

export type TwinSyncResult = { created: number; updated: number; sources: number };

/**
 * Creates or refreshes the twins of one family. A twin whose brief still starts with the auto marker is refreshed;
 * one the admin edited is left alone (only its reference / colours are filled in when empty). Never deletes.
 */
async function syncFamily(db: PrismaClient, fam: Family): Promise<TwinSyncResult> {
  const players = await db.template.findMany({ where: { layout: "PLAYER", deletedAt: null }, orderBy: [{ sort: "asc" }, { createdAt: "asc" }] });
  const sources = players.filter((t) => (t.badge ?? "").split(",").map((x) => x.trim()).includes("photoshop") || FLYER_PLAYER_SLUGS.includes(t.slug));
  let created = 0, updated = 0;
  for (const src of sources) {
    const slug = `${fam.prefix}${src.slug.replace(/^player-/, "")}`.slice(0, 40);
    const brief = twinBriefFrom(fam, src.slug, src.name, src.proInstructions);
    const ref = src.styleRefUrl || src.thumbUrl || null;
    const existing = await db.template.findUnique({ where: { slug } });
    if (!existing) {
      await db.template.create({
        data: {
          slug,
          name: src.name,
          nameEs: src.nameEs,
          layout: fam.layout,
          prompt: `${src.prompt.trim().replace(/\.$/, "")} — ${fam.promptSuffix}`.slice(0, 1000),
          style: src.style as object,
          cost: src.cost,
          sort: src.sort,
          active: src.active,
          styleRefUrl: ref,
          proInstructions: brief,
          randomize: src.randomize,
          badge: src.badge,
          tier: src.tier,
          audience: src.audience,
        },
      });
      created++;
      continue;
    }
    const auto = (existing.proInstructions ?? "").startsWith(fam.mark);
    const data: Record<string, unknown> = {};
    if (auto && existing.proInstructions !== brief) data.proInstructions = brief;
    if (!existing.styleRefUrl && ref) data.styleRefUrl = ref;
    if (auto) {
      data.style = src.style as object;
      data.badge = src.badge;
      if (!existing.tier) data.tier = src.tier;
    }
    if (Object.keys(data).length) {
      await db.template.update({ where: { id: existing.id }, data });
      updated++;
    }
  }
  return { created, updated, sources: sources.length };
}

export const syncQualifiersTwins = (db: PrismaClient) => syncFamily(db, FAMILIES.QUALIFIERS);
export const syncWinnersTwins = (db: PrismaClient) => syncFamily(db, FAMILIES.WINNERS);

/** Both families at once (deploy seed and the admin button). */
export async function syncAllTwins(db: PrismaClient): Promise<{ qualifiers: TwinSyncResult; winners: TwinSyncResult }> {
  return { qualifiers: await syncFamily(db, FAMILIES.QUALIFIERS), winners: await syncFamily(db, FAMILIES.WINNERS) };
}
