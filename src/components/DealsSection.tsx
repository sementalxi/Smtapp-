"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useT } from "@/i18n/client";
import { BuyButton } from "./BuyButton";
import { thumb } from "@/lib/thumb";

export interface PublicDeal {
  id: string;
  title: string;
  subtitle: string;
  price: string;
  buyable?: boolean;
  tags: string;
  included: string;
  imageUrl: string | null;
  ctaLabel: string;
  ctaHref: string;
  endsAt: string | null;
}

function Countdown({ endsAt, es }: { endsAt: string; es: boolean }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  if (now === null) return null;
  const left = Math.max(0, new Date(endsAt).getTime() - now);
  const d = Math.floor(left / 864e5);
  const h = Math.floor((left % 864e5) / 36e5);
  const m = Math.floor((left % 36e5) / 6e4);
  const s = Math.floor((left % 6e4) / 1e3);
  const cell = (v: number, l: string) => (
    <div className="min-w-12 rounded-lg border border-white/10 bg-black/40 px-2 py-1.5 text-center">
      <div className="font-display text-xl tabular-nums text-white">{String(v).padStart(2, "0")}</div>
      <div className="text-[9px] font-bold uppercase tracking-widest text-muted">{l}</div>
    </div>
  );
  return (
    <div className="flex justify-center gap-1.5">
      {cell(d, es ? "días" : "days")}
      {cell(h, es ? "hrs" : "hrs")}
      {cell(m, es ? "min" : "min")}
      {cell(s, es ? "seg" : "sec")}
    </div>
  );
}

/** "Don't miss these deals" — admin-managed offer cards that open into details. */
export function DealsSection({ deals, loggedIn = false }: { deals: PublicDeal[]; loggedIn?: boolean }) {
  const { t, locale } = useT();
  const es = locale === "es";
  const tt = t as unknown as (k: string) => string;
  const [open, setOpen] = useState<string | null>(null);

  return (
    <section className="mx-auto max-w-6xl px-4 py-14 sm:py-20">
      <div data-reveal className="text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-gold/50 bg-gold/10 px-3 py-1 text-xs font-bold uppercase tracking-widest text-gold-light">
          🔥 {tt("deals_badge")}
        </span>
        <h2 className="font-display mt-4 text-4xl sm:text-5xl">
          <span className="gold-text">{tt("deals_title")}</span>
        </h2>
        <p className="mx-auto mt-2 max-w-md text-muted">{tt("deals_sub")}</p>
      </div>

      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {deals.map((d, n) => {
          const isOpen = open === d.id;
          const tags = d.tags.split(",").map((x) => x.trim()).filter(Boolean);
          const items = d.included.split("\n").map((x) => x.trim()).filter(Boolean);
          return (
            <div key={d.id} data-reveal data-reveal-delay={(n % 3) * 100} className="deal-hot group relative rounded-2xl p-[2px] transition hover:-translate-y-1">
              <span className="deal-hot-badge">🔥 {es ? "OFERTA" : "HOT DEAL"}</span>
              <div className="relative overflow-hidden rounded-[14px] bg-gradient-to-b from-panel-2 to-panel">
              <span className="deal-hot-shine" aria-hidden />
              <button type="button" onClick={() => setOpen(isOpen ? null : d.id)} className="block w-full text-left">
                <div className="relative">
                  {d.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={thumb(d.imageUrl, 900)} alt="" loading="lazy" decoding="async" className="aspect-[16/9] w-full object-cover transition duration-500 group-hover:scale-105" />
                  ) : (
                    <div className="grid aspect-[16/9] w-full place-items-center bg-[radial-gradient(circle_at_50%_40%,rgba(183,255,69,0.25),transparent_70%)]">
                      <span className="relative grid h-16 w-16 place-items-center rounded-2xl bg-lime text-3xl text-ink shadow-[0_0_40px_-6px] shadow-lime">
                        %
                        <span className="absolute -top-1 -right-1 h-3.5 w-3.5 rounded-full bg-gold shadow-[0_0_10px] shadow-gold" />
                      </span>
                    </div>
                  )}
                  {tags.length > 0 && (
                    <div className="absolute top-3 left-3 flex flex-wrap gap-1.5">
                      {tags.map((tg, k) => (
                        <span key={tg} className={`rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider shadow ${k === 0 ? "bg-lime text-ink" : "bg-teal text-ink"}`}>
                          {tg}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="text-lg font-extrabold leading-tight">{d.title}</h3>
                    {d.price && <span className="font-display shrink-0 text-2xl text-gold-light">{d.price}</span>}
                  </div>
                  {d.subtitle && <p className="mt-1 text-sm text-muted">{d.subtitle}</p>}
                  <div className="mt-3 text-xs font-bold text-lime">{isOpen ? (es ? "Ocultar ▴" : "Hide ▴") : es ? "Ver detalles ▾" : "See details ▾"}</div>
                </div>
              </button>

              {isOpen && (
                <div className="space-y-4 border-t border-line px-4 pt-4 pb-5">
                  {items.length > 0 && (
                    <div>
                      <div className="mb-2 text-xs font-bold uppercase tracking-widest text-gold-light">✦ {tt("deals_included")}</div>
                      <ul className="space-y-1.5 text-sm">
                        {items.map((it) => (
                          <li key={it} className="flex gap-2">
                            <span className="text-lime">✓</span>
                            {it}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {d.endsAt && (
                    <div className="rounded-xl border border-gold/40 bg-gold/5 p-3 text-center">
                      <div className="text-[10px] font-bold uppercase tracking-widest text-muted">{tt("deals_limited")}</div>
                      <div className="font-display mb-2 text-xl">
                        <span className="gold-text">{tt("deals_dont_miss")}</span>
                      </div>
                      <Countdown endsAt={d.endsAt} es={es} />
                    </div>
                  )}
                  <div className="flex items-center justify-center gap-2 text-xs text-muted">🔒 {tt("deals_secure")}</div>
                  {d.buyable ? (
                    <BuyButton kind="deal" id={d.id} label={d.ctaLabel || tt("deals_cta")} loggedIn={loggedIn} primary checkout={{ title: d.title, price: d.price, subtitle: d.subtitle }} />
                  ) : (
                    <Link href={d.ctaHref || "/pricing"} className="btn-primary kixo-shine w-full py-3">
                      {d.ctaLabel || tt("deals_cta")}
                    </Link>
                  )}
                </div>
              )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
