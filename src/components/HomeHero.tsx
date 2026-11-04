import Link from "next/link";
import { HeroEffect } from "./HeroEffect";
import { CountUp, HeroShowcase, RotatingWord } from "./HeroShowcase";
import type { ClientTemplate } from "@/lib/samples";
import { thumb } from "@/lib/thumb";

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


/** Home page hero: big title, feature tiles, animated KIXO crest. */
export function HomeHero({
  t,
  user,
  bonus,
  heroBg,
  heroImgs = [],
  templates = [],
  made = 0,
}: {
  t: T;
  user: boolean;
  bonus: number;
  heroImgs?: string[];
  heroBg?: { mode: string; video: string; opacity: number; effect?: string };
  templates?: ClientTemplate[];
  /** Posters made on the site so far (social proof). */
  made?: number;
}) {
  const tt = t as unknown as (k: string, v?: Record<string, string | number>) => string;
  // Three real sample posters for the hero (labelled styles first).
  const withThumb = templates.filter((x) => x.thumbUrl);
  // Admin's picks (Home page — left / center / right) win; empty spots use style samples.
  // Every real poster we can show: the admin's picks (Home page — left / center / right) first, then style samples.
  const raw = [...new Set([...heroImgs.filter(Boolean), ...[...withThumb.filter((x) => x.badge), ...withThumb.filter((x) => !x.badge)].map((x) => x.thumbUrl!)])];
  // The sliding strip under the hero (up to 14).
  const strip = raw.slice(0, 14).map((u) => thumb(u, 320));
  // Cinematic background: four posters crossfading with a slow zoom (always 4 slots so the CSS timing works).
  const slides = raw.length >= 2 ? [0, 1, 2, 3].map((n) => thumb(raw[n % raw.length], 900)) : [];
  // The showpiece card cycles through the first five.
  const showcase = raw.slice(0, 5).map((u) => thumb(u, 640));
  const words = tt("hero_words").split(",").map((w) => w.trim()).filter(Boolean);
  const feats: [keyof typeof ICONS, string, string][] = [
    ["card", "hero_feat_1", "PLAYER"],
    ["trophy", "hero_feat_2", "CHAMPIONS"],
    ["pitch", "hero_feat_3", "LINEUP"],
    ["image", "hero_feat_4", "MATCHDAY"],
    ["users", "hero_feat_5", "RESULT"],
    ["crown", "hero_feat_6", ""],
  ];

  return (
    <>
    <section className="kixo-letterbox relative overflow-hidden border-b border-line">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {heroBg?.mode === "video" && heroBg.video ? (
        <video
          src={heroBg.video}
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          poster="/kixo-hero-bg.webp"
          aria-hidden
          className="pointer-events-none absolute inset-0 h-full w-full object-cover"
          style={{ opacity: heroBg.opacity / 100 }}
        />
      ) : heroBg?.mode === "none" ? null : slides.length >= 2 ? (
        <div className="pointer-events-none absolute inset-0" aria-hidden>
          {slides.map((src, n) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={n} src={src} alt="" className="kixo-slide absolute inset-0 h-full w-full object-cover object-top opacity-0" style={{ animationDelay: `${n * 6}s` }} />
          ))}
        </div>
      ) : (
        <img src="/kixo-hero-bg.webp" alt="" aria-hidden className="kixo-hero-bg pointer-events-none absolute inset-0 h-full w-full object-cover object-[70%_30%] opacity-90 [filter:hue-rotate(195deg)_saturate(1.1)]" />
      )}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-ink/55 via-ink/75 to-ink lg:bg-gradient-to-r lg:from-ink/95 lg:via-ink/75 lg:to-ink/20" />
      <HeroEffect effect={heroBg?.effect ?? "stadium"} />
      <div className="relative mx-auto grid max-w-7xl items-center gap-10 px-4 pt-10 pb-10 lg:grid-cols-[1fr_1.15fr] lg:py-20">
        {/* Left: kicker chips, slammed title, copy, actions, proof badges */}
        <div className="relative isolate">
          {/* Giant ghost word behind the title, like the background lettering on the posters */}
          <span aria-hidden className="kixo-ghost-word font-display pointer-events-none absolute -left-4 -top-10 select-none text-[34vw] leading-none lg:-top-16 lg:text-[15rem]">
            KIXO
          </span>
          <div className="kixo-fade-up flex flex-wrap gap-1.5">
            {tt("hero_kicker").split("·").map((w, n) => (
              <span key={n} className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.25em] backdrop-blur ${n % 2 ? "border-teal/50 bg-teal/10 text-teal" : "border-lime/50 bg-lime/10 text-lime"}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${n % 2 ? "bg-teal" : "bg-lime"} kixo-glow`} />
                {w.trim()}
              </span>
            ))}
          </div>
          <h1 className="kixo-hero-title font-display mt-5 text-[3.9rem] leading-[0.88] sm:text-7xl lg:text-[5.4rem]">
            <span className="kixo-slam block" style={{ animationDelay: "350ms" }}>
              <span className="kixo-chrome-text">{tt("hero_l1")}</span>
            </span>
            <span className="kixo-slam block" style={{ animationDelay: "510ms" }}>
              <RotatingWord words={words} className="kixo-pink-text" />
            </span>
            <span className="kixo-slam block" style={{ animationDelay: "670ms" }}>
              <span className="kixo-chrome-text">{tt("hero_l3")}</span>
            </span>
          </h1>
          <div className="kixo-fade-up mt-5 flex items-center gap-3" style={{ animationDelay: "700ms" }}>
            <span className="kixo-glow h-1.5 w-24 rounded-full bg-lime" />
            <span className="rounded-md border border-white/15 bg-white/5 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-[0.3em] text-white/80">AI · 4K</span>
          </div>
          <div className="kixo-fade-up mt-6 lg:hidden" style={{ animationDelay: "750ms" }}>
            <HeroShowcase posters={showcase} labels={{ designing: tt("hero_designing"), done: tt("hero_done"), next: tt("hero_next") }} />
          </div>
          <p className="kixo-fade-up mt-6 max-w-lg text-base text-white/85 [text-shadow:0_2px_12px_rgba(0,0,0,0.8)] sm:text-lg" style={{ animationDelay: "800ms" }}>{tt("hero_sub")}</p>
          <div className="kixo-fade-up mt-6 flex flex-wrap gap-3" style={{ animationDelay: "900ms" }}>
            <Link href={user ? "/create" : "/register"} className="btn-primary kixo-shine kixo-cta-pulse px-7 py-3.5 text-base">
              ⚡ {tt("hero_cta")} <span className="ml-1">›</span>
            </Link>
            <Link href="/pricing" className="btn-ghost px-6 py-3.5 text-base">
              {tt("hero_cta2")} <span className="ml-1 text-teal">›</span>
            </Link>
          </div>
          <ul className="kixo-fade-up mt-5 flex flex-wrap gap-x-4 gap-y-1.5 text-[12px] font-semibold text-white/70" style={{ animationDelay: "1000ms" }}>
            <li>⚡ {tt("hero_proof_1")}</li>
            <li>📐 {tt("hero_proof_2")}</li>
            {bonus > 0 && <li className="text-lime">🎁 {tt("free_note", { n: bonus })}</li>}
            {made >= 25 && (
              <li className="text-teal">
                🔥 <CountUp to={made} /> {tt("hero_made_suffix")}
              </li>
            )}
          </ul>
        </div>

        {/* Right (desktop): the showpiece card, or the crest when there are no posters yet */}
        <div className="relative mx-auto hidden w-full max-w-[520px] lg:block">
          {showcase.length ? <HeroShowcase posters={showcase} labels={{ designing: tt("hero_designing"), done: tt("hero_done"), next: tt("hero_next") }} /> : <Crest />}
        </div>
      </div>

      {/* A strip of real posters sliding past — the proof that it works */}
      {strip.length >= 6 && (
        <div className="relative -mx-2 pb-8 pt-2 lg:pb-12" aria-hidden>
          <div className="kixo-strip-tilt">
            <div className="kixo-marquee flex w-max gap-3">
              {[...strip, ...strip].map((src, n) => (
                <div key={n} className={`h-28 w-[5.6rem] shrink-0 overflow-hidden rounded-xl border border-white/10 bg-panel shadow-[0_18px_40px_-16px_rgba(0,0,0,0.9)] sm:h-36 sm:w-28 ${n % 2 ? "translate-y-2" : "-translate-y-1"}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src} alt="" loading="lazy" decoding="async" className="kixo-grade h-full w-full object-cover" />
                </div>
              ))}
            </div>
          </div>
          <div className="pointer-events-none absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-ink to-transparent" />
          <div className="pointer-events-none absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-ink to-transparent" />
        </div>
      )}
    </section>

    {/* Feature tiles — picture cards, each showing a real sample of that kind */}
    <section className="relative border-b border-line bg-ink">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:py-16">
        <div className="flex items-center gap-4">
          <h2 className="font-display lime-text shrink-0 text-3xl tracking-wide sm:text-4xl">{tt("hero_feat_title")}</h2>
          <span className="h-px flex-1 bg-gradient-to-r from-teal/70 to-transparent" />
        </div>
        <div className="mt-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
          {feats.map(([icon, key, layout], n) => {
            const pool = withThumb.filter((x) => !layout || x.layout === layout);
            const pic = (pool[n % Math.max(1, pool.length)] ?? withThumb[n % Math.max(1, withThumb.length)])?.thumbUrl;
            const teal = n % 2 === 1;
            return (
              <Link
                key={key}
                href={user ? (layout ? `/create?type=${layout}` : "/create") : "/register"}
                data-reveal
                data-reveal-delay={n * 70}
                className="group relative isolate flex aspect-[4/5] flex-col justify-end overflow-hidden rounded-2xl border border-line bg-panel-2 p-3 transition duration-300 hover:-translate-y-1 hover:border-lime/60 hover:shadow-[0_24px_60px_-24px] hover:shadow-lime/50 sm:aspect-[4/3] sm:p-4"
              >
                {pic && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={thumb(pic, 480)} alt="" loading="lazy" decoding="async" className="kixo-grade absolute inset-0 -z-10 h-full w-full object-cover opacity-70 transition duration-700 group-hover:scale-110 group-hover:opacity-90" />
                )}
                <div className="absolute inset-0 -z-10 bg-gradient-to-t from-ink via-ink/70 to-ink/10" />
                <span className={`mb-2 grid h-10 w-10 place-items-center rounded-xl border bg-ink/60 backdrop-blur transition group-hover:scale-110 ${teal ? "border-teal/70 text-teal" : "border-lime/70 text-lime"}`}>
                  {ICONS[icon]}
                </span>
                <span className="flex items-end justify-between gap-2">
                  <span className="text-sm font-extrabold uppercase leading-tight tracking-wide [text-shadow:0_2px_10px_rgba(0,0,0,0.9)] sm:text-base">{tt(key)}</span>
                  <span className={`text-lg transition group-hover:translate-x-1 ${teal ? "text-teal" : "text-lime"}`}>›</span>
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
    </>
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
