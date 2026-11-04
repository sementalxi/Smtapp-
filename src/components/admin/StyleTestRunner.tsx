"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useT } from "@/i18n/client";
import { ImageDrop } from "../ImageDrop";
import { thumb } from "@/lib/thumb";

export type TestTemplate = { id: string; name: string; layout: string; logoCreate: boolean; hasInstructions: boolean };
export type TestResult = {
  bannerId: string;
  templateId: string;
  templateName: string;
  layout: string;
  status: "PROCESSING" | "READY" | "FAILED";
  finalUrl: string | null;
  error: string | null;
  madeWith: string | null;
  seconds: number | null;
  createdAt: string;
  run: string;
  stage?: string | null;
};
export type Sample = {
  photoUrl: string;
  logoUrl: string;
  name: string;
  team: string;
  rival: string;
  position: string;
  number: string;
  tagline: string;
  subtitle: string;
  footer: string;
  competition: string;
  date: string;
  venue: string;
  mascot: string;
};

export const DEFAULT_SAMPLE: Sample = {
  photoUrl: "",
  logoUrl: "",
  name: "KIXO TEST",
  team: "KIXO FC",
  rival: "RIVALS FC",
  position: "ST",
  number: "10",
  tagline: "Welcome",
  subtitle: "New signing",
  footer: "Season 2026",
  competition: "Pro Clubs League",
  date: "Saturday 8 PM",
  venue: "KIXO Arena",
  mascot: "a wolf head",
};

const LAYOUT_NAMES: Record<string, [string, string]> = {
  PLAYER: ["Player card", "Tarjeta de jugador"],
  CHAMPIONS: ["Champions", "Campeones"],
  LINEUP: ["Lineup", "Alineación"],
  MATCHDAY: ["Match day", "Día de partido"],
  RESULT: ["Result", "Resultado"],
  EVENT: ["Tournament / event", "Torneo / evento"],
  STANDINGS: ["Standings", "Tabla"],
  LOGO: ["Team logo", "Logo del equipo"],
};

const ROSTER = ["Alex", "Bruno", "Carlos", "Diego", "Eli", "Fabio", "Gabo", "Hugo", "Iker", "Javi", "Kevin"];
const PLAYERS = ["1 Alex GK", "2 Bruno RB", "3 Carlos CB", "4 Diego CB", "5 Eli LB", "6 Fabio CM", "8 Gabo CM", "10 Hugo CAM", "7 Iker RW", "9 Javi ST", "11 Kevin LW"];

/** Sample inputs for each kind of poster, from one shared sample. */
function inputsFor(layout: string, s: Sample, logoCreate: boolean): Record<string, unknown> {
  const base = { language: "English", aiCopy: "off", colorMode: "", bgPose: "style" };
  switch (layout) {
    case "CHAMPIONS":
      return { ...base, headline: "CHAMPIONS", team: s.team, roster: ROSTER, trophy: "surprise", date: s.date, eventName: s.competition };
    case "LINEUP":
      return { ...base, headline: "STARTING XI", team: s.team, formation: "4-3-3", players: PLAYERS, competition: s.competition, date: s.date };
    case "MATCHDAY":
      return { ...base, headline: "MATCH DAY", homeTeam: s.team, awayTeam: s.rival, competition: s.competition, date: s.date, time: "8:00 PM", venue: s.venue };
    case "RESULT":
      return { ...base, headline: "FULL TIME", homeTeam: s.team, awayTeam: s.rival, homeScore: "3", awayScore: "1", scorers: [`${s.name} 23'`, `${s.name} 67'`, "Rival 80'"], competition: s.competition };
    case "EVENT":
      return { ...base, headline: "TOURNAMENT", name: s.competition, subtitle: s.tagline, date: s.date, details: "8:00 PM · Online", prize: "$500" };
    case "STANDINGS":
      return {
        ...base,
        headline: "STANDINGS",
        competition: s.competition,
        date: s.date,
        standings: [`1. ${s.team} · P 10 · W 8 · D 1 · L 1 · GD 18 · PTS 25`, `2. ${s.rival} · P 10 · W 7 · D 1 · L 2 · GD 11 · PTS 22`, "3. Lions · P 10 · W 5 · D 2 · L 3 · GD 4 · PTS 17", "4. Sharks · P 10 · W 4 · D 2 · L 4 · GD -1 · PTS 14", "5. Wolves · P 10 · W 2 · D 1 · L 7 · GD -12 · PTS 7"],
      };
    case "LOGO":
      return logoCreate ? { ...base, team: s.team, subtitle: s.mascot, footer: s.footer } : { ...base, headline: s.tagline, footer: s.footer, team: s.team };
    default:
      return { ...base, name: s.name, team: s.team, position: s.position, number: s.number, tagline: s.tagline, subtitle: s.subtitle, footer: s.footer };
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Admin → Style test: makes one poster with every style (one by one) and shows how each came out. */
export function StyleTestRunner({ templates, initialSample, initialResults }: { templates: TestTemplate[]; initialSample: Sample | null; initialResults: TestResult[] }) {
  const { locale } = useT();
  const es = locale === "es";
  const [sample, setSample] = useState<Sample>({ ...DEFAULT_SAMPLE, ...(initialSample ?? {}) });
  const layouts = useMemo(() => [...new Set(templates.map((t) => t.layout))], [templates]);
  const [picked, setPicked] = useState<string[]>(layouts);
  const [results, setResults] = useState<TestResult[]>(initialResults);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number; current?: string }>({ done: 0, total: 0 });
  const [open, setOpen] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "READY" | "FAILED">("all");
  const stopRef = useRef(false);
  const set = (k: keyof Sample) => (e: React.ChangeEvent<HTMLInputElement>) => setSample({ ...sample, [k]: e.target.value });

  const queue = templates.filter((t) => picked.includes(t.layout));
  const needPhoto = queue.some((t) => t.layout === "PLAYER") && !sample.photoUrl;
  const needLogo = queue.some((t) => t.layout === "LOGO" && !t.logoCreate) && !sample.logoUrl;

  useEffect(() => {
    // Keep polling any poster that is still processing (e.g. after a reload).
    const pending = results.filter((r) => r.status === "PROCESSING");
    if (!pending.length) return;
    const t = setInterval(async () => {
      for (const r of pending) {
        const d = await fetch(`/api/banners/${r.bannerId}`, { cache: "no-store" }).then((x) => x.json()).catch(() => null);
        if (d && (d.status === "READY" || d.status === "FAILED")) upsert({ ...r, status: d.status, finalUrl: d.finalUrl ?? null, error: d.detail ?? d.error ?? null, madeWith: d.madeWith ?? null, seconds: Math.round((Date.now() - new Date(r.createdAt).getTime()) / 1000) });
        else if (d?.stage) upsert({ ...r, stage: d.stage });
      }
    }, 5000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [results.filter((r) => r.status === "PROCESSING").map((r) => r.bannerId).join(",")]);

  function upsert(r: TestResult) {
    setResults((list) => {
      const i = list.findIndex((x) => x.bannerId === r.bannerId);
      if (i < 0) return [r, ...list];
      const copy = [...list];
      copy[i] = { ...copy[i], ...r };
      return copy;
    });
  }

  async function saveSample() {
    await fetch("/api/admin/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ style_test_sample: JSON.stringify(sample) }) }).catch(() => {});
  }

  async function runOne(t: TestTemplate, run: string) {
    const started = Date.now();
    const body = {
      templateId: t.id,
      inputs: inputsFor(t.layout, sample, t.logoCreate),
      photoUrl: t.layout === "LOGO" ? undefined : sample.photoUrl || undefined,
      logoUrl: t.layout === "LOGO" && t.logoCreate ? undefined : sample.logoUrl || undefined,
      mode: "PRO",
      test: true,
      testRun: run,
    };
    const res = await fetch("/api/banners", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const d = (await res.json().catch(() => ({}))) as { id?: string; error?: string; detail?: string };
    if (!res.ok || !d.id) {
      upsert({ bannerId: `x-${t.id}-${started}`, templateId: t.id, templateName: t.name, layout: t.layout, status: "FAILED", finalUrl: null, error: `${d.error ?? res.status}${d.detail ? ` — ${d.detail}` : ""}`, madeWith: null, seconds: 0, createdAt: new Date(started).toISOString(), run });
      return;
    }
    const r: TestResult = { bannerId: d.id, templateId: t.id, templateName: t.name, layout: t.layout, status: "PROCESSING", finalUrl: null, error: null, madeWith: null, seconds: null, createdAt: new Date(started).toISOString(), run };
    upsert(r);
    for (let n = 0; n < 100 && !stopRef.current; n++) {
      await sleep(4000);
      const st = (await fetch(`/api/banners/${d.id}`, { cache: "no-store" }).then((x) => x.json()).catch(() => null)) as { status?: string; finalUrl?: string | null; error?: string | null; detail?: string; madeWith?: string | null; stage?: string | null } | null;
      if (!st) continue;
      if (st.status === "READY" || st.status === "FAILED") {
        upsert({ ...r, status: st.status, finalUrl: st.finalUrl ?? null, error: st.detail ?? st.error ?? null, madeWith: st.madeWith ?? null, seconds: Math.round((Date.now() - started) / 1000) });
        return;
      }
      if (st.stage) upsert({ ...r, stage: st.stage });
    }
  }

  async function runAll(list: TestTemplate[]) {
    if (!list.length || running) return;
    stopRef.current = false;
    setRunning(true);
    await saveSample();
    const run = `run-${Date.now().toString(36)}`;
    setProgress({ done: 0, total: list.length, current: list[0]?.name });
    for (let i = 0; i < list.length; i++) {
      if (stopRef.current) break;
      setProgress({ done: i, total: list.length, current: list[i].name });
      await runOne(list[i], run);
    }
    setProgress((p) => ({ ...p, done: stopRef.current ? p.done : list.length, current: undefined }));
    setRunning(false);
  }

  const latest = useMemo(() => {
    // Newest result per template.
    const m = new Map<string, TestResult>();
    for (const r of [...results].sort((a, b) => b.createdAt.localeCompare(a.createdAt))) if (!m.has(r.templateId)) m.set(r.templateId, r);
    return m;
  }, [results]);
  const shown = templates.filter((t) => picked.includes(t.layout)).map((t) => ({ t, r: latest.get(t.id) })).filter(({ r }) => filter === "all" || r?.status === filter);
  const stats = { ready: [...latest.values()].filter((r) => r.status === "READY").length, failed: [...latest.values()].filter((r) => r.status === "FAILED").length, avg: (() => { const s = [...latest.values()].filter((r) => r.status === "READY" && r.seconds); return s.length ? Math.round(s.reduce((a, b) => a + (b.seconds ?? 0), 0) / s.length) : 0; })() };
  const lname = (l: string) => (LAYOUT_NAMES[l] ? LAYOUT_NAMES[l][es ? 1 : 0] : l);

  return (
    <div className="space-y-5">
      {/* Sample */}
      <div className="card p-4 sm:p-5">
        <div className="mb-3 text-[11px] font-bold uppercase tracking-widest text-muted">1 · {es ? "Muestra (foto, escudo y textos para todos los estilos)" : "Sample (photo, crest and texts used for every style)"}</div>
        <div className="grid gap-3 sm:grid-cols-2">
          <ImageDrop kind="photo" label={es ? "🧍 Foto de prueba" : "🧍 Test photo"} value={sample.photoUrl || null} onChange={(u) => setSample({ ...sample, photoUrl: u ?? "" })} searchQuery={sample.name} />
          <ImageDrop kind="logo" label={es ? "🛡️ Escudo de prueba" : "🛡️ Test crest"} value={sample.logoUrl || null} onChange={(u) => setSample({ ...sample, logoUrl: u ?? "" })} searchQuery={sample.team} />
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {(
            [
              ["name", "Player / gamertag"],
              ["team", "Team"],
              ["position", "Position"],
              ["number", "Number"],
              ["tagline", "Top word"],
              ["subtitle", "Accent line"],
              ["footer", "Bottom line"],
              ["competition", "Competition"],
              ["rival", "Rival team"],
              ["date", "Date"],
              ["venue", "Venue"],
              ["mascot", "Logo idea (new logos)"],
            ] as [keyof Sample, string][]
          ).map(([k, label]) => (
            <label key={k} className="block">
              <span className="mb-0.5 block text-[10px] font-bold uppercase tracking-wider text-muted">{label}</span>
              <input className="input !py-2 text-sm" value={sample[k]} onChange={set(k)} />
            </label>
          ))}
        </div>
      </div>

      {/* Pick + run */}
      <div className="card p-4 sm:p-5">
        <div className="mb-3 text-[11px] font-bold uppercase tracking-widest text-muted">2 · {es ? "Qué generar" : "What to generate"}</div>
        <div className="flex flex-wrap gap-1.5">
          {layouts.map((l) => {
            const on = picked.includes(l);
            const n = templates.filter((t) => t.layout === l).length;
            return (
              <button key={l} type="button" onClick={() => setPicked((p) => (on ? p.filter((x) => x !== l) : [...p, l]))} className={`rounded-full border px-3 py-1.5 text-xs font-bold transition ${on ? "border-lime bg-lime/15 text-lime" : "border-line bg-panel-2 text-muted"}`}>
                {lname(l)} <span className="opacity-60">{n}</span>
              </button>
            );
          })}
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          {running ? (
            <button type="button" onClick={() => (stopRef.current = true)} className="btn-danger px-5 py-2.5">
              ⏹ {es ? "Parar después de este" : "Stop after this one"}
            </button>
          ) : (
            <button type="button" onClick={() => runAll(queue)} disabled={!queue.length || needPhoto || needLogo} className="btn-primary px-5 py-2.5 disabled:opacity-50">
              ▶ {es ? `Generar todos (${queue.length} estilos)` : `Generate all (${queue.length} styles)`}
            </button>
          )}
          {!running && stats.failed > 0 && (
            <button type="button" onClick={() => runAll(templates.filter((t) => latest.get(t.id)?.status === "FAILED"))} className="btn-ghost px-4 py-2.5 text-sm">
              🔁 {es ? `Reintentar los fallidos (${stats.failed})` : `Retry failed (${stats.failed})`}
            </button>
          )}
          <span className="text-xs text-muted">
            {es ? "Gratis para el admin · uno por uno · ~2–4 min cada uno" : "Free for admin · one at a time · ~2–4 min each"}
          </span>
        </div>
        {needPhoto && <p className="mt-2 text-xs text-amber-200">⚠️ {es ? "Las tarjetas de jugador necesitan la foto de prueba." : "Player cards need the test photo."}</p>}
        {needLogo && <p className="mt-2 text-xs text-amber-200">⚠️ {es ? "Los estilos de “mostrar mi logo” necesitan el escudo de prueba." : "“Show off my logo” styles need the test crest."}</p>}
        {(running || progress.total > 0) && (
          <div className="mt-4">
            <div className="mb-1 flex justify-between text-xs text-muted">
              <span>{running ? `${es ? "Generando" : "Generating"}: ${progress.current ?? "…"}` : es ? "Terminado" : "Finished"}</span>
              <span>
                {progress.done} / {progress.total}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full bg-gradient-to-r from-lime/60 via-lime to-white transition-all" style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%` }} />
            </div>
          </div>
        )}
      </div>

      {/* Results */}
      <div>
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-widest text-muted">3 · {es ? "Resultados" : "Results"}</div>
            <div className="text-xs text-muted">
              ✅ {stats.ready} · ❌ {stats.failed} · ⏱ {es ? "promedio" : "avg"} {stats.avg ? `${Math.floor(stats.avg / 60)}:${String(stats.avg % 60).padStart(2, "0")}` : "—"}
            </div>
          </div>
          <div className="flex gap-1.5">
            {(["all", "READY", "FAILED"] as const).map((f) => (
              <button key={f} type="button" onClick={() => setFilter(f)} className={`rounded-full border px-3 py-1 text-xs font-bold ${filter === f ? "border-lime bg-lime text-ink" : "border-line text-muted"}`}>
                {f === "all" ? (es ? "Todos" : "All") : f === "READY" ? "✅" : "❌"}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {shown.map(({ t, r }) => (
            <div key={t.id} className={`card overflow-hidden ${r?.status === "FAILED" ? "border-danger/50" : r?.status === "READY" ? "border-lime/30" : ""}`}>
              {r?.status === "READY" && r.finalUrl ? (
                <Link href={`/banner/${r.bannerId}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={thumb(r.finalUrl, 480)} alt="" loading="lazy" className="aspect-[4/5] w-full object-cover" />
                </Link>
              ) : (
                <div className="grid aspect-[4/5] w-full place-items-center p-3 text-center text-xs text-muted">
                  {r?.status === "PROCESSING" ? (
                    <span>
                      <span className="mb-1 block animate-pulse text-2xl">⚙️</span>
                      {r.stage ?? (es ? "Generando…" : "Generating…")}
                    </span>
                  ) : r?.status === "FAILED" ? (
                    <span className="text-danger">❌ {es ? "Falló" : "Failed"}</span>
                  ) : (
                    <span>— {es ? "sin generar" : "not generated yet"} —</span>
                  )}
                </div>
              )}
              <div className="p-2.5">
                <div className="truncate text-sm font-bold">{t.name}</div>
                <div className="truncate text-[11px] text-muted">
                  {lname(t.layout)}
                  {r?.seconds ? ` · ⏱ ${Math.floor(r.seconds / 60)}:${String(r.seconds % 60).padStart(2, "0")}` : ""}
                </div>
                {r?.madeWith && <div className="mt-1 truncate text-[10px] text-teal" title={r.madeWith}>🤖 {r.madeWith}</div>}
                {r?.status === "FAILED" && r.error && <div className="mt-1 line-clamp-2 text-[10px] text-danger" title={r.error}>{r.error}</div>}
                <div className="mt-2 flex items-center gap-2">
                  <button type="button" onClick={() => setOpen(open === t.id ? null : t.id)} className="text-[11px] font-bold text-muted hover:text-white">
                    {open === t.id ? (es ? "Ocultar" : "Hide") : es ? "Detalles" : "Details"}
                  </button>
                  {!running && (
                    <button type="button" onClick={() => runAll([t])} className="text-[11px] font-bold text-lime">
                      {r ? (es ? "↻ Otra vez" : "↻ Again") : es ? "▶ Generar" : "▶ Generate"}
                    </button>
                  )}
                  {r?.status === "READY" && (
                    <Link href={`/banner/${r.bannerId}`} className="ml-auto text-[11px] font-bold text-muted hover:text-white">
                      {es ? "Abrir ›" : "Open ›"}
                    </Link>
                  )}
                </div>
                {open === t.id && (
                  <div className="mt-2 space-y-1 border-t border-line pt-2 text-[10px] text-muted">
                    <div>
                      <span className="font-bold text-white/80">{es ? "Estilo" : "Style"}:</span> {t.name} · {lname(t.layout)} {t.hasInstructions ? "· 📝 " + (es ? "con instrucciones de diseño" : "has design instructions") : "· " + (es ? "sin instrucciones (diseño base)" : "no instructions (built-in layout)")}
                    </div>
                    {r && (
                      <>
                        <div>
                          <span className="font-bold text-white/80">{es ? "Estado" : "Status"}:</span> {r.status}
                          {r.seconds ? ` · ${r.seconds}s` : ""} · {new Date(r.createdAt).toLocaleString(locale)}
                        </div>
                        {r.madeWith && (
                          <div>
                            <span className="font-bold text-white/80">{es ? "Hecho con" : "Made with"}:</span> {r.madeWith}
                          </div>
                        )}
                        {r.error && (
                          <div className="break-words text-danger">
                            <span className="font-bold">Error:</span> {r.error}
                          </div>
                        )}
                        <div>
                          <span className="font-bold text-white/80">{es ? "Datos usados" : "Inputs used"}:</span> {JSON.stringify(inputsFor(t.layout, sample, t.logoCreate)).slice(0, 400)}
                        </div>
                        <Link href={`/admin/templates?q=${encodeURIComponent(t.name)}`} className="inline-block text-lime">
                          ✏️ {es ? "Editar este estilo ›" : "Edit this style ›"}
                        </Link>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
