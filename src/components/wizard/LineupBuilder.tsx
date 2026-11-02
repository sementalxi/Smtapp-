"use client";

import { useState } from "react";

import { FORMATION_ROWS, positionsFor, type Slot } from "@/lib/formations";
export { slotsToLines, type Slot } from "@/lib/formations";

/** Tap a spot on the pitch to add that player's number and name. */
export function LineupBuilder({ formation, slots, onChange, es }: { formation: string; slots: Slot[]; onChange: (s: Slot[]) => void; es: boolean }) {
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
      <div className="relative overflow-hidden rounded-2xl border border-line bg-[linear-gradient(180deg,#0f2a1a,#0b1f14)] px-2 py-4">
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
                      className={`grid h-10 w-10 place-items-center rounded-full border-2 text-sm font-extrabold transition ${
                        on ? "scale-110 border-lime bg-lime text-ink" : s?.name.trim() ? "border-teal bg-teal/20 text-white" : "border-white/30 bg-black/30 text-white/70"
                      }`}
                    >
                      {s?.num.trim() || pos}
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
          <div className="flex gap-2">
            <input className="input w-20 text-center" inputMode="numeric" maxLength={3} placeholder="#" value={slots[cur]?.num ?? ""} onChange={(e) => upd(cur, { num: e.target.value.replace(/[^0-9]/g, "") })} />
            <input
              className="input min-w-0 flex-1"
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
          <div className="mt-2 flex justify-between text-xs">
            <button type="button" className="text-muted disabled:opacity-30" disabled={cur === 0} onClick={() => setSel(cur - 1)}>‹ {es ? "Anterior" : "Previous"}</button>
            <button type="button" className="font-bold text-lime" onClick={() => setSel(cur + 1 < positions.length ? cur + 1 : null)}>
              {cur + 1 < positions.length ? `${es ? "Siguiente" : "Next"}: ${positions[cur + 1]} ›` : es ? "Listo ✓" : "Done ✓"}
            </button>
          </div>
        </div>
      )}
      <p className="text-[11px] text-muted">{es ? "Toca una posición en la cancha para poner el número y nombre." : "Tap a position on the pitch to add the number and name."}</p>
    </div>
  );
}
