"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/i18n/client";

type Status = {
  on: boolean;
  credits: number;
  bonus: number;
  claimable: boolean;
  claimedToday: boolean;
  streak: number;
  resetAt: string;
  title: string;
  text: string;
};

const DISMISS_KEY = "kixo_daily_dismiss_until";

function untilText(iso: string) {
  const ms = Math.max(0, new Date(iso).getTime() - Date.now());
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

/**
 * Daily reward (free credits once a day — the user must press Claim).
 * `float`: a small card in the corner, only while today's reward is unclaimed.
 * `card`: the full card for the dashboard, with the streak tracker.
 */
export function DailyReward({ variant = "float" }: { variant?: "float" | "card" }) {
  const { locale } = useT();
  const es = locale === "es";
  const router = useRouter();
  const [st, setSt] = useState<Status | null>(null);
  const [busy, setBusy] = useState(false);
  const [won, setWon] = useState<{ amount: number; streak: number; bonusHit: boolean } | null>(null);
  const [hidden, setHidden] = useState(false);
  const [, tick] = useState(0);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/daily", { cache: "no-store" });
      if (r.ok) setSt((await r.json()) as Status);
    } catch {
      /* offline */
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  // Keep the "resets in" text fresh.
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 30_000);
    return () => clearInterval(t);
  }, []);
  // Dismissed for today? (per browser)
  useEffect(() => {
    try {
      const until = localStorage.getItem(DISMISS_KEY);
      if (until && new Date(until).getTime() > Date.now()) setHidden(true);
    } catch {
      /* private mode */
    }
  }, []);

  async function claim() {
    if (busy) return;
    setBusy(true);
    try {
      const r = await fetch("/api/daily", { method: "POST" });
      const d = (await r.json().catch(() => ({}))) as { amount?: number; streak?: number; bonusHit?: boolean };
      if (r.ok && d.amount) {
        setWon({ amount: d.amount, streak: d.streak ?? 1, bonusHit: !!d.bonusHit });
        router.refresh(); // header balance
        if (variant === "float") setTimeout(() => setHidden(true), 6000);
      }
      await load();
    } finally {
      setBusy(false);
    }
  }

  function dismiss() {
    setHidden(true);
    try {
      if (st?.resetAt) localStorage.setItem(DISMISS_KEY, st.resetAt);
    } catch {
      /* ignore */
    }
  }

  if (!st || !st.on || st.credits <= 0) return null;
  const credits = (n: number) => `${n} ${es ? (n === 1 ? "crédito" : "créditos") : n === 1 ? "credit" : "credits"}`;
  const streakShown = won?.streak ?? st.streak;

  if (variant === "float") {
    if (hidden || (!st.claimable && !won)) return null;
    return (
      <div className="kixo-fade-up fixed bottom-5 left-4 z-[59] w-[min(92vw,330px)] rounded-2xl border border-lime/50 bg-panel/95 p-3 shadow-[0_18px_50px_-12px_rgba(0,0,0,0.9)] backdrop-blur">
        <button type="button" onClick={dismiss} aria-label="Close" className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full text-muted hover:bg-white/10 hover:text-white">
          ×
        </button>
        {won ? (
          <div className="flex items-center gap-3 pr-6">
            <div className="text-3xl">🎉</div>
            <div>
              <div className="font-display text-xl text-lime">+{credits(won.amount)}</div>
              <div className="text-xs text-muted">
                🔥 {es ? "Racha" : "Streak"}: {es ? "día" : "day"} {won.streak}
                {won.bonusHit ? ` · ${es ? "¡bono de racha!" : "streak bonus!"}` : ""}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-3 pr-6">
            <div className="kixo-float text-3xl">🎁</div>
            <div className="min-w-0 flex-1">
              <div className="font-bold">{st.title}</div>
              {st.text && <p className="mt-0.5 text-xs text-muted">{st.text}</p>}
              <button type="button" onClick={claim} disabled={busy} className="btn-primary mt-2 w-full py-2 text-sm disabled:opacity-60">
                {busy ? "…" : `${es ? "Reclamar" : "Claim"} +${credits(st.credits)}`}
              </button>
              {st.streak > 0 && <div className="mt-1 text-center text-[11px] text-muted">🔥 {es ? "Racha" : "Streak"}: {st.streak} {es ? "días" : "days"}</div>}
            </div>
          </div>
        )}
      </div>
    );
  }

  // Dashboard card
  const dots = Array.from({ length: 7 }, (_, i) => i + 1);
  const pos = streakShown % 7 === 0 && streakShown > 0 ? 7 : streakShown % 7;
  return (
    <div className="card relative overflow-hidden p-5">
      <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-lime/10 blur-3xl" />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 font-bold">
            <span className="text-2xl">🎁</span> {st.title}
          </div>
          {st.text && <p className="mt-1 text-sm text-muted">{st.text}</p>}
        </div>
        {streakShown > 0 && (
          <div className="shrink-0 rounded-xl bg-panel-2 px-3 py-2 text-center">
            <div className="font-display text-2xl text-lime">🔥 {streakShown}</div>
            <div className="text-[10px] uppercase tracking-wider text-muted">{es ? "días seguidos" : "day streak"}</div>
          </div>
        )}
      </div>
      {st.bonus > 0 && (
        <div className="mt-4">
          <div className="mb-1 flex justify-between text-[11px] text-muted">
            <span>{es ? "Racha de 7 días" : "7-day streak"}</span>
            <span>
              {es ? "Día 7" : "Day 7"}: +{credits(st.bonus)} {es ? "extra" : "bonus"}
            </span>
          </div>
          <div className="grid grid-cols-7 gap-1.5">
            {dots.map((d) => (
              <div
                key={d}
                className={`grid h-8 place-items-center rounded-lg text-xs font-bold ${d <= pos ? "bg-lime text-ink" : "bg-white/10 text-muted"} ${d === 7 ? "ring-1 ring-amber-300/70" : ""}`}
                title={d === 7 ? `+${st.bonus}` : ""}
              >
                {d === 7 ? "★" : d}
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="mt-4">
        {won ? (
          <div className="rounded-xl border border-lime/40 bg-lime/10 px-4 py-3 text-center font-bold text-lime">
            🎉 +{credits(won.amount)} {won.bonusHit ? `· ${es ? "¡bono de racha!" : "streak bonus!"}` : ""}
          </div>
        ) : st.claimable ? (
          <button type="button" onClick={claim} disabled={busy} className="btn-primary w-full py-3 disabled:opacity-60">
            {busy ? "…" : `${es ? "Reclamar" : "Claim"} +${credits(st.credits)}`}
          </button>
        ) : (
          <div className="rounded-xl bg-panel-2 px-4 py-3 text-center text-sm text-muted">
            ✅ {es ? "Reclamado hoy" : "Claimed today"} · {es ? "vuelve en" : "next in"} {untilText(st.resetAt)}
          </div>
        )}
      </div>
    </div>
  );
}
