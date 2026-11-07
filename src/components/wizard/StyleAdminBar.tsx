"use client";

import { useState } from "react";
import { STYLE_BADGES, STYLE_TIERS, badgeLabel, parseBadges, tierLabel, type StyleBadge, type StyleTier } from "@/lib/templates";

/**
 * Admin only, under each style card in the creator: tap the labels (several at once — ⭐ 🔥 🎨 ✨) and the
 * tier (Basic / Mid / Pro, shown in the card's bottom-right corner). Every tap saves on the style.
 */
export function StyleAdminBar({ templateId, badge, tier, es, onChange, onRemoved }: { templateId: string; badge: string | null | undefined; tier: string | null | undefined; es: boolean; onChange: (p: { badge?: string | null; tier?: string | null }) => void; onRemoved?: () => void }) {
  const [busy, setBusy] = useState(false);
  const cur = parseBadges(badge);
  async function save(p: { badge?: string | null; tier?: string | null }) {
    onChange(p);
    setBusy(true);
    try {
      await fetch(`/api/admin/templates/${templateId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(p) });
    } finally {
      setBusy(false);
    }
  }
  async function remove(kind: "hide" | "delete") {
    const ask = kind === "hide"
      ? (es ? "¿Ocultar este estilo? Deja de aparecer para todos (puedes volver a mostrarlo desde Admin → Estilos)." : "Hide this style? It stops showing for everyone (you can show it again from Admin → Styles).")
      : (es ? "¿Borrar este estilo? Si ya se hicieron pósters con él, va a la papelera y se puede restaurar." : "Delete this style? If posters were already made with it, it goes to the bin and can be restored.");
    if (!window.confirm(ask)) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/templates/${templateId}`, kind === "hide" ? { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ active: false }) } : { method: "DELETE" });
      if (res.ok) onRemoved?.();
      else window.alert(es ? "No se pudo — inténtalo otra vez." : "Couldn't do it — try again.");
    } finally {
      setBusy(false);
    }
  }
  const colour = (b: StyleBadge, on: boolean) =>
    on ? (b === "fire" ? "border-orange-400 bg-orange-500/25 text-orange-200" : b === "photoshop" ? "border-violet-400 bg-violet-500/25 text-violet-100" : b === "new" ? "border-cyan-400 bg-cyan-500/25 text-cyan-100" : "border-lime bg-lime/20 text-lime") : "border-line text-muted";
  const tierColour = (t: StyleTier, on: boolean) => (on ? (t === "pro" ? "border-amber-400 bg-amber-500/25 text-amber-100" : t === "mid" ? "border-sky-400 bg-sky-500/25 text-sky-100" : "border-slate-400 bg-slate-500/25 text-slate-100") : "border-line text-muted");
  return (
    <div className={`mt-1 space-y-1 rounded-lg border border-dashed border-line/70 p-1 ${busy ? "opacity-70" : ""}`}>
      <div className="flex flex-wrap gap-1">
        {STYLE_BADGES.map((b) => {
          const on = cur.includes(b);
          return (
            <button key={b} type="button" title={es ? "Varias a la vez" : "Several at once"} onClick={() => save({ badge: (on ? cur.filter((x) => x !== b) : [...cur, b]).join(",") || null })} className={`rounded border px-1 py-0.5 text-[9px] font-bold ${colour(b, on)}`}>
              {badgeLabel(b, es)}
            </button>
          );
        })}
      </div>
      <div className="flex flex-wrap gap-1">
        {STYLE_TIERS.map((t) => {
          const on = tier === t;
          return (
            <button key={t} type="button" onClick={() => save({ tier: on ? null : t })} className={`rounded border px-1 py-0.5 text-[9px] font-bold ${tierColour(t, on)}`}>
              {tierLabel(t, es)}
            </button>
          );
        })}
      </div>
      <div className="flex gap-1">
        <button type="button" disabled={busy} onClick={() => remove("hide")} className="flex-1 rounded border border-line px-1 py-0.5 text-[9px] font-bold text-muted hover:border-amber-400 hover:text-amber-200">
          🙈 {es ? "Ocultar" : "Hide"}
        </button>
        <button type="button" disabled={busy} onClick={() => remove("delete")} className="flex-1 rounded border border-line px-1 py-0.5 text-[9px] font-bold text-muted hover:border-red-400 hover:text-red-300">
          🗑️ {es ? "Borrar" : "Delete"}
        </button>
      </div>
    </div>
  );
}
