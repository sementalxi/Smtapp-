"use client";

import { useState } from "react";

import { FORMATION_ROWS, positionsFor, type Slot } from "@/lib/formations";
import { ImageDrop } from "../ImageDrop";
import { thumb } from "@/lib/thumb";
export { slotsToLines, type Slot } from "@/lib/formations";

/**
 * Tap a spot on the pitch to add that player's number and name.
 * mode "totw" (team of the week): gamertag + a points / club line + a photo per player instead of a number.
 */
export function LineupBuilder({ formation, slots, onChange, es, mode = "lineup" }: { formation: string; slots: Slot[]; onChange: (s: Slot[]) => void; es: boolean; mode?: "lineup" | "totw" }) {
  const totw = mode === "totw";
  const rows = FORMATION_ROWS[formation] ?? [];
  const [sel, setSel] = useState<number | null>(0);
  let idx = 0;
  const indexed = rows.map((r) => r.map((pos) => ({ pos, i: idx++ })));
  const positions = positionsFor(formation);
  const filled = positions.filter((_, i) => slots[i]?.name.trim()).length;
  const cur = sel !== null && sel < positions.length ? sel : null;
  const upd = (i: number, p: Partial<Slot>) => {
    const next = [...slots];
    while (next.length < positions.length) next.push({ num: "", name: "" });
    next[i] = { ...next[i], ...p };
    onChange(next);
  };

  return (
    <div className="space-y-3">
      <div className="relative overflow-hidden rounded-2xl border border-line bg-[linear-gradient(180deg,#24112a,#180b1d)] px-2 py-4">
        {/* pitch lines */}
        <div className="pointer-events-none absolute inset-3 rounded-lg border border-white/10" />
        <div className="pointer-events-none absolute inset-x-3 top-1/2 h-px bg-white/10" />
        <div className="pointer-events-none absolute left-1/2 top-1/2 h-16 w-16 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/10" />
        <div className="relative flex flex-col-reverse gap-4">
          {indexed.map((row, r) => (
            <div key={r} className="flex justify-around">
              {[...row].reverse().map(({ pos, i }) => {
                const s = slots[i];
                const on = cur === i;
                return (
                  <button key={i} type="button" onClick={() => setSel(i)} className="flex w-16 flex-col items-center gap-1">
                    <span
                      className={`grid h-10 w-10 place-items-center overflow-hidden rounded-full border-2 text-sm font-extrabold transition ${
                        on ? "scale-110 border-lime bg-lime text-ink" : s?.name.trim() ? "border-teal bg-teal/20 text-white" : "border-white/30 bg-black/30 text-white/70"
                      }`}
                    >
                      {totw && s?.photo ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={thumb(s.photo, 80)} alt="" className="h-full w-full object-cover" />
                      ) : totw ? (
                        <span className="text-[11px]">{pos}</span>
                      ) : (
                        s?.num.trim() || pos
                      )}
                    </span>
                    <span className={`w-full truncate text-center text-[10px] font-bold ${s?.name.trim() ? "text-white" : "text-white/40"}`}>{s?.name.trim() || pos}</span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {cur !== null && (
        <div className="rounded-xl border border-lime/40 bg-lime/5 p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-widest text-lime">{positions[cur]}</span>
            <span className="text-[11px] text-muted">{filled}/11</span>
          </div>
          {totw ? (
            <div className="space-y-2">
              <input
                className="input"
                type="text"
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                name={`kixo-player-${cur}`}
                maxLength={24}
                placeholder={es ? "Gamertag del jugador" : "Player's gamertag"}
                value={slots[cur]?.name ?? ""}
                onChange={(e) => upd(cur, { name: e.target.value })}
              />
              <input
                className="input"
                type="text"
                autoComplete="off"
                name={`kixo-sub-${cur}`}
                maxLength={20}
                placeholder={es ? "Puntos o club (opcional) — ej. 104 PTS" : "Points or club (optional) — e.g. 104 PTS"}
                value={slots[cur]?.num ?? ""}
                onChange={(e) => upd(cur, { num: e.target.value })}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    setSel(cur + 1 < positions.length ? cur + 1 : null);
                  }
                }}
              />
              <ImageDrop kind="photo" label={es ? "📸 Foto del jugador (opcional)" : "📸 Player photo (optional)"} value={slots[cur]?.photo || null} onChange={(u) => upd(cur, { photo: u ?? "" })} searchQuery={slots[cur]?.name} />
            </div>
          ) : (
          <div className="grid grid-cols-[4.5rem_minmax(0,1fr)] gap-2">
            <input
              className="input text-center"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              autoComplete="off"
              name={`kixo-num-${cur}`}
              maxLength={3}
              placeholder="#"
              value={slots[cur]?.num ?? ""}
              onChange={(e) => upd(cur, { num: e.target.value.replace(/[^0-9]/g, "") })}
            />
            <input
              className="input"
              type="text"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              name={`kixo-player-${cur}`}
              maxLength={24}
              placeholder={es ? "Nombre del jugador" : "Player name"}
              value={slots[cur]?.name ?? ""}
              onChange={(e) => upd(cur, { name: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  setSel(cur + 1 < positions.length ? cur + 1 : null);
                }
              }}
            />
          </div>
          )}
          <div className="mt-2 flex justify-between text-xs">
            <button type="button" className="text-muted disabled:opacity-30" disabled={cur === 0} onClick={() => setSel(cur - 1)}>‹ {es ? "Anterior" : "Previous"}</button>
            <button type="button" className="font-bold text-lime" onClick={() => setSel(cur + 1 < positions.length ? cur + 1 : null)}>
              {cur + 1 < positions.length ? `${es ? "Siguiente" : "Next"}: ${positions[cur + 1]} ›` : es ? "Listo ✓" : "Done ✓"}
            </button>
          </div>
        </div>
      )}
      <p className="text-[11px] text-muted">
        {totw
          ? es
            ? "Toca una posición en la cancha para poner el gamertag, sus puntos o club y su foto. El que tenga más puntos sale como jugador de la semana."
            : "Tap a position on the pitch to add the gamertag, their points or club and their photo. The highest points becomes the player of the week card."
          : es
            ? "Toca una posición en la cancha para poner el número y nombre."
            : "Tap a position on the pitch to add the number and name."}
      </p>
    </div>
  );
}
