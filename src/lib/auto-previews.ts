// New built-in styles without a preview picture get one made automatically: the cron starts a Style test round
// (as the first admin, free) for them once, and every finished poster becomes its style's preview — so new styles
// show a real KIXO example in Create without anyone running the test by hand. For batches marked `ref`, that same
// poster also becomes the style's reference image (the look every new poster of the style is matched to).
import sharp from "sharp";
import { db } from "./db";
import { loadBytes, saveFile } from "./storage";
import { posterAsStyleRef } from "./style-ref";
import { DEFAULT_SAMPLE } from "./style-test-inputs";

type Batch = {
  key: string;
  slugs: string[];
  /** The finished poster also becomes the style's reference image — only where the style has none, and only once. */
  ref?: boolean;
  /** The name written on the test posters (default: the Style test's own sample name). */
  name?: string;
  /** How many posters are made at the same time (0 = all at once). */
  parallel?: number;
};

const BATCHES: Batch[] = [
  { key: "auto_previews_champs_v1", slugs: ["champ-kit-cup", "champ-celebration-party", "champ-stadium-bold", "champ-gold-crest-trophy", "champ-mascot-graffiti", "champ-player-hero"] },
  // v3: the v2 round made nothing — player cards were refused without a photo. The style test may now make them
  // with an invented test player (no photo is sent), a few at a time.
  {
    key: "auto_previews_players_v3",
    ref: true,
    name: "KIXO",
    parallel: 6,
    slugs: ["player-gold-skyline", "player-golden-blaze", "player-steel-red", "player-royal-split", "player-riot-collage", "player-red-beams", "player-thunder-night", "player-violet-peak", "player-blood-gothic", "player-double-exposure", "player-carved-crown", "player-living-statue"],
  },
];

const TICK_BUDGET_MS = 20_000; // the cron call has other work to do too — the rest waits for the next minute

async function readList(key: string): Promise<string[]> {
  try {
    const row = await db.setting.findUnique({ where: { key } });
    const v: unknown = row?.value ? JSON.parse(row.value) : [];
    return Array.isArray(v) ? v.map(String) : [];
  } catch {
    return [];
  }
}

export async function autoPreviewsTick() {
  const t0 = Date.now();
  for (const b of BATCHES) {
    const tpls = await db.template.findMany({ where: { slug: { in: b.slugs }, active: true, deletedAt: null }, select: { id: true, name: true, layout: true, slug: true, textSlots: true, thumbUrl: true, styleRefUrl: true } });
    if (!tpls.length) continue;
    const started = await db.setting.findUnique({ where: { key: b.key } });
    if (!started) {
      // don't take over a round the admin is running
      const { getRun, startRun } = await import("./style-test");
      const cur = await getRun();
      if (cur && (cur.status === "running" || cur.status === "paused")) continue;
      const admin = await db.user.findFirst({ where: { role: "ADMIN" }, orderBy: { createdAt: "asc" }, select: { id: true } });
      if (!admin) continue;
      const need = tpls.filter((t) => !t.thumbUrl || (b.ref && !t.styleRefUrl));
      await db.setting.create({ data: { key: b.key, value: new Date().toISOString() } });
      if (!need.length) continue;
      const site = (process.env.NEXT_PUBLIC_APP_URL || "https://kixo.pro").replace(/\/+$/, "");
      const parallel = b.parallel ?? 0;
      // a KIXO test crest (made for testing) so the crest-led layouts show a real crest
      const sample = { ...DEFAULT_SAMPLE, ...(b.name ? { name: b.name } : {}), team: "NEON WOLVES", competition: "KIXO Pro League", logoUrl: `${site}/refs/test-crests/neon-wolves.png`, colorMode: "template" as const, parallel };
      const run = await startRun(admin.id, need.map((t) => ({ id: t.id, name: t.name, layout: t.layout, logoCreate: false, slug: t.slug, textSlots: t.textSlots })), sample, parallel);
      if (run) await db.setting.update({ where: { key: b.key }, data: { value: run.id } });
      continue;
    }
    // Finished posters of that round → previews (only for styles still without one) and, for `ref` batches,
    // reference images (only for styles without one, and only once — a reference the admin removes stays removed).
    const runId = started.value;
    if (!runId.startsWith("run-")) continue;
    const refKey = `${b.key}:refs`;
    const refDone = new Set(b.ref ? await readList(refKey) : []);
    for (const t of tpls) {
      const wantThumb = !t.thumbUrl;
      const wantRef = !!b.ref && !t.styleRefUrl && !refDone.has(t.slug);
      if (!wantThumb && !wantRef) continue;
      if (Date.now() - t0 > TICK_BUDGET_MS) return;
      const done = await db.banner.findFirst({
        where: { templateId: t.id, status: "READY", finalUrl: { not: null }, design: { path: ["styleTest"], equals: runId } },
        select: { finalUrl: true },
        orderBy: { createdAt: "desc" },
      });
      if (!done?.finalUrl) continue;
      try {
        const bytes = await loadBytes(done.finalUrl);
        const data: { thumbUrl?: string; styleRefUrl?: string } = {};
        if (wantThumb) data.thumbUrl = await saveFile("thumbs", await sharp(bytes).resize({ width: 800, height: 1000, fit: "cover" }).jpeg({ quality: 85 }).toBuffer(), "image/jpeg");
        if (wantRef) data.styleRefUrl = await posterAsStyleRef(bytes, true);
        await db.template.update({ where: { id: t.id }, data });
        if (wantRef) {
          refDone.add(t.slug);
          const value = JSON.stringify([...refDone]);
          await db.setting.upsert({ where: { key: refKey }, create: { key: refKey, value }, update: { value } });
        }
        await import("./rev").then((m) => m.bumpRev()).catch(() => {});
      } catch (e) {
        console.error("auto preview failed", t.slug, e);
      }
    }
  }
}
