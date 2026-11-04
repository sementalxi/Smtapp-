// Daily reward: signed-in users claim free credits once per day (they must press "Claim").
// The reward follows a 7-day ladder (day 1 … day 7 of a streak, then it starts over); a missed day resets to day 1.
// Admin → Daily reward sets the ladder and the texts. Days roll over at midnight in the site's time zone.
import { db } from "./db";
import { HttpError } from "./auth";
import { grantOnce } from "./credits";
import { getSettings } from "./settings";

/** The site's day boundary (the owner's time zone). */
export const DAILY_TZ = "America/Chicago";
export const DEFAULT_LADDER = [1, 2, 3, 4, 5, 6, 10];

/** The 7 amounts (day 1 … day 7) from the setting, with a safe fallback. */
export function parseLadder(raw: string | undefined): number[] {
  const nums = (raw ?? "").split(",").map((x) => Number(x.trim()));
  return nums.length === 7 && nums.every((n) => Number.isInteger(n) && n >= 0 && n <= 9999) ? nums : DEFAULT_LADDER;
}

/** "YYYY-MM-DD" for a moment in the site's time zone. */
export function dayKey(d = new Date(), tz = DAILY_TZ) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

/** The day before a "YYYY-MM-DD" key. */
export function prevDayKey(key: string) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d) - 86_400_000).toISOString().slice(0, 10);
}

/** When the next day starts in the site's time zone (so the UI can say "resets in 5h 12m"). */
export function nextResetAt(now = new Date(), tz = DAILY_TZ) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" })
      .formatToParts(now)
      .map((p) => [p.type, p.value]),
  );
  const asUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
  const offset = asUtc - now.getTime(); // tz offset at this moment
  return new Date(Date.UTC(+parts.year, +parts.month - 1, +parts.day + 1) - offset);
}

/** Which step of the 7-day ladder (1…7) a streak day is on. */
export const ladderStep = (streakDay: number) => ((Math.max(1, streakDay) - 1) % 7) + 1;

export type DailyStatus = {
  on: boolean;
  ladder: number[]; // credits for day 1 … 7
  claimable: boolean;
  claimedToday: boolean;
  streak: number; // current streak in days (0 when it was broken)
  day: number; // the ladder step (1…7) of today's claim — or of the next claim when today is done
  resetAt: string; // ISO — when the next claim opens
  title: string;
  text: string;
};

export async function dailyStatus(userId: string, locale: string): Promise<DailyStatus> {
  const s = await getSettings();
  const on = s.daily_on !== "0";
  const ladder = parseLadder(s.daily_ladder);
  const u = await db.user.findUnique({ where: { id: userId }, select: { dailyStreak: true, dailyClaimedDay: true } });
  const today = dayKey();
  const claimedToday = u?.dailyClaimedDay === today;
  const alive = claimedToday || u?.dailyClaimedDay === prevDayKey(today);
  const streak = alive ? (u?.dailyStreak ?? 0) : 0;
  // Today's step: the streak day being claimed today (streak + 1 while unclaimed, the streak itself once claimed).
  const day = ladderStep(claimedToday ? streak : streak + 1);
  const es = locale === "es";
  return {
    on,
    ladder,
    claimable: on && !claimedToday && ladder.some((n) => n > 0),
    claimedToday,
    streak,
    day,
    resetAt: nextResetAt().toISOString(),
    title: (es ? s.daily_title_es || s.daily_title : s.daily_title) || (es ? "Recompensa diaria" : "Daily reward"),
    text: (es ? s.daily_text_es || s.daily_text : s.daily_text) || "",
  };
}

/** Grants today's reward exactly once (safe against double clicks and parallel requests). */
export async function claimDaily(userId: string) {
  const s = await getSettings();
  if (s.daily_on === "0") throw new HttpError(404, "daily_off");
  const ladder = parseLadder(s.daily_ladder);
  const u = await db.user.findUniqueOrThrow({ where: { id: userId }, select: { dailyStreak: true, dailyClaimedDay: true } });
  const today = dayKey();
  if (u.dailyClaimedDay === today) throw new HttpError(409, "already_claimed");
  const streak = u.dailyClaimedDay === prevDayKey(today) ? u.dailyStreak + 1 : 1;
  const day = ladderStep(streak);
  const amount = ladder[day - 1] ?? 0;
  if (amount > 0) {
    const ok = await grantOnce({ userId, amount, type: "DAILY", note: `Daily reward · day ${streak} (step ${day}/7)`, externalRef: `daily:${s.daily_epoch || "0"}:${userId}:${today}` });
    if (!ok) throw new HttpError(409, "already_claimed");
  }
  const after = await db.user.update({ where: { id: userId }, data: { dailyStreak: streak, dailyClaimedDay: today, dailyClaimedAt: new Date() }, select: { credits: true } });
  await import("./activity").then((m) => m.logActivity("site", "daily", `🎁 Daily reward claimed: +${amount} credits (day ${streak})`)).catch(() => {});
  return { amount, streak, day, balance: after.credits, resetAt: nextResetAt().toISOString() };
}
