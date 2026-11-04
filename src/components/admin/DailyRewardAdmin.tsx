"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/i18n/client";

type V = { daily_on: string; daily_ladder: string; daily_title: string; daily_text: string; daily_title_es: string; daily_text_es: string };

const parse = (raw: string) => {
  const n = raw.split(",").map((x) => Number(x.trim()));
  return n.length === 7 && n.every((x) => Number.isInteger(x) && x >= 0) ? n : [1, 2, 3, 4, 5, 6, 10];
};

/** Admin → Daily reward: the 7-day ladder and the texts, with a preview of the pop-up users see. */
export function DailyRewardAdmin({ initial }: { initial: V }) {
  const { locale } = useT();
  const es = locale === "es";
  const router = useRouter();
  const [v, setV] = useState<V>(initial);
  const [ladder, setLadder] = useState<number[]>(parse(initial.daily_ladder));
  const [busy, setBusy] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [msg, setMsg] = useState("");

  async function resetAll() {
    if (!confirm(es ? "¿Reiniciar la recompensa diaria para TODOS los usuarios? Las rachas vuelven a 0 y todos podrán reclamar de nuevo hoy." : "Reset the daily reward for ALL users? Streaks go back to 0 and everyone can claim again today.")) return;
    setResetting(true);
    setMsg("");
    const r = await fetch("/api/admin/daily/reset", { method: "POST" });
    const d = (await r.json().catch(() => ({}))) as { count?: number };
    setResetting(false);
    setMsg(r.ok ? (es ? `✅ Reiniciado para ${d.count ?? 0} usuarios` : `✅ Reset for ${d.count ?? 0} users`) : es ? "❌ No se pudo reiniciar" : "❌ Could not reset");
    if (r.ok) router.refresh();
  }
  const set = (k: keyof V) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setV({ ...v, [k]: e.target.value });

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg("");
    const body = { ...v, daily_ladder: ladder.map((n) => Math.max(0, Math.min(9999, Math.round(n) || 0))).join(",") };
    const r = await fetch("/api/admin/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    setBusy(false);
    setMsg(r.ok ? (es ? "✅ Guardado" : "✅ Saved") : es ? "❌ No se pudo guardar" : "❌ Could not save");
    if (r.ok) router.refresh();
  }

  const title = (es ? v.daily_title_es || v.daily_title : v.daily_title) || (es ? "Recompensa diaria" : "Daily reward");
  const text = es ? v.daily_text_es || v.daily_text : v.daily_text;
  const total = ladder.reduce((a, b) => a + b, 0);

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
      <form onSubmit={save} className="card space-y-5 p-5">
        <label className="block sm:max-w-xs">
          <span className="label">{es ? "Encendida" : "On"}</span>
          <select className="input" value={v.daily_on} onChange={set("daily_on")}>
            <option value="1">{es ? "Sí — los usuarios la ven" : "Yes — users see it"}</option>
            <option value="0">{es ? "No — oculta" : "No — hidden"}</option>
          </select>
        </label>

        <div>
          <div className="label">🪙 {es ? "Créditos por día de racha" : "Credits per streak day"}</div>
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
            {ladder.map((n, i) => (
              <label key={i} className={`block rounded-xl border p-2 text-center ${i === 6 ? "border-amber-300/60 bg-amber-300/5" : "border-line bg-panel-2"}`}>
                <span className="block text-[10px] font-bold uppercase tracking-wider text-muted">{i === 6 ? "★ " : ""}{es ? "Día" : "Day"} {i + 1}</span>
                <input
                  type="number"
                  min={0}
                  max={9999}
                  className="input mt-1 px-1 text-center"
                  value={n}
                  onChange={(e) => setLadder(ladder.map((x, j) => (j === i ? Number(e.target.value) : x)))}
                />
              </label>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted">
            {es
              ? `Día 1 al reclamar por primera vez (o tras fallar un día), luego sube cada día seguido; después del día 7 vuelve a empezar. Una semana completa = ${total} créditos.`
              : `Day 1 on the first claim (or after a missed day), then it climbs each day in a row; after day 7 it starts over. A full week = ${total} credits.`}
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="label">🇺🇸 {es ? "Título (inglés)" : "Title (English)"}</span>
            <input className="input" maxLength={60} value={v.daily_title} onChange={set("daily_title")} />
          </label>
          <label className="block">
            <span className="label">🇲🇽 {es ? "Título (español)" : "Title (Spanish)"}</span>
            <input className="input" maxLength={60} value={v.daily_title_es} onChange={set("daily_title_es")} />
          </label>
          <label className="block">
            <span className="label">🇺🇸 {es ? "Texto (inglés)" : "Text (English)"}</span>
            <textarea className="input min-h-[80px]" maxLength={240} value={v.daily_text} onChange={set("daily_text")} />
          </label>
          <label className="block">
            <span className="label">🇲🇽 {es ? "Texto (español)" : "Text (Spanish)"}</span>
            <textarea className="input min-h-[80px]" maxLength={240} value={v.daily_text_es} onChange={set("daily_text_es")} />
          </label>
        </div>
        <p className="text-xs text-muted">
          {es
            ? "Cada usuario reclama una vez al día (el día cambia a medianoche, hora de Chicago). El pop-up aparece al entrar en cualquier página hasta que reclamen o lo cierren; en su panel siempre ven la tarjeta. Los créditos salen en el historial como “Recompensa diaria”."
            : "Each user claims once a day (the day rolls over at midnight, Chicago time). The pop-up appears on any page until they claim or close it; their dashboard always shows the card. Credits appear in the history as “Daily reward”."}
        </p>
        <div className="flex items-center gap-3">
          <button type="submit" disabled={busy} className="btn-primary px-5 py-2 disabled:opacity-60">{busy ? "…" : es ? "Guardar" : "Save"}</button>
          {msg && <span className="text-sm">{msg}</span>}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-danger/40 bg-danger/5 p-3">
          <div className="text-xs text-muted">
            <span className="font-bold text-white">{es ? "Reiniciar para todos" : "Reset for everyone"}</span>
            <br />
            {es ? "Todas las rachas vuelven a 0 y todos pueden reclamar el día 1 de nuevo (los créditos ya dados se quedan)." : "Every streak goes back to 0 and everyone can claim day 1 again (credits already given stay)."}
          </div>
          <button type="button" onClick={resetAll} disabled={resetting} className="rounded-xl border border-danger bg-danger/20 px-4 py-2 text-sm font-bold text-white transition hover:bg-danger/40 disabled:opacity-60">
            {resetting ? "…" : es ? "🔄 Reiniciar todo" : "🔄 Reset everything"}
          </button>
        </div>
      </form>

      {/* Preview of the pop-up users see (day 3 of a streak as the example) */}
      <div className="space-y-2">
        <div className="text-[11px] font-bold uppercase tracking-widest text-muted">{es ? "Así lo ven los usuarios" : "What users see"}</div>
        <div className={`rounded-2xl border border-line bg-panel p-4 shadow-xl ${v.daily_on === "0" ? "opacity-40" : ""}`}>
          <div className="mb-3 flex items-center justify-between">
            <div className="font-display text-xl">🎁 {title}</div>
            <span className="grid h-8 w-8 place-items-center rounded-lg border border-line bg-panel-2 text-muted">×</span>
          </div>
          {text && <p className="mb-3 text-xs text-muted">{text}</p>}
          <div className="grid grid-cols-3 gap-2">
            {ladder.map((n, i) => {
              const day = i + 1;
              const s = day < 3 ? "done" : day === 3 ? "today" : "future";
              const wide = day === 7;
              return (
                <div
                  key={i}
                  className={`rounded-xl border p-2 ${wide ? "col-span-3 flex items-center justify-between" : ""} ${s === "today" ? "border-lime bg-lime/10" : s === "done" ? "border-lime/30 bg-panel-2/60 opacity-70" : "border-line bg-panel-2/70"}`}
                >
                  <div className={`text-[10px] font-bold ${s === "today" ? "text-lime" : "text-muted"}`}>
                    {s === "today" ? (es ? "Hoy" : "Today") : day === 4 ? (es ? "Mañana" : "Tomorrow") : `${es ? "Día" : "Day"} ${day}`}
                    {s === "done" ? " ✓" : ""}
                  </div>
                  <div className={`${wide ? "" : "my-1 text-center"} text-xl`}>{wide ? "💰" : day <= 2 ? "🪙" : "🪙🪙"}</div>
                  <div className={`font-display ${wide ? "text-2xl text-amber-300" : "text-right text-lg"}`}>{n}</div>
                </div>
              );
            })}
          </div>
          <div className="btn-primary mt-3 w-full py-2.5 text-center text-sm">{es ? "Reclamar mi recompensa" : "Claim your daily reward"} · +{ladder[2]}</div>
        </div>
      </div>
    </div>
  );
}
