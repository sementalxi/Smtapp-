"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useWakeLock } from "../useWakeLock";
import { EMPTY_INPUTS } from "@/lib/templates";
import { ImageDrop } from "../ImageDrop";
import { waitForBanner } from "@/lib/wait-banner";

type P = { photo: string | null; name: string; real: string };
type R = { status: "wait" | "busy" | "done" | "error"; id?: string; url?: string | null; error?: string };
const blank = (): P => ({ photo: null, name: "", real: "" });

/** Roster banners: add several players, get one wide banner per player — all in the same design. */
export function RosterForm({ templateId, credits: initialCredits, cost, es }: { templateId: string; credits: number; cost: number; es: boolean }) {
  const router = useRouter();
  const [team, setTeam] = useState("");
  const [crest, setCrest] = useState<string | null>(null);
  const [players, setPlayers] = useState<P[]>([blank(), blank()]);
  const [results, setResults] = useState<R[]>([]);
  const [running, setRunning] = useState(false);
  const [credits, setCredits] = useState(initialCredits);
  useWakeLock(running);

  const ready = players.filter((p) => p.photo && p.name.trim());
  const total = ready.length * cost;
  const set = (i: number, patch: Partial<P>) => setPlayers((ps) => ps.map((p, j) => (j === i ? { ...p, ...patch } : p)));

  async function make(p: P, matchId?: string): Promise<R> {
    const res = await fetch("/api/banners", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        templateId: matchId ? "match" : templateId,
        ...(matchId ? { matchBannerId: matchId } : { logoUrl: crest }),
        mode: "PRO",
        photoUrl: p.photo,
        inputs: { ...EMPTY_INPUTS, name: p.name.trim(), tagline: p.real.trim(), team: team.trim(), colorMode: crest ? "team" : "surprise" },
      }),
    });
    let d = await res.json().catch(() => ({}));
    if (res.ok && d.id && !d.finalUrl) {
      const w = await waitForBanner(d.id);
      d = w.ok ? { id: d.id, finalUrl: w.url } : { error: w.error, detail: w.detail };
    }
    if (d.id && d.finalUrl) return { status: "done", id: d.id, url: d.finalUrl };
    return { status: "error", error: d.error === "err_credits" ? (es ? "Sin créditos" : "Out of credits") : d.error === "err_photo_blocked" || d.error === "err_blocked" ? (es ? "Foto rechazada por el filtro (créditos devueltos)" : "Photo blocked by the safety filter (credits refunded)") : es ? "Falló (créditos devueltos)" : "Failed (credits refunded)" };
  }

  async function run() {
    const list = ready;
    setRunning(true);
    setResults(list.map(() => ({ status: "wait" })));
    let rootId: string | undefined;
    for (let i = 0; i < list.length; i++) {
      setResults((rs) => rs.map((r, j) => (j === i ? { status: "busy" } : r)));
      // The first banner sets the design; every other player copies it.
      const r = await make(list[i], rootId);
      if (r.status === "done") {
        rootId = rootId ?? r.id;
        setCredits((c) => c - cost);
      }
      setResults((rs) => rs.map((x, j) => (j === i ? r : x)));
      if (i === 0 && r.status !== "done") {
        setResults((rs) => rs.map((x, j) => (j > 0 ? { status: "error", error: es ? "No se hizo (el primero falló)" : "Skipped (the first one failed)" } : x)));
        break;
      }
    }
    setRunning(false);
    router.refresh();
  }

  const started = results.length > 0;

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="text-center">
        <h1 className="font-display text-4xl">{es ? "Banners de plantilla" : "Roster banners"}</h1>
        <p className="mx-auto mt-1 max-w-lg text-sm text-muted">
          {es ? "Agrega a tus jugadores y recibe un banner ancho por cada uno — todos con el mismo diseño." : "Add your players and get one wide banner for each — all in the same design."}
        </p>
      </div>

      {!started && (
        <>
          <div className="card grid gap-3 p-4 sm:grid-cols-2">
            <div>
              <label className="label">{es ? "Nombre del equipo" : "Team name"}</label>
              <input className="input" maxLength={40} value={team} onChange={(e) => setTeam(e.target.value)} />
            </div>
            <ImageDrop kind="logo" label={es ? "Escudo del equipo (colores del banner)" : "Team crest (sets the colours)"} value={crest} onChange={setCrest} />
          </div>

          <div className="space-y-3">
            {players.map((p, i) => (
              <div key={i} className="card grid grid-cols-[7rem_minmax(0,1fr)] gap-3 p-3 sm:grid-cols-[9rem_minmax(0,1fr)]">
                <ImageDrop kind="photo" label={`#${i + 1}`} value={p.photo} onChange={(u) => set(i, { photo: u })} noSearch />
                <div className="space-y-2">
                  <div>
                    <label className="label">{es ? "Gamertag / nombre" : "Gamertag / name"} *</label>
                    <input className="input" maxLength={24} value={p.name} onChange={(e) => set(i, { name: e.target.value })} />
                  </div>
                  <div>
                    <label className="label">{es ? "Nombre real (pequeño, opcional)" : "Real name (small, optional)"}</label>
                    <input className="input" maxLength={40} value={p.real} onChange={(e) => set(i, { real: e.target.value })} />
                  </div>
                  {players.length > 1 && (
                    <button type="button" className="text-xs text-muted hover:text-danger" onClick={() => setPlayers((ps) => ps.filter((_, j) => j !== i))}>🗑 {es ? "Quitar" : "Remove"}</button>
                  )}
                </div>
              </div>
            ))}
          </div>
          {players.length < 10 && (
            <button type="button" onClick={() => setPlayers((ps) => [...ps, blank()])} className="w-full rounded-2xl border-2 border-dashed border-lime/40 bg-lime/5 py-3 font-bold text-lime">
              ＋ {es ? "Añadir jugador" : "Add player"}
            </button>
          )}

          <div className="card sticky bottom-3 z-10 flex items-center gap-3 p-3 shadow-2xl shadow-black">
            <div className="min-w-0 flex-1 text-sm">
              <b>{ready.length}</b> {es ? "banner(s)" : "banner(s)"} · ⚡ {total}
              {credits < total && <span className="block text-xs text-danger">{es ? `Tienes ${credits} créditos` : `You have ${credits} credits`}</span>}
            </div>
            <button type="button" className="btn-primary px-5" disabled={!ready.length || credits < total || running} onClick={run}>
              ✨ {es ? "Crear banners" : "Make banners"}
            </button>
          </div>
        </>
      )}

      {started && (
        <div className="space-y-3">
          {ready.map((p, i) => {
            const r = results[i] ?? { status: "wait" };
            return (
              <div key={i} className="card overflow-hidden">
                {r.status === "done" && r.url ? (
                  <Link href={`/banner/${r.id}`}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={r.url} alt={p.name} className="w-full" />
                  </Link>
                ) : (
                  <div className={`grid aspect-[3/2] place-items-center text-sm ${r.status === "busy" ? "animate-pulse bg-panel-2 text-lime" : "bg-panel text-muted"}`}>
                    {r.status === "busy" ? (es ? `Creando ${p.name}… (1–2 min)` : `Making ${p.name}… (1–2 min)`) : r.status === "error" ? `❌ ${p.name}: ${r.error}` : `${p.name} — ${es ? "en espera" : "waiting"}`}
                  </div>
                )}
                <div className="flex items-center justify-between px-3 py-2 text-xs">
                  <b>{p.name}</b>
                  {r.status === "done" && r.url && (
                    <a href={r.url} download className="font-bold text-lime">⬇ {es ? "Descargar" : "Download"}</a>
                  )}
                </div>
              </div>
            );
          })}
          {!running && (
            <button type="button" className="btn-ghost w-full" onClick={() => { setResults([]); setPlayers([blank(), blank()]); }}>
              {es ? "Hacer otra plantilla" : "Make another roster"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
