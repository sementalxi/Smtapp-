import { db } from "./db";

const KEY = "site_rev";

/**
 * Site revision — a number that changes whenever an admin saves something or a user does
 * something other people can see (a poster finished, deleted…). Every open page polls it and
 * reloads its data when it changes, and the server caches are keyed by it, so all Vercel
 * instances pick up a change within a few seconds.
 */
export async function getRev(): Promise<string> {
  const { memo } = await import("./memo");
  const row = await memo<{ value: string } | null>("rev", 3_000, () => db.setting.findUnique({ where: { key: KEY }, select: { value: true } }));
  return row?.value || "0";
}

/** Call after anything that should show up on other people's screens. Never throws. */
export async function bumpRev() {
  const value = String(Date.now());
  try {
    await db.setting.upsert({ where: { key: KEY }, create: { key: KEY, value }, update: { value } });
  } catch {}
  const { bust } = await import("./memo");
  bust("rev", "settings", "texts", "templates:");
}
