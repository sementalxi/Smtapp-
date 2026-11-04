// Admin: reset the daily reward for everyone — streaks back to 0 and today's claims opened again.
import { db } from "@/lib/db";
import { apiAdmin } from "@/lib/auth";
import { handle, json } from "@/lib/api";

export const POST = handle(async () => {
  const admin = await apiAdmin();
  const r = await db.user.updateMany({ data: { dailyStreak: 0, dailyClaimedDay: null, dailyClaimedAt: null } });
  // New epoch so a user who already claimed today can claim again (claims are keyed by epoch + day).
  const epoch = String(Date.now());
  await db.setting.upsert({ where: { key: "daily_epoch" }, create: { key: "daily_epoch", value: epoch }, update: { value: epoch } });
  await import("@/lib/activity").then((m) => m.logActivity("site", "daily_reset", `🎁 Daily reward reset for everyone (${r.count} users) by ${admin.email}`, "warn")).catch(() => {});
  return json({ ok: true, count: r.count });
});
