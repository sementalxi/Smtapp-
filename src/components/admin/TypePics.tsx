"use client";

import { useRouter } from "next/navigation";

import { useState } from "react";
import { ImageDrop } from "../ImageDrop";

const LABELS: Record<string, [string, string]> = {
  PLAYER: ["🧍 Player card", "🧍 Tarjeta de jugador"],
  CHAMPIONS: ["🏆 Champions", "🏆 Campeones"],
  MATCHDAY: ["📅 Match day", "📅 Día de partido"],
  LINEUP: ["📋 Lineup", "📋 Alineación"],
  RESULT: ["⚽ Result", "⚽ Resultado"],
  EVENT: ["🎟️ Tournament / event", "🎟️ Torneo / evento"],
  STANDINGS: ["📊 Standings", "📊 Tabla de posiciones"],
  LOGO: ["🛡️ Team logo", "🛡️ Logo del equipo"],
  ROSTER: ["🪪 Roster banners", "🪪 Banners de plantilla"],
  TEAMSET: ["👥 Team player cards", "👥 Tarjetas del equipo"],
  SEASON: ["🎉 Season flyers", "🎉 Flyers de temporada"],
};

/** Admin: pick the picture shown behind each box on the "What are you making?" page. */
export function TypePics({ initial, es }: { initial: Record<string, string>; es: boolean }) {
  const [pics, setPics] = useState<Record<string, string>>(initial);
  const router = useRouter();
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  async function save(next: Record<string, string>) {
    setPics(next);
    setBusy(true);
    setMsg("");
    const r = await fetch("/api/admin/type-pics", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pics: next }) });
    setBusy(false);
    setMsg(r.ok ? (es ? "✓ Guardado" : "✓ Saved") : es ? "No se pudo guardar" : "Couldn't save");
    if (r.ok) router.refresh();
  }
  return (
    <details className="card p-5">
      <summary className="cursor-pointer">
        <span className="text-lg font-bold">🖼️ {es ? "Fotos de las cajas de tipo" : "Type box pictures"}</span>
        <span className="mt-0.5 block text-xs text-muted">
          {es ? "La imagen detrás de cada caja en “¿Qué vas a crear?”. Vacía = usa la miniatura del primer estilo." : "The picture behind each box on “What are you making?”. Empty = uses the first style's thumbnail."}
        </span>
      </summary>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {Object.entries(LABELS).map(([k, [en, esL]]) => (
          <div key={k} className="rounded-xl border border-line p-3">
            <ImageDrop
              kind="photo"
              noSearch
              label={es ? esL : en}
              value={pics[k] || null}
              onChange={(u) => {
                const next = { ...pics };
                if (u) next[k] = u;
                else delete next[k];
                save(next);
              }}
            />
          </div>
        ))}
      </div>
      {(msg || busy) && <p className="mt-3 text-xs font-bold text-teal">{busy ? "…" : msg}</p>}
    </details>
  );
}
