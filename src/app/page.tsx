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
  let heroBg: { mode: string; video: string; opacity: number; effect?: string } = { mode: "image", video: "", opacity: 70, effect: "stadium" };
  let partners: { id: string; name: string; logoUrl: string | null }[] = [];
  let deals: PublicDeal[] = [];
  try {
    const now = new Date();
    // All home-page data in parallel.
    const [st, tpls, dealRows, partnerRows] = await Promise.all([
      getSettings(),
      activeTemplates(),
      db.deal.findMany({ where: { active: true, OR: [{ endsAt: null }, { endsAt: { gt: now } }] }, orderBy: [{ sort: "asc" }, { createdAt: "desc" }], take: 9 }),
      db.libraryItem.findMany({ where: { kind: { in: ["championship", "partner"] } }, orderBy: [{ sort: "asc" }, { createdAt: "asc" }], select: { id: true, name: true, logoUrl: true } }),
    ]);
    heroImgs = [st.hero_1, st.hero_2, st.hero_3].filter(Boolean);
    heroBg = { mode: st.hero_bg_mode, video: st.hero_video, opacity: Number(st.hero_video_opacity) || 70, effect: st.hero_effect };
    templates = tpls;
    bonus = Number(st.signup_credits) || 0;
    deals = dealRows.map((x) => ({ id: x.id, title: x.title, subtitle: x.subtitle, price: x.price || (x.priceUsd ? `$${x.priceUsd.toFixed(2)}` : ""), buyable: !!(x.priceUsd && x.credits > 0), tags: x.tags, included: x.included, imageUrl: x.imageUrl, ctaLabel: x.ctaLabel, ctaHref: x.ctaHref, endsAt: x.endsAt ? x.endsAt.toISOString() : null }));
    partners = partnerRows;
  } catch {
    /* DB not ready */
  }

  const gallery = templates.filter((x) => x.thumbUrl).slice(0, 8);

  return (
    <div>
      <RevealOnScroll />
      <HomeHero t={t as never} user={!!user} bonus={bonus} heroImgs={heroImgs} templates={templates} heroBg={heroBg} />

      {/* How it works — compact numbered steps */}
      <section className="mx-auto max-w-6xl px-4 py-14 sm:py-20">
        <p data-reveal className="text-xs font-bold uppercase tracking-[0.35em] text-lime">01 — 04</p>
        <h2 data-reveal className="font-display mt-2 text-4xl sm:text-5xl"><span className="gold-text kixo-chapter">{t("how_title")}</span></h2>
        <div className="mt-8 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {(["1", "2", "3", "4"] as const).map((n) => (
            <div key={n} data-reveal data-reveal-delay={(Number(n) - 1) * 110} className="group relative overflow-hidden rounded-2xl border border-line bg-gradient-to-b from-panel-2 to-panel p-4 transition hover:-translate-y-1 hover:border-lime/50 sm:p-5">
              <div className="font-display pointer-events-none absolute -top-3 -right-1 text-7xl text-white/[0.04] sm:text-8xl">0{n}</div>
              <span className="grid h-9 w-9 place-items-center rounded-full border border-lime/50 bg-lime/10 text-sm font-extrabold text-lime transition group-hover:scale-110 group-hover:bg-lime group-hover:text-ink">{n}</span>
              <div className="mt-3 text-sm font-extrabold uppercase tracking-wide sm:text-base">{t(`how_${n}_t`)}</div>
              <p className="mt-1 text-xs leading-relaxed text-muted sm:text-sm">{t(`how_${n}_d`)}</p>
            </div>
          ))}
        </div>
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
            <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
              {gallery.map((tpl, gi) => (
                <Link
                  key={tpl.id}
                  data-reveal
                  data-reveal-delay={(gi % 4) * 90}
                  href={user ? `/create?t=${tpl.slug}` : "/register"}
                  className="group relative overflow-hidden rounded-2xl border border-line transition hover:-translate-y-1 hover:border-lime hover:shadow-[0_20px_50px_-20px] hover:shadow-lime/40"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={thumb(tpl.thumbUrl, 480)} alt={tpl.name} loading="lazy" decoding="async" className="kixo-grade block aspect-[4/5] w-full object-cover transition duration-700 group-hover:scale-110" />
                  <span className="kixo-card-scan" aria-hidden />
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent px-3 pt-10 pb-3">
                    <div className="text-sm font-extrabold uppercase tracking-wide">{locale === "es" ? tpl.nameEs : tpl.name}</div>
                  </div>
                </Link>
              ))}
            </div>
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
          <div className="mx-auto max-w-6xl px-4 py-14 text-center">
            <h2 className="text-xs font-bold uppercase tracking-[0.35em] text-lime">{t("home_partners_title")}</h2>
            {partners.length >= 4 ? (
              <div className="relative mt-8 overflow-hidden [mask-image:linear-gradient(90deg,transparent,black_12%,black_88%,transparent)]">
                <div className="kixo-marquee flex w-max items-center gap-12">
                  {[...partners, ...partners].map((p, k) => (
                    <div key={`${p.id}-${k}`} className="group flex w-28 shrink-0 flex-col items-center gap-2 sm:w-32">
                      {p.logoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={thumb(p.logoUrl, 240)} alt={p.name} loading="lazy" decoding="async" className="h-16 w-full object-contain opacity-80 grayscale transition group-hover:opacity-100 group-hover:grayscale-0 sm:h-20" />
                      ) : (
                        <div className="grid h-16 w-16 place-items-center rounded-2xl bg-panel-2 text-2xl font-extrabold sm:h-20 sm:w-20">{p.name[0]}</div>
                      )}
                      <span className="text-[11px] font-bold uppercase tracking-wider text-muted group-hover:text-white">{p.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
            <div data-reveal className="mt-8 flex flex-wrap items-center justify-center gap-x-10 gap-y-8">
              {partners.map((p) => (
                <div key={p.id} className="group flex w-28 flex-col items-center gap-2 sm:w-32">
                  {p.logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={thumb(p.logoUrl, 240)} alt={p.name} loading="lazy" decoding="async" className="h-16 w-full object-contain opacity-80 grayscale transition group-hover:opacity-100 group-hover:grayscale-0 sm:h-20" />
                  ) : (
                    <div className="grid h-16 w-16 place-items-center rounded-2xl bg-panel-2 text-2xl font-extrabold sm:h-20 sm:w-20">{p.name[0]}</div>
                  )}
                  <span className="text-[11px] font-bold uppercase tracking-wider text-muted group-hover:text-white">{p.name}</span>
                </div>
              ))}
            </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
