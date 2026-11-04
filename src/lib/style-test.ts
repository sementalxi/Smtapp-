// Admin Style test: a server-side queue that makes one poster per style — several at once if asked —
// and keeps going when the admin closes the page. The run lives in a Setting row; the cron advances it
// every minute, and the page pokes it every few seconds while open so nothing waits.
import { db } from "./db";
import { SESSION_COOKIE, signSession } from "./session";
import { bannerBodyFor, type Run, type RunItem, type Sample } from "./style-test-inputs";

export type { Run, RunItem };

const KEY = "style_test_run";
const STALE_MS = 8 * 60_000; // a poster older than this and still processing is dead (reapStale fails + refunds it)
const BATCH = 10; // requests fired together
const TIME_BUDGET_MS = 40_000; // per advance() call — the rest waits for the next tick
const RETRY_AFTER_MS = 60_000; // a rate-limited (429) poster is tried again once the minute window has passed
const MAX_RETRIES = 2;
const site = () => (process.env.NEXT_PUBLIC_APP_URL || "https://kixo.pro").replace(/\/+$/, "");
/** A "too many at once" failure (not a billing 429 — those won't pass by waiting). */
const isRateLimited = (err: string | null) => !!err && /\b429\b|rate.?limit|too many requests/i.test(err) && !/insufficient_quota|credit_balance|billing|TOP_UP|exhausted/i.test(err);

async function read(): Promise<{ run: Run | null; raw: string | null }> {
  const row = await db.setting.findUnique({ where: { key: KEY } });
  if (!row?.value) return { run: null, raw: null };
  try {
    return { run: JSON.parse(row.value) as Run, raw: row.value };
  } catch {
    return { run: null, raw: row.value };
  }
}

export async function getRun() {
  return (await read()).run;
}

/**
 * Read-modify-write with a compare-and-swap on the stored JSON, so the cron and the page can't both claim the
 * same styles. `fn` returns false to leave the run untouched. Resolves to the saved run (or the current one).
 */
async function mutate(fn: (run: Run | null) => Run | false): Promise<Run | null> {
  for (let i = 0; i < 6; i++) {
    const { run, raw } = await read();
    const next = fn(run ? (JSON.parse(JSON.stringify(run)) as Run) : null);
    if (next === false) return run;
    const value = JSON.stringify(next);
    if (raw === null) {
      const made = await db.setting.createMany({ data: [{ key: KEY, value }], skipDuplicates: true });
      if (made.count === 1) return next;
    } else {
      const upd = await db.setting.updateMany({ where: { key: KEY, value: raw }, data: { value } });
      if (upd.count === 1) return next;
    }
    await new Promise((r) => setTimeout(r, 100 + Math.random() * 200));
  }
  return (await read()).run;
}

/** Starts a run (or adds to the current one — resuming it if paused) and fires the first posters right away. */
export async function startRun(userId: string, items: RunItem[], sample: Sample, parallel: number): Promise<Run | null> {
  await mutate((cur) => {
    if (cur && (cur.status === "running" || cur.status === "paused") && cur.userId === userId) {
      const have = new Set(cur.queue.slice(cur.next).map((q) => q.id));
      return { ...cur, queue: [...cur.queue, ...items.filter((i) => !have.has(i.id))], sample, parallel, status: "running" };
    }
    return { id: `run-${Date.now().toString(36)}`, userId, queue: items, next: 0, status: "running", startedAt: new Date().toISOString(), sample, parallel, skipped: [], retries: {} };
  });
  await advanceStyleTest().catch(() => {});
  return getRun();
}

/** Pause: posters being made finish, nothing new starts until resume. */
export async function pauseRun() {
  return mutate((run) => (run && run.status === "running" ? { ...run, status: "paused" } : false));
}

export async function resumeRun() {
  await mutate((run) => (run && run.status === "paused" ? { ...run, status: "running" } : false));
  await advanceStyleTest().catch(() => {});
  return getRun();
}

/** Stop: ends the round (posters being made still finish — an AI call can't be cancelled halfway). */
export async function stopRun() {
  return mutate((run) => (run && (run.status === "running" || run.status === "paused") ? { ...run, status: "stopped" } : false));
}

/** This run's posters that are still being made. */
async function inFlight(run: Run) {
  const list = await db.banner.findMany({
    where: { userId: run.userId, status: "PROCESSING", createdAt: { gte: new Date(Date.now() - STALE_MS) } },
    select: { id: true, design: true },
  });
  return list.filter((b) => (b.design as { styleTest?: string } | null)?.styleTest === run.id);
}

/**
 * Rate-limited posters (OpenAI 429) get another go once the minute window has passed — so "all at once" still
 * ends with every style made. At most MAX_RETRIES per style.
 */
async function requeueRateLimited(run: Run): Promise<Run> {
  const failed = await db.banner.findMany({
    where: { userId: run.userId, status: "FAILED", createdAt: { gte: new Date(run.startedAt) }, updatedAt: { lte: new Date(Date.now() - RETRY_AFTER_MS) } },
    select: { id: true, templateId: true, error: true, design: true },
  });
  const seen = new Set(run.requeued ?? []);
  const again = failed.filter((b) => (b.design as { styleTest?: string } | null)?.styleTest === run.id && !seen.has(b.id) && isRateLimited(b.error));
  if (!again.length) return run;
  const saved = await mutate((cur) => {
    if (!cur || cur.id !== run.id || cur.status !== "running") return false;
    const retries = { ...(cur.retries ?? {}) };
    const requeued = [...(cur.requeued ?? [])];
    const add: RunItem[] = [];
    for (const b of again) {
      requeued.push(b.id);
      const n = retries[b.templateId] ?? 0;
      const item = cur.queue.find((q) => q.id === b.templateId);
      if (n >= MAX_RETRIES || !item) continue;
      retries[b.templateId] = n + 1;
      add.push(item);
    }
    return { ...cur, queue: [...cur.queue, ...add], retries, requeued: requeued.slice(-500) };
  });
  return saved ?? run;
}

/** 429 failures of this run that haven't had their automatic retry decided yet (they're still inside the minute window). */
async function pendingRateLimited(run: Run) {
  const failed = await db.banner.findMany({
    where: { userId: run.userId, status: "FAILED", createdAt: { gte: new Date(run.startedAt) } },
    select: { id: true, error: true, design: true },
  });
  const seen = new Set(run.requeued ?? []);
  return failed.some((b) => (b.design as { styleTest?: string } | null)?.styleTest === run.id && !seen.has(b.id) && isRateLimited(b.error));
}

async function post(t: RunItem, run: Run, cookie: string): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const r = await fetch(`${site()}/api/banners`, {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie },
      body: JSON.stringify(bannerBodyFor(t, run.sample, run.id)),
      signal: AbortSignal.timeout(25_000),
    });
    const d = ((await r.json().catch(() => ({}))) ?? {}) as { id?: string; error?: string; detail?: string };
    if (r.ok && d.id) return { ok: true };
    return { ok: false, error: `${d.error ?? r.status}${d.detail ? ` — ${d.detail}` : ""}` };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "request failed" };
  }
}

/**
 * Fires the next styles — as many as `parallel` allows (0 = all) minus the ones still being made. Safe to call
 * often (cron every minute + the page every few seconds). Returns what it did.
 */
export async function advanceStyleTest(): Promise<"idle" | "busy" | "started" | "done"> {
  let run = await getRun();
  if (!run || run.status !== "running") return "idle";
  run = await requeueRateLimited(run);
  const flying = await inFlight(run);
  // Rounds started before "at once" existed carry on one by one.
  const limit = run.parallel === undefined ? 1 : run.parallel > 0 ? run.parallel : Number.POSITIVE_INFINITY;
  let room = Math.max(0, limit - flying.length);
  if (run.next >= run.queue.length) {
    if (flying.length) return "busy";
    if (await pendingRateLimited(run)) return "busy"; // their retry is decided once the minute window has passed
    await mutate((cur) => (cur && cur.id === run!.id && cur.status === "running" && cur.next >= cur.queue.length ? { ...cur, status: "done" } : false));
    return "done";
  }
  if (!room) return "busy";

  const t0 = Date.now();
  const cookie = `${SESSION_COOKIE}=${await signSession(run.userId)}`;
  let started = 0;
  while (room > 0 && Date.now() - t0 < TIME_BUDGET_MS) {
    // Claim a batch first (compare-and-swap) so two callers can't fire the same style.
    let batch: RunItem[] = [];
    const claimed = await mutate((cur) => {
      if (!cur || cur.id !== run!.id || cur.status !== "running" || cur.next >= cur.queue.length) return false;
      batch = cur.queue.slice(cur.next, cur.next + Math.min(BATCH, room));
      return { ...cur, next: cur.next + batch.length };
    });
    if (!claimed || !batch.length) break;
    const outcomes = await Promise.all(batch.map((t) => post(t, run!, cookie)));
    const skipped = batch.map((t, i) => ({ t, o: outcomes[i] })).filter((x): x is { t: RunItem; o: { ok: false; error: string } } => !x.o.ok);
    started += batch.length - skipped.length;
    room -= batch.length;
    if (skipped.length) {
      // Refused before a poster existed (blocked text, bad input…): noted, and the round carries on.
      await mutate((cur) => (cur ? { ...cur, skipped: [...(cur.skipped ?? []), ...skipped.map((x) => ({ templateId: x.t.id, error: x.o.error, at: new Date().toISOString() }))].slice(-300) } : false));
    }
  }
  return started ? "started" : "busy";
}
