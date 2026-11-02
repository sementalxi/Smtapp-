// Inserts the default templates and settings. Safe to re-run: it never
// overwrites templates an admin has already edited.
import { PrismaClient, Prisma } from "@prisma/client";
import { DEFAULT_TEMPLATES } from "../src/lib/templates";
import { SETTING_DEFAULTS } from "../src/lib/settings";
import { PRESET_INSTRUCTIONS, PRESET_PREVIOUS } from "../src/lib/style-presets";

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
      },
      update: {},
    });
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
