"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/** Admin → Styles: one tap makes (or refreshes) a Qualifiers style for every player style labelled 🎨 Photoshop. */
export function QualifiersSync({ es }: { es: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  return (
    <div className="card flex flex-wrap items-center justify-between gap-3 p-4">
      <div className="text-sm">
        <div className="font-bold">🌍 {es ? "Estilos de Clasificatorios desde mis tarjetas Photoshop" : "Qualifiers styles from my Photoshop player cards"}</div>
        <div className="text-xs text-muted">
          {es
            ? "Cada estilo de tarjeta de jugador con la etiqueta 🎨 Photoshop (y los 27 flyers) recibe un gemelo en Clasificatorios: mismo look, pero sin jugador — titular, escudo de la liga, trofeo y la tabla de regiones. Se hace solo en cada publicación; aquí lo fuerzas ahora."
            : "Every player-card style labelled 🎨 Photoshop (plus the 27 flyer styles) gets a twin in Qualifiers: same look, no player — headline, league emblem, trophy and the regions table. Runs on every deploy; this forces it now."}
        </div>
        {msg && <div className="mt-1 text-xs">{msg}</div>}
      </div>
      <button
        type="button"
        disabled={busy}
        className="btn-primary px-4 py-2 text-sm"
        onClick={async () => {
          setBusy(true);
          setMsg("…");
          const r = await fetch("/api/admin/templates/qualifiers-sync", { method: "POST" });
          const d = (await r.json().catch(() => ({}))) as { created?: number; updated?: number; sources?: number };
          setBusy(false);
          setMsg(r.ok ? (es ? `✅ ${d.created ?? 0} creados · ${d.updated ?? 0} actualizados · ${d.sources ?? 0} estilos Photoshop` : `✅ ${d.created ?? 0} created · ${d.updated ?? 0} refreshed · ${d.sources ?? 0} Photoshop styles`) : es ? "❌ Error" : "❌ Failed");
          if (r.ok) router.refresh();
        }}
      >
        {busy ? "…" : es ? "🔄 Crear / actualizar" : "🔄 Make / refresh"}
      </button>
    </div>
  );
}
