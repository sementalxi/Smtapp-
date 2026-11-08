import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { getT } from "@/i18n/server";
import { activeTemplates } from "@/lib/queries";
import { getSettings } from "@/lib/settings";
import { PricingCards } from "@/components/PricingCards";
import { HomeHero } from "@/components/HomeHero";
import { RevealOnScroll } from "@/components/RevealOnScroll";
import { DealsSection, type PublicDeal } from "@/components/DealsSection";
import { db } from "@/lib/db";
import type { ClientTemplate } from "@/lib/samples";
import { thumb } from "@/lib/thumb";

export default async function Home() {
  const user = await getCurrentUser().catch(() => null);
  const { t, locale } = await getT();
  let templates: ClientTemplate[] = [];
  let bonus = 3;
  let heroImgs: string[] = [];
  let featImgs: string[] = [];
  let heroBg: { mode: string; video: string; opacity: number; effect?: string } = { mode: "image", video: "", opacity: 70, effect: "stadium" };
  let partners: { id: string; name: string; logoUrl: string | null }[] = [];
  let deals: PublicDeal[] = [];
  try {
    const now = new Date();
    // All home-page data in parallel.
    const [st, tpls, dealRows, partnerRows] = await Promise.all([
      getSettings(),
      activeTemplates(null),
      db.deal.findMany({ where: { active: true, OR: [{ endsAt: null }, { endsAt: { gt: now } }] }, orderBy: [{ sort: "asc" }, { createdAt: "desc" }], take: 9 }),
      db.libraryItem.findMany({ where: { kind: { in: ["championship", "partner"] } }, orderBy: [{ sort: "asc" }, { createdAt: "asc" }], select: { id: true, name: true, logoUrl: true } }),
    ]);
    heroImgs = [st.hero_1, st.hero_2, st.hero_3];
    featImgs = [st.feat_1, st.feat_2, st.feat_3, st.feat_4, st.feat_5, st.feat_6];
    heroBg = { mode: st.hero_bg_mode, video: st.hero_video, opacity: Number(st.hero_video_opacity) || 70, effect: st.hero_effect };
    templates = tpls;
    bonus = Number(st.signup_credits) || 0;
    deals = dealRows.map((x) => ({ id: x.id, title: x.title, subtitle: x.subtitle, price: x.price || (x.priceUsd ? `$${x.priceUsd.toFixed(2)}` : ""), buyable: !!(x.priceUsd && x.credits > 0), tags: x.tags, included: x.included, imageUrl: x.imageUrl, ctaLabel: x.ctaLabel, ctaHref: x.ctaHref, endsAt: x.endsAt ? x.endsAt.toISOString() : null }));
    partners = partnerRows;
  } catch {
    /* DB not ready */
  }

  const gallery = templates.filter((x) => x.thumbUrl).slice(0, 16);
  const rowA = gallery.filter((_, n) => n % 2 === 0);
  const rowB = gallery.filter((_, n) => n % 2 === 1);

  return (
    <div>
      <RevealOnScroll />
      <HomeHero t={t as never} user={!!user} bonus={bonus} heroImgs={heroImgs} featImgs={featImgs} templates={templates} heroBg={heroBg} />

      {/* How it works — numbered timeline */}
      <section className="mx-auto max-w-6xl px-4 py-14 sm:py-20">
        <p data-reveal className="text-xs font-bold uppercase tracking-[0.35em] text-lime">01 — 04</p>
        <h2 data-reveal className="font-display mt-2 text-4xl sm:text-5xl"><span className="gold-text kixo-chapter">{t("how_title")}</span></h2>
        <ol className="relative mt-10 grid gap-6 lg:grid-cols-4 lg:gap-5">
          <span aria-hidden className="absolute left-[21px] top-2 bottom-2 w-px bg-gradient-to-b from-lime via-teal to-lime/0 lg:left-0 lg:right-0 lg:top-[21px] lg:bottom-auto lg:h-px lg:w-auto lg:bg-gradient-to-r" />
          {(["1", "2", "3", "4"] as const).map((n) => (
            <li key={n} data-reveal data-reveal-delay={(Number(n) - 1) * 110} className="group relative flex gap-4 lg:flex-col lg:gap-4">
              <span className="relative z-10 grid h-11 w-11 shrink-0 place-items-center rounded-full border-2 border-lime bg-ink text-base font-extrabold text-lime shadow-[0_0_24px_-4px] shadow-lime/70 transition group-hover:scale-110 group-hover:bg-lime group-hover:text-ink">{n}</span>
              <div className="min-w-0 pt-1 lg:pt-0">
                <div className="text-base font-extrabold uppercase tracking-wide">{t(`how_${n}_t`)}</div>
                <p className="mt-1 text-sm leading-relaxed text-muted">{t(`how_${n}_d`)}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* Styles gallery — only styles with a real sample image */}
      {gallery.length >= 2 && (
        <section id="styles" className="scroll-mt-20 border-y border-line bg-panel/30">
          <div className="mx-auto max-w-6xl px-4 py-14 sm:py-20">
            <div className="flex items-end justify-between gap-4">
              <h2 data-reveal className="font-display text-4xl sm:text-5xl"><span className="gold-text kixo-chapter">{t("styles_title")}</span></h2>
              <Link href={user ? "/create" : "/register"} className="shrink-0 text-sm font-bold text-lime hover:text-white">
                {t("hero_cta")} ›
              </Link>
            </div>
          </div>
          <div className="-mt-6 space-y-3 pb-14 sm:space-y-4 sm:pb-20">
            {[rowA, rowB].filter((r) => r.length).map((row, ri) => (
              <div key={ri} className="relative overflow-hidden [mask-image:linear-gradient(90deg,transparent,black_6%,black_94%,transparent)]">
                <div className={`flex w-max gap-3 sm:gap-4 ${ri ? "kixo-marquee-rev" : "kixo-marquee"}`} style={{ animationDuration: `${Math.max(30, row.length * 7)}s` }}>
                  {[...row, ...row].map((tpl, gi) => (
                    <Link
                      key={`${tpl.id}-${gi}`}
                      href={user ? `/create?t=${tpl.slug}` : "/register"}
                      className="group relative w-36 shrink-0 overflow-hidden rounded-2xl border border-line transition hover:border-lime sm:w-48"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={thumb(tpl.thumbUrl, 480)} alt={tpl.name} loading="lazy" decoding="async" className="kixo-grade block aspect-[4/5] w-full object-cover transition duration-700 group-hover:scale-110" />
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent px-2.5 pt-8 pb-2">
                        <div className="truncate text-xs font-extrabold uppercase tracking-wide">{locale === "es" ? tpl.nameEs : tpl.name}</div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {deals.length > 0 && <DealsSection deals={deals} loggedIn={!!user} />}

      {/* Pricing */}
      <section className="mx-auto max-w-5xl px-4 py-14 sm:py-20">
        <h2 data-reveal className="font-display text-4xl sm:text-5xl"><span className="gold-text kixo-chapter">{t("pricing_title")}</span></h2>
        <p data-reveal className="mt-2 mb-10 text-muted">{t("pricing_sub")}</p>
        <div data-reveal>
          <PricingCards user={user} />
        </div>
      </section>

      {/* Final call to action */}
      <section className="px-4 pb-16">
        <div data-reveal className="relative mx-auto max-w-5xl overflow-hidden rounded-3xl border gold-border bg-gradient-to-br from-lime/15 via-panel to-panel px-6 py-12 text-center sm:py-16">
          <div className="kixo-bg-pan pointer-events-none absolute -top-24 left-1/2 h-64 w-[600px] -translate-x-1/2 rounded-full bg-lime/20 blur-3xl" />
          <h2 className="font-display relative text-4xl sm:text-6xl"><span className="gold-text">{t("home_cta_title")}</span></h2>
          <p className="relative mx-auto mt-3 max-w-md text-muted">{t("home_cta_sub")}</p>
          <Link href={user ? "/create" : "/register"} className="btn-primary kixo-shine relative mt-7 px-8 py-3.5 text-base">
            ⚡ {t("hero_cta")}
          </Link>
        </div>
      </section>

      {partners.length > 0 && (
        <section className="border-t border-line bg-panel/40">
          <div className="mx-auto max-w-6xl px-4 py-12 sm:py-16">
            <div className="flex items-center gap-4">
              <span className="h-px flex-1 bg-gradient-to-r from-transparent to-lime/60" />
              <h2 className="text-center text-[11px] font-bold uppercase tracking-[0.3em] text-lime sm:text-xs">{t("home_partners_title")}</h2>
              <span className="h-px flex-1 bg-gradient-to-l from-transparent to-lime/60" />
            </div>
            {(() => {
              // Just the logos, floating in one slow row — no boxes. Repeated so the row always fills the screen.
              const reps = Math.max(1, Math.ceil(7 / partners.length));
              const row = Array.from({ length: reps }, () => partners).flat();
              const logo = (p: (typeof partners)[number], k: string, n: number) => (
                <div key={k} className="kixo-tl-float flex h-20 w-28 shrink-0 items-center justify-center sm:h-24 sm:w-36" style={{ animationDelay: `${(n % 6) * 0.7}s` }} title={p.name}>
                  {p.logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={thumb(p.logoUrl, 240)} alt={p.name} loading="lazy" decoding="async" className="kixo-tl-glow max-h-full max-w-full object-contain" />
                  ) : (
                    <span className="font-display text-2xl tracking-wider text-white/80">{p.name}</span>
                  )}
                </div>
              );
              return (
                <div className="relative mt-10 overflow-hidden py-3 [mask-image:linear-gradient(90deg,transparent,black_12%,black_88%,transparent)]">
                  <div className="kixo-marquee-slow flex w-max items-center gap-10 sm:gap-16">{[...row, ...row].map((p, k) => logo(p, `${p.id}-${k}`, k))}</div>
                </div>
              );
            })()}
          </div>
        </section>
      )}
    </div>
  );
}
