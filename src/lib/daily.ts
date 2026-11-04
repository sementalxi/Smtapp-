// Daily reward: signed-in users can claim free credits once per day (they must press "Claim").
// Admin → Settings sets the amount, the streak bonus and the texts. Days roll over at midnight in the site's time zone.
import { db } from "./db";
import { HttpError } from "./auth";
import { grantOnce } from "./credits";
import { getSettings } from "./settings";

/** The site's day boundary (the owner's time zone). */
export const DAILY_TZ = "America/Chicago";

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

export type DailyStatus = {
  on: boolean;
  credits: number;
  bonus: number; // extra credits on every 7th consecutive day (0 = off)
  claimable: boolean;
  claimedToday: boolean;
  streak: number; // current streak (0 when it was broken)
  resetAt: string; // ISO — when the next claim opens
  title: string;
  text: string;
};

export async function dailyStatus(userId: string, locale: string): Promise<DailyStatus> {
  const s = await getSettings();
  const on = s.daily_on !== "0";
  const credits = Math.max(0, Number(s.daily_credits) || 0);
  const bonus = Math.max(0, Number(s.daily_streak_bonus) || 0);
  const u = await db.user.findUnique({ where: { id: userId }, select: { dailyStreak: true, dailyClaimedDay: true } });
  const today = dayKey();
  const claimedToday = u?.dailyClaimedDay === today;
  const streak = claimedToday || u?.dailyClaimedDay === prevDayKey(today) ? (u?.dailyStreak ?? 0) : 0;
  const es = locale === "es";
  return {
    on,
    credits,
    bonus,
    claimable: on && credits > 0 && !claimedToday,
    claimedToday,
    streak,
    resetAt: nextResetAt().toISOString(),
    title: (es ? s.daily_title_es || s.daily_title : s.daily_title) || (es ? "Recompensa diaria" : "Daily reward"),
    text: (es ? s.daily_text_es || s.daily_text : s.daily_text) || "",
  };
}

/** Grants today's reward exactly once (safe against double clicks and parallel requests). */
export async function claimDaily(userId: string) {
  const s = await getSettings();
  if (s.daily_on === "0") throw new HttpError(404, "daily_off");
  const credits = Math.max(0, Number(s.daily_credits) || 0);
  const bonus = Math.max(0, Number(s.daily_streak_bonus) || 0);
  if (credits <= 0) throw new HttpError(404, "daily_off");
  const u = await db.user.findUniqueOrThrow({ where: { id: userId }, select: { dailyStreak: true, dailyClaimedDay: true } });
  const today = dayKey();
  if (u.dailyClaimedDay === today) throw new HttpError(409, "already_claimed");
  const streak = u.dailyClaimedDay === prevDayKey(today) ? u.dailyStreak + 1 : 1;
  const bonusHit = bonus > 0 && streak % 7 === 0;
  const amount = credits + (bonusHit ? bonus : 0);
  const ok = await grantOnce({
    userId,
    amount,
    type: "DAILY",
    note: `Daily reward · day ${streak}${bonusHit ? ` · +${bonus} streak bonus` : ""}`,
    externalRef: `daily:${userId}:${today}`,
  });
  if (!ok) throw new HttpError(409, "already_claimed");
  const after = await db.user.update({ where: { id: userId }, data: { dailyStreak: streak, dailyClaimedDay: today, dailyClaimedAt: new Date() }, select: { credits: true } });
  await import("./activity").then((m) => m.logActivity("site", "daily", `🎁 Daily reward claimed: +${amount} credits (day ${streak})`)).catch(() => {});
  return { amount, streak, bonusHit, balance: after.credits, resetAt: nextResetAt().toISOString() };
}
