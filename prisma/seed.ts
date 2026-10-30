// Inserts the default templates and settings. Safe to re-run: it never
// overwrites templates an admin has already edited.
import { PrismaClient, Prisma } from "@prisma/client";
import { DEFAULT_TEMPLATES } from "../src/lib/templates";
import { SETTING_DEFAULTS } from "../src/lib/settings";
import { PRESET_INSTRUCTIONS } from "../src/lib/style-presets";

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
    await db.template.updateMany({ where: { slug, OR: [{ proInstructions: null }, { proInstructions: "" }] }, data: { proInstructions: text } });
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
