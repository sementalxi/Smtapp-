import Link from "next/link";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { getT } from "@/i18n/server";
import { getSettings } from "@/lib/settings";
import { dayKey, prevDayKey } from "@/lib/daily";
import { DailyRewardAdmin } from "@/components/admin/DailyRewardAdmin";

export const dynamic = "force-dynamic";

export default async function AdminDaily() {
  await requireAdmin();
  const { locale } = await getT();
  const es = locale === "es";
  const s = await getSettings();
  const today = dayKey();
  const yesterday = prevDayKey(today);
  const weekAgo = new Date(Date.now() - 7 * 86_400_000);
  const [claimedToday, claimsWeek, given, streaks, recent] = await Promise.all([
    db.user.count({ where: { dailyClaimedDay: today } }),
    db.creditTransaction.count({ where: { type: "DAILY", createdAt: { gte: weekAgo } } }),
    db.creditTransaction.aggregate({ where: { type: "DAILY" }, _sum: { amount: true } }),
    db.user.findMany({
      where: { dailyClaimedDay: { in: [today, yesterday] }, dailyStreak: { gte: 2 } },
      orderBy: { dailyStreak: "desc" },
      take: 8,
      select: { id: true, name: true, email: true, dailyStreak: true, dailyClaimedDay: true },
    }),
    db.creditTransaction.findMany({
      where: { type: "DAILY" },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: { id: true, amount: true, note: true, createdAt: true, user: { select: { id: true, name: true, email: true } } },
    }),
  ]);
  const stats: [string, string | number][] = [
    [es ? "Reclamados hoy" : "Claimed today", claimedToday],
    [es ? "Reclamos · 7 días" : "Claims · 7 days", claimsWeek],
    [es ? "Créditos regalados" : "Credits given", given._sum.amount ?? 0],
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <h1 className="font-display text-4xl">🎁 {es ? "Recompensa diaria" : "Daily reward"}</h1>
        <span className={`rounded-full border px-2.5 py-1 text-[11px] font-bold ${s.daily_on !== "0" ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-300" : "border-amber-400/40 bg-amber-400/10 text-amber-200"}`}>
          {s.daily_on !== "0" ? (es ? "Encendida" : "On") : es ? "Apagada" : "Off"} · {s.daily_credits} {es ? "créd./día" : "cr/day"}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        {stats.map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-line bg-gradient-to-br from-panel-2 to-panel p-3 sm:p-4">
            <div className="line-clamp-1 text-[9px] font-bold uppercase tracking-widest text-muted sm:text-[10px]">{label}</div>
            <div className="font-display mt-1 text-2xl tabular-nums sm:text-4xl">{value}</div>
          </div>
        ))}
      </div>

      <DailyRewardAdmin
        initial={{
          daily_on: s.daily_on,
          daily_credits: s.daily_credits,
          daily_streak_bonus: s.daily_streak_bonus,
          daily_title: s.daily_title,
          daily_text: s.daily_text,
          daily_title_es: s.daily_title_es,
          daily_text_es: s.daily_text_es,
        }}
      />

      <div className="grid gap-4 md:grid-cols-2">
        <div className="card p-4">
          <div className="mb-2 text-[11px] font-bold uppercase tracking-widest text-muted">🔥 {es ? "Rachas activas" : "Active streaks"}</div>
          {streaks.length ? (
            <ul className="divide-y divide-line text-sm">
              {streaks.map((u) => (
                <li key={u.id} className="flex items-center justify-between gap-2 py-2">
                  <Link href={`/admin/users/${u.id}`} className="min-w-0 truncate hover:text-lime">
                    <span className="font-semibold">{u.name}</span> <span className="text-xs text-muted">{u.email}</span>
                  </Link>
                  <span className="shrink-0 font-display text-lg text-lime">{u.dailyStreak} {es ? "días" : "days"}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">{es ? "Nadie lleva racha todavía." : "No streaks yet."}</p>
          )}
        </div>
        <div className="card p-4">
          <div className="mb-2 text-[11px] font-bold uppercase tracking-widest text-muted">🧾 {es ? "Últimos reclamos" : "Latest claims"}</div>
          {recent.length ? (
            <ul className="divide-y divide-line text-sm">
              {recent.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-2 py-2">
                  <div className="min-w-0">
                    <Link href={`/admin/users/${r.user.id}`} className="block truncate font-semibold hover:text-lime">{r.user.name}</Link>
                    <div className="truncate text-xs text-muted">{r.note} · {r.createdAt.toLocaleString(locale, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</div>
                  </div>
                  <span className="shrink-0 font-bold text-lime">+{r.amount}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">{es ? "Aún no hay reclamos." : "No claims yet."}</p>
          )}
        </div>
      </div>
    </div>
  );
}
