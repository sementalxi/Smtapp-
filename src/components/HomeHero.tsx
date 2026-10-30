import Link from "next/link";
import type { ClientTemplate } from "@/lib/samples";

type T = (key: never, vars?: Record<string, string | number>) => string;

const ico = (d: string) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
    <path d={d} />
  </svg>
);
const ICONS = {
  card: ico("M7 3h10a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zm5 5a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm-3 9a3 3 0 0 1 6 0"),
  trophy: ico("M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4zM7 6H4a3 3 0 0 0 3 4M17 6h3a3 3 0 0 1-3 4"),
  pitch: ico("M3 5h18v14H3zM12 5v14M3 9h3v6H3M21 9h-3v6h3M12 10a2 2 0 1 0 0 4 2 2 0 0 0 0-4z"),
  image: ico("M4 5h16v14H4zM4 16l5-5 4 4 2-2 5 5M15 9.5a1.5 1.5 0 1 0 0-.01"),
  users: ico("M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM3 20a6 6 0 0 1 12 0M16 4a3 3 0 0 1 0 6M21 20a5 5 0 0 0-4-4.9"),
  crown: ico("M3 8l4 4 5-7 5 7 4-4-2 11H5L3 8z"),
  bolt: ico("M13 2L4 14h7l-1 8 9-12h-7l1-8z"),
  gem: ico("M6 3h12l3 6-9 12L3 9l3-6zM3 9h18M9 3l3 18 3-18"),
  sliders: ico("M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0M14 4v4M8 10v4M16 16v4"),
  coins: ico("M12 3c4.4 0 8 1.3 8 3s-3.6 3-8 3-8-1.3-8-3 3.6-3 8-3zM4 6v6c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6"),
};

// Fixed spark positions (no randomness → same on server and client).
const SPARKS = Array.from({ length: 18 }, (_, n) => ({
  x: (n * 37 + 11) % 100,
  size: 2 + (n % 3),
  dur: 7 + (n % 5) * 2,
  delay: (n * 1.7) % 12,
}));

/** Home page hero: big title, feature tiles, animated KIXO crest. */
export function HomeHero({
  t,
  user,
  bonus,
}: {
  t: T;
  user: boolean;
  bonus: number;
  heroImgs?: string[];
  templates?: ClientTemplate[];
}) {
  const tt = t as unknown as (k: string, v?: Record<string, string | number>) => string;
  const feats: [keyof typeof ICONS, string][] = [
    ["card", "hero_feat_1"],
    ["trophy", "hero_feat_2"],
    ["pitch", "hero_feat_3"],
    ["image", "hero_feat_4"],
    ["users", "hero_feat_5"],
    ["crown", "hero_feat_6"],
  ];

  return (
    <section className="kixo-letterbox relative overflow-hidden border-b border-line">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/kixo-hero-bg.webp" alt="" aria-hidden className="kixo-hero-bg pointer-events-none absolute inset-0 h-full w-full object-cover object-[70%_30%] opacity-90" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-ink/30 via-ink/70 to-ink lg:bg-gradient-to-r lg:from-ink lg:via-ink/75 lg:to-ink/10" />
      <div className="kixo-beam" style={{ left: "8%" }} aria-hidden />
      <div className="kixo-beam" style={{ right: "4%", animationDelay: "-4.5s", animationDuration: "11s" }} aria-hidden />
      <div className="kixo-fog bottom-[-10%] left-[-10%] h-72 w-[70%] bg-teal/15" aria-hidden />
      <div className="kixo-fog top-[20%] right-[-15%] h-80 w-[60%] bg-lime/10" style={{ animationDelay: "-9s" }} aria-hidden />
      <div className="kixo-ai-scan" aria-hidden />
      <div className="kixo-bg-pan pointer-events-none absolute -top-40 right-0 h-[600px] w-[700px] rounded-full bg-lime/10 blur-3xl" />
      <div className="kixo-bg-pan pointer-events-none absolute bottom-0 left-0 h-[300px] w-[500px] rounded-full bg-lime/5 blur-3xl" style={{ animationDelay: "-7s" }} />
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        {SPARKS.map((sp, n) => (
          <span
            key={n}
            className="kixo-spark"
            style={{ left: `${sp.x}%`, bottom: `-${sp.size * 4}px`, width: sp.size, height: sp.size, animationDuration: `${sp.dur}s`, animationDelay: `-${sp.delay}s`, opacity: 0.7 }}
          />
        ))}
      </div>
      <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-4 py-12 lg:grid-cols-[1.05fr_1fr] lg:py-20">
        {/* Left: title, copy, feature tiles */}
        <div className="relative isolate">
          {/* Phone: crest on the right, beside the title */}
          <div className="pointer-events-none absolute -right-4 top-20 -z-10 w-[44%] max-w-[260px] lg:hidden">
            <Crest />
          </div>
          <div className="kixo-fade-up mb-4 inline-flex items-center gap-2 rounded-full border border-lime/30 bg-ink/60 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.25em] text-lime backdrop-blur">
            <span className="kixo-live-dot" />
            <span className="kixo-typing">AI ENGINE · ONLINE</span>
          </div>
          <p className="kixo-fade-up mb-4 text-xs font-bold uppercase tracking-[0.35em] text-teal">{tt("hero_kicker")}</p>
          <h1 className="font-display max-w-[60%] text-[3.4rem] leading-[0.9] sm:max-w-[64%] sm:text-7xl lg:max-w-none lg:text-[5.2rem]">
            {(() => {
              const words = tt("hero_title").split(" ");
              const a = Math.ceil(words.length * 0.4);
              const b = Math.max(a + 1, Math.ceil(words.length * 0.8));
              return words.map((w, n) => (
                <span key={n} className="kixo-focus-in inline-block" style={{ animationDelay: `${450 + n * 110}ms` }}>
                  <span className={n >= a && n < b ? "lime-text" : "gold-text"}>{w}</span>&nbsp;
                </span>
              ));
            })()}
          </h1>
          <div className="kixo-glow kixo-fade-up mt-6 h-1 w-24 rounded-full bg-lime" style={{ animationDelay: "500ms, 500ms" }} />
          <p className="kixo-fade-up mt-6 max-w-lg text-lg text-muted" style={{ animationDelay: "600ms" }}>{tt("hero_sub")}</p>
          <div className="kixo-fade-up mt-7 flex flex-wrap gap-3" style={{ animationDelay: "700ms" }}>
            <Link href={user ? "/create" : "/register"} className="btn-primary kixo-shine px-6 py-3 text-base">
              ⚡ {tt("hero_cta")} <span className="ml-1">›</span>
            </Link>
            <Link href="/pricing" className="btn-ghost px-6 py-3 text-base">
              {tt("hero_cta2")} <span className="ml-1 text-teal">›</span>
            </Link>
          </div>
          {bonus > 0 && <p className="mt-3 text-sm text-muted">{tt("free_note", { n: bonus })}</p>}

          <div className="mt-10 flex items-center gap-4">
            <h2 className="font-display lime-text shrink-0 text-2xl tracking-wide sm:text-3xl">{tt("hero_feat_title")}</h2>
            <span className="h-px flex-1 bg-gradient-to-r from-teal/70 to-transparent" />
          </div>
          <div className="mt-4 grid grid-cols-1 gap-2.5 min-[420px]:grid-cols-2">
            {feats.map(([icon, key]) => (
              <Link
                key={key}
                href={user ? "/create" : "/register"}
                data-reveal
                data-reveal-delay={feats.findIndex((f) => f[1] === key) * 70}
                className="group flex items-center gap-3 rounded-xl border border-line bg-panel-2/60 p-2.5 transition hover:border-lime/50 hover:bg-panel-2"
              >
                <span className={`kixo-icon-pulse grid h-11 w-11 shrink-0 place-items-center rounded-lg border transition group-hover:scale-110 ${feats.findIndex((f) => f[1] === key) % 2 ? "border-teal/60 text-teal" : "border-lime/60 text-lime"}`}>
                  {ICONS[icon]}
                </span>
                <span className="flex-1 text-xs font-bold uppercase leading-snug tracking-wide sm:text-[13px]">{tt(key)}</span>
                <span className="text-teal transition group-hover:translate-x-0.5">›</span>
              </Link>
            ))}
          </div>
        </div>

        {/* Right (desktop): animated KIXO crest */}
        <div className="relative mx-auto hidden w-full max-w-[460px] lg:block">
          <Crest />
        </div>
      </div>

    </section>
  );
}

/** The KIXO wolf crest: floats, glows, shines, with pulsing rings. */
function Crest() {
  return (
    <div className="kixo-logo-in relative">
      <div className="kixo-logo-aura pointer-events-none absolute inset-[8%] rounded-full bg-teal/30 blur-3xl" />
      <div className="kixo-logo-ring pointer-events-none absolute left-1/2 top-1/2 aspect-square w-[78%] -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-lime/40" />
      <div className="kixo-logo-ring pointer-events-none absolute left-1/2 top-1/2 aspect-square w-[78%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-teal/40" style={{ animationDelay: "-1.6s" }} />
      <div className="kixo-logo-float relative">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/kixo-hero-logo.webp" alt="KIXO" width={553} height={655} className="kixo-logo-glow relative block h-auto w-full" />
        <span className="kixo-logo-shine pointer-events-none absolute inset-0" aria-hidden />
      </div>
    </div>
  );
}
