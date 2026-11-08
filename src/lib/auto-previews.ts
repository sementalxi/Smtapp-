// New built-in styles without a preview picture get one made automatically: the cron starts a Style test round
// (as the first admin, free) for them once, and every finished poster becomes its style's preview — so new styles
// show a real KIXO example in Create without anyone running the test by hand.
import sharp from "sharp";
import { db } from "./db";
import { loadBytes, saveFile } from "./storage";
import { DEFAULT_SAMPLE } from "./style-test-inputs";

const BATCHES: { key: string; slugs: string[] }[] = [
  { key: "auto_previews_champs_v1", slugs: ["champ-kit-cup", "champ-celebration-party", "champ-stadium-bold", "champ-gold-crest-trophy", "champ-mascot-graffiti", "champ-player-hero"] },
];

export async function autoPreviewsTick() {
  for (const b of BATCHES) {
    const tpls = await db.template.findMany({ where: { slug: { in: b.slugs }, active: true, deletedAt: null }, select: { id: true, name: true, layout: true, slug: true, textSlots: true, thumbUrl: true } });
    if (!tpls.length) continue;
    const started = await db.setting.findUnique({ where: { key: b.key } });
    if (!started) {
      // don't take over a round the admin is running
      const { getRun, startRun } = await import("./style-test");
      const cur = await getRun();
      if (cur && (cur.status === "running" || cur.status === "paused")) continue;
      const admin = await db.user.findFirst({ where: { role: "ADMIN" }, orderBy: { createdAt: "asc" }, select: { id: true } });
      if (!admin) continue;
      const need = tpls.filter((t) => !t.thumbUrl);
      await db.setting.create({ data: { key: b.key, value: new Date().toISOString() } });
      if (!need.length) continue;
      const site = (process.env.NEXT_PUBLIC_APP_URL || "https://kixo.pro").replace(/\/+$/, "");
      // a KIXO test crest (made for testing) so the crest-led layouts show a real crest
      const sample = { ...DEFAULT_SAMPLE, team: "NEON WOLVES", competition: "KIXO Pro League", logoUrl: `${site}/refs/test-crests/neon-wolves.png`, colorMode: "template" as const, parallel: 0 };
      const run = await startRun(admin.id, need.map((t) => ({ id: t.id, name: t.name, layout: t.layout, logoCreate: false, slug: t.slug, textSlots: t.textSlots })), sample, 0);
      if (run) await db.setting.update({ where: { key: b.key }, data: { value: run.id } });
      continue;
    }
    // Finished posters of that round → previews (only for styles still without one).
    const runId = started.value;
    if (!runId.startsWith("run-")) continue;
    for (const t of tpls.filter((x) => !x.thumbUrl)) {
      const done = await db.banner.findFirst({
        where: { templateId: t.id, status: "READY", finalUrl: { not: null }, design: { path: ["styleTest"], equals: runId } },
        select: { finalUrl: true },
        orderBy: { createdAt: "desc" },
      });
      if (!done?.finalUrl) continue;
      try {
        const small = await sharp(await loadBytes(done.finalUrl)).resize({ width: 800, height: 1000, fit: "cover" }).jpeg({ quality: 85 }).toBuffer();
        await db.template.update({ where: { id: t.id }, data: { thumbUrl: await saveFile("thumbs", small, "image/jpeg") } });
        await import("./rev").then((m) => m.bumpRev()).catch(() => {});
      } catch (e) {
        console.error("auto preview failed", t.slug, e);
      }
    }
  }
}
