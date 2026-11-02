"use client";

import { useState } from "react";
import { ImageDrop } from "../ImageDrop";
import type { RosterPlayer } from "@/lib/roster";

export type Team = { id: string; name: string; logoUrl: string | null; players: RosterPlayer[] };

const POS = ["GK", "RB", "CB", "LB", "RWB", "LWB", "CDM", "CM", "CAM", "RM", "LM", "RW", "LW", "CF", "ST"];
const blank = (): RosterPlayer => ({ num: "", name: "", pos: "" });

/** "My teams": list + editor (name, crest, roster). */
export function TeamsManager({ initial, es }: { initial: Team[]; es: boolean }) {
  const [teams, setTeams] = useState(initial);
  const [edit, setEdit] = useState<(Team & { isNew?: boolean }) | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [confirmDel, setConfirmDel] = useState(false);

  const open = (t?: Team) => {
    setErr("");
    setConfirmDel(false);
    setEdit(t ? { ...t, players: t.players.length ? t.players.map((p) => ({ ...p })) : [blank()] } : { id: "", name: "", logoUrl: null, players: Array.from({ length: 11 }, blank), isNew: true });
  };
  const setP = (i: number, k: keyof RosterPlayer, v: string) =>
    setEdit((e) => (e ? { ...e, players: e.players.map((p, j) => (j === i ? { ...p, [k]: v } : p)) } : e));

  async function save() {
    if (!edit || !edit.name.trim()) return;
    setBusy(true);
    setErr("");
    const players = edit.players.filter((p) => p.name.trim()).map((p) => ({ num: p.num.trim().slice(0, 3), name: p.name.trim().slice(0, 30), pos: p.pos }));
    const res = await fetch(edit.isNew ? "/api/saved" : `/api/saved/${edit.id}`, {
      method: edit.isNew ? "POST" : "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...(edit.isNew ? { kind: "team" } : {}), name: edit.name.trim(), logoUrl: edit.logoUrl, players }),
    });
    const d = await res.json().catch(() => ({}));
    setBusy(false);
    if (!d.item) return setErr(es ? "No se pudo guardar" : "Couldn't save");
    setTeams((ts) => (edit.isNew ? [d.item, ...ts] : ts.map((t) => (t.id === d.item.id ? d.item : t))));
    setEdit(null);
  }
  async function remove() {
    if (!edit || edit.isNew) return;
    setBusy(true);
    await fetch(`/api/saved/${edit.id}`, { method: "DELETE" });
    setBusy(false);
    setTeams((ts) => ts.filter((t) => t.id !== edit.id));
    setEdit(null);
  }

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        <button type="button" onClick={() => open()} className="flex min-h-24 items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-lime/40 bg-lime/5 p-4 font-bold text-lime transition hover:border-lime">
          ＋ {es ? "Nuevo equipo" : "New team"}
        </button>
        {teams.map((t) => (
          <button key={t.id} type="button" onClick={() => open(t)} className="flex items-center gap-3 rounded-2xl border border-line bg-gradient-to-br from-panel-2 to-panel p-4 text-left transition hover:border-lime/50">
            {t.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={t.logoUrl} alt="" className="h-14 w-14 shrink-0 rounded-xl bg-ink/50 object-contain p-1" />
            ) : (
              <span className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-lime/10 font-display text-2xl text-lime">{t.name[0]?.toUpperCase()}</span>
            )}
            <span className="min-w-0 flex-1">
              <span className="block truncate font-extrabold">{t.name}</span>
              <span className="block text-xs text-muted">
                {t.players.length ? `👥 ${t.players.length} ${es ? "jugadores" : "players"}` : es ? "Sin jugadores aún" : "No players yet"}
              </span>
              {t.players.length > 0 && <span className="mt-1 block truncate text-[11px] text-muted/80">{t.players.slice(0, 5).map((p) => p.name).join(" · ")}</span>}
            </span>
            <span className="text-muted">›</span>
          </button>
        ))}
      </div>
      {teams.length === 0 && (
        <p className="text-center text-sm text-muted">{es ? "Aún no tienes equipos. Crea uno o se guardará solo cuando hagas una alineación o campeones." : "No teams yet. Create one — or it saves automatically when you make a lineup or champions poster."}</p>
      )}

      {edit && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 sm:items-center sm:p-4" onClick={() => setEdit(null)}>
          <div className="card max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-b-none p-5 sm:rounded-b-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-display text-2xl">{edit.isNew ? (es ? "Nuevo equipo" : "New team") : es ? "Editar equipo" : "Edit team"}</h3>
              <button type="button" onClick={() => setEdit(null)} className="text-xl text-muted">✕</button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="label">{es ? "Nombre del equipo" : "Team name"} *</label>
                <input className="input" maxLength={40} value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} />
              </div>
              <ImageDrop kind="logo" label={es ? "Escudo (opcional)" : "Crest (optional)"} value={edit.logoUrl} onChange={(v) => setEdit((e) => (e ? { ...e, logoUrl: v } : e))} />
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <span className="label mb-0">{es ? "Jugadores" : "Players"} ({edit.players.filter((p) => p.name.trim()).length})</span>
                  <span className="text-[11px] text-muted">#  ·  {es ? "nombre" : "name"}  ·  {es ? "posición" : "position"}</span>
                </div>
                <div className="space-y-2">
                  {edit.players.map((p, i) => (
                    <div key={i} className="grid grid-cols-[3.2rem_minmax(0,1fr)_4.6rem_2rem] gap-1.5">
                      <input className="input px-2 text-center" inputMode="numeric" autoComplete="off" maxLength={3} placeholder="#" value={p.num} onChange={(e) => setP(i, "num", e.target.value.replace(/\D/g, ""))} />
                      <input className="input px-3" autoComplete="off" maxLength={30} placeholder={es ? "Nombre / gamertag" : "Name / gamertag"} value={p.name} onChange={(e) => setP(i, "name", e.target.value)} />
                      <select className="input px-1.5 text-xs" value={p.pos} onChange={(e) => setP(i, "pos", e.target.value)}>
                        <option value="">—</option>
                        {POS.map((x) => (
                          <option key={x}>{x}</option>
                        ))}
                      </select>
                      <button type="button" aria-label="Remove" className="text-muted hover:text-danger" onClick={() => setEdit({ ...edit, players: edit.players.filter((_, j) => j !== i) })}>✕</button>
                    </div>
                  ))}
                </div>
                {edit.players.length < 40 && (
                  <button type="button" className="mt-2 w-full rounded-xl border border-dashed border-line py-2 text-sm font-bold text-lime hover:border-lime/50" onClick={() => setEdit({ ...edit, players: [...edit.players, blank()] })}>
                    ＋ {es ? "Añadir jugador" : "Add player"}
                  </button>
                )}
              </div>
              {err && <p className="text-sm text-danger">{err}</p>}
              <div className="flex items-center gap-2">
                {!edit.isNew &&
                  (confirmDel ? (
                    <button type="button" disabled={busy} onClick={remove} className="rounded-xl bg-danger px-3 py-2.5 text-sm font-bold text-white">{es ? "¿Seguro? Eliminar" : "Sure? Delete"}</button>
                  ) : (
                    <button type="button" onClick={() => setConfirmDel(true)} className="rounded-xl border border-line px-3 py-2.5 text-sm font-bold text-muted hover:text-danger">🗑</button>
                  ))}
                <button type="button" disabled={busy || !edit.name.trim()} onClick={save} className="btn-primary flex-1 py-3">{busy ? "…" : es ? "Guardar equipo" : "Save team"}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
