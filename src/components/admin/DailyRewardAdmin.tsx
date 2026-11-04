"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/i18n/client";

type V = { daily_on: string; daily_credits: string; daily_streak_bonus: string; daily_title: string; daily_text: string; daily_title_es: string; daily_text_es: string };

/** Admin → Daily reward: amount, streak bonus and texts, with a live preview of what users see. */
export function DailyRewardAdmin({ initial }: { initial: V }) {
  const { locale } = useT();
  const es = locale === "es";
  const router = useRouter();
  const [v, setV] = useState<V>(initial);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const set = (k: keyof V) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setV({ ...v, [k]: e.target.value });

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg("");
    const r = await fetch("/api/admin/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(v) });
    setBusy(false);
    setMsg(r.ok ? (es ? "✅ Guardado" : "✅ Saved") : es ? "❌ No se pudo guardar" : "❌ Could not save");
    if (r.ok) router.refresh();
  }

  const n = Number(v.daily_credits) || 0;
  const bonus = Number(v.daily_streak_bonus) || 0;
  const title = (es ? v.daily_title_es || v.daily_title : v.daily_title) || (es ? "Recompensa diaria" : "Daily reward");
  const text = es ? v.daily_text_es || v.daily_text : v.daily_text;

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
      <form onSubmit={save} className="card space-y-4 p-5">
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="block">
            <span className="label">{es ? "Encendida" : "On"}</span>
            <select className="input" value={v.daily_on} onChange={set("daily_on")}>
              <option value="1">{es ? "Sí — los usuarios la ven" : "Yes — users see it"}</option>
              <option value="0">{es ? "No — oculta" : "No — hidden"}</option>
            </select>
          </label>
          <label className="block">
            <span className="label">{es ? "Créditos por día" : "Credits per day"}</span>
            <input type="number" min={0} max={1000} className="input" value={v.daily_credits} onChange={set("daily_credits")} />
          </label>
          <label className="block">
            <span className="label">{es ? "Bono el día 7 de racha" : "Bonus on streak day 7"}</span>
            <input type="number" min={0} max={1000} className="input" value={v.daily_streak_bonus} onChange={set("daily_streak_bonus")} />
            <span className="mt-1 block text-[11px] text-muted">{es ? "0 = sin bono" : "0 = no bonus"}</span>
          </label>
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
            ? "Cada usuario puede reclamar una vez al día (el día cambia a medianoche, hora de Chicago). Aparece como tarjeta en su panel y como aviso flotante en las demás páginas hasta que lo reclamen. Los créditos salen en el historial como “Recompensa diaria”."
            : "Each user can claim once a day (the day rolls over at midnight, Chicago time). It shows as a card on their dashboard and as a floating pop-up on other pages until they claim it. Credits appear in the history as “Daily reward”."}
        </p>
        <div className="flex items-center gap-3">
          <button type="submit" disabled={busy} className="btn-primary px-5 py-2 disabled:opacity-60">{busy ? "…" : es ? "Guardar" : "Save"}</button>
          {msg && <span className="text-sm">{msg}</span>}
        </div>
      </form>

      {/* Preview of the pop-up users see */}
      <div className="space-y-2">
        <div className="text-[11px] font-bold uppercase tracking-widest text-muted">{es ? "Así lo ven los usuarios" : "What users see"}</div>
        <div className={`relative rounded-2xl border border-lime/50 bg-panel/95 p-3 shadow-xl ${v.daily_on === "0" ? "opacity-40" : ""}`}>
          <span className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full text-muted">×</span>
          <div className="flex items-start gap-3 pr-6">
            <div className="text-3xl">🎁</div>
            <div className="min-w-0 flex-1">
              <div className="font-bold">{title}</div>
              {text && <p className="mt-0.5 text-xs text-muted">{text}</p>}
              <div className="btn-primary mt-2 w-full py-2 text-center text-sm">
                {es ? "Reclamar" : "Claim"} +{n} {es ? (n === 1 ? "crédito" : "créditos") : n === 1 ? "credit" : "credits"}
              </div>
              <div className="mt-1 text-center text-[11px] text-muted">🔥 {es ? "Racha" : "Streak"}: 3 {es ? "días" : "days"}</div>
            </div>
          </div>
        </div>
        {bonus > 0 && (
          <div className="rounded-xl border border-line bg-panel-2 p-3 text-xs text-muted">
            ★ {es ? `Día 7 seguido: +${bonus} créditos extra (y otra vez el día 14, 21…).` : `Day 7 in a row: +${bonus} extra credits (again on day 14, 21…).`}
          </div>
        )}
      </div>
    </div>
  );
}
