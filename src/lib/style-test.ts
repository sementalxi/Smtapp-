// Admin Style test: a server-side queue that keeps making one poster per style, one at a time,
// even when the admin closes the page. The run lives in a Setting row; the cron advances it every minute,
// and the page pokes it as soon as a poster finishes so it doesn't wait for the cron.
import { db } from "./db";
import { SESSION_COOKIE, signSession } from "./session";
import { bannerBodyFor, type Run, type RunItem, type Sample } from "./style-test-inputs";

export type { Run, RunItem };

const KEY = "style_test_run";
const STALE_MS = 8 * 60_000; // a poster older than this and still processing is treated as dead (reapStale refunds it)
const site = () => (process.env.NEXT_PUBLIC_APP_URL || "https://kixo.pro").replace(/\/+$/, "");

export async function getRun(): Promise<Run | null> {
  const row = await db.setting.findUnique({ where: { key: KEY } });
  if (!row?.value) return null;
  try {
    return JSON.parse(row.value) as Run;
  } catch {
    return null;
  }
}

async function saveRun(run: Run) {
  const value = JSON.stringify(run);
  await db.setting.upsert({ where: { key: KEY }, create: { key: KEY, value }, update: { value } });
}

/** Starts a run (or appends to the running one) and kicks off the first poster right away. */
export async function startRun(userId: string, items: RunItem[], sample: Sample): Promise<Run> {
  const cur = await getRun();
  let run: Run;
  if (cur && (cur.status === "running" || cur.status === "paused") && cur.userId === userId) {
    // Add to the current round (and get it going again if it was paused).
    const have = new Set(cur.queue.slice(cur.next).map((q) => q.id));
    run = { ...cur, queue: [...cur.queue, ...items.filter((i) => !have.has(i.id))], sample, status: "running" };
  } else {
    run = { id: `run-${Date.now().toString(36)}`, userId, queue: items, next: 0, status: "running", startedAt: new Date().toISOString(), sample, skipped: [] };
  }
  await saveRun(run);
  await advanceStyleTest().catch(() => {});
  return (await getRun()) ?? run;
}

/** Pause: the poster being made finishes, nothing new starts until resume. */
export async function pauseRun() {
  const run = await getRun();
  if (!run || run.status !== "running") return run;
  run.status = "paused";
  await saveRun(run);
  return run;
}

export async function resumeRun() {
  const run = await getRun();
  if (!run || run.status !== "paused") return run;
  run.status = "running";
  await saveRun(run);
  await advanceStyleTest().catch(() => {});
  return (await getRun()) ?? run;
}

/** Stop: ends the round (the poster being made still finishes — an AI call can't be cancelled halfway). */
export async function stopRun() {
  const run = await getRun();
  if (!run || (run.status !== "running" && run.status !== "paused")) return run;
  run.status = "stopped";
  await saveRun(run);
  return run;
}

/** The poster of this run that is still being made, if any. */
async function inFlight(run: Run) {
  const list = await db.banner.findMany({
    where: { userId: run.userId, status: "PROCESSING", createdAt: { gte: new Date(Date.now() - STALE_MS) } }, // older ones are dead — reapStale fails + refunds them
    orderBy: { createdAt: "desc" },
    select: { id: true, createdAt: true, design: true },
  });
  return list.find((b) => (b.design as { styleTest?: string } | null)?.styleTest === run.id) ?? null;
}

/**
 * Starts the next style when nothing is in flight. Safe to call often (cron every minute + the page after each
 * finished poster). Returns what it did.
 */
export async function advanceStyleTest(): Promise<"idle" | "busy" | "started" | "done"> {
  const run = await getRun();
  if (!run || run.status !== "running") return "idle";
  if (await inFlight(run)) return "busy";
  while (run.next < run.queue.length) {
    const t = run.queue[run.next];
    run.next += 1;
    await saveRun(run); // claim the slot first so two callers can't start the same style
    const cookie = `${SESSION_COOKIE}=${await signSession(run.userId)}`;
    const r = await fetch(`${site()}/api/banners`, {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie },
      body: JSON.stringify(bannerBodyFor(t, run.sample, run.id)),
      signal: AbortSignal.timeout(25_000),
    }).catch(() => null);
    const d = ((await r?.json().catch(() => ({}))) ?? {}) as { id?: string; error?: string; detail?: string };
    if (r?.ok && d.id) return "started";
    // Refused before a poster existed (blocked text, bad input…): note it and move on to the next style.
    run.skipped = [...(run.skipped ?? []), { templateId: t.id, error: `${d.error ?? r?.status ?? "request failed"}${d.detail ? ` — ${d.detail}` : ""}`, at: new Date().toISOString() }].slice(-200);
    await saveRun(run);
  }
  run.status = "done";
  await saveRun(run);
  return "done";
}
