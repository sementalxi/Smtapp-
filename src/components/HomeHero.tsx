import Link from "next/link";
import type { ClientTemplate } from "@/lib/samples";
import { TemplateThumb } from "./TemplateThumb";

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

/** Home page hero: big title, feature tiles, poster fan with a phone mockup. */
export function HomeHero({
  t,
  user,
  bonus,
  heroImgs,
  templates,
}: {
  t: T;
  user: boolean;
  bonus: number;
  heroImgs: string[];
  templates: ClientTemplate[];
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
  const strip: [keyof typeof ICONS, string][] = [
    ["bolt", "hero_strip_1"],
    ["gem", "hero_strip_2"],
    ["sliders", "hero_strip_3"],
    ["coins", "hero_strip_4"],
  ];
  const posters = heroImgs.length ? heroImgs.slice(0, 3) : [];
  const tplPosters = posters.length ? [] : templates.slice(0, 3);

  return (
    <section className="relative overflow-hidden border-b border-line">
      <div className="pointer-events-none absolute -top-40 right-0 h-[600px] w-[700px] rounded-full bg-lime/10 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 left-0 h-[300px] w-[500px] rounded-full bg-lime/5 blur-3xl" />
      <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-4 py-12 lg:grid-cols-[1.05fr_1fr] lg:py-20">
        {/* Left: title, copy, feature tiles */}
        <div>
          <p className="mb-4 text-xs font-bold uppercase tracking-[0.35em] text-lime">{tt("hero_kicker")}</p>
          <h1 className="font-display text-[3.4rem] leading-[0.9] sm:text-7xl lg:text-[5.2rem]">{tt("hero_title")}</h1>
          <div className="mt-6 h-1 w-24 rounded-full bg-lime" />
          <p className="mt-6 max-w-lg text-lg text-muted">{tt("hero_sub")}</p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link href={user ? "/create" : "/register"} className="btn-primary px-6 py-3 text-base">
              ⚡ {tt("hero_cta")}
            </Link>
            <Link href="/pricing" className="btn-ghost px-6 py-3 text-base">
              {tt("hero_cta2")}
            </Link>
          </div>
          {bonus > 0 && <p className="mt-3 text-sm text-muted">{tt("free_note", { n: bonus })}</p>}

          <h2 className="font-display mt-10 text-2xl tracking-wide text-lime sm:text-3xl">{tt("hero_feat_title")}</h2>
          <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3">
            {feats.map(([icon, key]) => (
              <div key={key} className="flex items-center gap-3">
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl border border-lime/40 bg-lime/5 text-lime shadow-[0_0_20px_-8px] shadow-lime/60">
                  {ICONS[icon]}
                </span>
                <span className="text-xs font-bold uppercase leading-snug tracking-wide sm:text-sm">{tt(key)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Right: poster fan */}
        <div className="relative mx-auto h-[310px] w-full max-w-[360px] sm:h-[520px] sm:max-w-[520px]">
          {(posters.length ? posters : tplPosters.map((x) => x.id)).map((key, i, arr) => {
            const pos = arr.length === 1 ? [{ l: 20, t: 4, r: 0 }] : [
              { l: 4, t: 10, r: -8 },
              { l: 22, t: 0, r: 0 },
              { l: 40, t: 10, r: 8 },
            ];
            const p = pos[i] ?? pos[0];
            const tpl = tplPosters.find((x) => x.id === key);
            return (
              <div
                key={key}
                className="absolute w-[56%] overflow-hidden rounded-2xl border border-white/10 shadow-2xl shadow-black/70"
                style={{ left: `${p.l}%`, top: `${p.t}%`, transform: `rotate(${p.r}deg)`, zIndex: i === 1 ? 3 : 2 }}
              >
                {tpl ? (
                  <TemplateThumb template={tpl} />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={key} alt="" className="block aspect-[4/5] w-full object-cover" />
                )}
              </div>
            );
          })}

        </div>
      </div>

      {/* Feature strip */}
      <div className="relative border-t border-line bg-panel/60">
        <div className="mx-auto grid max-w-6xl grid-cols-2 divide-line px-4 sm:grid-cols-4 sm:divide-x">
          {strip.map(([icon, key]) => (
            <div key={key} className="flex flex-col items-center gap-2 px-3 py-6 text-center">
              <span className="text-lime">{ICONS[icon]}</span>
              <span className="text-[11px] font-bold uppercase leading-snug tracking-wider">{tt(key)}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
