"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { savedChanged } from "../wizard/SavedPicker";
import { ImageDrop } from "../ImageDrop";
import { thumb } from "@/lib/thumb";

export type Row = { team: string; p: string; w: string; d: string; l: string; gd: string; pts: string };
export type League = { id: string; name: string; logoUrl: string | null; official: boolean; rows: Row[]; headline: string; date: string; savedAt: string | null };

const blank = (): Row => ({ team: "", p: "", w: "", d: "", l: "", gd: "", pts: "" });
const n = (v: string) => parseInt(v, 10) || 0;

/** "My leagues": each league's standings, editable, with one-tap results and a Generate button. */
export function LeaguesManager({ initial, es, officialChoices }: { initial: League[]; es: boolean; officialChoices: { id: string; name: string; logoUrl: string | null }[] }) {
  const router = useRouter();
  const [leagues, setLeagues] = useState<League[]>(initial);
  const [open, setOpen] = useState<string | null>(initial[0]?.id ?? null);
  const [draft, setDraft] = useState<Record<string, League>>({});
  const [msg, setMsg] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newLogo, setNewLogo] = useState<string | null>(null);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);

  const cur = (l: League) => draft[l.id] ?? l;
  const setRows = (l: League, rows: Row[]) => setDraft((d) => ({ ...d, [l.id]: { ...cur(l), rows } }));
  const setField = (l: League, k: "headline" | "date", v: string) => setDraft((d) => ({ ...d, [l.id]: { ...cur(l), [k]: v } }));
  const dirty = (l: League) => !!draft[l.id] && JSON.stringify(draft[l.id]) !== JSON.stringify(l);

  function withRows(l: League) {
    const rows = cur(l).rows;
    return rows.length ? rows : Array.from({ length: 6 }, blank);
  }
  /** One tap after a match: W / D / L adds the game, updates played and points (3 / 1 / 0). */
  function result(l: League, i: number, r: "w" | "d" | "l") {
    const rows = withRows(l).map((row, j) => {
      if (j !== i) return row;
      const next = { ...row, p: String(n(row.p) + 1), [r]: String(n(row[r]) + 1) } as Row;
      next.pts = String(n(next.w) * 3 + n(next.d));
      return next;
    });
    setRows(l, rows);
  }
  function sortByPoints(l: League) {
    const rows = withRows(l).filter((r) => r.team.trim());
    rows.sort((a, b) => n(b.pts) - n(a.pts) || n(b.gd) - n(a.gd) || n(b.w) - n(a.w));
    setRows(l, rows);
  }
  async function save(l: League) {
    const d = cur(l);
    const rows = withRows(l).filter((r) => r.team.trim());
    setBusy(l.id);
    const r = await fetch("/api/standings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ league: l.id, rows, headline: d.headline, date: d.date }) }).catch(() => null);
    setBusy(null);
    if (!r?.ok) return setMsg((m) => ({ ...m, [l.id]: es ? "❌ No se pudo guardar" : "❌ Couldn't save" }));
    const saved = { ...d, rows, savedAt: new Date().toISOString() };
    setLeagues((ls) => ls.map((x) => (x.id === l.id ? saved : x)));
    setDraft((dr) => {
      const c = { ...dr };
      delete c[l.id];
      return c;
    });
    setMsg((m) => ({ ...m, [l.id]: es ? "💾 Tabla guardada" : "💾 Table saved" }));
    return true;
  }
  async function saveAndGenerate(l: League) {
    if (dirty(l) || !l.savedAt) {
      const ok = await save(l);
      if (!ok) return;
    }
    router.push(`/create?type=standings&league=${encodeURIComponent(l.id)}`);
  }
  async function addLeague(official?: { id: string; name: string; logoUrl: string | null }) {
    setBusy("new");
    let item: { id: string; name: string; logoUrl: string | null } | null = official ?? null;
    if (!item) {
      if (!newName.trim()) return setBusy(null);
      const r = await fetch("/api/saved", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind: "championship", name: newName.trim(), logoUrl: newLogo }) }).catch(() => null);
      const d = await r?.json().catch(() => ({}));
      item = d?.item ?? null;
      if (item) savedChanged("championship");
    }
    setBusy(null);
    if (!item) return;
    const league: League = { id: item.id, name: item.name, logoUrl: item.logoUrl, official: !!official, rows: [], headline: "", date: "", savedAt: null };
    setLeagues((ls) => [league, ...ls.filter((x) => x.id !== league.id)]);
    setDraft((d) => ({ ...d, [league.id]: { ...league, rows: Array.from({ length: 6 }, blank) } }));
    setOpen(league.id);
    setAdding(false);
    setNewName("");
    setNewLogo(null);
    router.refresh();
  }
  async function setLogo(l: League, url: string | null) {
    if (l.official) return;
    const r = await fetch(`/api/saved/${l.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ logoUrl: url }) }).catch(() => null);
    const d = await r?.json().catch(() => ({}));
    if (!d?.item) return setMsg((m) => ({ ...m, [l.id]: es ? "❌ No se pudo guardar el logo" : "❌ Couldn't save the logo" }));
    setLeagues((ls) => ls.map((x) => (x.id === l.id ? { ...x, logoUrl: d.item.logoUrl ?? null } : x)));
    setDraft((dr) => (dr[l.id] ? { ...dr, [l.id]: { ...dr[l.id], logoUrl: d.item.logoUrl ?? null } } : dr));
    savedChanged("championship");
    router.refresh();
  }
  async function remove(l: League) {
    setBusy(l.id);
    if (!l.official) await fetch(`/api/saved/${l.id}`, { method: "DELETE" }).catch(() => {});
    await fetch(`/api/standings?league=${encodeURIComponent(l.id)}`, { method: "DELETE" }).catch(() => {});
    setBusy(null);
    setLeagues((ls) => ls.filter((x) => x.id !== l.id));
    setConfirmDel(null);
    if (!l.official) savedChanged("championship");
    router.refresh();
  }

  const headers = es ? ["PJ", "G", "E", "P", "DG", "PTS"] : ["P", "W", "D", "L", "GD", "PTS"];
  const keys: (keyof Row)[] = ["p", "w", "d", "l", "gd", "pts"];

  return (
    <div className="space-y-4">
      {/* New league */}
      {adding ? (
        <div className="card space-y-3 p-4">
          <div className="text-sm font-bold">{es ? "Nueva liga / organización" : "New league / organization"}</div>
          <input className="input" maxLength={40} placeholder={es ? "Nombre de la liga" : "League name"} value={newName} onChange={(e) => setNewName(e.target.value)} />
          <ImageDrop kind="logo" label={es ? "Logo de la liga (opcional)" : "League logo (optional)"} value={newLogo} onChange={setNewLogo} searchQuery={newName} />
          {officialChoices.length > 0 && (
            <div>
              <div className="mb-1 text-[11px] font-bold uppercase tracking-wider text-muted">{es ? "O una liga oficial" : "Or an official league"}</div>
              <div className="flex flex-wrap gap-1.5">
                {officialChoices.map((o) => (
                  <button key={o.id} type="button" disabled={!!busy} onClick={() => addLeague(o)} className="chip text-xs">
                    {o.name}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="flex gap-2">
            <button type="button" className="btn-primary px-4 py-2 text-sm" disabled={busy === "new" || !newName.trim()} onClick={() => addLeague()}>
              {busy === "new" ? "…" : es ? "Crear" : "Create"}
            </button>
            <button type="button" className="btn-ghost px-4 py-2 text-sm" onClick={() => setAdding(false)}>
              {es ? "Cancelar" : "Cancel"}
            </button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => setAdding(true)} className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-lime/40 bg-lime/5 p-4 font-bold text-lime transition hover:border-lime">
          ＋ {es ? "Nueva liga" : "New league"}
        </button>
      )}

      {leagues.length === 0 && !adding && (
        <p className="text-sm text-muted">{es ? "Crea tu liga y escribe la tabla una sola vez. Después solo tocas G / E / P tras cada partido y generas el póster." : "Create your league and type the table once. After that, just tap W / D / L after each match and generate the poster."}</p>
      )}

      {leagues.map((l) => {
        const d = cur(l);
        const rows = withRows(l);
        const isOpen = open === l.id;
        return (
          <div key={l.id} className={`card overflow-hidden ${dirty(l) ? "border-lime/50" : ""}`}>
            <button type="button" onClick={() => setOpen(isOpen ? null : l.id)} className="flex w-full items-center gap-3 p-4 text-left">
              {l.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={thumb(l.logoUrl, 96)} alt="" className="h-11 w-11 shrink-0 rounded-xl object-contain" />
              ) : (
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-panel-2 text-xl">🏟️</span>
              )}
              <span className="min-w-0 flex-1">
                <span className="block truncate font-bold">{l.name}</span>
                <span className="block truncate text-[11px] text-muted">
                  {l.rows.length ? `${l.rows.length} ${es ? "equipos" : "teams"}` : es ? "sin tabla todavía" : "no table yet"}
                  {l.savedAt ? ` · ${es ? "actualizada" : "updated"} ${new Date(l.savedAt).toLocaleDateString()}` : ""}
                  {dirty(l) ? ` · ${es ? "cambios sin guardar" : "unsaved changes"}` : ""}
                </span>
              </span>
              <span className="text-muted">{isOpen ? "▾" : "▸"}</span>
            </button>
            {isOpen && (
              <div className="space-y-3 border-t border-line p-4">
                {!l.official && (
                  <ImageDrop kind="logo" label={es ? "🏟️ Logo de la liga / organización (sale en todos sus pósters)" : "🏟️ League / organization logo (goes on all its posters)"} value={l.logoUrl} onChange={(u) => setLogo(l, u)} searchQuery={l.name} />
                )}
                <div className="grid grid-cols-2 gap-2">
                  <label className="block">
                    <span className="label">{es ? "Titular" : "Headline"}</span>
                    <input className="input !py-2 text-sm" maxLength={30} placeholder={es ? "TABLA DE POSICIONES" : "STANDINGS"} value={d.headline} onChange={(e) => setField(l, "headline", e.target.value)} />
                  </label>
                  <label className="block">
                    <span className="label">{es ? "Jornada / semana" : "Matchday / week"}</span>
                    <input className="input !py-2 text-sm" maxLength={30} placeholder={es ? "Jornada 7" : "Matchday 7"} value={d.date} onChange={(e) => setField(l, "date", e.target.value)} />
                  </label>
                </div>
                <div className="overflow-x-auto rounded-xl border border-line">
                  <table className="w-full min-w-[640px] text-sm">
                    <thead>
                      <tr className="bg-panel-2 text-[11px] font-bold uppercase text-muted">
                        <th className="w-8 px-1 py-2">#</th>
                        <th className="px-1 py-2 text-left">{es ? "Equipo" : "Team"}</th>
                        {headers.map((h) => (
                          <th key={h} className="w-12 px-1 py-2">{h}</th>
                        ))}
                        <th className="w-28 px-1 py-2">{es ? "Resultado" : "Result"}</th>
                        <th className="w-8" />
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row, i) => {
                        const setCell = (k: keyof Row, v: string) => setRows(l, rows.map((x, j) => (j === i ? { ...x, [k]: v } : x)));
                        return (
                          <tr key={i} className="border-t border-line">
                            <td className="px-1 py-1 text-center text-xs text-muted">{i + 1}</td>
                            <td className="px-1 py-1">
                              <input className="input !py-1.5 text-sm" maxLength={30} placeholder={es ? "Equipo" : "Team"} value={row.team} onChange={(e) => setCell("team", e.target.value)} />
                            </td>
                            {keys.map((k) => (
                              <td key={k} className="px-0.5 py-1">
                                <input className="input !px-1 !py-1.5 text-center text-sm" inputMode="numeric" maxLength={4} value={row[k]} onChange={(e) => setCell(k, e.target.value.replace(/[^0-9-]/g, ""))} />
                              </td>
                            ))}
                            <td className="px-1 py-1">
                              <div className="flex justify-center gap-1">
                                {(["w", "d", "l"] as const).map((r) => (
                                  <button key={r} type="button" title={es ? "Sumar partido" : "Add a match"} onClick={() => result(l, i, r)} className={`h-7 w-7 rounded-md border text-[11px] font-bold ${r === "w" ? "border-teal/50 text-teal" : r === "d" ? "border-line text-muted" : "border-danger/50 text-danger"}`}>
                                    {r === "w" ? (es ? "G" : "W") : r === "d" ? (es ? "E" : "D") : es ? "P" : "L"}
                                  </button>
                                ))}
                              </div>
                            </td>
                            <td className="px-1 py-1 text-center">
                              <button type="button" className="text-muted hover:text-danger" onClick={() => setRows(l, rows.filter((_, j) => j !== i))} aria-label="Remove">
                                ×
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="flex flex-wrap gap-2 text-xs">
                  <button type="button" className="chip" onClick={() => setRows(l, [...rows, blank()])}>
                    ＋ {es ? "Equipo" : "Team"}
                  </button>
                  <button type="button" className="chip" onClick={() => sortByPoints(l)}>
                    ↕ {es ? "Ordenar por puntos" : "Sort by points"}
                  </button>
                  <span className="self-center text-muted">{es ? "G / E / P suma el partido y los puntos solos (3 · 1 · 0)." : "W / D / L adds the match and the points for you (3 · 1 · 0)."}</span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button type="button" className="btn-ghost px-4 py-2 text-sm" disabled={busy === l.id} onClick={() => save(l)}>
                    💾 {es ? "Guardar" : "Save"}
                  </button>
                  <button type="button" className="btn-primary px-4 py-2 text-sm" disabled={busy === l.id} onClick={() => saveAndGenerate(l)}>
                    ⚡ {es ? "Generar póster" : "Generate poster"}
                  </button>
                  {msg[l.id] && <span className="text-xs text-teal">{msg[l.id]}</span>}
                  <span className="ml-auto">
                    {confirmDel === l.id ? (
                      <span className="flex items-center gap-2 text-xs">
                        <span className="text-muted">{es ? "¿Quitar esta liga?" : "Remove this league?"}</span>
                        <button type="button" className="font-bold text-danger" onClick={() => remove(l)}>
                          {es ? "Sí, quitar" : "Yes, remove"}
                        </button>
                        <button type="button" className="text-muted" onClick={() => setConfirmDel(null)}>
                          {es ? "No" : "No"}
                        </button>
                      </span>
                    ) : (
                      <button type="button" className="text-xs text-muted hover:text-danger" onClick={() => setConfirmDel(l.id)}>
                        {es ? "Quitar" : "Remove"}
                      </button>
                    )}
                  </span>
                </div>
                <p className="text-[11px] text-muted">
                  {es ? "Al generar, la tabla se carga sola en el creador: elige el estilo y listo. Tus pósters de esta liga están en " : "When you generate, the table loads itself in the creator: pick a style and go. Your posters for this league are in "}
                  <Link href="/history" className="text-lime">{es ? "Historial" : "History"}</Link>.
                </p>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
