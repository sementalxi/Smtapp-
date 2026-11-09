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
  /**
   * A redo for styles an earlier round already gave a preview and a reference: slug → the file id of that
   * reference. While a style still has that reference it is taken off (so the new poster is made from the brief
   * alone, not matched to the old one), a new poster is made, and it replaces that preview and becomes the
   * reference. A preview or reference the admin picked in the meantime is never touched.
   */
  redo?: Record<string, string>;
  /**
   * A plain test round: one poster per style with other texts and another crest than the previews have. Nothing is
   * saved onto the styles — the posters land in the admin's Style test results, to see what a style really makes.
   */
  check?: { texts: { name: string; position: string; number: string; tagline: string; subtitle: string; footer: string }; team: string; crest: string };
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
  // Two posters of the v3 round are made again: Living Statue came out without its statue (its brief was rewritten
  // — the statue is now the card's big portrait) and Royal Split's poster misspelled the subtitle.
  {
    key: "auto_previews_players_v3_redo1",
    name: "KIXO",
    parallel: 6,
    slugs: ["player-living-statue", "player-royal-split"],
    redo: { "player-living-statue": "5ef5c96a-c0cc-42fc-9b70-ac278bea8f0c", "player-royal-split": "c41fbaa9-2afa-41bc-9464-475e96c3a585" },
  },
  // The 12 styles became exact copies of their reference posters ([EXACT REF]). One test poster each with OTHER
  // texts and another crest shows that only the player, the texts and the crest change — and nothing of the
  // reference's own words or emblem comes along.
  {
    key: "auto_check_players_exact_v1",
    parallel: 6,
    slugs: ["player-gold-skyline", "player-golden-blaze", "player-steel-red", "player-royal-split", "player-riot-collage", "player-red-beams", "player-thunder-night", "player-violet-peak", "player-blood-gothic", "player-double-exposure", "player-carved-crown", "player-living-statue"],
    check: { texts: { name: "ZAYDEN99", position: "CDM", number: "23", tagline: "Official", subtitle: "Player of the month", footer: "Pro Clubs 2027" }, team: "OCEAN KRAKEN", crest: "ocean-kraken" },
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

type Tpl = { id: string; name: string; layout: string; slug: string; textSlots: string | null; thumbUrl: string | null; styleRefUrl: string | null };

/** The test poster's texts and crest: a KIXO test crest (made for testing) so the crest-led layouts show a real crest. */
function sampleFor(b: Batch) {
  const site = (process.env.NEXT_PUBLIC_APP_URL || "https://kixo.pro").replace(/\/+$/, "");
  const parallel = b.parallel ?? 0;
  const base = { ...DEFAULT_SAMPLE, ...(b.name ? { name: b.name } : {}), team: "NEON WOLVES", competition: "KIXO Pro League", logoUrl: `${site}/refs/test-crests/neon-wolves.png`, colorMode: "template" as const, parallel };
  return b.check ? { ...base, ...b.check.texts, team: b.check.team, logoUrl: `${site}/refs/test-crests/${b.check.crest}.png` } : base;
}

const runItems = (list: Tpl[]) => list.map((t) => ({ id: t.id, name: t.name, layout: t.layout, logoCreate: false, slug: t.slug, textSlots: t.textSlots }));
const previewOf = (bytes: Buffer) => sharp(bytes).resize({ width: 800, height: 1000, fit: "cover" }).jpeg({ quality: 85 }).toBuffer();

async function readMap(key: string): Promise<Record<string, string>> {
  try {
    const row = await db.setting.findUnique({ where: { key } });
    const v: unknown = row?.value ? JSON.parse(row.value) : {};
    return v && typeof v === "object" && !Array.isArray(v) ? Object.fromEntries(Object.entries(v as Record<string, unknown>).map(([k, x]) => [k, String(x ?? "")])) : {};
  } catch {
    return {};
  }
}

/** One step of a redo batch (see Batch.redo). */
async function redoTick(b: Batch, tpls: Tpl[], t0: number) {
  const redo = b.redo ?? {};
  const todoKey = `${b.key}:todo`;
  const saveTodo = (todo: Record<string, string>) => {
    const value = JSON.stringify(todo);
    return db.setting.upsert({ where: { key: todoKey }, create: { key: todoKey, value }, update: { value } });
  };
  const started = await db.setting.findUnique({ where: { key: b.key } });
  if (!started) {
    const { getRun, startRun } = await import("./style-test");
    const cur = await getRun();
    if (cur && (cur.status === "running" || cur.status === "paused")) return; // not while the admin runs a round
    const admin = await db.user.findFirst({ where: { role: "ADMIN" }, orderBy: { createdAt: "asc" }, select: { id: true } });
    if (!admin) return;
    const stale = tpls.filter((t) => !!redo[t.slug] && !!t.styleRefUrl && t.styleRefUrl.includes(redo[t.slug]));
    await db.setting.create({ data: { key: b.key, value: new Date().toISOString() } });
    if (!stale.length) return;
    // slug → the preview it has now (replaced later only if it is still that one)
    await saveTodo(Object.fromEntries(stale.map((t) => [t.slug, t.thumbUrl ?? ""])));
    // The old reference comes off first, so the new poster is made from the brief alone.
    await db.template.updateMany({ where: { id: { in: stale.map((t) => t.id) } }, data: { styleRefUrl: null } });
    const sample = sampleFor(b);
    const run = await startRun(admin.id, runItems(stale), sample, sample.parallel);
    if (run) await db.setting.update({ where: { key: b.key }, data: { value: run.id } });
    return;
  }
  const runId = started.value;
  if (!runId.startsWith("run-")) return;
  const todo = await readMap(todoKey);
  for (const t of tpls) {
    if (!(t.slug in todo)) continue;
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
      if ((t.thumbUrl ?? "") === todo[t.slug]) data.thumbUrl = await saveFile("thumbs", await previewOf(bytes), "image/jpeg");
      const oldRef = redo[t.slug];
      if (!t.styleRefUrl || (!!oldRef && t.styleRefUrl.includes(oldRef))) data.styleRefUrl = await posterAsStyleRef(bytes, true);
      if (data.thumbUrl || data.styleRefUrl) await db.template.update({ where: { id: t.id }, data });
      delete todo[t.slug];
      await saveTodo(todo);
      await import("./rev").then((m) => m.bumpRev()).catch(() => {});
    } catch (e) {
      console.error("auto preview redo failed", t.slug, e);
    }
  }
}

export async function autoPreviewsTick() {
  const t0 = Date.now();
  for (const b of BATCHES) {
    const tpls: Tpl[] = await db.template.findMany({ where: { slug: { in: b.slugs }, active: true, deletedAt: null }, select: { id: true, name: true, layout: true, slug: true, textSlots: true, thumbUrl: true, styleRefUrl: true } });
    if (!tpls.length) continue;
    if (b.redo) {
      await redoTick(b, tpls, t0);
      continue;
    }
    if (b.check) {
      // Started once; its posters are only looked at (Admin → Style test), never saved onto the styles.
      if (await db.setting.findUnique({ where: { key: b.key } })) continue;
      const { getRun, startRun } = await import("./style-test");
      const cur = await getRun();
      if (cur && (cur.status === "running" || cur.status === "paused")) continue;
      const admin = await db.user.findFirst({ where: { role: "ADMIN" }, orderBy: { createdAt: "asc" }, select: { id: true } });
      if (!admin) continue;
      await db.setting.create({ data: { key: b.key, value: new Date().toISOString() } });
      const sample = sampleFor(b);
      const run = await startRun(admin.id, runItems(tpls), sample, sample.parallel);
      if (run) await db.setting.update({ where: { key: b.key }, data: { value: run.id } });
      continue;
    }
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
      const sample = sampleFor(b);
      const run = await startRun(admin.id, runItems(need), sample, sample.parallel);
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
        if (wantThumb) data.thumbUrl = await saveFile("thumbs", await previewOf(bytes), "image/jpeg");
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
