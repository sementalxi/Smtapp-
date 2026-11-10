// Inserts the default templates and settings. Safe to re-run: it never
// overwrites templates an admin has already edited.
import { PrismaClient, Prisma } from "@prisma/client";
import { DEFAULT_TEMPLATES } from "../src/lib/templates";
import { SETTING_DEFAULTS } from "../src/lib/settings";
import { PRESET_INSTRUCTIONS, PRESET_PREVIOUS, stripSmallTeamName } from "../src/lib/style-presets";
import { DEFAULT_PRICING } from "../src/lib/pricing";
import { siteUrl } from "../src/lib/email-template";
import { syncAllTwins } from "../src/lib/qualifiers-twins";

const db = new PrismaClient();

async function main() {
  for (const t of DEFAULT_TEMPLATES) {
    await db.template.upsert({
      where: { slug: t.slug },
      create: {
        slug: t.slug,
        name: t.name,
        nameEs: t.nameEs,
        layout: t.layout,
        prompt: t.prompt,
        style: t.style as unknown as Prisma.InputJsonValue,
        sort: t.sort,
        thumbUrl: t.thumbUrl ?? null,
      },
      update: {},
    });
    // Built-in sample thumbnails (only if the admin hasn't set their own).
    if (t.thumbUrl) await db.template.updateMany({ where: { slug: t.slug, OR: [{ thumbUrl: null }, { thumbUrl: "" }] }, data: { thumbUrl: t.thumbUrl } });
  }
  // One-time: the owner replaced the Champions styles with the 10 new sample styles — hide the old ones (kept for history, can be re-shown in Admin → Templates).
  if (!(await db.setting.findUnique({ where: { key: "champions_v3" } }))) {
    await db.template.updateMany({ where: { layout: "CHAMPIONS", NOT: { slug: { startsWith: "champ-" } } }, data: { active: false } });
    await db.template.updateMany({ where: { slug: { startsWith: "champ-" } }, data: { active: true } });
    await db.setting.create({ data: { key: "champions_v3", value: new Date().toISOString() } });
  }
  // One-time fix: the old Golden Champions prompt asked for wings, which the AI turned into an eagle.
  // Only replaced if the admin never changed it.
  await db.template.updateMany({
    where: { slug: "golden-champions", prompt: "golden marble arena with white feathered wings, warm golden light rays, sparks and confetti, epic trophy ceremony atmosphere" },
    data: { prompt: "golden marble arena, warm golden light rays, gold confetti and sparks, epic trophy ceremony atmosphere" },
  });
  // Richer Royal Violet background (only if the admin never changed the old prompt).
  await db.template.updateMany({
    where: { slug: "royal-violet", prompt: "royal purple baroque ornaments, violet lightning storm, golden light flare, stadium spotlights, purple clouds and mist, luxurious dark atmosphere" },
    data: { prompt: "epic royal throne-room arena in deep purple and gold: towering baroque gold ornaments and pillars, a violent violet lightning storm cracking across a dark sky, golden light beams and lens flares, floating gold particles and shattered amethyst crystal shards flying toward the camera, swirling purple smoke, stadium floodlights far behind, luxurious, powerful, dramatic" },
  });
  // One-time: the 6 new Champions styles — briefs reloaded (no stand-in letters like "V N", no dummy squad names).
  if (!(await db.setting.findUnique({ where: { key: "champs_new6_v2" } }))) {
    for (const slug of ["champ-kit-cup", "champ-celebration-party", "champ-stadium-bold", "champ-gold-crest-trophy", "champ-mascot-graffiti", "champ-player-hero"]) {
      if (PRESET_INSTRUCTIONS[slug]) await db.template.updateMany({ where: { slug }, data: { proInstructions: PRESET_INSTRUCTIONS[slug] } });
    }
    await db.setting.create({ data: { key: "champs_new6_v2", value: new Date().toISOString() } });
  }
  // One-time: Royal Split's reference showed a kicking figure with a ball; the style now wants a cool close-up
  // portrait on the right. Clear the reference so the written brief takes over.
  if (!(await db.setting.findUnique({ where: { key: "royal_split_no_kick_v1" } }))) {
    await db.template.updateMany({ where: { slug: "player-royal-split" }, data: { styleRefUrl: null } });
    await db.setting.create({ data: { key: "royal_split_no_kick_v1", value: new Date().toISOString() } });
  }
  // Force-update Royal Split's proInstructions — the brief was rewritten several times but
  // PRESET_PREVIOUS wasn't updated each time, so the seed skipped the later versions.
  if (!(await db.setting.findUnique({ where: { key: "royal_split_2fig_v1" } }))) {
    const { PRESET_INSTRUCTIONS } = await import("../src/lib/style-presets");
    const text = PRESET_INSTRUCTIONS["player-royal-split"];
    if (text) await db.template.updateMany({ where: { slug: "player-royal-split" }, data: { proInstructions: text } });
    await db.setting.create({ data: { key: "royal_split_2fig_v1", value: new Date().toISOString() } });
  }
  // Living Statue: single-face statue (not half-and-half), small figure is a portrait not action,
  // no crowd hands, no background logo echo.
  if (!(await db.setting.findUnique({ where: { key: "living_statue_fix_v1" } }))) {
    const { PRESET_INSTRUCTIONS } = await import("../src/lib/style-presets");
    const text = PRESET_INSTRUCTIONS["player-living-statue"];
    if (text) await db.template.updateMany({ where: { slug: "player-living-statue" }, data: { proInstructions: text } });
    await db.setting.create({ data: { key: "living_statue_fix_v1", value: new Date().toISOString() } });
  }
  // Double Exposure: calm portraits (not screaming), no full-body dribbling, no gaming desk/controller/monitor.
  // Also clear the reference image which showed the old layout.
  if (!(await db.setting.findUnique({ where: { key: "double_exposure_fix_v1" } }))) {
    const { PRESET_INSTRUCTIONS } = await import("../src/lib/style-presets");
    const text = PRESET_INSTRUCTIONS["player-double-exposure"];
    if (text) await db.template.updateMany({ where: { slug: "player-double-exposure" }, data: { proInstructions: text, styleRefUrl: null } });
    await db.setting.create({ data: { key: "double_exposure_fix_v1", value: new Date().toISOString() } });
  }
  // Ready-made design instructions — only where the admin hasn't written any.
  for (const [slug, text] of Object.entries(PRESET_INSTRUCTIONS)) {
    const prev = PRESET_PREVIOUS[slug];
    await db.template.updateMany({
      where: { slug, OR: [{ proInstructions: null }, { proInstructions: "" }, ...(prev ? [{ proInstructions: prev }] : [])] },
      data: { proInstructions: text },
    });
  }
  // One-time (owner's request): Neon Gothic — no giant white repeat of the name behind the gothic name.
  if (!(await db.setting.findUnique({ where: { key: "neon_gothic_no_white_echo" } }))) {
    const t = await db.template.findUnique({ where: { slug: "neon-gothic" } });
    if (t) {
      const rule =
        "NO WHITE ECHO TEXT: never repeat the player's name (or any word) as giant white, pale or outlined letters behind or under the main name. The name appears ONCE only, in the gothic lettering. No big white text blocks anywhere — the background stays imagery, light and effects only.";
      await db.template.update({ where: { id: t.id }, data: { proInstructions: `${(t.proInstructions ?? "").trim()}\n\n${rule}`.trim(), prompt: t.prompt.replace(/giant (white )?(background )?(letters|lettering)[^,]*,?/gi, "") } });
    }
    await db.setting.create({ data: { key: "neon_gothic_no_white_echo", value: new Date().toISOString() } });
  }
  // One-time (owner's request): the old event / tournament styles are replaced by four new ones — hide the old ones.
  if (!(await db.setting.findUnique({ where: { key: "events_v2" } }))) {
    await db.template.updateMany({ where: { layout: "EVENT", NOT: { slug: { startsWith: "event-" } } }, data: { active: false } });
    await db.template.updateMany({ where: { slug: { startsWith: "event-" } }, data: { active: true } });
    await db.setting.create({ data: { key: "events_v2", value: new Date().toISOString() } });
  }
  // One-time (owner's request): event announcements show a person only when a photo is uploaded — reload the event briefs.
  if (!(await db.setting.findUnique({ where: { key: "events_v3_no_people" } }))) {
    for (const [slug, text] of Object.entries(PRESET_INSTRUCTIONS)) {
      if (slug.startsWith("event-")) await db.template.updateMany({ where: { slug }, data: { proInstructions: text } });
    }
    await db.setting.create({ data: { key: "events_v3_no_people", value: new Date().toISOString() } });
  }
  // One-time: event briefs reloaded — no-photo posters get a centrepiece prop and a density rule (they came out too plain).
  if (!(await db.setting.findUnique({ where: { key: "events_v5_dense" } }))) {
    for (const [slug, text] of Object.entries(PRESET_INSTRUCTIONS)) {
      if (slug.startsWith("event-")) await db.template.updateMany({ where: { slug }, data: { proInstructions: text } });
    }
    await db.setting.create({ data: { key: "events_v5_dense", value: new Date().toISOString() } });
  }
  // The owner's own flyers (people cropped out) as the style reference of the four styles copied from them — unless the admin set one.
  for (const slug of ["event-relampago", "event-golden-palace", "event-desert-plates", "event-spiky-pyro", "event-storm-plates", "event-golden-shield", "player-copa-final", "player-split-duotone", "player-white-gold", "player-orange-stripes", "player-chrome-lasers", "player-green-gothic-chrome", "player-purple-gold-chrome", "player-duotone-trio", "player-neon-club", "player-carnival", "player-red-echo-frames", "player-neon-palms", "player-neon-echo", "player-face-off", "player-neon-garden", "player-neon-flowers", "player-brush-wall", "player-inferno-neon", "player-gold-throne", "player-desert-chrome", "player-chrome-blocks", "player-red-glass", "player-candy-chrome", "player-purple-glass", "player-ice-chrome", "player-white-block", "player-liquid-script", "qual-golden-road", "win-golden-showcase"]) {
    await db.template.updateMany({ where: { slug, OR: [{ styleRefUrl: null }, { styleRefUrl: "" }] }, data: { styleRefUrl: `${siteUrl()}/refs/${slug}.jpg` } });
  }
  // One-time: the 20 flyer-based player styles get the exact-copy briefs (style reference + layout map).
  if (!(await db.setting.findUnique({ where: { key: "players_v2_exact" } }))) {
    for (const slug of ["player-copa-final", "player-split-duotone", "player-white-gold", "player-orange-stripes", "player-chrome-lasers", "player-green-gothic-chrome", "player-purple-gold-chrome", "player-duotone-trio", "player-neon-club", "player-carnival", "player-red-echo-frames", "player-neon-palms", "player-neon-echo", "player-face-off", "player-neon-garden", "player-neon-flowers", "player-brush-wall", "player-inferno-neon", "player-gold-throne", "player-desert-chrome"]) {
      const text = PRESET_INSTRUCTIONS[slug];
      if (text) await db.template.updateMany({ where: { slug }, data: { proInstructions: text } });
    }
    await db.setting.create({ data: { key: "players_v2_exact", value: new Date().toISOString() } });
  }
  // One-time: the plate flyers (storm, golden shield, desert) with the rule / entry boxes — briefs reloaded, new order, desert reference refreshed.
  if (!(await db.setting.findUnique({ where: { key: "events_v6_plates" } }))) {
    for (const [slug, text] of Object.entries(PRESET_INSTRUCTIONS)) {
      if (slug.startsWith("event-")) await db.template.updateMany({ where: { slug }, data: { proInstructions: text } });
    }
    await db.template.updateMany({ where: { slug: "event-desert-plates", styleRefUrl: { contains: "/refs/event-desert-plates.jpg" } }, data: { styleRefUrl: `${siteUrl()}/refs/event-desert-plates.jpg?v=2` } });
    for (const t of DEFAULT_TEMPLATES) {
      if (t.layout === "EVENT" && t.slug.startsWith("event-")) await db.template.updateMany({ where: { slug: t.slug }, data: { sort: t.sort } });
    }
    await db.setting.create({ data: { key: "events_v6_plates", value: new Date().toISOString() } });
  }
  // Owner removed the Instagram feed: clear its saved token and cache.
  await db.setting.deleteMany({ where: { key: { in: ["instagram_token", "instagram_id", "instagram_cache", "instagram_token_at"] } } });
  await db.setting.updateMany({ where: { key: "instagram_on" }, data: { value: "off" } });
  // One-time: the four styles copied from the owner's own flyers come first in the event list.
  if (!(await db.setting.findUnique({ where: { key: "events_v4_order" } }))) {
    for (const t of DEFAULT_TEMPLATES) {
      if (t.layout === "EVENT" && t.slug.startsWith("event-")) await db.template.updateMany({ where: { slug: t.slug }, data: { sort: t.sort } });
    }
    await db.setting.create({ data: { key: "events_v4_order", value: new Date().toISOString() } });
  }
  // One-time (owner's request): hide all the old lineup styles — only the new Photoshop-style ones stay.
  if (!(await db.setting.findUnique({ where: { key: "lineups_v2" } }))) {
    await db.template.updateMany({ where: { layout: "LINEUP", NOT: { slug: { startsWith: "xi-" } } }, data: { active: false } });
    await db.template.updateMany({ where: { slug: { startsWith: "xi-" } }, data: { active: true } });
    await db.setting.create({ data: { key: "lineups_v2", value: new Date().toISOString() } });
  }
  // One-time (owner's request): every image uses the top generator — All 3 (Nano Banana + FLUX.2 + OpenAI).
  if (!(await db.setting.findUnique({ where: { key: "poster_model_mix3" } }))) {
    await db.setting.upsert({ where: { key: "poster_model" }, create: { key: "poster_model", value: "mix3" }, update: { value: "mix3" } });
    await db.setting.create({ data: { key: "poster_model_mix3", value: new Date().toISOString() } });
  }
  // The combined "Double Threat" style was replaced by 4 separate styles — hide it.
  await db.template.updateMany({ where: { slug: "player-double-threat" }, data: { active: false } });
  // One-time: Gold XI becomes "Shatter XI" (team colours, no gold) — the owner's request.
  if (!(await db.setting.findUnique({ where: { key: "upgrade_lineup_gold_v2" } }))) {
    await db.template.updateMany({ where: { slug: "lineup-gold" }, data: { name: "Shatter XI", nameEs: "Once Estallido", proInstructions: PRESET_INSTRUCTIONS["lineup-gold"] } });
    await db.setting.create({ data: { key: "upgrade_lineup_gold_v2", value: new Date().toISOString() } });
    await db.setting.upsert({ where: { key: "upgrade_lineup_gold_v1" }, create: { key: "upgrade_lineup_gold_v1", value: "skipped" }, update: {} });
  }
  // One-time: the owner asked for a new Gold XI design — keep a backup of any older instructions, then replace them.
  const goldFlag = await db.setting.findUnique({ where: { key: "upgrade_lineup_gold_v1" } });
  if (!goldFlag) {
    const t = await db.template.findUnique({ where: { slug: "lineup-gold" }, select: { proInstructions: true } });
    if (t?.proInstructions && t.proInstructions !== PRESET_INSTRUCTIONS["lineup-gold"]) {
      await db.setting.upsert({ where: { key: "backup_instructions_lineup_gold" }, create: { key: "backup_instructions_lineup_gold", value: t.proInstructions }, update: { value: t.proInstructions } });
    }
    await db.template.updateMany({ where: { slug: "lineup-gold" }, data: { proInstructions: PRESET_INSTRUCTIONS["lineup-gold"] } });
    await db.setting.create({ data: { key: "upgrade_lineup_gold_v1", value: new Date().toISOString() } });
  }
  // One-time: the owner wants only the monthly plans — switch every one-time credit pack off (can be re-enabled in Admin → Settings → prices).
  if (!(await db.setting.findUnique({ where: { key: "packs_off_v1" } }))) {
    const row = await db.setting.findUnique({ where: { key: "pricing" } });
    const cfg = row?.value ? JSON.parse(row.value) : JSON.parse(JSON.stringify(DEFAULT_PRICING));
    cfg.packs = (cfg.packs?.length ? cfg.packs : DEFAULT_PRICING.packs).map((x: Record<string, unknown>) => ({ ...x, active: false }));
    if (!cfg.plans?.length) cfg.plans = DEFAULT_PRICING.plans;
    await db.setting.upsert({ where: { key: "pricing" }, create: { key: "pricing", value: JSON.stringify(cfg) }, update: { value: JSON.stringify(cfg) } });
    await db.setting.create({ data: { key: "packs_off_v1", value: new Date().toISOString() } });
  }
  // One-time (owner's request): no small team-name line on any poster — the team name is typed to save the team, the crest shows it.
  if (!(await db.setting.findUnique({ where: { key: "no_small_team_name_v6" } }))) {
    const all = await db.template.findMany({ select: { id: true, proInstructions: true } });
    for (const t of all) {
      if (!t.proInstructions) continue;
      const fixed = stripSmallTeamName(t.proInstructions);
      if (fixed !== t.proInstructions) await db.template.update({ where: { id: t.id }, data: { proInstructions: fixed } });
    }
    await db.setting.create({ data: { key: "no_small_team_name_v6", value: new Date().toISOString() } });
  }
  // One-time (owner's request): the original 10 esports player cards stay as they were (restored from any backup
  // made by the earlier esports_cards_v3 step), and the 10 new designs live as their own styles (created above).
  if (!(await db.setting.findUnique({ where: { key: "esports_cards_v4" } }))) {
    const slugs = ["player-crimson-arena", "player-ice-kingdom", "player-inferno-gold", "player-emerald-storm", "player-purple-reign", "player-chrome-noir", "player-sunset-rooftop", "player-tunnel-walkout", "player-midnight-city", "player-colosseum"];
    for (const slug of slugs) {
      const backup = await db.setting.findUnique({ where: { key: `backup_instructions_${slug}` } });
      const text = backup?.value || PRESET_INSTRUCTIONS[slug];
      if (text) await db.template.updateMany({ where: { slug }, data: { proInstructions: text } });
    }
    await db.setting.create({ data: { key: "esports_cards_v4", value: new Date().toISOString() } });
  }
  for (const [key, value] of Object.entries(SETTING_DEFAULTS)) {
    await db.setting.upsert({ where: { key }, create: { key, value }, update: {} });
  }
  console.log(`Seeded ${DEFAULT_TEMPLATES.length} templates.`);
  // One-time (owner's request): standings tables painted by the AI like the style covers (KIXO's exact table off).
  if (!(await db.setting.findUnique({ where: { key: "standings_ai_table_v1" } }))) {
    await db.setting.upsert({ where: { key: "standings_exact_table" }, create: { key: "standings_exact_table", value: "off" }, update: { value: "off" } });
    await db.setting.create({ data: { key: "standings_ai_table_v1", value: new Date().toISOString() } });
  }
  // Qualifiers + Winners showcase: a twin of every Photoshop player style (same look, that layout).
  try {
    const r = await syncAllTwins(db);
    console.log(`Qualifiers twins: ${r.qualifiers.created} created, ${r.qualifiers.updated} updated · Winners twins: ${r.winners.created} created, ${r.winners.updated} updated (${r.qualifiers.sources} sources).`);
  } catch (e) {
    console.error("twins failed", e);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
