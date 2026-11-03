// Inserts the default templates and settings. Safe to re-run: it never
// overwrites templates an admin has already edited.
import { PrismaClient, Prisma } from "@prisma/client";
import { DEFAULT_TEMPLATES } from "../src/lib/templates";
import { SETTING_DEFAULTS } from "../src/lib/settings";
import { PRESET_INSTRUCTIONS, PRESET_PREVIOUS } from "../src/lib/style-presets";
import { DEFAULT_PRICING } from "../src/lib/pricing";

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
  // One-time (owner's request): hide all the old lineup styles — only the new Photoshop-style ones stay.
  if (!(await db.setting.findUnique({ where: { key: "lineups_v2" } }))) {
    await db.template.updateMany({ where: { layout: "LINEUP", NOT: { slug: { startsWith: "xi-" } } }, data: { active: false } });
    await db.template.updateMany({ where: { slug: { startsWith: "xi-" } }, data: { active: true } });
    await db.setting.create({ data: { key: "lineups_v2", value: new Date().toISOString() } });
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
  for (const [key, value] of Object.entries(SETTING_DEFAULTS)) {
    await db.setting.upsert({ where: { key }, create: { key, value }, update: {} });
  }
  console.log(`Seeded ${DEFAULT_TEMPLATES.length} templates.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
