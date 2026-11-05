"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useT } from "@/i18n/client";
import { ImageDrop } from "../ImageDrop";
import { thumb } from "@/lib/thumb";
import { DEFAULT_SAMPLE, inputsFor, type Run, type Sample, type SyncCard, type SyncLeague } from "@/lib/style-test-inputs";

export type { Sample } from "@/lib/style-test-inputs";
export type TestTemplate = { id: string; name: string; layout: string; logoCreate: boolean; hasInstructions: boolean; hidden?: boolean; slug?: string };
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

const LAYOUT_NAMES: Record<string, [string, string]> = {
  PLAYER: ["Player card", "Tarjeta de jugador"],
  CHAMPIONS: ["Champions", "Campeones"],
  LINEUP: ["Lineup", "Alineación"],
  TOTW: ["Team of the week", "Equipo de la semana"],
  MATCHDAY: ["Match day", "Día de partido"],
  RESULT: ["Result", "Resultado"],
  EVENT: ["Tournament / event", "Torneo / evento"],
  STANDINGS: ["Standings", "Tabla"],
  LOGO: ["Team logo", "Logo del equipo"],
};

type ServerState = { run: Run | null; results: TestResult[]; did?: string };

const STAGE_LABEL: Record<string, [string, string]> = {
  queued: ["Getting ready", "Preparando"],
  art: ["Painting the artwork", "Pintando el arte"],
  edit: ["Editing", "Editando"],
  realism: ["Adding realism", "Agregando realismo"],
  text: ["Writing the text", "Escribiendo el texto"],
  openai: ["OpenAI is designing it", "OpenAI lo está diseñando"],
  finishing: ["Final touches", "Detalles finales"],
};

/**
 * Admin → Style test. The run itself lives on the server (a queue the cron advances every minute), so it keeps
 * generating after this page is closed; while the page is open it pokes the server so there's no waiting.
 */
export function StyleTestRunner({ templates, initialSample, initialResults, initialRun, cards = [], leagues = [] }: { templates: TestTemplate[]; initialSample: Sample | null; initialResults: TestResult[]; initialRun: Run | null; cards?: SyncCard[]; leagues?: SyncLeague[] }) {
  const { locale } = useT();
  const es = locale === "es";
  const [sample, setSample] = useState<Sample>({ ...DEFAULT_SAMPLE, ...(initialSample ?? {}) });
  const layouts = useMemo(() => [...new Set(templates.map((t) => t.layout))], [templates]);
  const [picked, setPicked] = useState<string[]>(layouts);
  const [results, setResults] = useState<TestResult[]>(initialResults);
  const [run, setRun] = useState<Run | null>(initialRun);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "READY" | "FAILED">("all");
  const [note, setNote] = useState<string | null>(null);
  const ticking = useRef(false);
  const set = (k: keyof Sample) => (e: React.ChangeEvent<HTMLInputElement>) => setSample({ ...sample, [k]: e.target.value });

  const queue = templates.filter((t) => picked.includes(t.layout));
  const needPhoto = queue.some((t) => t.layout === "PLAYER") && !sample.photoUrl;
  const needLogo = queue.some((t) => t.layout === "LOGO" && !t.logoCreate) && !sample.logoUrl;
  const running = run?.status === "running";
  const paused = run?.status === "paused";
  const processing = results.some((r) => r.status === "PROCESSING");

  function apply(d: ServerState | null) {
    if (!d) return;
    if ("run" in d) setRun(d.run);
    if (Array.isArray(d.results)) setResults(d.results);
  }

  async function call(body: Record<string, unknown> | null): Promise<ServerState | null> {
    const res = body
      ? await fetch("/api/admin/style-test", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).catch(() => null)
      : await fetch("/api/admin/style-test", { cache: "no-store" }).catch(() => null);
    if (!res) return null;
    const d = (await res.json().catch(() => null)) as (ServerState & { error?: string }) | null;
    if (!res.ok) {
      setNote(d?.error ?? `${res.status}`);
      return null;
    }
    return d;
  }

  // While a run is going (or a poster is still processing), keep in sync. A running queue is also *advanced* from
  // here so the next style starts the second the previous one finishes — the cron only has to cover closed tabs.
  useEffect(() => {
    if (!running && !paused && !processing) return;
    const t = setInterval(async () => {
      if (ticking.current) return;
      ticking.current = true;
      try {
        apply(await call(running ? { action: "advance" } : null));
      } finally {
        ticking.current = false;
      }
    }, 5000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, paused, processing]);

  async function start(list: TestTemplate[]) {
    if (!list.length || busy) return;
    setBusy(true);
    setNote(null);
    apply(await call({ action: "start", items: list.map((t) => ({ id: t.id, name: t.name, layout: t.layout, logoCreate: t.logoCreate, slug: t.slug })), sample }));
    setBusy(false);
  }
  async function control(action: "pause" | "resume" | "stop") {
    setBusy(true);
    apply(await call({ action }));
    setBusy(false);
  }

  // Styles the server refused before a poster existed (blocked text, bad input…) show up as failed too.
  const allResults = useMemo<TestResult[]>(() => {
    const skipped = (run?.skipped ?? []).map((s, i) => {
      const t = templates.find((x) => x.id === s.templateId);
      return { bannerId: `skip-${run?.id}-${i}`, templateId: s.templateId, templateName: t?.name ?? "", layout: t?.layout ?? "", status: "FAILED" as const, finalUrl: null, error: s.error, madeWith: null, seconds: 0, createdAt: s.at, run: run?.id ?? "" };
    });
    return [...results, ...skipped];
  }, [results, run, templates]);

  const latest = useMemo(() => {
    // Newest result per template.
    const m = new Map<string, TestResult>();
    for (const r of [...allResults].sort((a, b) => b.createdAt.localeCompare(a.createdAt))) if (!m.has(r.templateId)) m.set(r.templateId, r);
    return m;
  }, [allResults]);
  const shown = templates.filter((t) => picked.includes(t.layout)).map((t) => ({ t, r: latest.get(t.id) })).filter(({ r }) => filter === "all" || r?.status === filter);
  const stats = {
    ready: [...latest.values()].filter((r) => r.status === "READY").length,
    failed: [...latest.values()].filter((r) => r.status === "FAILED").length,
    avg: (() => {
      const s = [...latest.values()].filter((r) => r.status === "READY" && r.seconds);
      return s.length ? Math.round(s.reduce((a, b) => a + (b.seconds ?? 0), 0) / s.length) : 0;
    })(),
  };
  const lname = (l: string) => (LAYOUT_NAMES[l] ? LAYOUT_NAMES[l][es ? 1 : 0] : l);

  // Progress of the server run.
  const flying = run ? results.filter((r) => r.run === run.id && r.status === "PROCESSING") : [];
  const inFlight = flying.length > 0;
  const total = run?.queue.length ?? 0;
  const done = run ? Math.max(0, run.next - flying.length) : 0;
  const current = run
    ? inFlight
      ? `${flying.length > 1 ? `${flying.length} ${es ? "a la vez" : "at once"} · ` : ""}${flying.slice(0, 3).map((r) => r.templateName || templates.find((t) => t.id === r.templateId)?.name || "").filter(Boolean).join(", ")}${flying.length > 3 ? "…" : ""}`
      : running
        ? run.queue[run.next]?.name
        : undefined
    : undefined;
  const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  return (
    <div className="space-y-5">
      {/* Sample */}
      <div className="card p-4 sm:p-5">
        <div className="mb-3 text-[11px] font-bold uppercase tracking-widest text-muted">1 · {es ? "Muestra (foto, escudo y textos para todos los estilos)" : "Sample (photo, crest and texts used for every style)"}</div>
        {(cards.length > 0 || leagues.length > 0) && (
          <div className="mb-3 grid gap-2 rounded-xl border border-teal/40 bg-teal/5 p-3 sm:grid-cols-2">
            <div className="sm:col-span-2 text-[11px] font-bold uppercase tracking-wider text-teal">🔄 {es ? "Sincronizar con mis datos" : "Sync from my data"}</div>
            {cards.length > 0 && (
              <label className="block">
                <span className="mb-0.5 block text-[10px] font-bold uppercase tracking-wider text-muted">{es ? "Mi tarjeta de jugador" : "My player card"}</span>
                <select
                  className="input !py-2 text-sm"
                  defaultValue=""
                  onChange={(e) => {
                    const c = cards.find((x) => x.id === e.target.value);
                    if (c) setSample((s) => ({ ...s, ...Object.fromEntries(Object.entries(c.inputs).filter(([, v]) => v)), photoUrl: c.photoUrl || s.photoUrl, logoUrl: c.logoUrl || s.logoUrl }));
                  }}
                >
                  <option value="">{es ? "— Elegir —" : "— Pick one —"}</option>
                  {cards.map((c) => (
                    <option key={c.id} value={c.id}>{c.label}</option>
                  ))}
                </select>
              </label>
            )}
            {leagues.length > 0 && (
              <label className="block">
                <span className="mb-0.5 block text-[10px] font-bold uppercase tracking-wider text-muted">{es ? "Mi liga (tabla y escudos)" : "My league (table and crests)"}</span>
                <select
                  className="input !py-2 text-sm"
                  value={leagues.find((l) => l.standings.join("|") === (sample.standings ?? []).join("|"))?.id ?? ""}
                  onChange={(e) => {
                    const l = leagues.find((x) => x.id === e.target.value);
                    setSample((s) =>
                      l
                        ? { ...s, competition: l.name, leagueLogo: l.logoUrl, standings: l.standings, tableLogos: l.tableLogos, qualify: l.qualify, team: l.teams[0]?.name || s.team, rival: l.teams[1]?.name || s.rival, date: l.date || s.date }
                        : { ...s, leagueLogo: "", standings: [], tableLogos: [], qualify: "" },
                    );
                  }}
                >
                  <option value="">{es ? "— Ninguna (tabla de ejemplo) —" : "— None (sample table) —"}</option>
                  {leagues.map((l) => (
                    <option key={l.id} value={l.id}>{l.name} · {l.standings.length} {es ? "equipos" : "teams"}</option>
                  ))}
                </select>
              </label>
            )}
            <p className="sm:col-span-2 text-[11px] text-muted">
              {es
                ? "La tarjeta llena foto, escudo y textos. La liga pone su logo, su tabla real (posiciones de clasificación) y los escudos en Clasificación, Equipo de la semana y Eventos."
                : "A card fills the photo, crest and texts. A league puts its logo, its real table (with how many advance) and the club crests into Standings, Team of the week and Events."}
            </p>
          </div>
        )}
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
        <div className="mt-3">
          <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-muted">{es ? "Colores de la prueba" : "Colors for the test"}</span>
          <div className="flex flex-wrap gap-1.5">
            {(
              [
                ["template", es ? "🎨 Del estilo" : "🎨 Style's own", es ? "cada estilo con sus propios colores" : "each style in its own colors"],
                ["team", es ? "🛡️ Del escudo" : "🛡️ From the crest", es ? "lo que reciben los usuarios por defecto" : "what users get by default"],
                ["surprise", es ? "🎲 Únicos" : "🎲 Unique", es ? "paleta nueva en cada póster" : "new palette every poster"],
              ] as const
            ).map(([id, label, sub]) => {
              const on = (sample.colorMode ?? "template") === id;
              return (
                <button key={id} type="button" onClick={() => setSample({ ...sample, colorMode: id })} className={`rounded-xl border px-3 py-1.5 text-left transition ${on ? "border-lime bg-lime/10" : "border-line bg-panel-2"}`}>
                  <span className={`block text-xs font-bold ${on ? "text-lime" : ""}`}>{label}</span>
                  <span className="block text-[10px] text-muted">{sub}</span>
                </button>
              );
            })}
          </div>
          <p className="mt-1.5 text-[11px] text-muted">
            {es
              ? "“Del escudo” tiñe todos los estilos con los colores del escudo de prueba (un escudo dorado → todo dorado). Para ver cómo es cada estilo de verdad, usa “Del estilo”."
              : "“From the crest” paints every style in the test crest's colors (a gold crest → everything gold). To see what each style really looks like, use “Style's own”."}
          </p>
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
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted">{es ? "A la vez" : "At once"}</span>
          {([1, 3, 5, 10, 0] as const).map((n) => {
            const on = (sample.parallel ?? 0) === n;
            return (
              <button key={n} type="button" onClick={() => setSample({ ...sample, parallel: n })} className={`rounded-full border px-3 py-1 text-xs font-bold transition ${on ? "border-lime bg-lime text-ink" : "border-line bg-panel-2 text-muted"}`}>
                {n === 0 ? (es ? "Todos" : "All") : n}
              </button>
            );
          })}
          <span className="text-[11px] text-muted">{es ? "Si la IA limita el ritmo (429), se reintentan solos un minuto después." : "If the AI rate-limits (429), they retry by themselves a minute later."}</span>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          {running || paused ? (
            <>
              {running ? (
                <button type="button" onClick={() => control("pause")} disabled={busy} className="btn-ghost px-5 py-2.5 disabled:opacity-50">
                  ⏸ {es ? "Pausar" : "Pause"}
                </button>
              ) : (
                <button type="button" onClick={() => control("resume")} disabled={busy} className="btn-primary px-5 py-2.5 disabled:opacity-50">
                  ▶ {es ? "Reanudar" : "Resume"}
                </button>
              )}
              <button type="button" onClick={() => control("stop")} disabled={busy} className="btn-danger px-5 py-2.5 disabled:opacity-50">
                ⏹ {es ? "Parar" : "Stop"}
              </button>
            </>
          ) : (
            <button type="button" onClick={() => start(queue)} disabled={busy || !queue.length || needPhoto || needLogo} className="btn-primary px-5 py-2.5 disabled:opacity-50">
              ▶ {es ? `Generar todos (${queue.length} estilos)` : `Generate all (${queue.length} styles)`}
            </button>
          )}
          {!running && stats.failed > 0 && (
            <button type="button" onClick={() => start(templates.filter((t) => latest.get(t.id)?.status === "FAILED"))} disabled={busy} className="btn-ghost px-4 py-2.5 text-sm disabled:opacity-50">
              🔁 {es ? `Reintentar los fallidos (${stats.failed})` : `Retry failed (${stats.failed})`}
            </button>
          )}
          <span className="text-xs text-muted">
            {running || paused
              ? es
                ? "El póster que se está haciendo termina igual; Pausar guarda la cola, Parar la cierra."
                : "The poster being made now still finishes; Pause keeps the queue, Stop ends the round."
              : es
                ? "Gratis para el admin · ~1–3 min por póster"
                : "Free for admin · ~1–3 min per poster"}
          </span>
        </div>
        <p className="mt-2 text-xs text-teal">☁️ {es ? "Corre en el servidor: puedes cerrar esta página y sigue generando. Vuelve cuando quieras a ver los resultados." : "Runs on the server: you can close this page and it keeps generating. Come back any time to see the results."}</p>
        {needPhoto && <p className="mt-2 text-xs text-amber-200">⚠️ {es ? "Las tarjetas de jugador necesitan la foto de prueba." : "Player cards need the test photo."}</p>}
        {needLogo && <p className="mt-2 text-xs text-amber-200">⚠️ {es ? "Los estilos de “mostrar mi logo” necesitan el escudo de prueba." : "“Show off my logo” styles need the test crest."}</p>}
        {note && <p className="mt-2 text-xs text-danger">{note}</p>}
        {run && total > 0 && (
          <div className="mt-4">
            <div className="mb-1 flex justify-between gap-3 text-xs text-muted">
              <span className="truncate">
                {running ? `${es ? "Generando" : "Generating"}: ${current ?? "…"}` : paused ? `⏸ ${es ? "En pausa" : "Paused"}${inFlight ? ` · ${es ? "terminando" : "finishing"} ${current ?? ""}` : ""}` : run.status === "stopped" ? (es ? "Parado" : "Stopped") : es ? "Terminado" : "Finished"}
                {running && !inFlight && <span className="opacity-70"> · {es ? "arrancando el siguiente…" : "starting the next one…"}</span>}
              </span>
              <span className="shrink-0">
                {done} / {total}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full bg-gradient-to-r from-lime/60 via-lime to-white transition-all" style={{ width: `${total ? (done / total) * 100 : 0}%` }} />
            </div>
            <div className="mt-1 text-[10px] text-muted">
              {es ? "Empezó" : "Started"} {new Date(run.startedAt).toLocaleString(locale)} · {running ? (es ? "el servidor sigue aunque cierres la página" : "the server keeps going even if you close the page") : paused ? (es ? "pulsa Reanudar para seguir donde quedó" : "press Resume to carry on where it left off") : es ? "listo para otra ronda" : "ready for another round"}
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
              ✅ {stats.ready} · ❌ {stats.failed} · ⏱ {es ? "promedio" : "avg"} {stats.avg ? mmss(stats.avg) : "—"}
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
          {shown.map(({ t, r }) => {
            const queued = (running || paused) && !!run && run.queue.slice(run.next).some((q) => q.id === t.id);
            return (
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
                        {r.stage ? (STAGE_LABEL[r.stage] ? STAGE_LABEL[r.stage][es ? 1 : 0] : r.stage) + "…" : es ? "Generando…" : "Generating…"}
                      </span>
                    ) : r?.status === "FAILED" ? (
                      <span className="text-danger">❌ {es ? "Falló" : "Failed"}</span>
                    ) : queued ? (
                      <span>⏳ {es ? "en cola" : "queued"}</span>
                    ) : (
                      <span>— {es ? "sin generar" : "not generated yet"} —</span>
                    )}
                  </div>
                )}
                <div className="p-2.5">
                  <div className="truncate text-sm font-bold">{t.name}{t.hidden ? <span className="ml-1 rounded bg-white/10 px-1 text-[9px] font-bold uppercase text-muted">{es ? "oculto" : "hidden"}</span> : null}</div>
                  <div className="truncate text-[11px] text-muted">
                    {lname(t.layout)}
                    {r?.seconds ? ` · ⏱ ${mmss(r.seconds)}` : ""}
                  </div>
                  {r?.madeWith && (
                    <div className="mt-1 truncate text-[10px] text-teal" title={r.madeWith}>
                      🤖 {r.madeWith}
                    </div>
                  )}
                  {r?.status === "FAILED" && r.error && (
                    <div className="mt-1 line-clamp-2 text-[10px] text-danger" title={r.error}>
                      {r.error}
                    </div>
                  )}
                  <div className="mt-2 flex items-center gap-2">
                    <button type="button" onClick={() => setOpen(open === t.id ? null : t.id)} className="text-[11px] font-bold text-muted hover:text-white">
                      {open === t.id ? (es ? "Ocultar" : "Hide") : es ? "Detalles" : "Details"}
                    </button>
                    {!queued && r?.status !== "PROCESSING" && (
                      <button type="button" onClick={() => start([t])} disabled={busy} className="text-[11px] font-bold text-lime disabled:opacity-50">
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
                    <div className="mt-2 space-y-1 border-t border-line pt-2 text-[10px] text-muted [overflow-wrap:anywhere]">
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
            );
          })}
        </div>
      </div>
    </div>
  );
}
