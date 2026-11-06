// Qualifiers twins: every player-card style labelled 🎨 Photoshop (plus the owner's flyer styles) gets a
// QUALIFIERS style with the same look — same reference image, colours, materials and lettering — but the
// qualifiers layout (headline, league emblem, trophy, regions table) instead of a player.
import type { PrismaClient } from "@prisma/client";
import { QUALIFIERS_BODY } from "./style-presets";

const MARK = "[AUTO QUALIFIERS FROM ";

/** The owner's flyer-copied player styles — always twinned, labelled or not. */
export const FLYER_PLAYER_SLUGS = [
  "player-copa-final", "player-split-duotone", "player-white-gold", "player-orange-stripes", "player-chrome-lasers", "player-green-gothic-chrome", "player-purple-gold-chrome", "player-duotone-trio", "player-neon-club", "player-carnival",
  "player-red-echo-frames", "player-neon-palms", "player-neon-echo", "player-face-off", "player-neon-garden", "player-neon-flowers", "player-brush-wall", "player-inferno-neon", "player-gold-throne", "player-desert-chrome",
  "player-chrome-blocks", "player-red-glass", "player-candy-chrome", "player-purple-glass", "player-ice-chrome", "player-white-block", "player-liquid-script",
];

/** Paragraphs of a player brief that describe its LOOK (colours, background, the title's lettering) — the rest is about the player. */
function lookParagraphs(brief: string): string[] {
  const paras = brief.replace(/\r/g, "").split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  const keep = paras.filter((p) => /^(COLOURS\b|BACKGROUND\b|MAIN TITLE\b|TYPOGRAPHY\b|TITLE LETTERING\b|STYLE REFERENCE)/i.test(p));
  return keep.map((p) =>
    p
      // the reference paragraph: it shows a player card; this poster has no player
      .replace(/Change ONLY three things:[^\n]*/i, "This poster has NO player: the trophy, the league emblem and the regions table take the place of the person. Change the TEXTS (only the given texts, styled like the reference's) and the LOGO (only the given league logo) — never its words, names, numbers, faces or logos.")
      // the title paragraphs talk about the player's name — here it is the headline
      .replace(/the player'?s? (NAME|name) ?\/? ?(gamertag)?/gi, "the HEADLINE")
      .replace(/gamertag \/ name|gamertag|the NAME\b/gi, "the HEADLINE")
      .replace(/THE PLAYER'S NAME/gi, "THE HEADLINE"),
  );
}

/** The twin's brief: a head, the look paragraphs of the player brief, then the shared qualifiers body. */
export function qualifiersBriefFrom(playerSlug: string, playerName: string, playerBrief: string | null | undefined): string {
  const look = lookParagraphs(playerBrief ?? "");
  const head = `${MARK}${playerSlug}] [FIXED LAYOUT] ${playerName.toUpperCase()} QUALIFIERS — the "${playerName}" player-card look as a World Cup Qualifiers announcement: the same scene, colours, materials and lettering craft, but NO player — the headline, the league emblem, a giant trophy and the regions table take the stage.`;
  const refNote = `THE REFERENCE SHOWS A PLAYER CARD in this style: copy its background scene, colours, materials, lighting, lettering styles (its big title's 3D build becomes the headline's), effects, density and finish — as if the same designer made this poster. Do NOT copy its person, words, numbers or logos.`;
  return [head, refNote, ...look, QUALIFIERS_BODY].join("\n\n");
}

/**
 * Creates or refreshes the twins. A twin whose brief still starts with the auto marker is refreshed; one the
 * admin edited is left alone (only its reference / colours are filled in when empty). Never deletes.
 */
export async function syncQualifiersTwins(db: PrismaClient): Promise<{ created: number; updated: number; sources: number }> {
  const players = await db.template.findMany({ where: { layout: "PLAYER", deletedAt: null }, orderBy: [{ sort: "asc" }, { createdAt: "asc" }] });
  const sources = players.filter((t) => (t.badge ?? "").split(",").map((x) => x.trim()).includes("photoshop") || FLYER_PLAYER_SLUGS.includes(t.slug));
  let created = 0, updated = 0;
  for (const src of sources) {
    const slug = `qual-${src.slug.replace(/^player-/, "")}`.slice(0, 40);
    const brief = qualifiersBriefFrom(src.slug, src.name, src.proInstructions);
    const ref = src.styleRefUrl || src.thumbUrl || null;
    const existing = await db.template.findUnique({ where: { slug } });
    if (!existing) {
      await db.template.create({
        data: {
          slug,
          name: src.name,
          nameEs: src.nameEs,
          layout: "QUALIFIERS",
          prompt: `${src.prompt.trim().replace(/\.$/, "")} — as a world cup qualifiers graphic: no player; a giant trophy on a podium, the league emblem and a framed regions table in the same materials`.slice(0, 1000),
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
    const auto = (existing.proInstructions ?? "").startsWith(MARK);
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
