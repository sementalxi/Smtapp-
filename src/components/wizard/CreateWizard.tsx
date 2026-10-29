"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useT } from "@/i18n/client";
import type { ClientTemplate } from "@/lib/samples";
import { BannerInputs, EMPTY_INPUTS, LayoutKind } from "@/lib/templates";
import { ART_TYPES, BG_POSES, BG_SCENES, PALETTES, FONT_STYLES, LANGUAGES, TROPHY_STYLES } from "@/lib/pro-options";
import { TemplateThumb } from "../TemplateThumb";
import { ImageDrop } from "../ImageDrop";
import { SavedPicker, type SavedItem } from "./SavedPicker";
import { DownloadSizes } from "../DownloadSizes";

const FORMATIONS = ["4-3-3", "4-4-2", "4-2-3-1", "4-1-2-1-2", "3-5-2", "3-4-3", "5-3-2", "4-5-1"];
const FONT_VAR: Record<string, string> = {
  anton: "var(--nf-anton)",
  bebas: "var(--nf-bebas)",
  gothic: "var(--nf-gothic)",
  brush: "var(--nf-brush)",
  sans: "var(--nf-sans)",
};

const TXT = {
  en: {
    steps: ["Type", "Style", "Details", "Fonts & colors", "Generate"],
    stepSub: ["What are you making?", "Choose the visual", "Fill in the details", "Typography and color", "Generate and download"],
    next: "Next",
    back: "Back",
    photo: "Player photo",
    photoOpt: "Photo (optional) — a player to feature",
    team: "Team",
    home: "Home team",
    away: "Away team",
    champ: "Championship / competition",
    name: "Player name / gamertag",
    position: "Position",
    number: "Number",
    tagline: "Small top word (e.g. WELCOME, MVP)",
    subtitle: "Accent line",
    footer: "Bottom line (league, edition)",
    date: "Date",
    time: "Kick-off time",
    venue: "Venue / platform",
    formation: "Formation",
    players: "Players — one per line: number name position",
    playersPh: "1 Bryant GK\n2 Nesta1 RB\n4 Silent54 CB\n…",
    squad: "List of champion players (one per line or comma-separated)",
    squadPh: "xChrome, Vernos7, AceKing, ProMan…",
    trophy: "Trophy style",
    trophyUpload: "…or upload your own trophy image",
    prize: "Prize",
    homeScore: "Home goals",
    awayScore: "Away goals",
    scorers: "Goal scorers (one per line)",
    headline: "Headline",
    title: "Event title",
    details: "Times / details",
    extra: "Extra idea for the AI (optional)",
    extraPh: "e.g. lightning, snow, golden crown",
    lang: "Text language",
    langHint: "Team, player and competition names are always kept exactly as you typed them.",
    primary: "Primary style (titles, highlight)",
    secondary: "Secondary style (names, numbers, text)",
    pick: "Select a style…",
    preview: "Preview",
    generate: "Generate art",
    finish: "Finish",
    artType: "Art type",
    status: "Status",
    creditsUsed: "Credits used",
    balance: "Your balance",
    download: "Download",
    edit: "Edit text / new version",
    another: "Create another",
    needCredits: "Not enough credits",
    getCredits: "Get credits",
    stages: ["Planning art…", "Generating background…", "Adding elements…", "Applying visual effects…", "Finalizing image…"],
    wait: "This may take a minute or two — keep this page open.",
    completed: "Completed",
    generating: "Generating…",
    failed: "Failed — credits refunded",
    noPro: "Pro AI isn't set up yet. Add OPENAI_API_KEY in Vercel.",
    required: "Fill in the required fields (*) to continue.",
  },
  es: {
    steps: ["Tipo", "Estilo", "Detalles", "Fuentes y colores", "Generar"],
    stepSub: ["¿Qué vas a crear?", "Elige el visual", "Completa los detalles", "Tipografía y color", "Genera y descarga"],
    next: "Siguiente",
    back: "Atrás",
    photo: "Foto del jugador",
    photoOpt: "Foto (opcional) — un jugador destacado",
    team: "Equipo",
    home: "Equipo local",
    away: "Equipo visitante",
    champ: "Torneo / competición",
    name: "Nombre / gamertag",
    position: "Posición",
    number: "Número",
    tagline: "Palabra superior (ej. WELCOME, MVP)",
    subtitle: "Línea de acento",
    footer: "Línea inferior (liga, edición)",
    date: "Fecha",
    time: "Hora",
    venue: "Lugar / plataforma",
    formation: "Formación",
    players: "Jugadores — uno por línea: número nombre posición",
    playersPh: "1 Bryant POR\n2 Nesta1 LD\n4 Silent54 DFC\n…",
    squad: "Lista de jugadores campeones (uno por línea o separados por coma)",
    squadPh: "xChrome, Vernos7, AceKing, ProMan…",
    trophy: "Estilo de trofeo",
    trophyUpload: "…o sube la imagen de tu trofeo",
    prize: "Premio",
    homeScore: "Goles local",
    awayScore: "Goles visitante",
    scorers: "Goleadores (uno por línea)",
    headline: "Titular",
    title: "Título del evento",
    details: "Horarios / detalles",
    extra: "Idea extra para la IA (opcional)",
    extraPh: "ej. rayos, nieve, corona dorada",
    lang: "Idioma del texto",
    langHint: "Los nombres de equipos, jugadores y torneos se mantienen exactamente como los escribes.",
    primary: "Estilo principal (títulos)",
    secondary: "Estilo secundario (nombres, números, texto)",
    pick: "Elige un estilo…",
    preview: "Vista previa",
    generate: "Generar arte",
    finish: "Final",
    artType: "Tipo de arte",
    status: "Estado",
    creditsUsed: "Créditos usados",
    balance: "Tu saldo",
    download: "Descargar",
    edit: "Editar texto / nueva versión",
    another: "Crear otro",
    needCredits: "No tienes créditos suficientes",
    getCredits: "Conseguir créditos",
    stages: ["Planeando el arte…", "Generando el fondo…", "Añadiendo elementos…", "Aplicando efectos…", "Finalizando imagen…"],
    wait: "Puede tardar uno o dos minutos — no cierres esta página.",
    completed: "Completado",
    generating: "Generando…",
    failed: "Falló — créditos devueltos",
    noPro: "La IA Pro aún no está configurada. Agrega OPENAI_API_KEY en Vercel.",
    required: "Completa los campos obligatorios (*) para continuar.",
  },
};

const lines = (s: string) => s.split(/\n|,/).map((x) => x.trim()).filter(Boolean);

const SWATCHES = [
  "#e10600", "#ff5a1f", "#ffb800", "#ffd35a", "#b6ff1a", "#0fbf6b", "#00a88f", "#00e5ff",
  "#1d5bff", "#1a2f7a", "#7b2cff", "#ff2bd6", "#ff3d8b", "#8b0000", "#ffffff", "#c0c7d1", "#111111",
];

export function CreateWizard({
  templates,
  credits: initialCredits,
  cost,
  proEnabled,
  initialLayout,
}: {
  templates: ClientTemplate[];
  credits: number;
  cost: number;
  proEnabled: boolean;
  initialLayout?: LayoutKind;
}) {
  const { locale } = useT();
  const L = TXT[locale === "es" ? "es" : "en"];
  const [step, setStep] = useState(initialLayout ? 2 : 1);
  const [layout, setLayout] = useState<LayoutKind>(initialLayout ?? "PLAYER");
  const styles = useMemo(() => templates.filter((t) => t.layout === layout), [templates, layout]);
  const [tplId, setTplId] = useState<string | null>(null);
  const tpl = styles.find((t) => t.id === tplId) ?? null;

  const [inp, setInp] = useState<BannerInputs>({ ...EMPTY_INPUTS, language: locale === "es" ? "Español" : "English" });
  const set = <K extends keyof BannerInputs>(k: K, v: BannerInputs[K]) => setInp((x) => ({ ...x, [k]: v }));
  const [photo, setPhoto] = useState<string | null>(null);
  const [team, setTeam] = useState<SavedItem | null>(null);
  const [home, setHome] = useState<SavedItem | null>(null);
  const [away, setAway] = useState<SavedItem | null>(null);
  const [champ, setChamp] = useState<SavedItem | null>(null);
  const [playersText, setPlayersText] = useState("");
  const [squadText, setSquadText] = useState("");
  const [scorersText, setScorersText] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [aiMsg, setAiMsg] = useState("");
  const [undoText, setUndoText] = useState<BannerInputs | null>(null);

  const [credits, setCredits] = useState(initialCredits);
  const [phase, setPhase] = useState<"idle" | "busy" | "done" | "error">("idle");
  const [stage, setStage] = useState(0);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ id: string; url: string | null } | null>(null);

  useEffect(() => {
    if (!styles.some((s) => s.id === tplId)) setTplId(styles[0]?.id ?? null);
  }, [styles, tplId]);

  // Fake-but-honest progress: advances through the stages while the AI works.
  useEffect(() => {
    if (phase !== "busy") return;
    setStage(0);
    const marks = [6, 30, 55, 80];
    const timers = marks.map((s, i) => setTimeout(() => setStage(i + 1), s * 1000));
    return () => timers.forEach(clearTimeout);
  }, [phase]);

  const art = ART_TYPES.find((a) => a.layout === layout)!;
  const artName = locale === "es" ? art.es.name : art.en.name;

  // Compose the final inputs from the pickers and text areas.
  function finalInputs(): BannerInputs {
    return {
      ...inp,
      color1: inp.colorMode === "custom" ? inp.color1 || "#1d5bff" : inp.color1,
      color2: inp.colorMode === "custom" ? inp.color2 || "#ffd35a" : inp.color2,
      team: team?.name ?? inp.team,
      homeTeam: home?.name ?? inp.homeTeam,
      awayTeam: away?.name ?? inp.awayTeam,
      homeLogoUrl: home?.logoUrl ?? "",
      awayLogoUrl: away?.logoUrl ?? "",
      eventName: champ?.name ?? inp.eventName,
      competition: champ?.name ?? inp.competition,
      champLogoUrl: champ?.logoUrl ?? "",
      players: lines(playersText).slice(0, 18),
      roster: lines(squadText).slice(0, 30),
      scorers: lines(scorersText).slice(0, 12),
    };
  }

  function detailsValid() {
    switch (layout) {
      case "PLAYER":
        return !!photo && !!inp.name.trim();
      case "CHAMPIONS":
        return !!team;
      case "MATCHDAY":
      case "RESULT":
        return !!home && !!away;
      case "LINEUP":
        return !!team && lines(playersText).length > 0;
      case "EVENT":
        return !!inp.headline.trim();
    }
  }

  async function improveText() {
    const es = locale === "es";
    setAiBusy(true);
    setAiMsg("");
    const before = inp;
    const res = await fetch("/api/ai-text", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        layout,
        language: inp.language || (es ? "Español" : "English"),
        inputs: Object.fromEntries(
          Object.entries(finalInputs()).filter(([, v]) => typeof v === "string" && v && !/^https?:|^\/api\//.test(v)),
        ),
      }),
    });
    const data = await res.json().catch(() => ({}));
    setAiBusy(false);
    if (res.ok && data.fields && Object.keys(data.fields).length) {
      setUndoText(before);
      setInp((x) => ({ ...x, ...data.fields }));
      setAiMsg(es ? "¡Listo! Revisa y edita lo que quieras." : "Done! Check it and edit anything you like.");
    } else {
      setAiMsg(
        data.error === "too_many_requests"
          ? es ? "Demasiados intentos, espera un poco." : "Too many tries, wait a bit."
          : es ? "La IA no pudo mejorar el texto, intenta otra vez." : "The AI couldn't improve the text, try again.",
      );
    }
  }

  async function generate() {
    setPhase("busy");
    setError("");
    const res = await fetch("/api/banners", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        templateId: tpl?.id,
        inputs: finalInputs(),
        photoUrl: photo,
        logoUrl: team?.logoUrl ?? null,
        mode: "PRO",
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.id) {
      setResult({ id: data.id, url: data.finalUrl ?? null });
      setCredits((c) => c - cost);
      setStage(5);
      setPhase("done");
    } else {
      const msg =
        data.error === "err_credits"
          ? L.needCredits
          : data.error === "err_blocked"
            ? (locale === "es" ? "Ese contenido no está permitido." : "That content isn't allowed.") + (data.detail ? ` — ${data.detail}` : "")
            : (locale === "es" ? "Algo salió mal." : "Something went wrong.") + (data.detail ? ` — ${data.detail}` : "");
      setError(msg);
      setPhase("error");
    }
  }

  function reset() {
    setResult(null);
    setPhase("idle");
    setStep(1);
  }

  if (!proEnabled) return <p className="card p-6 text-sm text-amber-200">{L.noPro}</p>;

  // ── UI ─────────────────────────────────────────────────
  const Stepper = (
    <div className="mb-6">
      <div className="flex items-center">
        {L.steps.map((_, i) => {
          const n = i + 1;
          const done = n < step || phase === "done";
          const active = n === step;
          return (
            <div key={n} className="flex flex-1 items-center last:flex-none">
              <span
                className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm font-bold ${
                  done ? "bg-lime text-ink" : active ? "border-2 border-lime text-lime" : "border border-line text-muted"
                }`}
              >
                {done ? "✓" : n}
              </span>
              {n < 5 && <span className={`mx-1 h-0.5 flex-1 ${n < step ? "bg-lime" : "bg-line"}`} />}
            </div>
          );
        })}
      </div>
      <div className="mt-3 text-center">
        <div className="font-bold">{L.steps[step - 1]}</div>
        <div className="text-xs text-muted">{L.stepSub[step - 1]}</div>
      </div>
    </div>
  );

  const nav = ({ canNext, onNext, nextLabel }: { canNext: boolean; onNext: () => void; nextLabel?: string }) => (
    <div className="mt-6 flex items-center justify-between">
      {step > 1 ? (
        <button type="button" className="text-sm text-muted hover:text-white" onClick={() => setStep(step - 1)}>
          ‹ {L.back}
        </button>
      ) : (
        <span />
      )}
      <button type="button" className="btn-primary" disabled={!canNext} onClick={onNext}>
        {nextLabel ?? L.next} ›
      </button>
    </div>
  );

  const field = ({ label, k, req, max = 40, ph }: { label: string; k: keyof BannerInputs; req?: boolean; max?: number; ph?: string }) => (
    <div>
      <label className="label">
        {label} {req && <span className="text-lime">*</span>}
      </label>
      <input className="input" maxLength={max} placeholder={ph} value={inp[k] as string} onChange={(e) => set(k, e.target.value as never)} />
    </div>
  );

  return (
    <div className="mx-auto max-w-2xl">
      {Stepper}

      {step === 1 && (
        <div className="card p-5">
          <div className="space-y-3">
            {ART_TYPES.map((a) => (
              <button
                key={a.layout}
                type="button"
                onClick={() => { setLayout(a.layout); setStep(2); }}
                className={`flex w-full items-center gap-4 rounded-xl border p-4 text-left transition ${
                  a.layout === layout ? "border-lime bg-lime/5" : "border-line bg-panel-2 hover:border-muted"
                }`}
              >
                <span className="text-3xl">{a.icon}</span>
                <span className="min-w-0 flex-1">
                  <span className="block font-bold">{locale === "es" ? a.es.name : a.en.name}</span>
                  <span className="block text-xs text-muted">{locale === "es" ? a.es.desc : a.en.desc}</span>
                  <span className="mt-1 block text-xs text-lime">{cost} {locale === "es" ? "créditos" : "credits"}</span>
                </span>
                <span className="text-muted">›</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="card p-5">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {styles.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setTplId(s.id)}
                className={`overflow-hidden rounded-xl border-2 text-left transition ${s.id === tplId ? "border-lime" : "border-transparent opacity-80 hover:opacity-100"}`}
              >
                <TemplateThumb template={s} />
                <div className="bg-panel-2 px-2 py-1.5 text-xs font-bold">{locale === "es" ? s.nameEs : s.name}</div>
              </button>
            ))}
          </div>
          {styles.length === 0 && <p className="text-sm text-muted">{locale === "es" ? "Aún no hay estilos para este tipo." : "No styles for this type yet."}</p>}
          <p className="mt-4 text-xs text-muted">
            {locale === "es"
              ? "Las miniaturas son una referencia. El arte final lo crea la IA con tus colores, escudos y textos."
              : "Thumbnails are for reference. The final art is created by the AI with your colors, crests and text."}
          </p>
          {nav({ canNext: !!tpl, onNext: () => setStep(3) })}
        </div>
      )}

      {step === 3 && (
        <div className="card space-y-4 p-5">
          {layout === "PLAYER" && (
            <>
              <ImageDrop kind="photo" label={`${L.photo} *`} value={photo} onChange={setPhoto} searchQuery={[inp.name, inp.team].filter(Boolean).join(" ")} />
              <div>
                <span className="label">{locale === "es" ? "Segunda imagen del jugador (fondo, creada por la IA)" : "Second player image (background, made by AI)"}</span>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {BG_POSES.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => set("bgPose", p.id)}
                      className={`rounded-lg border px-3 py-2.5 text-left text-sm ${(inp.bgPose || "closeup") === p.id ? "border-lime bg-lime/5" : "border-line bg-panel-2"}`}
                    >
                      {locale === "es" ? p.es : p.en}
                    </button>
                  ))}
                </div>
                <p className="mt-1 text-xs text-muted">
                  {locale === "es"
                    ? "La IA crea una pose nueva del mismo jugador para el fondo, en el mismo estilo del póster."
                    : "The AI creates a new pose of the same player for the background, in the same style as the poster."}
                </p>
              </div>
              <SavedPicker kind="team" label={L.team} value={team} onChange={setTeam} />
              {field({ label: L.name, k: "name", req: true })}
              <div className="grid grid-cols-2 gap-3">
                {field({ label: L.position, k: "position", max: 24, ph: "ST · CAM | OM" })}
                {field({ label: L.number, k: "number", max: 4 })}
              </div>
              {field({ label: L.tagline, k: "tagline", max: 30 })}
              {field({ label: L.subtitle, k: "subtitle" })}
            </>
          )}

          {layout === "CHAMPIONS" && (
            <>
              <SavedPicker kind="team" label={L.team} value={team} onChange={setTeam} required />
              <SavedPicker kind="championship" label={L.champ} value={champ} onChange={setChamp} />
              {field({ label: L.date, k: "date", max: 30, ph: "Nov 2026" })}
              <div>
                <span className="label">{L.trophy}</span>
                <div className="grid grid-cols-2 gap-2">
                  {TROPHY_STYLES.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => set("trophy", t.id)}
                      className={`rounded-lg border px-3 py-2.5 text-left text-sm ${inp.trophy === t.id && !inp.trophyUrl ? "border-lime bg-lime/5" : "border-line bg-panel-2"}`}
                    >
                      🏆 {t.label}
                    </button>
                  ))}
                </div>
              </div>
              <ImageDrop kind="logo" label={L.trophyUpload} value={inp.trophyUrl || null} onChange={(u) => set("trophyUrl", u ?? "")} />
              <div>
                <label className="label">{L.squad}</label>
                <textarea className="input min-h-28" placeholder={L.squadPh} value={squadText} onChange={(e) => setSquadText(e.target.value)} />
              </div>
              {field({ label: L.prize, k: "prize", max: 24, ph: "$200 PRIZE" })}
              <ImageDrop kind="photo" label={L.photoOpt} value={photo} onChange={setPhoto} />
            </>
          )}

          {(layout === "MATCHDAY" || layout === "RESULT") && (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <SavedPicker kind="team" label={L.home} value={home} onChange={setHome} required />
                <SavedPicker kind="team" label={L.away} value={away} onChange={setAway} required />
              </div>
              <SavedPicker kind="championship" label={L.champ} value={champ} onChange={setChamp} />
              {layout === "MATCHDAY" ? (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    {field({ label: L.date, k: "date", max: 30, ph: "Fri · Nov 6" })}
                    {field({ label: L.time, k: "time", max: 20, ph: "9:00 PM EST" })}
                  </div>
                  {field({ label: L.venue, k: "venue", max: 48, ph: "EA FC 27 · Pro Clubs" })}
                </>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    {field({ label: L.homeScore, k: "homeScore", max: 3 })}
                    {field({ label: L.awayScore, k: "awayScore", max: 3 })}
                  </div>
                  <div>
                    <label className="label">{L.scorers}</label>
                    <textarea className="input min-h-24" value={scorersText} onChange={(e) => setScorersText(e.target.value)} placeholder={"Krypto 12'\nSantxz 45+1'"} />
                  </div>
                </>
              )}
              <ImageDrop kind="photo" label={L.photoOpt} value={photo} onChange={setPhoto} />
            </>
          )}

          {layout === "LINEUP" && (
            <>
              <SavedPicker kind="team" label={L.team} value={team} onChange={setTeam} required />
              <SavedPicker kind="championship" label={L.champ} value={champ} onChange={setChamp} />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">{L.formation}</label>
                  <select className="input" value={inp.formation} onChange={(e) => set("formation", e.target.value)}>
                    <option value="">—</option>
                    {FORMATIONS.map((f) => (
                      <option key={f}>{f}</option>
                    ))}
                  </select>
                </div>
                {field({ label: L.date, k: "date", max: 30, ph: "Matchday 7" })}
              </div>
              <div>
                <label className="label">
                  {L.players} <span className="text-lime">*</span>
                </label>
                <textarea className="input min-h-56 font-mono text-xs" placeholder={L.playersPh} value={playersText} onChange={(e) => setPlayersText(e.target.value)} />
                <p className="mt-1 text-xs text-muted">{lines(playersText).length}/11</p>
              </div>
            </>
          )}

          {layout === "EVENT" && (
            <>
              {field({ label: L.headline, k: "headline", req: true, max: 30, ph: "$100 WINNER" })}
              {field({ label: L.title, k: "name", ph: "1v1 Ultimate Team" })}
              {field({ label: L.subtitle, k: "subtitle", ph: "Free Entry" })}
              <div className="grid grid-cols-2 gap-3">
                {field({ label: L.date, k: "date", max: 30 })}
                {field({ label: L.details, k: "details", max: 48, ph: "8 PM · 9 PM" })}
              </div>
              {field({ label: L.prize, k: "prize", max: 24 })}
              <SavedPicker kind="team" label={L.team} value={team} onChange={setTeam} />
              <ImageDrop kind="photo" label={L.photoOpt} value={photo} onChange={setPhoto} />
            </>
          )}

          {field({ label: L.footer, k: "footer", max: 48 })}
          <div className="rounded-xl border border-lime/40 bg-lime/5 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" className="btn-primary" disabled={aiBusy} onClick={improveText}>
                {aiBusy ? "…" : `✨ ${locale === "es" ? "Mejorar mi texto con IA" : "Improve my text with AI"}`}
              </button>
              {undoText && !aiBusy && (
                <button
                  type="button"
                  className="btn-ghost px-3 py-2 text-xs"
                  onClick={() => {
                    setInp(undoText);
                    setUndoText(null);
                    setAiMsg("");
                  }}
                >
                  ↩ {locale === "es" ? "Deshacer" : "Undo"}
                </button>
              )}
            </div>
            <p className="mt-2 text-xs text-muted">
              {aiMsg ||
                (locale === "es"
                  ? "La IA escribe frases con más estilo (títulos, lemas, línea inferior). Gratis — tus nombres no cambian. Tócalo otra vez para otra idea."
                  : "The AI writes catchier lines (titles, taglines, bottom line). Free — your names stay the same. Tap again for another idea.")}
            </p>
            <label className="mt-3 flex cursor-pointer items-start gap-2 text-sm">
              <input
                type="checkbox"
                className="mt-1 accent-[var(--color-lime)]"
                checked={inp.aiCopy !== "off"}
                onChange={(e) => set("aiCopy", e.target.checked ? "on" : "off")}
              />
              <span>
                {locale === "es"
                  ? "Dejar que la IA agregue 1–2 palabras de impacto en el póster (ej. NUEVO FICHAJE, MVP)"
                  : "Let the AI add 1–2 hype words on the poster (e.g. NEW SIGNING, MVP)"}
              </span>
            </label>
          </div>
          {field({ label: L.extra, k: "extraPrompt", max: 200, ph: L.extraPh })}
          {!detailsValid() && <p className="text-xs text-muted">{L.required}</p>}
          {nav({ canNext: !!detailsValid(), onNext: () => setStep(4) })}
        </div>
      )}

      {step === 4 && (
        <div className="card space-y-4 p-5">
          <div>
            <span className="label">{locale === "es" ? "Fondo" : "Background"}</span>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {[{ id: "", icon: "🎲", en: "Surprise me", es: "Sorpréndeme" }, ...BG_SCENES].map((b) => (
                <button
                  key={b.id || "surprise"}
                  type="button"
                  onClick={() => set("bgScene", b.id)}
                  className={`rounded-lg border px-3 py-2.5 text-left text-sm ${inp.bgScene === b.id ? "border-lime bg-lime/5" : "border-line bg-panel-2"}`}
                >
                  {b.icon} {locale === "es" ? b.es : b.en}
                </button>
              ))}
            </div>
            <p className="mt-1 text-xs text-muted">
              {locale === "es"
                ? "La IA crea un escenario detallado y realista detrás de tu diseño."
                : "The AI builds a detailed, realistic scene behind your design."}
            </p>
          </div>
          <div>
            <label className="label">{L.lang}</label>
            <select className="input" value={inp.language} onChange={(e) => set("language", e.target.value)}>
              {LANGUAGES.map((l) => (
                <option key={l}>{l}</option>
              ))}
            </select>
            <p className="mt-1 text-xs text-muted">{L.langHint}</p>
          </div>
          {(["fontPrimary", "fontSecondary"] as const).map((k) => (
            <div key={k}>
              <label className="label">
                {k === "fontPrimary" ? L.primary : L.secondary} {k === "fontPrimary" && <span className="text-lime">*</span>}
              </label>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {FONT_STYLES.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => set(k, f.id)}
                    className={`rounded-lg border px-3 py-2.5 text-left ${inp[k] === f.id ? "border-lime bg-lime/5" : "border-line bg-panel-2"}`}
                  >
                    <span className={`block text-lg leading-tight ${f.previewClass}`} style={{ fontFamily: FONT_VAR[f.preview] }}>
                      {f.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ))}
          <div>
            <span className="label">{locale === "es" ? "Colores" : "Colors"}</span>
            <div className="grid grid-cols-3 gap-2">
              {([
                ["surprise", locale === "es" ? "🎲 Únicos" : "🎲 Unique", locale === "es" ? "Paleta nueva en cada póster" : "New palette every poster"],
                ["template", locale === "es" ? "🎨 Del estilo" : "🎨 Style's own", locale === "es" ? "Colores del estilo elegido" : "Colors of the chosen style"],
                ["custom", locale === "es" ? "✏️ Los míos" : "✏️ My colors", locale === "es" ? "Ej. colores del equipo" : "e.g. team colors"],
              ] as const).map(([id, label, sub]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => set("colorMode", id)}
                  className={`rounded-lg border px-3 py-2.5 text-left ${(inp.colorMode || "surprise") === id ? "border-lime bg-lime/5" : "border-line bg-panel-2"}`}
                >
                  <span className="block text-sm font-bold">{label}</span>
                  <span className="block text-[11px] text-muted">{sub}</span>
                </button>
              ))}
            </div>
            <div className="mt-3">
              <span className="text-xs text-muted">{locale === "es" ? "Paletas listas — toca una:" : "Ready palettes — tap one:"}</span>
              <div className="mt-1.5 grid grid-cols-4 gap-2 sm:grid-cols-8">
                {PALETTES.map(([name, c1, c2, dark]) => {
                  const on = inp.colorMode === "custom" && inp.color1 === c1 && inp.color2 === c2;
                  return (
                    <button
                      key={name}
                      type="button"
                      title={name}
                      onClick={() => setInp((x) => ({ ...x, colorMode: "custom", color1: c1, color2: c2 }))}
                      className={`h-11 overflow-hidden rounded-lg border-2 ${on ? "border-white" : "border-line"}`}
                      style={{ background: `linear-gradient(135deg, ${c1} 0 45%, ${c2} 45% 75%, ${dark} 75%)` }}
                    />
                  );
                })}
              </div>
            </div>
            {inp.colorMode === "custom" && (
              <div className="mt-4 space-y-3">
                {(["color1", "color2"] as const).map((k, n) => {
                  const current = inp[k] || (n === 0 ? "#1d5bff" : "#ffd35a");
                  return (
                    <div key={k}>
                      <div className="mb-1.5 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted">
                        <span className="inline-block h-4 w-4 rounded border border-line" style={{ background: current }} />
                        {n === 0 ? (locale === "es" ? "Color principal" : "Main color") : locale === "es" ? "Color secundario" : "Second color"}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {SWATCHES.map((c) => (
                          <button
                            key={c}
                            type="button"
                            aria-label={c}
                            onClick={() => set(k, c)}
                            className={`h-9 w-9 rounded-full border-2 ${current.toLowerCase() === c ? "border-white ring-2 ring-lime" : "border-line"}`}
                            style={{ background: c }}
                          />
                        ))}
                        <label className="relative grid h-9 w-9 cursor-pointer place-items-center overflow-hidden rounded-full border-2 border-dashed border-muted text-sm" title={locale === "es" ? "Otro color" : "Other color"}>
                          ＋
                          <input type="color" value={current} onChange={(e) => set(k, e.target.value)} className="absolute inset-0 h-full w-full cursor-pointer opacity-0" />
                        </label>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            <p className="mt-1 text-xs text-muted">
              {locale === "es"
                ? "Cada póster también recibe su propio fondo, composición, luz y textura, así ninguno sale igual."
                : "Every poster also gets its own background concept, layout, lighting and texture, so no two look the same."}
            </p>
          </div>
          <div className="rounded-xl border border-line bg-panel-2 p-6 text-center">
            <div className="label">{L.preview}</div>
            {(() => {
              const p = FONT_STYLES.find((f) => f.id === inp.fontPrimary);
              const s2 = FONT_STYLES.find((f) => f.id === inp.fontSecondary);
              const title = layout === "LINEUP" ? "LINEUP" : layout === "RESULT" ? "FULL TIME" : layout === "MATCHDAY" ? "MATCH DAY" : layout === "CHAMPIONS" ? "CHAMPIONS" : (inp.name || "PLAYER");
              return (
                <>
                  <div className={`text-4xl ${p?.previewClass ?? ""}`} style={{ fontFamily: FONT_VAR[p?.preview ?? "anton"] }}>{title}</div>
                  <div className={`mt-2 text-lg text-muted ${s2?.previewClass ?? ""}`} style={{ fontFamily: FONT_VAR[s2?.preview ?? "sans"] }}>
                    {(team?.name || home?.name || "RONALDO") + (inp.number ? ` #${inp.number}` : " #7")}
                  </div>
                </>
              );
            })()}
          </div>
          {nav({ canNext: !!inp.fontPrimary, onNext: () => setStep(5) })}
        </div>
      )}

      {step === 5 && (
        <div className="space-y-4">
          <div className="card overflow-hidden">
            {phase === "done" && result?.url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={result.url} alt="" className="block aspect-[4/5] w-full object-cover" />
            ) : (
              <div className="grid aspect-[4/5] place-items-center p-8">
                <div className="w-full max-w-xs">
                  {L.stages.map((s, i) => {
                    const done = phase === "busy" ? i < stage : phase === "done";
                    const active = phase === "busy" && i === stage;
                    return (
                      <div key={s} className="flex items-center gap-3 py-1.5 text-sm">
                        <span
                          className={`grid h-5 w-5 place-items-center rounded-full ${
                            done ? "bg-lime text-[10px] text-ink" : active ? "animate-spin border-2 border-lime border-t-transparent" : "border border-line"
                          }`}
                        >
                          {done ? "✓" : ""}
                        </span>
                        <span className={done || active ? "text-lime" : "text-muted"}>{s}</span>
                      </div>
                    );
                  })}
                  {phase === "busy" && <p className="mt-6 text-center text-xs text-muted">{L.wait}</p>}
                  {phase === "idle" && (
                    <button type="button" className="btn-primary mt-6 w-full py-3" disabled={credits < cost} onClick={generate}>
                      ✨ {L.generate} · {cost} {locale === "es" ? "créditos" : "credits"}
                    </button>
                  )}
                  {phase === "error" && (
                    <>
                      <p className="mt-6 text-center text-sm text-danger">{error}</p>
                      <button type="button" className="btn-primary mt-4 w-full" disabled={credits < cost} onClick={generate}>
                        ↻ {L.generate}
                      </button>
                    </>
                  )}
                  {credits < cost && phase !== "busy" && (
                    <Link href="/pricing" className="btn-ghost mt-3 w-full">{L.getCredits}</Link>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="card p-5 text-sm">
            <h3 className="mb-3 font-bold">{L.finish}</h3>
            <dl className="space-y-2">
              <div className="flex justify-between"><dt className="text-muted">{L.artType}</dt><dd>{artName}</dd></div>
              <div className="flex justify-between">
                <dt className="text-muted">{L.status}</dt>
                <dd>{phase === "done" ? L.completed : phase === "busy" ? L.generating : phase === "error" ? L.failed : "—"}</dd>
              </div>
              <div className="flex justify-between"><dt className="text-muted">{L.creditsUsed}</dt><dd>{cost}</dd></div>
              <div className="flex justify-between rounded-lg bg-panel-2 px-3 py-2"><dt className="text-muted">{L.balance}</dt><dd className="font-bold text-lime">{credits} {locale === "es" ? "créditos" : "credits"}</dd></div>
            </dl>
            {phase === "done" && result && (
              <div className="mt-4 space-y-2">
                {result.url && <DownloadSizes src={result.url} baseName={`kixo-${layout.toLowerCase()}`} />}
                {layout === "PLAYER" && (
                  <Link href={`/create?match=${result.id}`} className="btn-primary w-full">
                    👥 {locale === "es" ? "Siguiente jugador — mismo diseño" : "Next player — same design"}
                  </Link>
                )}
                <Link href={`/banner/${result.id}`} className="btn-ghost w-full">✏️ {L.edit}</Link>
                <button type="button" className="w-full py-2 text-xs text-muted hover:text-white" onClick={reset}>＋ {L.another}</button>
              </div>
            )}
          </div>
          {phase === "idle" && (
            <button type="button" className="text-sm text-muted hover:text-white" onClick={() => setStep(4)}>‹ {L.back}</button>
          )}
        </div>
      )}
    </div>
  );
}
