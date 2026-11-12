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
   * reference. A preview or reference the admin picked in the meantime is never touched. An empty id ("") is for a
   * style whose reference was already taken off: it is redone only while it still has none. "*" redoes the style
   * whatever reference it has now.
   */
  redo?: Record<string, string>;
  /** Styles whose poster failed get this many more rounds once the round has ended (default: none). */
  retries?: number;
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
  // Six more player styles (the set was 18 ideas; 12 were built first). Same as v3: one poster each with an
  // invented test player becomes the style's preview and its reference image.
  {
    key: "auto_previews_players_v4",
    ref: true,
    name: "KIXO",
    parallel: 6,
    slugs: ["player-cloud-nine", "player-fire-ice", "player-marble-gold", "player-red-liquid", "player-gold-legacy", "player-crimson-script"],
  },
  // (A redo of Cloud Nine — "auto_previews_players_v4_redo1" — started here once and its poster failed at the text
  // step; the redo below makes it again.)
  // 20 more player styles (the owner's second set of ideas): one poster each with an invented test player becomes
  // the style's preview and its reference image, as in v3 / v4. A failed poster gets one more round.
  {
    key: "auto_previews_players_v5",
    ref: true,
    name: "KIXO",
    parallel: 6,
    retries: 1,
    slugs: [
      "player-desert-temple", "player-torn-sky", "player-lava-throne", "player-golden-smoke", "player-night-hero",
      "player-red-grain", "player-amber-eyes", "player-midnight-gold", "player-mono-collage", "player-red-pride",
      "player-storm-profile", "player-skyline-ice", "player-cash-rain", "player-gold-rush", "player-titan-city",
      "player-chrome-drip", "player-turbo-chrome", "player-heavy-metal", "player-neon-tunnel", "player-copper-ice",
    ],
  },
  // The v5 round made 12 of the 20; the OpenAI account then ran out of credit and the other eight failed at the
  // text step (twice — the retry too). They are made here once the account works again (see outOfCredit).
  {
    key: "auto_previews_players_v6",
    ref: true,
    name: "KIXO",
    parallel: 4,
    retries: 1,
    slugs: ["player-desert-temple", "player-red-grain", "player-amber-eyes", "player-midnight-gold", "player-red-pride", "player-skyline-ice", "player-gold-rush", "player-chrome-drip"],
  },
  // Four styles the owner changed after their posters were made — Cloud Nine (no crown, one figure), Royal Split
  // (two calm figures, no ball), Living Statue (an all-plaster bust, a small portrait, no crowd) and Double Exposure
  // (calm portraits, no gaming desk, no ball) — and none of them shows a faded copy of the crest any more. Their
  // previews still show the old designs. ("auto_previews_players_redo2" was the same redo: it started into the
  // empty OpenAI account and made nothing.) Three have no reference now (""); Living Statue is redone whatever it
  // has ("*": redo2 took its old reference off if it got that far).
  {
    key: "auto_previews_players_redo3",
    name: "KIXO",
    parallel: 4,
    retries: 1,
    slugs: ["player-cloud-nine", "player-royal-split", "player-living-statue", "player-double-exposure"],
    redo: { "player-cloud-nine": "", "player-royal-split": "", "player-living-statue": "*", "player-double-exposure": "" },
  },
  // The new styles' first posters were made before [NO ECHO] existed, so most of their references show the test
  // crest once more, faded, in the background. Does a card with another crest keep that faded test emblem? Six of
  // them (the ones whose reference shows it most) with other texts and another crest; nothing is saved onto the styles.
  {
    key: "auto_check_players_noecho_v1",
    parallel: 6,
    slugs: ["player-heavy-metal", "player-storm-profile", "player-midnight-gold", "player-gold-rush", "player-double-exposure", "player-royal-split"],
    check: { texts: { name: "ZAYDEN99", position: "CDM", number: "23", tagline: "Official", subtitle: "Player of the month", footer: "Pro Clubs 2027" }, team: "OCEAN KRAKEN", crest: "ocean-kraken" },
  },
  // Third set of 20 player styles (the owner's third set of ideas): one poster each with an invented test player becomes
  // the style's preview and its reference image. Waits while the OpenAI account has no credit (outOfCredit).
  {
    key: "auto_previews_players_v7",
    ref: true,
    name: "KIXO",
    parallel: 4,
    retries: 1,
    slugs: ["player-glass-rings","player-sepia-ribbons","player-red-cubist","player-mono-serif","player-grey-wings","player-vertical-blaze","player-triple-run","player-wine-swirl","player-golden-number","player-red-icon","player-candy-stripes","player-red-swash","player-halftone-hero","player-orange-halo","player-red-lens","player-lime-blades","player-stadium-truss","player-court-slash","player-grey-signature","player-fight-night"],
  },
  // Eleven event-flyer styles from the owner's own tournament flyers, made with each flyer's exact texts
  // (lib/event-defaults): one test poster each becomes the preview and the reference image.
  {
    key: "auto_previews_events_v3",
    ref: true,
    parallel: 4,
    retries: 1,
    redo: { "event-star-badge": "*", "event-badge-trio": "*", "event-purple-schedule": "*", "event-trophy-duel": "*", "event-division-tiers": "*", "event-trophy-welcome": "*", "event-chrome-season": "*", "event-mega-purple": "*", "event-magazine-desk": "*", "event-marquee-winner": "*", "event-knight-dungeon": "*" },
    slugs: ["event-star-badge", "event-badge-trio", "event-purple-schedule", "event-trophy-duel", "event-division-tiers", "event-trophy-welcome", "event-chrome-season", "event-mega-purple", "event-magazine-desk", "event-marquee-winner", "event-knight-dungeon"],
  },
  // The 22 newest player styles got more glow, the faded team crest and a 3D title built into the scene: new previews.
  {
    key: "auto_previews_players_v10",
    ref: true,
    name: "KIXO",
    parallel: 4,
    retries: 1,
    redo: {"player-lacquer-script": "*", "player-meteor-crown": "*", "player-mono-meteor": "*", "player-grunge-riot": "*", "player-blue-chrome-stage": "*", "player-neon-split": "*", "player-western-engrave": "*", "player-crystal-rockwall": "*", "player-gold-fest": "*", "player-burning-skyline": "*", "player-velvet-throne": "*", "player-cyan-tunnel": "*", "player-marquee-breakout": "*", "player-amber-film": "*", "player-red-chrome-racer": "*", "player-liquid-chrome": "*", "player-copper-foil": "*", "player-night-brush": "*", "player-sky-signature": "*", "player-ember-lettering": "*", "player-pink-stadium": "*", "player-gold-ribbon": "*"},
    slugs: ["player-lacquer-script", "player-meteor-crown", "player-mono-meteor", "player-grunge-riot", "player-blue-chrome-stage", "player-neon-split", "player-western-engrave", "player-crystal-rockwall", "player-gold-fest", "player-burning-skyline", "player-velvet-throne", "player-cyan-tunnel", "player-marquee-breakout", "player-amber-film", "player-red-chrome-racer", "player-liquid-chrome", "player-copper-foil", "player-night-brush", "player-sky-signature", "player-ember-lettering", "player-pink-stadium", "player-gold-ribbon"],
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

/**
 * The OpenAI account ran out of credit and no poster has been made since. A round would only pay for the art steps
 * and fail at the text step, so none starts. It lifts by itself with the next Pro poster that works.
 */
async function outOfCredit(): Promise<boolean> {
  const failed = await db.banner.findFirst({
    where: { status: "FAILED", OR: ["credit_balance_exhausted", "insufficient_quota", "billing_hard_limit", "exceeded your current quota"].map((m) => ({ error: { contains: m } })) },
    orderBy: { updatedAt: "desc" },
    select: { updatedAt: true },
  });
  if (!failed) return false;
  const worked = await db.banner.findFirst({ where: { status: "READY", mode: "PRO", createdAt: { gt: failed.updatedAt } }, select: { id: true } });
  return !worked;
}

/**
 * Styles of a batch that still have no poster once its round has ended (a failed or refused one) get one more
 * round — at most `b.retries` times. The batch then follows that new round.
 */
async function retryRound(b: Batch, pending: Tpl[], runId: string) {
  if (!b.retries || !pending.length) return;
  const { getRun, startRun } = await import("./style-test");
  const cur = await getRun();
  if (cur && (cur.status === "running" || cur.status === "paused")) return; // this round (or the admin's own) is still going
  const flying = await db.banner.count({ where: { templateId: { in: pending.map((t) => t.id) }, status: "PROCESSING", design: { path: ["styleTest"], equals: runId } } });
  if (flying) return;
  const triesKey = `${b.key}:tries`;
  const row = await db.setting.findUnique({ where: { key: triesKey } });
  const tries = Number(row?.value ?? 0) || 0;
  if (tries >= b.retries) return;
  if (await outOfCredit()) return; // the retry waits for the account, it is not used up
  const admin = await db.user.findFirst({ where: { role: "ADMIN" }, orderBy: { createdAt: "asc" }, select: { id: true } });
  if (!admin) return;
  const value = String(tries + 1);
  await db.setting.upsert({ where: { key: triesKey }, create: { key: triesKey, value }, update: { value } });
  const sample = sampleFor(b);
  const run = await startRun(admin.id, runItems(pending), sample, sample.parallel);
  if (run) await db.setting.update({ where: { key: b.key }, data: { value: run.id } });
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
    if (await outOfCredit()) return;
    const admin = await db.user.findFirst({ where: { role: "ADMIN" }, orderBy: { createdAt: "asc" }, select: { id: true } });
    if (!admin) return;
    const stale = tpls.filter((t) => t.slug in redo && (redo[t.slug] === "*" || (redo[t.slug] ? !!t.styleRefUrl && t.styleRefUrl.includes(redo[t.slug]) : !t.styleRefUrl)));
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
  const pending: Tpl[] = [];
  for (const t of tpls) {
    if (!(t.slug in todo)) continue;
    if (Date.now() - t0 > TICK_BUDGET_MS) return;
    const done = await db.banner.findFirst({
      where: { templateId: t.id, status: "READY", finalUrl: { not: null }, design: { path: ["styleTest"], equals: runId } },
      select: { finalUrl: true },
      orderBy: { createdAt: "desc" },
    });
    if (!done?.finalUrl) {
      pending.push(t);
      continue;
    }
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
  await retryRound(b, pending, runId);
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
      if (await outOfCredit()) continue;
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
      if (await outOfCredit()) continue;
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
    const pending: Tpl[] = [];
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
      if (!done?.finalUrl) {
        pending.push(t);
        continue;
      }
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
    await retryRound(b, pending, runId);
  }
}
