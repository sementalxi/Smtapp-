"use client";

import { useEffect, useState } from "react";

/**
 * Home hero showpiece: a floating 3D "holo card" that keeps making posters in front of the visitor —
 * each one starts as a dim scanned photo, the AI pass runs, then the finished poster flashes in with a foil sheen.
 */
export function HeroShowcase({ posters, labels }: { posters: string[]; labels: { designing: string; done: string; next: string } }) {
  const [i, setI] = useState(0);
  const [phase, setPhase] = useState<"build" | "show">("build");
  useEffect(() => {
    if (posters.length < 1) return;
    const a = setTimeout(() => setPhase("show"), 2100);
    const b = setTimeout(() => {
      setI((n) => (n + 1) % posters.length);
      setPhase("build");
    }, 6400);
    return () => {
      clearTimeout(a);
      clearTimeout(b);
    };
  }, [i, posters.length]);
  if (!posters.length) return null;
  const src = posters[i];
  const building = phase === "build";
  return (
    <div className="kixo-holo-wrap relative mx-auto w-[62%] max-w-[300px] lg:w-full lg:max-w-[420px]">
      <div className="kixo-logo-aura pointer-events-none absolute inset-[-10%] rounded-full bg-lime/25 blur-3xl" />
      <div className="kixo-holo-card relative aspect-[4/5] overflow-hidden rounded-2xl border border-white/15 bg-panel shadow-[0_40px_90px_-24px_rgba(0,0,0,0.95)]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          key={src}
          src={src}
          alt=""
          className={`h-full w-full object-cover transition-all duration-700 ${building ? "scale-110 blur-[2px] grayscale contrast-125" : "scale-100 blur-0 grayscale-0"}`}
        />
        {building ? (
          <>
            <div className="kixo-scangrid pointer-events-none absolute inset-0 opacity-60" />
            <div className="kixo-ai-scan" />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink/90 to-transparent p-3">
              <div className="flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-wider text-teal">
                <span className="h-2 w-2 animate-ping rounded-full bg-teal" />
                {labels.designing}
              </div>
              <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/10">
                <div className="kixo-build-bar h-full rounded-full bg-gradient-to-r from-teal via-lime to-white" />
              </div>
            </div>
          </>
        ) : (
          <>
            <span className="kixo-flash pointer-events-none absolute inset-0" />
            <span className="kixo-holo-sheen pointer-events-none absolute inset-y-0 left-0" />
            <div className="pointer-events-none absolute left-2 top-2 flex items-center gap-1 rounded-full bg-ink/80 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-lime backdrop-blur">
              ✓ {labels.done}
            </div>
          </>
        )}
      </div>
      {/* progress dots */}
      <div className="mt-3 flex items-center justify-center gap-1.5">
        {posters.map((_, n) => (
          <span key={n} className={`h-1.5 rounded-full transition-all ${n === i ? "w-5 bg-lime" : "w-1.5 bg-white/25"}`} />
        ))}
      </div>
      <div className="mt-1 text-center text-[10px] font-bold uppercase tracking-[0.3em] text-white/40">{labels.next}</div>
    </div>
  );
}

/** A title word that keeps changing (banners → player cards → lineups…), flipping up without moving the layout. */
export function RotatingWord({ words, className = "" }: { words: string[]; className?: string }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (words.length < 2) return;
    const t = setInterval(() => setI((n) => (n + 1) % words.length), 2400);
    return () => clearInterval(t);
  }, [words.length]);
  return (
    <span className="inline-grid overflow-hidden align-bottom">
      {words.map((w, n) => (
        <span key={w} className={`${className} col-start-1 row-start-1 whitespace-nowrap ${n === i ? "kixo-wordflip" : "invisible"}`} aria-hidden={n !== i}>
          {w}
        </span>
      ))}
    </span>
  );
}

/** Counts up from 0 to the number once it is on screen. */
export function CountUp({ to, className = "" }: { to: number; className?: string }) {
  const [v, setV] = useState(0);
  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const dur = 1400;
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / dur);
      setV(Math.round(to * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [to]);
  return <span className={className}>{v.toLocaleString()}</span>;
}
