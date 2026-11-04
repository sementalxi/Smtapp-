"use client";

import { useEffect, useRef, useState } from "react";
import { useT } from "@/i18n/client";

const STEPS = {
  en: ["Reading your photo & details", "Designing the layout", "Building the background", "Rendering 3D lettering", "Lighting & effects", "Final touches"],
  es: ["Leyendo tu foto y datos", "Diseñando la composición", "Creando el fondo", "Renderizando letras 3D", "Luces y efectos", "Detalles finales"],
};
const TIPS = {
  en: [
    "Tip: every size — Post, Story and Banner — downloads free.",
    "Tip: use “Next player — same design” to make the whole team match.",
    "Tip: PNG logos with a transparent background look the cleanest.",
    "Tip: not perfect? “New version” makes a fresh take with the same text.",
    "Tip: “Improve my text with AI” writes punchier titles for free.",
  ],
  es: [
    "Tip: todos los tamaños — Post, Historia y Banner — se descargan gratis.",
    "Tip: usa “Siguiente jugador — mismo diseño” para que todo el equipo combine.",
    "Tip: los logos PNG con fondo transparente se ven más limpios.",
    "Tip: ¿no quedó perfecto? “Nueva versión” crea otra con el mismo texto.",
    "Tip: “Mejorar mi texto con IA” escribe títulos con más estilo, gratis.",
  ],
};

/** Real steps reported by the server while the poster is made: where each one sits on the bar, how long it usually takes, what to call it. */
const STAGES: Record<string, { from: number; to: number; secs: number; en: string; es: string; dot: number }> = {
  queued: { from: 0, to: 8, secs: 6, en: "Getting ready", es: "Preparando", dot: 0 },
  art: { from: 8, to: 50, secs: 70, en: "Painting the artwork", es: "Pintando el arte", dot: 1 },
  edit: { from: 8, to: 92, secs: 80, en: "Editing your poster", es: "Editando tu póster", dot: 2 },
  realism: { from: 50, to: 70, secs: 40, en: "Adding realism", es: "Agregando realismo", dot: 3 },
  text: { from: 70, to: 92, secs: 70, en: "Writing your text", es: "Escribiendo tu texto", dot: 4 },
  openai: { from: 8, to: 92, secs: 90, en: "Designing your poster", es: "Diseñando tu póster", dot: 2 },
  finishing: { from: 92, to: 98, secs: 8, en: "Final touches", es: "Detalles finales", dot: 5 },
};

/**
 * Progress screen while the AI makes a poster.
 * With `stage` (reported by the server) the bar follows the real steps; without it, it eases over the expected time.
 * When `done` turns on, the bar sweeps to 100% (the parent waits a moment before showing the result).
 */
export function GenerationProgress({ photo, done, expectedSeconds = 90, stage }: { photo?: string | null; done?: boolean; expectedSeconds?: number; stage?: string | null }) {
  const { locale } = useT();
  const lang = locale === "es" ? "es" : "en";
  const [now, setNow] = useState(() => Date.now());
  const startedRef = useRef(Date.now());
  const stageRef = useRef<{ key: string | null; at: number }>({ key: null, at: Date.now() });
  const doneAtRef = useRef<number | null>(null);
  const maxRef = useRef(0); // the bar never goes backwards

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(t);
  }, []);
  // Remember when each stage started.
  if ((stage ?? null) !== stageRef.current.key) stageRef.current = { key: stage ?? null, at: Date.now() };
  if (done && doneAtRef.current === null) doneAtRef.current = Date.now();

  const secs = (now - startedRef.current) / 1000;
  const info = stage ? STAGES[stage] : undefined;
  let raw: number;
  if (info) {
    // Eases from the stage's start toward its end; only the next stage (or "done") moves it past the end.
    const x = (now - stageRef.current.at) / 1000 / info.secs;
    raw = info.from + (info.to - info.from) * Math.min(0.97, 1 - Math.exp(-x * 2.2));
  } else {
    raw = secs < expectedSeconds ? (90 * secs) / expectedSeconds : Math.min(99, 90 + 9 * (1 - Math.exp(-(secs - expectedSeconds) / 45)));
  }
  maxRef.current = Math.max(maxRef.current, raw);
  let pct = maxRef.current;
  if (doneAtRef.current !== null) {
    // Sweep from wherever we are to 100% in ~0.9 s.
    const k = Math.min(1, (now - doneAtRef.current) / 900);
    pct = maxRef.current + (100 - maxRef.current) * k;
  }

  const steps = STEPS[lang];
  const stepIdx = done ? steps.length : info ? info.dot : Math.min(steps.length - 1, Math.floor((pct / 99) * steps.length));
  const label = done ? (lang === "es" ? "¡Listo!" : "Done!") : info ? info[lang] : steps[stepIdx];
  const tip = TIPS[lang][Math.floor(secs / 7) % TIPS[lang].length];
  const mm = `${Math.floor(secs / 60)}:${String(Math.floor(secs % 60)).padStart(2, "0")}`;
  const left = Math.max(0, Math.round(expectedSeconds - secs));

  return (
    <div className="relative grid aspect-[4/5] w-full place-items-center overflow-hidden bg-ink">
      {/* Backdrop: the user's photo, blurred, with a scanning light */}
      {photo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photo} alt="" className="absolute inset-0 h-full w-full scale-110 object-cover opacity-30 blur-2xl" />
      ) : (
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_30%,rgba(62,224,255,0.18),transparent_60%)]" />
      )}
      <div className="absolute inset-0 bg-gradient-to-b from-ink/40 via-ink/70 to-ink" />
      <div className="kixo-scan pointer-events-none absolute inset-x-0 h-24 bg-gradient-to-b from-transparent via-lime/15 to-transparent" />

      <div className="relative w-full max-w-sm px-6">
        <div className="mb-6 text-center">
          <div className="font-display text-6xl tabular-nums text-white">
            {Math.floor(pct)}
            <span className="text-3xl text-lime">%</span>
          </div>
          <div className="mt-1 text-sm font-semibold text-lime">{label}…</div>
        </div>

        <div className="relative h-2.5 overflow-hidden rounded-full bg-white/10">
          <div
            className="relative h-full rounded-full bg-gradient-to-r from-lime/60 via-lime to-white transition-[width] duration-300 ease-out"
            style={{ width: `${pct}%` }}
          >
            <span className="kixo-shimmer absolute inset-0 bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.6),transparent)]" />
          </div>
        </div>
        <div className="mt-2 flex justify-between text-[11px] tabular-nums text-muted">
          <span>⏱ {mm}</span>
          <span>{done ? "" : left > 0 ? (lang === "es" ? `~${left}s restantes` : `~${left}s left`) : lang === "es" ? "casi listo…" : "almost there…"}</span>
        </div>

        <ol className="mt-6 grid grid-cols-6 gap-1.5">
          {steps.map((s, i) => (
            <li
              key={s}
              title={s}
              className={`h-1 rounded-full transition-colors duration-500 ${i < stepIdx ? "bg-lime" : i === stepIdx ? "animate-pulse bg-lime/60" : "bg-white/10"}`}
            />
          ))}
        </ol>

        <p className="mt-6 min-h-10 text-center text-xs text-muted">{tip}</p>
        <p className="mt-2 text-center text-[11px] text-muted/70">
          {lang === "es" ? "No cierres esta página — si falla, tus créditos se devuelven solos." : "Keep this page open — if it fails, your credits come back automatically."}
        </p>
      </div>
    </div>
  );
}
