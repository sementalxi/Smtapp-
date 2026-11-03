"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Opt = { key: string; emoji: string; en: string; es: string };

/** Admin: pick the holiday/season for season flyers, or turn them off. */
export function SeasonPicker({ seasons, initial, es }: { seasons: Opt[]; initial: { key: string; custom?: string; on: boolean }; es: boolean }) {
  const router = useRouter();
  const [on, setOn] = useState(initial.on);
  const [key, setKey] = useState(initial.key || seasons[0]?.key || "");
  const [custom, setCustom] = useState(initial.custom ?? "");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  async function save(next: { on: boolean; key: string }) {
    setBusy(true);
    setMsg("");
    const res = await fetch("/api/admin/season", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...next, custom }) });
    setBusy(false);
    if (res.ok) {
      setMsg(next.on ? (es ? "✅ Guardado — ya aparece en Crear" : "✅ Saved — it's now on the Create page") : es ? "⏸️ Flyers de temporada apagados" : "⏸️ Season flyers are off");
      router.refresh();
    } else setMsg(es ? "❌ No se pudo guardar" : "❌ Couldn't save");
  }

  return (
    <div className="card space-y-3 p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">🎉 {es ? "Flyers de temporada" : "Season / holiday flyers"}</h2>
          <p className="text-sm text-muted">
            {es
              ? "Elige la temporada. Cuando está encendido, en Crear aparece una tarjeta especial y los pósters salen con ese tema (en cualquier estilo)."
              : "Pick the season. When it's on, a special card shows on the Create page and posters come out with that theme (in any style)."}
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={on}
          disabled={busy}
          onClick={() => { const v = !on; setOn(v); save({ on: v, key }); }}
          className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-extrabold uppercase tracking-wider ${on ? "border-lime bg-lime/15 text-lime" : "border-line text-muted"}`}
        >
          {on ? (es ? "Encendido" : "On") : es ? "Apagado" : "Off"}
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {[...seasons, { key: "custom", emoji: "✨", en: "Custom", es: "Personalizado" }].map((s) => (
          <button
            key={s.key}
            type="button"
            onClick={() => setKey(s.key)}
            className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-left text-sm font-bold transition ${key === s.key ? "border-lime bg-lime/10 text-white" : "border-line text-muted hover:border-lime/40"}`}
          >
            <span className="text-xl">{s.emoji}</span>
            <span className="leading-tight">{es ? s.es : s.en}</span>
          </button>
        ))}
      </div>
      {key === "custom" && (
        <textarea
          className="input min-h-[80px] w-full text-sm"
          placeholder={es ? "Ej.: Final de temporada: confeti dorado, fuegos artificiales, luces de estadio…" : "e.g. Season finale: gold confetti, fireworks, stadium lights…"}
          value={custom}
          maxLength={600}
          onChange={(e) => setCustom(e.target.value)}
        />
      )}
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" disabled={busy || (key === "custom" && !custom.trim())} onClick={() => { setOn(true); save({ on: true, key }); }} className="btn-primary px-5 py-2 text-sm">
          {busy ? "…" : es ? "Guardar y encender" : "Save & turn on"}
        </button>
        {msg && <span className="text-sm">{msg}</span>}
      </div>
    </div>
  );
}
