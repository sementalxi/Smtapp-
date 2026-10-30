"use client";

import { useEffect, useState } from "react";
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

/**
 * Progress screen while the AI makes a poster. The AI doesn't report real progress,
 * so the bar eases toward 96% over the typical time and jumps to 100% when done.
 */
export function GenerationProgress({ photo, done, expectedSeconds = 90 }: { photo?: string | null; done?: boolean; expectedSeconds?: number }) {
  const { locale } = useT();
  const lang = locale === "es" ? "es" : "en";
  const [secs, setSecs] = useState(0);

  useEffect(() => {
    const started = Date.now();
    const t = setInterval(() => setSecs((Date.now() - started) / 1000), 250);
    return () => clearInterval(t);
  }, []);

  const pct = done ? 100 : Math.min(96, 96 * (1 - Math.exp(-secs / (expectedSeconds / 2.2))));
  const steps = STEPS[lang];
  const stepIdx = done ? steps.length : Math.min(steps.length - 1, Math.floor((pct / 96) * steps.length));
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
          <div className="mt-1 text-sm font-semibold text-lime">{done ? (lang === "es" ? "¡Listo!" : "Done!") : steps[stepIdx]}…</div>
        </div>

        <div className="relative h-2.5 overflow-hidden rounded-full bg-white/10">
          <div
            className="relative h-full rounded-full bg-gradient-to-r from-lime/60 via-lime to-white transition-[width] duration-500 ease-out"
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
