"use client";

import { useEffect, useState } from "react";

/** First visit: asks which language to use (shown only until a language is chosen). */
export function LangPrompt({ suggested }: { suggested: "en" | "es" }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setShow(true), 350);
    return () => clearTimeout(t);
  }, []);
  if (!show) return null;
  const go = (l: "en" | "es") => {
    const next = window.location.pathname + window.location.search;
    window.location.href = `/api/locale?l=${l}&next=${encodeURIComponent(next)}`;
  };
  const opts = [
    { l: "en" as const, flag: "🇺🇸", name: "English", sub: "Continue in English" },
    { l: "es" as const, flag: "🇲🇽", name: "Español", sub: "Continuar en español" },
  ].sort((a) => (a.l === suggested ? -1 : 1));

  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-ink/80 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Choose your language">
      <div className="kixo-fade-up relative w-full max-w-sm overflow-hidden rounded-3xl border border-lime/30 bg-gradient-to-b from-panel-2 to-panel p-6 text-center shadow-[0_30px_80px_-20px_rgba(0,0,0,0.9)]">
        <div className="pointer-events-none absolute -top-16 left-1/2 h-40 w-64 -translate-x-1/2 rounded-full bg-lime/20 blur-3xl" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/kixo-hero-logo.webp" alt="KIXO" className="kixo-logo-float relative mx-auto h-28 w-auto drop-shadow-[0_0_20px_rgba(70,213,174,0.4)]" />
        <h2 className="font-display relative mt-3 text-3xl tracking-wide">
          Choose your language
          <span className="block text-xl text-lime">Elige tu idioma</span>
        </h2>
        <div className="relative mt-5 space-y-2.5">
          {opts.map((o, i) => (
            <button
              key={o.l}
              type="button"
              onClick={() => go(o.l)}
              className={`flex w-full items-center gap-3 rounded-2xl border px-4 py-3.5 text-left transition hover:-translate-y-0.5 ${i === 0 ? "border-lime bg-lime/10 hover:bg-lime/15" : "border-line bg-ink/40 hover:border-teal/60"}`}
            >
              <span className="text-3xl">{o.flag}</span>
              <span className="flex-1">
                <span className="block font-extrabold">{o.name}</span>
                <span className="block text-xs text-muted">{o.sub}</span>
              </span>
              <span className={i === 0 ? "text-lime" : "text-teal"}>›</span>
            </button>
          ))}
        </div>
        <p className="relative mt-4 text-[11px] text-muted">You can change it anytime at the top · Puedes cambiarlo arriba cuando quieras</p>
      </div>
    </div>
  );
}
