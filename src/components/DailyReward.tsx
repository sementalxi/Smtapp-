"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/i18n/client";

type Status = {
  on: boolean;
  ladder: number[];
  claimable: boolean;
  claimedToday: boolean;
  streak: number;
  day: number;
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

/* ---------- coin art (inline SVG, no images needed) ---------- */

function Coin({ x, y, r = 15, flat = false, id }: { x: number; y: number; r?: number; flat?: boolean; id: string }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      {flat ? (
        <>
          <ellipse cx="0" cy="3" rx={r} ry={r * 0.42} fill={`url(#${id}-edge)`} />
          <ellipse cx="0" cy="0" rx={r} ry={r * 0.42} fill={`url(#${id}-face)`} stroke="#b45309" strokeWidth="0.8" />
          <ellipse cx="0" cy="0" rx={r * 0.62} ry={r * 0.25} fill="none" stroke="#fde68a" strokeWidth="0.8" opacity="0.8" />
        </>
      ) : (
        <>
          <circle cx="1.5" cy="2" r={r} fill="#92400e" opacity="0.55" />
          <circle cx="0" cy="0" r={r} fill={`url(#${id}-face)`} stroke="#b45309" strokeWidth="1" />
          <circle cx="0" cy="0" r={r * 0.68} fill="none" stroke="#fde68a" strokeWidth="1" opacity="0.9" />
          <path
            d={`M ${-r * 0.12} ${-r * 0.5} L ${r * 0.25} ${-r * 0.5} L ${r * 0.02} ${-r * 0.05} L ${r * 0.3} ${-r * 0.05} L ${-r * 0.2} ${r * 0.55} L ${-r * 0.02} ${r * 0.08} L ${-r * 0.3} ${r * 0.08} Z`}
            fill="#7c2d12"
            opacity="0.9"
          />
          <ellipse cx={-r * 0.35} cy={-r * 0.4} rx={r * 0.28} ry={r * 0.16} fill="#fff" opacity="0.45" transform={`rotate(-30 ${-r * 0.35} ${-r * 0.4})`} />
        </>
      )}
    </g>
  );
}

function Defs({ id }: { id: string }) {
  return (
    <defs>
      <linearGradient id={`${id}-face`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#fff1a8" />
        <stop offset="0.45" stopColor="#fbbf24" />
        <stop offset="1" stopColor="#d97706" />
      </linearGradient>
      <linearGradient id={`${id}-edge`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#b45309" />
        <stop offset="1" stopColor="#78350f" />
      </linearGradient>
    </defs>
  );
}

/** Grows with the day: one coin → a pair → stacks → a pile. */
function CoinArt({ step, id }: { step: number; id: string }) {
  const stacks = Math.max(0, step - 2); // flat stacks behind from day 3 on
  return (
    <svg viewBox="0 0 80 56" className="h-12 w-16 drop-shadow-[0_6px_10px_rgba(251,191,36,0.35)]" aria-hidden>
      <Defs id={id} />
      {Array.from({ length: stacks }, (_, s) => {
        const layers = 2 + s;
        const cx = 22 + s * 18;
        return Array.from({ length: layers }, (_, k) => <Coin key={`${s}-${k}`} id={id} flat x={cx} y={44 - k * 5} r={12} />);
      })}
      {step >= 2 && <Coin id={id} x={stacks ? 56 : 30} y={28} r={13} />}
      <Coin id={id} x={stacks ? 44 : step >= 2 ? 46 : 40} y={step >= 2 ? 32 : 28} r={step >= 2 ? 14 : 16} />
    </svg>
  );
}

/** Day 7: a chest bursting with coins. */
function TreasureArt({ id }: { id: string }) {
  return (
    <svg viewBox="0 0 140 70" className="h-16 w-32 drop-shadow-[0_8px_14px_rgba(251,191,36,0.4)]" aria-hidden>
      <Defs id={id} />
      <g>
        {[18, 34, 50].map((x, i) => (
          <path key={x} d={`M ${x} ${12 + i * 3} l 2 4 4 1 -3 3 1 4 -4 -2 -4 2 1 -4 -3 -3 4 -1 z`} fill="#fde68a" opacity="0.9" />
        ))}
        {[100, 118, 128].map((x, i) => (
          <path key={x} d={`M ${x} ${10 + i * 6} l 2 4 4 1 -3 3 1 4 -4 -2 -4 2 1 -4 -3 -3 4 -1 z`} fill="#fde68a" opacity="0.8" />
        ))}
      </g>
      <rect x="40" y="30" width="60" height="34" rx="6" fill="#7c2d12" stroke="#fbbf24" strokeWidth="2" />
      <rect x="40" y="38" width="60" height="5" fill="#fbbf24" opacity="0.9" />
      <rect x="65" y="36" width="10" height="12" rx="2" fill="#fde68a" />
      <path d="M 38 32 Q 70 2 102 32 Z" fill="#9a3412" stroke="#fbbf24" strokeWidth="2" />
      {[
        [48, 26, 10],
        [62, 20, 11],
        [78, 22, 11],
        [92, 27, 10],
        [70, 30, 12],
      ].map(([x, y, r], i) => (
        <Coin key={i} id={id} x={x} y={y} r={r} />
      ))}
      <Coin id={id} x={22} y={54} r={11} />
      <Coin id={id} x={120} y={56} r={10} />
      <Coin id={id} x={12} y={40} r={8} flat />
      <Coin id={id} x={128} y={42} r={8} flat />
    </svg>
  );
}

/* ---------- the 7-day ladder ---------- */

function Ladder({ st, es, justWon }: { st: Status; es: boolean; justWon: number | null }) {
  const label = (i: number) => {
    if (i === st.day) return st.claimedToday ? (es ? "Hoy ✓" : "Today ✓") : es ? "Hoy" : "Today";
    if (i === st.day + 1) return es ? "Mañana" : "Tomorrow";
    return `${es ? "Día" : "Day"} ${i}`;
  };
  const state = (i: number): "done" | "today" | "future" => (i < st.day ? "done" : i === st.day ? "today" : "future");
  const tile = (i: number) => {
    const s = state(i);
    const wide = i === 7;
    const base = "relative overflow-hidden rounded-xl border p-2.5 transition";
    const look =
      s === "today"
        ? `${base} border-lime bg-gradient-to-br from-lime/20 to-panel-2 shadow-[0_0_30px_-8px_rgba(255,46,136,0.9)] ${st.claimedToday ? "" : "kixo-glow"}`
        : s === "done"
          ? `${base} border-lime/30 bg-panel-2/60`
          : `${base} border-line bg-panel-2/70`;
    return (
      <div key={i} className={`${look} ${wide ? "col-span-3 flex items-center justify-between gap-3" : "flex flex-col"}`}>
        <div className={wide ? "" : "flex items-center justify-between"}>
          <span className={`text-[11px] font-bold ${s === "today" ? "text-lime" : "text-muted"}`}>{label(i)}</span>
          {s === "done" && !wide && <span className="grid h-4 w-4 place-items-center rounded-full bg-lime/90 text-[10px] font-black text-ink">✓</span>}
          {wide && (
            <div className="mt-1 font-display text-2xl text-amber-300">
              {st.ladder[6]} <span className="text-xs font-bold text-muted">{es ? "créditos" : "credits"}</span>
            </div>
          )}
        </div>
        <div className={`${wide ? "" : "my-1 grid place-items-center"} ${s === "done" ? "opacity-45 grayscale-[30%]" : ""}`}>
          {wide ? <TreasureArt id={`t${i}`} /> : <CoinArt step={i} id={`c${i}`} />}
        </div>
        {!wide && <div className={`text-right font-display text-xl ${s === "done" ? "text-muted" : "text-white"}`}>{st.ladder[i - 1]}</div>}
        {justWon !== null && s === "today" && <span className="kixo-fade-up absolute inset-x-0 top-1 text-center font-display text-lg text-lime">+{justWon}</span>}
      </div>
    );
  };
  return <div className="grid grid-cols-3 gap-2">{[1, 2, 3, 4, 5, 6, 7].map(tile)}</div>;
}

/**
 * Daily reward (free credits once a day on a 7-day ladder — the user must press Claim).
 * `modal`: pops up over the page while today's reward is unclaimed (dismissable for the day).
 * `card`: inline card for the dashboard.
 */
export function DailyReward({ variant = "modal" }: { variant?: "modal" | "card" }) {
  const { locale } = useT();
  const es = locale === "es";
  const router = useRouter();
  const [st, setSt] = useState<Status | null>(null);
  const [busy, setBusy] = useState(false);
  const [won, setWon] = useState<{ amount: number; streak: number } | null>(null);
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
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 30_000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    try {
      const until = localStorage.getItem(DISMISS_KEY);
      if (until && new Date(until).getTime() > Date.now()) setHidden(true);
    } catch {
      /* private mode */
    }
  }, []);

  const dismiss = useCallback(() => {
    setHidden(true);
    try {
      if (st?.resetAt) localStorage.setItem(DISMISS_KEY, st.resetAt);
    } catch {
      /* ignore */
    }
  }, [st?.resetAt]);

  const open = variant === "modal" && !!st && st.on && !hidden && (st.claimable || !!won);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && dismiss();
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, dismiss]);

  async function claim() {
    if (busy) return;
    setBusy(true);
    try {
      const r = await fetch("/api/daily", { method: "POST" });
      const d = (await r.json().catch(() => ({}))) as { amount?: number; streak?: number };
      if (r.ok) {
        setWon({ amount: d.amount ?? 0, streak: d.streak ?? 1 });
        router.refresh(); // header balance
        if (variant === "modal") setTimeout(() => setHidden(true), 2600);
      }
      await load();
    } finally {
      setBusy(false);
    }
  }

  if (!st || !st.on) return null;
  const credits = (n: number) => `${n} ${es ? (n === 1 ? "crédito" : "créditos") : n === 1 ? "credit" : "credits"}`;
  const todayAmount = st.ladder[st.day - 1] ?? 0;

  const body = (
    <>
      {st.text && <p className="mb-3 text-xs text-muted">{st.text}</p>}
      <Ladder st={st} es={es} justWon={won?.amount ?? null} />
      <div className="mt-3">
        {won ? (
          <div className="rounded-xl border border-lime/40 bg-lime/10 px-4 py-3 text-center font-bold text-lime">
            🎉 +{credits(won.amount)} · 🔥 {es ? "racha de" : "streak"} {won.streak} {es ? (won.streak === 1 ? "día" : "días") : won.streak === 1 ? "day" : "days"}
          </div>
        ) : st.claimable ? (
          <button type="button" onClick={claim} disabled={busy} className="btn-primary w-full py-3 text-base disabled:opacity-60">
            {busy ? "…" : es ? `Reclamar mi recompensa · +${todayAmount}` : `Claim your daily reward · +${todayAmount}`}
          </button>
        ) : (
          <div className="rounded-xl bg-panel-2 px-4 py-3 text-center text-sm text-muted">
            ✅ {es ? "Reclamado hoy" : "Claimed today"} · {es ? "vuelve en" : "next in"} {untilText(st.resetAt)}
            {st.streak > 0 && <span> · 🔥 {st.streak}</span>}
          </div>
        )}
      </div>
    </>
  );

  if (variant === "card") {
    return (
      <div className="card relative overflow-hidden p-4 sm:p-5">
        <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-amber-300/10 blur-3xl" />
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 font-bold">
            <span className="text-2xl">🎁</span> {st.title}
          </div>
          {st.streak > 0 && (
            <span className="rounded-full border border-lime/40 bg-lime/10 px-2.5 py-1 text-xs font-bold text-lime">
              🔥 {st.streak} {es ? (st.streak === 1 ? "día" : "días") : st.streak === 1 ? "day" : "days"}
            </span>
          )}
        </div>
        {body}
      </div>
    );
  }

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[80] grid place-items-center bg-ink/75 p-4 backdrop-blur-sm" onClick={dismiss} role="dialog" aria-modal="true" aria-label={st.title}>
      <div className="kixo-fade-up relative w-full max-w-sm rounded-2xl border border-line bg-panel p-4 shadow-[0_30px_90px_-20px_rgba(0,0,0,0.95)]" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="font-display text-2xl">🎁 {st.title}</h2>
          <button type="button" onClick={dismiss} aria-label="Close" className="grid h-9 w-9 place-items-center rounded-xl border border-line bg-panel-2 text-lg text-muted transition hover:text-white">
            ×
          </button>
        </div>
        {body}
      </div>
    </div>
  );
}
