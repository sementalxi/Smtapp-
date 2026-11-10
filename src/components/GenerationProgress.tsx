"use client";

import { useEffect, useRef, useState } from "react";
import { useT } from "@/i18n/client";

const TIPS = {
  en: [
    "Every size — Post, Story and Banner — downloads free.",
    "“Next player — same design” makes the whole team match.",
    "PNG logos with a transparent background look the cleanest.",
    "Not perfect? “New version” makes a fresh take with the same text.",
    "“Improve my text with AI” writes punchier titles for free.",
    "Claim your daily reward every day for free credits.",
  ],
  es: [
    "Todos los tamaños — Post, Historia y Banner — se descargan gratis.",
    "“Siguiente jugador — mismo diseño” hace que todo el equipo combine.",
    "Los logos PNG con fondo transparente se ven más limpios.",
    "¿No quedó perfecto? “Nueva versión” crea otra con el mismo texto.",
    "“Mejorar mi texto con IA” escribe títulos con más estilo, gratis.",
    "Reclama tu recompensa diaria cada día y gana créditos gratis.",
  ],
};

/** Real steps reported by the server: where each one sits on the bar, how long it usually takes, what to call it. */
const STAGES: Record<string, { from: number; to: number; secs: number; en: string; es: string }> = {
  queued: { from: 0, to: 8, secs: 6, en: "Getting ready", es: "Preparando" },
  art: { from: 8, to: 50, secs: 70, en: "Painting the artwork", es: "Pintando el arte" },
  edit: { from: 8, to: 92, secs: 80, en: "Editing your poster", es: "Editando tu póster" },
  realism: { from: 50, to: 70, secs: 40, en: "Adding realism", es: "Agregando realismo" },
  text: { from: 70, to: 92, secs: 70, en: "Writing your text", es: "Escribiendo tu texto" },
  openai: { from: 8, to: 92, secs: 90, en: "Designing your poster", es: "Diseñando tu póster" },
  finishing: { from: 92, to: 98, secs: 8, en: "Final touches", es: "Detalles finales" },
};

/** The checklist shown under the bar — picked from the first real stage we see. */
type Step = { key: string; icon: string; en: string; es: string; subEn: string; subEs: string };
const STEP_SETS: Record<"mix" | "openai" | "edit", Step[]> = {
  mix: [
    { key: "queued", icon: "📷", en: "Reading your photo & details", es: "Leyendo tu foto y datos", subEn: "Cut-out, crest, colours, fonts", subEs: "Recorte, escudo, colores, fuentes" },
    { key: "art", icon: "🎨", en: "Painting the artwork", es: "Pintando el arte", subEn: "Background, layout and lighting", subEs: "Fondo, composición y luces" },
    { key: "realism", icon: "📸", en: "Adding realism", es: "Agregando realismo", subEn: "Real skin, fabric and light", subEs: "Piel, tela y luz reales" },
    { key: "text", icon: "✍️", en: "Writing your text", es: "Escribiendo tu texto", subEn: "Name, number, position — spelled exactly", subEs: "Nombre, número, posición — tal cual" },
    { key: "finishing", icon: "✨", en: "Final touches", es: "Detalles finales", subEn: "Crest, brand mark, 4K export", subEs: "Escudo, marca, exportación 4K" },
  ],
  openai: [
    { key: "queued", icon: "📷", en: "Reading your photo & details", es: "Leyendo tu foto y datos", subEn: "Cut-out, crest, colours, fonts", subEs: "Recorte, escudo, colores, fuentes" },
    { key: "openai", icon: "🎨", en: "Designing your poster", es: "Diseñando tu póster", subEn: "Layout, artwork and lettering", subEs: "Composición, arte y letras" },
    { key: "finishing", icon: "✨", en: "Final touches", es: "Detalles finales", subEn: "Crest, brand mark, 4K export", subEs: "Escudo, marca, exportación 4K" },
  ],
  edit: [
    { key: "queued", icon: "📷", en: "Reading your changes", es: "Leyendo tus cambios", subEn: "Same image, new instructions", subEs: "Misma imagen, nuevas instrucciones" },
    { key: "edit", icon: "🖌️", en: "Editing your poster", es: "Editando tu póster", subEn: "Only what you asked for changes", subEs: "Solo cambia lo que pediste" },
    { key: "finishing", icon: "✨", en: "Final touches", es: "Detalles finales", subEn: "Crest, brand mark, 4K export", subEs: "Escudo, marca, exportación 4K" },
  ],
};

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

/**
 * Progress screen while the AI makes a poster: the photo being scanned, a live checklist of the real
 * steps, an honest clock and rotating tips. With `stage` (reported by the server) the bar follows the real
 * steps; without it, it eases over the expected time. When `done` turns on, the bar sweeps to 100%.
 */
export function GenerationProgress({ photo, done, expectedSeconds = 90, stage }: { photo?: string | null; done?: boolean; expectedSeconds?: number; stage?: string | null }) {
  const { locale } = useT();
  const lang = locale === "es" ? "es" : "en";
  const es = lang === "es";
  const [now, setNow] = useState(() => Date.now());
  const startedRef = useRef(Date.now());
  const stageRef = useRef<{ key: string | null; at: number }>({ key: null, at: Date.now() });
  const doneAtRef = useRef<number | null>(null);
  const maxRef = useRef(0); // the bar never goes backwards
  const modeRef = useRef<"mix" | "openai" | "edit" | null>(null);
  const seenRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(t);
  }, []);
  if ((stage ?? null) !== stageRef.current.key) stageRef.current = { key: stage ?? null, at: Date.now() };
  if (done && doneAtRef.current === null) doneAtRef.current = Date.now();
  if (stage) seenRef.current.add(stage);
  // Which pipeline is running? Decided by the first real stage we see.
  if (!modeRef.current && stage && stage !== "queued") modeRef.current = stage === "openai" ? "openai" : stage === "edit" ? "edit" : "mix";

  const secs = (now - startedRef.current) / 1000;
  const info = stage ? STAGES[stage] : undefined;
  let raw: number;
  if (info) {
    const x = (now - stageRef.current.at) / 1000 / info.secs;
    raw = info.from + (info.to - info.from) * Math.min(0.97, 1 - Math.exp(-x * 2.2));
  } else {
    raw = secs < expectedSeconds ? (90 * secs) / expectedSeconds : Math.min(99, 90 + 9 * (1 - Math.exp(-(secs - expectedSeconds) / 45)));
  }
  maxRef.current = Math.max(maxRef.current, raw);
  let pct = maxRef.current;
  if (doneAtRef.current !== null) {
    const k = Math.min(1, (now - doneAtRef.current) / 900);
    pct = maxRef.current + (100 - maxRef.current) * k;
  }

  const steps = STEP_SETS[modeRef.current ?? "mix"];
  // Current step index: by real stage when we have one, otherwise by progress.
  const stageIdx = stage ? steps.findIndex((s) => s.key === stage) : -1;
  const curIdx = done ? steps.length : stageIdx >= 0 ? stageIdx : Math.min(steps.length - 1, Math.floor((pct / 99) * steps.length));
  const label = done ? (es ? "¡Listo!" : "Done!") : info ? info[lang] : (steps[curIdx]?.[lang] ?? "");
  const tip = TIPS[lang][Math.floor(secs / 8) % TIPS[lang].length];
  const left = Math.max(0, Math.round(expectedSeconds - secs));

  return (
    <div className="relative grid aspect-[4/5] w-full place-items-center overflow-hidden bg-ink">
      {/* Backdrop: the user's photo, blurred, with a scanning light */}
      {photo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photo} alt="" className="absolute inset-0 h-full w-full scale-110 object-cover opacity-25 blur-2xl" />
      ) : (
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_30%,rgba(255,46,136,0.18),transparent_60%)]" />
      )}
      <div className="absolute inset-0 bg-gradient-to-b from-ink/40 via-ink/75 to-ink" />

      <div className="relative max-h-full w-full max-w-sm overflow-y-auto px-5 py-4">
        {/* The photo being worked on, inside a progress ring */}
        <div className="flex items-center gap-4">
          <div className="relative h-24 w-24 shrink-0">
            <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full -rotate-90">
              <circle cx="50" cy="50" r="46" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="5" />
              <circle cx="50" cy="50" r="46" fill="none" stroke="#ff2e88" strokeWidth="5" strokeLinecap="round" strokeDasharray={`${2 * Math.PI * 46}`} strokeDashoffset={`${2 * Math.PI * 46 * (1 - pct / 100)}`} className="transition-[stroke-dashoffset] duration-300 ease-out" style={{ filter: "drop-shadow(0 0 6px rgba(255,46,136,0.8))" }} />
            </svg>
            <div className="absolute inset-[9px] overflow-hidden rounded-full border border-white/10 bg-panel-2">
              {photo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={photo} alt="" className={`h-full w-full object-cover transition-all duration-700 ${done ? "" : "grayscale-[60%] contrast-125"}`} />
              ) : (
                <div className="grid h-full w-full place-items-center text-3xl">🎨</div>
              )}
              {!done && <div className="kixo-ai-scan" />}
            </div>
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-display text-5xl leading-none tabular-nums text-white">
              {Math.floor(pct)}
              <span className="text-2xl text-lime">%</span>
            </div>
            <div className="mt-1 truncate text-sm font-semibold text-lime">{label}{done ? "" : "…"}</div>
            <div className="mt-1 text-[11px] tabular-nums text-muted">
              ⏱ {mmss(secs)} · {done ? "" : left > 0 ? (es ? `~${mmss(left)} restantes` : `~${mmss(left)} left`) : es ? "casi listo…" : "almost there…"}
            </div>
          </div>
        </div>

        <div className="relative mt-4 h-2 overflow-hidden rounded-full bg-white/10">
          <div className="relative h-full rounded-full bg-gradient-to-r from-lime/60 via-lime to-white transition-[width] duration-300 ease-out" style={{ width: `${pct}%` }}>
            <span className="kixo-shimmer absolute inset-0 bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.6),transparent)]" />
          </div>
        </div>

        {/* Live checklist of the real steps */}
        <ol className="mt-4 space-y-1.5">
          {steps.map((s, i) => {
            const state = i < curIdx ? "done" : i === curIdx ? "active" : "todo";
            return (
              <li
                key={s.key}
                className={`flex items-center gap-3 rounded-xl border px-3 py-2 transition-all duration-500 ${
                  state === "active" ? "border-lime/50 bg-lime/10" : state === "done" ? "border-line/60 bg-panel/40 opacity-80" : "border-transparent opacity-40"
                }`}
              >
                <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-sm ${state === "done" ? "bg-lime text-ink" : state === "active" ? "bg-ink/60 ring-2 ring-lime/70" : "bg-white/5"}`}>
                  {state === "done" ? "✓" : s.icon}
                </span>
                <span className="min-w-0 flex-1">
                  <span className={`block truncate text-[13px] font-bold ${state === "active" ? "text-white" : "text-white/80"}`}>{s[lang]}</span>
                  {state === "active" && <span className="block truncate text-[11px] text-muted">{es ? s.subEs : s.subEn}</span>}
                </span>
                {state === "active" && <span className="kixo-soft-pulse h-2 w-2 shrink-0 rounded-full bg-lime" />}
              </li>
            );
          })}
        </ol>

        <p className="mt-4 min-h-8 text-center text-[11px] text-muted">💡 {tip}</p>
        <p className="mt-1 text-center text-[10px] text-muted/70">
          {es ? "No cierres esta página — si falla, tus créditos se devuelven solos." : "Keep this page open — if it fails, your credits come back automatically."}
        </p>
      </div>
    </div>
  );
}
